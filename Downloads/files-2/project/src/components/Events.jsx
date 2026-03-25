import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── Upcoming events ──────────────────────────────────────────────────────────
const EVENTS = [
  {
    id: 1,
    name: 'ÜBERKIKZ × OSCILLATE',
    isoDate: '2026-04-11T17:00:00+05:30',
    date: 'SAT APR 11, 2026',
    day: 'SAT',
    dateShort: 'APR 11',
    venue: 'To Be Announced',
    city: 'Bengaluru',
    time: '5:00 PM ONWARDS',
    tags: ['TECHNO', 'INTERNATIONAL'],
    collab: 'SPACENAUT × TECHNO AFFAIRS',
    desc: 'ÜBERKIKZ lands in India for the first time. Bengaluru gets the first transmission — a night of relentless groove built on cutting-edge sound. Co-presented with SPACENAUT and TECHNO AFFAIRS.',
    flyer: '/flyers/uberkikz.jpg',
    setTimes: [
      { artist: 'MARLON', time: '17:00 — 19:00', note: 'Opening' },
      { artist: 'ANNABSTRACTS', time: '19:00 — 21:00', note: '' },
      { artist: 'ODDIBLE', time: '21:00 — 23:00', note: '' },
      { artist: 'ÜBERKIKZ', time: '23:00 — 01:00', note: 'Headliner' },
    ],
    tiers: [
      { name: 'EARLY BIRD',  price: '₹569',   perks: 'Limited availability', available: true, capacity: 100, sold: 73 },
      { name: 'STANDARD',    price: '₹799',   perks: 'General admission',    available: true, capacity: 300, sold: 141 },
      { name: 'PREMIUM',     price: '₹1,299', perks: 'Priority entry + merch', available: true, capacity: 50,  sold: 31 },
    ],
    num: '01',
  },
  {
    id: 2,
    name: 'SIGNAL 002',
    isoDate: '2026-05-17T22:00:00+05:30',
    date: 'SAT MAY 17, 2026',
    day: 'SAT',
    dateShort: 'MAY 17',
    venue: 'Subterranean',
    city: 'Bengaluru',
    time: '10:00 PM — 6:00 AM',
    tags: ['DARK TECHNO', 'INDUSTRIAL', 'LIVE AV'],
    collab: 'OSCILLATE RESIDENTS',
    desc: 'The second transmission. Deeper, darker, more intense. OSCILLATE\'s resident lineup takes over Subterranean for an all-night journey through the lower frequencies.',
    flyer: null,
    setTimes: [
      { artist: 'MALWARE', time: '22:00 — 00:00', note: 'Opening' },
      { artist: 'ODDIBLE', time: '00:00 — 02:00', note: '' },
      { artist: 'UPHORIA', time: '02:00 — 04:00', note: '' },
      { artist: 'TBA', time: '04:00 — 06:00', note: 'Closing' },
    ],
    tiers: [
      { name: 'EARLY BIRD',  price: '₹699',   perks: 'Limited — earlybird rate', available: true, capacity: 80,  sold: 12 },
      { name: 'STANDARD',    price: '₹999',   perks: 'General admission',         available: true, capacity: 250, sold: 0 },
      { name: 'VIP PASS',    price: '₹1,999', perks: 'VIP access + meet & greet', available: true, capacity: 30,  sold: 0 },
    ],
    num: '02',
  },
  {
    id: 3,
    name: 'STELLAR MAP',
    isoDate: '2026-06-21T04:00:00+05:30',
    date: 'SUN JUN 21, 2026',
    day: 'SUN',
    dateShort: 'JUN 21',
    venue: 'Open Air · Location TBA',
    city: 'Goa',
    time: '4:00 AM — 10:00 AM (SUNRISE)',
    tags: ['AMBIENT TECHNO', 'SUNRISE', 'OUTDOOR'],
    collab: 'OSCILLATE × TBA',
    desc: 'The longest day of the year. A sunrise set somewhere in Goa. Exact location released to ticket holders 48 hours before. Bring your signal.',
    flyer: null,
    setTimes: [
      { artist: 'MALWARE', time: '04:00 — 06:00', note: 'Pre-dawn' },
      { artist: 'ODDIBLE', time: '06:00 — 08:00', note: 'Sunrise' },
      { artist: 'UPHORIA', time: '08:00 — 10:00', note: 'Closing' },
    ],
    tiers: [
      { name: 'GENERAL',             price: '₹1,499', perks: 'General admission',                available: true, capacity: 200, sold: 0 },
      { name: "COLLECTOR'S BUNDLE",  price: '₹4,999', perks: 'Ticket + exclusive tee + lanyard', available: true, capacity: 40,  sold: 0 },
    ],
    num: '03',
  },
];

