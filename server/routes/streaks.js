/**
 * PeakMode — Streaks Route
 * ──────────────────────────
 * GET /api/streaks/overview  (protected)
 *
 * Calculates three streaks for the logged-in user:
 *   1. Gym Streak    — consecutive weeks (most recent first) where the
 *                       student hit at least 80% of their planned gym
 *                       days, sourced from WorkoutLog.
 *   2. Sleep Streak   — consecutive days (most recent first) where
 *                       hoursSlept met or exceeded that day's
 *                       sleepTarget, sourced from SleepLog.
 *   3. Protein Streak — hardcoded to 0 until meal logging exists.
 *
 * Both the gym and sleep streaks are also compared against the user's
 * longestGymStreak / longestSleepStreak fields on the User model and
 * persisted if the current streak is a new record.
 */

const express      = require('express');
const protect      = require('../middleware/auth');
const User         = require('../models/User');
const WorkoutLog    = require('../models/WorkoutLog');
const SleepLog       = require('../models/SleepLog');
const ScanHistory     = require('../models/ScanHistory');
const FoodEntry      = require('../models/FoodEntry');

const router = express.Router();

/* ════════════════════════════════════════════════════════════════════════════
   Protein Streak
   ──────────────
   Query FoodEntry grouped by date, summing up the protein per day.
   Walk through consecutive days starting from today or yesterday where:
     dailyProtein >= proteinTarget
   Stop at the first day that doesn't qualify.
════════════════════════════════════════════════════════════════════════════ */
const calculateProteinStreak = async (userId, proteinTarget) => {
  if (!proteinTarget || proteinTarget <= 0) return 0;

  // Aggregate total protein per date for the user
  const entries = await FoodEntry.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$date',
        totalProtein: { $sum: '$protein' }
      }
    },
    { $sort: { _id: -1 } } // sort by date descending (most recent first)
  ]);

  if (entries.length === 0) return 0;

  let streak = 0;
  
  // Date strings to check for consecutive days (UTC / standard date string format YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // If the most recent entry is neither today nor yesterday, the streak is broken (0)
  const mostRecentDate = entries[0]._id;
  if (mostRecentDate !== todayStr && mostRecentDate !== yesterdayStr) {
    return 0;
  }

  // Helper to subtract days
  const subtractDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  // Walk through consecutive dates starting from the most recent one
  let expectedDate = mostRecentDate;
  let idx = 0;

  while (idx < entries.length) {
    const dayEntry = entries[idx];
    
    // If there is a gap in consecutive days, streak is broken
    if (dayEntry._id !== expectedDate) {
      break;
    }

    if (dayEntry.totalProtein >= proteinTarget) {
      streak += 1;
      expectedDate = subtractDays(dayEntry._id, 1);
      idx += 1;
    } else {
      // If they logged food but didn't hit the target, the streak is broken
      break;
    }
  }

  return streak;
};

/* ════════════════════════════════════════════════════════════════════════════
   Gym Streak
   ───────────
   Query WorkoutLog sorted by weekStartDate descending (most recent week
   first). Walk through and count consecutive weeks where:
     daysCompleted >= availableDays * 0.8
   Stop at the first week that doesn't qualify.
════════════════════════════════════════════════════════════════════════════ */
const calculateGymStreak = async (userId) => {
  const logs = await WorkoutLog.find({ userId })
    .sort({ weekStartDate: -1 })
    .lean();

  let streak = 0;

  for (const log of logs) {
    const threshold = log.availableDays * 0.8;
    if (log.daysCompleted >= threshold) {
      streak += 1;
    } else {
      break; // first non-qualifying week stops the count
    }
  }

  return streak;
};

