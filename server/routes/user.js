/**
 * PeakMode — User Routes
 * ────────────────────────
 * All routes require a valid JWT (protect middleware).
 *
 * PUT  /api/user/profile  → create or update the user's profile
 * GET  /api/user/profile  → return the current user's profile
 */

const express = require('express');
const protect = require('../middleware/auth');
const User    = require('../models/User');

const router = express.Router();

/* ── All user routes are protected ─────────────────────────────────────────── */
router.use(protect);

/* ════════════════════════════════════════════════════════════════════════════
   PUT /api/user/profile
   ────────────────────
   Accepts any subset of profile fields. Merges them into the existing
   profile subdocument using $set so partial updates don't wipe other fields.

   Body (all optional — send only what you want to update):
   {
     age            : Number  (years)
     weight         : Number  (kg)
     height         : Number  (cm)
     fitnessGoal    : String  muscle_gain | fat_loss | maintenance | strength | endurance
     proteinTarget  : Number  (grams/day)
     dailyBudget    : Number  (₹/day)
     gymDaysPerWeek : Number  1–7 (integer)
     collegeHostel  : String  (optional)
   }

   Response 200:
   { success: true, message, profile, isProfileComplete }
════════════════════════════════════════════════════════════════════════════ */
router.put('/profile', async (req, res) => {
  try {
    const {
      age,
      weight,
      height,
      fitnessGoal,
      proteinTarget,
      calorieTarget,
      dailyBudget,
      gymDaysPerWeek,
      collegeHostel,
    } = req.body;

    /* ── Build only the fields that were actually sent ───────────────────── */
    // We never overwrite a field with undefined — only explicit values.
    const profileUpdate = {};

    if (age            !== undefined) profileUpdate['profile.age']             = age;
    if (weight         !== undefined) profileUpdate['profile.weight']          = weight;
    if (height         !== undefined) profileUpdate['profile.height']          = height;
    if (fitnessGoal    !== undefined) profileUpdate['profile.fitnessGoal']     = fitnessGoal;
    if (proteinTarget  !== undefined) profileUpdate['profile.proteinTarget']   = proteinTarget;
    if (calorieTarget  !== undefined) profileUpdate['profile.calorieTarget']   = calorieTarget;
    if (dailyBudget    !== undefined) profileUpdate['profile.dailyBudget']     = dailyBudget;
    if (gymDaysPerWeek !== undefined) profileUpdate['profile.gymDaysPerWeek']  = gymDaysPerWeek;
    if (collegeHostel  !== undefined) profileUpdate['profile.collegeHostel']   = collegeHostel;

    if (Object.keys(profileUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No profile fields provided in request body',
      });
    }

    /* ── Persist the partial update ──────────────────────────────────────── */
    // { new: true }       → return the updated document
    // { runValidators }   → run Mongoose schema validators on the new values
    // { context: 'query'} → required for validators that use `this`
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: profileUpdate },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    /* ── Check if all required fields are now filled ─────────────────────── */
    const isComplete = user.checkProfileComplete();

    if (isComplete && !user.isProfileComplete) {
      // Flip the flag — only write if it just became complete to avoid
      // an extra DB round-trip on every profile update.
      await User.findByIdAndUpdate(req.user._id, { isProfileComplete: true });
      user.isProfileComplete = true;
    }

    return res.status(200).json({
      success: true,
      message: isComplete
        ? 'Profile complete! You\'re all set 💪'
        : 'Profile updated successfully',
      profile:           user.profile,
      isProfileComplete: user.isProfileComplete,
    });
  } catch (err) {
    /* Mongoose validation errors (enum, min, max, custom) */
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('PUT /profile error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/user/profile
   ─────────────────────
   Returns the current user's profile and completion status.
   Useful for the frontend to re-hydrate the profile form on revisit.
════════════════════════════════════════════════════════════════════════════ */
router.get('/profile', async (req, res) => {
  try {
    // req.user is already attached by protect — no extra DB call needed
    return res.status(200).json({
      success:           true,
      profile:           req.user.profile,
      isProfileComplete: req.user.isProfileComplete,
    });
  } catch (err) {
    console.error('GET /profile error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

module.exports = router;