// ─── Real past events (from flyers) ──────────────────────────────────────────
const PAST_EVENTS = [
  {
    id: 'p4',
    name: 'OSCILLATE',
    subtitle: 'CHAPTER IV',
    date: 'MAR 15, 2026',
    city: 'Bengaluru',
    lineup: ['FUTURE 666', 'ODDIBLE', 'MALWARE', 'VYAPI', 'MAGNIMUS'],
    tags: ['TECHNO'],
    flyer: '/flyers/march-15.jpg',
  },
  {
    id: 'p6',
    name: 'OSCILLATE',
    subtitle: 'HALLOWEEN',
    date: 'NOV 1, 2025',
    city: 'Bengaluru',
    time: '5PM+',
    lineup: ['DSTM', 'LE KLOWN', 'ODDIBLE', 'ANNABSTRACT', 'FLUID STATE', 'MALWARE', 'ZEKT', 'ANUSHA', 'MARLON'],
    note: 'CUORE × CHAOS CIRCUIT × OSCILLATE × HEAT',
    tags: ['TECHNO', 'HALLOWEEN', 'COLLAB'],
    flyer: '/flyers/halloween.jpg',
  },
  {
    id: 'p5',
    name: 'OSCILLATE',
    subtitle: 'WAVES · MUMBAI',
    date: 'DEC 7, 2025',
    city: 'Mumbai',
    venue: 'Waves, Mumbai',
    time: '7PM+',
    lineup: ['HANAA aka LA PENDERIE NOIR', 'ODDIBLE', 'SKEEF MENEZES', 'MALWARE', 'INSIN', 'ODAAT', 'KRUZE', 'ZEUS'],
    tags: ['TECHNO', 'MUMBAI'],
    flyer: '/flyers/waves-mumbai.jpg',
  },
  {
    id: 'p3',
    name: 'OSCILLATE',
    subtitle: 'CHAPTER III',
    date: 'SEPT 20, 2025',
    city: 'Bengaluru',
    lineup: ['ESILISE', 'WADJET', 'CLOVER', 'REZONOIZE', 'ANUSHA'],
    note: 'VISUALS BY VISON OF SOUND',
    tags: ['TECHNO', 'LIVE VISUALS'],
    flyer: '/flyers/chapter-iii.jpg',
  },
  {
    id: 'p2',
    name: 'OSCILLATE',
    subtitle: 'CHAPTER II',
    date: 'AUG 29, 2025',
    city: 'Bengaluru',
    time: '9PM — 9AM',
    lineup: ['SUMIA', 'MALWARE', 'DARK FLUID', 'CERAMIC FEELZ', 'KAMARI', 'KORDENE', 'KRUZE'],
    tags: ['TECHNO', 'ALL-NIGHT'],
    flyer: '/flyers/chapter-ii.jpg',
  },
  {
    id: 'p1',
    name: 'OSCILLATE',
    subtitle: 'THE PORTAL',
    date: 'JUL 12, 2025',
    city: 'Bengaluru',
    venue: 'Hyatt Centric MG Road',
    lineup: ['UPHORIA', 'ODDIBLE', 'MALWARE', 'AGNI', 'ANNABSTRACTS', 'RIYAD', 'MARLON'],
    note: 'POWERED BY SPACENAUT',
    tags: ['TECHNO'],
    flyer: '/flyers/the-portal.jpg',
  },
];

