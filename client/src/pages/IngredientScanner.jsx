/**
 * PeakMode — Ingredient Scanner
 * ───────────────────────────────
 * Form → POST /api/ingredients/analyze → structured verdict card.
 *
 * Parses the fixed response format from the backend:
 *   VERDICT: ...
 *   HEALTH SCORE: ...
 *   BUDGET FIT: ...
 *   GOOD INGREDIENTS: ...
 *   BAD INGREDIENTS: ...
 *   UNKNOWN INGREDIENTS: ...
 *   SUMMARY: ...
 *   BETTER ALTERNATIVE: ...
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import CamScanner from '../components/CamScanner';
import api from '../utils/api';
import './IngredientScanner.css';

/* ── Parse Claude's structured response ──────────────────────────────────────
   Algorithm (per spec):
     1. Split response into lines
     2. For each line, check which field name it starts with
     3. Extract the value after the colon
     4. GOOD / BAD / UNKNOWN INGREDIENTS get split further by comma
   Multi-line fields (REASON-style fields like BAD INGREDIENTS or SUMMARY
   sometimes wrap across lines) are accumulated into the current field
   until the next known field label is seen.
─────────────────────────────────────────────────────────────────────────── */
const FIELD_LABELS = [
  'VERDICT',
  'HEALTH SCORE',
  'BUDGET FIT',
  'GOOD INGREDIENTS',
  'BAD INGREDIENTS',
  'UNKNOWN INGREDIENTS',
  'SUMMARY',
  'BETTER ALTERNATIVE',
];

const FIELD_KEY_MAP = {
  'VERDICT':              'verdict',
  'HEALTH SCORE':         'healthScore',
  'BUDGET FIT':           'budgetFit',
  'GOOD INGREDIENTS':     'good',
  'BAD INGREDIENTS':      'bad',
  'UNKNOWN INGREDIENTS':  'unknown',
  'SUMMARY':              'summary',
  'BETTER ALTERNATIVE':   'alternative',
};

const parseAnalysis = (text) => {
  const result = {
    verdict: '', healthScore: '', budgetFit: '',
    good: '', bad: '', unknown: '', summary: '', alternative: '',
  };

  const lines = text.split('\n');
  let currentKey = null;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    // Check if this line starts a new known field
    const matchedLabel = FIELD_LABELS.find((label) =>
      line.toUpperCase().startsWith(label + ':')
    );

    if (matchedLabel) {
      currentKey = FIELD_KEY_MAP[matchedLabel];
      // Extract everything after the first colon
      const value = line.slice(line.indexOf(':') + 1).trim();
      result[currentKey] = value;
    } else if (currentKey) {
      // Continuation line of a multi-line field (e.g. wrapped SUMMARY)
      result[currentKey] = result[currentKey]
        ? `${result[currentKey]}\n${line}`
        : line;
    }
  });

  return result;
};

/* ── Helpers to classify badges/bars ─────────────────────────────────────── */
const verdictClass = (verdict) => {
  const v = verdict.toLowerCase();
  if (v.includes('healthy'))    return 'verdict--healthy';
  if (v.includes('acceptable')) return 'verdict--acceptable';
  if (v.includes('avoid'))      return 'verdict--avoid';
  return 'verdict--acceptable';
};

const budgetFitClass = (fit) => {
  const f = fit.toLowerCase();
  if (f.includes('yes'))        return 'fit--yes';
  if (f.includes('no'))         return 'fit--no';
  return 'fit--borderline';
};

const scoreClass = (score) => {
  const n = parseInt(score, 10);
  if (isNaN(n)) return 'score--mid';
  if (n > 7)  return 'score--high';
  if (n >= 4) return 'score--mid';
  return 'score--low';
};

/* Splits "Oats, Honey, Almonds" → ['Oats', 'Honey', 'Almonds'] */
const splitList = (text) =>
  text.split(',').map((s) => s.trim()).filter(Boolean);

