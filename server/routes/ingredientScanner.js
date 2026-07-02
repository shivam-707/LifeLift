/**
 * PeakMode — Ingredient Scanner Route
 * ─────────────────────────────────────
 * POST /api/ingredients/analyze  (protected)
 * GET  /api/ingredients/history  (protected)
 *
 * POST accepts a pasted ingredient list from a packaged food product
 * along with the product name, MRP, and the student's daily budget.
 * Returns a structured health + budget verdict powered by Claude, and
 * saves a parsed record to ScanHistory for later lookup.
 *
 * GET returns the user's last 10 scans, newest first.
 */

const express        = require('express');
const protect        = require('../middleware/auth');
const { askClaude }  = require('../services/claudeService');
const ScanHistory    = require('../models/ScanHistory');

const router = express.Router();

const SYSTEM_PROMPT =
  "You are PeakMode's Ingredient Analyzer for Indian college students who are " +
  "gym-goers on a tight budget. Analyze the given ingredient list of a packaged " +
  "food product. You have knowledge of common harmful additives, preservatives, " +
  "artificial sweeteners, trans fats, and misleading health claims common in " +
  "Indian packaged food products. " +
  "Format your response exactly as:\n" +
  "VERDICT: [Healthy / Acceptable / Avoid]\n" +
  "HEALTH SCORE: [1-10]\n" +
  "BUDGET FIT: [Yes / No / Borderline]\n" +
  "GOOD INGREDIENTS: [list max 3, comma separated]\n" +
  "BAD INGREDIENTS: [list max 3 with 1 line explanation each]\n" +
  "UNKNOWN INGREDIENTS: [list any ingredients student may not recognize with plain English explanation]\n" +
  "SUMMARY: [3 lines max, plain and practical]\n" +
  "BETTER ALTERNATIVE: [suggest a cheaper or healthier alternative commonly available in India]";

/* ── Field labels ──────────────────────────────────────────────────────────
   ALL_LABELS must include every label Claude's response can contain — even
   ones ScanHistory doesn't store (GOOD/BAD/UNKNOWN INGREDIENTS) — so those
   lines correctly end the previous field's continuation instead of being
   swallowed into it. STORED_LABELS is the subset we actually persist.     */
const ALL_LABELS = [
  'VERDICT', 'HEALTH SCORE', 'BUDGET FIT',
  'GOOD INGREDIENTS', 'BAD INGREDIENTS', 'UNKNOWN INGREDIENTS',
  'SUMMARY', 'BETTER ALTERNATIVE',
];

const FIELD_KEY_MAP = {
  'VERDICT':            'verdict',
  'HEALTH SCORE':       'healthScore',
  'BUDGET FIT':         'budgetFit',
  'SUMMARY':            'summary',
  'BETTER ALTERNATIVE': 'betterAlternative',
};

/**
 * Parses Claude's structured response line-by-line, extracting only the
 * fields ScanHistory cares about (verdict, healthScore, budgetFit,
 * summary, betterAlternative). Multi-line fields (e.g. a wrapped SUMMARY)
 * are accumulated until the next known label appears — checked against
 * ALL_LABELS so unstored fields like BAD INGREDIENTS still correctly
 * terminate the previous field instead of being merged into it.
 */
const parseForHistory = (text) => {
  const result = { verdict: '', healthScore: '', budgetFit: '', summary: '', betterAlternative: '' };
  let currentKey = null; // null when we're inside a field we don't store

  text.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const matchedLabel = ALL_LABELS.find((label) =>
      line.toUpperCase().startsWith(label + ':')
    );

    if (matchedLabel) {
      // Only track this field if we actually persist it; otherwise
      // currentKey becomes null so its lines are skipped, not appended
      // to whatever field came before it.
      currentKey = FIELD_KEY_MAP[matchedLabel] || null;
      if (currentKey) {
        result[currentKey] = line.slice(line.indexOf(':') + 1).trim();
      }
    } else if (currentKey) {
      result[currentKey] = result[currentKey]
        ? `${result[currentKey]}\n${line}`
        : line;
    }
  });

  return result;
};

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/ingredients/analyze
════════════════════════════════════════════════════════════════════════════ */
router.post('/analyze', protect, async (req, res) => {
  try {
    const { ingredientList, productName, mrp, budget } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!ingredientList || !ingredientList.trim()) {
      return res.status(400).json({
        success: false,
        message: 'ingredientList is required',
      });
    }

    if (!productName || !productName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'productName is required',
      });
    }

    // ── Build user message ────────────────────────────────────────────────
    const profile = req.user.profile || {};

    const userMessage =
      `Product: ${productName.trim()}\n` +
      `MRP: ₹${mrp ?? 'not provided'}\n` +
      `Student's daily food budget: ₹${budget ?? profile.dailyBudget ?? 'not provided'}\n` +
      (profile.fitnessGoal ? `Student's fitness goal: ${profile.fitnessGoal}\n` : '') +
      `\nIngredient list from label:\n${ingredientList.trim()}`;

    // ── Call Claude ───────────────────────────────────────────────────────
    const analysis = await askClaude(SYSTEM_PROMPT, userMessage);

    // ── Parse + save to scan history ────────────────────────────────────────
    // This is best-effort: if saving fails, we still return the analysis
    // to the user rather than failing the whole request.
    try {
      const parsed = parseForHistory(analysis);

      await ScanHistory.create({
        userId:            req.user._id,
        productName:       productName.trim(),
        mrp:               mrp ?? null,
        verdict:           parsed.verdict,
        healthScore:       parsed.healthScore,
        budgetFit:         parsed.budgetFit,
        summary:           parsed.summary,
        betterAlternative: parsed.betterAlternative,
      });
    } catch (saveErr) {
      console.error('Failed to save scan history:', saveErr.message);
      // Intentionally not returned to the client — analysis still succeeded
    }

    return res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error('POST /api/ingredients/analyze error:', err.message);
    if (err.isRateLimit) {
      return res.status(429).json({ success: false, message: err.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze ingredients',
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   GET /api/ingredients/history
   ─────────────────────────────
   Returns the logged-in user's last 10 scans, newest first.
════════════════════════════════════════════════════════════════════════════ */
router.get('/history', protect, async (req, res) => {
  try {
    const history = await ScanHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ success: true, history });
  } catch (err) {
    console.error('GET /api/ingredients/history error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch scan history',
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   DELETE /api/ingredients/history
   ─────────────────────────────────
   Deletes all scan history for the logged-in user.
════════════════════════════════════════════════════════════════════════════ */
router.delete('/history', protect, async (req, res) => {
  try {
    const result = await ScanHistory.deleteMany({ userId: req.user._id });

    return res.status(200).json({
      success: true,
      message: 'Scan history cleared',
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error('DELETE /api/ingredients/history error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear scan history',
    });
  }
});

module.exports = router;
