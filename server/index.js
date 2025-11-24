// 1. Load our libraries
require('dotenv').config(); // Loads the .env file first
const express = require('express');
const http = require('http'); // Socket.io HTTP server wrapper
const { Server } = require('socket.io');
const db = require('./database');
const { sendEmail } = require('./emailService');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');
const crypto = require('crypto');
const { authMiddleware, isCollegeAdmin, isHODorAdmin, isDelegate } = require('./authMiddleware');
const multer = require('multer'); // <--- NEW
const { uploadFile } = require('./cloudinaryService'); // <--- NEW
const s3Service = require('./s3Service'); // Optional S3 uploader
const fs = require('fs'); // Node's built-in File System tool
const https = require('https'); // For HEAD checks to Cloudinary

// 2. Get variables
const app = express();
// Trust proxy (needed for secure cookies & correct protocol when behind Render/Vercel proxies)
app.set('trust proxy', 1);

const server = http.createServer(app);

// Shared CORS config for Express – allow all origins for now
// (in production you may want to restrict this to specific domains).
const corsConfig = {
  origin: true, // reflect request origin, effectively allowing all
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

// Socket.IO CORS: also allow all origins to match Express behavior
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    credentials: true
  }
});

// --- Socket Authentication Middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication token missing'));
  try {
    const payload = jsonwebtoken.verify(token, process.env.JWT_SECRET);
    const userId = payload?.user?.id || payload?.id || payload?.user_id || payload?.userId || null;
    if (!userId) {
      console.warn('[Socket Auth] Missing user id in token payload:', payload);
      return next(new Error('Invalid token payload'));
    }
    socket.user = { id: userId };
    console.log('[Socket] Authenticated user', userId);
    next();
  } catch (e) {
    console.error('[Socket Auth] verify error:', e.message);
    next(new Error('Invalid token'));
  }
});

