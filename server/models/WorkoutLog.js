/**
 * PeakMode — WorkoutLog Model
 * ─────────────────────────────
 * Tracks which days of the week's assigned workout split a user has
 * actually completed. One document per user per week — weekStartDate
 * is normalized to the Monday of that week (midnight UTC) so repeated
 * lookups within the same week always resolve to the same record.
 */

const mongoose = require('mongoose');

const WorkoutLogSchema = new mongoose.Schema(
  {
    // ── Owner ──────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Week identity ──────────────────────────────────────────────────────
    // Normalized to the Monday of the week (midnight UTC) — see
    // getWeekStartDate() in routes/workoutPlanner.js for how this is derived.
    weekStartDate: {
      type: Date,
      required: true,
    },

    // ── Plan for this week ─────────────────────────────────────────────────
    availableDays: {
      type: Number,
      default: null,   // null = user hasn't picked a split for this week yet
      min: 3,
      max: 5,
    },
    splitUsed: {
      type: String, // e.g. "Upper/Lower x2" — human-readable label for the split
      default: '',
    },

    // ── Progress tracking ──────────────────────────────────────────────────
    daysCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedDayNumbers: {
      type: [Number], // e.g. [1, 2] — which day numbers (1-indexed) were done
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// One log per user per week — prevents duplicate week records.
WorkoutLogSchema.index({ userId: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('WorkoutLog', WorkoutLogSchema);
