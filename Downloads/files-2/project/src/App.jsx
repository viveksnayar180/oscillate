import { useState, useEffect } from 'react';
import StarField from './components/StarField';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Events from './components/Events';
import Merch from './components/Merch';
import About from './components/About';
import Artists from './components/Artists';
import ArtistPage from './components/ArtistPage';
import Cart from './components/Cart';
import Footer from './components/Footer';
import CheckIn from './components/CheckIn';
import Auth from './components/Auth';
import MyTickets from './components/MyTickets';
import Broadcast from './components/Broadcast';
import Admin from './components/Admin';
import { supabase } from './lib/supabase';

function Toast({ msg }) {
  return <div className="toast">{msg}</div>;
}

function getInitialPage() {
  const path = window.location.pathname;
  if (path === '/checkin')   return 'checkin';
  if (path === '/broadcast') return 'broadcast';
  if (path === '/admin')     return 'admin';
  return 'home';
}

export default function App() {
  const [page, setPage]                   = useState(getInitialPage);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [cartOpen, setCartOpen]           = useState(false);
  const [cartItems, setCartItems]         = useState([]);
  const [toast, setToast]                 = useState(null);
  const [user, setUser]                   = useState(null);
  const [authOpen, setAuthOpen]           = useState(false);

  // Supabase auth state listener
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setAuthOpen(false); // auto-close login modal on sign-in
    });
    return () => subscription.unsubscribe();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function addToCart(item) {
    setCartItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) { showToast('ALREADY IN CART'); return prev; }
      return [...prev, item];
    });
    showToast('ADDED TO CART');
  }

  function removeFromCart(id) {
    setCartItems(prev => prev.filter(i => i.id !== id));
  }

  function clearCart() {
    setCartItems([]);
    showToast('PAYMENT CONFIRMED');
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setPage('home');
  }

  // Standalone pages (no nav/footer)
  if (page === 'checkin')   return <CheckIn />;
  if (page === 'broadcast') return <Broadcast />;
  if (page === 'admin')     return <Admin />;

  return (
    <>
      <StarField />
      <Nav
        activePage={page}
        setActivePage={setPage}
        cartCount={cartItems.length}
        onCartOpen={() => setCartOpen(true)}
        user={user}
        onLoginOpen={() => setAuthOpen(true)}
        onLogout={handleLogout}
      />

      {page === 'home'    && <Hero setActivePage={setPage} />}
      {page === 'events'  && <Events onAddToCart={addToCart} showToast={showToast} />}
      {page === 'merch'   && <Merch onAddToCart={addToCart} />}
      {page === 'artists' && (
        <Artists
          onSetPage={setPage}
          onSelectArtist={a => { setSelectedArtist(a); setPage('artist'); }}
        />
      )}
      {page === 'artist' && selectedArtist && (
        <ArtistPage
          artist={selectedArtist}
          onBack={() => setPage('artists')}
          onSetPage={setPage}
        />
      )}
      {page === 'about'   && <About />}
      {page === 'tickets' && <MyTickets user={user} onSetPage={setPage} />}

      <Footer />

      {cartOpen && (
        <Cart
          items={cartItems}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onCheckoutSuccess={clearCart}
          user={user}
        />
      )}

      {authOpen && <Auth onClose={() => setAuthOpen(false)} />}

      {toast && <Toast msg={toast} />}
    </>
  );
}
