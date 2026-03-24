import OscillateLogo from './OscillateLogo';

export default function Nav({ activePage, setActivePage, cartCount, onCartOpen }) {
  return (
    <nav className="nav">
      <div className="nav-logo" onClick={() => setActivePage('home')}>
        <OscillateLogo size={32} className="nav-logo-icon" />
        <span className="nav-logo-text">OSCILLATE</span>
      </div>

      <ul className="nav-links">
        {['home', 'events', 'merch', 'about'].map(p => (
          <li key={p}>
            <a
              className={activePage === p ? 'active' : ''}
              onClick={() => setActivePage(p)}
            >
              {p.toUpperCase()}
            </a>
          </li>
        ))}
      </ul>

      <button className="nav-cart-btn" onClick={onCartOpen}>
        CART
        {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
      </button>
    </nav>
  );
}
