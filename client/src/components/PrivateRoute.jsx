/**
 * PeakMode — PrivateRoute
 * ────────────────────────
 * Wraps any route that requires authentication.
 * · While auth state is loading (verifying stored token) → shows a spinner.
 * · If the user is authenticated → renders the protected page.
 * · If not authenticated → redirects to /login (preserving the attempted URL
 *   in router state so we can redirect back after successful login).
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Spinner.css';

const PrivateRoute = ({ children, allowProfileComplete = false }) => {
  const { isAuth, loading, user } = useAuth();
  const location = useLocation();

  // Show a full-page spinner while we verify the JWT on initial load
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner" aria-label="Loading…" />
        <p className="spinner-text">Loading LifeLift…</p>
      </div>
    );
  }

  // Redirect to login, saving where they were trying to go
  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect to profile setup if profile isn't complete yet.
  // allowProfileComplete bypasses this for routes like /profile-edit
  // that should be accessible regardless of profile completion status.
  if (!allowProfileComplete && user && !user.isProfileComplete && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
};

export default PrivateRoute;
