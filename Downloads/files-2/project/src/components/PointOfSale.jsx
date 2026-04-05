import { useState } from 'react';
import QRCode from 'qrcode';

// POS event/tier list — mirrors api/_prices.js POS_EVENTS
const POS_EVENTS = [
  {
    name: 'ÜBERKIKZ × OSCILLATE',
    date: 'APR 11',
    tiers: [
      { name: 'EARLY BIRD',  price: 569  },
      { name: 'STANDARD',    price: 799  },
      { name: 'PREMIUM',     price: 1299 },
    ],
  },
  {
    name: 'SIGNAL 002',
    date: 'MAY 17',
    tiers: [
      { name: 'VIP PASS', price: 1999 },
    ],
  },
  {
    name: 'STELLAR MAP',
    date: 'JUN 21',
    tiers: [
      { name: 'GENERAL',            price: 1499 },
      { name: "COLLECTOR'S BUNDLE", price: 4999 },
    ],
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    fontFamily: 'var(--font-ui, monospace)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 16px 40px',
  },
  header: {
    width: '100%',
    maxWidth: 520,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 0 28px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 32,
  },
  brand: {
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 11,
    letterSpacing: 6,
    color: 'var(--cyan, #00e5ff)',
  },
  pageLabel: {
    fontFamily: 'var(--font-ui, monospace)',
    fontSize: 9,
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.3)',
  },
  lockBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'var(--font-ui, monospace)',
    fontSize: 9,
    letterSpacing: 3,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '28px 24px',
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 13,
    letterSpacing: 2,
    padding: '11px 14px',
    marginBottom: 10,
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    background: '#111',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 12,
    letterSpacing: 2,
    padding: '11px 14px',
    marginBottom: 10,
    boxSizing: 'border-box',
    outline: 'none',
    cursor: 'pointer',
  },
  label: {
    fontFamily: 'var(--font-ui, monospace)',
    fontSize: 9,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 5,
    display: 'block',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  primaryBtn: {
    width: '100%',
    background: 'var(--cyan, #00e5ff)',
    color: '#000',
    border: 'none',
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 11,
    letterSpacing: 4,
    padding: '14px 0',
    cursor: 'pointer',
    marginTop: 6,
  },
  ghostBtn: {
    width: '100%',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 11,
    letterSpacing: 4,
    padding: '12px 0',
    cursor: 'pointer',
    marginTop: 8,
  },
  tabs: {
    display: 'flex',
    marginBottom: 24,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  tab: (active) => ({
    flex: 1,
    padding: '10px 0',
    textAlign: 'center',
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 10,
    letterSpacing: 3,
    cursor: 'pointer',
    background: active ? 'rgba(0,229,255,0.08)' : 'none',
    color: active ? 'var(--cyan, #00e5ff)' : 'rgba(255,255,255,0.35)',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    border: 'none',
    borderBottom: active ? '2px solid var(--cyan, #00e5ff)' : '2px solid transparent',
    transition: 'all 0.15s',
  }),
  error: {
    color: 'rgba(255,80,80,0.9)',
    fontFamily: 'var(--font-ui, monospace)',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 0,
    letterSpacing: 1,
  },
  priceTag: {
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 22,
    color: 'var(--cyan, #00e5ff)',
    letterSpacing: 2,
    marginBottom: 20,
  },
  divider: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    margin: '20px 0',
  },
  successCard: {
    width: '100%',
    maxWidth: 520,
    background: 'rgba(0,229,255,0.04)',
    border: '1px solid rgba(0,229,255,0.2)',
    padding: '28px 24px',
    textAlign: 'center',
  },
  ticketId: {
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 12,
    letterSpacing: 3,
    color: 'var(--cyan, #00e5ff)',
    margin: '16px 0 6px',
  },
  meta: {
    fontFamily: 'var(--font-ui, monospace)',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    lineHeight: 1.8,
    marginBottom: 16,
  },
  metaVal: {
    color: '#fff',
    fontWeight: 'bold',
  },
  checkToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    margin: '16px 0',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: (checked) => ({
    width: 16,
    height: 16,
    border: `1px solid ${checked ? 'var(--cyan, #00e5ff)' : 'rgba(255,255,255,0.25)'}`,
    background: checked ? 'var(--cyan, #00e5ff)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  rzpLinkBox: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '16px',
    margin: '12px 0',
    textAlign: 'center',
  },
  rzpLinkText: {
    fontFamily: 'var(--font-ui, monospace)',
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  paymentIdInput: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: 'var(--font-head, monospace)',
    fontSize: 12,
    letterSpacing: 1,
    padding: '11px 14px',
    marginBottom: 10,
    boxSizing: 'border-box',
    outline: 'none',
  },
};

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }) {
  const [pin, setPin]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/pos-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, probe: true }),
      });
      if (!r.ok) { setError('Invalid PIN'); setLoading(false); return; }
      onUnlock(pin);
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  }

  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 6, color: 'var(--cyan)', marginBottom: 8 }}>
          OSCILLATE
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.3)', marginBottom: 40 }}>
          POINT OF SALE
        </div>
        <input
          type="password"
          placeholder="ENTER PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
          minLength={4}
          style={{ ...s.input, textAlign: 'center', marginBottom: 12 }}
        />
        {error && <p style={s.error}>{error}</p>}
        <button type="submit" disabled={loading || pin.length < 4} style={{
          ...s.primaryBtn,
          opacity: (loading || pin.length < 4) ? 0.5 : 1,
          cursor: (loading || pin.length < 4) ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'CHECKING...' : 'ENTER'}
        </button>
      </form>
    </section>
  );
}