/* ════════════════════════════════════════════════════════════════════════════
   Sleep Streak
   ─────────────
   Query SleepLog sorted by date descending (most recent day first).
   Walk through and count consecutive days where:
     hoursSlept >= sleepTarget
   Stop at the first day that doesn't qualify. Days with no recorded
   sleepTarget (older entries before this field existed) are skipped
   from the qualification check by falling back to a sensible default
   of 7 hours, so a missing target doesn't silently break the streak.
════════════════════════════════════════════════════════════════════════════ */
const calculateSleepStreak = async (userId) => {
  const logs = await SleepLog.find({ userId })
    .sort({ date: -1 })
    .lean();

  let streak = 0;

  for (const log of logs) {
    const target = log.sleepTarget ?? 7; // fallback if not snapshotted
    if (log.hoursSlept >= target) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/streaks/overview
════════════════════════════════════════════════════════════════════════════ */
router.get('/overview', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const proteinTarget = req.user.profile?.proteinTarget || 0;

    const [gymStreak, sleepStreak, proteinStreak] = await Promise.all([
      calculateGymStreak(userId),
      calculateSleepStreak(userId),
      calculateProteinStreak(userId, proteinTarget),
    ]);

    // ── Compare against stored longest streaks, update if beaten ──────────
    const currentLongestGym   = req.user.longestGymStreak   ?? 0;
    const currentLongestSleep = req.user.longestSleepStreak ?? 0;

    const newLongestGym   = Math.max(currentLongestGym,   gymStreak);
    const newLongestSleep = Math.max(currentLongestSleep, sleepStreak);

    // Save current streaks and longest records to the user
    await User.findByIdAndUpdate(userId, {
      longestGymStreak:   newLongestGym,
      longestSleepStreak: newLongestSleep,
      'streaks.protein':  proteinStreak,
      'streaks.gym':      gymStreak,
      'streaks.sleep':    sleepStreak,
    });

    return res.status(200).json({
      success:              true,
      gymStreak,
      sleepStreak,
      proteinStreak,
      longestGymStreak:    newLongestGym,
      longestSleepStreak:  newLongestSleep,
    });
  } catch (err) {
    console.error('GET /api/streaks/overview error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate streaks',
    });
  }
});

/* ── Helper: start of the current calendar month (midnight UTC) ─────────────
   Used to scope "this month" queries for scans and average sleep.
─────────────────────────────────────────────────────────────────────────── */
const startOfCurrentMonthUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
};

/* ── Helper: format a Date to a "YYYY-MM-DD" key (UTC) ──────────────────────
   Used to de-duplicate dates across two different collections when
   counting distinct days the user was active on the app.
─────────────────────────────────────────────────────────────────────────── */
const toDateKeyUTC = (d) => {
  const date = new Date(d);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/streaks/stats
   ────────────────────────
   Returns overall lifetime / monthly stats for the logged-in user:
     totalWorkoutsCompleted — sum of daysCompleted across all WorkoutLog docs
     totalScansThisMonth    — count of ScanHistory docs created this month
     averageSleepThisMonth  — average hoursSlept from SleepLog this month
     totalChatInteractions  — placeholder, always 0 for now
     daysActiveOnApp        — distinct calendar dates with a WorkoutLog or
                               SleepLog entry (using each doc's createdAt)
════════════════════════════════════════════════════════════════════════════ */
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const monthStart = startOfCurrentMonthUTC();

    const [
      workoutLogs,
      scansThisMonthCount,
      sleepLogsThisMonth,
      allSleepLogsForActivity,
    ] = await Promise.all([
      // All workout logs — needed to sum daysCompleted across all-time
      WorkoutLog.find({ userId }).select('daysCompleted createdAt').lean(),

      // Count of scans created this month
      ScanHistory.countDocuments({ userId, createdAt: { $gte: monthStart } }),

      // Sleep logs this month — needed for the average
      SleepLog.find({ userId, date: { $gte: monthStart } }).select('hoursSlept').lean(),

      // All sleep logs — needed (alongside workoutLogs) for daysActiveOnApp
      SleepLog.find({ userId }).select('createdAt').lean(),
    ]);

    // ── totalWorkoutsCompleted: sum daysCompleted across all WorkoutLog docs ──
    const totalWorkoutsCompleted = workoutLogs.reduce(
      (sum, log) => sum + (log.daysCompleted || 0),
      0
    );

    // ── averageSleepThisMonth ────────────────────────────────────────────────
    const averageSleepThisMonth = sleepLogsThisMonth.length
      ? Math.round(
          (sleepLogsThisMonth.reduce((sum, log) => sum + log.hoursSlept, 0) /
            sleepLogsThisMonth.length) *
            10
        ) / 10
      : 0;

    // ── totalChatInteractions — placeholder ──────────────────────────────────
    const totalChatInteractions = 0;

    // ── daysActiveOnApp: distinct calendar dates across both collections ────
    const activeDateKeys = new Set();
    workoutLogs.forEach((log) => activeDateKeys.add(toDateKeyUTC(log.createdAt)));
    allSleepLogsForActivity.forEach((log) => activeDateKeys.add(toDateKeyUTC(log.createdAt)));
    const daysActiveOnApp = activeDateKeys.size;

    return res.status(200).json({
      success: true,
      totalWorkoutsCompleted,
      totalScansThisMonth: scansThisMonthCount,
      averageSleepThisMonth,
      totalChatInteractions,
      daysActiveOnApp,
    });
  } catch (err) {
    console.error('GET /api/streaks/stats error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate progress stats',
    });
  }
});

module.exports = router;
