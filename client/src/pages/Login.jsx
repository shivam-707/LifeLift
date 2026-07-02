/**
 * LifeLift — Login Page
 * ──────────────────────
 * Handles user sign-in. On success, redirects to the page they were
 * trying to reach (or /dashboard if they came directly).
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, isAuth, loading, error, clearError } = useAuth();

  // Where to go after login (default: /dashboard)
  const from = location.state?.from?.pathname || '/dashboard';

  // ── Local form state ────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuth) navigate(from, { replace: true });
  }, [isAuth, navigate, from]);

  // Sync auth context errors → local error display
  useEffect(() => {
    if (error) setFormError(error);
  }, [error]);

  // Clear errors when the user starts typing
  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (formError) {
      setFormError('');
      clearError();
    }
  };

  // ── Form submission ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { email, password } = formData;

    // Client-side validation
    if (!email.trim() || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    const result = await login({ email: email.trim(), password });
    setIsSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setFormError(result.message || 'Login failed. Please try again.');
    }
  };

  // Don't render the form while the initial token verification is running
  if (loading) return null;

  return (
    <div className="auth-page">
      {/* ── Ambient background orbs ──────────────────────────────────────── */}
      <div className="auth-orb auth-orb--blue" aria-hidden="true" />
      <div className="auth-orb auth-orb--green" aria-hidden="true" />

      <div className="auth-container">
        {/* ── Brand mark ───────────────────────────────────────────────────── */}
        <div className="auth-brand">
          <span className="auth-brand__icon">⚡</span>
          <span className="auth-brand__name">LifeLift</span>
        </div>

        {/* ── Card ─────────────────────────────────────────────────────────── */}
        <div className="auth-card">
          <div className="auth-card__header">
            <h1 className="auth-card__title">Welcome back</h1>
            <p className="auth-card__subtitle">
              Sign in to your LifeLift account
            </p>
          </div>

          {/* Error banner */}
          {formError && (
            <div className="auth-error" role="alert">
              <span className="auth-error__icon">⚠</span>
              {formError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="auth-field__input"
                placeholder="you@college.edu"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="auth-field__input"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-inline" aria-hidden="true" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="auth-footer-text">
            New to LifeLift?{' '}
          <Link to="/register" className="auth-link">
            Create an account
          </Link>
          </p>
        </div>

        <p className="auth-tagline">
          Gym · Study · Fuel · Recover — all in one place.
        </p>
      </div>
    </div>
  );
};

export default Login;
