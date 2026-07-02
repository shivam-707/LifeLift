/**
 * PeakMode — Auth Routes
 * ────────────────────────
 * POST /api/auth/register  → create a new user account
 * POST /api/auth/login     → authenticate and return JWT
 * GET  /api/auth/me        → return the currently logged-in user (protected)
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const protect = require('../middleware/auth');

const router = express.Router();

// ─── Helper: sign a JWT for a given user id ────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── Helper: build the standard auth response payload ─────────────────────
const authResponse = (user, res, statusCode = 200) => {
  const token = signToken(user._id);

  // Return everything except the password
  const userData = {
    _id:               user._id,
    username:          user.username,
    email:             user.email,
    profile:           user.profile,
    streaks:           user.streaks,
    isProfileComplete: user.isProfileComplete,
    createdAt:         user.createdAt,
  };

  return res.status(statusCode).json({
    success: true,
    token,
    user: userData,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// Body: { username, email, password }
// ══════════════════════════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ── Basic validation ────────────────────────────────────────────────────
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password',
      });
    }

    // ── Check for existing user ─────────────────────────────────────────────
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'This username is already taken',
      });
    }

    // ── Create user (password is hashed via pre-save hook in User model) ────
    const user = await User.create({ username, email, password });

    // Respond with JWT + user data (201 Created)
    return authResponse(user, res, 201);
  } catch (err) {
    // Mongoose validation errors surface here
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// Body: { email, password }
// ══════════════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Basic validation ────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // ── Find user — explicitly select password (it is excluded by default) ──
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      // Intentionally vague to avoid user-enumeration attacks
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // ── Compare passwords ───────────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Respond with JWT + user data
    return authResponse(user, res);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/auth/me   (protected)
// Returns the currently authenticated user's data.
// ══════════════════════════════════════════════════════════════════════════════
router.get('/me', protect, async (req, res) => {
  try {
    // req.user is set by the protect middleware
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
