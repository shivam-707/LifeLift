/**
 * PeakMode — FoodEntry Model
 * ───────────────────────────
 * Stores a single food log entry for a user on a specific date.
 * Each entry records what was eaten, how much, and the AI-estimated
 * macros (calories + protein).
 *
 * One user can have many entries per day. Queried by (userId, date)
 * to build the daily diary view.
 */

const mongoose = require('mongoose');

const FoodEntrySchema = new mongoose.Schema(
  {
    // ── Owner ──────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
      index: true,
    },

    // ── Date key ───────────────────────────────────────────────────────────
    // Stored as "YYYY-MM-DD" string in the user's local date so that
    // "today's diary" doesn't shift across timezones at midnight UTC.
    date: {
      type: String,   // e.g. "2025-06-30"
      required: true,
      index: true,
    },

    // ── Food details ───────────────────────────────────────────────────────
    food: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    quantity: {
      type: String,   // free text, e.g. "2 pieces", "200g", "1 bowl"
      required: true,
      trim: true,
      maxlength: 100,
    },

    // ── AI-estimated macros ────────────────────────────────────────────────
    calories: {
      type: Number,
      required: true,
      min: 0,
    },
    protein: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Optional meal tag ─────────────────────────────────────────────────
    meal: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack', 'pre-workout', 'post-workout', 'other'],
      default: 'other',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fast daily diary lookups
FoodEntrySchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('FoodEntry', FoodEntrySchema);
