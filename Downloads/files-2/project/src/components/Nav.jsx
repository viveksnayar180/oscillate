import { useState, useEffect } from 'react';
import OscillateLogo from './OscillateLogo';

export default function Nav({ activePage, setActivePage, cartCount, onCartOpen, user, onLoginOpen, onLogout }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 20); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [activePage]);

  return (
    <>
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-logo" onClick={() => setActivePage('home')}>
          <OscillateLogo size={40} className="nav-logo-icon" />
        </div>

        <ul className="nav-links">
          {[
            { id: 'home',        label: 'HOME',        num: '01' },
            { id: 'events',      label: 'EVENTS',      num: '02' },
            { id: 'mixes',       label: 'MIXES',       num: '03' },
            { id: 'collectives', label: 'COLLECTIVES', num: '04' },
            { id: 'artists',     label: 'ARTISTS',     num: '05' },
            { id: 'about',       label: 'ABOUT',       num: '06' },
          ].map(({ id, label, num }) => (
            <li key={id}>
              <a
                className={activePage === id ? 'active' : ''}
                onClick={() => setActivePage(id)}
              >
                {activePage === id && <span className="nav-arrow">▶</span>}
                <span className="nav-num">{num}</span>
                {label}
              </a>
            </li>
          ))}
          {user && (
            <li>
              <a
                className={activePage === 'tickets' ? 'active' : ''}
                onClick={() => setActivePage('tickets')}
              >
                {activePage === 'tickets' && <span className="nav-arrow">▶</span>}
                <span className="nav-num">07</span>
                MY TICKETS
              </a>
            </li>
          )}
        </ul>

        <div className="nav-actions">
          {/* Search icon */}
          <button
            className="nav-icon-btn"
            onClick={() => setSearchOpen(o => !o)}
            aria-label="Search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {user ? (
            <>
              <button
                className="nav-avatar-btn"
                onClick={() => setActivePage('profile')}
                title="My Profile"
              >
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="avatar" className="nav-avatar-img" />
                  : <span className="nav-avatar-initials">{(user.email?.[0] ?? '?').toUpperCase()}</span>
                }
              </button>
              <button className="nav-auth-btn nav-auth-desktop" onClick={onLogout}>LOGOUT</button>
            </>
          ) : (
            <button className="nav-auth-btn nav-auth-login" onClick={onLoginOpen}>LOGIN</button>
          )}

          {/* Icon cart */}
          <button className="nav-cart-icon-btn" onClick={onCartOpen} aria-label="Cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>

          {/* Hamburger (mobile only) */}
          <button
            className="nav-hamburger"
            onClick={() => setDrawerOpen(o => !o)}
            aria-label="Menu"
          >
            <span className="nav-hamburger-line" />
            <span className="nav-hamburger-line" />
            <span className="nav-hamburger-line" />
          </button>
        </div>
      </nav>

      {/* Inline search bar */}
      <div className={`nav-search-bar${searchOpen ? ' open' : ''}`}>
        <input
          className="nav-search-input"
          placeholder="SEARCH EVENTS · ARTISTS"
          autoFocus={searchOpen}
        />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="nav-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="nav-drawer" onClick={e => e.stopPropagation()}>
            {['home', 'events', 'mixes', 'collectives', 'artists', 'about'].map(p => (
              <a
                key={p}
                className={`nav-drawer-link${activePage === p ? ' active' : ''}`}
                onClick={() => setActivePage(p)}
              >
                {p.toUpperCase()}
              </a>
            ))}
            {user && (
              <>
                <a
                  className={`nav-drawer-link${activePage === 'tickets' ? ' active' : ''}`}
                  onClick={() => setActivePage('tickets')}
                >
                  MY TICKETS
                </a>
                <a
                  className={`nav-drawer-link${activePage === 'profile' ? ' active' : ''}`}
                  onClick={() => setActivePage('profile')}
                >
                  MY PROFILE
                </a>
              </>
            )}
            <div className="nav-drawer-actions">
              {user ? (
                <button className="nav-auth-btn" onClick={onLogout}>LOGOUT</button>
              ) : (
                <button className="nav-auth-btn" onClick={onLoginOpen}>LOGIN</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
