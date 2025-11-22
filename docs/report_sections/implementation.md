# 5. Implementation

## 5.1 Technology Stack

Frontend
- Next.js (app router) with TypeScript — `client/`
- Tailwind CSS for styling
- UI components in `client/components/`

Backend
- Node.js + Express — `server/index.js`
- PostgreSQL (via `pg`) — `server/database.js` and `server/db.sql`
- JWT for authentication, bcrypt for password hashing
- Cloudinary (`server/cloudinaryService.js`) and optional S3 (`server/s3Service.js`)
- Nodemailer (`server/emailService.js`) for email OTPs

Dev tools
- nodemon for server dev; ESLint for linting; VS Code recommended for development.

## 5.2 Module-wise Implementation

- Client: `client/app/*` contains top-level routes; `client/components/` contains reusable UI components (PostCard, Navbar, etc.).
- Server: `server/index.js` defines endpoints and uses helpers: `server/database.js`, `server/cloudinaryService.js`, `server/authMiddleware.js`.
- Images and file uploads are temporarily stored in `temp/` and uploaded to Cloudinary. Uploaded URLs are stored in DB.

## 5.3 Important Code Snippets

1) JWT auth middleware (`server/authMiddleware.js`):

```javascript
const jsonwebtoken = require('jsonwebtoken');
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token, authorization denied.' });
  try {
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid.' });
  }
};
```

2) Signup excerpt (handling alumni document upload to Cloudinary):

```javascript
// multer stores file to temp/, then file is uploaded to Cloudinary and URL saved
const { uploadFile } = require('./cloudinaryService');
app.post('/api/auth/signup', upload.single('verificationFile'), async (req, res) => {
  const { fullName, email, password, role, collegeId } = req.body;
  const file = req.file;
  // Domain validation and upload steps here
});
```

These snippets are ready to paste in your Implementation section.
