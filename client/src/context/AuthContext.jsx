/**
 * PeakMode — Auth Context
 * ────────────────────────
 * Provides global authentication state (user, token, loading) and
 * auth actions (login, register, logout) to the entire React tree.
 *
 * Usage:
 *   const { user, login, logout, loading } = useAuth();
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { authAPI } from '../utils/api';

// ── Context creation ──────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Reducer ───────────────────────────────────────────────────────────────────
const initialState = {
  user:    null,
  token:   localStorage.getItem('peakmode_token') || null,
  loading: true,  // true while we verify the stored token on mount
  error:   null,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user:    action.payload.user,
        token:   action.payload.token,
        loading: false,
        error:   null,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        user:    null,
        token:   null,
        loading: false,
        error:   action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user:    null,
        token:   null,
        loading: false,
        error:   null,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

// ── Provider component ────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── On mount: verify the stored token by calling /api/auth/me ─────────────
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('peakmode_token');

      if (!storedToken) {
        dispatch({ type: 'AUTH_ERROR', payload: null });
        return;
      }

      try {
        const res = await authAPI.getMe();
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: res.data.user, token: storedToken },
        });
      } catch {
        // Token is invalid or expired
        localStorage.removeItem('peakmode_token');
        localStorage.removeItem('peakmode_user');
        dispatch({ type: 'AUTH_ERROR', payload: null });
      }
    };

    verifyToken();
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async ({ username, email, password }) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const res = await authAPI.register({ username, email, password });
      const { token, user } = res.data;

      // Persist token
      localStorage.setItem('peakmode_token', token);
      localStorage.setItem('peakmode_user', JSON.stringify(user));

      dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      return { success: false, message };
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const res = await authAPI.login({ email, password });
      const { token, user } = res.data;

      // Persist token
      localStorage.setItem('peakmode_token', token);
      localStorage.setItem('peakmode_user', JSON.stringify(user));

      dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      return { success: false, message };
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('peakmode_token');
    localStorage.removeItem('peakmode_user');
    dispatch({ type: 'LOGOUT' });
  }, []);

  // ── Refresh user (re-fetch /api/auth/me to pick up updated fields) ────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await authAPI.getMe();
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: res.data.user, token: localStorage.getItem('peakmode_token') },
      });
    } catch {
      // If re-fetch fails, leave existing state untouched
    }
  }, []);

  // ── Clear error ───────────────────────────────────────────────────────────
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = {
    user:        state.user,
    token:       state.token,
    loading:     state.loading,
    error:       state.error,
    isAuth:      !!state.user,
    register,
    login,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ── Custom hook for consuming the context ─────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
};

export default AuthContext;
