/**
 * PeakMode — Sleep Log Routes
 * ─────────────────────────────
 * POST /api/sleep/log      → save (or update) today's sleep entry
 * GET  /api/sleep/week     → last 7 days of sleep logs, newest first
 * GET  /api/sleep/average  → average hours slept over the last 7 days
 *
 * All routes require a valid JWT.
 */

const express   = require('express');
const protect   = require('../middleware/auth');
const SleepLog  = require('../models/SleepLog');

const router = express.Router();

router.use(protect);

/* ── Helper: normalise a Date to midnight UTC (start of that day) ───────────
   Used so "today" always maps to the same date key regardless of what
   time of day the request comes in, keeping the (userId, date) unique
   index meaningful — one log per calendar day.
─────────────────────────────────────────────────────────────────────────── */
const startOfDayUTC = (d = new Date()) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/sleep/log
   ────────────────────
   Body: { hoursSlept: number, quality: 'Poor'|'Average'|'Good'|'Great' }

   Saves today's entry. If a log already exists for today, it's updated
   in place (upsert) rather than creating a duplicate.
════════════════════════════════════════════════════════════════════════════ */
router.post('/log', async (req, res) => {
  try {
    const { hoursSlept, quality } = req.body;

    if (hoursSlept === undefined || hoursSlept === null) {
      return res.status(400).json({ success: false, message: 'hoursSlept is required' });
    }
    if (!quality) {
      return res.status(400).json({ success: false, message: 'quality is required' });
    }

    const today = startOfDayUTC();

    // Pull the user's saved sleep target (if any) to snapshot onto this entry
    const sleepTarget = req.user.profile?.sleepTarget ?? null;

    const log = await SleepLog.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $set: {
          hoursSlept: Number(hoursSlept),
          quality,
          sleepTarget,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        context: 'query',
      }
    );

    return res.status(200).json({ success: true, log });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    console.error('POST /api/sleep/log error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to save sleep log' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/sleep/week
   ────────────────────
   Returns the last 7 days of sleep logs for the current user,
   sorted newest first.
════════════════════════════════════════════════════════════════════════════ */
router.get('/week', async (req, res) => {
  try {
    const sevenDaysAgo = startOfDayUTC();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6); // today + 6 prior = 7 days

    const logs = await SleepLog.find({
      userId: req.user._id,
      date: { $gte: sevenDaysAgo },
    }).sort({ date: -1 });

    return res.status(200).json({ success: true, logs });
  } catch (err) {
    console.error('GET /api/sleep/week error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch weekly sleep logs' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/sleep/average
   ────────────────────────
   Returns the average hoursSlept over the last 7 days, plus how many
   entries that average is based on (so the frontend can show "based on
   4 of 7 days logged" instead of implying a full week of data).
════════════════════════════════════════════════════════════════════════════ */
router.get('/average', async (req, res) => {
  try {
    const sevenDaysAgo = startOfDayUTC();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const logs = await SleepLog.find({
      userId: req.user._id,
      date: { $gte: sevenDaysAgo },
    });

    if (logs.length === 0) {
      return res.status(200).json({
        success: true,
        averageHours: 0,
        daysLogged: 0,
      });
    }

    const totalHours = logs.reduce((sum, log) => sum + log.hoursSlept, 0);
    const averageHours = Math.round((totalHours / logs.length) * 10) / 10; // 1 decimal

    return res.status(200).json({
      success: true,
      averageHours,
      daysLogged: logs.length,
    });
  } catch (err) {
    console.error('GET /api/sleep/average error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to calculate sleep average' });
  }
});

module.exports = router;
