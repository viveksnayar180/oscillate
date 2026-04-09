import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { isAdmin, isPOS } from "@/lib/roles";
import { getEvents, getArtists } from "@/lib/db";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Corner Bracket decoration component
const Brackets = ({ color = "var(--accent)" }) => (
  <>
    <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 pointer-events-none z-10" style={{ borderColor: color }} />
  </>
);

// Choose Location Modal
const CITIES = ["MUMBAI", "BANGALORE", "DELHI", "GOA", "HYDERABAD", "PUNE", "CHENNAI", "BOX EXPORT"];
const ChooseLocationModal = ({ onClose, onSelect }) => (
  <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" onClick={onClose}
    style={{ background: "rgba(0,0,0,0.85)" }}>
    <div className="w-full max-w-sm" style={{ background: "#131313" }} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid #5e3f3820" }}>
        <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-2" style={{ color: "#ae887f" }}>
          OSCILLATE
        </p>
        <h2 className="font-display text-3xl uppercase" style={{ color: "#e5e2e1" }}>
          SELECT YOUR<br /><span style={{ color: "#ff562d" }}>ZONE</span>
        </h2>
      </div>
      {/* City list */}
      <div className="max-h-[60vh] overflow-y-auto">
        {CITIES.map(city => (
          <button key={city} onClick={() => { onSelect(city); onClose(); }}
            className="w-full flex items-center justify-between px-5 py-4 text-left group transition-all"
            style={{ borderBottom: "1px solid #5e3f3820" }}
            onMouseEnter={e => e.currentTarget.style.background = "#1c1b1b"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div>
              <p className="font-sg text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "#ae887f" }}>ZONE</p>
              <p className="font-display text-xl uppercase" style={{ color: "#e5e2e1" }}>{city}</p>
            </div>
            <span className="font-sg text-[9px]" style={{ color: "#5e3f38" }}>›</span>
          </button>
        ))}
      </div>
      <button onClick={onClose}
        className="w-full py-4 font-sg text-[10px] uppercase tracking-[0.2em]"
        style={{ color: "#ae887f", borderTop: "1px solid #5e3f3820" }}>
        CANCEL
      </button>
    </div>
  </div>
);

// Navbar
const Navbar = ({ cartCount, onCartClick, user, openAuth }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const doSearch = async (q) => {
    if (q.length < 2) { setSearchResults(null); return; }
    try { const r = await axios.get(`${API}/search?q=${encodeURIComponent(q)}`); setSearchResults(r.data); } catch {}
  };

  const links = ["HOME", "EVENTS", "ARTISTS", "MIXES", "ABOUT"];
  return (
    <>
      <nav data-testid="navbar" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/95 backdrop-blur-md border-b border-zinc-800" : "bg-transparent"}`}>
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 max-w-[1800px] mx-auto">
          <a href="/" data-testid="nav-logo" className="font-pixel text-base md:text-lg tracking-widest text-white hover:text-[#FF3B00] transition-colors">
            OSCILLATE
          </a>
          <div className="hidden lg:flex items-center gap-6">
            {links.map(l => (
              <a key={l} href={`#${l.toLowerCase()}`} data-testid={`nav-${l.toLowerCase()}`}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-[#FF3B00] transition-colors">
                {l}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {/* Zone selector */}
            <button onClick={() => setLocationOpen(true)}
              className="hidden md:flex items-center gap-1.5 font-sg text-[9px] uppercase tracking-[0.15em] px-3 py-1.5 transition-all"
              style={{ border: "1px solid #5e3f3840", color: "#ae887f" }}>
              <i className="fas fa-map-marker-alt text-[10px]" />
              {selectedCity || "SELECT ZONE"}
            </button>
            <button data-testid="nav-search" onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }} className="text-zinc-400 hover:text-[#FF3B00] transition-colors p-2">
              <i className="fas fa-search text-sm" />
            </button>
            {/* Profile / Auth */}
            {user ? (
              <a href="/profile" className="hidden md:flex items-center justify-center w-8 h-8 font-sg text-[11px] font-bold overflow-hidden"
                style={{ border: "1px solid #ff562d", color: "#ff562d", background: "#201f1f" }}
                title={user.email}>
                {user.user_metadata?.avatar_url
                  ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (user.email?.charAt(0) || "U").toUpperCase()
                }
              </a>
            ) : (
              <button onClick={openAuth}
                className="hidden md:block font-mono text-[10px] uppercase tracking-[0.2em] border border-zinc-700 px-3 py-1.5 hover:border-[#FF3B00] hover:text-[#FF3B00] transition-all">
                SIGN IN
              </button>
            )}
            {isPOS(user) && (
              <a href="/pos" data-testid="nav-pos-link" className="hidden md:block font-mono text-[10px] uppercase tracking-[0.2em] border border-zinc-700 px-3 py-1.5 hover:border-[#FF3B00] hover:text-[#FF3B00] transition-all">
                POS
              </a>
            )}
            {/* Mobile hamburger */}
            <button data-testid="nav-hamburger" onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }} className="lg:hidden text-zinc-400 hover:text-white p-2">
              <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"} text-lg`} />
            </button>
          </div>
        </div>
        {/* Search dropdown */}
        {searchOpen && (
          <div className="border-t border-zinc-800 bg-black/95 backdrop-blur-md px-4 py-3">
            <input data-testid="search-input" autoFocus value={searchQ} onChange={e => { setSearchQ(e.target.value); doSearch(e.target.value); }}
              placeholder="SEARCH EVENTS, ARTISTS..." className="w-full bg-transparent border-b border-zinc-700 pb-2 font-mono text-[12px] text-white uppercase tracking-[0.1em] placeholder:text-zinc-600 focus:border-[#FF3B00] focus:outline-none" />
            {searchResults && (searchResults.events?.length > 0 || searchResults.artists?.length > 0) && (
              <div className="mt-3 max-h-60 overflow-y-auto">
                {searchResults.events?.map(e => (
                  <a key={e.id} href={`/event/${e.id}`} className="block py-2 border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors">
                    <p className="font-mono text-[11px] text-white uppercase">{e.title}</p>
                    <p className="font-mono text-[9px] text-zinc-500">{e.date} · {e.city}</p>
                  </a>
                ))}
                {searchResults.artists?.map(a => (
                  <div key={a.id} className="py-2 border-b border-zinc-900">
                    <p className="font-mono text-[11px] text-white uppercase">{a.name} <span className="text-zinc-500 text-[9px]">{a.role}</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      {/* Mobile menu overlay */}
      {menuOpen && (
        <div data-testid="mobile-menu" className="fixed inset-0 z-[55] bg-black pt-16 px-6 flex flex-col gap-1 overflow-y-auto" onClick={() => setMenuOpen(false)}>
          <button onClick={() => { setMenuOpen(false); setLocationOpen(true); }}
            className="font-display text-3xl uppercase py-3 border-b border-zinc-900 text-left text-zinc-400">
            {selectedCity || "SELECT ZONE"}
          </button>
          {links.map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} className="font-display text-3xl uppercase py-3 border-b border-zinc-900 hover:text-[#FF3B00] transition-colors">{l}</a>
          ))}
          {isPOS(user) && <a href="/pos" className="font-display text-3xl uppercase py-3 border-b border-zinc-900 text-[#FF3B00]">POS</a>}
          {isAdmin(user) && <a href="/admin" className="font-display text-3xl uppercase py-3 border-b border-zinc-900 text-zinc-500">ADMIN</a>}
        </div>
      )}
      {/* Choose Location modal */}
      {locationOpen && (
        <ChooseLocationModal
          onClose={() => setLocationOpen(false)}
          onSelect={(city) => setSelectedCity(city)}
        />
      )}
    </>
  );
};

// Cart Drawer
const CartDrawer = ({ cart, onClose, onRemove, onCheckout, checking }) => {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <div className="fixed inset-0 z-[60] bg-black/80" onClick={onClose}>
      <div data-testid="cart-drawer" className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0A0A0A] border-l border-zinc-800 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white">CART ({cart.length})</p>
          <button data-testid="cart-close" onClick={onClose} className="text-zinc-500 hover:text-white text-lg">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <p className="text-center font-mono text-[11px] text-zinc-500 py-12">YOUR CART IS EMPTY</p>
          ) : cart.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-zinc-900">
              <div>
                <p className="font-mono text-[12px] uppercase">{item.name}</p>
                <p className="font-mono text-[10px] text-zinc-500">{item.size} &middot; QTY {item.qty}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-[12px] text-[#FF3B00]">₹{(item.price * item.qty).toLocaleString("en-IN")}</p>
                <button data-testid={`cart-remove-${i}`} onClick={() => onRemove(i)} className="text-zinc-600 hover:text-red-500 text-xs">&times;</button>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-800">
            <div className="flex justify-between mb-4">
              <span className="font-mono text-[11px] uppercase text-zinc-400">TOTAL</span>
              <span className="font-display text-2xl text-[#FF3B00]">₹{total.toLocaleString("en-IN")}</span>
            </div>
            <button data-testid="cart-checkout" onClick={onCheckout} disabled={checking} className="w-full py-3 bg-[#FF3B00] text-black font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-[#FF5722] transition-colors disabled:opacity-50">
              {checking ? "REDIRECTING..." : "CHECKOUT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Checkout Modal for merch
const MerchCheckoutModal = ({ cart, onClose, total }) => {
  const [form, setForm] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/merch/checkout`, {
        items: cart.map(c => ({ id: c.id, size: c.size, qty: c.qty })),
        buyer_name: form.name, buyer_email: form.email, origin_url: window.location.origin,
      });
      if (res.data.url) window.location.href = res.data.url;
    } catch (e) { console.error(e); alert("Checkout failed"); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div data-testid="merch-checkout-modal" className="bg-[#0A0A0A] border border-zinc-800 p-8 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">&times;</button>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-2">MERCH CHECKOUT</p>
        <p className="font-display text-3xl mb-6">₹{total.toLocaleString("en-IN")}</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="block font-mono text-[10px] uppercase text-zinc-500 mb-1">FULL NAME</label>
            <input data-testid="merch-checkout-name" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full bg-black border border-zinc-700 px-3 py-2.5 font-mono text-[12px] text-white placeholder:text-zinc-600 focus:border-[#FF3B00] focus:outline-none" placeholder="Your name" /></div>
          <div><label className="block font-mono text-[10px] uppercase text-zinc-500 mb-1">EMAIL</label>
            <input data-testid="merch-checkout-email" required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full bg-black border border-zinc-700 px-3 py-2.5 font-mono text-[12px] text-white placeholder:text-zinc-600 focus:border-[#FF3B00] focus:outline-none" placeholder="your@email.com" /></div>
          <button data-testid="merch-checkout-pay" type="submit" disabled={submitting} className="w-full py-3 bg-[#FF3B00] text-black font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-[#FF5722] disabled:opacity-50">
            {submitting ? "REDIRECTING TO PAYMENT..." : `PAY ₹${total.toLocaleString("en-IN")}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// Hero Section
const Hero = ({ featured }) => (
  <section data-testid="hero-section" id="home" className="relative h-screen w-full overflow-hidden">
    <div className="absolute inset-0">
      <img src="https://oscillate-eta.vercel.app/photos/gig-hero.jpg" alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 grid-overlay" />
    </div>
    <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-12 pb-8 max-w-[1800px] mx-auto">
      <div className="mb-12 opacity-0 animate-fade-in-up">
        <img src="https://oscillate-eta.vercel.app/oscillate-logo.png" alt="OSCILLATE" className="w-28 h-28 mb-6 invert brightness-200" />
        <h1 className="font-display text-[clamp(3rem,10vw,9rem)] uppercase leading-[0.85] tracking-tighter text-white">
          UNDERGROUND.<br/>TECHNO.<br/>INDIA.
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400 mt-6">
          TECHNO COLLECTIVE · BANGALORE, INDIA
        </p>
        <a href="#events" data-testid="hero-get-tickets" className="inline-block mt-8 px-8 py-3 border-2 border-[#FF3B00] text-[#FF3B00] font-mono text-sm uppercase tracking-widest hover:bg-[#FF3B00] hover:text-black transition-all duration-200">
          GET TICKETS
        </a>
      </div>
      {featured && (
        <div data-testid="featured-event-bar" className="border-t border-zinc-700 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 opacity-0 animate-fade-in-up delay-300">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">EVENT</span>
            <p className="font-display text-lg uppercase mt-1">{featured.title}</p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">DATE</span>
            <p className="font-display text-lg uppercase mt-1">{featured.date}</p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">VENUE</span>
            <p className="font-display text-lg uppercase mt-1">{featured.city}</p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">FROM</span>
            <p className="font-display text-lg uppercase mt-1 text-[#FF3B00]">{featured.price}</p>
          </div>
        </div>
      )}
    </div>
  </section>
);

// Marquee
const Marquee = () => {
  const items = "UNDERGROUND · BENGALURU · TECHNO · NO COMPROMISE · MÜNCHEN · SOUND FIRST · DARK TECHNO · THE COLLECTIVE · ".repeat(4);
  return (
    <div data-testid="marquee" className="border-y border-zinc-800 py-4 overflow-hidden bg-black">
      <div className="marquee-track whitespace-nowrap inline-flex">
        <span className="font-display text-6xl md:text-8xl uppercase text-transparent" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.15)" }}>
          {items}
        </span>
      </div>
    </div>
  );
};

// Stats
const StatsSection = ({ stats }) => {
  const items = [
    { value: `${stats.events_hosted}+`, label: "EVENTS HOSTED" },
    { value: `${stats.artists_platformed}+`, label: "ARTISTS PLATFORMED" },
    { value: stats.community, label: "COMMUNITY" },
    { value: stats.cities, label: "CITIES" },
  ];
  return (
    <section data-testid="stats-section" className="border-b border-zinc-800 bg-black">
      <div className="max-w-[1800px] mx-auto grid grid-cols-2 md:grid-cols-4">
        {items.map((s, i) => (
          <div key={i} className={`p-8 md:p-12 ${i < 3 ? "border-r border-zinc-800" : ""} text-center`}>
            <p className="font-display text-5xl md:text-6xl text-white">{s.value}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-3">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

// Collective About
const CollectiveSection = () => (
  <section data-testid="collective-section" className="py-20 px-6 md:px-12 max-w-[1800px] mx-auto">
    <div className="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-4">THE COLLECTIVE</p>
        <h2 className="font-display text-5xl md:text-7xl uppercase leading-[0.9]">
          UNDERGROUND.<br />UNAPOLOGETIC.<br />BENGALURU.
        </h2>
      </div>
      <div className="border-l border-zinc-800 pl-8">
        <p className="font-mono text-sm text-zinc-400 leading-relaxed">
          No headliners. No guestlists. We book artists we believe in and build rooms we'd want to be in. This is Bengaluru's underground — uncompromised, intentional, and just getting started.
        </p>
        <a href="#about" data-testid="our-story-link" className="inline-block mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[#FF3B00] border-b border-[#FF3B00] pb-1 hover:text-white hover:border-white transition-colors">
          OUR STORY
        </a>
      </div>
    </div>
  </section>
);

// Gallery
const Gallery = ({ images }) => (
  <section data-testid="gallery-section" className="border-y border-zinc-800">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {images.slice(0, 8).map((img, i) => (
        <div key={img.id || i} className="relative aspect-square overflow-hidden group border-r border-b border-zinc-800">
          <img src={img.url} alt={img.caption} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105" loading="lazy" />
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300" />
          <p className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">{img.caption}</p>
        </div>
      ))}
    </div>
  </section>
);

// ── THE FEED — RA-style event row ──────────────────────────────────────────
const FeedRow = ({ event, index }) => {
  const VN = {
    surfaceLow: "#1c1b1b",
    surfaceMid: "#201f1f",
    cta:        "#ff562d",
    ctaText:    "#560d00",
    onSurface:  "#e5e2e1",
    onSurfaceVar:"#e8bdb3",
    outline:    "#ae887f",
    outlineVar: "#5e3f38",
  };
  return (
    <div data-testid={`event-card-${event.id}`}
      className="group flex items-stretch gap-0 transition-all duration-200"
      style={{ borderBottom: `1px solid ${VN.outlineVar}25` }}
      onMouseEnter={e => e.currentTarget.style.background = VN.surfaceLow}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

      {/* Left: index + content */}
      <div className="flex-1 px-5 py-6 md:px-8 md:py-7 flex flex-col justify-between">
        <div>
          {/* Number + genre tags */}
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-[9px] w-5" style={{ color: VN.outlineVar }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            {event.genre && (
              <span className="font-sg text-[8px] uppercase tracking-[0.2em] px-2 py-0.5"
                style={{ background: VN.surfaceMid, color: VN.outline }}>
                {event.genre}
              </span>
            )}
            {event.subgenre && (
              <span className="font-sg text-[8px] uppercase tracking-[0.2em] px-2 py-0.5"
                style={{ background: VN.surfaceMid, color: VN.outlineVar }}>
                {event.subgenre}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-display text-2xl md:text-3xl uppercase leading-tight mb-2"
            style={{ color: VN.onSurface }}>
            {event.title}
          </h3>

          {/* Venue + lineup */}
          <p className="font-sg text-[11px] uppercase mb-1" style={{ color: VN.outline }}>
            {event.venue} · {event.city}
          </p>
          {event.lineup?.length > 0 && (
            <p className="font-mono text-[10px] uppercase" style={{ color: VN.outlineVar }}>
              {event.lineup.join(" · ")}
            </p>
          )}
        </div>

        {/* Bottom: date + price + tickets */}
        <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
          <div>
            <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-0.5" style={{ color: VN.outlineVar }}>DATE</p>
            <p className="font-sg text-[11px] uppercase" style={{ color: VN.cta }}>{event.date}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm" style={{ color: VN.onSurface }}>
              {event.price}
            </span>
            <a href={`/event/${event.id}`} data-testid={`event-tickets-${event.id}`}
              className="font-sg font-bold text-[10px] uppercase tracking-[0.15em] px-5 py-2.5 transition-all"
              style={{ background: VN.cta, color: VN.ctaText }}>
              GET TICKETS
            </a>
          </div>
        </div>
      </div>

      {/* Right: flyer image */}
      {event.flyer_url ? (
        <div className="w-28 md:w-40 flex-shrink-0 overflow-hidden">
          <img src={event.flyer_url} alt={event.title}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" loading="lazy" />
        </div>
      ) : (
        <div className="w-28 md:w-40 flex-shrink-0 flex items-center justify-center"
          style={{ background: VN.surfaceMid }}>
          <span className="font-display text-2xl uppercase text-center px-2" style={{ color: VN.outlineVar }}>
            {event.city || "—"}
          </span>
        </div>
      )}
    </div>
  );
};

// Events Section — THE FEED
const EventsSection = ({ events }) => {
  const [filter, setFilter] = useState("ALL");
  const cities = ["ALL", ...new Set(events.map(e => e.city).filter(Boolean))];
  const filtered = filter === "ALL" ? events : events.filter(e => e.city === filter);

  const VN = {
    surface:    "#131313",
    surfaceLow: "#1c1b1b",
    cta:        "#ff562d",
    ctaText:    "#560d00",
    onSurface:  "#e5e2e1",
    outline:    "#ae887f",
    outlineVar: "#5e3f38",
  };

  return (
    <section data-testid="events-section" id="events" className="border-t border-zinc-800"
      style={{ background: VN.surface }}>

      {/* Section header */}
      <div className="px-6 md:px-12 pt-16 pb-8 max-w-[1800px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-3" style={{ color: VN.outline }}>
              OSCILLATE · COLLECTIVE GIGS
            </p>
            <h2 className="font-display text-5xl md:text-7xl uppercase" style={{ color: VN.onSurface }}>
              THE FEED
            </h2>
          </div>
          {/* City filters */}
          <div className="flex gap-2 flex-wrap">
            {cities.map(c => (
              <button key={c} data-testid={`filter-${c.toLowerCase()}`}
                onClick={() => setFilter(c)}
                className="font-sg text-[9px] uppercase tracking-[0.15em] px-4 py-2 transition-all"
                style={filter === c
                  ? { background: VN.cta, color: VN.ctaText }
                  : { border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-6">
          <span className="font-sg text-[9px] uppercase tracking-[0.2em]" style={{ color: VN.outlineVar }}>
            {filtered.length} UPCOMING
          </span>
          <a href="/search" className="font-sg text-[9px] uppercase tracking-[0.2em]" style={{ color: VN.outline }}>
            ADVANCED SEARCH →
          </a>
        </div>
      </div>

      {/* Feed list */}
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 pb-16">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-sg text-[11px] uppercase tracking-[0.2em]" style={{ color: VN.outlineVar }}>
              NO EVENTS IN THIS ZONE YET
            </p>
          </div>
        ) : (
          <div style={{ borderTop: `1px solid ${VN.outlineVar}25` }}>
            {filtered.map((ev, i) => <FeedRow key={ev.id} event={ev} index={i} />)}
          </div>
        )}
      </div>
    </section>
  );
};

// Artists Section
const ArtistsSection = ({ artists }) => (
  <section data-testid="artists-section" id="artists" className="py-20 border-t border-zinc-800">
    <div className="px-6 md:px-12 max-w-[1800px] mx-auto">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-3">RESIDENTS</p>
      <h2 className="font-display text-5xl md:text-7xl uppercase mb-12">ARTISTS</h2>
      <div className="border-t border-zinc-800">
        {artists.map((a, i) => (
          <div key={a.id || i} data-testid={`artist-${a.name.toLowerCase().replace(/\s/g, '-')}`}
            className="flex items-center justify-between py-5 border-b border-zinc-800 group hover:bg-zinc-950/50 px-4 transition-colors">
            <div className="flex items-center gap-6">
              <span className="font-mono text-[11px] text-zinc-600 w-6">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-display text-2xl md:text-3xl uppercase group-hover:text-[#FF3B00] transition-colors">{a.name}</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">{a.role}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Platform Section
const PlatformSection = () => {
  const items = [
    { num: "01", title: "EVENTS", desc: "Underground events across India. Book tickets, follow artists, never miss a show.", link: "#events" },
    { num: "02", title: "MIXES", desc: "A broadcast from the underground. Mix series, recorded sets, transmissions.", link: "#mixes" },
    { num: "03", title: "COLLECTIVES", desc: "The network behind the music. Oscillate, and more.", link: "#collectives" },
  ];
  return (
    <section data-testid="platform-section" id="about" className="py-20 px-6 md:px-12 max-w-[1800px] mx-auto border-t border-zinc-800">
      <div className="mb-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-3">THE PLATFORM</p>
        <h2 className="font-display text-5xl md:text-7xl uppercase leading-[0.9]">
          INDIA'S<br />UNDERGROUND<br />PLATFORM.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-px bg-zinc-800">
        {items.map(it => (
          <div key={it.num} className="relative bg-[#0A0A0A] p-8 group hover:bg-zinc-950 transition-colors">
            <Brackets />
            <span className="font-mono text-[11px] text-zinc-600 mb-4 block">{it.num}</span>
            <h3 className="font-display text-3xl uppercase mb-3">{it.title}</h3>
            <p className="font-mono text-[12px] text-zinc-400 leading-relaxed mb-6">{it.desc}</p>
            <a href={it.link} className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#FF3B00] border-b border-[#FF3B00] pb-1 hover:text-white hover:border-white transition-colors">
              EXPLORE
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};

// Newsletter / Footer
const Footer = () => {
  const [email, setEmail] = useState("");
  const [subbed, setSubbed] = useState(false);
  const handleSub = async (e) => {
    e.preventDefault();
    if (!email) return;
    try {
      await axios.post(`${API}/newsletter`, { email });
      setSubbed(true);
    } catch { /* ignore */ }
  };
  return (
    <footer data-testid="footer" className="border-t border-zinc-800 py-16 px-6 md:px-12 bg-black">
      <div className="max-w-[1800px] mx-auto grid md:grid-cols-2 gap-12">
        <div>
          <p className="font-pixel text-xl tracking-widest text-white mb-3">OSCILLATE</p>
          <p className="font-mono text-[11px] text-zinc-500 uppercase tracking-[0.15em]">
            TECHNO COLLECTIVE · BANGALORE · INDIA
          </p>
          <div className="flex gap-4 mt-6">
            <a href="#" data-testid="social-instagram" className="text-zinc-500 hover:text-[#FF3B00] transition-colors"><i className="fab fa-instagram text-lg"></i></a>
            <a href="#" data-testid="social-soundcloud" className="text-zinc-500 hover:text-[#FF3B00] transition-colors"><i className="fab fa-soundcloud text-lg"></i></a>
            <a href="#" data-testid="social-youtube" className="text-zinc-500 hover:text-[#FF3B00] transition-colors"><i className="fab fa-youtube text-lg"></i></a>
          </div>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400 mb-4">GET UPDATES</p>
          {subbed ? (
            <p className="font-mono text-sm text-[#FF3B00]">SUBSCRIBED.</p>
          ) : (
            <form onSubmit={handleSub} className="flex">
              <input data-testid="newsletter-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="YOUR EMAIL" className="flex-1 bg-transparent border border-zinc-700 px-4 py-3 font-mono text-[12px] text-white placeholder:text-zinc-600 uppercase tracking-[0.1em] focus:border-[#FF3B00] focus:outline-none transition-colors" />
              <button data-testid="newsletter-submit" type="submit"
                className="px-6 py-3 bg-[#FF3B00] text-black font-mono text-[12px] uppercase tracking-[0.15em] hover:bg-[#FF5722] transition-colors">
                SUBSCRIBE
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="max-w-[1800px] mx-auto mt-12 pt-6 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.15em]">© 2026 OSCILLATE. ALL RIGHTS RESERVED.</p>
        <div className="flex gap-4 flex-wrap justify-center md:justify-end">
          <a href="/privacy" className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.15em] hover:text-zinc-400 transition-colors">PRIVACY</a>
          <a href="/terms" className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.15em] hover:text-zinc-400 transition-colors">TERMS</a>
          <a href="/cookies" className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.15em] hover:text-zinc-400 transition-colors">COOKIES</a>
          <a href="/refund" className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.15em] hover:text-zinc-400 transition-colors">REFUNDS</a>
        </div>
      </div>
    </footer>
  );
};

// Merch Section
const MerchSection = ({ merch, onAddToCart }) => {
  const [filter, setFilter] = useState("all");
  const [selectedSizes, setSelectedSizes] = useState({});
  const cats = ["all", "tees", "hoodies", "accessories"];
  const filtered = filter === "all" ? merch : merch.filter(m => m.category === filter);
  return (
    <section data-testid="merch-section" id="merch" className="py-20 px-6 md:px-12 max-w-[1800px] mx-auto border-t border-zinc-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-3">SIGNAL 001 DROP</p>
          <h2 className="font-display text-5xl md:text-7xl uppercase">MERCH</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {cats.map(c => (
            <button key={c} data-testid={`merch-filter-${c}`} onClick={() => setFilter(c)}
              className={`font-mono text-[10px] uppercase tracking-[0.15em] px-4 py-2 border transition-all duration-200 ${filter === c ? "border-[#FF3B00] bg-[#FF3B00] text-black" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {c === "all" ? "ALL ITEMS" : c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-800">
        {filtered.map(item => {
          const size = selectedSizes[item.id] || item.sizes?.[0] || "";
          return (
          <div key={item.id} className="bg-[#0A0A0A] relative group">
            <div className="relative border border-zinc-800 hover:border-[#FF3B00] transition-all">
              <Brackets />
              <div className="aspect-square bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                <span className="font-display text-3xl text-zinc-800 group-hover:text-zinc-700 transition-colors text-center px-4">{item.name}</span>
                {item.label && (
                  <span className="absolute top-3 left-3 font-mono text-[8px] uppercase tracking-[0.15em] px-2 py-1 bg-[#FF3B00] text-black">{item.label}</span>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-display text-xl uppercase mb-1">{item.name}</h3>
                <p className="font-mono text-[11px] text-zinc-500 uppercase mb-3">{item.sub}</p>
                {item.sizes?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-3">
                    {item.sizes.map(s => (
                      <button key={s} onClick={() => setSelectedSizes(p => ({...p, [item.id]: s}))}
                        className={`font-mono text-[9px] px-2 py-1 border transition-all ${size === s ? "border-[#FF3B00] text-[#FF3B00]" : "border-zinc-800 text-zinc-500 hover:border-zinc-600"}`}>{s}</button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className="font-mono text-sm text-white">₹{item.price?.toLocaleString("en-IN")} <span className="text-[9px] text-zinc-600">INC. GST</span></span>
                  <button data-testid={`merch-add-${item.id}`} onClick={() => onAddToCart({ id: item.id, name: item.name, size, price: item.price, qty: 1 })}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 border border-[#FF3B00] text-[#FF3B00] hover:bg-[#FF3B00] hover:text-black transition-all">+ CART</button>
                </div>
              </div>
            </div>
          </div>
        );})}
      </div>
    </section>
  );
};

// Archive Section (past events)
const ArchiveSection = ({ events }) => (
  <section data-testid="archive-section" className="py-16 px-6 md:px-12 max-w-[1800px] mx-auto border-t border-zinc-800">
    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500 mb-3">PAST EVENTS</p>
    <h2 className="font-display text-4xl md:text-5xl uppercase mb-8">ARCHIVE</h2>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-800">
      {events.map(ev => (
        <div key={ev.id} className="bg-[#0A0A0A]">
          <div className="relative border border-zinc-800 group hover:opacity-100 transition-opacity">
            <Brackets color="#555" />
            <div className="aspect-square bg-zinc-900 overflow-hidden relative">
              {ev.flyer_url ? (
                <img src={ev.flyer_url} alt={ev.title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><span className="font-display text-3xl uppercase text-zinc-800 text-center px-4">{ev.title}</span></div>
              )}
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all" />
              <span className="absolute top-3 right-3 font-mono text-[8px] uppercase tracking-[0.15em] px-2 py-1 bg-zinc-700 text-zinc-300">PAST</span>
            </div>
            <div className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{ev.date}</p>
              <h3 className="font-display text-xl uppercase mb-2">{ev.title}</h3>
              <p className="font-mono text-[11px] text-zinc-600 uppercase">{ev.venue} · {ev.city}</p>
              <div className="mt-1 font-mono text-[10px] text-zinc-700 uppercase">{ev.lineup?.join(" · ")}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

// Second Marquee
const Marquee2 = () => {
  const items = "TECHNO · BENGALURU · OSCILLATE · UNDERGROUND · AMBIENT · INDUSTRIAL · DARK TECHNO · SIGNAL · COLLECTIVE · INDIA · LIVE AV · SUNRISE · ".repeat(4);
  return (
    <div className="border-y border-zinc-800 py-3 overflow-hidden bg-black">
      <div className="marquee-track whitespace-nowrap inline-flex" style={{ animationDirection: "reverse", animationDuration: "40s" }}>
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-600">
          {items}
        </span>
      </div>
    </div>
  );
};

// ---------- MAIN PAGE ----------
export default function LandingPage({ user, openAuth }) {
  const [events, setEvents] = useState([]);
  const [artists, setArtists] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [stats, setStats] = useState({ events_hosted: 18, artists_platformed: 40, community: "5K+", cities: 3 });
  const [featured, setFeatured] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Load events from Supabase (source of truth), fallback to API
        const [supabaseEvents, supabaseArtists] = await Promise.all([
          getEvents(),
          getArtists(),
        ]);

        if (supabaseEvents.length > 0) {
          setEvents(supabaseEvents.map(e => ({ ...e, title: e.name })));
        } else {
          // Fallback to production API
          const evRes = await axios.get(`${API}/events`);
          const evData = evRes.data;
          setEvents(Array.isArray(evData) ? evData : evData.events || []);
        }

        if (supabaseArtists.length > 0) {
          setArtists(supabaseArtists);
        } else {
          const artRes = await axios.get(`${API}/artists`);
          const artData = artRes.data;
          setArtists(Array.isArray(artData) ? artData : artData.artists || []);
        }

        // These still come from API
        const [galRes, stRes, ftRes] = await Promise.all([
          axios.get(`${API}/gallery`).catch(() => ({ data: [] })),
          axios.get(`${API}/stats`).catch(() => ({ data: { events_hosted: 18, artists_platformed: 40, community: "5K+", cities: 3 } })),
          axios.get(`${API}/events/featured/next`).catch(() => ({ data: null })),
        ]);
        const galData = galRes.data;
        setGallery(Array.isArray(galData) ? galData : galData.gallery || []);
        setStats(stRes.data);
        setFeatured(ftRes.data);
      } catch (e) { console.error("Load error", e); }
    };
    load();
  }, []);

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.findIndex(c => c.id === item.id && c.size === item.size);
      if (existing >= 0) { const n = [...prev]; n[existing].qty += 1; return n; }
      return [...prev, item];
    });
    setCartOpen(true);
  };

  const removeFromCart = (index) => setCart(prev => prev.filter((_, i) => i !== index));

  // Sort: upcoming (date > now) ascending, past (date ≤ now) descending
  const now = new Date();
  const upcoming = events
    .filter(e => e.date_iso ? new Date(e.date_iso) > now : !e.is_past)
    .sort((a, b) => new Date(a.date_iso || 0) - new Date(b.date_iso || 0));
  const past = events
    .filter(e => e.date_iso ? new Date(e.date_iso) <= now : e.is_past)
    .sort((a, b) => new Date(b.date_iso || 0) - new Date(a.date_iso || 0));

  return (
    <div data-testid="landing-page" className="min-h-screen bg-[#0A0A0A] text-white">
      <Navbar cartCount={cart.length} onCartClick={() => setCartOpen(true)} user={user} openAuth={openAuth} />
      <Hero featured={featured} />
      <Marquee />
      <StatsSection stats={stats} />
      <CollectiveSection />
      <Gallery images={gallery} />
      <EventsSection events={upcoming} />
      {past.length > 0 && <ArchiveSection events={past} />}
      <ArtistsSection artists={artists} />
      <PlatformSection />
      <Marquee2 />
      <Footer />
      {cartOpen && <CartDrawer cart={cart} onClose={() => setCartOpen(false)} onRemove={removeFromCart} onCheckout={() => setCartOpen(false)} />}
    </div>
  );
}
