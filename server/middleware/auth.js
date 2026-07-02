/**
 * PeakMode — JWT Authentication Middleware
 * ──────────────────────────────────────────
 * Protects private routes by verifying the Bearer token in the
 * Authorization header. Attaches the decoded user payload to req.user
 * so downstream route handlers can identify who is making the request.
 *
 * Usage (in a route file):
 *   const protect = require('../middleware/auth');
 *   router.get('/me', protect, (req, res) => { ... });
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // ── 1. Extract token from the Authorization header ────────────────────────
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]; // "Bearer <token>" → "<token>"
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorised — no token provided',
    });
  }

  // ── 2. Verify the token ───────────────────────────────────────────────────
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── 3. Fetch the user from DB (ensures account still exists) ─────────────
    // We exclude the password field even on protected routes.
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised — user no longer exists',
      });
    }

    // Attach user object to request so route handlers can use it
    req.user = user;
    next();
  } catch (err) {
    // Handles TokenExpiredError, JsonWebTokenError, etc.
    return res.status(401).json({
      success: false,
      message: 'Not authorised — invalid or expired token',
    });
  }
};

module.exports = protect;
