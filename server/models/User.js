/**
 * PeakMode — User Model
 * ──────────────────────
 * Defines the MongoDB schema for a PeakMode user.
 * Passwords are hashed with bcrypt before saving (pre-save hook).
 * Includes a method to compare a plain-text password against the stored hash.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      // Never return the password field in queries by default
      select: false,
    },

    // ── Physical stats (filled in profile setup after registration) ───────────
    profile: {
      weight: { type: Number, default: null },       // in kg
      height: { type: Number, default: null },       // in cm
      age:    { type: Number, default: null },
      fitnessGoal: {
        type: String,
        enum: ['muscle_gain', 'fat_loss', 'maintenance', 'strength', 'endurance', null],
        default: null,
      },
      proteinTarget:  { type: Number, default: null }, // grams per day
      calorieTarget:  { type: Number, default: null }, // kcal per day
      dailyBudget:    { type: Number, default: null }, // ₹ per day
      gymDaysPerWeek: { type: Number, default: null }, // days per week
      collegeHostel:  { type: String, default: '' },  // hostel / college name
    },

    // ── Streak counters (updated via dedicated routes in later steps) ─────────
    streaks: {
      gym:     { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      study:   { type: Number, default: 0 },
    },

    // ── Account flags ─────────────────────────────────────────────────────────
    isProfileComplete: { type: Boolean, default: false },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  }
);

// ── Pre-save hook: hash the password before persisting ────────────────────────
UserSchema.pre('save', async function (next) {
  // Only hash when the password field has actually been modified
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12); // cost factor of 12 is solid for 2024+
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method: compare plain password to stored hash ────────────────────
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: check if user profile is complete ────────────────────────
UserSchema.methods.checkProfileComplete = function () {
  const p = this.profile || {};
  return !!(
    p.age &&
    p.weight &&
    p.height &&
    p.fitnessGoal &&
    p.proteinTarget &&
    p.calorieTarget &&
    p.dailyBudget !== null && p.dailyBudget !== undefined &&
    p.gymDaysPerWeek
  );
};

// ── Virtual: full name derived from username (extensible) ─────────────────────
UserSchema.virtual('displayName').get(function () {
  return this.username;
});

module.exports = mongoose.model('User', UserSchema);
