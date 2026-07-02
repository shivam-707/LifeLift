/**
 * PeakMode — Food Advisor
 * ────────────────────────
 * Form → POST /api/food/recommend → structured recommendation card.
 *
 * Recommendation card parses the fixed format returned by the backend:
 *   RECOMMENDATION: ...
 *   SOURCE: ...
 *   COST: ₹...
 *   PROTEIN: ...g
 *   REASON: ...
 *   TIP: ...
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import api from '../utils/api';
import './FoodAdvisor.css';

/* ── Static form data ─────────────────────────────────────────────────────── */
const TIME_OPTIONS = [
  { value: 'breakfast',    label: '☀️  Morning / Breakfast' },
  { value: 'pre-workout',  label: '⚡  Pre-Workout' },
  { value: 'post-workout', label: '💪  Post-Workout' },
  { value: 'lunch',        label: '🍽️  Lunch' },
  { value: 'snack',        label: '🍎  Evening Snack' },
  { value: 'dinner',       label: '🌙  Dinner' },
  { value: 'late-night',   label: '🌛  Late Night' },
];

const HUNGER_OPTIONS = [
  { value: 'low',    emoji: '🌱', label: 'Light',       desc: 'Just a little something' },
  { value: 'medium', emoji: '🔥', label: 'Moderate',    desc: 'A proper meal' },
  { value: 'high',   emoji: '🐘', label: 'Very Hungry', desc: 'Feed me now' },
];

const MESS_QUALITY_OPTIONS = [
  { value: 'good',    label: 'Good — eating from mess' },
  { value: 'average', label: 'Average — maybe supplement' },
  { value: 'bad',     label: 'Very Oily — ordering outside' },
  { value: 'skip',    label: 'Skip It — definitely ordering' },
];

/* ── Source badge colour map ──────────────────────────────────────────────── */
const SOURCE_CLASS = {
  Self:    'badge--green',
  Mess:    'badge--green',
  Canteen: 'badge--blue',
  Blinkit: 'badge--orange',
  Dominos: 'badge--red',
  KFC:     'badge--red',
  Dhaba:   'badge--red',
  Swiggy:  'badge--red',
  Local:   'badge--red',
};

/* ── Parse Claude's structured response ──────────────────────────────────── */
const parseRecommendation = (text) => {
  const get = (key) => {
    const match = text.match(new RegExp(`${key}:\\s*(.+)`, 'i'));
    return match ? match[1].trim() : '';
  };

  // REASON may span multiple lines — grab everything between REASON: and TIP:
  const reasonMatch = text.match(/REASON:\s*([\s\S]*?)(?=TIP:|$)/i);
  const reason = reasonMatch ? reasonMatch[1].trim() : '';

  return {
    name:    get('RECOMMENDATION'),
    source:  get('SOURCE'),
    cost:    get('COST').replace('₹', '').trim(),
    protein: get('PROTEIN').replace(/g.*/i, '').trim(),
    reason,
    tip:     get('TIP'),
  };
};

