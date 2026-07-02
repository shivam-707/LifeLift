/**
 * CamScanner
 * ──────────
 * A full-screen modal camera scanner.
 *
 * Flow:
 *   1. Opens the device camera (back-facing on mobile)
 *   2. User frames the ingredient label inside the guide box
 *   3. Tap "Capture" → frame is drawn to a hidden <canvas>
 *   4. Tesseract.js OCR extracts the text (browser-side, no API key)
 *   5. Extracted text is shown in an editable textarea
 *   6. "Use this text" → `onResult(text)` is called → modal closes
 *
 * Props:
 *   onResult(text: string) — callback with the scanned ingredient text
 *   onClose()             — callback to close the modal
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import './CamScanner.css';

/* Lazy-load Tesseract so it doesn't bloat the initial bundle */
let tesseractPromise = null;
const getTesseract = () => {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js');
  }
  return tesseractPromise;
};

/* ── States the scanner cycles through ─────────────────────────────────────── */
const STATE = {
  CAMERA:    'camera',    // live camera feed
  UPLOADING: 'uploading', // user picked a file (no camera available)
  OCR:       'ocr',       // running Tesseract
  RESULT:    'result',    // showing editable OCR text
  ERROR:     'error',     // camera or OCR failed
};

const CamScanner = ({ onResult, onClose }) => {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const fileRef    = useRef(null);

  const [phase,       setPhase]       = useState(STATE.CAMERA);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText,     setOcrText]     = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [capturedImg, setCapturedImg] = useState(null); // data-URL preview

  /* ── Start camera ───────────────────────────────────────────────────────── */
  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // back camera on mobile
          width:      { ideal: 1280 },
          height:     { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase(STATE.CAMERA);
    } catch (err) {
      console.warn('Camera unavailable:', err.message);
      // Fall back to file picker
      setPhase(STATE.UPLOADING);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      /* Stop all tracks when the modal unmounts */
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  /* ── Capture a frame from the video feed ──────────────────────────────── */
  const capture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImg(dataUrl);

    /* Stop camera now — we have the frame */
    streamRef.current?.getTracks().forEach((t) => t.stop());
    runOCR(dataUrl);
  }, []);

  /* ── Handle file upload fallback ──────────────────────────────────────── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setCapturedImg(dataUrl);
      runOCR(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  /* ── Run Tesseract OCR ────────────────────────────────────────────────── */
  const runOCR = useCallback(async (imageSource) => {
    setPhase(STATE.OCR);
    setOcrProgress(0);

    try {
      const { createWorker } = await getTesseract();

      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageSource);
      await worker.terminate();

      /* Clean up: collapse multiple spaces/newlines into single newlines */
      const cleaned = text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      setOcrText(cleaned);
      setPhase(STATE.RESULT);
    } catch (err) {
      console.error('OCR failed:', err);
      setErrorMsg('OCR failed. Try a clearer photo or paste the text manually.');
      setPhase(STATE.ERROR);
    }
  }, []);

  /* ── Retake ───────────────────────────────────────────────────────────── */
  const retake = () => {
    setCapturedImg(null);
    setOcrText('');
    setOcrProgress(0);
    startCamera();
  };

  /* ── Confirm and send text to parent ─────────────────────────────────── */
  const confirm = () => {
    const cleaned = ocrText.trim();
    if (cleaned) onResult(cleaned);
    onClose();
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="cs-overlay" role="dialog" aria-modal="true" aria-label="Ingredient camera scanner">

      {/* Header */}
      <div className="cs-header">
        <span className="cs-title">📷 Scan Ingredients</span>
        <button className="cs-close" onClick={onClose} aria-label="Close scanner">✕</button>
      </div>

      {/* ── CAMERA phase ───────────────────────────────────────────────── */}
      {phase === STATE.CAMERA && (
        <div className="cs-camera-wrap">
          <video
            ref={videoRef}
            className="cs-video"
            playsInline
            muted
            autoPlay
          />
          {/* Guide frame */}
          <div className="cs-guide" aria-hidden="true">
            <div className="cs-guide__corner cs-guide__corner--tl" />
            <div className="cs-guide__corner cs-guide__corner--tr" />
            <div className="cs-guide__corner cs-guide__corner--bl" />
            <div className="cs-guide__corner cs-guide__corner--br" />
            <span className="cs-guide__hint">Frame the ingredient list</span>
          </div>

          <div className="cs-actions">
            <button className="cs-btn cs-btn--ghost" onClick={onClose}>Cancel</button>
            <button className="cs-btn cs-btn--capture" onClick={capture} aria-label="Capture photo">
              <span className="cs-shutter" />
            </button>
            <button className="cs-btn cs-btn--ghost" onClick={() => fileRef.current?.click()}>
              Upload
            </button>
          </div>
        </div>
      )}

      {/* ── FILE UPLOAD fallback ───────────────────────────────────────── */}
      {phase === STATE.UPLOADING && (
        <div className="cs-center">
          <div className="cs-upload-icon">📁</div>
          <p className="cs-upload-msg">
            Camera not available on this device.<br />
            Upload a photo of the ingredient label instead.
          </p>
          <button className="cs-btn cs-btn--primary" onClick={() => fileRef.current?.click()}>
            Choose photo
          </button>
          <button className="cs-btn cs-btn--ghost cs-mt" onClick={onClose}>Cancel</button>
        </div>
      )}

      {/* ── OCR PROGRESS phase ─────────────────────────────────────────── */}
      {phase === STATE.OCR && (
        <div className="cs-center">
          {capturedImg && (
            <img src={capturedImg} className="cs-preview-img" alt="Captured label" />
          )}
          <div className="cs-ocr-status">
            <div className="cs-ocr-spinner" />
            <p className="cs-ocr-label">Reading text… {ocrProgress}%</p>
            <div className="cs-progress-bar">
              <div className="cs-progress-fill" style={{ width: `${ocrProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT phase ───────────────────────────────────────────────── */}
      {phase === STATE.RESULT && (
        <div className="cs-result">
          {capturedImg && (
            <img src={capturedImg} className="cs-preview-img" alt="Captured label" />
          )}
          <div className="cs-result-body">
            <p className="cs-result-label">
              ✅ Text extracted — review and edit if needed:
            </p>
            <textarea
              className="cs-textarea"
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder="Extracted ingredient text will appear here…"
            />
            <div className="cs-result-actions">
              <button className="cs-btn cs-btn--ghost" onClick={retake}>↩ Retake</button>
              <button
                className="cs-btn cs-btn--primary"
                onClick={confirm}
                disabled={!ocrText.trim()}
              >
                Use this text →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR phase ────────────────────────────────────────────────── */}
      {phase === STATE.ERROR && (
        <div className="cs-center">
          <div className="cs-error-icon">⚠️</div>
          <p className="cs-error-msg">{errorMsg}</p>
          <button className="cs-btn cs-btn--primary" onClick={retake}>Try again</button>
          <button className="cs-btn cs-btn--ghost cs-mt" onClick={onClose}>Cancel</button>
        </div>
      )}

      {/* Hidden canvas for frame capture & hidden file input */}
      <canvas ref={canvasRef} className="cs-hidden-canvas" aria-hidden="true" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="cs-hidden-input"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  );
};

export default CamScanner;
