import OscillateLogo from './OscillateLogo';

export default function Nav({ activePage, setActivePage, cartCount, onCartOpen, user, onLoginOpen, onLogout }) {
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={() => setActivePage('home')}>
        <OscillateLogo size={32} className="nav-logo-icon" />
        <span className="nav-logo-text">OSCILLATE</span>
      </div>

      <ul className="nav-links">
        {['home', 'events', 'merch', 'artists', 'about'].map(p => (
          <li key={p}>
            <a
              className={activePage === p ? 'active' : ''}
              onClick={() => setActivePage(p)}
            >
              {p.toUpperCase()}
            </a>
          </li>
        ))}
        {user && (
          <li>
            <a
              className={activePage === 'tickets' ? 'active' : ''}
              onClick={() => setActivePage('tickets')}
            >
              MY TICKETS
            </a>
          </li>
        )}
      </ul>

      <div className="nav-actions">
        {user ? (
          <>
            <span className="nav-user-badge" title={user.email}>
              {(user.email?.[0] ?? '?').toUpperCase()}
            </span>
            <button className="nav-auth-btn" onClick={onLogout}>LOGOUT</button>
          </>
        ) : (
          <button className="nav-auth-btn" onClick={onLoginOpen}>LOGIN</button>
        )}
        <button className="nav-cart-btn" onClick={onCartOpen}>
          CART
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>
    </nav>
  );
}
