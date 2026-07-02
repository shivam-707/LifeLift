/**
 * PeakMode — AI Chat
 * ───────────────────
 * Full-screen chat interface that talks to POST /api/chat.
 *
 * Features:
 *   · Message bubbles — user right (#3B82F6), AI left (#1E293B)
 *   · Animated typing indicator while waiting for AI response
 *   · Auto-scroll to latest message on every update
 *   · Send on Enter (Shift+Enter for newline)
 *   · Textarea auto-grows up to 5 lines, then scrolls
 *   · Graceful error display inline as a failed AI message
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar, { SidebarProvider } from '../components/Sidebar';
import api from '../utils/api';
import './Chat.css';

/* ── Unique ID for each message ─────────────────────────────────────────── */
let _id = 0;
const uid = () => ++_id;

/* ── Initial greeting from the AI ───────────────────────────────────────── */
const makeGreeting = (username) => ({
  id:   uid(),
  role: 'ai',
  text: `Hey ${username}! 👋 I'm your LifeLift AI. Ask me anything about your workouts, meal planning, study schedule, ingredient checks, or budget food decisions. What's on your mind?`,
});

/* ── Typing indicator dots component ────────────────────────────────────── */
const TypingDots = () => (
  <div className="chat-bubble chat-bubble--ai chat-bubble--typing" aria-label="AI is typing">
    <span className="typing-dot" />
    <span className="typing-dot" />
    <span className="typing-dot" />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const Chat = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [messages, setMessages] = useState(() => [makeGreeting(user?.username ?? 'there')]);
  const [input,    setInput]    = useState('');
  const [typing,   setTyping]   = useState(false);

  // Pre-fill input if navigated from Food Advisor with a prefillMessage
  useEffect(() => {
    const prefill = location.state?.prefillMessage;
    if (prefill) setInput(prefill);
  }, [location.state]);

  const bottomRef  = useRef(null); // scroll anchor
  const textareaRef = useRef(null);

  /* ── Auto-scroll on every message / typing state change ──────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── Auto-grow textarea ───────────────────────────────────────────────── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Cap at ~5 lines (5 × 24px line-height = 120px)
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  /* ── Send message ─────────────────────────────────────────────────────── */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || typing) return;

    // Append user bubble immediately
    const userMsg = { id: uid(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await api.post('/chat', { message: text });
      setMessages((prev) => [...prev, { id: uid(), role: 'ai', text: res.data.reply }]);
    } catch (err) {
      const errText = err.response?.data?.message || 'Something went wrong. Please try again.';
      setMessages((prev) => [...prev, { id: uid(), role: 'ai', text: errText, isError: true }]);
    } finally {
      setTyping(false);
    }
  }, [input, typing]);

  /* ── Keyboard handler ─────────────────────────────────────────────────── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <SidebarProvider>
      <div className="dashboard"> {/* reuse dashboard layout shell */}
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

        {/* Chat pane */}
        <div className="chat">

          {/* Header bar */}
          <div className="chat__header">
            <div className="chat__header-avatar" aria-hidden="true">⚡</div>
            <div>
              <p className="chat__header-name">LifeLift AI</p>
              <p className="chat__header-status">
                <span className="chat__status-dot" aria-hidden="true" />
                Always online
              </p>
            </div>
          </div>

          {/* Message list */}
          <div className="chat__messages" role="log" aria-live="polite" aria-label="Chat messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat__row chat__row--${msg.role}`}
              >
                {msg.role === 'ai' && (
                  <div className="chat__avatar" aria-hidden="true">⚡</div>
                )}
                <div className={[
                  'chat-bubble',
                  `chat-bubble--${msg.role}`,
                  msg.isError ? 'chat-bubble--error' : '',
                ].join(' ')}>
                  {/* Preserve newlines from AI markdown-style responses */}
                  {msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < msg.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                {msg.role === 'user' && (
                  <div className="chat__avatar chat__avatar--user" aria-hidden="true">
                    {user?.username?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="chat__row chat__row--ai">
                <div className="chat__avatar" aria-hidden="true">⚡</div>
                <TypingDots />
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="chat__input-area">
            <textarea
              ref={textareaRef}
              className="chat__input"
              placeholder="Ask me about workouts, food, study schedule…"
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Message input"
              disabled={typing}
            />
            <button
              className="chat__send"
              onClick={sendMessage}
              disabled={!input.trim() || typing}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                width="18" height="18" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          <p className="chat__hint">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
    </SidebarProvider>
  );
};

export default Chat;