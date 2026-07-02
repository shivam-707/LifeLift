/**
 * PeakMode — Schedule Optimizer
 * ───────────────────────────────
 * Form → POST /api/schedule/generate → vertical timeline of time blocks.
 *
 * gymDaysThisWeek is read from the user's saved profile (gymDaysPerWeek)
 * and shown as a read-only badge rather than an editable input, since
 * that's a weekly commitment set during onboarding, not a daily choice.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import api from '../utils/api';
import './Schedule.css';

/* ── Static form data ─────────────────────────────────────────────────────── */
const GYM_TIME_OPTIONS = [
  { value: 'Morning', emoji: '🌅', desc: 'Before college' },
  { value: 'Evening', emoji: '🌇', desc: 'After college' },
  { value: 'Night',   emoji: '🌙', desc: 'Late session' },
];

/* Colour + label mapping for timeline block types */
const TYPE_META = {
  gym:     { color: 'orange', label: 'Gym',     icon: '🏋️' },
  study:   { color: 'blue',   label: 'Study',   icon: '📚' },
  sleep:   { color: 'purple', label: 'Sleep',   icon: '😴' },
  college: { color: 'gray',   label: 'College', icon: '🎓' },
  meal:    { color: 'green',  label: 'Meal',    icon: '🍽️' },
  free:    { color: 'free',   label: 'Free',    icon: '☕' },
  misc:    { color: 'pink',   label: 'Personal', icon: '🎯' },
};

/* ── Helper: parse "X:XX AM/PM - Y:YY AM/PM" into hours duration ──────────── */
const parseTimeToMinutes = (timeStr) => {
  const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)/i);
  if (!match) return null;
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  m = m ? parseInt(m, 10) : 0;
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

const blockDurationHours = (timeRange) => {
  const [start, end] = timeRange.split('-').map((s) => s.trim());
  const startMin = parseTimeToMinutes(start);
  const endMin   = parseTimeToMinutes(end);
  if (startMin === null || endMin === null) return 0;
  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60; // overnight block (e.g. 11 PM - 7 AM)
  return diff / 60;
};

/* Sum hours of all 'sleep' type blocks in the schedule */
const calcSleepHours = (schedule) => {
  if (!Array.isArray(schedule)) return 0;
  const total = schedule
    .filter((b) => b.type === 'sleep')
    .reduce((sum, b) => sum + blockDurationHours(b.time || ''), 0);
  return Math.round(total * 10) / 10;
};

