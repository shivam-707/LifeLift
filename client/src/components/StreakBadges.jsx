/**
 * PeakMode — Streak Badges
 * ──────────────────────────
 * Compact, reusable row of 3 badge cards. Drop it anywhere:
 *   <StreakBadges />
 *
 * Fetches live streak data from GET /api/streaks/overview on mount.
 */

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import './StreakBadges.css';

/* ── Streak tier classifier ───────────────────────────────────────────────────
   Maps a streak count to one of three visual intensity tiers, used to scale
   the flame/moon emoji's size and colour via CSS class — no new emoji needed,
   just font-size + color changes per tier.
     0      → no tier (badge inactive, emoji not shown intensified)
     1-2    → tier 1: small, orange
     3-5    → tier 2: larger, red-orange
     6+     → tier 3: largest, red-purple
─────────────────────────────────────────────────────────────────────────── */
const getStreakTier = (streak) => {
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
};

const StreakBadges = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  /* ── Fetch streak overview on mount ──────────────────────────────────────── */
  useEffect(() => {
    const loadStreaks = async () => {
      try {
        const res = await api.get('/streaks/overview');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load streaks:', err.response?.data?.message || err.message);
        setError("Couldn't load streaks");
      } finally {
        setLoading(false);
      }
    };
    loadStreaks();
  }, []);

  const gymStreak           = data?.gymStreak ?? 0;
  const sleepStreak          = data?.sleepStreak ?? 0;
  const proteinStreak       = data?.proteinStreak ?? 0;
  const longestGymStreak    = data?.longestGymStreak ?? 0;
  const longestSleepStreak  = data?.longestSleepStreak ?? 0;

  const gymTier     = getStreakTier(gymStreak);
  const sleepTier   = getStreakTier(sleepStreak);
  const proteinTier = getStreakTier(proteinStreak);

  /* ── Loading skeleton ─────────────────────────────────────────────────────────
     Reuses existing .sb-badge / .sb-badge--soon styling (muted, no live data)
     rather than introducing new skeleton-specific classes, since this file is
     being updated in isolation without a matching CSS change.
  ─────────────────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="sb-row">
        <div className="sb-badge sb-badge--soon">
          <span className="sb-badge__icon">🏋️</span>
          <div className="sb-badge__body">
            <p className="sb-badge__label">Gym Streak</p>
            <span className="sb-badge__soon-tag">Loading…</span>
          </div>
        </div>
        <div className="sb-badge sb-badge--soon">
          <span className="sb-badge__icon">😴</span>
          <div className="sb-badge__body">
            <p className="sb-badge__label">Sleep Streak</p>
            <span className="sb-badge__soon-tag">Loading…</span>
          </div>
        </div>
        <div className="sb-badge sb-badge--soon">
          <span className="sb-badge__icon">💪</span>
          <div className="sb-badge__body">
            <p className="sb-badge__label">Protein Streak</p>
            <span className="sb-badge__soon-tag">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sb-row">

      {error && <p className="sb-badge__label">{error}</p>}

      {/* ── Gym Streak ──────────────────────────────────────────── */}
      <div
        className={`sb-badge sb-tooltip ${gymStreak > 0 ? 'sb-badge--active sb-badge--glow' : ''}`}
        data-tooltip={`Best: ${longestGymStreak} weeks 🏆`}
      >
        <span className="sb-badge__icon">🏋️</span>
        <div className="sb-badge__body">
          <p className="sb-badge__label">Gym Streak</p>
          <p className="sb-badge__value">
            {gymStreak} <span className="sb-badge__unit">weeks</span>{' '}
            <span className={`sb-flame sb-flame--tier${gymTier}`}>🔥</span>
          </p>
        </div>
      </div>

      {/* ── Sleep Streak ────────────────────────────────────────── */}
      <div
        className={`sb-badge sb-tooltip ${sleepStreak > 0 ? 'sb-badge--active sb-badge--glow' : ''}`}
        data-tooltip={`Best: ${longestSleepStreak} days 🏆`}
      >
        <span className="sb-badge__icon">😴</span>
        <div className="sb-badge__body">
          <p className="sb-badge__label">Sleep Streak</p>
          <p className="sb-badge__value">
            {sleepStreak} <span className="sb-badge__unit">days</span>{' '}
            <span className={`sb-moon sb-moon--tier${sleepTier}`}>🌙</span>
          </p>
        </div>
      </div>

      {/* ── Protein Streak ─────────────────────────────────────── */}
      <div
        className={`sb-badge sb-tooltip ${proteinStreak > 0 ? 'sb-badge--active sb-badge--glow' : ''}`}
        data-tooltip="Hit your daily protein target to build your streak! 🏆"
      >
        <span className="sb-badge__icon">💪</span>
        <div className="sb-badge__body">
          <p className="sb-badge__label">Protein Streak</p>
          <p className="sb-badge__value">
            {proteinStreak} <span className="sb-badge__unit">days</span>{' '}
            <span className={`sb-flame sb-flame--tier${proteinTier}`}>🔥</span>
          </p>
        </div>
      </div>

    </div>
  );
};

export default StreakBadges;
