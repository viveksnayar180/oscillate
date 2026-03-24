import { useState, useEffect } from 'react';
import StarField from './components/StarField';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Events from './components/Events';
import Merch from './components/Merch';
import About from './components/About';
import Cart from './components/Cart';
import Footer from './components/Footer';
import CheckIn from './components/CheckIn';

function Toast({ msg }) {
  return <div className="toast">{msg}</div>;
}

export default function App() {
  const [page, setPage] = useState(
    window.location.pathname === '/checkin' ? 'checkin' : 'home'
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function addToCart(item) {
    setCartItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        showToast('ALREADY IN CART');
        return prev;
      }
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

  // If on /checkin, render only the check-in page (no nav/cart)
  if (page === 'checkin') return <CheckIn />;

  return (
    <>
      <StarField />
      <Nav
        activePage={page}
        setActivePage={setPage}
        cartCount={cartItems.length}
        onCartOpen={() => setCartOpen(true)}
      />

      {page === 'home' && <Hero setActivePage={setPage} />}
      {page === 'events' && <Events onAddToCart={addToCart} showToast={showToast} />}
      {page === 'merch' && <Merch onAddToCart={addToCart} />}
      {page === 'about' && <About />}

      <Footer />

      {cartOpen && (
        <Cart
          items={cartItems}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onCheckoutSuccess={clearCart}
        />
      )}

      {toast && <Toast msg={toast} />}
    </>
  );
}
