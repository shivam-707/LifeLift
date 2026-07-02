/**
 * PeakMode — Profile Setup
 * ─────────────────────────
 * 3-step onboarding wizard, shown after registration so the user fills
 * in the stats every other feature (Workout Planner, Schedule, Food
 * Advisor) depends on.
 *
 * Step 1 — Body stats    : age, weight, height
 * Step 2 — Goals         : fitnessGoal, proteinTarget, dailyBudget
 * Step 3 — Schedule      : gymDaysPerWeek
 *
 * On final submit → PUT /api/user/profile → redirect to /dashboard.
 *
 * Field names match the backend exactly:
 *   age, weight, height, fitnessGoal, proteinTarget, dailyBudget, gymDaysPerWeek
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './ProfileSetup.css';

/* ── Static data ──────────────────────────────────────────────────────────── */
const FITNESS_GOALS = [
  { value: 'muscle_gain', label: 'Muscle Gain', emoji: '💪', desc: 'Build size and strength'   },
  { value: 'fat_loss',    label: 'Fat Loss',    emoji: '🔥', desc: 'Lean out, stay strong'     },
  { value: 'maintenance', label: 'Maintain',    emoji: '⚖️', desc: 'Keep what you have'        },
  { value: 'strength',    label: 'Strength',    emoji: '🏋️', desc: 'Max lifts, power focus'   },
  { value: 'endurance',   label: 'Endurance',   emoji: '🏃', desc: 'Stamina and conditioning' },
];

const GYM_DAYS = [3, 4, 5, 6, 7];

const STEPS = [
  { number: 1, label: 'Body'     },
  { number: 2, label: 'Goals'    },
  { number: 3, label: 'Schedule' },
];

/* ── Per-step validation ──────────────────────────────────────────────────── */
const validate = (step, f) => {
  if (step === 1) {
    if (!f.age    || f.age    < 10  || f.age    > 100) return 'Enter a valid age (10–100)';
    if (!f.weight || f.weight < 20  || f.weight > 300) return 'Enter a valid weight (20–300 kg)';
    if (!f.height || f.height < 100 || f.height > 250) return 'Enter a valid height (100–250 cm)';
  }
  if (step === 2) {
    if (!f.fitnessGoal) return 'Select a fitness goal';
    if (!f.proteinTarget || f.proteinTarget < 10 || f.proteinTarget > 500)
      return 'Enter a daily protein target (10–500 g)';
    if (!f.calorieTarget || f.calorieTarget < 500 || f.calorieTarget > 6000)
      return 'Enter a daily calorie target (500–6000 kcal)';
    if (f.dailyBudget === '' || f.dailyBudget === null || f.dailyBudget === undefined || Number(f.dailyBudget) < 0)
      return 'Enter a valid daily food budget (₹0 or more)';
  }
  if (step === 3) {
    if (!f.gymDaysPerWeek) return 'Select how many days per week you train';
  }
  return null;
};

/* ── Schedule hints (shown on step 3 after picking a day count) ────────────── */
const SCHEDULE_HINTS = {
  3: '3 days → Push / Pull / Legs or Full Body. Perfect for a heavy academic load.',
  4: '4 days → Upper / Lower split. Great balance between gym and study.',
  5: "5 days → PPL + 2 extras or Bro split. You're committed — we'll plan recovery carefully.",
  6: '6 days → Push / Pull / Legs ×2. High volume — sleep and protein are non-negotiable.',
  7: '7 days → Make sure at least one session is active recovery. Rest is when you grow.',
};

