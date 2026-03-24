import { useState } from 'react';

const EVENTS = [
  {
    id: 1,
    name: 'UBERKIKZ × OSCILLATE',
    date: 'SAT APR 11, 2026',
    day: 'SAT',
    dateShort: 'APR 11',
    venue: 'To Be Announced',
    city: 'Bengaluru',
    time: '5:00 PM — 1:00 AM',
    tags: ['TECHNO', 'RAVES'],
    collab: 'IN COLLAB WITH SPACENAUT',
    desc: 'UBERKIKZ comes to India for the first time, landing in Namma Bengaluru for a night built on pure groove, energy, and cutting-edge sound. Get ready for an unforgettable experience as the city welcomes a fresh international wave to the dancefloor.',
    tiers: [
      { name: 'EARLY BIRD', price: '₹569', perks: 'Limited availability', available: true },
      { name: 'STANDARD', price: '₹799', perks: 'General admission', available: true },
      { name: 'PREMIUM', price: '₹1,299', perks: 'Priority entry + merch', available: true },
    ],
    num: '01',
  },
  {
    id: 2,
    name: 'SIGNAL 002',
    date: 'SAT MAY 17, 2026',
    day: 'SAT',
    dateShort: 'MAY 17',
    venue: 'Subterranean',
    city: 'Bengaluru',
    time: '10:00 PM — 6:00 AM',
    tags: ['DARK TECHNO', 'INDUSTRIAL', 'LIVE AV'],
    collab: 'OSCILLATE RESIDENTS',
    desc: 'The second transmission. Deeper, darker, more intense. OSCILLATE\'s resident lineup takes over Subterranean for an all-night journey through the lower frequencies.',
    tiers: [
      { name: 'EARLY BIRD', price: '₹699', perks: 'Limited — earlybird rate', available: true },
      { name: 'STANDARD', price: '₹999', perks: 'General admission', available: true },
      { name: 'ENTITY PASS', price: '₹1,999', perks: 'VIP + meet & greet', available: true },
    ],
    num: '02',
  },
  {
    id: 3,
    name: 'STELLAR MAP',
    date: 'SUN JUN 21, 2026',
    day: 'SUN',
    dateShort: 'JUN 21',
    venue: 'Open Air Location',
    city: 'Goa',
    time: 'SUNRISE — 4:00 AM TO 10:00 AM',
    tags: ['AMBIENT TECHNO', 'SUNRISE', 'OUTDOOR'],
    collab: 'OSCILLATE × TBA',
    desc: 'The longest day of the year. A sunrise set in the open air — somewhere in Goa. Details and location released to ticket holders only. Bring your signal.',
    tiers: [
      { name: 'GENERAL', price: '₹1,499', perks: 'General admission', available: true },
      { name: 'COLLECTOR\'S BUNDLE', price: '₹4,999', perks: 'Ticket + exclusive tee + lanyard', available: true },
    ],
    num: '03',
  },
];

export default function Events({ onAddToCart, showToast }) {
  const [bookingModal, setBookingModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', qty: '1' });
  const [success, setSuccess] = useState(false);

  function openBooking(event, tier) {
    setBookingModal({ event, tier });
    setSuccess(false);
    setForm({ name: '', email: '', qty: '1' });
  }

  function handleConfirm(e) {
    e.preventDefault();
    setSuccess(true);
    onAddToCart({
      id: `ticket-${bookingModal.event.id}-${bookingModal.tier.name}`,
      name: `${bookingModal.event.name}`,
      detail: `${bookingModal.tier.name} · ${bookingModal.event.dateShort} · ${bookingModal.event.city}`,
      price: bookingModal.tier.price,
      type: 'ticket',
      qty: parseInt(form.qty),
    });
  }

  function totalPrice(tier) {
    const q = parseInt(form.qty) || 1;
    const p = parseInt(tier.price.replace(/[₹,]/g, ''));
    return `₹${(p * q).toLocaleString('en-IN')}`;
  }

  return (
    <div className="page">
      <div className="section">
        <div className="section-header">
          <p className="section-eyebrow">2026 SEASON</p>
          <h2 className="section-title">EVENTS</h2>
          <div className="section-divider" />
        </div>

        <div className="events-grid">
          {EVENTS.map(ev => (
            <div className="event-card" key={ev.id}>
              <div className="event-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div className="event-date-badge">{ev.day} · {ev.date}</div>
                  <span style={{
                    fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 2,
                    color: 'rgba(255,255,255,0.25)', borderLeft: '1px solid rgba(255,255,255,0.1)',
                    paddingLeft: 12,
                  }}>
                    {ev.collab}
                  </span>
                </div>

                <h3 className="event-name">{ev.name}</h3>

                <div className="event-meta">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {ev.venue}, {ev.city}
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {ev.time}
                  </span>
                </div>

                <p className="event-desc">{ev.desc}</p>

                <div className="event-tags">
                  {ev.tags.map(t => <span className="event-tag" key={t}>{t}</span>)}
                </div>
              </div>

              <div className="event-ticket-panel">
                <div style={{
                  fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 4,
                  color: 'rgba(255,255,255,0.2)', marginBottom: 8, paddingBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  TICKETS
                </div>
                {ev.tiers.map(tier => (
                  <div className="ticket-tier" key={tier.name}>
                    <div>
                      <div className="tier-name">{tier.name}</div>
                      <div className="tier-perks">{tier.perks}</div>
                    </div>
                    <div className="tier-right">
                      <div className="tier-price">{tier.price}</div>
                      {tier.available ? (
                        <button className="btn-ticket" onClick={() => openBooking(ev, tier)}>
                          BOOK
                        </button>
                      ) : (
                        <div className="tier-sold-out">SOLD OUT</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="event-number">{ev.num}</div>
            </div>
          ))}
        </div>
      </div>

      {bookingModal && (
        <div className="modal-overlay" onClick={() => setBookingModal(null)}>
          <div className="ticket-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBookingModal(null)}>✕</button>

            {success ? (
              <div className="booking-success">
                <div className="success-icon">◈</div>
                <div className="success-title">BOOKING CONFIRMED</div>
                <div className="success-sub">
                  Ticket added to cart.<br />
                  Confirmation sent to {form.email}
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
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''}</option>)}
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
    </div>
  );
}