/* ── Component ────────────────────────────────────────────────────────────── */
const Schedule = () => {
  const { user, logout } = useAuth();

  const [form, setForm] = useState({
    collegeHours:        '',
    wakeUpTime:           '07:00',
    sleepTime:            '23:00',
    gymDuration:           75,
    gymStartTime:         '',
    preferredGymTime:     '',
    studyHoursAvailable: '',
    miscHoursAvailable:   1,
    sleepTarget:           7.5,
  });

  const [loading,  setLoading]  = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error,    setError]    = useState('');
  const [schedule, setSchedule] = useState(null);

  // Mode state: 'ai' or 'manual'
  const [activeMode, setActiveMode] = useState('ai');

  // Manual block editor state
  const [manualBlock, setManualBlock] = useState({
    startTime: '08:00',
    endTime: '09:00',
    activity: '',
    type: 'free',
    tip: ''
  });

  // gymDaysPerWeek pulled fresh from the backend on mount, rather than only
  // trusting whatever AuthContext's user object happened to have cached.
  const [gymDaysThisWeek, setGymDaysThisWeek] = useState(user?.profile?.gymDaysPerWeek ?? null);
  const [profileLoading,  setProfileLoading]  = useState(true);

  const [toast, setToast] = useState(''); // "Schedule saved! 🎯" toast message

  const getTodayDateKey = () => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  };

  /* ── Fetch user profile on mount, pre-fill gymDaysThisWeek ───────────────── */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        const days = res.data.profile?.gymDaysPerWeek;
        if (days != null) setGymDaysThisWeek(days);
      } catch (err) {
        console.error('Failed to load profile:', err.response?.data?.message || err.message);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, []);

  /* ── Load saved schedule from Database (fallback to LocalStorage draft) ─── */
  useEffect(() => {
    if (!user) return;

    const loadSavedSchedule = async () => {
      setLoading(true);
      setError('');
      try {
        const dateKey = getTodayDateKey();
        const res = await api.get(`/schedule/day/${dateKey}`);
        
        if (res.data?.schedule) {
          const { form: savedForm, schedule: savedBlocks, isManual } = res.data.schedule;
          if (savedForm) {
            setForm(savedForm);
          }
          setSchedule(savedBlocks || []);
          setActiveMode(isManual ? 'manual' : 'ai');
        } else {
          // Fallback: try loading from localStorage draft
          const suffix = user._id || user.id;
          const draftForm = localStorage.getItem(`schedule_form_${suffix}`);
          const draftSchedule = localStorage.getItem(`schedule_data_${suffix}`);
          
          if (draftForm) setForm(JSON.parse(draftForm));
          if (draftSchedule) setSchedule(JSON.parse(draftSchedule));
        }
      } catch (err) {
        console.error('Failed to load saved schedule from database:', err);
        setError('Failed to sync schedule from database');
      } finally {
        setLoading(false);
      }
    };

    loadSavedSchedule();
  }, [user]);

  /* ── Auto-dismiss the save toast after a couple seconds ──────────────────── */
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (error) setError('');
  };

  /* ── Convert 24hr time input (HH:MM) to "H:MM AM/PM" for the backend ────── */
  const formatWakeTime = (time24) => {
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${mStr} ${period}`;
  };

  /* ── Convert 24hr time input to "H:MM AM/PM" ──────────────────────────── */
  const format24ToAmPm = (time24) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${period}`;
  };

  /* ── Validation ─────────────────────────────────────────────────────────── */
  const validate = () => {
    if (!form.collegeHours.trim())     return 'Please enter your college hours';
    if (!form.wakeUpTime)              return 'Please set your wake up time';
    if (!form.gymDuration)             return 'Please enter gym duration';
    if (!form.preferredGymTime)        return 'Please pick your preferred gym time';
    if (form.studyHoursAvailable === '') return 'Please enter study hours available';
    if (!gymDaysThisWeek)              return 'Set your gym days per week in your profile first';
    return null;
  };

  /* ── Submit AI Optimizer ────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');
    setSchedule(null);

    try {
      const res = await api.post('/schedule/generate', {
        collegeHours:        form.collegeHours.trim(),
        gymDuration:          Number(form.gymDuration),
        gymStartTime:         form.gymStartTime ? format24ToAmPm(form.gymStartTime) : '',
        studyHoursAvailable:  Number(form.studyHoursAvailable),
        miscHoursAvailable:   Number(form.miscHoursAvailable),
        gymDaysThisWeek:      gymDaysThisWeek,
        wakeUpTime:           formatWakeTime(form.wakeUpTime),
        sleepTime:            format24ToAmPm(form.sleepTime),
        sleepTarget:          Number(form.sleepTarget),
        preferredGymTime:     form.preferredGymTime,
      });

      setSchedule(res.data.schedule);
      
      // Persist values to localStorage scoped by user as a draft
      const suffix = user?._id || user?.id;
      if (suffix) {
        const updatedForm = {
          ...form,
          collegeHours: form.collegeHours.trim(),
          gymDuration: Number(form.gymDuration),
          studyHoursAvailable: Number(form.studyHoursAvailable),
          miscHoursAvailable: Number(form.miscHoursAvailable),
          sleepTarget: Number(form.sleepTarget)
        };
        localStorage.setItem(`schedule_form_${suffix}`, JSON.stringify(updatedForm));
        localStorage.setItem(`schedule_data_${suffix}`, JSON.stringify(res.data.schedule));
      }
    } catch (e) {
      setError(e.response?.data?.message || "Couldn't generate schedule. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const actualSleepHours = schedule ? calcSleepHours(schedule) : 0;

  /* ── Chronological Sorting Utility for Blocks ───────────────────────────── */
  const sortScheduleBlocks = (blocks) => {
    return [...blocks].sort((a, b) => {
      const timeA = a.time.split('-')[0].trim();
      const timeB = b.time.split('-')[0].trim();
      const minA = parseTimeToMinutes(timeA) ?? 0;
      const minB = parseTimeToMinutes(timeB) ?? 0;
      return minA - minB;
    });
  };

  /* ── Add Manually Built Block ───────────────────────────────────────────── */
  const handleAddManualBlock = (e) => {
    e.preventDefault();
    const { startTime, endTime, activity, type, tip } = manualBlock;
    if (!activity.trim()) {
      setError('Please enter an activity name');
      return;
    }
    if (!startTime || !endTime) {
      setError('Please select start and end times');
      return;
    }

    // Format start and end times to "H:MM AM/PM"
    const startAmPm = format24ToAmPm(startTime);
    const endAmPm = format24ToAmPm(endTime);
    const timeRangeStr = `${startAmPm} - ${endAmPm}`;

    const newBlock = {
      time: timeRangeStr,
      activity: activity.trim(),
      type: type,
      tip: tip.trim()
    };

    setSchedule((prev) => {
      const currentList = prev || [];
      const updatedList = [...currentList, newBlock];
      return sortScheduleBlocks(updatedList);
    });

    // Reset activity and tip fields in form
    setManualBlock((prev) => ({
      ...prev,
      activity: '',
      tip: ''
    }));
    setError('');
  };

  /* ── Delete Schedule Block ────────────────────────────────────────────── */
  const handleDeleteBlock = (indexToDelete) => {
    setSchedule((prev) => {
      if (!prev) return null;
      return prev.filter((_, idx) => idx !== indexToDelete);
    });
  };

  /* ── Save Schedule to Database Cloud ────────────────────────────────────── */
  const handleSaveSchedule = async () => {
    if (!schedule || schedule.length === 0) {
      setError('Cannot save an empty schedule. Generate or build one first!');
      return;
    }
    setSavingSchedule(true);
    setError('');
    try {
      const dateKey = getTodayDateKey();
      await api.post('/schedule/save', {
        date: dateKey,
        form: form,
        schedule: schedule,
        isManual: activeMode === 'manual'
      });

      // Update draft sync
      const suffix = user?._id || user?.id;
      if (suffix) {
        localStorage.setItem(`schedule_form_${suffix}`, JSON.stringify(form));
        localStorage.setItem(`schedule_data_${suffix}`, JSON.stringify(schedule));
      }

      setToast('Schedule saved successfully! 🎯');
    } catch (err) {
      console.error('Save schedule error:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Failed to save schedule. Try again.');
    } finally {
      setSavingSchedule(false);
    }
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

        <main className="sc-page">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="sc-header">
            <h1 className="sc-title">Optimize My Day ⏰</h1>
            <p className="sc-subtitle">Let's build a schedule that protects your sleep</p>
          </div>

          {/* ── Tabs Selection ────────────────────────────────────── */}
          <div className="sc-tabs">
            <button
              type="button"
              className={`sc-tab ${activeMode === 'ai' ? 'sc-tab--active' : ''}`}
              onClick={() => { setActiveMode('ai'); setError(''); }}
            >
              🤖 AI Auto-Optimize
            </button>
            <button
              type="button"
              className={`sc-tab ${activeMode === 'manual' ? 'sc-tab--active' : ''}`}
              onClick={() => { setActiveMode('manual'); setError(''); }}
            >
              ✍️ Manual Builder
            </button>
          </div>

          {error && (
            <div className="sc-error" role="alert" style={{ marginBottom: '24px' }}>
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}

          {/* ── AI Auto-Optimize Form ────────────────────────────── */}
          {activeMode === 'ai' && (
            <div className="sc-form">
              {/* College hours */}
              <div className="sc-field">
                <label className="sc-label" htmlFor="sc-college">College hours</label>
                <input
                  id="sc-college" type="text"
                  className="sc-text-input"
                  placeholder="9 AM - 3 PM"
                  value={form.collegeHours}
                  onChange={(e) => set('collegeHours', e.target.value)}
                />
              </div>

              <div className="sc-row">
                {/* Wake up time */}
                <div className="sc-field">
                  <label className="sc-label" htmlFor="sc-wake">Wake up time</label>
                  <input
                    id="sc-wake" type="time"
                    className="sc-text-input"
                    value={form.wakeUpTime}
                    onChange={(e) => set('wakeUpTime', e.target.value)}
                  />
                </div>

                {/* Target sleep time */}
                <div className="sc-field">
                  <label className="sc-label" htmlFor="sc-sleeptime">Bedtime (target)</label>
                  <input
                    id="sc-sleeptime" type="time"
                    className="sc-text-input"
                    value={form.sleepTime}
                    onChange={(e) => set('sleepTime', e.target.value)}
                  />
                </div>
              </div>

              <div className="sc-row">
                {/* Gym duration */}
                <div className="sc-field">
                  <label className="sc-label" htmlFor="sc-gymdur">Gym duration</label>
                  <div className="sc-input-wrap">
                    <input
                      id="sc-gymdur" type="number" inputMode="numeric"
                      className="sc-input"
                      placeholder="75" min="15" max="180"
                      value={form.gymDuration}
                      onChange={(e) => set('gymDuration', e.target.value)}
                    />
                    <span className="sc-unit">min</span>
                  </div>
                </div>

                {/* Exact gym start time (optional) */}
                <div className="sc-field">
                  <label className="sc-label" htmlFor="sc-gymstart">
                    Gym start time <span className="sc-optional">(optional)</span>
                  </label>
                  <input
                    id="sc-gymstart" type="time"
                    className="sc-text-input"
                    value={form.gymStartTime}
                    onChange={(e) => set('gymStartTime', e.target.value)}
                  />
                </div>
              </div>

              {/* Preferred gym time cards */}
              <div className="sc-field">
                <label className="sc-label">Preferred gym time</label>
                <div className="sc-gymtime-grid">
                  {GYM_TIME_OPTIONS.map(({ value, emoji, desc }) => (
                    <button
                      key={value} type="button"
                      className={`sc-gymtime-card ${form.preferredGymTime === value ? 'sc-gymtime-card--active' : ''}`}
                      onClick={() => set('preferredGymTime', value)}
                      aria-pressed={form.preferredGymTime === value}
                    >
                      <span className="sc-gymtime-card__emoji">{emoji}</span>
                      <span className="sc-gymtime-card__label">{value}</span>
                      <span className="sc-gymtime-card__desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Study hours available */}
              <div className="sc-field">
                <label className="sc-label" htmlFor="sc-study">Study hours available today</label>
                <div className="sc-input-wrap">
                  <input
                    id="sc-study" type="number" inputMode="decimal"
                    className="sc-input"
                    placeholder="e.g. 3.5" min="0" max="12" step="0.5"
                    value={form.studyHoursAvailable}
                    onChange={(e) => set('studyHoursAvailable', e.target.value)}
                  />
                  <span className="sc-unit">hrs</span>
                </div>
              </div>

              {/* Miscellaneous / personal activities */}
              <div className="sc-field">
                <label className="sc-label" htmlFor="sc-misc">Misc / personal time</label>
                <p className="sc-field-hint">Hobbies, leisure, social — anything that's not studying, gym, or daily essentials</p>
                <div className="sc-input-wrap">
                  <input
                    id="sc-misc" type="number" inputMode="decimal"
                    className="sc-input"
                    placeholder="e.g. 1" min="0" max="6" step="0.5"
                    value={form.miscHoursAvailable}
                    onChange={(e) => set('miscHoursAvailable', e.target.value)}
                  />
                  <span className="sc-unit">hrs</span>
                </div>
              </div>

              {/* Sleep target slider */}
              <div className="sc-field">
                <div className="sc-label-row">
                  <label className="sc-label" htmlFor="sc-sleep">Sleep target</label>
                  <span className="sc-slider-value">{form.sleepTarget}h</span>
                </div>
                <input
                  id="sc-sleep" type="range"
                  className="sc-slider"
                  min="6" max="9" step="0.5"
                  value={form.sleepTarget}
                  onChange={(e) => set('sleepTarget', e.target.value)}
                />
                <div className="sc-slider-scale">
                  <span>6h</span><span>7h</span><span>8h</span><span>9h</span>
                </div>
              </div>

              {/* Gym days this week — read-only badge from profile */}
              <div className="sc-field">
                <label className="sc-label">Gym days this week</label>
                {gymDaysThisWeek
                  ? <div className="sc-readonly-badge">
                      🏋️ {gymDaysThisWeek} day{gymDaysThisWeek !== 1 ? 's' : ''} per week
                      <span className="sc-readonly-badge__hint">from your profile</span>
                    </div>
                  : <div className="sc-readonly-badge sc-readonly-badge--warn">
                      ⚠️ Not set — update your profile first
                    </div>
                }
              </div>

              {/* Submit */}
              <button className="sc-submit" onClick={handleSubmit} disabled={loading || profileLoading}>
                {loading
                  ? <><span className="sc-spinner" aria-hidden="true" /> Building your perfect day... ⏰</>
                  : 'Build My Schedule'
                }
              </button>
            </div>
          )}

          {/* ── Manual Builder Form ──────────────────────────────── */}
          {activeMode === 'manual' && (
            <form className="sc-manual-form" onSubmit={handleAddManualBlock}>
              <h2 className="sc-manual-title">✍️ Add Custom Block</h2>
              
              <div className="sc-row">
                <div className="sc-field">
                  <label className="sc-label">Start Time</label>
                  <input
                    type="time"
                    className="sc-text-input"
                    value={manualBlock.startTime}
                    onChange={(e) => setManualBlock(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div className="sc-field">
                  <label className="sc-label">End Time</label>
                  <input
                    type="time"
                    className="sc-text-input"
                    value={manualBlock.endTime}
                    onChange={(e) => setManualBlock(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="sc-row">
                <div className="sc-field">
                  <label className="sc-label">Activity Name</label>
                  <input
                    type="text"
                    className="sc-text-input"
                    placeholder="e.g. Morning Jog, Homework"
                    value={manualBlock.activity}
                    onChange={(e) => setManualBlock(prev => ({ ...prev, activity: e.target.value }))}
                    required
                  />
                </div>
                <div className="sc-field">
                  <label className="sc-label">Category</label>
                  <select
                    className="sc-text-input"
                    value={manualBlock.type}
                    onChange={(e) => setManualBlock(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="free">Free Time 🍃</option>
                    <option value="college">College 📚</option>
                    <option value="gym">Gym 🏋️</option>
                    <option value="study">Study ✍️</option>
                    <option value="sleep">Sleep 😴</option>
                    <option value="meal">Meal 🍽️</option>
                    <option value="misc">Hobbies/Leisure 🎸</option>
                  </select>
                </div>
              </div>

              <div className="sc-field">
                <label className="sc-label">Short Tip / Practical Note (Optional)</label>
                <input
                  type="text"
                  className="sc-text-input"
                  placeholder="e.g. Turn off phone notifications"
                  value={manualBlock.tip}
                  onChange={(e) => setManualBlock(prev => ({ ...prev, tip: e.target.value }))}
                />
              </div>

              <button type="submit" className="sc-manual-add-btn">
                ＋ Add block to timetable
              </button>
            </form>
          )}

          {/* ── Timetable Results ────────────────────────────────── */}
          {schedule && schedule.length > 0 && (
            <div className="sc-results">

              {/* Sleep summary card */}
              <div className="sc-sleep-summary">
                <span className="sc-sleep-summary__icon" aria-hidden="true">😴</span>
                <div>
                  <p className="sc-sleep-summary__label">Sleep Summary</p>
                  <p className="sc-sleep-summary__text">
                    Target: <strong>{form.sleepTarget || 7.5}h</strong>
                    {' · '}
                    This schedule gives you: <strong className={actualSleepHours >= (form.sleepTarget || 7.5) ? 'sc-sleep-good' : 'sc-sleep-low'}>
                      {actualSleepHours}h
                    </strong>
                  </p>
                </div>
              </div>

              {/* Vertical timeline */}
              <div className="sc-timeline">
                {schedule.map((block, i) => {
                  const meta = TYPE_META[block.type] || TYPE_META.free;
                  return (
                    <div key={i} className={`sc-tl-item sc-tl-item--${meta.color}`}>
                      <div className="sc-tl-item__marker">
                        <span className="sc-tl-item__dot" />
                        {i < schedule.length - 1 && <span className="sc-tl-item__line" />}
                      </div>

                      <div className="sc-tl-item__card">
                        <div className="sc-tl-item__top">
                          <span className="sc-tl-item__time">{block.time}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`sc-tl-item__type-badge sc-tl-item__type-badge--${meta.color}`}>
                              {meta.icon} {meta.label}
                            </span>
                            <button
                              type="button"
                              className="sc-block-delete-btn"
                              onClick={() => handleDeleteBlock(i)}
                              aria-label="Delete block"
                              title="Delete block"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '4px',
                                fontSize: '0.85rem',
                                opacity: 0.6,
                                transition: 'opacity 0.2s',
                              }}
                              onMouseEnter={(e) => e.target.style.opacity = 1}
                              onMouseLeave={(e) => e.target.style.opacity = 0.6}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className="sc-tl-item__activity">{block.activity}</p>
                        {block.tip && (
                          <p className="sc-tl-item__tip">💡 {block.tip}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save schedule to cloud */}
              <button
                className="sc-save-btn"
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {savingSchedule ? (
                  <>
                    <span className="sc-spinner" aria-hidden="true" />
                    Saving schedule...
                  </>
                ) : (
                  <>💾 Save Timetable to Cloud</>
                )}
              </button>
            </div>
          )}

          {/* Toast notification */}
          {toast && (
            <div className="sc-toast" role="status" aria-live="polite">
              {toast}
            </div>
          )}

        </main>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Schedule;