/* ── Component ────────────────────────────────────────────────────────────── */
const FoodAdvisor = () => {
  const navigate      = useNavigate();
  const { user, logout } = useAuth();

  const [form, setForm] = useState({
    timeOfDay:        '',
    hungerLevel:      '',
    budgetRemaining:  '',
    proteinRemaining: '',
    messAvailable:    true,
    messQualityToday: 'average',
  });

  const [loading, setLoading]     = useState(false);
  const [error,   setError]       = useState('');
  const [result,  setResult]      = useState(null); // parsed recommendation
  const [raw,     setRaw]         = useState('');   // raw text for fallback


  const getAutoTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11)  return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 19) return 'snack';
    if (hour >= 19 && hour < 22) return 'dinner';
    return 'late-night';
  };

  /* ── Pre-fill from saved profile + system clock on mount ─────────────────── */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        const p = res.data.profile || {};
        setForm((prev) => ({
          ...prev,
          timeOfDay:        getAutoTimeOfDay(),
          budgetRemaining:  p.dailyBudget  != null ? String(p.dailyBudget)  : prev.budgetRemaining,
          proteinRemaining: p.proteinTarget != null ? String(p.proteinTarget) : prev.proteinRemaining,
        }));
      } catch {
        setForm((prev) => ({
          ...prev,
          timeOfDay: getAutoTimeOfDay(),
        }));
      }
    };
    loadProfile();
  }, []); // run once on mount

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (error) setError('');
  };

  /* ── Validation ─────────────────────────────────────────────────────────── */
  const validate = () => {
    if (!form.timeOfDay)    return 'Please select time of day';
    if (!form.hungerLevel)  return 'Please select your hunger level';
    if (form.budgetRemaining  === '') return 'Please enter your remaining budget';
    if (form.proteinRemaining === '') return 'Please enter protein remaining';
    return null;
  };

  /* ── Submit ─────────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    setResult(null);
    setRaw('');

    try {
      const res = await api.post('/food/recommend', {
        timeOfDay:        form.timeOfDay,
        hungerLevel:      form.hungerLevel,
        budgetRemaining:  Number(form.budgetRemaining),
        proteinRemaining: Number(form.proteinRemaining),
        messAvailable:    form.messAvailable,
        messQualityToday: form.messQualityToday,
      });

      const text = res.data.recommendation;
      setRaw(text);
      setResult(parseRecommendation(text));
    } catch (e) {
      setError("Couldn't get recommendation. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── "Ask AI for alternatives" → Chat with pre-filled message ───────────── */
  const askForAlternatives = () => {
    const prefillMessage = result
      ? `Suggest alternatives to ${result.name} within ₹${form.budgetRemaining} with at least ${form.proteinRemaining}g protein`
      : `Suggest food options within ₹${form.budgetRemaining} with at least ${form.proteinRemaining}g protein`;

    navigate('/chat', { state: { prefillMessage } });
  };

  /* ── Source badge helper ─────────────────────────────────────────────────── */
  const sourceBadgeClass = (source) => {
    const key = Object.keys(SOURCE_CLASS).find(
      (k) => source?.toLowerCase().includes(k.toLowerCase())
    );
    return SOURCE_CLASS[key] || 'badge--blue';
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
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

        <main className="fa-page">

          {/* ── Page header ──────────────────────────────────────── */}
          <div className="fa-header">
            <h1 className="fa-title">What Should I Eat?</h1>
            <p className="fa-subtitle">Tell me your situation right now</p>
          </div>

          {/* ── Form ─────────────────────────────────────────────── */}
          <div className="fa-form">

            {/* Error */}
            {error && (
              <div className="fa-error" role="alert">
                <span aria-hidden="true">⚠</span> {error}
              </div>
            )}

            {/* 1. Time of day */}
            <div className="fa-field">
              <label className="fa-label" htmlFor="fa-time">Time of day</label>
              <div className="fa-select-wrap">
                <select
                  id="fa-time"
                  className="fa-select"
                  value={form.timeOfDay}
                  onChange={(e) => set('timeOfDay', e.target.value)}
                >
                  <option value="" disabled>Select meal time…</option>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="fa-select-arrow" aria-hidden="true">▾</span>
              </div>
            </div>

            {/* 2. Hunger level — clickable cards */}
            <div className="fa-field">
              <label className="fa-label">Hunger level</label>
              <div className="fa-hunger-grid">
                {HUNGER_OPTIONS.map((o) => (
                  <button
                    key={o.value} type="button"
                    className={`fa-hunger-card ${form.hungerLevel === o.value ? 'fa-hunger-card--active' : ''}`}
                    onClick={() => set('hungerLevel', o.value)}
                    aria-pressed={form.hungerLevel === o.value}
                  >
                    <span className="fa-hunger-card__emoji">{o.emoji}</span>
                    <span className="fa-hunger-card__label">{o.label}</span>
                    <span className="fa-hunger-card__desc">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3 & 4. Budget + Protein — side by side */}
            <div className="fa-row">
              <div className="fa-field">
                <label className="fa-label" htmlFor="fa-budget">Budget remaining today</label>
                <div className="fa-input-wrap">
                  <span className="fa-unit fa-unit--prefix">₹</span>
                  <input
                    id="fa-budget" type="number" inputMode="numeric"
                    className="fa-input fa-input--prefixed"
                    placeholder="e.g. 150" min="0"
                    value={form.budgetRemaining}
                    onChange={(e) => set('budgetRemaining', e.target.value)}
                  />
                </div>
              </div>

              <div className="fa-field">
                <label className="fa-label" htmlFor="fa-protein">Protein remaining</label>
                <div className="fa-input-wrap">
                  <input
                    id="fa-protein" type="number" inputMode="numeric"
                    className="fa-input"
                    placeholder="e.g. 60" min="0"
                    value={form.proteinRemaining}
                    onChange={(e) => set('proteinRemaining', e.target.value)}
                  />
                  <span className="fa-unit">g</span>
                </div>
              </div>
            </div>

            {/* 5. Mess open toggle */}
            <div className="fa-field">
              <label className="fa-label">Is mess open right now?</label>
              <div className="fa-toggle-row">
                <button
                  type="button"
                  className={`fa-toggle-btn ${form.messAvailable ? 'fa-toggle-btn--active' : ''}`}
                  onClick={() => set('messAvailable', true)}
                  aria-pressed={form.messAvailable}
                >
                  ✅ Yes, it's open
                </button>
                <button
                  type="button"
                  className={`fa-toggle-btn ${!form.messAvailable ? 'fa-toggle-btn--active fa-toggle-btn--no' : ''}`}
                  onClick={() => set('messAvailable', false)}
                  aria-pressed={!form.messAvailable}
                >
                  ❌ No, it's closed
                </button>
              </div>
            </div>

            {/* 6. Mess quality — shown only when mess is open */}
            {form.messAvailable && (
              <div className="fa-field fa-field--indent">
                <label className="fa-label" htmlFor="fa-quality">Mess quality today</label>
                <div className="fa-select-wrap">
                  <select
                    id="fa-quality"
                    className="fa-select"
                    value={form.messQualityToday}
                    onChange={(e) => set('messQualityToday', e.target.value)}
                  >
                    {MESS_QUALITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="fa-select-arrow" aria-hidden="true">▾</span>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              className="fa-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <><span className="fa-spinner" aria-hidden="true" /> Finding best meal... 🍽️</>
                : 'Find My Meal →'
              }
            </button>
          </div>

          {/* ── Recommendation card ──────────────────────────────── */}
          {result && (
            <div className="fa-result" role="region" aria-label="Recommendation">

              <p className="fa-result__eyebrow">AI Recommendation</p>

              {/* Food name */}
              <h2 className="fa-result__name">
                🍽️ {result.name || raw.split('\n')[0]}
              </h2>

              {/* Badges row */}
              <div className="fa-result__badges">
                {result.source && (
                  <span className={`fa-badge ${sourceBadgeClass(result.source)}`}>
                    📍 {result.source}
                  </span>
                )}
                {result.cost && (
                  <span className="fa-badge badge--cost">
                    💰 ₹{result.cost}
                  </span>
                )}
                {result.protein && (
                  <span className="fa-badge badge--protein">
                    🥩 {result.protein}g protein
                  </span>
                )}
              </div>

              {/* Reason */}
              {result.reason && (
                <p className="fa-result__reason">{result.reason}</p>
              )}

              {/* Tip */}
              {result.tip && (
                <div className="fa-result__tip">
                  <span className="fa-result__tip-icon" aria-hidden="true">💡</span>
                  <p>{result.tip}</p>
                </div>
              )}

              {/* Fallback — show raw if parsing got nothing */}
              {!result.name && raw && (
                <pre className="fa-result__raw">{raw}</pre>
              )}

              {/* Ask for alternatives */}
              <button className="fa-alt-btn" onClick={askForAlternatives}>
                🤖 Ask AI for alternatives
              </button>

            </div>
          )}

        </main>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default FoodAdvisor;