// --- Socket Connection Handling ---
io.on('connection', (socket) => {
  try {
    const userId = socket.user.id;
    socket.join(`user-${userId}`);
    console.log('[Socket] User connected', userId);

    socket.on('chat:join', async ({ connectionId }) => {
      try {
        if (!connectionId) return;
        const check = await db.query(
          `SELECT connection_id FROM connections WHERE connection_id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
          [connectionId, userId]
        );
        if (check.rows.length === 0) return; // Not authorized
        socket.join(`connection-${connectionId}`);
        console.log('[Socket] User', userId, 'joined connection room', connectionId);
      } catch (err) {
        console.error('Socket chat:join error:', err);
      }
    });

    socket.on('disconnect', () => {
      // No special cleanup needed; rooms auto-managed
    });
  } catch (err) {
    console.error('Socket connection error:', err);
  }
});
const port = process.env.PORT || 3001; // Render will supply PORT in production
const projectName = process.env.PROJECT_NAME; // Gets "CareerNest" from .env
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors(corsConfig)); // Robust CORS (credentials + dynamic origins)
// Preflight: cors() middleware already responds to OPTIONS automatically.
// Explicit wildcard registration removed due to path-to-regexp crash; keep lean.
// Configure multer to save files to the local disk temporarily
const upload = multer({ dest: 'temp/' }); // <--- ADD THIS
console.log('Booting API from', __filename);

// --- Ensure DB evolves: add missing optional columns if not present ---
(async () => {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS institute_roll_number VARCHAR(100)`);
    // Allow HODs to assign faculty as verification delegates
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verification_delegate BOOLEAN DEFAULT false`);

    // Seed default Super Admin if not present
    const superAdminEmail = 'careernest.server@gmail.com';
    const superAdminPassword = 'Careernest@123';
    const existing = await db.query(
      `SELECT user_id FROM users WHERE (official_email = $1 OR personal_email = $1) AND role = 'Super Admin'`,
      [superAdminEmail]
    );
    if (existing.rows.length === 0) {
      try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(superAdminPassword, salt);
        await db.query(
          `INSERT INTO users (full_name, official_email, role, status, password_hash) VALUES ($1, $2, 'Super Admin', 'active', $3)`,
          ['CareerNest Super Admin', superAdminEmail, hash]
        );
        console.log('Seeded default Super Admin account.');
      } catch (seedErr) {
        console.error('Failed to seed Super Admin:', seedErr);
      }
    } else {
      console.log('Super Admin account already present.');
    }
  } catch (e) {
    console.error('DB migration check failed (optional columns):', e);
  }
})();

// --- Middleware: restrict to Super Admin ---
function isSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required.' });
  }
  next();
}

// Lightweight helper: get department name + HOD name for a given user_id
async function getDepartmentAndHOD(userId) {
  const result = await db.query(
    `SELECT d.name AS department_name, d.hod_name
     FROM users u
     JOIN departments d ON u.department_id = d.department_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return result.rows[0] || { department_name: null, hod_name: null };
}

// Lightweight helper: get a user's display fields
async function getUserBasic(userId) {
  const r = await db.query(
    `SELECT user_id, full_name, role, official_email, personal_email, college_id, department_id, is_verification_delegate
     FROM users WHERE user_id = $1`, [userId]
  );
  return r.rows[0] || null;
}

// 3. Define our main "route"
app.get('/', (req, res) => {
  // Use our project name
  res.send(`Welcome to the ${projectName} API!`);
});

// Add a new route to test the database connection
app.get('/db-test', async (req, res) => {
  try {
    // Run a simple query to get the current time from PostgreSQL
    const result = await db.query('SELECT NOW()');

    // Send the result back to the browser
    res.json({
      message: 'Database connection successful!',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ error: 'Failed to connect to database.' });
  }
});


/**
 * @route GET /api/public/colleges
 * @desc (PUBLIC) Gets all active college names AND their domains for validation.
 */
app.get('/api/public/colleges', async (req, res) => {
  try {
    // Query to fetch all active colleges and LEFT JOIN their domains
    const result = await db.query(
      `SELECT 
         u.university_id, 
         u.name, 
         ARRAY_AGG(cd.domain) AS domains
       FROM universities u
       LEFT JOIN college_domains cd ON u.university_id = cd.college_id
       WHERE u.status = 'active'
       GROUP BY u.university_id, u.name
       ORDER BY u.name ASC`
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error in /api/public/colleges:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/public/departments/:collegeId
 * @desc (PUBLIC) Gets all departments for a given college for sign-up.
 */
app.get('/api/public/departments/:collegeId', async (req, res) => {
  const { collegeId } = req.params;
  try {
    const departments = await db.query(
      `SELECT department_id, name FROM departments WHERE college_id = $1 ORDER BY name ASC`,
      [collegeId]
    );
    res.status(200).json(departments.rows);
  } catch (err) {
    console.error('Error in /api/public/departments:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/onboarding/request-otp
 * @desc Step 1 of college onboarding.
 * Receives college details, generates an OTP, saves it, and sends it via email.
 [cite_start]* [cite: 146-148]
 */
app.post('/api/onboarding/request-otp', async (req, res) => {
  // 1. Get the data from the frontend form
  const { collegeName, contactName, contactEmail, contactRole } = req.body;

  // 2. Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Set an expiry time (e.g., 10 minutes from now)
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // 4. Save the request and the OTP to our database
    // We use "ON CONFLICT" to handle cases where the same email tries to register again.
    // It will just update the OTP instead of throwing an error.
    await db.query(
      `INSERT INTO onboarding_requests 
         (college_name, contact_name, contact_email, contact_role, otp, otp_expires_at, is_verified)
       VALUES 
         ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (contact_email) 
       DO UPDATE SET
         college_name = EXCLUDED.college_name,
         contact_name = EXCLUDED.contact_name,
         contact_role = EXCLUDED.contact_role,
         otp = EXCLUDED.otp,
         otp_expires_at = EXCLUDED.otp_expires_at,
         is_verified = false`,
      [collegeName, contactName, contactEmail, contactRole, otp, otpExpiresAt]
    );

    // 5. Send the OTP email
    const subject = "Your CareerNest Verification Code";
    const text = `Your verification code is ${otp}. It will expire in 10 minutes.`;
    const html = `<b>Your verification code is ${otp}</b>. It will expire in 10 minutes.`;

    await sendEmail(contactEmail, subject, text, html);

    // 6. Send a success response back to the frontend
    res.status(200).json({ message: 'OTP sent to your email.' });

  } catch (err) {
    console.error('Error in /request-otp:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/onboarding/verify-otp
 * @desc Step 2 of college onboarding.
 * Verifies the OTP. If correct, marks the request as verified.
 [cite_start]* [cite: 151-154]
 */
app.post('/api/onboarding/verify-otp', async (req, res) => {
  // 1. Get the email and OTP from the frontend
  const { contactEmail, otp } = req.body;

  try {
    // 2. Find the request in our database
    const result = await db.query(
      `SELECT * FROM onboarding_requests WHERE contact_email = $1`,
      [contactEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No pending request found for this email.' });
    }

    const request = result.rows[0];

    // 3. Check if the OTP is correct
    if (request.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // 4. Check if the OTP is expired
    if (new Date() > new Date(request.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // 5. If all checks pass, update the user as "verified"
    await db.query(
      `UPDATE onboarding_requests SET is_verified = true, otp = null, otp_expires_at = null WHERE contact_email = $1`,
      [contactEmail]
    );

    // 6. Send success response. The frontend will now show the "Success" message.
    res.status(200).json({ message: 'Email verified successfully! Your request is pending Super Admin approval.' });

  } catch (err) {
    console.error('Error in /verify-otp:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/auth/signup
 * @desc Registers a new user (Student, Faculty, or Alumni) including file upload.
 * (FINAL VERSION: Uses multer and cloudinary)
 */
app.post('/api/auth/signup', upload.single('verificationFile'), async (req, res) => {
  // 1. Get all data (from req.body for text, req.file for file)
  const {
    fullName, email, password, role, collegeId, departmentId, graduationYear, instituteRollNumber,
  } = req.body;
  const file = req.file; // The file object provided by multer

  let fileUrl = null;

  try {
    const collegeIdInt = parseInt(collegeId);
    const departmentIdInt = parseInt(departmentId);

    // --- 1a. CRITICAL FILE UPLOAD LOGIC ---
    if (role === 'Alumni') {
      if (!file) {
        throw new Error('Verification document is required for alumni registration.');
      }
      const provider = (process.env.STORAGE_PROVIDER || 'cloudinary').toLowerCase();
      if (provider === 's3') {
        fileUrl = await s3Service.uploadFileFromPath(
          file.path,
          'career-nest/verification-proofs',
          file.originalname
        ); // returns s3://bucket/key
      } else {
        // Default to Cloudinary
        fileUrl = await uploadFile(
          file.path,
          'career-nest/verification-proofs',
          file.originalname,
          file.mimetype
        );
      }
    }
    // --- END FILE UPLOAD ---

    // 2. Check if user already exists
    const userCheck = await db.query(
      `SELECT * FROM users WHERE official_email = $1 OR personal_email = $1`,
      [email]
    );
    if (userCheck.rows.length > 0) {
      throw new Error('A user with this email already exists.');
    }

    // 3. Backend Domain Validation (CRITICAL SECURITY CHECK)
    if (role !== 'Alumni') {
      const domainsResult = await db.query(
        `SELECT domain FROM college_domains WHERE college_id = $1`,
        [collegeIdInt]
      );
      const validDomains = domainsResult.rows.map(row => row.domain.toLowerCase());
      const emailDomain = email.split('@').pop()?.toLowerCase();
      if (!emailDomain || !validDomains.includes(emailDomain)) {
        const domainList = validDomains.join(' or @');
        return res.status(400).json({ error: `Official email must end with @${domainList}.` });
      }
    }

    // 4. Hash the password and setup status
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000);
    const status = (role === 'Alumni') ? 'pending_admin_approval' : 'pending_email_verification';
    const officialEmailColumn = (role === 'Alumni') ? null : email;
    const personalEmailColumn = (role === 'Alumni') ? email : null;

    // 5. Save the new user to the database (INCLUDING fileUrl)
    await db.query(
      `INSERT INTO users (
         full_name, official_email, personal_email, password_hash, role, status, 
         college_id, department_id, graduation_year, institute_roll_number, verification_document_url, otp, otp_expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        fullName, officialEmailColumn, personalEmailColumn, passwordHash, role, status,
        collegeIdInt || null, departmentIdInt || null, graduationYear || null,
        role === 'Alumni' ? (instituteRollNumber || null) : null,
        fileUrl, otp, otpExpiresAt
      ]
    );

    // 6. Send the OTP verification email
    const subject = "Your CareerNest Verification Code";
    const text = `Your verification code is ${otp}. It will expire in 10 minutes.`;
    const html = `<b>Your verification code is ${otp}</b>. It will expire in 10 minutes.`;
    await sendEmail(email, subject, text, html);

    // 7. Send success response
    res.status(200).json({ message: 'Sign-up successful! An OTP has been sent to your email.' });

  } catch (err) {
    console.error('Error in /api/auth/signup:', err);
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    // Cleanup temp file created by multer
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupErr) {
      console.warn('Temp file cleanup failed:', cleanupErr);
    }
  }
});

/**
 * @route GET /api/auth/me
 * @desc Return fresh user info (for dynamic flags like is_verification_delegate)
 */
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const userRow = await getUserBasic(req.user.id);
    if (!userRow) return res.status(404).json({ error: 'User not found.' });
    res.status(200).json({
      user: {
        id: userRow.user_id,
        fullName: userRow.full_name,
        role: userRow.role,
        email: userRow.official_email || userRow.personal_email,
        college_id: userRow.college_id,
        department_id: userRow.department_id,
        is_verification_delegate: userRow.is_verification_delegate
      }
    });
  } catch (err) {
    console.error('Error in /api/auth/me:', err);
    res.status(500).json({ error: 'Failed to load user.' });
  }
});

/**
 * @route GET /api/hod-admin/delegates
 * @desc (HOD) List all faculty in the HOD's department with delegate flag.
 */
app.get('/api/hod-admin/delegates', [authMiddleware, isHODorAdmin], async (req, res) => {
  const { department_id } = req.user;
  try {
    const faculty = await db.query(
      `SELECT user_id, full_name, official_email, is_verification_delegate
       FROM users
       WHERE department_id = $1 AND role = 'Faculty' AND status != 'suspended'
       ORDER BY full_name ASC`,
      [department_id]
    );
    res.status(200).json({ faculty: faculty.rows });
  } catch (err) {
    console.error('Error in /api/hod-admin/delegates (GET):', err);
    res.status(500).json({ error: 'Failed to load delegates.' });
  }
});

/**
 * @route POST /api/hod-admin/delegates
 * @desc (HOD) Toggle faculty verification delegate flag and notify via email.
 */
app.post('/api/hod-admin/delegates', [authMiddleware, isHODorAdmin], async (req, res) => {
  const { userId, makeDelegate } = req.body;
  const { department_id, user_id: hodId } = req.user;

  if (typeof userId !== 'number') {
    return res.status(400).json({ error: 'userId must be a number.' });
  }

  try {
    // Ensure target user is faculty in same department
    const target = await db.query(
      `SELECT user_id, full_name, official_email, role, department_id, is_verification_delegate
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const faculty = target.rows[0];
    if (faculty.department_id !== department_id || faculty.role !== 'Faculty') {
      return res.status(403).json({ error: 'You may only manage faculty in your department.' });
    }

    const newFlag = !!makeDelegate;
    if (faculty.is_verification_delegate === newFlag) {
      return res.status(200).json({
        message: 'No change.',
        is_verification_delegate: faculty.is_verification_delegate
      });
    }

    await db.query(
      `UPDATE users SET is_verification_delegate = $1 WHERE user_id = $2`,
      [newFlag, userId]
    );

    // Emit real-time delegate flag update
    try { io.emit('delegate:updated', { userId, is_verification_delegate: newFlag }); } catch (e) { /* non-critical */ }

    // Fetch dept + HOD display name for email context
    const { department_name } = await getDepartmentAndHOD(hodId);
    const hodRow = await getUserBasic(hodId);
    const hodName = hodRow?.full_name || 'Your HOD';

    if (newFlag) {
      const subject = 'You have been assigned as an Alumni Verification Delegate';
      const html = `
        <p style="font-size:14px;">Dear ${faculty.full_name},</p>
        <p style="font-size:14px;">You have been selected by <strong>${hodName}</strong>${department_name ? ` – <strong>${department_name}</strong>` : ''} to help verify alumni for CareerNest.</p>
        <p style="font-size:14px;">When you sign in, you will see an <strong>Alumni Verification</strong> link in your sidebar. Use it to approve or reject pending alumni for your department.</p>
        <p style="font-size:14px;">Thank you for supporting your department's alumni network.</p>
      `;
      const text = `Dear ${faculty.full_name},\n\n${hodName} (${department_name || 'Department'}) has selected you to verify alumni on CareerNest.\nYou will now see an 'Alumni Verification' link in your sidebar to review pending alumni.`;
      if (faculty.official_email) {
        try {
          await sendEmail(faculty.official_email, subject, text, html);
        } catch (emailErr) {
          console.error('Failed to send delegate email:', emailErr);
        }
      }
    }

    res.status(200).json({
      message: newFlag ? 'Delegate assigned successfully.' : 'Delegate removed successfully.',
      is_verification_delegate: newFlag
    });
  } catch (err) {
    console.error('Error in /api/hod-admin/delegates (POST):', err);
    res.status(500).json({ error: 'Failed to update delegate.' });
  }
});


/**
 * @route POST /api/auth/verify-otp
 * @desc Verifies a new user's email using the OTP.
 */
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    // 1. Find the user by their email
    const result = await db.query(
      `SELECT * FROM users WHERE official_email = $1 OR personal_email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No user found with this email.' });
    }

    const user = result.rows[0];

    // 2. Check their status
    if (user.status !== 'pending_email_verification' && user.status !== 'pending_admin_approval') {
      return res.status(400).json({ error: 'This account is already verified or is inactive.' });
    }

    // 3. Check OTP
    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // 4. Check Expiry
    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please sign up again.' });
    }

    // 5. Determine the new status
    // If Student/Faculty, they become 'active'.
    // If Alumni, their email is verified, but they remain 'pending_admin_approval'.
    const newStatus = (user.role === 'Student' || user.role === 'Faculty')
      ? 'active'
      : 'pending_admin_approval';

    // 6. Update the user
    await db.query(
      `UPDATE users 
       SET status = $1, otp = null, otp_expires_at = null 
       WHERE user_id = $2`,
      [newStatus, user.user_id]
    );

    // 7. Send success
    const message = newStatus === 'active'
      ? 'Email verified successfully! Your account is now active.'
      : 'Email verified successfully! Your account is now pending review by your department head.';

    res.status(200).json({ message });

  } catch (err) {
    console.error('Error in /api/auth/verify-otp:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/auth/login
 * @desc Logs in a user.
 * (FIXED: Now returns all required user info)
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find the user, getting all necessary fields
    const result = await db.query(
      `SELECT user_id, full_name, role, status, college_id, department_id, password_hash, official_email, personal_email 
       FROM users 
       WHERE official_email = $1 OR personal_email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // 2. Check if the user's account is active
    if (user.status !== 'active') {
      if (user.status === 'pending_email_verification') {
        return res.status(401).json({ error: 'Please verify your email (check your inbox for an OTP).' });
      }
      if (user.status === 'pending_admin_approval') {
        return res.status(401).json({ error: 'Your account is pending admin approval.' });
      }
      return res.status(401).json({ error: 'Your account is not active.' });
    }

    // 3. Compare the password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // 4. Create a login token (JWT)
    const payload = {
      user: {
        id: user.user_id,
        role: user.role,
        college_id: user.college_id,
        department_id: user.department_id
      }
    };

    const token = jsonwebtoken.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Redirect Logic
    let redirectTo = '/home';
    if (user.role === 'College Admin') redirectTo = '/college-admin';
    else if (user.role === 'HOD') redirectTo = '/home';
    else if (user.role === 'Super Admin') redirectTo = '/admin';

    // 6. Send success response with the COMPLETE user object
    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: {
        id: user.user_id,
        fullName: user.full_name,
        role: user.role,
        email: user.official_email || user.personal_email,
        college_id: user.college_id,
        department_id: user.department_id,
        is_verification_delegate: user.is_verification_delegate
      },
      redirectTo: redirectTo
    });

  } catch (err) {
    console.error('Error in /api/auth/login:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/auth/forgot-password
 * @desc Step 1 of password reset.
 * Finds user, generates a reset token, and emails them a link.
 */
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Find the user by their email
    const result = await db.query(
      `SELECT * FROM users WHERE official_email = $1 OR personal_email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      // We send a 200 OK response even if the user doesn't exist.
      // This prevents "email enumeration" attacks.
      return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const user = result.rows[0];

    // 2. Generate a secure, random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    // 3. Save the token to the database
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.user_id, token, expiresAt]
    );

    // 4. Create the reset link
    // This link points to a NEW frontend page we haven't built yet
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    // 5. Send the email
    const subject = "Reset Your CareerNest Password";
    const text = `You requested a password reset. Click this link to create a new password: ${resetLink}`;
    const html = `
      <p>You requested a password reset for your CareerNest account.</p>
      <p>Click the link below to create a new password:</p>
      <a href="${resetLink}" style="padding: 10px 15px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">
        Reset Your Password
      </a>
      <p>This link will expire in 1 hour.</p>
    `;

    await sendEmail(email, subject, text, html);

    // 6. Send success response
    res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });

  } catch (err) {
    console.error('Error in /api/auth/forgot-password:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/auth/reset-password
 * @desc Step 2 of password reset.
 * Verifies the token and updates the user's password.
 */
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // 1. Find the token in our database
    const tokenResult = await db.query(
      `SELECT * FROM password_reset_tokens WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    const tokenData = tokenResult.rows[0];

    // 2. Check if the token is expired
    if (new Date() > new Date(tokenData.expires_at)) {
      // Clean up the expired token
      await db.query(`DELETE FROM password_reset_tokens WHERE token = $1`, [token]);
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    // 3. If token is valid, hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 4. Update the user's password in the 'users' table
    await db.query(
      `UPDATE users SET password_hash = $1, status = 'active' WHERE user_id = $2`,
      [passwordHash, tokenData.user_id]
    );

    // 5. Delete the one-time-use token
    await db.query(`DELETE FROM password_reset_tokens WHERE token = $1`, [token]);

    // 6. Send success response
    res.status(200).json({ message: 'Password has been reset successfully!' });

  } catch (err) {
    console.error('Error in /api/auth/reset-password:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/admin/onboarding-requests
 * @desc (ADMIN) Gets all verified, pending onboarding requests.
 * [cite: 34, 677-679]
 */
app.get('/api/admin/onboarding-requests', [authMiddleware, isSuperAdmin], async (req, res) => {

  try {
    // Find all requests that have been verified by email
    // but have not yet been approved (i.e., they still exist in this table).
    const result = await db.query(
      `SELECT * FROM onboarding_requests WHERE is_verified = true`
    );

    // Send the list of requests back to the frontend
    res.status(200).json(result.rows);

  } catch (err) {
    console.error('Error in /api/admin/onboarding-requests:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/admin/approve-request
 * @desc (ADMIN) Approves a verified onboarding request.
 * This creates the university and the college admin user.
 */
app.post('/api/admin/approve-request', [authMiddleware, isSuperAdmin], async (req, res) => {
  const { requestId } = req.body;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Find the original, verified request
    const requestResult = await client.query(
      `SELECT * FROM onboarding_requests WHERE request_id = $1 AND is_verified = true`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('No verified request found with that ID. It may have already been approved.');
    }

    const request = requestResult.rows[0];

    // 2. Check for duplicate university name
    const existingUniversity = await client.query(
      `SELECT * FROM universities WHERE name = $1`,
      [request.college_name]
    );

    if (existingUniversity.rows.length > 0) {
      throw new Error(`A university named "${request.college_name}" already exists.`);
    }

    // --- NEW: 3. Check for duplicate user email ---
    const existingUser = await client.query(
      `SELECT * FROM users WHERE official_email = $1 OR personal_email = $1`,
      [request.contact_email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error(`A user with the email "${request.contact_email}" already exists.`);
    }
    // --- END NEW ---

    // 4. Create the new University
    const newUniversity = await client.query(
      `INSERT INTO universities (name, admin_name, admin_email, admin_title)
       VALUES ($1, $2, $3, $4)
       RETURNING university_id`,
      [request.college_name, request.contact_name, request.contact_email, request.contact_role]
    );

    const newUniversityId = newUniversity.rows[0].university_id;

    // 5. Create the new College Admin user
    const newUser = await client.query(
      `INSERT INTO users 
         (full_name, official_email, role, status, college_id)
       VALUES 
         ($1, $2, 'College Admin', 'active', $3)
       RETURNING user_id`,
      [request.contact_name, request.contact_email, newUniversityId]
    );

    const newUserId = newUser.rows[0].user_id;

    // 6. Generate a secure "Set Password" token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    // 7. Save the token
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [newUserId, token, tokenExpiresAt]
    );

    // 8. Delete the original request
    await client.query(
      `DELETE FROM onboarding_requests WHERE request_id = $1`,
      [requestId]
    );

    // 9. Commit the transaction
    await client.query('COMMIT');

    // 10. Send the "Welcome & Set Password" email
    const setPasswordLink = `http://localhost:3000/reset-password?token=${token}`;
    const subject = 'Welcome to CareerNest! Your institute has been approved.';
    const html = `
      <p>Congratulations, ${request.contact_name}!</p>
      <p>Your institute, <b>${request.college_name}</b>, has been approved on CareerNest.</p>
      <p>Click the link below to set your password and access your new College Admin dashboard:</p>
      <a href="${setPasswordLink}" style="padding: 10px 15px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">
        Set Your Password
      </a>
      <p>This link will expire in 3 days.</p>
      <p>Thanks,<br/>CareerNest</p>
    `;

    await sendEmail(request.contact_email, subject, html);

    // 11. Send success response
    res.status(200).json({ message: 'Request approved, university created, and welcome email sent!' });

  } catch (err) {
    // 12. If *any* step failed, roll back all changes
    await client.query('ROLLBACK');
    console.error('Error in /api/admin/approve-request:', err);
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    // 13. Release the database client
    client.release();
  }
});


/**
 * @route POST /api/admin/reject-request
 * @desc (ADMIN) Rejects a verified onboarding request.
 * Deletes the request and sends a rejection email.
 */
app.post('/api/admin/reject-request', [authMiddleware, isSuperAdmin], async (req, res) => {
  const { requestId, rejectionReason } = req.body;

  try {
    // 1. Find the request so we can get their email
    const requestResult = await db.query(
      `SELECT * FROM onboarding_requests WHERE request_id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Request not found.');
    }

    const request = requestResult.rows[0];
    const email = request.contact_email;

    // 2. Delete the request from the table
    await db.query(
      `DELETE FROM onboarding_requests WHERE request_id = $1`,
      [requestId]
    );

    // 3. Send the rejection email
    const subject = `Your CareerNest Application: ${request.college_name}`;
    const reasonText = rejectionReason
      ? `The following reason was provided: "${rejectionReason}"`
      : "No specific reason was provided.";

    const text = `Hello ${request.contact_name},\n\nWe regret to inform you that your application to onboard ${request.college_name} to CareerNest has been rejected.\n\n${reasonText}\n\nThank you,\nThe CareerNest Team`;
    const html = `
      <p>Hello ${request.contact_name},</p>
      <p>We regret to inform you that your application to onboard <b>${request.college_name}</b> to CareerNest has been rejected.</p>
      <p>${reasonText}</p>
      <p>Thank you,<br/>The CareerNest Team</p>
    `;

    await sendEmail(email, subject, text, html);

    // 4. Send success response
    res.status(200).json({ message: 'Request rejected and email sent.' });

  } catch (err) {
    console.error('Error in /api/admin/reject-request:', err);
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  }
});

/**
 * @route GET /api/admin/stats
 * @desc (ADMIN) Returns platform-wide statistics for the Super Admin dashboard.
 * Includes total users, breakdown by role, total universities and pending onboarding requests.
 */
app.get('/api/admin/stats', [authMiddleware, isSuperAdmin], async (req, res) => {
  try {
    // Total users
    const totalUsersResult = await db.query(`SELECT COUNT(*) AS count FROM users`);
    const totalUsers = parseInt(totalUsersResult.rows[0].count, 10) || 0;

    // Active users grouped by role
    const rolesResult = await db.query(
      `SELECT role, COUNT(*) as count FROM users WHERE status = 'active' GROUP BY role`
    );
    const roleBreakdown = {};
    for (const r of rolesResult.rows) {
      roleBreakdown[r.role] = parseInt(r.count, 10);
    }

    // Total universities
    const universitiesResult = await db.query(`SELECT COUNT(*) AS count FROM universities`);
    const totalUniversities = parseInt(universitiesResult.rows[0].count, 10) || 0;

    // Pending (verified) onboarding requests
    const pendingRequestsResult = await db.query(
      `SELECT COUNT(*) AS count FROM onboarding_requests WHERE is_verified = true`
    );
    const pendingOnboardingRequests = parseInt(pendingRequestsResult.rows[0].count, 10) || 0;

    res.status(200).json({
      totalUsers,
      roleBreakdown,
      totalUniversities,
      pendingOnboardingRequests,
    });
  } catch (err) {
    console.error('Error in /api/admin/stats:', err);
    res.status(500).json({ error: 'An error occurred while fetching admin stats.' });
  }
});

/**
 * @route GET /api/admin/universities
 * @desc (Super Admin) Lists universities or pending verified requests.
 *        Query param: status=active|pending (default active)
 */
app.get('/api/admin/universities', [authMiddleware, isSuperAdmin], async (req, res) => {
  const { status } = req.query;
  try {
    if (status === 'pending') {
      // Verified onboarding requests awaiting approval
      const pending = await db.query(
        `SELECT request_id, college_name, contact_name, contact_email, contact_role, created_at
         FROM onboarding_requests
         WHERE is_verified = true
         ORDER BY created_at DESC`
      );
      return res.status(200).json({ type: 'pending', items: pending.rows });
    }
    // Active universities
    const active = await db.query(
      `SELECT university_id, name, admin_name, admin_email, admin_title, status, created_at
       FROM universities
       WHERE status = 'active'
       ORDER BY created_at DESC`
    );
    res.status(200).json({ type: 'active', items: active.rows });
  } catch (err) {
    console.error('Error in /api/admin/universities:', err);
    res.status(500).json({ error: 'Failed to fetch universities list.' });
  }
});


/* ---------------------------------- */
/* --- COLLEGE ADMIN API ROUTES --- */
/* ---------------------------------- */

/**
 * @route GET /api/college-admin/domains
 * @desc (College Admin) Get all domains for their college
 */
app.get('/api/college-admin/domains', [authMiddleware, isCollegeAdmin], async (req, res) => {
  try {
    const { college_id } = req.user; // We get this from the token!

    const domains = await db.query(
      `SELECT * FROM college_domains WHERE college_id = $1 ORDER BY domain ASC`,
      [college_id]
    );

    res.status(200).json(domains.rows);
  } catch (err) {
    console.error('Error in /api/college-admin/domains:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * @route POST /api/college-admin/domains
 * @desc (College Admin) Add a new domain to their college
 */
app.post('/api/college-admin/domains', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { domain } = req.body;
  const { college_id } = req.user;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required.' });
  }

  try {
    const newDomain = await db.query(
      `INSERT INTO college_domains (college_id, domain) VALUES ($1, $2) RETURNING *`,
      [college_id, domain]
    );

    res.status(201).json(newDomain.rows[0]);
  } catch (err) {
    console.error('Error in /api/college-admin/domains (POST):', err);
    if (err.code === '23505') { // 23505 is the "unique violation" code
      return res.status(400).json({ error: 'This domain has already been added.' });
    }
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * @route DELETE /api/college-admin/domains/:domainId
 * @desc (College Admin) Delete a domain from their college
 */
app.delete('/api/college-admin/domains/:domainId', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { domainId } = req.params;
  const { college_id } = req.user;

  try {
    // We check domainId AND college_id to make sure an admin can't delete another college's domain
    const result = await db.query(
      `DELETE FROM college_domains WHERE domain_id = $1 AND college_id = $2`,
      [domainId, college_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Domain not found or you do not have permission.' });
    }

    res.status(200).json({ message: 'Domain deleted successfully.' });
  } catch (err) {
    console.error('Error in /api/college-admin/domains (DELETE):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/college-admin/departments
 * @desc (College Admin) Get all departments and their HOD status
 */
app.get('/api/college-admin/departments', [authMiddleware, isCollegeAdmin], async (req, res) => {
  try {
    const { college_id } = req.user;

    // This query now joins with the users table to get the HOD's status
    const departments = await db.query(
      `SELECT 
         d.department_id, d.name, d.dept_code, d.hod_name, d.hod_email,
         u.status as hod_status 
       FROM departments d
       LEFT JOIN users u ON d.hod_email = u.official_email
       WHERE d.college_id = $1 
       ORDER BY d.dept_code ASC`,
      [college_id]
    );

    res.status(200).json(departments.rows);
  } catch (err) {
    console.error('Error in /api/college-admin/departments (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/college-admin/departments
 * @desc (College Admin) Create a new department with a Dept. ID 
 */
app.post('/api/college-admin/departments', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { departmentName, deptCode, hodName, hodEmail } = req.body;
  const { college_id } = req.user;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validate the HOD Email
    const domainsResult = await client.query(
      `SELECT domain FROM college_domains WHERE college_id = $1`,
      [college_id]
    );
    if (domainsResult.rows.length === 0) {
      throw new Error('You must add at least one email domain before you can create a department.');
    }
    const validDomains = domainsResult.rows.map(row => row.domain);
    const isEmailValid = validDomains.some(domain => hodEmail.endsWith(`@${domain}`));
    if (!isEmailValid) {
      throw new Error(`Invalid HOD Email. Email must end with one of your college's domains (e.g., @${validDomains[0]}).`);
    }

    // 2. Check if an HOD with this email already exists
    const existingUser = await client.query(
      `SELECT * FROM users WHERE official_email = $1 OR personal_email = $1`,
      [hodEmail]
    );
    if (existingUser.rows.length > 0) {
      throw new Error('A user with this email already exists.');
    }

    // 3. Create the new department (NOW WITH dept_code)
    const newDepartment = await client.query(
      `INSERT INTO departments (college_id, name, dept_code, hod_name, hod_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING department_id`,
      [college_id, departmentName, deptCode, hodName, hodEmail]
    );

    const newDepartmentId = newDepartment.rows[0].department_id;

    // 4. Create the new HOD user
    const newUser = await client.query(
      `INSERT INTO users (full_name, official_email, role, status, college_id, department_id)
       VALUES ($1, $2, 'HOD', 'pending_invite', $3, $4)
       RETURNING user_id`,
      [hodName, hodEmail, college_id, newDepartmentId]
    );

    const newUserId = newUser.rows[0].user_id;

    // 5. Generate a "Set Password" token for the new HOD
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [newUserId, token, tokenExpiresAt]
    );

    // 6. Commit the transaction
    await client.query('COMMIT');

    // 7. Send the "Set Password" email to the new HOD
    const setPasswordLink = `http://localhost:3000/reset-password?token=${token}`;
    const subject = 'You have been assigned as HOD on CareerNest';

    // Fetch college and department names for personalization
    const collegeResult = await db.query(
      `SELECT name FROM universities WHERE university_id = $1`,
      [college_id]
    );
    const collegeName = collegeResult.rows[0]?.name || 'your institute';

    const html = `
      <p>Hello ${hodName},</p>
      <p>You have been assigned as the new Head of Department for <b>${departmentName}</b> by <b>${req.user.full_name || 'College Admin'}</b> (${req.user.role}), ${collegeName}.</p>
      <p>Click this link to set your password: <a href="${setPasswordLink}">Set Password</a></p>
      <p>Thanks,<br/>CareerNest</p>
    `;

    await sendEmail(hodEmail, subject, html);

    // 8. Send success response
    res.status(201).json({ message: 'Department and HOD created successfully.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/college-admin/departments (POST):', err);
    if (err.code === '23505') { // "unique violation"
      return res.status(400).json({ error: 'A department with this name, ID, or HOD email already exists.' });
    }
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    client.release();
  }
});


/**
 * @route PUT /api/college-admin/departments/:deptId
 * @desc (College Admin) Edit a department's name
 */
app.put('/api/college-admin/departments/:deptId', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { deptId } = req.params;
  const { newName } = req.body;
  const { college_id } = req.user;

  if (!newName) {
    return res.status(400).json({ error: 'New name is required.' });
  }

  try {
    // We check the deptId AND college_id to make sure an admin can't edit another college's dept
    const result = await db.query(
      `UPDATE departments SET name = $1 
       WHERE department_id = $2 AND college_id = $3
       RETURNING *`,
      [newName, deptId, college_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Department not found or you do not have permission.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error in /api/college-admin/departments (PUT):', err);
    // Check for the unique name violation
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A department with this name already exists.' });
    }
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/college-admin/change-hod
 * @desc (College Admin) Assigns a new HOD to a department.
 * (FIXED: Now also deletes the old pending HOD)
 */
app.post('/api/college-admin/change-hod', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { departmentId, hodName, hodEmail } = req.body;
  const { college_id } = req.user;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the department's *current* HOD email
    const oldDept = await client.query(
      `SELECT hod_email FROM departments WHERE department_id = $1 AND college_id = $2`,
      [departmentId, college_id]
    );
    const oldHodEmail = oldDept.rows[0]?.hod_email;

    // 2. Validate the NEW HOD Email
    const domainsResult = await client.query(
      `SELECT domain FROM college_domains WHERE college_id = $1`,
      [college_id]
    );
    if (domainsResult.rows.length === 0) {
      throw new Error('You must add at least one email domain first.');
    }
    const validDomains = domainsResult.rows.map(row => row.domain);
    const isEmailValid = validDomains.some(domain => hodEmail.endsWith(`@${domain}`));
    if (!isEmailValid) {
      throw new Error(`Invalid HOD Email. Email must end with one of your college's domains.`);
    }

    // 3. Check if a user with this NEW email already exists
    const existingUser = await client.query(
      `SELECT * FROM users WHERE official_email = $1 OR personal_email = $1`,
      [hodEmail]
    );
    if (existingUser.rows.length > 0) {
      throw new Error('A user with this email already exists.');
    }

    // 4. Create the NEW HOD user
    const newUser = await client.query(
      `INSERT INTO users (full_name, official_email, role, status, college_id, department_id)
       VALUES ($1, $2, 'HOD', 'pending_invite', $3, $4)
       RETURNING user_id`,
      [hodName, hodEmail, college_id, departmentId]
    );
    const newUserId = newUser.rows[0].user_id;

    // 5. Update the department to link to the new HOD
    await client.query(
      `UPDATE departments 
       SET hod_name = $1, hod_email = $2
       WHERE department_id = $3 AND college_id = $4`,
      [hodName, hodEmail, departmentId, college_id]
    );

    // 6. Delete the OLD HOD user, *if* they existed and were still pending
    if (oldHodEmail) {
      await client.query(
        `DELETE FROM users WHERE official_email = $1 AND status = 'pending_invite'`,
        [oldHodEmail]
      );
    }

    // 7. Generate a "Set Password" token for the NEW HOD
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [newUserId, token, tokenExpiresAt]
    );

    // 8. Commit the transaction
    await client.query('COMMIT');

    // 9. Send the "Set Password" email to the NEW HOD
    const setPasswordLink = `http://localhost:3000/reset-password?token=${token}`;
    const subject = 'You have been assigned as HOD on CareerNest';

    // Fetch college and department names for personalization
    const collegeResult = await db.query(
      `SELECT name FROM universities WHERE university_id = $1`,
      [college_id]
    );
    const collegeName = collegeResult.rows[0]?.name || 'your institute';

    const html = `
      <p>Hello ${hodName},</p>
      <p>You have been assigned as the new Head of Department for <b>${departmentName}</b> by <b>${req.user.full_name || 'College Admin'}</b> (${req.user.role}), ${collegeName}.</p>
      <p>Click this link to set your password: <a href="${setPasswordLink}">Set Password</a></p>
      <p>Thanks,<br/>CareerNest</p>
    `;
    await sendEmail(hodEmail, subject, html);

    // 10. Send success response
    res.status(201).json({ message: 'HOD changed successfully. Invite sent to new HOD.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/college-admin/change-hod (POST):', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    client.release();
  }
});


/**
 * @route GET /api/college-admin/stats
 * @desc (College Admin) Gets all stats AND the college name
 */
app.get('/api/college-admin/stats', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { college_id } = req.user;

  try {
    // 1. Get college-wide user stats
    const overallStatsQuery = db.query(
      `SELECT role, COUNT(*) as count 
       FROM users
       WHERE college_id = $1 AND status = 'active'
       GROUP BY role`,
      [college_id]
    );

    // 2. Get per-department stats
    const deptStatsQuery = db.query(
      `SELECT 
         d.department_id, u.role, COUNT(u.user_id) as count
       FROM departments d
       LEFT JOIN users u ON d.department_id = u.department_id AND u.status = 'active'
       WHERE d.college_id = $1
       GROUP BY d.department_id, u.role`,
      [college_id]
    );

    // --- NEW: 3. Get the College Name ---
    const collegeQuery = db.query(
      `SELECT name FROM universities WHERE university_id = $1`,
      [college_id]
    );
    // --- END NEW ---

    // Run all 3 queries at the same time
    const [overallStatsResult, deptStatsResult, collegeResult] = await Promise.all([
      overallStatsQuery,
      deptStatsQuery,
      collegeQuery // <-- NEW
    ]);

    // 4. Process the Overall Stats
    let overview = {
      totalStudents: 0,
      totalAlumni: 0,
      totalFaculty: 0,
      totalHods: 0,
    };
    for (const row of overallStatsResult.rows) {
      if (row.role === 'Student') overview.totalStudents = parseInt(row.count, 10);
      if (row.role === 'Alumni') overview.totalAlumni = parseInt(row.count, 10);
      if (row.role === 'Faculty') overview.totalFaculty = parseInt(row.count, 10);
      if (row.role === 'HOD') overview.totalHods = parseInt(row.count, 10);
    }

    // 5. Process the Per-Department Stats
    const byDepartment = {};
    for (const row of deptStatsResult.rows) {
      if (!byDepartment[row.department_id]) {
        byDepartment[row.department_id] = {
          students: 0,
          alumni: 0,
          faculty: 0,
        };
      }
      if (row.role === 'Student') byDepartment[row.department_id].students = parseInt(row.count, 10);
      if (row.role === 'Alumni') byDepartment[row.department_id].alumni = parseInt(row.count, 10);
      if (row.role === 'Faculty') byDepartment[row.department_id].faculty = parseInt(row.count, 10);
    }

    // 6. Send the combined stats object
    res.status(200).json({
      collegeName: collegeResult.rows[0].name, // <-- NEW
      overview,
      byDepartment
    });

  } catch (err) {
    console.error('Error in /api/college-admin/stats (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/college-admin/report
 * @desc (College Admin) Gets full detailed list of all users for reporting.
 */
app.get('/api/college-admin/report', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { college_id } = req.user;

  try {
    // --- 1. Detailed User List Query (The main data) ---
    const detailedListQuery = db.query(
      `SELECT
          u.user_id,
          u.full_name,
          u.official_email,
          u.personal_email,
          u.role,
          u.status,
          u.graduation_year,
          d.name AS department_name,
          d.dept_code AS department_id,
          d.hod_name AS department_hod_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.college_id = $1
       ORDER BY d.dept_code ASC, u.full_name ASC`,
      [college_id]
    );

    // --- 2. Totals Query (Summary breakdown) ---
    const totalsQuery = db.query(
      `SELECT role, COUNT(*) as count 
         FROM users 
         WHERE college_id = $1 AND status != 'pending_invite' 
         GROUP BY role`,
      [college_id]
    );

    // Run both queries simultaneously
    const [detailedResult, totalsResult] = await Promise.all([detailedListQuery, totalsQuery]);

    // 3. Send the combined data structure back to the frontend
    res.status(200).json({
      list: detailedResult.rows,
      totals: totalsResult.rows
    });

  } catch (err) {
    console.error('Error in /api/college-admin/report (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route DELETE /api/college-admin/departments/:deptId
 * @desc (College Admin) Delete a department
 * (FIXED: Now also deletes the pending HOD user)
 */
app.delete('/api/college-admin/departments/:deptId', [authMiddleware, isCollegeAdmin], async (req, res) => {
  const { deptId } = req.params;
  const { college_id } = req.user;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the department and check ownership
    const deptResult = await client.query(
      `SELECT * FROM departments WHERE department_id = $1 AND college_id = $2`,
      [deptId, college_id]
    );
    if (deptResult.rows.length === 0) {
      throw new Error('Department not found or you do not have permission.');
    }

    const dept = deptResult.rows[0];

    // 2. Check for ACTIVE users in this department
    const userCountResult = await client.query(
      `SELECT COUNT(*) FROM users WHERE department_id = $1 AND status = 'active'`,
      [deptId]
    );

    const activeUserCount = parseInt(userCountResult.rows[0].count, 10);

    if (activeUserCount > 0) {
      throw new Error(`Cannot delete department. It has ${activeUserCount} active user(s) registered to it.`);
    }

    // 3. If no active users, delete the 'pending_invite' HOD (the "ghost" user)
    // We use the HOD email from the department record
    if (dept.hod_email) {
      await client.query(
        `DELETE FROM users WHERE official_email = $1 AND status = 'pending_invite'`,
        [dept.hod_email]
      );
    }

    // 4. Finally, delete the department itself
    await client.query(
      `DELETE FROM departments WHERE department_id = $1`,
      [deptId]
    );

    // 5. Commit
    await client.query('COMMIT');

    res.status(200).json({ message: 'Department and any pending HOD invites have been deleted.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/college-admin/departments (DELETE):', err);
    res.status(400).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    client.release();
  }
});


/* -------------------------------- */
/* --- HOD ADMIN API ROUTES --- */
/* -------------------------------- */

// Middleware: Allow HOD, College Admin, or Faculty delegate
const alumniVerificationAccess = async (req, res, next) => {
  const role = req.user.role;
  if (role === 'HOD' || role === 'College Admin') return next();
  if (role === 'Faculty') {
    try {
      const r = await db.query('SELECT is_verification_delegate FROM users WHERE user_id = $1', [req.user.id]);
      if (r.rows.length && r.rows[0].is_verification_delegate) return next();
      return res.status(403).json({ error: 'Access denied. Must be an HOD, College Admin, or assigned delegate.' });
    } catch (e) {
      console.error('Delegate access check failed:', e);
      return res.status(500).json({ error: 'Failed access check.' });
    }
  }
  return res.status(403).json({ error: 'Access denied. Must be an HOD, College Admin, or assigned delegate.' });
};

/**
 * @route GET /api/hod-admin/alumni-queue
 * @desc (HOD/Delegate) Gets all pending alumni verification requests for their department.
 *        Only "pending_admin_approval" is returned so that rejected alumni
 *        disappear from the queue and can re-apply with fresh details.
 */
app.get('/api/hod-admin/alumni-queue', [authMiddleware, alumniVerificationAccess], async (req, res) => {
  try {
    const { department_id } = req.user;
    // We now only surface pending_admin_approval items; suspended is not used
    const q = await db.query(
      `SELECT 
         user_id, full_name, personal_email, graduation_year, institute_roll_number, verification_document_url, created_at, role, status
       FROM users
       WHERE department_id = $1 AND role = 'Alumni' AND status = 'pending_admin_approval'
       ORDER BY created_at DESC`,
      [department_id]
    );
    res.status(200).json(q.rows);
  } catch (err) {
    console.error('Error in /api/hod-admin/alumni-queue:', err);
    res.status(500).json({ error: 'Failed to load alumni queue.' });
  }
});

/**
 * @route GET /api/hod-admin/document-link/:userId
 * @desc Returns a working Cloudinary URL for an alumni's verification document (auto-detects raw/image).
 */
app.get('/api/hod-admin/document-link/:userId', [authMiddleware, alumniVerificationAccess], async (req, res) => {
  const { userId } = req.params;

  try {
    // 1) Fetch user record
    const result = await db.query(
      `SELECT user_id, role, college_id, department_id, verification_document_url
       FROM users WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];

    // 2) Authorization: HOD must match department; College Admin must match college
    if (req.user.role === 'HOD' && user.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied for this document.' });
    }
    if (req.user.role === 'College Admin' && user.college_id !== req.user.college_id) {
      return res.status(403).json({ error: 'Access denied for this document.' });
    }
    if (user.role !== 'Alumni') {
      return res.status(400).json({ error: 'Document available for Alumni only.' });
    }
    const originalUrl = user.verification_document_url;
    if (!originalUrl) return res.status(404).json({ error: 'No document on file.' });

    // S3 presigned redirect support
    if (originalUrl.startsWith('s3://')) {
      try {
        const signed = await s3Service.getPresignedGetUrl(originalUrl, 300);
        return res.redirect(302, signed);
      } catch (e) {
        console.error('S3 presign error:', e);
        return res.status(500).json({ error: 'Failed to generate S3 download link.' });
      }
    }
    // S3 presigned link support
    if (originalUrl.startsWith('s3://')) {
      try {
        const signed = await s3Service.getPresignedGetUrl(originalUrl, 300);
        return res.status(200).json({ url: signed });
      } catch (e) {
        console.error('S3 presign error:', e);
        return res.status(500).json({ error: 'Failed to generate S3 download link.' });
      }
    }

    // 3) Build candidate URLs
    const candidates = [];
    const isPdf = originalUrl.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      if (originalUrl.includes('/raw/upload/')) {
        candidates.push(originalUrl);
        candidates.push(originalUrl.replace('/raw/upload/', '/image/upload/'));
      } else if (originalUrl.includes('/image/upload/')) {
        candidates.push(originalUrl.replace('/image/upload/', '/raw/upload/'));
        candidates.push(originalUrl);
      } else {
        candidates.push(originalUrl);
      }
    } else {
      candidates.push(originalUrl);
    }

    // 4) HEAD check helper
    const headOk = (url) => new Promise((resolve) => {
      try {
        const reqHead = https.request(url, { method: 'HEAD' }, (resp) => {
          resolve(resp.statusCode && resp.statusCode >= 200 && resp.statusCode < 400);
        });
        reqHead.on('error', () => resolve(false));
        reqHead.end();
      } catch {
        resolve(false);
      }
    });

    // 5) Return the first working URL
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await headOk(c);
      if (ok) return res.status(200).json({ url: c });
    }

    return res.status(404).json({ error: 'Document not found on Cloudinary (tried multiple variants).' });

  } catch (err) {
    console.error('Error in /api/hod-admin/document-link:', err);
    res.status(500).json({ error: 'Server error while resolving document link.' });
  }
});

/**
 * @route GET /api/hod-admin/document/:userId
 * @desc Streams the alumni document through the server (handles raw/image variants and redirects)
 */
app.get('/api/hod-admin/document/:userId', [authMiddleware, isHODorAdmin], async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT user_id, role, college_id, department_id, verification_document_url
       FROM users WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];

    // Authorization
    if (req.user.role === 'HOD' && user.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied for this document.' });
    }
    if (req.user.role === 'College Admin' && user.college_id !== req.user.college_id) {
      return res.status(403).json({ error: 'Access denied for this document.' });
    }
    if (user.role !== 'Alumni') {
      return res.status(400).json({ error: 'Document available for Alumni only.' });
    }
    const originalUrl = user.verification_document_url;
    if (!originalUrl) return res.status(404).json({ error: 'No document on file.' });

    const isPdf = originalUrl.toLowerCase().endsWith('.pdf');
    const candidates = [];
    if (isPdf) {
      if (originalUrl.includes('/raw/upload/')) {
        candidates.push(originalUrl);
        candidates.push(originalUrl.replace('/raw/upload/', '/image/upload/'));
      } else if (originalUrl.includes('/image/upload/')) {
        candidates.push(originalUrl.replace('/image/upload/', '/raw/upload/'));
        candidates.push(originalUrl);
      } else {
        candidates.push(originalUrl);
      }
    } else {
      candidates.push(originalUrl);
    }

    const tryFetch = (url, depth = 0) => new Promise((resolve) => {
      const reqCloud = https.get(url, (resp) => {
        const status = resp.statusCode || 0;
        if ((status === 301 || status === 302) && resp.headers.location && depth < 3) {
          // Follow redirect
          resp.resume(); // discard
          tryFetch(resp.headers.location, depth + 1).then(resolve);
          return;
        }

        if (status >= 200 && status < 300) {
          // Pipe through with headers
          const contentType = resp.headers['content-type'] || (isPdf ? 'application/pdf' : 'application/octet-stream');
          const contentLength = resp.headers['content-length'];
          res.status(200);
          res.setHeader('Content-Type', contentType);
          if (contentLength) res.setHeader('Content-Length', contentLength);
          // Prefer inline display for PDFs/images
          res.setHeader('Content-Disposition', 'inline');
          resp.pipe(res);
          resolve(true);
        } else {
          resp.resume(); // discard body
          resolve(false);
        }
      });
      reqCloud.on('error', () => resolve(false));
    });

    for (const cand of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryFetch(cand);
      if (ok) return; // response has been sent
    }
    res.status(404).json({ error: 'Document not found on Cloudinary (via proxy).' });
  } catch (err) {
    console.error('Error in /api/hod-admin/document:', err);
    res.status(500).json({ error: 'Server error while fetching document.' });
  }
});


/**
 * @route GET /api/hod-admin/departments
 * @desc (HOD/College Admin) List departments in the HOD's college for transfer actions.
 */
app.get('/api/hod-admin/departments', [authMiddleware, isHODorAdmin], async (req, res) => {
  try {
    const { college_id } = req.user;
    const result = await db.query(
      `SELECT department_id, name FROM departments WHERE college_id = $1 ORDER BY name ASC`,
      [college_id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error in /api/hod-admin/departments:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/hod-admin/verify-alumnus
 * @desc (HOD) Handles Alumni Approval, Rejection, and Department Transfer.
 [cite_start]* [cite: 66, 67, 68]
 */
app.post('/api/hod-admin/verify-alumnus', [authMiddleware, alumniVerificationAccess], async (req, res) => {
  const { userId, actionType, newDeptId, rejectionReason } = req.body;
  const { department_id } = req.user; // HOD's current department ID

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get the user and ensure they belong to this HOD's department
    const userResult = await client.query(
      `SELECT user_id, full_name, personal_email, role, status FROM users 
       WHERE user_id = $1 AND department_id = $2 AND role = 'Alumni' AND status = 'pending_admin_approval'`,
      [userId, department_id]
    );

    if (userResult.rows.length === 0) {
      throw new Error('Alumnus not found or request is not pending in your department.');
    }

    const user = userResult.rows[0];
    let message = 'Action successful.';
    let userEmail = user.personal_email;

    // 2. Process the action type
    if (actionType === 'approve') {
      // A. APPROVE: Set status to active
      await client.query(
        `UPDATE users 
         SET status = 'active', verification_document_url = null
         WHERE user_id = $1`,
        [userId]
      );

      message = `Alumnus ${user.full_name} approved and activated.`;

      // Fetch dept + institute for personalization
      const infoResult = await db.query(
        `SELECT d.name AS department_name, u2.name AS college_name
         FROM departments d
         JOIN universities u2 ON d.college_id = u2.university_id
         WHERE d.department_id = $1`,
        [department_id]
      );
      const deptName = infoResult.rows[0]?.department_name || 'your department';
      const collegeName = infoResult.rows[0]?.college_name || 'your institute';

      // Send activation email
      await sendEmail(
        userEmail,
        'Welcome to CareerNest!',
        `Congratulations! ${user.full_name}. Your account is now active.`,
        `<p>Congratulations! <b>${user.full_name}</b>. Your account is now active for ${deptName}, ${collegeName}.</p><p>Thanks,<br/>CareerNest</p>`
      );

    } else if (actionType === 'reject') {
      // B. REJECT: Hard-reject the request so they can sign up again
      // Clear the document and move status back to pending_email_verification
      await client.query(
        `UPDATE users 
         SET status = 'pending_email_verification', verification_document_url = null
         WHERE user_id = $1`,
        [userId]
      );

      message = `Alumnus ${user.full_name} rejected. They may submit a new request.`;

      // Fetch dept + institute + rejector for personalization
      const infoResult2 = await db.query(
        `SELECT d.name AS department_name, u2.name AS college_name
         FROM departments d
         JOIN universities u2 ON d.college_id = u2.university_id
         WHERE d.department_id = $1`,
        [department_id]
      );
      const deptName2 = infoResult2.rows[0]?.department_name || 'your department';
      const collegeName2 = infoResult2.rows[0]?.college_name || 'your institute';
      const rejectorName = req.user.full_name || 'Admin';

      // Send rejection email with reason
      const reason = rejectionReason || 'The submitted verification document did not meet our criteria.';
      await sendEmail(
        userEmail,
        'Your CareerNest Verification Status',
        `Dear ${user.full_name}, unfortunately, your request to join the ${deptName2}, ${collegeName2} has been rejected by ${rejectorName}. Reason for Rejection: ${reason}`,
        `<p>Dear ${user.full_name}, unfortunately, your request to join the <b>${deptName2}</b>, <b>${collegeName2}</b> has been rejected by <b>${rejectorName}</b>.</p><p><b>Reason for Rejection:</b> ${reason}</p><p>Thanks,<br/>CareerNest</p>`
      );

    } else if (actionType === 'transfer') {
      // Delegates (faculty) cannot transfer
      if (req.user.role === 'Faculty') {
        throw new Error('Delegates cannot transfer alumni between departments.');
      }
      // C. TRANSFER: Update department ID
      if (!newDeptId) throw new Error('New department ID is required for transfer.');

      // Check if new department exists in this college
      const deptCheck = await client.query(
        `SELECT department_id FROM departments WHERE department_id = $1 AND college_id = $2`,
        [newDeptId, req.user.college_id]
      );

      if (deptCheck.rows.length === 0) {
        throw new Error('Transfer target department not found in this college.');
      }

      // Transfer the user to the new department ID
      await client.query(
        `UPDATE users 
         SET department_id = $1
         WHERE user_id = $2`,
        [newDeptId, userId]
      );

      // User remains in 'pending_admin_approval' status.
      message = `Alumnus ${user.full_name} transferred to Department ID ${newDeptId}.`;
    } else {
      throw new Error('Invalid action type.');
    }

    await client.query('COMMIT');
    res.status(200).json({ message });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/hod-admin/verify-alumnus:', err);
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    client.release();
  }
});


/**
 * @route GET /api/hod-admin/department-roster
 * @desc (HOD) Gets a paginated list of all active users in their department.
 * (FIXED: Resolved all syntax/data type errors for PostgreSQL)
 */
app.get('/api/hod-admin/department-roster', [authMiddleware, isHODorAdmin], async (req, res) => {
  const { department_id } = req.user;

  // Explicitly clean query params for safety in JavaScript
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  const roleFilter = req.query.roleFilter || 'all';
  const statusFilter = req.query.statusFilter || 'active';

  try {
    // 1. Build Dynamic WHERE Clause
    let whereClause = `department_id = $1 AND role NOT IN ('HOD', 'College Admin', 'Super Admin')`;
    const params = [department_id];
    let paramIndex = 2; // Start index for dynamic parameters

    if (roleFilter !== 'all') {
      whereClause += ` AND role = $${paramIndex++}`;
      params.push(roleFilter);
    }

    if (statusFilter !== 'all') {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(statusFilter);
    } else {
      whereClause += ` AND status != 'pending_invite'`;
    }

    if (search) {
      whereClause += ` AND full_name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    // Add LIMIT and OFFSET to the parameters list for the query execution
    const finalParams = [...params, limit, offset];

    // 2. Fetch Total Count 
    const countResult = await db.query(
      `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
      params
    );
    const totalUsers = parseInt(countResult.rows[0].count, 10);

    // 3. Fetch Paginated Roster
    const roster = await db.query(
      `SELECT 
         user_id, full_name, official_email, personal_email, role, status, created_at, is_verification_delegate
       FROM users 
       WHERE ${whereClause}
       ORDER BY full_name ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      finalParams
    );

    // 4. Send the paginated data structure
    res.status(200).json({
      total: totalUsers,
      users: roster.rows,
      limit: limit,
      offset: offset
    });

  } catch (err) {
    console.error('Error in /api/hod-admin/department-roster:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/hod-admin/suspend-user
 * @desc (HOD) Toggles suspension for a user (Student/Faculty/Alumni) in their department.
 *        If currently active, they become suspended; if suspended, they become active again.
 */
app.post('/api/hod-admin/suspend-user', [authMiddleware, isHODorAdmin], async (req, res) => {
  const { userId } = req.body;
  const { department_id } = req.user;

  try {
    // 1. Ensure the user exists and belongs to this HOD's department
    const result = await db.query(
      `SELECT user_id, full_name, role, status FROM users 
       WHERE user_id = $1 AND department_id = $2`,
      [userId, department_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in your department.' });
    }

    const user = result.rows[0];

    // 2. Prevent suspension of Admins/HODs (Self-protection)
    if (user.role === 'HOD' || user.role === 'College Admin' || user.role === 'Super Admin') {
      return res.status(403).json({ error: 'Cannot suspend an administrative account.' });
    }

    // 3. Toggle between 'active' and 'suspended'
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    await db.query(
      `UPDATE users SET status = $1 WHERE user_id = $2`,
      [newStatus, userId]
    );

    const actionLabel = newStatus === 'suspended' ? 'suspended' : 're-activated';
    res.status(200).json({
      message: `User ${user.full_name || userId} ${actionLabel} successfully.`,
      status: newStatus,
      fullName: user.full_name || null,
    });
  } catch (err) {
    console.error('Error in /api/hod-admin/suspend-user:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * Legacy reinstate-alumnus endpoint is no longer used now that rejection
 * removes requests from the queue and suspend-user toggles active/suspended.
 * We keep a stub returning 410 to avoid accidental use.
 */
app.post('/api/hod-admin/reinstate-alumnus', [authMiddleware, alumniVerificationAccess], (req, res) => {
  return res.status(410).json({ error: 'reinstate-alumnus is deprecated. Use suspend toggle and new signup flow.' });
});


/**
 * @route GET /api/users/search
 * @desc (Authenticated User) Search for users to tag in posts/comments.
 */
app.get('/api/users/search', [authMiddleware], async (req, res) => {
  const { college_id } = req.user;
  const { q } = req.query; // Search query

  try {
    let query;
    let params;

    if (q && q.trim() !== '') {
      // If there is a search query, find matching users
      query = `
        SELECT u.user_id, u.full_name, u.role, p.headline
        FROM users u
        LEFT JOIN profiles p ON u.user_id = p.user_id
        WHERE u.college_id = $1 
          AND u.status = 'active' 
          AND u.role NOT IN ('College Admin', 'Super Admin')
          AND (u.full_name ILIKE $2 OR u.official_email ILIKE $2)
        LIMIT 10`;
      params = [college_id, `${q}%`]; // CHANGED: from %${q}% to ${q}%
    } else {
      // If there is no search query, get a default list of users (e.g., recently active or just alphabetical)
      query = `
        SELECT u.user_id, u.full_name, u.role, p.headline
        FROM users u
        LEFT JOIN profiles p ON u.user_id = p.user_id
        WHERE u.college_id = $1 
          AND u.status = 'active' 
          AND u.role NOT IN ('College Admin', 'Super Admin')
        ORDER BY u.full_name ASC
        LIMIT 5`;
      params = [college_id];
    }

    const users = await db.query(query, params);
    res.status(200).json(users.rows);
    
  } catch (err) {
    console.error('Error in /api/users/search:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/* ---------------------------------- */
/* --- MAIN PLATFORM API ROUTES --- */
/* ---------------------------------- */

/**
 * @route GET /api/people
 * @desc (Authenticated User) Gets a paginated and filtered list of users
 * in their own college, including connection status.
 * (FIXED: Now includes connection_id for "Accept" button)
 */
app.get('/api/people', [authMiddleware], async (req, res) => {
  const { id: my_user_id, college_id } = req.user;
  const { 
 
    limit = 20, offset = 0, search = '', role = 'all',
    yearOfStudy = 'all', passingYear = 'all', dept = 'all' 
  } = req.query;

  try {
    let whereClause = `u.college_id = $2 AND u.status = 'active' AND u.user_id != $1 AND u.role NOT IN ('College Admin', 'Super Admin')`;
    const params = [my_user_id, college_id];
    let paramIndex = 3; // Start index for dynamic parameters

    if (role !== 'all') {
      whereClause += ` AND role = $${paramIndex++}`;
      params.push(role);
    }

    if (dept !== 'all') {
      // Qualify department_id with the users table alias to avoid ambiguity
      whereClause += ` AND u.department_id = $${paramIndex++}`;
      params.push(dept);
    }

    if (search) {
      whereClause += ` AND full_name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    if (role === 'Alumni' && passingYear && passingYear !== 'all') {
      whereClause += ` AND graduation_year = $${paramIndex++}`;
      params.push(passingYear);
    }

    // 4. Get the Total Count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
      params
    );
    const totalUsers = parseInt(countResult.rows[0].count, 10);

    // 5. Get the paginated users
    const usersResult = await db.query(
      `SELECT 
        u.user_id, u.full_name, u.role, u.graduation_year,
        d.name as department_name,
        p.headline,
        p.profile_icon_url,
        u.user_id, u.full_name, u.role, u.graduation_year,
        d.name as department_name,
         -- Connection Status Subquery
         (SELECT 
            CASE
                WHEN conn.connection_id IS NOT NULL THEN conn.status
                ELSE NULL
            END
          FROM connections conn 
          WHERE (conn.sender_id = $1 AND conn.receiver_id = u.user_id) OR (conn.receiver_id = $1 AND conn.sender_id = u.user_id)
          LIMIT 1
         ) as connection_status,
         -- Connection Sender Subquery
         (SELECT 
            CASE
                WHEN conn.connection_id IS NOT NULL THEN conn.sender_id
                ELSE NULL
            END
          FROM connections conn 
          WHERE (conn.sender_id = $1 AND conn.receiver_id = u.user_id) OR (conn.receiver_id = $1 AND conn.sender_id = u.user_id)
          LIMIT 1
         ) as connection_sender_id,
         -- Connection ID Subquery
         (SELECT 
            CASE
                WHEN conn.connection_id IS NOT NULL THEN conn.connection_id
                ELSE NULL
            END
          FROM connections conn 
          WHERE (conn.sender_id = $1 AND conn.receiver_id = u.user_id) OR (conn.receiver_id = $1 AND conn.sender_id = u.user_id)
          LIMIT 1
         ) as connection_id
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.department_id
      LEFT JOIN profiles p ON u.user_id = p.user_id
       WHERE ${whereClause}
       ORDER BY u.full_name ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.status(200).json({
      total: totalUsers,
      users: usersResult.rows,
    });

  } catch (err) {
    console.error('Error in /api/people:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/jobs
 * @desc (Authenticated User) Gets all jobs for their college.
 * (FIXED: Fetches new link and email columns)
 */
app.get('/api/jobs', [authMiddleware], async (req, res) => {
  const { college_id } = req.user; 

  try {
    const jobsResult = await db.query(
      `SELECT 
         j.job_id, j.title, j.company_name, j.location, j.job_type, j.description, 
         j.application_link, j.application_email, -- <-- MODIFIED
         j.created_at,
         u.full_name as posted_by_name,
         u.role as posted_by_role,
         u.user_id as posted_by_user_id
       FROM jobs j
       JOIN users u ON j.user_id = u.user_id
       WHERE j.college_id = $1
       ORDER BY j.created_at DESC`,
      [college_id]
    );

    res.status(200).json(jobsResult.rows);

  } catch (err) {
    console.error('Error in /api/jobs (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/jobs
 * @desc (Alumni/Faculty/HOD) Creates a new job posting.
 * (FIXED: Uses new columns and validates one exists)
 */
app.post('/api/jobs', [authMiddleware], async (req, res) => {
  const { id, college_id, role } = req.user;
  const allowedRoles = ['Alumni', 'Faculty', 'HOD', 'College Admin', 'Super Admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ error: 'You do not have permission to post jobs.' });
  }

  // 1. Get new fields from form
  const { title, companyName, location, jobType, description, applicationLink, applicationEmail } = req.body;

  // 2. Validate data
  if (!title || !companyName || !description) {
    return res.status(400).json({ error: 'Please fill out Title, Company, and Description.' });
  }
  // --- NEW: Check if at least one contact method is provided ---
  if (!applicationLink && !applicationEmail) {
    return res.status(400).json({ error: 'You must provide either an application link or an email.' });
  }

  try {
    // 3. Insert the job into the database
    const newJob = await db.query(
      `INSERT INTO jobs (
         college_id, user_id, title, company_name, location, job_type, description, 
         application_link, application_email
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [college_id, id, title, companyName, location, jobType, description, applicationLink || null, applicationEmail || null]
    );

    const created = newJob.rows[0];
    // Emit job:new to all users of the college (simple approach: need user list)
    // For now broadcast to all connected sockets; clients will filter by college.
    io.emit('jobs:new', { job_id: created.job_id, college_id: created.college_id, created_at: created.created_at });
    res.status(201).json(created);

  } catch (err) {
    console.error('Error in /api/jobs (POST):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route PUT /api/jobs/:jobId
 * @desc (Job Owner) Edits their own job posting.
 * (FIXED: Uses new columns and validates one exists)
 */
app.put('/api/jobs/:jobId', [authMiddleware], async (req, res) => {
  const { jobId } = req.params;
  const { id: user_id } = req.user;

  const { title, companyName, location, jobType, description, applicationLink, applicationEmail } = req.body;

  // 1. Validate data
  if (!title || !companyName || !description) {
    return res.status(400).json({ error: 'Please fill out Title, Company, and Description.' });
  }
  if (!applicationLink && !applicationEmail) {
    return res.status(400).json({ error: 'You must provide either an application link or an email.' });
  }

  try {
    // 2. Update the job
    const result = await db.query(
      `UPDATE jobs SET
         title = $1, company_name = $2, location = $3, job_type = $4,
         description = $5, application_link = $6, application_email = $7
       WHERE job_id = $8 AND user_id = $9
       RETURNING *`,
      [title, companyName, location, jobType, description, applicationLink || null, applicationEmail || null, jobId, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Job not found or you do not have permission to edit it.' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error in /api/jobs (PUT):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route DELETE /api/jobs/:jobId
 * @desc (Job Owner) Deletes their own job posting.
 * (This is your new delete feature)
 */
app.delete('/api/jobs/:jobId', [authMiddleware], async (req, res) => {
  const { jobId } = req.params;
  const { id: user_id } = req.user; // 'id' from the token is the user_id

  try {
    // Delete the job, but ONLY if the job_id matches AND the user_id matches
    const result = await db.query(
      `DELETE FROM jobs WHERE job_id = $1 AND user_id = $2`,
      [jobId, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Job not found or you do not have permission to delete it.' });
    }

    res.status(200).json({ message: 'Job deleted successfully.' });

  } catch (err) {
    console.error('Error in /api/jobs (DELETE):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/* ---------------------------------- */
/* --- CONNECTIONS & CHAT API --- */
/* ---------------------------------- */

/**
 * @route POST /api/connections/send
 * @desc (Authenticated User) Sends a connection request to another user.
 * (FIXED: Now allows re-sending a request if it was previously rejected)
 */
app.post('/api/connections/send', [authMiddleware], async (req, res) => {
  const { receiverId } = req.body;
  const { id: senderId } = req.user;

  if (senderId == receiverId) {
    return res.status(400).json({ error: 'You cannot connect with yourself.' });
  }

  try {
    // Check if a connection of any kind already exists
    const existing = await db.query(
      `SELECT * FROM connections WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [senderId, receiverId]
    );

    if (existing.rows.length > 0) {
      // A connection *does* exist. We need to check its status.
      const connection = existing.rows[0];

      if (connection.status === 'accepted') {
        return res.status(400).json({ error: 'You are already connected to this user.' });
      }
      if (connection.status === 'pending') {
        return res.status(400).json({ error: 'A connection request is already pending.' });
      }

      // --- THIS IS THE FIX ---
      if (connection.status === 'rejected') {
        // The request was rejected. We will "reset" it and make the new sender active.
        await db.query(
          `UPDATE connections 
           SET status = 'pending', 
               sender_id = $1,    -- Set the new sender
               receiver_id = $2,  -- Set the new receiver
               created_at = CURRENT_TIMESTAMP
           WHERE connection_id = $3`,
          [senderId, receiverId, connection.connection_id]
        );
        return res.status(200).json({ message: 'Connection request sent.' });
      }
      // --- END OF FIX ---

    } else {
      // No connection existed. Create a new one.
      await db.query(
        `INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, 'pending')`,
        [senderId, receiverId]
      );
    }

    res.status(201).json({ message: 'Connection request sent.' });

  } catch (err) {
    console.error('Error in /api/connections/send:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/connections/requests
 * @desc (Authenticated User) Gets all *incoming* pending connection requests.
 [cite_start]* [cite: 441-443]
 */
app.get('/api/connections/requests', [authMiddleware], async (req, res) => {
  const { id: userId } = req.user;

  try {
    // Find all requests where the logged-in user is the *receiver*
    const requests = await db.query(
      `SELECT 
         c.connection_id,
         u.user_id as sender_id,
         u.full_name as sender_name,
         u.role as sender_role,
         p.headline as sender_headline
       FROM connections c
       JOIN users u ON c.sender_id = u.user_id
       LEFT JOIN profiles p ON u.user_id = p.user_id
       WHERE c.receiver_id = $1 AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.status(200).json(requests.rows);

  } catch (err) {
    console.error('Error in /api/connections/requests:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route PUT /api/connections/respond
 * @desc (Authenticated User) Responds to an incoming request (Accept or Reject).
 [cite_start]* [cite: 466-478]
 */
app.put('/api/connections/respond', [authMiddleware], async (req, res) => {
  const { connectionId, response } = req.body; // response is 'accepted' or 'rejected'
  const { id: userId } = req.user; // This is the receiver

  if (!['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({ error: 'Invalid response.' });
  }

  try {
    // Update the connection, but *only* if the user is the receiver
    const result = await db.query(
      `UPDATE connections 
       SET status = $1 
       WHERE connection_id = $2 AND receiver_id = $3 AND status = 'pending'
       RETURNING *`,
      [response, connectionId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or you do not have permission.' });
    }

    res.status(200).json({ message: `Request ${response}.` });

  } catch (err) {
    console.error('Error in /api/connections/respond:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/connections/request
 * @desc (Authenticated) Send a connection request to another user.
 */
app.post('/api/connections/request', [authMiddleware], async (req, res) => {
    const { id: senderId } = req.user;
    const { receiverId } = req.body;

    if (senderId === receiverId) {
        return res.status(400).json({ error: 'You cannot connect with yourself.' });
    }

    try {
        // Check if a connection or request already exists
        const existing = await db.query(
            `SELECT * FROM connections 
             WHERE (sender_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND sender_id = $2)`,
            [senderId, receiverId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'A connection or pending request already exists.' });
        }

        // Create new pending connection
        const newConnection = await db.query(
            `INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, 'pending') RETURNING *`,
            [senderId, receiverId]
        );

        const created = newConnection.rows[0];
        // Notify receiver in real-time
        io.to(`user-${receiverId}`).emit('connection:request:new', { connection_id: created.connection_id, sender_id: senderId });
        res.status(201).json({ message: 'Connection request sent.', connection: created });
    } catch (err) {
        console.error('Error in /api/connections/request:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route POST /api/connections/accept
 * @desc (Authenticated) Accept a pending connection request.
 */
app.post('/api/connections/accept', [authMiddleware], async (req, res) => {
    const { id: receiverId } = req.user;
    const { connectionId } = req.body;

    try {
        const result = await db.query(
            `UPDATE connections 
             SET status = 'accepted' 
             WHERE connection_id = $1 AND receiver_id = $2 AND status = 'pending'
             RETURNING *`,
            [connectionId, receiverId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pending request not found or you do not have permission to accept it.' });
        }

        const accepted = result.rows[0];
        io.to(`user-${accepted.sender_id}`).emit('connection:request:accepted', { connection_id: accepted.connection_id });
        res.status(200).json({ message: 'Connection request accepted.', connection: accepted });
    } catch (err) {
        console.error('Error in /api/connections/accept:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route POST /api/connections/reject
 * @desc (Authenticated) Reject a pending connection request.
 */
app.post('/api/connections/reject', [authMiddleware], async (req, res) => {
    const { id: currentUserId } = req.user;
    const { connectionId } = req.body;

    try {
        // A user can reject a request if they are the receiver.
        const result = await db.query(
            `DELETE FROM connections 
             WHERE connection_id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [connectionId, currentUserId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pending request not found or you do not have permission to reject it.' });
        }

        res.status(200).json({ message: 'Connection request rejected.' });
    } catch (err) {
        console.error('Error in /api/connections/reject:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route DELETE /api/connections/:connectionId
 * @desc (Authenticated) Remove a connection (unfriend).
 */
app.delete('/api/connections/:connectionId', [authMiddleware], async (req, res) => {
    const { id: currentUserId } = req.user;
    const { connectionId } = req.params;

    try {
        // A user can delete a connection if they are either the sender or receiver.
        const result = await db.query(
            `DELETE FROM connections 
             WHERE connection_id = $1 AND (sender_id = $2 OR receiver_id = $2) AND status = 'accepted'`,
            [connectionId, currentUserId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Connection not found or you do not have permission to remove it.' });
        }

        res.status(200).json({ message: 'Connection removed.' });
    } catch (err) {
        console.error(`Error in DELETE /api/connections/${connectionId}:`, err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});


/**
 * @route GET /api/chat/conversations
 * @desc (Authenticated User) Gets the list of all conversations (pending & accepted).
 * (FIXED: Now includes unread message count)
 */
app.get('/api/chat/conversations', [authMiddleware], async (req, res) => {
  const { id: my_user_id } = req.user;

  try {
    const result = await db.query(
      `WITH LastMessage AS (
         SELECT
           connection_id,
           body,
           created_at,
           ROW_NUMBER() OVER(PARTITION BY connection_id ORDER BY created_at DESC) as rn
         FROM messages
       ),
       -- NEW: Count unread messages for each conversation
       UnreadCounts AS (
         SELECT
           connection_id,
           COUNT(*) as unread_count
         FROM messages
         WHERE sender_id != $1 AND read_at IS NULL
         GROUP BY connection_id
       )
       SELECT 
         c.connection_id,
         c.status,
         CASE
           WHEN c.sender_id = $1 THEN r.user_id
           ELSE s.user_id
         END AS other_user_id,
         CASE
           WHEN c.sender_id = $1 THEN r.full_name
           ELSE s.full_name
         END AS other_user_name,
         CASE
           WHEN c.sender_id = $1 THEN r.role
           ELSE s.role
         END AS other_user_role,
         CASE
            WHEN c.sender_id = $1 THEN pr.profile_icon_url
            ELSE ps.profile_icon_url
         END AS other_user_profile_icon_url,
         lm.body as last_message,
         lm.created_at as last_message_at,
         COALESCE(uc.unread_count, 0) as unread_count -- Get the count
       FROM connections c
       LEFT JOIN users s ON c.sender_id = s.user_id
       LEFT JOIN users r ON c.receiver_id = r.user_id
       LEFT JOIN profiles ps ON s.user_id = ps.user_id
       LEFT JOIN profiles pr ON r.user_id = pr.user_id
       LEFT JOIN LastMessage lm ON c.connection_id = lm.connection_id AND lm.rn = 1
       LEFT JOIN UnreadCounts uc ON c.connection_id = uc.connection_id
       WHERE (c.sender_id = $1 OR c.receiver_id = $1)
         AND c.status IN ('pending', 'accepted') -- Only get pending or accepted
       ORDER BY lm.created_at DESC NULLS LAST, c.created_at DESC`,
      [my_user_id]
    );

    res.status(200).json(result.rows);

  } catch (err) {
    console.error('Error in /api/chat/conversations:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/chat/history/:connectionId
 * @desc (Authenticated User) Gets all messages AND marks them as read.
 [cite_start]* [cite: 536-538]
 */
app.get('/api/chat/history/:connectionId', [authMiddleware], async (req, res) => {
  const { connectionId } = req.params;
  const { id: my_user_id } = req.user;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify this user is part of this connection
    const connCheck = await client.query(
      `SELECT * FROM connections 
       WHERE connection_id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
      [connectionId, my_user_id]
    );

    if (connCheck.rows.length === 0) {
      throw new Error('You are not part of this conversation.');
    }

    // 2. --- NEW: Mark all incoming messages as read ---
    await client.query(
      `UPDATE messages 
       SET read_at = CURRENT_TIMESTAMP 
       WHERE connection_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [connectionId, my_user_id]
    );

    // 3. Get all messages for this connection (now including read_at)
    const messages = await client.query(
      `SELECT message_id, connection_id, sender_id, body, attachment_url, created_at, read_at
       FROM messages
       WHERE connection_id = $1
       ORDER BY created_at ASC`,
      [connectionId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      connection: connCheck.rows[0],
      messages: messages.rows
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/chat/history:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  } finally {
    client.release();
  }
});


/**
 * @route POST /api/chat/send
 * @desc (Authenticated User) Sends a new message and saves it to the DB.
 * 
 */
app.post('/api/chat/send', [authMiddleware], async (req, res) => {
  const { connectionId, body } = req.body;
  const { id: senderId } = req.user;

  try {
    // 1. Verify this user is part of this connection
    const connCheck = await db.query(
      `SELECT * FROM connections 
       WHERE connection_id = $1 AND (sender_id = $2 OR receiver_id = $2)`,
      [connectionId, senderId]
    );

    if (connCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not part of this conversation.' });
    }

    const connection = connCheck.rows[0];

    // 2. Check for 5-message limit if chat is 'pending' [cite: 554-556]
    if (connection.status === 'pending') {
      const msgCountResult = await db.query(
        `SELECT COUNT(*) FROM messages WHERE connection_id = $1`,
        [connectionId]
      );
      if (parseInt(msgCountResult.rows[0].count, 10) >= 5) {
        return res.status(403).json({ error: 'Message limit reached for pending request.' });
      }
    }

    // 3. Insert the new message
    const newMessage = await db.query(
      `INSERT INTO messages (connection_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`, // Return the new message
      [connectionId, senderId, body]
    );

    const created = newMessage.rows[0];
    io.to(`connection-${connectionId}`).emit('message:new', created);
    console.log('[Socket Emit] message:new -> connection', connectionId, 'message', created.message_id);
    res.status(201).json(created);

  } catch (err) {
    console.error('Error in /api/chat/send:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/chat/upload
 * @desc (Authenticated User) Uploads an image as a chat message (images only).
 */
app.post('/api/chat/upload', [authMiddleware, upload.single('file')], async (req, res) => {
  const { connectionId, caption } = req.body;
  const { id: senderId } = req.user;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    // 1. Verify this user is part of this connection
    const connCheck = await db.query(
      `SELECT * FROM connections 
       WHERE connection_id = $1 AND (sender_id = $2 OR receiver_id = $2)` ,
      [connectionId, senderId]
    );

    if (connCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not part of this conversation.' });
    }

    const connection = connCheck.rows[0];

    // 2. Enforce that only accepted connections can upload attachments
    if (connection.status !== 'accepted') {
      return res.status(403).json({ error: 'Attachments are only allowed for accepted connections.' });
    }

    // 3. Ensure file is an image (Cloudinary supports images)
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed.' });
    }

    // 4. Upload the image (default to Cloudinary, support S3)
    let attachmentUrl;
    const provider = (process.env.STORAGE_PROVIDER || 'cloudinary').toLowerCase();
    if (provider === 's3') {
      attachmentUrl = await s3Service.uploadFileFromPath(
        file.path,
        'career-nest/chat-images',
        file.originalname
      );
    } else {
      attachmentUrl = await uploadFile(
        file.path,
        'career-nest/chat-images',
        file.originalname,
        file.mimetype
      );
    }

    // 5. Save the message with attachment_url and optional caption as body
    const newMessage = await db.query(
      `INSERT INTO messages (connection_id, sender_id, body, attachment_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [connectionId, senderId, caption || '', attachmentUrl]
    );

    const created = newMessage.rows[0];
    io.to(`connection-${connectionId}`).emit('message:new', created);
    console.log('[Socket Emit] message:new (image) -> connection', connectionId, 'message', created.message_id);
    res.status(201).json(created);

  } catch (err) {
    console.error('Error in /api/chat/upload:', err);
    res.status(500).json({ error: 'An error occurred while uploading image.' });
  } finally {
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupErr) {
      console.warn('Temp file cleanup failed (chat upload):', cleanupErr);
    }
  }
});


/* ---------------------------------- */
/* --- POSTS & FEED API --- */
/* ---------------------------------- */

/**
 * @route GET /api/posts
 * @desc (Authenticated User) Gets all posts for their college's feed.
 * (FIXED: Now includes all media and detailed reaction counts)
 */
app.get('/api/posts', [authMiddleware], async (req, res) => {
  const { college_id, id: my_user_id } = req.user;

  try {
    const feed = await db.query(
      `SELECT 
         p.post_id, p.body, p.created_at,
         u.user_id as author_id,
         u.full_name as author_name,
         u.role as author_role,
         pr.headline as author_headline,
         pr.profile_icon_url as author_profile_icon_url,
         (SELECT json_agg(json_build_object('type', pm.media_type, 'url', pm.media_url))
          FROM post_media pm WHERE pm.post_id = p.post_id) as media,
         (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.post_id) as comment_count,
         (SELECT json_object_agg(reaction_type, count)
          FROM (
            SELECT reaction_type, COUNT(*) as count
            FROM post_reactions r
            WHERE r.post_id = p.post_id
            GROUP BY reaction_type
          ) as reaction_counts) as reactions,
         (SELECT reaction_type FROM post_reactions r WHERE r.post_id = p.post_id AND r.user_id = $1) as my_reaction

       FROM posts p
       JOIN users u ON p.user_id = u.user_id
       LEFT JOIN profiles pr ON u.user_id = pr.user_id
       WHERE p.college_id = $2
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [my_user_id, college_id]
    );

    res.status(200).json(feed.rows);

  } catch (err) {
    console.error('Error in /api/posts (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/posts
 * @desc (Authenticated User) Creates a new post.
 * (FIXED: Text is now mandatory)
 */
app.post('/api/posts', [authMiddleware, upload.array('attachments', 5)], async (req, res) => {
  const { id: user_id, college_id } = req.user;
  const { body } = req.body;
  const files = req.files; 

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // --- THIS IS THE FIX ---
    // We now check if body is empty or just whitespace
    if (!body || body.trim() === '') {
      throw new Error('Post text cannot be empty.');
    }
    // --- END OF FIX ---

    // 1. Create the post to get identifiers & timestamp
    const newPost = await client.query(
      `INSERT INTO posts (college_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING post_id, college_id, created_at`,
      [college_id, user_id, body.trim()]
    );
    const postRow = newPost.rows[0];
    const postId = postRow.post_id;

    // 2. If files exist, upload them and link them to the post
    if (files && files.length > 0) {
      const hasImage = files.some(f => f.mimetype.startsWith('image/'));
      const hasDoc = files.some(f => !f.mimetype.startsWith('image/'));

      if (hasImage && hasDoc) {
        throw new Error('You cannot upload images and documents in the same post.');
      }
      if (hasDoc && files.length > 1) {
        throw new Error('You can only upload one document at a time.');
      }

      const uploadPromises = files.map(file => uploadFile(file.path, 'career-nest/posts', file.originalname, file.mimetype));
      const mediaUrls = await Promise.all(uploadPromises);

      const mediaType = hasImage ? 'image' : 'document';

      const insertMediaPromises = mediaUrls.map(url => {
        return client.query(
          `INSERT INTO post_media (post_id, media_type, media_url) VALUES ($1, $2, $3)`,
          [postId, mediaType, url]
        );
      });
      await Promise.all(insertMediaPromises);
    }

    await client.query('COMMIT');

    // Emit posts:new so clients can update badges (clients filter by college)
    io.emit('posts:new', { post_id: postRow.post_id, college_id: postRow.college_id, created_at: postRow.created_at });
    console.log('[Socket Emit] posts:new -> post', postRow.post_id);

    res.status(201).json({ message: 'Post created successfully.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/posts (POST):', err);
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    // 4. Clean up all temp files
    if (files && files.length > 0) {
      files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupErr) {
          console.warn('Temp file cleanup failed:', cleanupErr);
        }
      });
    }
    client.release();
  }
});


/**
 * @route POST /api/posts/:postId/react
 * @desc (Authenticated User) Adds or updates a reaction to a post.
 *
 */
app.post('/api/posts/:postId/react', [authMiddleware], async (req, res) => {
  const { postId } = req.params;
  const { reactionType } = req.body;
  const { id: user_id } = req.user;

  if (!['like', 'celebrate', 'support', 'insightful', 'funny'].includes(reactionType)) {
    return res.status(400).json({ error: 'Invalid reaction type.' });
  }

  try {
    // "ON CONFLICT" is a powerful SQL command.
    // It tries to INSERT. If it fails (violates unique_reaction_per_post),
    // it will UPDATE the existing row instead.
    const newReaction = await db.query(
      `INSERT INTO post_reactions (post_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id)
       DO UPDATE SET reaction_type = $3
       RETURNING *`,
      [postId, user_id, reactionType]
    );

    res.status(201).json(newReaction.rows[0]);

  } catch (err) {
    console.error('Error in /api/posts/react (POST):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * @route DELETE /api/posts/:postId/react
 * @desc (Authenticated User) Removes a reaction from a post.
 */
app.delete('/api/posts/:postId/react', [authMiddleware], async (req, res) => {
  const { postId } = req.params;
  const { id: user_id } = req.user;

  try {
    // Delete the reaction, but only if it belongs to the logged-in user
    const result = await db.query(
      `DELETE FROM post_reactions 
       WHERE post_id = $1 AND user_id = $2`,
      [postId, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'You have not reacted to this post.' });
    }

    res.status(200).json({ message: 'Reaction removed.' });

  } catch (err) {
    console.error('Error in /api/posts/react (DELETE):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/posts/trending
 * @desc (Authenticated User) Gets trending posts from the last 7 days.
 */
app.get('/api/posts/trending', [authMiddleware], async (req, res) => {
  const { college_id, id: my_user_id } = req.user;

  try {
    const feed = await db.query(
      `WITH PostReactionCounts AS (
        SELECT 
          post_id, 
          COUNT(*) as total_reaction_count
        FROM post_reactions
        GROUP BY post_id
      )
      SELECT 
         p.post_id, p.body, p.created_at,
         u.user_id as author_id,
         u.full_name as author_name,
         u.role as author_role,
         pr.headline as author_headline,
         pr.profile_icon_url as author_profile_icon_url,
         (SELECT json_agg(json_build_object('type', pm.media_type, 'url', pm.media_url))
          FROM post_media pm WHERE pm.post_id = p.post_id) as media,
         (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.post_id) as comment_count,
         (SELECT json_object_agg(reaction_type, count)
          FROM (
            SELECT reaction_type, COUNT(*) as count
            FROM post_reactions r
            WHERE r.post_id = p.post_id
            GROUP BY reaction_type
          ) as reaction_counts) as reactions,
         (SELECT reaction_type FROM post_reactions r WHERE r.post_id = p.post_id AND r.user_id = $1) as my_reaction,
         COALESCE(prc.total_reaction_count, 0) as total_reaction_count
       FROM posts p
       JOIN users u ON p.user_id = u.user_id
       LEFT JOIN profiles pr ON u.user_id = pr.user_id
       LEFT JOIN PostReactionCounts prc ON p.post_id = prc.post_id
       WHERE p.college_id = $2
         AND p.created_at >= NOW() - INTERVAL '7 days'
       ORDER BY total_reaction_count DESC, p.created_at DESC
       LIMIT 50`,
      [my_user_id, college_id]
    );

    res.status(200).json(feed.rows);

  } catch (err) {
    console.error('Error in /api/posts/trending (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * @route GET /api/posts/:postId/comments
 * @desc (Authenticated User) Gets all comments for a single post.
 * (FIXED: Uses LEFT JOIN to prevent crash on deleted users)
 */
app.get('/api/posts/:postId/comments', [authMiddleware], async (req, res) => {
  const { postId } = req.params;
  const { id: my_user_id } = req.user;

  try {
    const comments = await db.query(
      `SELECT
         c.comment_id, c.body, c.created_at, c.parent_comment_id,
         u.user_id as author_id,
         -- Use COALESCE to return '[Deleted User]' if author is gone
         COALESCE(u.full_name, '[Deleted User]') as author_name,
         COALESCE(u.role, 'User') as author_role,
         p.headline as author_headline,
        p.profile_icon_url as author_profile_icon_url,
         (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id) as like_count,
         (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.comment_id AND cl.user_id = $1) > 0 as i_like
       FROM post_comments c
       -- Use LEFT JOIN so comments remain even if user is deleted
       LEFT JOIN users u ON c.user_id = u.user_id
       LEFT JOIN profiles p ON u.user_id = p.user_id
       WHERE c.post_id = $2
       ORDER BY c.created_at ASC`,
      [my_user_id, postId]
    );

    res.status(200).json(comments.rows);

  } catch (err) {
    console.error('Error in /api/posts/comments (GET):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/posts/:postId/comment
 * @desc (Authenticated User) Creates a new comment or reply on a post.
 * (FIXED: Now correctly accepts parentCommentId and parses postId)
 */
app.post('/api/posts/:postId/comment', [authMiddleware], async (req, res) => {
  // --- THIS IS THE FIX ---
  const postId = parseInt(req.params.postId); // Parse postId from params
  // --- END OF FIX ---

  const { body, parentCommentId } = req.body; // parentCommentId is for replies
  const { id: user_id } = req.user;

  if (!body || body.trim() === '') {
    return res.status(400).json({ error: 'Comment body cannot be empty.' });
  }

  try {
    const newCommentQuery = await db.query(
      `INSERT INTO post_comments (post_id, user_id, body, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING comment_id`,
      [postId, user_id, body, parentCommentId || null]
    );

    const newCommentId = newCommentQuery.rows[0].comment_id;

    // Fetch the complete comment data to send back
    const completeComment = await db.query(
      `SELECT
         c.comment_id, c.body, c.created_at, c.parent_comment_id,
         u.user_id as author_id, COALESCE(u.full_name, '[Deleted User]') as author_name, 
         COALESCE(u.role, 'User') as author_role,
         p.headline as author_headline,
         p.profile_icon_url as author_profile_icon_url,
         '0' as like_count,
         false as i_like
       FROM post_comments c
       LEFT JOIN users u ON c.user_id = u.user_id
       LEFT JOIN profiles p ON u.user_id = p.user_id
       WHERE c.comment_id = $1`,
       [newCommentId]
    );

    res.status(201).json(completeComment.rows[0]);

  } catch (err) {
    console.error('Error in /api/posts/comment (POST):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route PUT /api/comments/:commentId
 * @desc (Authenticated User) Edits their own comment.
 */
app.put('/api/comments/:commentId', [authMiddleware], async (req, res) => {
  const { commentId } = req.params;
  const { body } = req.body;
  const { id: user_id } = req.user;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment body cannot be empty.' });
  }

  try {
    const result = await db.query(
      `UPDATE post_comments
       SET body = $1
       WHERE comment_id = $2 AND user_id = $3
       RETURNING *`,
      [body.trim(), commentId, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Comment not found or you do not have permission to edit it.' });
    }
    
    // To return the full comment data, we need to fetch it again with joins
    const updatedCommentResult = await db.query(
        `SELECT
           pc.comment_id, pc.body, pc.created_at, pc.parent_comment_id,
           u.user_id as author_id, u.full_name as author_name, u.role as author_role,
           prof.headline as author_headline,
           (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = pc.comment_id) as like_count,
           EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = pc.comment_id AND cl.user_id = $1) as i_like
         FROM post_comments pc
         JOIN users u ON pc.user_id = u.user_id
         LEFT JOIN profiles prof ON u.user_id = prof.user_id
         WHERE pc.comment_id = $2`,
        [user_id, commentId]
    );


    res.status(200).json(updatedCommentResult.rows[0]);
  } catch (err) {
    console.error('Error in /api/comments/:commentId (PUT):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/comments/:commentId/like
 * @desc (Authenticated User) Toggles a like on a comment.
 * [cite_start]* [cite: 313]
 */
app.post('/api/comments/:commentId/like', [authMiddleware], async (req, res) => {
  const { commentId } = req.params;
  const { id: user_id } = req.user;

  try {
    // Check if the user has *already* liked this comment
    const existingLike = await db.query(
      `SELECT * FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, user_id]
    );

    if (existingLike.rows.length > 0) {
      // User has liked it, so "un-like" it
      await db.query(
        `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
        [commentId, user_id]
      );
      res.status(200).json({ message: 'Like removed.' });
    } else {
      // User has not liked it, so add a "like"
      await db.query(
        `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)`,
        [commentId, user_id]
      );
      res.status(201).json({ message: 'Comment liked.' });
    }

  } catch (err) {
    console.error('Error in /api/comments/like (POST):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route PUT /api/posts/:postId
 * @desc (Authenticated User) Edits their *own* post.
 * (FIXED: Now supports text and multi-file updates)
 */
app.put('/api/posts/:postId', [authMiddleware, upload.array('attachments', 5)], async (req, res) => {
  const { postId } = req.params;
  const { id: user_id } = req.user;
  const { body, mediaToKeep } = req.body; // mediaToKeep is a list of existing URLs
  const files = req.files;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if the post exists and the user is the author
    const postCheck = await client.query(
      `SELECT * FROM posts WHERE post_id = $1 AND user_id = $2`,
      [postId, user_id]
    );

    if (postCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Post not found or you do not have permission to edit it.' });
    }

    // 2. Validate content
    const existingMedia = mediaToKeep ? (Array.isArray(mediaToKeep) ? mediaToKeep : [mediaToKeep]) : [];
    if (!body && (!files || files.length === 0) && existingMedia.length === 0) {
      throw new Error('Post must contain text or an attachment.');
    }

    // 3. Update the post body
    await client.query(
      `UPDATE posts SET body = $1 WHERE post_id = $2`,
      [body || null, postId]
    );

    // 4. Handle Media Deletions
    // Get all current media for the post
    const currentMedia = await client.query(
      `SELECT media_url FROM post_media WHERE post_id = $1`,
      [postId]
    );

    // Figure out which files to delete
    const urlsToDelete = currentMedia.rows
      .map(row => row.media_url)
      .filter(url => !existingMedia.includes(url));

    if (urlsToDelete.length > 0) {
      // We must delete one by one using a loop for the '$1' parameter
      for (const url of urlsToDelete) {
        await client.query(`DELETE FROM post_media WHERE post_id = $1 AND media_url = $2`, [postId, url]);
        // LATER: We should also delete this from Cloudinary, but that's a v2 feature.
      }
    }

    // 5. Handle New File Uploads
    if (files && files.length > 0) {
      // (This logic is the same as our 'create post' API)
      const hasImage = files.some(f => f.mimetype.startsWith('image/'));
      const hasDoc = files.some(f => !f.mimetype.startsWith('image/'));
      if (hasImage && hasDoc) throw new Error('You cannot upload images and documents in the same post.');
      if (hasDoc && files.length > 1) throw new Error('You can only upload one document at a time.');

      const uploadPromises = files.map(file => uploadFile(file.path, 'career-nest/posts', file.originalname, file.mimetype));
      const mediaUrls = await Promise.all(uploadPromises);
      const mediaType = hasImage ? 'image' : 'document';

      const insertMediaPromises = mediaUrls.map(url => {
        return client.query(
          `INSERT INTO post_media (post_id, media_type, media_url) VALUES ($1, $2, $3)`,
          [postId, mediaType, url]
        );
      });
      await Promise.all(insertMediaPromises);
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Post updated successfully.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /api/posts (PUT):', err);
    res.status(500).json({ error: err.message || 'An error occurred on the server.' });
  } finally {
    if (files && files.length > 0) {
      files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupErr) {
          console.warn('Temp file cleanup failed:', cleanupErr);
        }
      });
    }
    client.release();
  }
});

/**
 * @route DELETE /api/posts/:postId
 * @desc (Authenticated User) Deletes their *own* post.
 * [cite: 306]
 */
app.delete('/api/posts/:postId', [authMiddleware], async (req, res) => {
  const { postId } = req.params;
  const { id: user_id } = req.user;

  try {
    // Delete the post, but ONLY if the user_id matches
    const result = await db.query(
      `DELETE FROM posts WHERE post_id = $1 AND user_id = $2`,
      [postId, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Post not found or you do not have permission to delete it.' });
    }

    res.status(200).json({ message: 'Post deleted successfully.' });

  } catch (err) {
    console.error('Error in /api/posts (DELETE):', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route POST /api/posts/:postId/report
 * @desc (Authenticated User) Reports a post.
 */
app.post('/api/posts/:postId/report', [authMiddleware], async (req, res) => {
  const { postId } = req.params;
  const { reason } = req.body;
  const { id: reported_by_user_id, college_id } = req.user;

  if (!reason) {
    return res.status(400).json({ error: 'A reason for reporting is required.' });
  }

  try {
    // Prevent duplicate reports from the same user on the same post while still
    // allowing multiple different users to report it.
    const existing = await db.query(
      `SELECT report_id FROM reported_content
       WHERE post_id = $1 AND reported_by_user_id = $2 AND status IN ('pending','under_review')`,
      [postId, reported_by_user_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reported this post.' });
    }

    await db.query(
      `INSERT INTO reported_content (post_id, reported_by_user_id, college_id, reason, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [postId, reported_by_user_id, college_id, reason]
    );
    res.status(201).json({ message: 'Post reported successfully. A moderator will review it.' });
  } catch (err) {
    console.error('Error in /api/posts/:postId/report:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * @route POST /api/comments/:commentId/report
 * @desc (Authenticated User) Reports a comment.
 */
app.post('/api/comments/:commentId/report', [authMiddleware], async (req, res) => {
  const { commentId } = req.params;
  const { reason } = req.body;
  const { id: reported_by_user_id, college_id } = req.user;

  if (!reason) {
    return res.status(400).json({ error: 'A reason for reporting is required.' });
  }

  try {
    const existing = await db.query(
      `SELECT report_id FROM reported_content
       WHERE comment_id = $1 AND reported_by_user_id = $2 AND status IN ('pending','under_review')`,
      [commentId, reported_by_user_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reported this comment.' });
    }

    await db.query(
      `INSERT INTO reported_content (comment_id, reported_by_user_id, college_id, reason, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [commentId, reported_by_user_id, college_id, reason]
    );
    res.status(201).json({ message: 'Comment reported successfully. A moderator will review it.' });
  } catch (err) {
    console.error('Error in /api/comments/:commentId/report:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});


/**
 * @route GET /api/hod-admin/reports
 * @desc (HOD) Gets all pending reports for their college.
 */
app.get('/api/hod-admin/reports', [authMiddleware, isHODorAdmin], async (req, res) => {
  const { college_id } = req.user;

  try {
    const reports = await db.query(
      `SELECT
         rc.report_id,
         rc.reason,
         rc.status,
         rc.created_at AS reported_at,
         rc.post_id,
         rc.comment_id,
         p.body AS post_body,
         pc.body AS comment_body,
         reporter.full_name AS reporter_name,
         author.full_name AS author_name,
         /* Aggregate post media if this report is for a post */
         CASE WHEN rc.post_id IS NOT NULL THEN (
           SELECT json_agg(json_build_object('type', pm.media_type, 'url', pm.media_url))
           FROM post_media pm WHERE pm.post_id = rc.post_id
         ) ELSE NULL END AS media
       FROM reported_content rc
       LEFT JOIN posts p ON rc.post_id = p.post_id
       LEFT JOIN post_comments pc ON rc.comment_id = pc.comment_id
       JOIN users reporter ON rc.reported_by_user_id = reporter.user_id
       LEFT JOIN users author ON p.user_id = author.user_id OR pc.user_id = author.user_id
       WHERE rc.college_id = $1 AND rc.status = 'pending'
       ORDER BY rc.created_at DESC`,
      [college_id]
    );
    res.status(200).json(reports.rows);
  } catch (err) {
    console.error('Error in /api/hod-admin/reports:', err);
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
});

/**
 * @route DELETE /api/hod-admin/reports/:reportId
 * @desc (HOD) Deletes/dismisses a report.
 */
app.delete('/api/hod-admin/reports/:reportId', [authMiddleware, isHODorAdmin], async (req, res) => {
    const { reportId } = req.params;
    const { college_id } = req.user;

    try {
        const result = await db.query(
            `DELETE FROM reported_content WHERE report_id = $1 AND college_id = $2`,
            [reportId, college_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Report not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Report dismissed successfully.' });
    } catch (err) {
        console.error('Error in /api/hod-admin/reports/:reportId:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route DELETE /api/hod-admin/posts/:postId
 * @desc (HOD) Deletes a post.
 */
app.delete('/api/hod-admin/posts/:postId', [authMiddleware, isHODorAdmin], async (req, res) => {
    const { postId } = req.params;
    const { college_id } = req.user;

    try {
        // First, verify the post belongs to the HOD's college
        const postCheck = await db.query(
            `SELECT post_id FROM posts WHERE post_id = $1 AND college_id = $2`,
            [postId, college_id]
        );

        if (postCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Post not found or not in your college.' });
        }

        // Delete the post (reports will be cascaded)
        await db.query(`DELETE FROM posts WHERE post_id = $1`, [postId]);

        res.status(200).json({ message: 'Post deleted successfully.' });
    } catch (err) {
        console.error('Error in /api/hod-admin/posts/:postId:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route DELETE /api/hod-admin/comments/:commentId
 * @desc (HOD) Deletes a comment.
 */
app.delete('/api/hod-admin/comments/:commentId', [authMiddleware, isHODorAdmin], async (req, res) => {
    const { commentId } = req.params;
    const { college_id } = req.user;

    try {
        // To verify the comment belongs to the HOD's college, we need to join through the post
        const commentCheck = await db.query(
            `SELECT pc.comment_id FROM post_comments pc
             JOIN posts p ON pc.post_id = p.post_id
             WHERE pc.comment_id = $1 AND p.college_id = $2`,
            [commentId, college_id]
        );

        if (commentCheck.rowCount === 0) {
            return res.status(404).json({ error: 'Comment not found or not in your college.' });
        }

        // Delete the comment (reports will be cascaded)
        await db.query(`DELETE FROM post_comments WHERE comment_id = $1`, [commentId]);

        res.status(200).json({ message: 'Comment deleted successfully.' });
    } catch (err) {
        console.error('Error in /api/hod-admin/comments/:commentId:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/* ---------------------------------- */
/* --- PROFILE API ROUTES --- */
/* ---------------------------------- */

/**
 * @route GET /api/profile/:userId
 * @desc (Authenticated) Gets a user's complete profile data.
 * This is a complex endpoint that aggregates data from multiple tables.
 */
app.get('/api/profile/:userId', [authMiddleware], async (req, res) => {
    const { userId } = req.params;
    const { id: requestingUserId, college_id } = req.user;

    try {
        // 1. Get Core User Info
        const userQuery = db.query(
            `SELECT 
                u.user_id, u.full_name, u.role, u.status, u.college_id,
                d.name as department_name,
                p.headline, p.about, p.cover_photo_url, p.profile_icon_url
             FROM users u
             LEFT JOIN departments d ON u.department_id = d.department_id
             LEFT JOIN profiles p ON u.user_id = p.user_id
             WHERE u.user_id = $1 AND u.college_id = $2`,
            [userId, college_id]
        );

        // 2. Get Experience
        const experienceQuery = db.query(
            `SELECT * FROM experience WHERE user_id = $1 ORDER BY start_date DESC`,
            [userId]
        );

        // 3. Get Education
        const educationQuery = db.query(
            `SELECT * FROM education WHERE user_id = $1 ORDER BY start_date DESC`,
            [userId]
        );

        // 4. Get Connection Status (if not viewing own profile)
        let connectionQuery = Promise.resolve({ rows: [] });
        if (parseInt(userId, 10) !== requestingUserId) {
            connectionQuery = db.query(
                `SELECT connection_id, status, sender_id 
                 FROM connections 
                 WHERE (sender_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND sender_id = $2)`,
                [requestingUserId, userId]
            );
        }

        // Run all queries in parallel
        const [userResult, experienceResult, educationResult, connectionResult] = await Promise.all([
            userQuery,
            experienceQuery,
            educationQuery,
            connectionQuery
        ]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found in this college.' });
        }

        const profileData = {
            ...userResult.rows[0],
            experience: experienceResult.rows,
            education: educationResult.rows,
            connection: connectionResult.rows[0] || null
        };

        res.status(200).json(profileData);

    } catch (err) {
        console.error(`Error in /api/profile/${userId}:`, err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route PUT /api/profile
 * @desc (Authenticated) Updates the user's own core profile info.
 */
app.put('/api/profile', [authMiddleware, upload.fields([{ name: 'profileIcon', maxCount: 1 }, { name: 'coverPhoto', maxCount: 1 }])], async (req, res) => {
  const { id: userId } = req.user;
  const { headline, about, full_name } = req.body;
  const files = req.files;

    let profileIconUrl = undefined;
    let coverPhotoUrl = undefined;

    try {
        // --- Handle File Uploads ---
        if (files) {
            if (files.profileIcon) {
                profileIconUrl = await uploadFile(files.profileIcon[0].path, 'career-nest/profile-icons');
            }
            if (files.coverPhoto) {
                coverPhotoUrl = await uploadFile(files.coverPhoto[0].path, 'career-nest/cover-photos');
            }
        }

        // --- Update Database ---
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

          // Update core user fields (full name) if provided
          if (typeof full_name === 'string' && full_name.trim() !== '') {
            await client.query(
              'UPDATE users SET full_name = $1 WHERE user_id = $2',
              [full_name.trim(), userId]
            );
          }

            // Ensure a profile record exists
            await client.query(
                `INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
                [userId]
            );

            // Build the dynamic update query
            const updates = [];
            const params = [userId];
            let paramIndex = 2;

            if (headline !== undefined) {
                updates.push(`headline = $${paramIndex++}`);
                params.push(headline);
            }
            if (about !== undefined) {
                updates.push(`about = $${paramIndex++}`);
                params.push(about);
            }
            if (profileIconUrl) {
                updates.push(`profile_icon_url = $${paramIndex++}`);
                params.push(profileIconUrl);
            }
            if (coverPhotoUrl) {
                updates.push(`cover_photo_url = $${paramIndex++}`);
                params.push(coverPhotoUrl);
            }

            if (updates.length > 0) {
              const queryText = `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $1 RETURNING *`;
              const updatedProfile = await client.query(queryText, params);
              await client.query('COMMIT');
              res.status(200).json({
                profile: updatedProfile.rows[0],
                full_name: typeof full_name === 'string' ? full_name.trim() : undefined
              });
            } else {
              await client.query('COMMIT');
              res.status(200).json({ message: "No changes to update.", full_name: typeof full_name === 'string' ? full_name.trim() : undefined });
            }
        } catch (dbErr) {
            await client.query('ROLLBACK');
            throw dbErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error in PUT /api/profile:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    } finally {
        // Cleanup temp files
        if (files) {
            if (files.profileIcon) fs.unlinkSync(files.profileIcon[0].path);
            if (files.coverPhoto) fs.unlinkSync(files.coverPhoto[0].path);
        }
    }
});

/**
 * @route POST /api/profile/experience
 * @desc (Authenticated) Adds a new experience item.
 */
app.post('/api/profile/experience', [authMiddleware], async (req, res) => {
    const { id: userId } = req.user;
    const { title, company, location, startDate, endDate, description } = req.body;

    try {
        const newExperience = await db.query(
            `INSERT INTO experience (user_id, title, company, location, start_date, end_date, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, title, company, location, startDate, endDate || null, description]
        );
        res.status(201).json(newExperience.rows[0]);
    } catch (err) {
        console.error('Error in POST /api/profile/experience:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route PUT /api/profile/experience/:expId
 * @desc (Authenticated) Updates an experience item.
 */
app.put('/api/profile/experience/:expId', [authMiddleware], async (req, res) => {
    const { id: userId } = req.user;
    const { expId } = req.params;
    const { title, company, location, startDate, endDate, description } = req.body;

    try {
        const updatedExperience = await db.query(
            `UPDATE experience 
             SET title = $1, company = $2, location = $3, start_date = $4, end_date = $5, description = $6
             WHERE experience_id = $7 AND user_id = $8
             RETURNING *`,
            [title, company, location, startDate, endDate || null, description, expId, userId]
        );

        if (updatedExperience.rows.length === 0) {
            return res.status(404).json({ error: 'Experience not found or you do not have permission to edit it.' });
        }

        res.status(200).json(updatedExperience.rows[0]);
    } catch (err) {
        console.error(`Error in PUT /api/profile/experience/${expId}:`, err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route DELETE /api/profile/experience/:expId
 * @desc (Authenticated) Deletes an experience item.
 */
app.delete('/api/profile/experience/:expId', [authMiddleware], async (req, res) => {
    const { id: userId } = req.user;
    const { expId } = req.params;

    try {
        const result = await db.query(
            `DELETE FROM experience WHERE experience_id = $1 AND user_id = $2`,
            [expId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Experience not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Experience deleted successfully.' });
    } catch (err) {
        console.error(`Error in DELETE /api/profile/experience/${expId}:`, err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route POST /api/profile/education
 * @desc (Authenticated) Adds a new education item.
 */
app.post('/api/profile/education', [authMiddleware], async (req, res) => {
    const { id: userId } = req.user;
    const { school, degree, fieldOfStudy, startDate, endDate } = req.body;

    try {
        const newEducation = await db.query(
            `INSERT INTO education (user_id, school, degree, field_of_study, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, school, degree, fieldOfStudy, startDate, endDate || null]
        );
        res.status(201).json(newEducation.rows[0]);
    } catch (err) {
        console.error('Error in POST /api/profile/education:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route PUT /api/profile/education/:eduId
 * @desc (Authenticated) Updates an education item.
 */
app.put('/api/profile/education/:eduId', [authMiddleware], async (req, res) => {
    const { id: userId } = req.user;
    const { eduId } = req.params;
    const { school, degree, fieldOfStudy, startDate, endDate } = req.body;

    try {
        const updatedEducation = await db.query(
            `UPDATE education 
             SET school = $1, degree = $2, field_of_study = $3, start_date = $4, end_date = $5
             WHERE education_id = $6 AND user_id = $7
             RETURNING *`,
            [school, degree, fieldOfStudy, startDate, endDate || null, eduId, userId]
        );

        if (updatedEducation.rows.length === 0) {
            return res.status(404).json({ error: 'Education not found or you do not have permission to edit it.' });
        }

        res.status(200).json(updatedEducation.rows[0]);
    } catch (err) {
        console.error(`Error in PUT /api/profile/education/${eduId}:`, err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route DELETE /api/profile/education/:eduId
 * @desc (Authenticated) Deletes an education item.
 */
app.delete('/api/profile/education/:eduId', [authMiddleware], async (req, res) => {
    const { id: userId } = req.user;
    const { eduId } = req.params;

    try {
        const result = await db.query(
            `DELETE FROM education WHERE education_id = $1 AND user_id = $2`,
            [eduId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Education not found or you do not have permission to delete it.' });
        }

        res.status(200).json({ message: 'Education deleted successfully.' });
    } catch (err) {
        console.error(`Error in DELETE /api/profile/education/${eduId}:`, err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route POST /api/profile/secondary-email-otp
 * @desc (Student) Sends an OTP to a secondary email address for verification.
 */
app.post('/api/profile/secondary-email-otp', [authMiddleware], async (req, res) => {
    const { id: userId, role } = req.user;
    const { secondaryEmail } = req.body;

    if (role !== 'Student') {
        return res.status(403).json({ error: 'This feature is only available for students.' });
    }

    try {
        // Check if email is already in use
        const emailCheck = await db.query(
            `SELECT user_id FROM users WHERE personal_email = $1 OR official_email = $1`,
            [secondaryEmail]
        );
        if (emailCheck.rows.length > 0 && emailCheck.rows[0].user_id !== userId) {
            return res.status(400).json({ error: 'This email address is already in use.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await db.query(
            `UPDATE users 
             SET personal_email = $1, otp = $2, otp_expires_at = $3, secondary_email_verified = false
             WHERE user_id = $4`,
            [secondaryEmail, otp, otpExpiresAt, userId]
        );

        const subject = "Verify Your Secondary Email for CareerNest";
        const text = `Your verification code is ${otp}. It will expire in 10 minutes.`;
        await sendEmail(secondaryEmail, subject, text, `<b>${text}</b>`);

        res.status(200).json({ message: 'OTP sent to your secondary email.' });

    } catch (err) {
        console.error('Error in POST /api/profile/secondary-email-otp:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

/**
 * @route POST /api/profile/verify-secondary-email
 * @desc (Student) Verifies the OTP for the secondary email.
 */
app.post('/api/profile/verify-secondary-email', [authMiddleware], async (req, res) => {
    const { id: userId, role } = req.user;
    const { otp } = req.body;

    if (role !== 'Student') {
        return res.status(403).json({ error: 'This feature is only available for students.' });
    }

    try {
        const userResult = await db.query(
            `SELECT otp, otp_expires_at FROM users WHERE user_id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = userResult.rows[0];

        // 2. Check if the OTP is correct
        if (user.otp !== otp) {
          return res.status(400).json({ error: 'Invalid OTP.' });
        }
    
        // 3. Check if the OTP is expired
        if (new Date() > new Date(user.otp_expires_at)) {
          return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // 4. If all checks pass, update the user as "verified"
        await db.query(
            `UPDATE users 
             SET secondary_email_verified = true, otp = null, otp_expires_at = null 
             WHERE user_id = $1`,
            [userId]
        );

        res.status(200).json({ message: 'Secondary email verified successfully.' });

    } catch (err) {
        console.error('Error in POST /api/profile/verify-secondary-email:', err);
        res.status(500).json({ error: 'An error occurred on the server.' });
    }
});

// 4. Start the server
server.listen(port, () => {
  console.log(`Server (with Socket.IO) listening at http://localhost:${port}`);
});

/**
 * @route GET /api/notifications/summary
 * @desc Returns counts for sidebar badges.
 */
app.get('/api/notifications/summary', [authMiddleware], async (req, res) => {
  const { id: userId, college_id } = req.user;
  try {
    const pendingRequestsResult = await db.query(
      `SELECT COUNT(*) FROM connections WHERE receiver_id = $1 AND status = 'pending'`,
      [userId]
    );
    const unreadConversationsResult = await db.query(
      `SELECT COUNT(DISTINCT m.connection_id) AS cnt
       FROM messages m
       JOIN connections c ON m.connection_id = c.connection_id
       WHERE (c.sender_id = $1 OR c.receiver_id = $1) AND m.sender_id != $1 AND m.read_at IS NULL`,
      [userId]
    );
    const newJobsResult = await db.query(
      `SELECT MAX(created_at) AS latest, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS recent_count
       FROM jobs WHERE college_id = $1`,
      [college_id]
    );
    const newPostsResult = await db.query(
      `SELECT MAX(created_at) AS latest, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS recent_count
       FROM posts WHERE college_id = $1`,
      [college_id]
    );
    // Placeholder mentions count (requires mention tracking implementation)
    // For now always 0; later can query a mentions table.
    const mentionsCount = 0;

    res.status(200).json({
      pendingRequests: parseInt(pendingRequestsResult.rows[0].count, 10) || 0,
      unreadChats: parseInt(unreadConversationsResult.rows[0].cnt, 10) || 0,
      newJobsRecent: parseInt(newJobsResult.rows[0].recent_count, 10) || 0,
      latestJobCreatedAt: newJobsResult.rows[0].latest,
      newPostsRecent: parseInt(newPostsResult.rows[0].recent_count, 10) || 0,
      latestPostCreatedAt: newPostsResult.rows[0].latest,
      newMentions: mentionsCount
    });
  } catch (err) {
    console.error('Error in /api/notifications/summary:', err);
    res.status(500).json({ error: 'Failed to load notification summary.' });
  }
});

