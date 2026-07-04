/**
 * PeakMode — Food Advisor Route
 * ───────────────────────────────
 * POST /api/food/recommend  (protected)
 *
 * Receives the student's current situation, filters the food options
 * dataset to what's actually available, and asks Claude to pick the
 * single best option with a structured, actionable recommendation.
 *
 * Body:
 *   hungerLevel       : 'low' | 'medium' | 'high'
 *   budgetRemaining   : number  (₹ left for the day)
 *   proteinRemaining  : number  (grams still needed to hit daily target)
 *   messAvailable     : boolean (is mess open right now?)
 *   messQualityToday  : 'good' | 'average' | 'bad'
 *   timeOfDay         : 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'post-workout'
 *
 * Returns:
 *   { success: true, recommendation: string }
 */

const express        = require('express');
const protect        = require('../middleware/auth');
const { askClaude }  = require('../services/claudeService');
const foodOptions    = require('../data/foodOptions');

const router = express.Router();

const SYSTEM_PROMPT =
  "You are LifeLift's Food Advisor for Indian hostel students. " +
  "You have deep knowledge of Indian college hostel food culture — " +
  "mess food, canteen items, Blinkit orders, Dominos, KFC, local " +
  "dhabas. Recommend the single best food option based on the " +
  "student's current situation. Be direct and practical. Format " +
  "your response as:\n" +
  "RECOMMENDATION: [food name]\n" +
  "SOURCE: [where to get it]\n" +
  "COST: ₹[amount]\n" +
  "PROTEIN: [g]\n" +
  "REASON: [2 lines max, practical reason]\n" +
  "TIP: [one actionable tip]";

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/food/recommend
════════════════════════════════════════════════════════════════════════════ */
router.post('/recommend', protect, async (req, res) => {
  try {
    const {
      hungerLevel,
      budgetRemaining,
      proteinRemaining,
      messAvailable,
      messQualityToday,
      timeOfDay,
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────
    if (
      hungerLevel      === undefined ||
      budgetRemaining  === undefined ||
      proteinRemaining === undefined ||
      messAvailable    === undefined ||
      messQualityToday === undefined ||
      timeOfDay        === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: hungerLevel, budgetRemaining, proteinRemaining, messAvailable, messQualityToday, timeOfDay',
      });
    }

    // ── Filter food options ───────────────────────────────────────────────
    const FREE_SOURCES    = ['Self', 'Mess', 'Canteen'];
    const budget          = Number(budgetRemaining);

    const filtered = foodOptions.filter((item) => {
      // Rule 1: mess is closed → exclude Mess options
      if (!messAvailable && item.source === 'Mess') return false;

      // Rule 2: no money left → only free/self-arranged/canteen
      if (budget === 0 && !FREE_SOURCES.includes(item.source)) return false;

      // Rule 3: exclude options that cost more than remaining budget
      if (item.estimatedCost > budget) return false;

      return true;
    });

    if (filtered.length === 0) {
      return res.status(200).json({
        success: true,
        recommendation:
          'RECOMMENDATION: 3 Boiled Eggs\n' +
          'SOURCE: Self (room)\n' +
          'COST: ₹18\n' +
          'PROTEIN: 18g\n' +
          'REASON: No options fit your current budget. Eggs are your cheapest protein source.\n' +
          'TIP: Always keep a dozen eggs in your room as emergency protein backup.',
      });
    }

    // ── Serialise filtered options for the prompt ─────────────────────────
    const optionsList = filtered
      .map((item, i) =>
        `${i + 1}. ${item.name} | Source: ${item.source} | ` +
        `Cost: ₹${item.estimatedCost} | Protein: ${item.protein}g | ` +
        `Calories: ${item.calories}kcal | Healthy: ${item.isHealthy} | ` +
        `Notes: ${item.notes}`
      )
      .join('\n');

    // ── Build user message ────────────────────────────────────────────────
    const profile = req.user.profile || {};

    const userMessage =
      `Student situation:\n` +
      `- Hunger level: ${hungerLevel}\n` +
      `- Budget remaining today: ₹${budget}\n` +
      `- Protein still needed: ${proteinRemaining}g\n` +
      `- Mess available: ${messAvailable}\n` +
      `- Mess quality today: ${messQualityToday}\n` +
      `- Time of day / meal: ${timeOfDay}\n` +
      (profile.fitnessGoal    ? `- Fitness goal: ${profile.fitnessGoal}\n`                : '') +
      (profile.gymDaysPerWeek ? `- Gym days per week: ${profile.gymDaysPerWeek}\n`        : '') +
      `\nAvailable food options (${filtered.length} items after filtering):\n` +
      optionsList +
      `\n\nPick the single best option from the list above for this student right now.`;

    // ── Call Claude ───────────────────────────────────────────────────────
    const recommendation = await askClaude(SYSTEM_PROMPT, userMessage);

    return res.status(200).json({ success: true, recommendation });
  } catch (err) {
    console.error('POST /api/food/recommend error:', err.message);
    if (err.isRateLimit) {
      return res.status(429).json({ success: false, message: err.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to get a food recommendation',
    });
  }
});

module.exports = router;
