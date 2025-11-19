// server/authMiddleware.js
const jsonwebtoken = require('jsonwebtoken');
require('dotenv').config();

/**
 * This is our "gatekeeper" middleware.
 * It checks for a valid token.
 */
const authMiddleware = (req, res, next) => {
  // 1. Get the token from the request header
  const token = req.header('Authorization')?.split(' ')[1]; // "Bearer TOKEN"

  // 2. Check if no token is present
  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied.' });
  }

  try {
    // 3. Verify the token
    const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);

    // 4. Add the user's info (from the token) to the request object
    req.user = decoded.user;

    // 5. Move to the next step (the actual API endpoint)
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid.' });
  }
};

/**
 * This middleware checks if the user is a 'College Admin'
 */
const isCollegeAdmin = (req, res, next) => {
  if (req.user.role !== 'College Admin') {
    return res.status(403).json({ error: 'Access denied. Must be a College Admin.' });
  }
  next();
};

/**
 * This middleware checks if the user is an 'HOD' or 'College Admin'
 * (We include College Admin for delegation safety, but HOD is the target)
 */
const isHODorAdmin = (req, res, next) => {
  if (req.user.role !== 'HOD' && req.user.role !== 'College Admin') {
    return res.status(403).json({ error: 'Access denied. Must be an HOD or College Admin.' });
  }
  next();
};

/**
 * This middleware checks if the user is a 'Delegate' (Faculty or HOD/Admin)
 */
const isDelegate = (req, res, next) => {
  const allowedRoles = ['HOD', 'College Admin', 'Faculty'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Must be a verified staff member.' });
  }
  next();
};

module.exports = { authMiddleware, isCollegeAdmin, isHODorAdmin, isDelegate };