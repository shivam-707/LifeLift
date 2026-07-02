/**
 * PeakMode — Sleep Tracker Widget
 * ─────────────────────────────────
 * Compact, reusable card. Drop it into Dashboard or any other page:
 *   <SleepTracker />
 *
 * Quick-log form → POST /api/sleep/log
 * Mini bar chart of the last 7 calendar days → GET /api/sleep/week
 *
 * The backend only returns days that actually have a log entry, so this
 * component builds a fixed 7-slot grid (today + 6 prior days) and maps
 * returned logs onto the matching day — missing days render as empty
 * placeholder bars rather than shifting the chart out of alignment.
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import './SleepTracker.css';

const QUALITY_OPTIONS = ['Poor', 'Average', 'Good', 'Great'];

/* Tallest realistic bar reference — used to scale bar heights */
const MAX_SCALE_HOURS = 10;

/* ── Build a fixed-length array of the last 7 days (oldest → newest) ─────── */
const buildLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const dayLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);

/* ── Component ────────────────────────────────────────────────────────────── */
const SleepTracker = () => {
  const [hoursSlept, setHoursSlept] = useState('');
  const [quality,    setQuality]    = useState('');

  const [weekLogs,  setWeekLogs]  = useState([]); // raw logs from backend
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  /* ── Fetch last 7 days on mount ───────────────────────────────────────────── */
  const loadWeek = useCallback(async () => {
    try {
      const res = await api.get('/sleep/week');
      setWeekLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load sleep week:', err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  /* ── Map logs onto a fixed 7-day grid ─────────────────────────────────────── */
  const last7Days = buildLast7Days();
  const chartData = last7Days.map((day) => {
    const match = weekLogs.find((log) => isSameDay(new Date(log.date), day));
    return {
      date:  day,
      hours: match ? match.hoursSlept : null,
    };
  });

  const loggedHours = chartData.filter((d) => d.hours !== null).map((d) => d.hours);
  const avgHours = loggedHours.length
    ? Math.round((loggedHours.reduce((s, h) => s + h, 0) / loggedHours.length) * 10) / 10
    : null;

  /* ── Submit quick-log form ─────────────────────────────────────────────────── */
  const handleLog = async () => {
    if (!hoursSlept || hoursSlept === '') {
      setError('Enter hours slept');
      return;
    }
    if (!quality) {
      setError('Select sleep quality');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.post('/sleep/log', {
        hoursSlept: Number(hoursSlept),
        quality,
      });
      setHoursSlept('');
      setQuality('');
      await loadWeek(); // refresh chart with the new entry
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log sleep. Try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="st-card">

      <h3 className="st-title">Sleep Tracker 😴</h3>

      {/* ── Quick log form ───────────────────────────────────────────────── */}
      <div className="st-log-form">
        {error && <p className="st-error">{error}</p>}

        <div className="st-log-row">
          <div className="st-input-wrap">
            <input
              type="number" inputMode="decimal"
              className="st-input"
              placeholder="Hours"
              min="0" max="24" step="0.5"
              value={hoursSlept}
              onChange={(e) => { setHoursSlept(e.target.value); if (error) setError(''); }}
              aria-label="Hours slept"
            />
            <span className="st-unit">h</span>
          </div>

          <select
            className="st-select"
            value={quality}
            onChange={(e) => { setQuality(e.target.value); if (error) setError(''); }}
            aria-label="Sleep quality"
          >
            <option value="" disabled>Quality…</option>
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>

          <button className="st-log-btn" onClick={handleLog} disabled={saving}>
            {saving ? '…' : 'Log Sleep'}
          </button>
        </div>
      </div>

      {/* ── Mini bar chart ────────────────────────────────────────────────── */}
      <div className="st-chart">
        {loading ? (
          <p className="st-loading">Loading…</p>
        ) : (
          <div className="st-bars">
            {chartData.map(({ date, hours }, i) => {
              const pct = hours !== null
                ? Math.min(100, (hours / MAX_SCALE_HOURS) * 100)
                : 0;
              const isToday = isSameDay(date, new Date());

              return (
                <div key={i} className="st-bar-col">
                  <span className="st-bar-value">
                    {hours !== null ? hours : '–'}
                  </span>
                  <div className="st-bar-track">
                    <div
                      className={`st-bar-fill ${hours === null ? 'st-bar-fill--empty' : ''}`}
                      style={{ height: hours !== null ? `${pct}%` : '4px' }}
                    />
                  </div>
                  <span className={`st-bar-label ${isToday ? 'st-bar-label--today' : ''}`}>
                    {dayLabel(date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Weekly average ───────────────────────────────────────────────── */}
      <p className="st-average">
        {avgHours !== null
          ? <>Avg this week: <strong>{avgHours}h</strong> ({loggedHours.length}/7 days logged)</>
          : 'No sleep logged yet this week'
        }
      </p>

    </div>
  );
};

export default SleepTracker;
