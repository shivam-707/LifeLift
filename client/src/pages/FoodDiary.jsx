/**
 * PeakMode — Food Diary
 * ──────────────────────
 * Logs what you ate today. For each entry, the AI estimates calories
 * and protein. Running totals are shown as animated ring progress
 * indicators compared to your profile targets.
 *
 * Routes used:
 *   POST   /api/food-diary/log    → add entry (AI estimates macros)
 *   GET    /api/food-diary/today  → load today's entries + totals
 *   DELETE /api/food-diary/:id    → remove an entry
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import api from '../utils/api';
import './FoodDiary.css';

/* ── Meal tag options ─────────────────────────────────────────────────────── */
const MEAL_OPTIONS = [
  { value: 'breakfast',    label: '☀️  Breakfast'     },
  { value: 'lunch',        label: '🍽️  Lunch'         },
  { value: 'dinner',       label: '🌙  Dinner'        },
  { value: 'snack',        label: '🍎  Snack'         },
  { value: 'pre-workout',  label: '⚡  Pre-Workout'   },
  { value: 'post-workout', label: '💪  Post-Workout'  },
  { value: 'other',        label: '🍴  Other'         },
];

const MEAL_EMOJI = {
  breakfast:    '☀️',
  lunch:        '🍽️',
  dinner:       '🌙',
  snack:        '🍎',
  'pre-workout':  '⚡',
  'post-workout': '💪',
  other:        '🍴',
};