/* Formats an ISO date string as "12 Jun" */
const formatScanDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/* ── Component ────────────────────────────────────────────────────────────── */
const IngredientScanner = () => {
  const { logout } = useAuth();

  const [form, setForm] = useState({
    productName:    '',
    mrp:             '',
    budget:          '',
    ingredientList: '',
  });

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [result,   setResult]   = useState(null);
  const [raw,      setRaw]      = useState('');
  const [showCam,  setShowCam]  = useState(false);

  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  /* ── CamScanner result handler ──────────────────────────────────────────── */
  const handleScanResult = (text) => {
    // Strip anything that's obviously not an ingredient list
    // (page numbers, brand names in ALL-CAPS on separate lines, etc.)
    set('ingredientList', text);
  };

  /* ── Fetch scan history on mount ─────────────────────────────────────────── */
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api.get('/ingredients/history');
        setHistory(res.data.history || []);
      } catch (err) {
        console.error('Failed to load history:', err.response?.data?.message || err.message);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, []);

  /* ── Fetch user profile on mount, pre-fill budget ────────────────────────── */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        const dailyBudget = res.data.profile?.dailyBudget;
        if (dailyBudget != null) {
          setForm((prev) => ({ ...prev, budget: String(dailyBudget) }));
        }
      } catch (err) {
        // Non-fatal — form just stays empty if profile fetch fails
        console.error('Failed to load profile:', err.response?.data?.message || err.message);
      }
    };
    loadProfile();
  }, []);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (error) setError('');
  };

  /* ── Validation ─────────────────────────────────────────────────────────── */
  const validate = () => {
    if (!form.productName.trim())    return 'Please enter the product name';
    if (!form.ingredientList.trim()) return 'Please paste the ingredients list';
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
      const res = await api.post('/ingredients/analyze', {
        productName:    form.productName.trim(),
        mrp:            form.mrp ? Number(form.mrp) : undefined,
        budget:         form.budget ? Number(form.budget) : undefined,
        ingredientList: form.ingredientList.trim(),
      });

      const text = res.data.analysis;
      setRaw(text);
      setResult(parseAnalysis(text));
    } catch (e) {
      setError(e.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Click a history card: fill form + show its saved result ────────────── */
  const handleHistoryClick = (scan) => {
    setForm((prev) => ({ ...prev, productName: scan.productName }));
    setError('');

    // Rebuild a result object compatible with the results card from the
    // fields we stored — good/bad/unknown ingredient lists weren't
    // persisted, so those columns will simply show their empty state.
    setResult({
      verdict:     scan.verdict     || '',
      healthScore: scan.healthScore || '',
      budgetFit:   scan.budgetFit   || '',
      good:        '',
      bad:         '',
      unknown:     '',
      summary:     scan.summary     || '',
      alternative: scan.betterAlternative || '',
    });
    setRaw('');
  };

  /* ── Clear all scan history ──────────────────────────────────────────────── */
  const handleClearHistory = async () => {
    try {
      await api.delete('/ingredients/history');
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear history:', err.response?.data?.message || err.message);
    }
  };


  const scoreNum = result ? parseInt(result.healthScore, 10) : null;
  const scorePct = !isNaN(scoreNum) && scoreNum !== null
    ? Math.max(0, Math.min(100, (scoreNum / 10) * 100))
    : 0;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <>
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

        <main className="is-page">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="is-header">
            <h1 className="is-title">Ingredient Scanner 🔍</h1>
            <p className="is-subtitle">Paste the ingredients list from any packaged product</p>
          </div>

          {/* ── Form ────────────────────────────────────────────── */}
          <div className="is-form">

            {error && (
              <div className="is-error" role="alert">
                <span aria-hidden="true">⚠</span> {error}
              </div>
            )}

            {/* Product name */}
            <div className="is-field">
              <label className="is-label" htmlFor="is-product">Product name</label>
              <input
                id="is-product" type="text"
                className="is-text-input"
                placeholder="e.g. Yoga Bar Oats & Honey"
                value={form.productName}
                onChange={(e) => set('productName', e.target.value)}
              />
            </div>

            {/* MRP + Budget side by side */}
            <div className="is-row">
              <div className="is-field">
                <label className="is-label" htmlFor="is-mrp">MRP</label>
                <div className="is-input-wrap">
                  <span className="is-unit is-unit--prefix">₹</span>
                  <input
                    id="is-mrp" type="number" inputMode="numeric"
                    className="is-input is-input--prefixed"
                    placeholder="e.g. 40" min="0"
                    value={form.mrp}
                    onChange={(e) => set('mrp', e.target.value)}
                  />
                </div>
              </div>

              <div className="is-field">
                <label className="is-label" htmlFor="is-budget">Your budget for this</label>
                <div className="is-input-wrap">
                  <span className="is-unit is-unit--prefix">₹</span>
                  <input
                    id="is-budget" type="number" inputMode="numeric"
                    className="is-input is-input--prefixed"
                    placeholder="e.g. 50" min="0"
                    value={form.budget}
                    onChange={(e) => set('budget', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Ingredients textarea */}
            <div className="is-field">
              <div className="is-label-row">
                <label className="is-label" htmlFor="is-ingredients">Ingredients list</label>
                <button
                  type="button"
                  className="is-cam-btn"
                  onClick={() => setShowCam(true)}
                  aria-label="Scan ingredients with camera"
                  title="Scan with camera"
                >
                  📷 Scan
                </button>
              </div>
              <textarea
                id="is-ingredients"
                className="is-textarea"
                placeholder="Paste the full ingredients list here, or tap 📷 Scan to use your camera..."
                rows={6}
                value={form.ingredientList}
                onChange={(e) => set('ingredientList', e.target.value)}
              />
            </div>

            {/* Submit */}
            <button className="is-submit" onClick={handleSubmit} disabled={loading}>
              {loading
                ? <><span className="is-spinner" aria-hidden="true" /> Analyzing... 🔬</>
                : 'Analyze Ingredients 🔬'
              }
            </button>
          </div>

          {/* ── Recent Scans ──────────────────────────────────────── */}
          <div className="is-history">
            <div className="is-history__header">
              <p className="is-history__title">Recent Scans</p>
              {history.length > 0 && (
                <button className="is-history__clear" onClick={handleClearHistory}>
                  🗑️ Clear History
                </button>
              )}
            </div>

            {historyLoading ? (
              <p className="is-history__loading">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="is-history__empty">No scans yet. Try your first product above!</p>
            ) : (
              <div className="is-history__scroll">
                {history.map((scan) => (
                  <button
                    key={scan._id}
                    className="is-history-card"
                    onClick={() => handleHistoryClick(scan)}
                  >
                    <p className="is-history-card__name">{scan.productName}</p>
                    {scan.verdict && (
                      <span className={`is-history-card__verdict ${verdictClass(scan.verdict)}`}>
                        {scan.verdict}
                      </span>
                    )}
                    <div className="is-history-card__meta">
                      {scan.healthScore && (
                        <span className="is-history-card__score">{scan.healthScore}/10</span>
                      )}
                      <span className="is-history-card__date">{formatScanDate(scan.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Results card ────────────────────────────────────── */}
          {result && (
            <div className="is-result" role="region" aria-label="Analysis result">

              {/* Product heading */}
              <h2 className="is-result__title">{form.productName}</h2>

              {/* Verdict + Budget Fit badges */}
              <div className="is-result__badges">
                {result.verdict && (
                  <span className={`is-verdict ${verdictClass(result.verdict)}`}>
                    {result.verdict}
                  </span>
                )}
                {result.budgetFit && (
                  <span className={`is-fit ${budgetFitClass(result.budgetFit)}`}>
                    Budget Fit: {result.budgetFit}
                  </span>
                )}
              </div>

              {/* Health score bar */}
              {result.healthScore && (
                <div className="is-score">
                  <div className="is-score__label-row">
                    <span className="is-score__label">Health Score</span>
                    <span className={`is-score__value ${scoreClass(result.healthScore)}`}>
                      {result.healthScore}/10
                    </span>
                  </div>
                  <div className="is-score__track">
                    <div
                      className={`is-score__fill ${scoreClass(result.healthScore)}`}
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Three-column ingredient breakdown */}
              <div className="is-cols">
                <div className="is-col is-col--good">
                  <p className="is-col__heading">✅ Good Ingredients</p>
                  {result.good
                    ? <ul className="is-col__list">
                        {splitList(result.good).map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    : <p className="is-col__empty">None highlighted</p>
                  }
                </div>

                <div className="is-col is-col--bad">
                  <p className="is-col__heading">⚠️ Bad Ingredients</p>
                  {result.bad
                    ? <ul className="is-col__list">
                        {splitList(result.bad).map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    : <p className="is-col__empty">None flagged</p>
                  }
                </div>

                <div className="is-col is-col--unknown">
                  <p className="is-col__heading">❓ Unknown Ingredients</p>
                  {result.unknown
                    ? <ul className="is-col__list">
                        {splitList(result.unknown).map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    : <p className="is-col__empty">All recognized</p>
                  }
                </div>
              </div>

              {/* Summary */}
              {result.summary && (
                <div className="is-summary">
                  <p className="is-summary__heading">Summary</p>
                  <p className="is-summary__text">{result.summary}</p>
                </div>
              )}

              {/* Better alternative tip box */}
              {result.alternative && (
                <div className="is-alt-tip">
                  <span className="is-alt-tip__icon" aria-hidden="true">💡</span>
                  <div>
                    <p className="is-alt-tip__label">Better Alternative</p>
                    <p className="is-alt-tip__text">{result.alternative}</p>
                  </div>
                </div>
              )}

              {/* Fallback if nothing parsed */}
              {!result.verdict && raw && (
                <pre className="is-result__raw">{raw}</pre>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
    </SidebarProvider>

    {/* Camera scanner — full-screen modal, rendered outside sidebar layout */}
    {showCam && (
      <CamScanner
        onResult={handleScanResult}
        onClose={() => setShowCam(false)}
      />
    )}
    </>
  );
};

export default IngredientScanner;