/* ── Component ─────────────────────────────────────────────────────────────── */
const ProfileSetup = ({ editMode = false }) => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [step,      setStep]      = useState(1);
  const [direction, setDirection] = useState('forward');
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [prefilling, setPrefilling] = useState(editMode); // loading state for pre-fill

  const [fields, setFields] = useState({
    age:            '',
    weight:         '',
    height:         '',
    fitnessGoal:    '',
    proteinTarget:  '',
    calorieTarget:  '',
    dailyBudget:    '',
    gymDaysPerWeek: null,
  });

  /* ── In edit mode, pre-fill from saved profile ────────────────────── */
  useEffect(() => {
    if (!editMode) return;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        const p = res.data.profile || {};
        setFields({
          age:            p.age            != null ? String(p.age)           : '',
          weight:         p.weight         != null ? String(p.weight)        : '',
          height:         p.height         != null ? String(p.height)        : '',
          fitnessGoal:    p.fitnessGoal    || '',
          proteinTarget:  p.proteinTarget  != null ? String(p.proteinTarget) : '',
          calorieTarget:  p.calorieTarget  != null ? String(p.calorieTarget) : '',
          dailyBudget:    p.dailyBudget    != null ? String(p.dailyBudget)   : '',
          gymDaysPerWeek: p.gymDaysPerWeek || null,
        });
      } catch (e) {
        console.error('Failed to load profile for editing:', e.message);
      } finally {
        setPrefilling(false);
      }
    };
    fetchProfile();
  }, [editMode]);

  /* ── Field updater ──────────────────────────────────────────────────────── */
  const set = (key, val) => {
    setFields((prev) => ({ ...prev, [key]: val }));
    if (error) setError('');
  };

  /* ── Step navigation ────────────────────────────────────────────────────── */
  const goNext = () => {
    const err = validate(step, fields);
    if (err) { setError(err); return; }
    setDirection('forward');
    setError('');
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection('back');
    setError('');
    setStep((s) => s - 1);
  };

  /* ── Submit ─────────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    const err = validate(3, fields);
    if (err) { setError(err); return; }

    setSaving(true);
    setError('');

    try {
      await api.put('/user/profile', {
        age:            Number(fields.age),
        weight:         Number(fields.weight),
        height:         Number(fields.height),
        fitnessGoal:    fields.fitnessGoal,
        proteinTarget:  Number(fields.proteinTarget),
        calorieTarget:  Number(fields.calorieTarget),
        dailyBudget:    Number(fields.dailyBudget),
        gymDaysPerWeek: fields.gymDaysPerWeek,
      });
      // Re-fetch the user so isProfileComplete is updated in AuthContext
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save profile. Please try again.');
      setSaving(false);
    }
  };

  /* ── Live BMI (step 1) ──────────────────────────────────────────────────── */
  const bmi = fields.weight && fields.height
    ? (Number(fields.weight) / Math.pow(Number(fields.height) / 100, 2)).toFixed(1)
    : null;

  const bmiLabel = bmi
    ? bmi < 18.5 ? 'Underweight'
    : bmi < 25   ? 'Healthy weight'
    : bmi < 30   ? 'Overweight'
    :               'Obese'
    : null;

  const bmiClass = bmi
    ? bmi < 18.5 ? 'under'
    : bmi < 25   ? 'healthy'
    : bmi < 30   ? 'over'
    :               'obese'
    : '';

  /* ── Render ─────────────────────────────────────────────────────────────── */
  if (prefilling) {
    return (
      <div className="ps-page">
        <div className="spinner-overlay">
          <div className="spinner" aria-label="Loading profile…" />
          <p className="spinner-text">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-page">
      <div className="ps-orb ps-orb--blue"  aria-hidden="true" />
      <div className="ps-orb ps-orb--green" aria-hidden="true" />

      <div className="ps-shell">

        {/* Header */}
        <div className="ps-header">
          <div className="ps-brand">⚡ LifeLift</div>
          <h1 className="ps-title">{editMode ? 'Edit your profile' : 'Set up your profile'}</h1>
          <p className="ps-subtitle">
            {editMode
              ? `Hey ${user?.username} — update your stats below.`
              : `Hey ${user?.username} — give us your stats so we can personalise everything.`
            }
          </p>
        </div>

        {/* Progress stepper */}
        <div className="ps-stepper" role="list" aria-label="Setup steps">
          {STEPS.map(({ number, label }, i) => (
            <React.Fragment key={number}>
              <div
                className={[
                  'ps-step',
                  step === number ? 'ps-step--active' : '',
                  step >  number ? 'ps-step--done'   : '',
                ].join(' ')}
                role="listitem"
                aria-current={step === number ? 'step' : undefined}
              >
                <div className="ps-step__dot">
                  {step > number
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="3.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    : number
                  }
                </div>
                <span className="ps-step__label">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`ps-step__connector ${step > number ? 'ps-step__connector--done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card — key=step forces remount so CSS animation fires on each step */}
        <div className={`ps-card ps-card--${direction}`} key={`step-${step}`}>

          {error && (
            <div className="ps-error" role="alert">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}

          {/* ── STEP 1: Body stats ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="ps-fields">
              <div className="ps-card-heading">
                <span className="ps-card-heading__icon">🧍</span>
                <div>
                  <h2 className="ps-card-heading__title">Body stats</h2>
                  <p className="ps-card-heading__desc">
                    Used to calculate your calorie and protein needs.
                  </p>
                </div>
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-age">Age</label>
                <div className="ps-input-wrap">
                  <input
                    id="ps-age" type="number" inputMode="numeric"
                    className="ps-input" placeholder="e.g. 20"
                    min="10" max="100"
                    value={fields.age}
                    onChange={(e) => set('age', e.target.value)}
                    autoFocus
                  />
                  <span className="ps-unit">yrs</span>
                </div>
              </div>

              <div className="ps-row">
                <div className="ps-field">
                  <label className="ps-label" htmlFor="ps-weight">Weight</label>
                  <div className="ps-input-wrap">
                    <input
                      id="ps-weight" type="number" inputMode="decimal"
                      className="ps-input" placeholder="e.g. 70"
                      min="20" max="300" step="0.1"
                      value={fields.weight}
                      onChange={(e) => set('weight', e.target.value)}
                    />
                    <span className="ps-unit">kg</span>
                  </div>
                </div>

                <div className="ps-field">
                  <label className="ps-label" htmlFor="ps-height">Height</label>
                  <div className="ps-input-wrap">
                    <input
                      id="ps-height" type="number" inputMode="numeric"
                      className="ps-input" placeholder="e.g. 175"
                      min="100" max="250"
                      value={fields.height}
                      onChange={(e) => set('height', e.target.value)}
                    />
                    <span className="ps-unit">cm</span>
                  </div>
                </div>
              </div>

              {bmi && (
                <div className={`ps-bmi ps-bmi--${bmiClass}`}>
                  <span className="ps-bmi__label">BMI</span>
                  <span className="ps-bmi__value">{bmi}</span>
                  <span className="ps-bmi__band">{bmiLabel}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Goals ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="ps-fields">
              <div className="ps-card-heading">
                <span className="ps-card-heading__icon">🎯</span>
                <div>
                  <h2 className="ps-card-heading__title">Your goals</h2>
                  <p className="ps-card-heading__desc">
                    Pick your primary gym goal and set your fuel targets.
                  </p>
                </div>
              </div>

              <div className="ps-field">
                <label className="ps-label">Fitness goal</label>
                <div className="ps-goal-grid">
                  {FITNESS_GOALS.map(({ value, label, emoji, desc }) => (
                    <button
                      key={value} type="button"
                      className={`ps-goal-tile ${fields.fitnessGoal === value ? 'ps-goal-tile--active' : ''}`}
                      onClick={() => set('fitnessGoal', value)}
                      aria-pressed={fields.fitnessGoal === value}
                    >
                      <span className="ps-goal-tile__emoji">{emoji}</span>
                      <span className="ps-goal-tile__label">{label}</span>
                      <span className="ps-goal-tile__desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ps-row">
                <div className="ps-field">
                  <label className="ps-label" htmlFor="ps-protein">Daily protein target</label>
                  <div className="ps-input-wrap">
                    <input
                      id="ps-protein" type="number" inputMode="numeric"
                      className="ps-input" placeholder="e.g. 150"
                      min="10" max="500"
                      value={fields.proteinTarget}
                      onChange={(e) => set('proteinTarget', e.target.value)}
                    />
                    <span className="ps-unit">g / day</span>
                  </div>
                  {fields.weight && fields.proteinTarget && (
                    <p className="ps-hint">
                      ≈ {(Number(fields.proteinTarget) / Number(fields.weight)).toFixed(1)} g per kg bodyweight
                    </p>
                  )}
                </div>

                <div className="ps-field">
                  <label className="ps-label" htmlFor="ps-calories">Daily calorie target</label>
                  <div className="ps-input-wrap">
                    <input
                      id="ps-calories" type="number" inputMode="numeric"
                      className="ps-input" placeholder="e.g. 2200"
                      min="500" max="6000"
                      value={fields.calorieTarget}
                      onChange={(e) => set('calorieTarget', e.target.value)}
                    />
                    <span className="ps-unit">kcal</span>
                  </div>
                  <p className="ps-hint">Maintenance ≈ 30–35 × body weight (kg)</p>
                </div>
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="ps-budget">Daily food budget</label>
                <div className="ps-input-wrap">
                  <span className="ps-unit ps-unit--prefix">₹</span>
                  <input
                    id="ps-budget" type="number" inputMode="numeric"
                    className="ps-input ps-input--prefixed" placeholder="e.g. 200"
                    min="0"
                    value={fields.dailyBudget}
                    onChange={(e) => set('dailyBudget', e.target.value)}
                  />
                </div>
                <p className="ps-hint">Total spend on food per day</p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Schedule ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="ps-fields">
              <div className="ps-card-heading">
                <span className="ps-card-heading__icon">📅</span>
                <div>
                  <h2 className="ps-card-heading__title">Training schedule</h2>
                  <p className="ps-card-heading__desc">
                    How many days per week can you hit the gym?
                  </p>
                </div>
              </div>

              <div className="ps-field">
                <label className="ps-label">Gym days per week</label>
                <div className="ps-days">
                  {GYM_DAYS.map((d) => (
                    <button
                      key={d} type="button"
                      className={`ps-day ${fields.gymDaysPerWeek === d ? 'ps-day--active' : ''}`}
                      onClick={() => set('gymDaysPerWeek', d)}
                      aria-pressed={fields.gymDaysPerWeek === d}
                      aria-label={`${d} days per week`}
                    >
                      <span className="ps-day__num">{d}</span>
                      <span className="ps-day__word">day{d !== 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>

                {fields.gymDaysPerWeek && (
                  <p className="ps-schedule-hint">
                    {SCHEDULE_HINTS[fields.gymDaysPerWeek]}
                  </p>
                )}
              </div>

              {/* Confirm summary */}
              <div className="ps-summary">
                <p className="ps-summary__title">Your profile summary</p>
                <dl className="ps-summary__grid">
                  <dt>Age</dt>           <dd>{fields.age} yrs</dd>
                  <dt>Weight</dt>        <dd>{fields.weight} kg</dd>
                  <dt>Height</dt>        <dd>{fields.height} cm</dd>
                  <dt>Goal</dt>          <dd>{FITNESS_GOALS.find((g) => g.value === fields.fitnessGoal)?.label}</dd>
                  <dt>Protein</dt>       <dd>{fields.proteinTarget} g/day</dd>
                  <dt>Calories</dt>      <dd>{fields.calorieTarget} kcal/day</dd>
                  <dt>Budget</dt>        <dd>₹{fields.dailyBudget}/day</dd>
                </dl>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="ps-actions">
            {step > 1
              ? <button className="ps-btn ps-btn--ghost" onClick={goBack} disabled={saving}>← Back</button>
              : editMode
                ? <button className="ps-btn ps-btn--ghost" onClick={() => navigate('/dashboard')} disabled={saving}>✕ Cancel</button>
                : null
            }

            {step < 3
              ? <button className="ps-btn ps-btn--primary" onClick={goNext}>Continue →</button>
              : <button className="ps-btn ps-btn--primary ps-btn--cta" onClick={handleSubmit} disabled={saving}>
                  {saving
                    ? <><span className="ps-spinner" aria-hidden="true" /> Saving…</>
                    : editMode ? '💾 Save changes' : '🚀 Save & go to dashboard'
                  }
                </button>
            }
          </div>

        </div>{/* .ps-card */}

        <p className="ps-footnote">You can update these anytime from your profile settings.</p>

      </div>{/* .ps-shell */}
    </div>
  );
};

export default ProfileSetup;