// ─── Live countdown hook ───────────────────────────────────────────────────
function useCountdown(isoDate) {
  const [diff, setDiff] = useState(null);
  useEffect(() => {
    function compute() {
      const ms = new Date(isoDate) - new Date();
      if (ms <= 0) return setDiff({ label: 'LIVE', urgent: false });
      const days  = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins  = Math.floor((ms % 3600000) / 60000);
      const label = days > 1 ? `${days}D` : days === 1 ? `1D ${hours}H` : `${hours}H ${mins}M`;
      setDiff({ label, urgent: days < 7 });
    }
    compute();
    const id = setInterval(compute, 30000);
    return () => clearInterval(id);
  }, [isoDate]);
  return diff;
}

// ─── Availability bar ─────────────────────────────────────────────────────
function AvailBar({ capacity, sold }) {
  if (!capacity) return null;
  const pct  = Math.min((sold / capacity) * 100, 100);
  const left = capacity - sold;
  const urgent = left <= 20 && left > 0;
  const soldOut = left <= 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: soldOut ? 'rgba(255,60,60,0.5)' : urgent ? 'rgba(255,165,0,0.7)' : 'rgba(0,229,255,0.4)',
          transition: 'width 0.5s',
        }} />
      </div>
      <div style={{
        marginTop: 4, fontFamily: 'var(--font-ui)', fontSize: 10,
        color: soldOut ? 'rgba(255,80,80,0.7)' : urgent ? 'rgba(255,165,0,0.8)' : 'rgba(0,229,255,0.6)',
      }}>
        {soldOut ? 'SOLD OUT' : urgent ? `ONLY ${left} LEFT` : sold > 0 ? `${left} OF ${capacity} REMAINING` : `${capacity} AVAILABLE`}
      </div>
    </div>
  );
}

