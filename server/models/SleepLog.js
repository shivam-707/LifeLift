/**
 * PeakMode — Sleep Log Model
 * ────────────────────────────
 * One document per day per user. Tracks actual hours slept against
 * the user's sleep target, plus a subjective quality rating, so the
 * frontend can show trends and recovery insights over the week.
 *
 * A compound unique index on (userId, date) ensures only one log
 * per user per calendar day — logging again on the same day updates
 * rather than duplicates (enforced at the route layer via upsert).
 */

const mongoose = require('mongoose');

const SleepLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Calendar date this log belongs to (normalised to midnight UTC)
    date: {
      type: Date,
      required: true,
    },

    hoursSlept: {
      type: Number,
      required: [true, 'hoursSlept is required'],
      min: [0,  'hoursSlept cannot be negative'],
      max: [24, 'hoursSlept cannot exceed 24'],
    },

    // Snapshot of the user's sleep target at the time of logging —
    // stored per-entry so historical logs stay meaningful even if
    // the user later changes their target in their profile.
    sleepTarget: {
      type: Number,
      default: null,
      min: [0,  'sleepTarget cannot be negative'],
      max: [24, 'sleepTarget cannot exceed 24'],
    },

    quality: {
      type: String,
      enum: {
        values: ['Poor', 'Average', 'Good', 'Great'],
        message: '{VALUE} is not a valid sleep quality',
      },
      required: [true, 'quality is required'],
    },
  },
  { timestamps: true } // adds createdAt + updatedAt
);

/* One log per user per day */
SleepLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SleepLog', SleepLogSchema);
