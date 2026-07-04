/**
 * PeakMode — Schedule Optimizer Route
 * ──────────────────────────────────────
 * POST /api/schedule/generate  (protected)
 *
 * Builds a realistic single-day timetable balancing college, gym,
 * study blocks, meals, and sleep — tuned for a hostel student
 * trying to recover from training while keeping up academically.
 *
 * Body:
 *   collegeHours        : string  e.g. "9 AM - 3 PM"
 *   gymDuration          : number  minutes, e.g. 75
 *   studyHoursAvailable  : number  hours, e.g. 3.5
 *   gymDaysThisWeek      : number  3 / 4 / 5
 *   wakeUpTime           : string  e.g. "7:00 AM"
 *   sleepTarget          : number  hours, e.g. 7.5
 *   preferredGymTime     : string  "Morning" / "Evening" / "Night"
 *
 * Returns:
 *   { success: true, schedule: Array<{ time, activity, type, tip }> }
 */

const express        = require('express');
const protect        = require('../middleware/auth');
const { askClaude }  = require('../services/claudeService');
const DailySchedule  = require('../models/DailySchedule');

const router = express.Router();

const SYSTEM_PROMPT =
  "You are LifeLift's Schedule Optimizer for a hostel college student " +
  "balancing gym, studies, and sleep for muscle recovery. Given their " +
  "college hours, gym duration, available study hours, wake time and " +
  "sleep target, create a realistic daily time-table for ONE typical day. " +
  "CRITICAL RULES: " +
  "1) Sleep MUST be scheduled at NIGHT — starting at the target bedtime " +
  "   (which can range from 9:00 PM to 3:00 AM, spanning past midnight). " +
  "   A student's daily schedule runs continuously from wake-up time (e.g. 7:00 AM) " +
  "   through the day, ending with sleep starting at their target bedtime (e.g. 12:30 AM or 1:00 AM). " +
  "   Sleep is always the final block of the schedule, spanning overnight until the " +
  "   wake-up time the next morning. If the bedtime is after midnight (e.g. 12:30 AM), " +
  "   the schedule must run past 12:00 AM (midnight) up to that bedtime, and then sleep starts. " +
  "2) If preferredGymTime is 'Night', schedule gym in the 7 PM–10 PM range, " +
  "   NOT overlapping with sleep. " +
  "3) Include at least one 'misc' block for leisure/hobbies/personal time. " +
  "4) Prioritize 7-8 hours sleep for recovery, gym timing that doesn't " +
  "   conflict with college, and breaking study into focused blocks with breaks. " +
  "Format response as a JSON array of time blocks, each with: " +
  "{ time: 'H:MM AM/PM - H:MM AM/PM', activity: string, " +
  "type: 'college'/'gym'/'study'/'sleep'/'meal'/'free'/'misc', " +
  "tip: 'short practical tip for this block' } " +
  "'misc' type is for hobbies, leisure, social time, errands — anything that " +
  "is NOT studying, gym, eating, college classes, or sleep. " +
  "Return ONLY valid JSON array, no other text.";

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/schedule/generate
════════════════════════════════════════════════════════════════════════════ */
router.post('/generate', protect, async (req, res) => {
  try {
    const {
      collegeHours,
      gymDuration,
      gymStartTime,
      studyHoursAvailable,
      miscHoursAvailable,
      gymDaysThisWeek,
      wakeUpTime,
      sleepTime,
      sleepTarget,
      preferredGymTime,
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────
    if (
      !collegeHours ||
      gymDuration          === undefined ||
      studyHoursAvailable  === undefined ||
      gymDaysThisWeek      === undefined ||
      !wakeUpTime ||
      sleepTarget          === undefined ||
      !preferredGymTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          'All fields are required: collegeHours, gymDuration, studyHoursAvailable, ' +
          'gymDaysThisWeek, wakeUpTime, sleepTarget, preferredGymTime',
      });
    }

    // ── Build user message ────────────────────────────────────────────────
    const userMessage =
      `Student's daily details:\n` +
      `- College hours: ${collegeHours}\n` +
      `- Gym duration: ${gymDuration} minutes\n` +
      (gymStartTime ? `- Exact gym start time: ${gymStartTime}\n` : '') +
      `- Preferred gym time slot: ${preferredGymTime}\n` +
      `- Study hours available: ${studyHoursAvailable}\n` +
      `- Misc/personal time available: ${miscHoursAvailable || 1} hours\n` +
      `- Gym days this week: ${gymDaysThisWeek}\n` +
      `- Wake up time: ${wakeUpTime}\n` +
      (sleepTime ? `- Target bedtime: ${sleepTime}\n` : '') +
      `- Sleep target: ${sleepTarget} hours\n\n` +
      `IMPORTANT: Place sleep starting at the bedtime specified (or after 10 PM if not given), running through the night.\n` +
      `Include at least one 'misc' block for hobbies/leisure/personal time (${miscHoursAvailable || 1}h available).\n` +
      `Generate the optimized daily schedule as a JSON array following the exact format described.`;

    // ── Call Claude ───────────────────────────────────────────────────────
    const rawResponse = await askClaude(SYSTEM_PROMPT, userMessage);

    // ── Parse the JSON response ────────────────────────────────────────────
    let schedule;
    try {
      // Strip markdown code fences if Claude wraps the JSON in ```json ... ```
      const cleaned = rawResponse
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      schedule = JSON.parse(cleaned);

      if (!Array.isArray(schedule)) {
        throw new Error('Parsed response is not an array');
      }
    } catch (parseErr) {
      console.error('Failed to parse schedule JSON:', parseErr.message);
      console.error('Raw Claude response:', rawResponse);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate a valid schedule. Please try again.',
      });
    }

    return res.status(200).json({ success: true, schedule });
  } catch (err) {
    console.error('POST /api/schedule/generate error:', err.message);
    if (err.isRateLimit) {
      return res.status(429).json({ success: false, message: err.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to generate schedule',
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/schedule/save
   ───────────────────────
   Saves or updates (upserts) the daily schedule for the authenticated user
   associated with a specific calendar date (YYYY-MM-DD).
════════════════════════════════════════════════════════════════════════════ */
router.post('/save', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { date, form, schedule, isManual } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ success: false, message: 'Schedule array is required' });
    }

    const savedSchedule = await DailySchedule.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          isManual: !!isManual,
          form: form || {},
          schedule: schedule
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    return res.status(200).json({ success: true, schedule: savedSchedule });
  } catch (err) {
    console.error('POST /api/schedule/save error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to save schedule to database' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/schedule/day/:date
   ───────────────────────────
   Fetches the saved schedule configurations for a specific date (YYYY-MM-DD).
════════════════════════════════════════════════════════════════════════════ */
router.get('/day/:date', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date parameter is required' });
    }

    const savedSchedule = await DailySchedule.findOne({ userId, date });

    return res.status(200).json({ success: true, schedule: savedSchedule });
  } catch (err) {
    console.error('GET /api/schedule/day/:date error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch saved schedule' });
  }
});

module.exports = router;
