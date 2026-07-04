/**
 * PeakMode — Chat Routes
 * ───────────────────────
 * POST /api/chat  → send a message to the PeakMode AI assistant
 *
 * Protected: requires a valid JWT (Bearer token in Authorization header).
 * The user's profile is attached to req.user by the protect middleware
 * and injected into the system prompt so Claude has personal context
 * (protein target, budget, gym schedule, fitness goal) without the
 * frontend needing to send it on every message.
 */

const express    = require('express');
const protect    = require('../middleware/auth');
const { askClaude } = require('../services/claudeService');

const router = express.Router();

const SYSTEM_PROMPT =
  'You are LifeLift AI, a smart lifestyle assistant for college hostel students ' +
  'in India. You help with gym workout planning, academic scheduling, sleep ' +
  'optimization, budget food decisions in Indian Rupees, and ingredient analysis. ' +
  'Be concise, friendly, and practical.';

/* ════════════════════════════════════════════════════════════════════════════
   POST /api/chat
   ──────────────
   Body   : { message: string }
   Returns: { reply: string }
════════════════════════════════════════════════════════════════════════════ */
router.post('/', protect, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'message is required',
      });
    }

    // Enrich the system prompt with the user's saved profile so Claude
    // can give personalised answers without extra round-trips.
    const profile = req.user.profile || {};

    const contextLines = [
      SYSTEM_PROMPT,
      '',
      'User profile:',
      `- Name: ${req.user.username}`,
      profile.fitnessGoal    ? `- Fitness goal: ${profile.fitnessGoal}`                      : null,
      profile.weight         ? `- Weight: ${profile.weight} kg`                              : null,
      profile.height         ? `- Height: ${profile.height} cm`                              : null,
      profile.proteinTarget  ? `- Daily protein target: ${profile.proteinTarget} g`          : null,
      profile.dailyBudget    != null ? `- Daily food budget: ₹${profile.dailyBudget}`        : null,
      profile.gymDaysPerWeek ? `- Gym days per week: ${profile.gymDaysPerWeek}`              : null,
      profile.collegeHostel  ? `- College/hostel: ${profile.collegeHostel}`                  : null,
    ].filter(Boolean).join('\n');

    const reply = await askClaude(contextLines, message.trim());

    return res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error('POST /api/chat error:', err.message);
    if (err.isRateLimit) {
      return res.status(429).json({ success: false, message: err.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to get a response from LifeLift AI',
    });
  }
});

module.exports = router;
