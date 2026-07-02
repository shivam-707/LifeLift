/**
 * PeakMode — Food Diary Routes
 * ─────────────────────────────
 * POST   /api/food-diary/log       Log a food item (AI estimates macros)
 * GET    /api/food-diary/today     Fetch today's entries + running totals
 * GET    /api/food-diary/:date     Fetch entries for a specific date (YYYY-MM-DD)
 * DELETE /api/food-diary/:id       Remove a single entry
 */

const express      = require('express');
const protect      = require('../middleware/auth');
const { askClaude } = require('../services/claudeService');
const FoodEntry    = require('../models/FoodEntry');

const router = express.Router();
router.use(protect);

/* ── Helper: today's date string in YYYY-MM-DD (UTC) ──────────────────────── */
const todayString = () => new Date().toISOString().slice(0, 10);

/* ── AI system prompt for macro estimation ────────────────────────────────── */
const MACRO_SYSTEM_PROMPT =
  'You are a nutritionist specialising in Indian foods, hostel meals, and common ' +
  'packaged products. Given a food item and quantity, return ONLY a valid JSON ' +
  'object with exactly two keys: { "calories": <number>, "protein": <number> }. ' +
  'calories = total kcal, protein = total grams of protein. ' +
  'Be accurate and realistic — account for cooking oil in Indian dishes. ' +
  'Return ONLY the JSON object. No explanation, no markdown, no extra text.';

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/food-diary/log
   ────────────────────────
   Body: { food: string, quantity: string, meal?: string, date?: string }
   Calls AI to estimate macros, saves the entry, returns it.
════════════════════════════════════════════════════════════════════════════ */
router.post('/log', async (req, res) => {
  try {
    const { food, quantity, meal, date } = req.body;

    if (!food?.trim())     return res.status(400).json({ success: false, message: 'food is required' });
    if (!quantity?.trim()) return res.status(400).json({ success: false, message: 'quantity is required' });

    // ── Ask AI to estimate calories + protein ─────────────────────────────
    const userMsg = `Food: ${food.trim()}\nQuantity: ${quantity.trim()}\n\nEstimate calories and protein.`;
    const rawAI   = await askClaude(MACRO_SYSTEM_PROMPT, userMsg);

    let calories = 0;
    let protein  = 0;
    try {
      const cleaned = rawAI.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      calories = Math.round(Number(parsed.calories) || 0);
      protein  = Math.round(Number(parsed.protein)  || 0);
    } catch (parseErr) {
      console.error('[food-diary] Failed to parse macro JSON:', rawAI);
      // Fall back to 0s — entry is still saved, user can see estimate failed
    }

    // ── Save entry ─────────────────────────────────────────────────────────
    const entry = await FoodEntry.create({
      userId:   req.user._id,
      date:     date || todayString(),
      food:     food.trim(),
      quantity: quantity.trim(),
      calories,
      protein,
      meal:     meal || 'other',
    });

    return res.status(201).json({ success: true, entry });
  } catch (err) {
    console.error('POST /api/food-diary/log error:', err.message);
    if (err.isRateLimit) return res.status(429).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: 'Failed to log food entry' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/food-diary/today
   ────────────────────────
   Returns today's entries + totals for the logged-in user.
════════════════════════════════════════════════════════════════════════════ */
router.get('/today', async (req, res) => {
  try {
    const date    = todayString();
    const entries = await FoodEntry.find({ userId: req.user._id, date }).sort({ createdAt: 1 });

    const totalCalories = entries.reduce((s, e) => s + e.calories, 0);
    const totalProtein  = entries.reduce((s, e) => s + e.protein,  0);

    return res.status(200).json({ success: true, date, entries, totalCalories, totalProtein });
  } catch (err) {
    console.error('GET /api/food-diary/today error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch diary' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/food-diary/:date
   ─────────────────────────
   Returns entries for a specific date (YYYY-MM-DD).
════════════════════════════════════════════════════════════════════════════ */
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    // Basic date format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
    }

    const entries = await FoodEntry.find({ userId: req.user._id, date }).sort({ createdAt: 1 });
    const totalCalories = entries.reduce((s, e) => s + e.calories, 0);
    const totalProtein  = entries.reduce((s, e) => s + e.protein,  0);

    return res.status(200).json({ success: true, date, entries, totalCalories, totalProtein });
  } catch (err) {
    console.error('GET /api/food-diary/:date error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch diary' });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   DELETE /api/food-diary/:id
   ─────────────────────────────
   Removes a single food entry (must belong to the requesting user).
════════════════════════════════════════════════════════════════════════════ */
router.delete('/:id', async (req, res) => {
  try {
    const entry = await FoodEntry.findOneAndDelete({
      _id:    req.params.id,
      userId: req.user._id,   // ensures users can only delete their own entries
    });

    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });

    return res.status(200).json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    console.error('DELETE /api/food-diary/:id error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete entry' });
  }
});

module.exports = router;