// ─── Event countdown badge ────────────────────────────────────────────────
function CountdownBadge({ isoDate }) {
  const cd = useCountdown(isoDate);
  if (!cd) return null;
  return (
    <span style={{
      fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2,
      color: cd.urgent ? 'var(--cyan)' : 'rgba(0,229,255,0.55)',
      background: cd.urgent ? 'rgba(0,229,255,0.08)' : 'transparent',
      border: `1px solid ${cd.urgent ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
      padding: '3px 8px',
      textShadow: cd.urgent ? 'var(--glow-sm)' : 'none',
    }}>
      T− {cd.label}
    </span>
  );
}

// ─── Waitlist inline form ──────────────────────────────────────────────────
function WaitlistForm({ event, tierName, onDone }) {
  const [wlEmail, setWlEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | done | error

  async function submit(e) {
    e.preventDefault();
    if (!wlEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wlEmail)) return;
    setState('loading');
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: wlEmail, event_id: event.id, event_name: event.name, tier_name: tierName }),
      });
      setState(r.ok ? 'done' : 'error');
      if (r.ok && onDone) setTimeout(onDone, 2000);
    } catch { setState('error'); }
  }

  if (state === 'done') return (
    <div style={{ fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2, color: 'var(--cyan)', padding: '8px 0' }}>
      ✓ ON WAITLIST
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input
        type="email"
        placeholder="your@email.com"
        value={wlEmail}
        onChange={e => setWlEmail(e.target.value)}
        style={{
          flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 11, padding: '7px 10px', outline: 'none',
        }}
      />
      <button type="submit" disabled={state === 'loading'} style={{
        background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.3)',
        color: 'rgba(255,165,0,0.9)', fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 2,
        padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        {state === 'loading' ? '...' : 'NOTIFY ME'}
      </button>
    </form>
  );
}

export default function Events({ onAddToCart, showToast }) {
  const [bookingModal, setBookingModal] = useState(null);
  const [form, setForm]                 = useState({ name: '', email: '', qty: '1' });
  const [success, setSuccess]           = useState(false);
  const [openSetTimes, setOpenSetTimes] = useState(null); // event id
  const [waitlistOpen, setWaitlistOpen] = useState({}); // { 'eventId-tierName': true }
  const [liveSold, setLiveSold]         = useState({}); // { 'eventId-tierName': count }

  // ── Fetch live sold counts from Supabase ──────────────────────────────────
  useEffect(() => {
    if (!supabase) return;

    async function fetchCounts() {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('event_name, event_detail');
        if (error || !data) return;

        const counts = {};
        for (const row of data) {
          const k = `${row.event_name}||${row.event_detail}`;
          counts[k] = (counts[k] || 0) + 1;
        }
        // Map to { 'eventId-tierName': count }
        const mapped = {};
        for (const ev of EVENTS) {
          for (const tier of ev.tiers) {
            const k = `${ev.name}||${tier.name}`;
            if (counts[k] !== undefined) {
              mapped[`${ev.id}-${tier.name}`] = counts[k];
            }
          }
        }
        setLiveSold(mapped);
      } catch { /* non-fatal */ }
    }

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  function openBooking(event, tier) {
    setBookingModal({ event, tier });
    setSuccess(false);
    setForm({ name: '', email: '', qty: '1' });
  }

  function handleConfirm(e) {
    e.preventDefault();
    setSuccess(true);
    const ev = bookingModal.event;
    onAddToCart({
      id: `ticket-${ev.id}-${bookingModal.tier.name}`,
      name: ev.name,
      detail: `${bookingModal.tier.name} · ${ev.dateShort} · ${ev.city}`,
      price: bookingModal.tier.price,
      type: 'ticket',
      qty: parseInt(form.qty),
      // Enrichment fields — used in confirmation email
      venue: ev.venue || null,
      city: ev.city || null,
      eventDate: ev.date || null,
      eventTime: ev.time || null,
      isoDate: ev.isoDate || null,
      lineup: ev.setTimes?.map(s => s.artist) || [],
    });
  }

  function totalPrice(tier) {
    const q = parseInt(form.qty) || 1;
    const p = parseInt(tier.price.replace(/[₹,]/g, ''));
    return `₹${(p * q).toLocaleString('en-IN')}`;
  }

  function getSold(evId, tierName, fallback) {
    const k = `${evId}-${tierName}`;
    return liveSold[k] !== undefined ? liveSold[k] : fallback;
  }

  return (
    <div className="page">

      {/* ── Upcoming ─────────────────────────────────────────────────────── */}
      <div className="section">
        <div className="section-header">
          <p className="section-eyebrow">2026 SEASON</p>
          <h2 className="section-title">EVENTS</h2>
          <div className="section-divider" />
        </div>

        <div className="events-grid">
          {EVENTS.map(ev => (
            <div className="event-card" key={ev.id}>

              {/* ── Flyer strip (if provided) ── */}
              {ev.flyer && (
                <div style={{ position: 'relative', height: 260, overflow: 'hidden', background: '#0a0a0a', marginBottom: 0 }}>
                  <img src={ev.flyer} alt={ev.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', opacity: 0.9 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.95) 100%)' }} />
                </div>
              )}

              <div className="event-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div className="event-date-badge">{ev.day} · {ev.date}</div>
                  <CountdownBadge isoDate={ev.isoDate} />
                  <span style={{
                    fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 2,
                    color: 'rgba(255,255,255,0.25)', borderLeft: '1px solid rgba(255,255,255,0.1)',
                    paddingLeft: 10, marginLeft: 2,
                  }}>
                    {ev.collab}
                  </span>
                </div>

                <h3 className="event-name">{ev.name}</h3>

                <div className="event-meta">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {ev.venue}, {ev.city}
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {ev.time}
                  </span>
                </div>

                <p className="event-desc">{ev.desc}</p>

                <div className="event-tags">
                  {ev.tags.map(t => <span className="event-tag" key={t}>{t}</span>)}
                </div>

                {/* ── Set Times toggle ── */}
                {ev.setTimes?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button
                      onClick={() => setOpenSetTimes(openSetTimes === ev.id ? null : ev.id)}
                      style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-head)',
                        fontSize: 8, letterSpacing: 3, padding: '6px 12px',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      {openSetTimes === ev.id ? '▲ HIDE' : '▼ SET TIMES'}
                    </button>
                    {openSetTimes === ev.id && (
                      <div style={{
                        marginTop: 10,
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(0,0,0,0.3)',
                      }}>
                        {ev.setTimes.map((s, i) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 14px',
                            borderBottom: i < ev.setTimes.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}>
                            <div>
                              <span style={{ fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 2, color: '#fff' }}>
                                {s.artist}
                              </span>
                              {s.note && (
                                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, color: 'rgba(0,229,255,0.5)', marginLeft: 8 }}>
                                  {s.note}
                                </span>
                              )}
                            </div>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                              {s.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Ticket panel ── */}
              <div className="event-ticket-panel">
                <div style={{
                  fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 4,
                  color: 'rgba(255,255,255,0.2)', marginBottom: 8, paddingBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  TICKETS
                </div>
                {ev.tiers.map(tier => {
                  const soldCount = getSold(ev.id, tier.name, tier.sold);
                  const left = tier.capacity ? tier.capacity - soldCount : null;
                  const isSoldOut = left !== null && left <= 0;
                  const wlKey = `${ev.id}-${tier.name}`;
                  return (
                    <div className="ticket-tier" key={tier.name}>
                      <div style={{ flex: 1 }}>
                        <div className="tier-name">{tier.name}</div>
                        <div className="tier-perks">{tier.perks}</div>
                        <AvailBar capacity={tier.capacity} sold={soldCount} />
                        {isSoldOut && waitlistOpen[wlKey] && (
                          <WaitlistForm
                            event={ev}
                            tierName={tier.name}
                            onDone={() => setWaitlistOpen(prev => ({ ...prev, [wlKey]: false }))}
                          />
                        )}
                      </div>
                      <div className="tier-right">
                        <div className="tier-price">{tier.price}</div>
                        {isSoldOut ? (
                          <button
                            className="tier-sold-out"
                            style={{ cursor: 'pointer', background: 'none', border: '1px solid rgba(255,165,0,0.25)', color: 'rgba(255,165,0,0.7)', fontFamily: 'var(--font-head)', fontSize: 7, letterSpacing: 1, padding: '4px 8px' }}
                            onClick={() => setWaitlistOpen(prev => ({ ...prev, [wlKey]: !prev[wlKey] }))}
                          >
                            WAITLIST
                          </button>
                        ) : tier.available ? (
                          <button className="btn-ticket" onClick={() => openBooking(ev, tier)}>
                            BOOK
                          </button>
                        ) : (
                          <div className="tier-sold-out">SOLD OUT</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="event-number">{ev.num}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Booking modal ─────────────────────────────────────────────────── */}
      {bookingModal && (
        <div className="modal-overlay" onClick={() => setBookingModal(null)}>
          <div className="ticket-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBookingModal(null)}>✕</button>
            {success ? (
              <div className="booking-success">
                <div className="success-icon">◈</div>
                <div className="success-title">BOOKING CONFIRMED</div>
                <div className="success-sub">
                  Ticket added to cart.<br />Complete payment to receive your QR ticket.
                </div>
                <button className="btn-confirm" style={{ marginTop: 32 }} onClick={() => setBookingModal(null)}>
                  CONTINUE
                </button>
              </div>
            ) : (
              <>
                <p className="modal-eyebrow">TICKET BOOKING</p>
                <h3 className="modal-title">{bookingModal.tier.name}</h3>
                <p className="modal-event-name">
                  {bookingModal.event.name} · {bookingModal.event.date} · {bookingModal.event.city}
                </p>
                <div className="modal-tier-summary">
                  <span className="tier-summary-name">{bookingModal.tier.perks}</span>
                  <span className="tier-summary-price">{totalPrice(bookingModal.tier)}</span>
                </div>
                <form className="modal-form" onSubmit={handleConfirm}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">FULL NAME</label>
                      <input className="form-input" required placeholder="Your name"
                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">QTY</label>
                      <select className="form-select" value={form.qty}
                        onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}>
                        {[1,2,3,4,5,6].map(n => (
                          <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">EMAIL</label>
                    <input className="form-input" type="email" required placeholder="your@email.com"
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <button className="btn-confirm" type="submit">
                    CONFIRM — {totalPrice(bookingModal.tier)}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Past events archive ───────────────────────────────────────────── */}
      <div className="section" style={{ marginTop: 80 }}>
        <div className="section-header">
          <p className="section-eyebrow">OSCILLATE HISTORY</p>
          <h2 className="section-title">ARCHIVE</h2>
          <div className="section-divider" />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 2,
        }}>
          {PAST_EVENTS.map(ev => (
            <PastEventCard key={ev.id} ev={ev} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Past event card ──────────────────────────────────────────────────────
function PastEventCard({ ev }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen(true)}
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        background: '#080808',
        cursor: 'pointer',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Flyer image */}
      {ev.flyer ? (
        <img
          src={ev.flyer}
          alt={ev.name}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', opacity: 0.9 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-head)', fontSize: 40, color: 'rgba(0,229,255,0.06)', letterSpacing: 8,
          }}>
            ◈
          </div>
        </div>
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 100%)',
      }} />

      {/* Info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 7, letterSpacing: 3, color: 'rgba(0,229,255,0.6)', marginBottom: 4 }}>
          {ev.subtitle}
        </div>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, letterSpacing: 3, color: '#fff', marginBottom: 6 }}>
          {ev.name}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          {ev.date} · {ev.city}
          {ev.venue && ` · ${ev.venue}`}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ev.tags.map(t => (
            <span key={t} style={{
              fontFamily: 'var(--font-head)', fontSize: 6, letterSpacing: 1,
              color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              padding: '2px 6px',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Lightbox modal */}
      {open && (
        <div
          className="modal-overlay"
          style={{ zIndex: 9000 }}
          onClick={e => { e.stopPropagation(); setOpen(false); }}
        >
          <div
            style={{
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)',
              padding: 32, maxWidth: 560, width: '90%', position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setOpen(false)}
              style={{ top: 16, right: 16 }}
            >✕</button>

            {ev.flyer && (
              <div style={{ margin: '-32px -32px 24px', overflow: 'hidden' }}>
                <img src={ev.flyer} alt={ev.name}
                  style={{ width: '100%', display: 'block', maxHeight: 520, objectFit: 'cover', objectPosition: 'center center' }} />
              </div>
            )}

            <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 3, color: 'var(--cyan)', marginBottom: 4 }}>
              {ev.subtitle}
            </div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, letterSpacing: 4, color: '#fff', marginBottom: 4 }}>
              {ev.name}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              {ev.date} · {ev.city}{ev.venue ? ` · ${ev.venue}` : ''}{ev.time ? ` · ${ev.time}` : ''}
            </div>

            <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 3, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
              LINEUP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: ev.note ? 16 : 0 }}>
              {ev.lineup.map(a => (
                <div key={a} style={{
                  fontFamily: 'var(--font-head)', fontSize: 12, letterSpacing: 3,
                  color: '#fff', borderLeft: '2px solid rgba(0,229,255,0.3)', paddingLeft: 12,
                }}>{a}</div>
              ))}
            </div>
            {ev.note && (
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.25)', marginTop: 16 }}>
                {ev.note}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