// ─── Issue Form ───────────────────────────────────────────────────────────────

function IssueForm({ pin, onIssued }) {
  const [method, setMethod]         = useState('cash'); // 'cash' | 'comp' | 'razorpay'
  const [eventIdx, setEventIdx]     = useState(0);
  const [tierIdx, setTierIdx]       = useState(0);
  const [buyerName, setBuyerName]   = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  // Razorpay-specific
  const [rzpLinkUrl, setRzpLinkUrl]   = useState('');
  const [rzpLinkQR, setRzpLinkQR]     = useState('');
  const [rzpLinkCreated, setRzpLinkCreated] = useState(false);
  const [rzpPaymentId, setRzpPaymentId]     = useState('');

  const event   = POS_EVENTS[eventIdx];
  const tierObj = event.tiers[tierIdx] || event.tiers[0];
  const price   = method === 'comp' ? 0 : tierObj.price;

  function handleEventChange(e) {
    setEventIdx(Number(e.target.value));
    setTierIdx(0);
    resetRzp();
  }

  function resetRzp() {
    setRzpLinkUrl('');
    setRzpLinkQR('');
    setRzpLinkCreated(false);
    setRzpPaymentId('');
  }

  function handleMethodChange(m) {
    setMethod(m);
    resetRzp();
    setError('');
  }

  async function createPaymentLink() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/pos-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          payment_method: 'razorpay_link',
          event_name: event.name,
          tier:       tierObj.name,
          buyer_name:  buyerName,
          buyer_email: buyerEmail,
          amount:      tierObj.price,
        }),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error || 'Failed to create payment link'); setLoading(false); return; }
      // Generate QR of the payment link URL
      const qr = await QRCode.toDataURL(json.payment_link_url, {
        errorCorrectionLevel: 'H', width: 200, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setRzpLinkUrl(json.payment_link_url);
      setRzpLinkQR(qr);
      setRzpLinkCreated(true);
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  }

  async function issueTicket() {
    setLoading(true);
    setError('');
    const body = {
      pin,
      event_name:     event.name,
      tier:           tierObj.name,
      buyer_name:     buyerName,
      buyer_email:    buyerEmail,
      payment_method: method === 'razorpay' && rzpLinkCreated ? 'razorpay' : method,
      payment_id:     method === 'razorpay' ? rzpPaymentId : undefined,
      amount:         price,
    };
    try {
      const r = await fetch('/api/pos-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error || 'Issue failed'); setLoading(false); return; }
      onIssued(json);
    } catch {
      setError('Connection error');
    }
    setLoading(false);
  }

  const commonFieldsFilled = buyerEmail.includes('@') && event && tierObj;
  const canIssue = commonFieldsFilled && (method !== 'razorpay' || (rzpLinkCreated && rzpPaymentId.startsWith('pay_')));

  return (
    <div style={s.card}>
      {/* Payment method tabs */}
      <div style={s.tabs}>
        {[['cash', 'CASH'], ['comp', 'COMP'], ['razorpay', 'RAZORPAY UPI']].map(([m, label]) => (
          <button key={m} style={s.tab(method === m)} onClick={() => handleMethodChange(m)}>{label}</button>
        ))}
      </div>

      {/* Event */}
      <div style={s.fieldGroup}>
        <label style={s.label}>EVENT</label>
        <select style={s.select} value={eventIdx} onChange={handleEventChange}>
          {POS_EVENTS.map((ev, i) => (
            <option key={i} value={i}>{ev.name} — {ev.date}</option>
          ))}
        </select>
      </div>

      {/* Tier */}
      <div style={s.fieldGroup}>
        <label style={s.label}>TIER</label>
        <select style={s.select} value={tierIdx} onChange={e => { setTierIdx(Number(e.target.value)); resetRzp(); }}>
          {event.tiers.map((t, i) => (
            <option key={i} value={i}>{t.name} — ₹{t.price}</option>
          ))}
        </select>
      </div>

      {/* Price display */}
      <div style={s.priceTag}>
        {method === 'comp' ? 'COMPLIMENTARY — ₹0' : `₹${price.toLocaleString('en-IN')}`}
      </div>

      <div style={s.divider} />

      {/* Buyer details */}
      <div style={s.fieldGroup}>
        <label style={s.label}>BUYER NAME</label>
        <input
          type="text"
          placeholder="FULL NAME"
          value={buyerName}
          onChange={e => setBuyerName(e.target.value)}
          style={s.input}
        />
      </div>
      <div style={s.fieldGroup}>
        <label style={s.label}>BUYER EMAIL</label>
        <input
          type="email"
          placeholder="EMAIL ADDRESS"
          value={buyerEmail}
          onChange={e => setBuyerEmail(e.target.value)}
          style={s.input}
        />
      </div>

      {/* Razorpay UPI flow */}
      {method === 'razorpay' && (
        <>
          <div style={s.divider} />
          {!rzpLinkCreated ? (
            <button
              onClick={createPaymentLink}
              disabled={loading || !commonFieldsFilled}
              style={{ ...s.ghostBtn, opacity: (!commonFieldsFilled || loading) ? 0.4 : 1, cursor: (!commonFieldsFilled || loading) ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'CREATING...' : 'CREATE PAYMENT LINK'}
            </button>
          ) : (
            <div>
              <p style={{ ...s.rzpLinkText, marginBottom: 12 }}>SHOW QR TO BUYER — SCAN TO PAY</p>
              <div style={s.rzpLinkBox}>
                {rzpLinkQR && (
                  <img src={rzpLinkQR} alt="Payment QR" style={{ width: 160, height: 160, display: 'block', margin: '0 auto 10px' }} />
                )}
                <a href={rzpLinkUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 1 }}>
                  {rzpLinkUrl}
                </a>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>ENTER RAZORPAY PAYMENT ID (pay_...)</label>
                <input
                  type="text"
                  placeholder="pay_XXXXXXXXXXXXXXXXXX"
                  value={rzpPaymentId}
                  onChange={e => setRzpPaymentId(e.target.value.trim())}
                  style={s.paymentIdInput}
                />
              </div>
            </div>
          )}
        </>
      )}

      {error && <p style={s.error}>{error}</p>}

      {/* Issue button */}
      {(method !== 'razorpay' || rzpLinkCreated) && (
        <button
          onClick={issueTicket}
          disabled={loading || !canIssue}
          style={{ ...s.primaryBtn, opacity: (!canIssue || loading) ? 0.4 : 1, cursor: (!canIssue || loading) ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'ISSUING...' : method === 'comp' ? 'ISSUE COMP TICKET' : 'CONFIRM PAYMENT — ISSUE TICKET'}
        </button>
      )}
    </div>
  );
}

// ─── Ticket Issued Screen ─────────────────────────────────────────────────────

function TicketIssued({ ticket, pin, onIssueAnother }) {
  const [autoCheckin, setAutoCheckin]   = useState(false);
  const [checkedIn, setCheckedIn]       = useState(ticket.is_scanned || false);
  const [checkingIn, setCheckingIn]     = useState(false);
  const [checkinError, setCheckinError] = useState('');
  // Generate QR from qr_data string
  const [qrDataUrl, setQrDataUrl]       = useState('');

  // Build QR on mount
  useState(() => {
    if (ticket.qr_data) {
      QRCode.toDataURL(ticket.qr_data, {
        errorCorrectionLevel: 'H', width: 200, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(url => setQrDataUrl(url)).catch(() => {});
    }
  });

  async function handleCheckinToggle() {
    if (checkedIn) return; // can't un-check-in
    setCheckingIn(true);
    setCheckinError('');
    try {
      const r = await fetch('/api/pos-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          event_name:     ticket.event_name,
          tier:           ticket.tier,
          buyer_email:    ticket.buyer_email,
          buyer_name:     ticket.buyer_name,
          payment_method: ticket.payment_method,
          payment_id:     ticket.payment_id,
          amount:         ticket.amount,
          auto_checkin:   true,
          // Re-issue guard: since the ticket already exists, dispatchTickets will return idempotency hit.
          // Instead, call check-ticket directly.
        }),
      });
      // dispatchTickets will reject duplicate; use check-ticket endpoint for marking
      // Actually simpler: call check-ticket with the ticket_id
      const r2 = await fetch('/api/check-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket.ticket_id,
          pin:       sessionStorage.getItem('osc_checkin_pin') || '',
          _pos_override: true,
        }),
      });
      // If check-ticket fails (no checkin PIN), fall back silently
      if (r2.ok || r2.status === 409) {
        setCheckedIn(true);
        setAutoCheckin(true);
      } else {
        setCheckinError('Check-in PIN required — mark manually in /checkin');
      }
    } catch {
      setCheckinError('Could not check in');
    }
    setCheckingIn(false);
  }

  const methodLabel = { cash: 'CASH', comp: 'COMPLIMENTARY', razorpay: 'RAZORPAY UPI' }[ticket.payment_method] || ticket.payment_method?.toUpperCase();

  return (
    <div style={s.successCard}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 4, color: 'var(--cyan)', marginBottom: 6 }}>
        ✓ TICKET ISSUED
      </div>

      {qrDataUrl && (
        <div style={{
          background: '#fff',
          display: 'inline-block',
          padding: 10,
          margin: '16px auto',
          border: '4px solid rgba(0,229,255,0.3)',
        }}>
          <img src={qrDataUrl} alt="Ticket QR" style={{ width: 180, height: 180, display: 'block' }} />
        </div>
      )}

      <div style={s.ticketId}>{ticket.ticket_id}</div>

      <div style={{ ...s.meta, margin: '12px 0 16px' }}>
        <div><span>EVENT  </span><span style={s.metaVal}>{ticket.event_name}</span></div>
        <div><span>TIER   </span><span style={s.metaVal}>{ticket.tier}</span></div>
        <div><span>NAME   </span><span style={s.metaVal}>{ticket.buyer_name || '—'}</span></div>
        <div><span>EMAIL  </span><span style={s.metaVal}>{ticket.buyer_email}</span></div>
        <div><span>AMOUNT </span><span style={s.metaVal}>{ticket.amount === 0 ? 'COMPLIMENTARY' : `₹${ticket.amount?.toLocaleString('en-IN')}`}</span></div>
        <div><span>METHOD </span><span style={s.metaVal}>{methodLabel}</span></div>
      </div>

      {/* Check-in toggle */}
      <div style={s.checkToggle} onClick={!checkedIn && !checkingIn ? handleCheckinToggle : undefined}>
        <div style={s.checkbox(checkedIn)}>
          {checkedIn && <span style={{ fontSize: 11, color: '#000', fontWeight: 'bold' }}>✓</span>}
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: 2, color: checkedIn ? 'var(--cyan)' : 'rgba(255,255,255,0.4)' }}>
          {checkingIn ? 'CHECKING IN...' : checkedIn ? 'CHECKED IN' : 'MARK AS CHECKED-IN NOW'}
        </span>
      </div>
      {checkinError && <p style={{ ...s.error, textAlign: 'center' }}>{checkinError}</p>}

      <button onClick={onIssueAnother} style={{ ...s.ghostBtn, marginTop: 20 }}>
        ISSUE ANOTHER
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PointOfSale() {
  const [pin, setPin]         = useState('');
  const [authed, setAuthed]   = useState(false);
  const [ticket, setTicket]   = useState(null);

  function handleUnlock(p) {
    setPin(p);
    setAuthed(true);
  }

  function handleIssued(t) {
    setTicket(t);
  }

  function handleIssueAnother() {
    setTicket(null);
  }

  function handleLock() {
    setPin('');
    setAuthed(false);
    setTicket(null);
  }

  if (!authed) return <PinGate onUnlock={handleUnlock} />;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.brand}>OSCILLATE</div>
          <div style={s.pageLabel}>POINT OF SALE</div>
        </div>
        <button style={s.lockBtn} onClick={handleLock}>LOCK</button>
      </div>

      {ticket ? (
        <TicketIssued ticket={ticket} pin={pin} onIssueAnother={handleIssueAnother} />
      ) : (
        <IssueForm pin={pin} onIssued={handleIssued} />
      )}
    </div>
  );
}
