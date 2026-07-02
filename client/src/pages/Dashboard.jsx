/**
 * PeakMode — Dashboard
 * ─────────────────────
 * Layout shell. All sidebar/drawer logic lives in <Sidebar>.
 * Dashboard fetches the user profile on mount and renders a
 * today-at-a-glance card alongside the quick-action grid.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import SleepTracker from '../components/SleepTracker';
import StreakBadges from '../components/StreakBadges';
import api from '../utils/api';
import './Dashboard.css';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Determines whether today is a gym day.
 *   gymDaysPerWeek >= 5  → always gym day
 *   otherwise            → alternate by day-of-week (even index = gym, odd = rest)
 *                          deterministic: same day always gives the same answer.
 */
const getIsGymDay = (gymDaysPerWeek) => {
  if (!gymDaysPerWeek) return null;
  if (gymDaysPerWeek >= 5) return true;
  return new Date().getDay() % 2 === 0; // 0 Sun … 6 Sat
};

/* ── Component ────────────────────────────────────────────────────────────── */
const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [userProfile,    setUserProfile]    = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Live states
  const [foodDiary,      setFoodDiary]      = useState({ totalCalories: 0, totalProtein: 0 });
  const [workoutLog,     setWorkoutLog]     = useState({ daysCompleted: 0, availableDays: 0 });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [profileRes, diaryRes, workoutRes] = await Promise.all([
          api.get('/user/profile'),
          api.get('/food-diary/today').catch(() => ({ data: { totalCalories: 0, totalProtein: 0 } })),
          api.get('/workout/current-week').catch(() => ({ data: { log: null } }))
        ]);

        setUserProfile(profileRes.data.profile);
        setFoodDiary({
          totalCalories: diaryRes.data.totalCalories || 0,
          totalProtein: diaryRes.data.totalProtein || 0
        });

        if (workoutRes.data?.log) {
          setWorkoutLog({
            daysCompleted: workoutRes.data.log.daysCompleted || 0,
            availableDays: workoutRes.data.log.availableDays || 0
          });
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err.response?.data?.message || err.message);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (profileLoading) {
    return (
      <div className="dashboard dashboard--loading">
        <div className="spinner-overlay">
          <div className="spinner" aria-label="Loading dashboard…" />
          <p className="spinner-text">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const isGymDay = getIsGymDay(userProfile?.gymDaysPerWeek);

  return (
    <SidebarProvider>
      <div className="dashboard">
      <Sidebar />

      <div className="dashboard__body">

        {/* Mobile topbar */}
        <header className="topbar">
          <Sidebar.Trigger />
          <span className="topbar__brand">
            <span aria-hidden="true">⚡</span> PeakMode
          </span>
          <button className="topbar__logout" onClick={logout} aria-label="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              width="18" height="18" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </header>

        <main className="dashboard__main">
          <div className="welcome">

            {/* Greeting */}
            <p className="welcome__greeting">{getGreeting()},</p>
            <h1 className="welcome__name">
              {user?.username}
              <span className="welcome__wave" aria-hidden="true"> 👋</span>
            </h1>

            {/* ── Today's snapshot card ─────────────────────────────── */}
            <div className="today-card">
              <div className="today-card__header">
                <span className="today-card__label">Today's snapshot</span>
                {isGymDay !== null && (
                  <span className={`today-card__badge ${isGymDay ? 'today-card__badge--gym' : 'today-card__badge--rest'}`}>
                    {isGymDay ? '🏋️ Gym Day' : '😴 Rest Day'}
                  </span>
                )}
              </div>

              <div className="today-card__stats">
                {/* 1. Calories */}
                <div className="today-stat today-stat--progress">
                  <div className="today-stat__top">
                    <span className="today-stat__icon">🔥</span>
                    <div>
                      <p className="today-stat__label">Calories</p>
                      <p className="today-stat__value">
                        {foodDiary.totalCalories}{' '}
                        <span className="today-stat__unit">/ {userProfile?.calorieTarget || 2000} kcal</span>
                      </p>
                    </div>
                  </div>
                  {userProfile?.calorieTarget > 0 && (
                    <div className="today-stat__progress-bar">
                      <div
                        className="today-stat__progress-fill today-stat__progress-fill--orange"
                        style={{ width: `${Math.min(100, (foodDiary.totalCalories / userProfile.calorieTarget) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 2. Protein */}
                <div className="today-stat today-stat--progress">
                  <div className="today-stat__top">
                    <span className="today-stat__icon">🥩</span>
                    <div>
                      <p className="today-stat__label">Protein</p>
                      <p className="today-stat__value">
                        {foodDiary.totalProtein}{' '}
                        <span className="today-stat__unit">/ {userProfile?.proteinTarget || 150} g</span>
                      </p>
                    </div>
                  </div>
                  {userProfile?.proteinTarget > 0 && (
                    <div className="today-stat__progress-bar">
                      <div
                        className="today-stat__progress-fill today-stat__progress-fill--blue"
                        style={{ width: `${Math.min(100, (foodDiary.totalProtein / userProfile.proteinTarget) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 3. Daily Food Budget */}
                <div className="today-stat">
                  <span className="today-stat__icon">💰</span>
                  <div>
                    <p className="today-stat__label">Daily budget</p>
                    <p className="today-stat__value">
                      {userProfile?.dailyBudget != null
                        ? <><span className="today-stat__unit">₹</span>{userProfile.dailyBudget}</>
                        : <span className="today-stat__empty">Not set</span>
                      }
                    </p>
                  </div>
                </div>

                {/* 4. Workout split progress */}
                <div className="today-stat">
                  <span className="today-stat__icon">🏋️</span>
                  <div>
                    <p className="today-stat__label">Workout split</p>
                    <p className="today-stat__value">
                      {workoutLog.availableDays > 0 ? (
                        <>
                          {workoutLog.daysCompleted}{' '}
                          <span className="today-stat__unit">/ {workoutLog.availableDays} days</span>
                        </>
                      ) : (
                        <span className="today-stat__empty">Not started</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Sleep Tracker widget ──────────────────────────────── */}
            <div style={{ marginBottom: '28px' }}>
              <SleepTracker />
            </div>

            {/* ── Streak badges (compact) ───────────────────────────── */}
            <div style={{ marginBottom: '28px' }}>
              <StreakBadges />
            </div>

            {/* ── Quick-action cards ────────────────────────────────── */}
            <div className="welcome__cards">
              {[
                { icon: '🏋️', title: 'Workout',  desc: 'Plan your split for today', to: '/workout-planner' },
                { icon: '🍽️', title: 'Fuel',     desc: 'Decide what to eat right now', to: '/food-advisor' },
                { icon: '📚', title: 'Study',    desc: 'Block your focus sessions', to: '/schedule' },
                { icon: '🤖', title: 'Ask AI',   desc: 'Talk to your coach', to: '/chat' },
              ].map(({ icon, title, desc, to }) => (
                <div
                  key={title}
                  className="quick-card"
                  onClick={() => navigate(to)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(to)}
                >
                  <span className="quick-card__icon">{icon}</span>
                  <div>
                    <p className="quick-card__title">{title}</p>
                    <p className="quick-card__desc">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </main>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Dashboard;