/**
 * PeakMode — Express Server Entry Point
 * ──────────────────────────────────────
 * Initialises Express, connects to MongoDB, mounts all route modules,
 * and starts listening on the configured port.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();

// Parse incoming JSON bodies
app.use(express.json());

// Enable CORS so the React dev server (port 3000) can talk to us (port 5000)
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// ── Database connection ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅  MongoDB connected'))
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1); // Kill the process so the error is obvious in dev
  });

// ── Route modules ─────────────────────────────────────────────────────────────
// Auth routes: /api/auth/register  /api/auth/login  /api/auth/me
app.use('/api/auth', require('./routes/auth'));

// Chat route: /api/chat
app.use('/api/chat', require('./routes/chat'));

// Food Advisor route: /api/food
app.use('/api/food', require('./routes/foodAdvisor'));

// Ingredient Scanner route: /api/ingredients
app.use('/api/ingredients', require('./routes/ingredientScanner'));

// Schedule Optimizer route: /api/schedule
app.use('/api/schedule', require('./routes/schedule'));

// Sleep Log route: /api/sleep
app.use('/api/sleep', require('./routes/sleepLog'));

// Streaks route: /api/streaks
app.use('/api/streaks', require('./routes/streaks'));

// User route: /api/user
app.use('/api/user', require('./routes/user'));

// Workout Planner route: /api/workout
app.use('/api/workout', require('./routes/workoutPlanner'));

// Food Diary route: /api/food-diary
app.use('/api/food-diary', require('./routes/foodDiary'));

// ── Health-check endpoint ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'LifeLift API is running 💪' });
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀  LifeLift server running on http://localhost:${PORT}`);
});
