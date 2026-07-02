/**
 * PeakMode — App.js
 * ──────────────────
 * Root component. Sets up:
 *  · AuthProvider (global auth state)
 *  · React Router v6 routes
 *  · PrivateRoute guard for authenticated pages
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login    from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProfileSetup      from './pages/ProfileSetup';
import Chat              from './pages/Chat';
import FoodAdvisor       from './pages/FoodAdvisor';
import FoodDiary         from './pages/FoodDiary';
import IngredientScanner from './pages/IngredientScanner';
import WorkoutPlanner    from './pages/WorkoutPlanner';
import Schedule          from './pages/Schedule';
import Progress          from './pages/Progress';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/profile-setup"
            element={
              <PrivateRoute>
                <ProfileSetup />
              </PrivateRoute>
            }
          />

          {/* Profile edit — accessible even after profile is complete */}
          <Route
            path="/profile-edit"
            element={
              <PrivateRoute allowProfileComplete>
                <ProfileSetup editMode />
              </PrivateRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />

          <Route
            path="/food-advisor"
            element={
              <PrivateRoute>
                <FoodAdvisor />
              </PrivateRoute>
            }
          />

          <Route
            path="/food-diary"
            element={
              <PrivateRoute>
                <FoodDiary />
              </PrivateRoute>
            }
          />

          <Route
            path="/ingredient-scanner"
            element={
              <PrivateRoute>
                <IngredientScanner />
              </PrivateRoute>
            }
          />

          <Route
            path="/workout-planner"
            element={
              <PrivateRoute>
                <WorkoutPlanner />
              </PrivateRoute>
            }
          />

          <Route
            path="/schedule"
            element={
              <PrivateRoute>
                <Schedule />
              </PrivateRoute>
            }
          />

          <Route
            path="/progress"
            element={
              <PrivateRoute>
                <Progress />
              </PrivateRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;