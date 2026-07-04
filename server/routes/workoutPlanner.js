/**
 * PeakMode — Workout Planner Route
 * ──────────────────────────────────
 * POST /api/workout/generate  (protected)
 *
 * Looks up the static base split for the student's available gym days
 * this week, then asks Claude for short, practical coaching notes
 * personalized to their fitness goal and what they did last week.
 *
 * Body:
 *   availableDays  : number  3 | 4 | 5  — how many days they can train this week
 *   fitnessGoal    : string  (e.g. "muscle_gain", "fat_loss", "strength")
 *   lastWeekSplit  : string  (optional — what split/days they did last week)
 *
 * Returns:
 *   { success: true, split: [...], coachingNotes: string }
 */

const express        = require('express');
const protect        = require('../middleware/auth');
const { askClaude }  = require('../services/claudeService');
const workoutSplits  = require('../data/workoutSplits');
const WorkoutLog     = require('../models/WorkoutLog');

const router = express.Router();

/**
 * getWeekStartDate
 * ─────────────────
 * Returns the Monday of the current week at midnight UTC.
 * This is the normalized key used to find/create a WorkoutLog —
 * calling this on any day within the same calendar week always
 * returns the identical Date value, so lookups stay consistent.
 */
const getWeekStartDate = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

  // Days to subtract to reach Monday. Sunday (0) is treated as the
  // last day of the previous week, so it goes back 6 days.
  const diffToMonday = day === 0 ? 6 : day - 1;

  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  return monday;
};

const SYSTEM_PROMPT =
  "You are LifeLift's Workout Coach for college students with limited and " +
  "variable gym time. Given the base workout split and the student's fitness " +
  "goal, provide brief personalized coaching notes for the week. Be " +
  "motivating but practical. Mention how to adjust if they miss a day, and " +
  "one key form reminder for the week. Keep it under 5 lines.";

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/workout/generate
════════════════════════════════════════════════════════════════════════════ */
router.post('/generate', protect, async (req, res) => {
  try {
    const { availableDays, fitnessGoal, lastWeekSplit } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!availableDays) {
      return res.status(400).json({
        success: false,
        message: 'availableDays is required',
      });
    }

    const days = Number(availableDays);
    const baseSplit = workoutSplits[days];

    if (!baseSplit) {
      return res.status(400).json({
        success: false,
        message: `No workout split available for ${availableDays} days. Choose 3, 4, or 5.`,
      });
    }

    // ── Persist the chosen split for this week ────────────────────────────
    // Upsert the current week's log so that /current-week will correctly
    // remember which split the user picked, even after a page refresh.
    const weekStartDate = getWeekStartDate();
    await WorkoutLog.findOneAndUpdate(
      { userId: req.user._id, weekStartDate },
      {
        $set:      { availableDays: days, splitUsed: `${days}-day` },
        $setOnInsert: { daysCompleted: 0, completedDayNumbers: [] },
      },
      { upsert: true, new: true }
    );

    // ── Build user message ────────────────────────────────────────────────
    const userMessage =
      `Available gym days this week: ${days}\n` +
      `Fitness goal: ${fitnessGoal || 'not specified'}\n` +
      `Last week's split/days: ${lastWeekSplit || 'not provided'}\n\n` +
      `Base workout split (JSON):\n${JSON.stringify(baseSplit, null, 2)}\n\n` +
      `Give this student short, practical coaching notes for the week ahead.`;

    // ── Call Claude ───────────────────────────────────────────────────────
    const coachingNotes = await askClaude(SYSTEM_PROMPT, userMessage);

    return res.status(200).json({
      success: true,
      split:   baseSplit,
      coachingNotes,
    });
  } catch (err) {
    console.error('POST /api/workout/generate error:', err.message);
    if (err.isRateLimit) {
      return res.status(429).json({ success: false, message: err.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to generate workout plan',
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/workout/current-week
   ─────────────────────────────
   Returns the current week's WorkoutLog for the logged-in user.
   If no log exists yet for this week, creates one using the most recent
   availableDays the user generated a plan for (or defaults to 3).
════════════════════════════════════════════════════════════════════════════ */
router.get('/current-week', protect, async (req, res) => {
  try {
    const weekStartDate = getWeekStartDate();

    let log = await WorkoutLog.findOne({
      userId: req.user._id,
      weekStartDate,
    });

    if (!log) {
      // No log yet for this week — look up the most recent previous log
      // so we can carry forward whatever split the user last used.
      const previousLog = await WorkoutLog.findOne({ userId: req.user._id })
        .sort({ weekStartDate: -1 })
        .lean();

      const carryOverDays = previousLog?.availableDays || null; // null = user hasn't set one yet

      log = await WorkoutLog.create({
        userId:        req.user._id,
        weekStartDate,
        availableDays: carryOverDays,   // null until user picks days or generate is called
        splitUsed:     previousLog?.splitUsed || '',
        daysCompleted: 0,
        completedDayNumbers: [],
      });
    }

    return res.status(200).json({ success: true, log });
  } catch (err) {
    console.error('GET /api/workout/current-week error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current week log',
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/workout/log-day
   ──────────────────────────
   Marks a specific day number as completed for the current week.
   Body: { dayNumber: number }
   Idempotent — logging the same day twice doesn't double-count it.
════════════════════════════════════════════════════════════════════════════ */
router.post('/log-day', protect, async (req, res) => {
  try {
    const { dayNumber } = req.body;

    if (dayNumber === undefined || dayNumber === null) {
      return res.status(400).json({
        success: false,
        message: 'dayNumber is required',
      });
    }

    const num = Number(dayNumber);
    if (!Number.isInteger(num) || num < 1) {
      return res.status(400).json({
        success: false,
        message: 'dayNumber must be a positive integer',
      });
    }

    const weekStartDate = getWeekStartDate();

    // Get-or-create this week's log (same logic as /current-week)
    let log = await WorkoutLog.findOne({
      userId: req.user._id,
      weekStartDate,
    });

    if (!log) {
      // No log yet — carry forward the user's most recently chosen split
      const previousLog = await WorkoutLog.findOne({ userId: req.user._id })
        .sort({ weekStartDate: -1 })
        .lean();

      log = await WorkoutLog.create({
        userId:        req.user._id,
        weekStartDate,
        availableDays: previousLog?.availableDays || null,
        splitUsed:     previousLog?.splitUsed || '',
        daysCompleted: 0,
        completedDayNumbers: [],
      });
    }

    // Only add + increment if this day hasn't already been logged this week
    if (!log.completedDayNumbers.includes(num)) {
      log.completedDayNumbers.push(num);
      log.daysCompleted = log.completedDayNumbers.length;
      await log.save();
    }

    return res.status(200).json({ success: true, log });
  } catch (err) {
    console.error('POST /api/workout/log-day error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to log workout day',
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/workout/history
   ───────────────────────────
   Returns the last 4 WorkoutLog documents for the logged-in user,
   sorted by weekStartDate descending (most recent week first).
   Used by the Progress page to render a weekly consistency chart.
════════════════════════════════════════════════════════════════════════════ */
router.get('/history', protect, async (req, res) => {
  try {
    const logs = await WorkoutLog.find({ userId: req.user._id })
      .sort({ weekStartDate: -1 })
      .limit(4)
      .lean();

    return res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error('GET /api/workout/history error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workout history',
    });
  }
});

module.exports = router;
