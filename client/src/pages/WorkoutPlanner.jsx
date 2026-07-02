/**
 * PeakMode — Workout Planner
 * ────────────────────────────
 * Day-count selector → POST /api/workout/generate → split + coaching notes.
 * Each day renders as an expandable card with an exercise table and a
 * "mark completed" action that hits POST /api/workout/log-day.
 *
 * On mount, fetches GET /api/workout/current-week to restore progress
 * (which days are already marked complete this week) without requiring
 * the user to regenerate the split first.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import api from '../utils/api';
import './WorkoutPlanner.css';

const DAY_OPTIONS = [3, 4, 5];

/* ── Static split data (mirrors server/data/workoutSplits.js) ──────────────
   We duplicate just the structure here so the mount effect can instantly
   restore the split without an extra network round-trip to Claude.
   The canonical source of truth for exercises is still the server; this
   is only used for the fast on-load restore path.
──────────────────────────────────────────────────────────────────────── */
const SPLIT_NAMES = {
  3: 'Full Body (3-Day)',
  4: 'Upper / Lower (4-Day)',
  5: 'Bro Split (5-Day)',
};

/* ── Component ────────────────────────────────────────────────────────────── */
const WorkoutPlanner = () => {
  const { user, logout } = useAuth();

  const [selectedDays, setSelectedDays] = useState(null);
  const [split,         setSplit]         = useState(null);   // array of day objects
  const [coachingNotes, setCoachingNotes] = useState('');
  const [completedDays, setCompletedDays] = useState([]);      // array of day numbers
  const [expandedDay,   setExpandedDay]   = useState(null);    // currently expanded day number

  const [generating, setGenerating] = useState(false);
  const [error,       setError]     = useState('');
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [markingDay,  setMarkingDay]  = useState(null); // day number currently being marked
  const [justCompleted, setJustCompleted] = useState(null); // day number to flash checkmark on

  /* ── On mount: check if a split already exists for this week ─────────────
     GET /workout/current-week tells us availableDays + progress, but not
     the actual exercises (that's only returned by /generate). So if a log
     already exists with availableDays set, we re-call /generate with that
     same day count to pull the split back — the user sees it immediately
     without having to pick days and click Generate again.
  ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const loadCurrentWeek = async () => {
      try {
        const res = await api.get('/workout/current-week');
        const log = res.data.log;

        if (log) {
          setCompletedDays(log.completedDayNumbers || []);

          if (log.availableDays) {
            // Restore the day selector to what the user previously chose
            setSelectedDays(log.availableDays);

            // Load the split + coaching notes from the server.
            // We call /generate here rather than a separate read endpoint
            // so the static split and any stored coaching notes are returned
            // together. The server upserts the log (no-op if already saved).
            try {
              const genRes = await api.post('/workout/generate', {
                availableDays: log.availableDays,
                fitnessGoal:   user?.profile?.fitnessGoal || undefined,
                lastWeekSplit: null,
              });
              setSplit(genRes.data.split);
              setCoachingNotes(genRes.data.coachingNotes);
              setExpandedDay(genRes.data.split?.[0]?.day ?? null);
            } catch (genErr) {
              // Non-fatal — user can still click Generate manually
              console.error('Failed to restore split:', genErr.response?.data?.message || genErr.message);
            }
          }
          // If log.availableDays is null the user hasn't generated a split
          // for this week yet — just show the empty selector.
        }
      } catch (err) {
        console.error('Failed to load current week:', err.response?.data?.message || err.message);
      } finally {
        setLoadingWeek(false);
      }
    };
    loadCurrentWeek();
  }, []); // intentionally empty — runs once on mount only

  /* ── Generate split ───────────────────────────────────────────────────────── */
  const handleGenerate = async () => {
    if (!selectedDays) {
      setError('Pick how many days you can train this week first');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const res = await api.post('/workout/generate', {
        availableDays: selectedDays,
        fitnessGoal:   user?.profile?.fitnessGoal || undefined,
        lastWeekSplit: undefined,
      });

      setSplit(res.data.split);
      setCoachingNotes(res.data.coachingNotes);
      setExpandedDay(res.data.split?.[0]?.day ?? null); // auto-expand first day
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to generate your split. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Mark a day completed (optimistic update) ─────────────────────────────
     UI updates instantly — completedDays gains the day number and the
     progress bar moves — before the network call resolves. If the request
     fails, we roll back to the previous completedDays list.
  ─────────────────────────────────────────────────────────────────────── */
  const handleMarkCompleted = useCallback(async (dayNumber) => {
    if (completedDays.includes(dayNumber) || markingDay) return;

    const previousCompleted = completedDays;

    // Optimistic update — happens immediately, before the request resolves
    setCompletedDays((prev) => [...prev, dayNumber]);
    setMarkingDay(dayNumber);
    setJustCompleted(dayNumber); // triggers checkmark pop animation

    try {
      const res = await api.post('/workout/log-day', { dayNumber });
      // Reconcile with the server's authoritative list (in case other
      // days were already logged elsewhere / from another session)
      setCompletedDays(res.data.log.completedDayNumbers || []);
    } catch (err) {
      console.error('Failed to log day:', err.response?.data?.message || err.message);
      // Roll back the optimistic update since the save failed
      setCompletedDays(previousCompleted);
      setJustCompleted(null);
    } finally {
      setMarkingDay(null);
    }
  }, [completedDays, markingDay]);

  /* Clear the "just completed" animation flag after it plays once */
  useEffect(() => {
    if (justCompleted === null) return;
    const timer = setTimeout(() => setJustCompleted(null), 900);
    return () => clearTimeout(timer);
  }, [justCompleted]);

  const toggleExpand = (dayNumber) => {
    setExpandedDay((prev) => (prev === dayNumber ? null : dayNumber));
  };

  const totalDays     = split?.length || selectedDays || 0;
  const completedCount = completedDays.length;
  const progressPct    = totalDays > 0 ? (completedCount / totalDays) * 100 : 0;

  /* ── Render ───────────────────────────────────────────────────────────────── */
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

        <main className="wp-page">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="wp-header">
            <h1 className="wp-title">This Week's Split 💪</h1>
            <p className="wp-subtitle">
              {selectedDays && split
                ? `Currently on: ${SPLIT_NAMES[selectedDays] || `${selectedDays}-Day Split`} — change below if needed`
                : 'How many days can you train this week?'
              }
            </p>
          </div>

          {/* ── Progress bar (only once we know totalDays) ───────── */}
          {totalDays > 0 && (
            <div className="wp-progress">
              <div className="wp-progress__label-row">
                <span className="wp-progress__label">This week's progress</span>
                <span className="wp-progress__count">{completedCount} / {totalDays} days completed</span>
              </div>
              <div className="wp-progress__track">
                <div className="wp-progress__fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {/* ── Day selector cards ────────────────────────────────── */}
          <div className="wp-day-grid">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d} type="button"
                className={`wp-day-card ${selectedDays === d ? 'wp-day-card--active' : ''}`}
                onClick={() => setSelectedDays(d)}
                aria-pressed={selectedDays === d}
              >
                <span className="wp-day-card__num">{d}</span>
                <span className="wp-day-card__label">Days</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="wp-error" role="alert">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}

          {/* ── Generate button ───────────────────────────────────── */}
          <button
            className="wp-generate-btn"
            onClick={handleGenerate}
            disabled={generating || loadingWeek}
          >
            {generating
              ? <><span className="wp-spinner" aria-hidden="true" /> Building your split... 💪</>
              : 'Generate My Split'
            }
          </button>

          {/* ── Coaching notes quote box ──────────────────────────── */}
          {coachingNotes && (
            <div className="wp-coach-box">
              <span className="wp-coach-box__icon" aria-hidden="true">🎯</span>
              <p className="wp-coach-box__text">{coachingNotes}</p>
            </div>
          )}

          {/* ── Workout day cards ─────────────────────────────────── */}
          {split && (
            <div className="wp-days">
              {split.map((day) => {
                const isExpanded  = expandedDay === day.day;
                const isCompleted = completedDays.includes(day.day);
                const isMarking   = markingDay === day.day;

                return (
                  <div
                    key={day.day}
                    className={`wp-day-item ${isCompleted ? 'wp-day-item--completed' : ''}`}
                  >
                    {/* Checkmark burst — plays once when this day is marked done */}
                    {justCompleted === day.day && (
                      <div className="wp-burst" aria-hidden="true">
                        <span className="wp-burst__check">✅</span>
                      </div>
                    )}

                    {/* Header — click to expand/collapse */}
                    <button
                      type="button"
                      className="wp-day-item__header"
                      onClick={() => toggleExpand(day.day)}
                      aria-expanded={isExpanded}
                    >
                      <div className="wp-day-item__heading">
                        <span className="wp-day-item__title">
                          Day {day.day} — {day.name}
                        </span>
                        <div className="wp-day-item__tags">
                          {day.muscleGroups?.map((m) => (
                            <span key={m} className="wp-tag">{m}</span>
                          ))}
                        </div>
                      </div>

                      <div className="wp-day-item__right">
                        {isCompleted && (
                          <span className="wp-completed-badge">✅ Done</span>
                        )}
                        <span className={`wp-chevron ${isExpanded ? 'wp-chevron--open' : ''}`} aria-hidden="true">
                          ▾
                        </span>
                      </div>
                    </button>

                    {/* Expandable body */}
                    <div className={`wp-day-item__body ${isExpanded ? 'wp-day-item__body--open' : ''}`}>
                      <div className="wp-day-item__body-inner">

                        <table className="wp-table">
                          <thead>
                            <tr>
                              <th>Exercise</th>
                              <th>Sets</th>
                              <th>Reps</th>
                              <th>Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {day.exercises?.map((ex, i) => (
                              <tr key={i}>
                                <td className="wp-table__exercise">{ex.name}</td>
                                <td>{ex.sets}</td>
                                <td>{ex.reps}</td>
                                <td className="wp-table__notes">{ex.notes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <button
                          type="button"
                          className={`wp-complete-btn ${isCompleted ? 'wp-complete-btn--done' : ''}`}
                          onClick={() => handleMarkCompleted(day.day)}
                          disabled={isCompleted || isMarking}
                        >
                          {isMarking
                            ? 'Saving…'
                            : isCompleted
                              ? '✅ Completed'
                              : 'Mark as Completed ✅'
                          }
                        </button>

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </main>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default WorkoutPlanner;