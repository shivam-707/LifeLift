/**
 * PeakMode — ScanHistory Model
 * ──────────────────────────────
 * Stores a record of every ingredient scan a user runs, so they can
 * look back at past products without re-scanning. Populated from the
 * parsed Claude response right after each successful analysis in
 * routes/ingredientScanner.js.
 */

const mongoose = require('mongoose');

const ScanHistorySchema = new mongoose.Schema(
  {
    // ── Owner ──────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // speeds up "find all scans for this user" queries
    },

    // ── Product details ───────────────────────────────────────────────────
    productName: {
      type: String,
      required: [true, 'productName is required'],
      trim: true,
    },
    mrp: {
      type: Number,
      default: null, // ₹ — may not always be provided
    },

    // ── Parsed verdict fields (extracted from Claude's response) ──────────
    verdict: {
      type: String,
      default: '', // e.g. "Healthy" / "Acceptable" / "Avoid"
    },
    healthScore: {
      type: String, // stored as string since Claude may return "7" or "7/10"
      default: '',
    },
    budgetFit: {
      type: String,
      default: '', // e.g. "Yes" / "No" / "Borderline"
    },
    summary: {
      type: String,
      default: '',
    },
    betterAlternative: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // only need createdAt
  }
);

module.exports = mongoose.model('ScanHistory', ScanHistorySchema);
