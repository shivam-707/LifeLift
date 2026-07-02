/**
 * LifeLift — Register Page
 * ─────────────────────────
 * Handles new user sign-up. Includes client-side validation before
 * sending to the backend. On success, redirects to /dashboard.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Register = () => {
  const navigate  = useNavigate();
  const { register, isAuth, loading, error, clearError } = useAuth();

  const [formData, setFormData]     = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [formError, setFormError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0); // 0-3

  // Redirect if already logged in
  useEffect(() => {
    if (isAuth) navigate('/dashboard', { replace: true });
  }, [isAuth, navigate]);

  // Sync auth context errors
  useEffect(() => {
    if (error) setFormError(error);
  }, [error]);

  // ── Password strength calculator ────────────────────────────────────────────
  const calcStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 6)  score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) || /[0-9]/.test(pwd) || /[^a-zA-Z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'];
  const strengthClass = ['', 'weak', 'fair', 'strong'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') setPasswordStrength(calcStrength(value));

    if (formError) {
      setFormError('');
      clearError();
    }
  };

  // ── Form submission ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { username, email, password, confirmPassword } = formData;

    // Client-side validation
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setFormError('Please fill in all fields');
      return;
    }
    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      username: username.trim(),
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (result.success) {
      navigate('/profile-setup', { replace: true });
    } else {
      setFormError(result.message || 'Registration failed. Please try again.');
    }
  };

  if (loading) return null;

  return (
    <div className="auth-page">
      {/* Ambient orbs */}
      <div className="auth-orb auth-orb--blue" aria-hidden="true" />
      <div className="auth-orb auth-orb--green" aria-hidden="true" />

      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <span className="auth-brand__icon">⚡</span>
          <span className="auth-brand__name">LifeLift</span>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card__header">
            <h1 className="auth-card__title">Create your account</h1>
            <p className="auth-card__subtitle">
              Start optimising your gym, study &amp; fuel routine
            </p>
          </div>

          {formError && (
            <div className="auth-error" role="alert">
              <span className="auth-error__icon">⚠</span>
              {formError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="auth-field__input"
                placeholder="e.g. arjun_lifts"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

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
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              {/* Password strength meter */}
              {formData.password.length > 0 && (
                <div className="password-strength">
                  <div className="password-strength__bars">
                    {[1, 2, 3].map((lvl) => (
                      <div
                        key={lvl}
                        className={`password-strength__bar ${passwordStrength >= lvl ? strengthClass[passwordStrength] : ''}`}
                      />
                    ))}
                  </div>
                  <span className={`password-strength__label password-strength__label--${strengthClass[passwordStrength]}`}>
                    {strengthLabel[passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="auth-field">
              <label className="auth-field__label" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className={`auth-field__input ${
                  formData.confirmPassword && formData.password !== formData.confirmPassword
                    ? 'auth-field__input--error'
                    : ''
                }`}
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="auth-btn auth-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-inline" aria-hidden="true" /> Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
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

export default Register;
