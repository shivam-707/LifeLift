/**
 * PeakMode — Progress Page
 * ──────────────────────────
 * Top: streak badges, 4 lifetime/monthly stat cards.
 * Bottom: last 4 weeks of workout consistency as horizontal bars.
 *
 * Data sources:
 *   GET /api/streaks/stats     → totalWorkoutsCompleted, totalScansThisMonth,
 *                                averageSleepThisMonth, daysActiveOnApp
 *   GET /api/workout/history   → last 4 WorkoutLog docs (weekStartDate desc)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import StreakBadges from '../components/StreakBadges';
import api from '../utils/api';
import './Progress.css';

/* ── Format a week's date range from its Monday start date ──────────────────
   e.g. weekStartDate "2026-06-22" → "Jun 22 - Jun 28"                       */
const formatWeekRange = (weekStartDate) => {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
};

/* ── Stat card data shape ─────────────────────────────────────────────────── */
const STAT_DEFS = [
  { key: 'totalWorkoutsCompleted', icon: '🏋️', label: 'Total Workouts',      unit: '' },
  { key: 'totalScansThisMonth',    icon: '🔍', label: 'Scans This Month',    unit: '' },
  { key: 'averageSleepThisMonth',  icon: '😴', label: 'Avg Sleep This Month', unit: 'h' },
  { key: 'daysActiveOnApp',        icon: '🔥', label: 'Days Active',         unit: '' },
];

const Progress = () => {
  const { logout } = useAuth();

  const [stats,   setStats]   = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  /* ── Fetch both data sources in parallel on mount ─────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          api.get('/streaks/stats'),
          api.get('/workout/history'),
        ]);
        setStats(statsRes.data);
        setHistory(historyRes.data.logs || []);
      } catch (err) {
        console.error('Failed to load progress data:', err.response?.data?.message || err.message);
        setError("Couldn't load your progress. Try refreshing.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── Render ─────────────────────────────────────────────────────────────────── */
  return (
    <SidebarProvider>
      <div className="dashboard">
      <Sidebar />

      <div className="dashboard__body">
        {/* Mobile topbar */}
        <header className="topbar">
          <Sidebar.Trigger />
          <span className="topbar__brand"><span aria-hidden="true">⚡</span> LifeLift</span>
          <button className="topbar__logout" onClick={logout} aria-label="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              width="18" height="18" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </header>

        <main className="pg-page">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="pg-header">
            <h1 className="pg-title">Your Progress 📊</h1>
            <p className="pg-subtitle">Analyze your training frequency and sleep streaks</p>
          </div>

          {/* ── Streak badges ───────────────────────────────────── */}
          <div className="pg-section">
            <StreakBadges />
          </div>

          {error && (
            <div className="pg-error" role="alert">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}

          {/* ── Stats grid ──────────────────────────────────────── */}
          <div className="pg-stats-grid">
            {STAT_DEFS.map(({ key, icon, label, unit }) => (
              <div key={key} className="pg-stat-card">
                <span className="pg-stat-card__icon">{icon}</span>
                <p className="pg-stat-card__value">
                  {loading ? '–' : (stats?.[key] ?? 0)}{!loading && unit}
                </p>
                <p className="pg-stat-card__label">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Weekly consistency chart ────────────────────────── */}
          <div className="pg-section">
            <h2 className="pg-section-title">Weekly Workout Consistency</h2>

            {loading ? (
              <p className="pg-loading">Loading…</p>
            ) : history && history.length > 0 ? (
              <div className="pg-chart">
                {history.map((log) => {
                  const pct = log.availableDays > 0
                    ? Math.min(100, Math.round((log.daysCompleted / log.availableDays) * 100))
                    : 0;
                  const barClass =
                    pct >= 80 ? 'pg-bar-fill--high' :
                    pct >= 50 ? 'pg-bar-fill--mid'  :
                                'pg-bar-fill--low';

                  return (
                    <div key={log._id} className="pg-bar-row">
                      <span className="pg-bar-row__label">{formatWeekRange(log.weekStartDate)}</span>
                      <div className="pg-bar-track">
                        <div
                          className={`pg-bar-fill ${barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="pg-bar-row__count">
                          {log.daysCompleted}/{log.availableDays} days
                        </span>
                      </div>
                      <span className="pg-bar-row__pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="pg-empty">No workout history yet — generate your first split to start tracking.</p>
            )}
          </div>

        </main>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Progress;