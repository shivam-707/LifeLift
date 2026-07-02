/**
 * LifeLift — Sidebar
 * ───────────────────
 * Self-contained navigation component. Handles:
 *   · Desktop: sticky full-height sidebar
 *   · Mobile:  slide-in drawer + backdrop overlay
 *   · Drawer state (open/close), Escape key, body-scroll lock,
 *     auto-close on route change — all owned here, not in the parent.
 *
 * ── IMPORTANT: composition pattern ──────────────────────────────────────
 * <Sidebar /> and <Sidebar.Trigger /> must both live inside the SAME
 * <SidebarProvider> so they share drawer state via React Context.
 * Context only flows through the COMPONENT TREE, not the rendered DOM —
 * rendering them as unrelated siblings outside a shared provider will
 * throw "useDrawer must be used inside <Sidebar>" even if they appear
 * next to each other visually.
 *
 * Correct usage in any page:
 *
 *   import Sidebar, { SidebarProvider } from '../components/Sidebar';
 *
 *   <SidebarProvider>
 *     <div className="dashboard">
 *       <Sidebar />
 *       <div className="dashboard__body">
 *         <header className="topbar">
 *           <Sidebar.Trigger />
 *         </header>
 *         ...page content...
 *       </div>
 *     </div>
 *   </SidebarProvider>
 * ──────────────────────────────────────────────────────────────────────
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

/* ═══════════════════════════════════════════════════════════════════
   NAV ITEMS
═══════════════════════════════════════════════════════════════════ */
const NAV_SECTIONS = [
  {
    title: '',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        end: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
            <rect x="14" y="3"  width="7" height="7" rx="1.5" />
            <rect x="3"  y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Nutrition',
    items: [
      {
        to: '/food-advisor',
        label: 'Food Advisor',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8c0-3.31-2.69-6-6-6S6 4.69 6 8c0 2.97 2.03 5.44 4.78 6.17L12 21l1.22-6.83C15.97 13.44 18 10.97 18 8z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
        ),
      },
      {
        to: '/food-diary',
        label: 'Food Diary',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 6v6l4 2" />
          </svg>
        ),
      },
      {
        to: '/ingredient-scanner',
        label: 'Ingredient Scanner',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <rect x="7" y="7" width="10" height="10" rx="1" />
            <path d="M10 12h4M12 10v4" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Training',
    items: [
      {
        to: '/workout-planner',
        label: 'Workout Planner',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5h11M6.5 17.5h11M4 10h2.5M17.5 10H20M4 14h2.5M17.5 14H20" />
            <rect x="6.5" y="9" width="11" height="6" rx="1" />
          </svg>
        ),
      },
      {
        to: '/schedule',
        label: 'Schedule',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
          </svg>
        ),
      },
      {
        to: '/progress',
        label: 'Progress',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Tools',
    items: [
      {
        to: '/chat',
        label: 'AI Chat',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" />
          </svg>
        ),
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════
   DRAWER CONTEXT
   Provider now lives at the TOP LEVEL (exported as SidebarProvider),
   not nested inside the <Sidebar> component's own render. This is
   what lets <Sidebar /> and <Sidebar.Trigger /> be siblings in a
   page's JSX while still sharing the same context instance.
═══════════════════════════════════════════════════════════════════ */
const DrawerContext = createContext(null);

const useDrawer = () => {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error(
      'useDrawer must be used inside <SidebarProvider>. ' +
      'Wrap your page like: <SidebarProvider><Sidebar />...<Sidebar.Trigger />...</SidebarProvider>'
    );
  }
  return ctx;
};

/* ═══════════════════════════════════════════════════════════════════
   PROVIDER (exported — wrap your whole page layout with this)
═══════════════════════════════════════════════════════════════════ */
export const SidebarProvider = ({ children }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);

  /* Auto-close drawer on route change */
  useEffect(() => { close(); }, [location.pathname, close]);

  /* Close on Escape */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  /* Lock body scroll while drawer is open */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const ctx = { isOpen, open, close, toggle };

  return (
    <DrawerContext.Provider value={ctx}>
      {children}
    </DrawerContext.Provider>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   INNER CONTENT (shared markup for desktop sidebar + mobile drawer)
═══════════════════════════════════════════════════════════════════ */
const SidebarContent = () => {
  const { user, logout } = useAuth();

  return (
    <div className="sb__inner">

      {/* ── Brand ─────────────────────────────────────────────── */}
      <div className="sb__brand">
        <span className="sb__brand-icon" aria-hidden="true">⚡</span>
        <span className="sb__brand-name">LifeLift</span>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="sb__nav" aria-label="Main navigation">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className="sb__section">
            {section.title && (
              <h2 className="sb__section-title">{section.title}</h2>
            )}
            <ul className="sb__nav-list" role="list">
              {section.items.map(({ to, label, end: isEnd, icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={isEnd}
                    className={({ isActive }) =>
                      'sb__link' + (isActive ? ' sb__link--active' : '')
                    }
                  >
                    <span className="sb__link-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="sb__link-label">{label}</span>

                    {/* The glow pill that appears on the active item */}
                    <span className="sb__link-glow" aria-hidden="true" />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── User footer ────────────────────────────────────────────── */}
      <div className="sb__footer">
        <div className="sb__user">
          <div className="sb__avatar" aria-hidden="true">
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="sb__user-info">
            <span className="sb__user-name">{user?.username}</span>
            <NavLink to="/profile-edit" className="sb__edit-profile-link">
              Edit Profile
            </NavLink>
          </div>
        </div>

        <button
          className="sb__logout"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            width="17" height="17" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   HAMBURGER TRIGGER
   Attach to any topbar via <Sidebar.Trigger />.
   Must be rendered inside the same <SidebarProvider> as <Sidebar />.
═══════════════════════════════════════════════════════════════════ */
const Trigger = () => {
  const { isOpen, toggle } = useDrawer();

  return (
    <button
      className="sb__trigger"
      onClick={toggle}
      aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
      aria-expanded={isOpen}
    >
      <span className={`sb__hamburger${isOpen ? ' sb__hamburger--open' : ''}`}>
        <span /><span /><span />
      </span>
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT — <Sidebar />
   Reads drawer state from context (provided by an ancestor
   <SidebarProvider>). Does NOT create its own provider anymore.
═══════════════════════════════════════════════════════════════════ */
const Sidebar = () => {
  const { isOpen, close } = useDrawer();

  return (
    <>
      {/* Desktop — always visible */}
      <aside className="sb sb--desktop" aria-label="Main sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sb__overlay"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`sb sb--mobile${isOpen ? ' sb--open' : ''}`}
        aria-label="Navigation drawer"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        id="mobile-drawer"
      >
        <SidebarContent />
      </aside>
    </>
  );
};

/* Attach Trigger as a static property so callers use <Sidebar.Trigger /> */
Sidebar.Trigger = Trigger;

export default Sidebar;