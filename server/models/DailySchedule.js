/**
 * PeakMode — Daily Schedule Model
 * ─────────────────────────────────
 * Stores either an AI-optimized or manually built daily timetable
 * for a user, associated with a specific calendar date (YYYY-MM-DD).
 *
 * A compound unique index on (userId, date) ensures only one schedule
 * per user per calendar day — logging again updates/overwrites in place.
 */

const mongoose = require('mongoose');

const TimeBlockSchema = new mongoose.Schema({
  time: {
    type: String,
    required: true,
  },
  activity: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['college', 'gym', 'study', 'sleep', 'meal', 'free', 'misc'],
    required: true,
  },
  tip: {
    type: String,
    default: '',
  }
});

const DailyScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Date represented as "YYYY-MM-DD" local to the user
    date: {
      type: String,
      required: true,
    },

    isManual: {
      type: Boolean,
      default: false,
    },

    // Cache of the form parameters used to generate the schedule (if any)
    form: {
      collegeHours: { type: String, default: '' },
      wakeUpTime: { type: String, default: '' },
      sleepTime: { type: String, default: '' },
      gymDuration: { type: Number, default: 0 },
      gymStartTime: { type: String, default: '' },
      preferredGymTime: { type: String, default: '' },
      studyHoursAvailable: { type: Number, default: 0 },
      miscHoursAvailable: { type: Number, default: 0 },
      sleepTarget: { type: Number, default: 0 },
    },

    // The array of chronological schedule time blocks
    schedule: [TimeBlockSchema],
  },
  { timestamps: true }
);

/* One daily schedule per user per day */
DailyScheduleSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailySchedule', DailyScheduleSchema);