/* ── SVG Ring component ───────────────────────────────────────────────────── */
const Ring = ({ pct, color, size = 110, stroke = 10 }) => {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1) * circ;

  return (
    <svg width={size} height={size} className="fd-ring__svg" aria-hidden="true">
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
      />
      {/* Fill */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
};

/* ── Component ────────────────────────────────────────────────────────────── */
const FoodDiary = () => {
  const { user, logout } = useAuth();

  /* targets from profile */
  const calorieTarget = user?.profile?.calorieTarget || 2000;
  const proteinTarget = user?.profile?.proteinTarget || 150;

  /* today's log state */
  const [entries,        setEntries]        = useState([]);
  const [totalCalories,  setTotalCalories]  = useState(0);
  const [totalProtein,   setTotalProtein]   = useState(0);
  const [loadingDiary,   setLoadingDiary]   = useState(true);

  /* add-entry form state */
  const [food,     setFood]     = useState('');
  const [quantity, setQuantity] = useState('');
  const [meal,     setMeal]     = useState('other');
  const [adding,   setAdding]   = useState(false);
  const [addError, setAddError] = useState('');

  /* per-entry delete state */
  const [deletingId, setDeletingId] = useState(null);

  /* ── Load today's diary on mount ──────────────────────────────────────── */
  const loadDiary = useCallback(async () => {
    try {
      const res = await api.get('/food-diary/today');
      setEntries(res.data.entries       || []);
      setTotalCalories(res.data.totalCalories || 0);
      setTotalProtein(res.data.totalProtein   || 0);
    } catch (err) {
      console.error('Failed to load food diary:', err.message);
    } finally {
      setLoadingDiary(false);
    }
  }, []);

  useEffect(() => { loadDiary(); }, [loadDiary]);

  /* ── Add entry ────────────────────────────────────────────────────────── */
  const handleAdd = async () => {
    if (!food.trim())     { setAddError('Enter a food name');   return; }
    if (!quantity.trim()) { setAddError('Enter a quantity');     return; }

    setAdding(true);
    setAddError('');

    try {
      const res = await api.post('/food-diary/log', {
        food:     food.trim(),
        quantity: quantity.trim(),
        meal,
      });

      const entry = res.data.entry;
      setEntries(prev => [...prev, entry]);
      setTotalCalories(prev => prev + entry.calories);
      setTotalProtein(prev  => prev + entry.protein);

      /* reset form */
      setFood('');
      setQuantity('');
      setMeal('other');
    } catch (err) {
      setAddError(err.response?.data?.message || "Couldn't log that food. Try again.");
    } finally {
      setAdding(false);
    }
  };

  /* ── Delete entry ─────────────────────────────────────────────────────── */
  const handleDelete = async (id, calories, protein) => {
    setDeletingId(id);
    try {
      await api.delete(`/food-diary/${id}`);
      setEntries(prev => prev.filter(e => e._id !== id));
      setTotalCalories(prev => Math.max(0, prev - calories));
      setTotalProtein(prev  => Math.max(0, prev - protein));
    } catch (err) {
      console.error('Failed to delete entry:', err.message);
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Derived progress values ──────────────────────────────────────────── */
  const calPct     = calorieTarget > 0 ? (totalCalories / calorieTarget) * 100 : 0;
  const proteinPct = proteinTarget > 0 ? (totalProtein  / proteinTarget) * 100  : 0;

  const calOver     = totalCalories > calorieTarget;
  const proteinOver = totalProtein  > proteinTarget;

  /* today's date label */
  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  /* ── Render ───────────────────────────────────────────────────────────── */
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

          <main className="fd-page">

            {/* ── Page header ─────────────────────────────────────────── */}
            <div className="fd-header">
              <div>
                <h1 className="fd-title">Food Diary 📓</h1>
                <p className="fd-subtitle">Track your nutrition intake for {dateLabel}</p>
              </div>
            </div>

            {/* ── Macro rings ─────────────────────────────────────────── */}
            <div className="fd-rings">

              <div className="fd-ring-card">
                <div className="fd-ring">
                  <Ring pct={calPct} color={calOver ? '#F87171' : '#F97316'} />
                  <div className="fd-ring__center">
                    <span className="fd-ring__val">{totalCalories}</span>
                    <span className="fd-ring__unit">kcal</span>
                  </div>
                </div>
                <p className="fd-ring__label">🔥 Calories</p>
                <p className={`fd-ring__sub ${calOver ? 'fd-ring__sub--over' : ''}`}>
                  {calOver
                    ? `${totalCalories - calorieTarget} over target`
                    : `${calorieTarget - totalCalories} remaining`
                  }
                </p>
                <p className="fd-ring__target">Target: {calorieTarget} kcal</p>
              </div>

              <div className="fd-ring-card">
                <div className="fd-ring">
                  <Ring pct={proteinPct} color={proteinOver ? '#4ADE80' : '#3B82F6'} />
                  <div className="fd-ring__center">
                    <span className="fd-ring__val">{totalProtein}</span>
                    <span className="fd-ring__unit">g</span>
                  </div>
                </div>
                <p className="fd-ring__label">🥩 Protein</p>
                <p className={`fd-ring__sub ${proteinOver ? 'fd-ring__sub--good' : ''}`}>
                  {proteinOver
                    ? `${totalProtein - proteinTarget}g over — great work!`
                    : `${proteinTarget - totalProtein}g to go`
                  }
                </p>
                <p className="fd-ring__target">Target: {proteinTarget} g</p>
              </div>

            </div>

            {/* ── Add food form ────────────────────────────────────────── */}
            <div className="fd-add-card">
              <h2 className="fd-add-card__title">Log a meal</h2>

              {addError && (
                <div className="fd-error" role="alert">
                  <span aria-hidden="true">⚠</span> {addError}
                </div>
              )}

              <div className="fd-add-row">
                <input
                  id="fd-food"
                  className="fd-input fd-input--food"
                  type="text"
                  placeholder="What did you eat? (e.g. dal rice, paneer, eggs)"
                  value={food}
                  onChange={e => { setFood(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  disabled={adding}
                  autoComplete="off"
                />
                <input
                  id="fd-qty"
                  className="fd-input fd-input--qty"
                  type="text"
                  placeholder="Quantity (e.g. 1 plate, 200g)"
                  value={quantity}
                  onChange={e => { setQuantity(e.target.value); setAddError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  disabled={adding}
                  autoComplete="off"
                />
              </div>

              <div className="fd-add-bottom">
                <div className="fd-select-wrap">
                  <select
                    id="fd-meal"
                    className="fd-select"
                    value={meal}
                    onChange={e => setMeal(e.target.value)}
                    disabled={adding}
                  >
                    {MEAL_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="fd-select-arrow" aria-hidden="true">▾</span>
                </div>

                <button
                  className="fd-add-btn"
                  onClick={handleAdd}
                  disabled={adding}
                >
                  {adding
                    ? <><span className="fd-spinner" aria-hidden="true" /> Estimating macros…</>
                    : '+ Log Food'
                  }
                </button>
              </div>

              {adding && (
                <p className="fd-ai-note">
                  🤖 AI is estimating calories &amp; protein for your entry…
                </p>
              )}
            </div>

            {/* ── Today's log list ─────────────────────────────────────── */}
            <div className="fd-log">
              <h2 className="fd-log__title">Today's log</h2>

              {loadingDiary ? (
                <div className="fd-loading">
                  <div className="fd-spinner fd-spinner--lg" aria-label="Loading diary…" />
                  <p>Loading your diary…</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="fd-empty">
                  <span className="fd-empty__icon" aria-hidden="true">🍽️</span>
                  <p className="fd-empty__title">Nothing logged yet</p>
                  <p className="fd-empty__sub">Add your first meal above to start tracking.</p>
                </div>
              ) : (
                <div className="fd-entries">
                  {entries.map(entry => (
                    <div key={entry._id} className="fd-entry">
                      <span className="fd-entry__emoji" aria-hidden="true">
                        {MEAL_EMOJI[entry.meal] || '🍴'}
                      </span>
                      <div className="fd-entry__info">
                        <span className="fd-entry__food">{entry.food}</span>
                        <span className="fd-entry__qty">{entry.quantity}</span>
                      </div>
                      <div className="fd-entry__macros">
                        <span className="fd-entry__cal">🔥 {entry.calories} kcal</span>
                        <span className="fd-entry__prot">🥩 {entry.protein}g</span>
                      </div>
                      <button
                        className="fd-entry__del"
                        onClick={() => handleDelete(entry._id, entry.calories, entry.protein)}
                        disabled={deletingId === entry._id}
                        aria-label={`Remove ${entry.food}`}
                      >
                        {deletingId === entry._id ? '…' : '×'}
                      </button>
                    </div>
                  ))}

                  {/* Totals row */}
                  <div className="fd-totals">
                    <span className="fd-totals__label">Total today</span>
                    <div className="fd-totals__values">
                      <span className="fd-totals__cal">🔥 {totalCalories} kcal</span>
                      <span className="fd-totals__prot">🥩 {totalProtein}g protein</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FoodDiary;
