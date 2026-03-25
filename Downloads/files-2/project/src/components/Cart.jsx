import { useState, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ─── Tax rates (Indian GST) ──────────────────────────────────────────────────
const TICKET_GST_RATE  = 0.18;  // 18% GST on event tickets (entertainment)
const MERCH_GST_RATE   = 0.05;  // 5% GST on apparel/accessories
const CONVENIENCE_FEE  = 30;    // ₹30 flat per-ticket convenience fee

// ─── Calculate taxes ─────────────────────────────────────────────────────────
function calcTotals(items) {
  let ticketBase = 0, merchBase = 0, convFee = 0;

  for (const item of items) {
    const price = parseInt(item.price.replace(/[₹,]/g, ''));
    const qty = item.qty || 1;
    if (item.type === 'ticket') {
      ticketBase += price * qty;
      convFee += CONVENIENCE_FEE * qty;
    } else {
      merchBase += price * qty;
    }
  }

  const ticketGST = Math.round(ticketBase * TICKET_GST_RATE);
  const convFeeGST = Math.round(convFee * TICKET_GST_RATE);
  const merchGST   = Math.round(merchBase * MERCH_GST_RATE);
  const totalGST   = ticketGST + convFeeGST + merchGST;
  const subtotal   = ticketBase + merchBase;
  const total      = subtotal + convFee + totalGST;

  return { subtotal, ticketBase, merchBase, convFee, ticketGST, convFeeGST, merchGST, totalGST, total };
}

// ─── Load Razorpay SDK dynamically ───────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── UPI deeplink → Google Pay QR ────────────────────────────────────────────
function buildUPILink(amount, upiId, name = 'OSCILLATE') {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: 'OSCILLATE Ticket & Merch Payment',
  });
  return `upi://pay?${params.toString()}`;
}

// ─── Row helper ───────────────────────────────────────────────────────────────
function TaxRow({ label, value, accent, small }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: small ? 4 : 6,
      fontFamily: small ? 'var(--font-ui)' : 'var(--font-head)',
      fontSize: small ? 12 : 11,
      color: small ? 'rgba(255,255,255,0.35)' : (accent ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.55)'),
      letterSpacing: small ? 0 : 1,
    }}>
      <span>{label}</span>
      <span style={{ color: accent || 'rgba(255,255,255,0.55)' }}>{value}</span>
    </div>
  );
}

// ─── Email field styles ───────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  padding: '10px 12px',
  outline: 'none',
  borderRadius: 0,
  marginBottom: 8,
  transition: 'border-color 0.2s',
};

// ─── Send ticket email after payment ─────────────────────────────────────────
async function sendTicketEmail({ email, name, phone, items, paymentId, total }) {
  try {
    await fetch('/api/send-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, phone, items, paymentId, total }),
    });
  } catch {
    // Non-fatal — payment already confirmed
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Cart({ items, onClose, onRemove, onCheckoutSuccess, user }) {
  const [payMethod, setPayMethod]     = useState('razorpay'); // 'razorpay' | 'upi'
  const [checkoutState, setCheckoutState] = useState('idle'); // idle|loading|success|error|upi
  const [errorMsg, setErrorMsg]       = useState('');
  const [paymentId, setPaymentId]     = useState('');
  const [email, setEmail]             = useState('');
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [emailError, setEmailError]   = useState('');
  const [promoCode, setPromoCode]     = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMsg, setPromoMsg]       = useState('');
  const [promoApplied, setPromoApplied]   = useState(false);
  const [promoLoading, setPromoLoading]   = useState(false);

  // Pre-fill from logged-in user
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user]);

  const t = calcTotals(items);
  const finalTotal = Math.max(0, t.total - promoDiscount);
  const UPI_ID   = import.meta.env.VITE_UPI_ID   || '';
  const UPI_NAME = import.meta.env.VITE_UPI_NAME  || 'OSCILLATE';
  const upiLink  = buildUPILink(finalTotal, UPI_ID, UPI_NAME);

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoMsg('');
    try {
      const r = await fetch('/api/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, total: t.total }),
      });
      const data = await r.json();
      if (r.ok && data.valid) {
        setPromoDiscount(data.discount);
        setPromoApplied(true);
        setPromoMsg(`✓ ${data.code} — ₹${data.discount.toLocaleString('en-IN')} off`);
      } else {
        setPromoDiscount(0);
        setPromoApplied(false);
        setPromoMsg(data.error || 'Invalid code');
      }
    } catch {
      setPromoMsg('Could not validate code');
    }
    setPromoLoading(false);
  }

  // ── Validate email ────────────────────────────────────────────────────────
  function validateEmail() {
    if (!email.trim()) { setEmailError('Email is required to receive your tickets.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Enter a valid email address.'); return false; }
    setEmailError('');
    return true;
  }

  // ── Razorpay checkout ─────────────────────────────────────────────────────
  const handleRazorpay = useCallback(async () => {
    if (!validateEmail()) return;
    setCheckoutState('loading');
    setErrorMsg('');

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setErrorMsg('Could not load payment gateway. Check your connection.');
      setCheckoutState('error');
      return;
    }

    try {
      const orderRes = await fetch('/api/razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalTotal,
          currency: 'INR',
          receipt: `oscillate_${Date.now()}`,
          notes: { items_count: items.length },
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.order_id) {
        setErrorMsg(orderData.error || 'Order creation failed. Try again.');
        setCheckoutState('error');
        return;
      }

      setCheckoutState('paying');

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: 'OSCILLATE',
        description: `${items.length} item${items.length !== 1 ? 's' : ''}`,
        image: '/logo.svg',
        theme: { color: '#00e5ff', backdrop_color: '#000000' },
        modal: {
          ondismiss: () => setCheckoutState('idle'),
        },
        handler: async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
          try {
            const verifyRes = await fetch('/api/razorpay-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id, razorpay_payment_id, razorpay_signature,
                email, name, phone, items, total: finalTotal,
              }),
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              setPaymentId(razorpay_payment_id);
              setCheckoutState('success');
              onCheckoutSuccess?.();
              // Ticket email is sent server-side in razorpay-verify.js after signature check
            } else {
              setErrorMsg('Payment verification failed. Contact support.');
              setCheckoutState('error');
            }
          } catch {
            setErrorMsg('Verification error. Contact support with payment ID: ' + razorpay_payment_id);
            setCheckoutState('error');
          }
        },
        prefill: { name: name || '', email: email || '', contact: '' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setErrorMsg(resp.error?.description || 'Payment failed. Try again.');
        setCheckoutState('error');
      });
      rzp.open();

    } catch (err) {
      setErrorMsg('Something went wrong. Try again.');
      setCheckoutState('error');
    }
  }, [items, t.total, finalTotal, onCheckoutSuccess, email, name, phone]);

  // ── UPI QR ────────────────────────────────────────────────────────────────
  const handleUPIConfirm = () => {
    setCheckoutState('success');
    onCheckoutSuccess?.();
    sendTicketEmail({ email, name, phone, items, paymentId: '', total: finalTotal });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="cart-overlay" onClick={checkoutState === 'idle' || checkoutState === 'error' ? onClose : undefined} />
      <div className="cart-drawer">

        {/* Header */}
        <div className="cart-header">
          <span className="cart-title">YOUR CART</span>
          {(checkoutState === 'idle' || checkoutState === 'error') && (
            <button className="cart-close" onClick={onClose}>✕</button>
          )}
        </div>

        {/* ── SUCCESS STATE ── */}
        {checkoutState === 'success' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', textAlign: 'center', gap: 16 }}>
            <div style={{ fontSize: 52, filter: 'drop-shadow(0 0 20px #00e5ff)' }}>◈</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, letterSpacing: 4, color: 'var(--cyan)', textShadow: 'var(--glow-sm)' }}>
              PAYMENT CONFIRMED
            </div>
            {paymentId && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5, maxWidth: 280, lineHeight: 1.6 }}>
                Payment ID: {paymentId}
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: 260 }}>
              Tickets sent to <span style={{ color: 'rgba(0,229,255,0.8)' }}>{email}</span>. Check your inbox. See you at the event.
            </div>
            <button className="btn-checkout" style={{ marginTop: 16 }} onClick={onClose}>
              DONE
            </button>
          </div>
        )}

        {/* ── UPI QR STATE ── */}
        {checkoutState === 'upi' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', gap: 20 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 4, color: 'var(--cyan)' }}>
              SCAN TO PAY
            </div>

            {UPI_ID ? (
              <div style={{ background: '#fff', padding: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QRCodeSVG
                  value={upiLink}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                />
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,80,80,0.8)', textAlign: 'center', padding: '20px 0' }}>
                UPI ID not configured.<br />Set VITE_UPI_ID in your env.
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                ₹{t.total.toLocaleString('en-IN')}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>
                Open Google Pay → Scan any QR → Pay
              </div>
              {UPI_ID && (
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 10, color: 'rgba(0,229,255,0.7)', marginTop: 6, letterSpacing: 1 }}>
                  {UPI_ID}
                </div>
              )}
            </div>

            <button className="btn-checkout" onClick={handleUPIConfirm}>
              I'VE PAID — CONFIRM
            </button>
            <button className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}
              onClick={() => setCheckoutState('idle')}>
              ← BACK
            </button>
          </div>
        )}

        {/* ── MAIN CART (idle / error / loading) ── */}
        {(checkoutState === 'idle' || checkoutState === 'loading' || checkoutState === 'error') && (
          <>
            {items.length === 0 ? (
              <div className="cart-empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.2">
                  <polygon points="20,2 21,17 20,20 19,17" fill="white" />
                  <polygon points="20,38 21,23 20,20 19,23" fill="white" />
                  <polygon points="2,20 17,21 20,20 17,19" fill="white" />
                  <polygon points="38,20 23,21 20,20 23,19" fill="white" />
                  <polygon points="5,5 18,18 20,20 18,18" fill="white" />
                  <polygon points="35,35 22,22 20,20 22,22" fill="white" />
                  <polygon points="35,5 22,18 20,20 22,18" fill="white" />
                  <polygon points="5,35 18,22 20,20 18,22" fill="white" />
                  <circle cx="20" cy="20" r="3" fill="white" />
                </svg>
                <span>CART IS EMPTY</span>
              </div>
            ) : (
              <div className="cart-items">
                {items.map((item, i) => (
                  <div className="cart-item" key={`${item.id}-${i}`}>
                    <div className="cart-item-icon">{item.type === 'ticket' ? '◈' : '✦'}</div>
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-detail">{item.detail}</div>
                      <div className="cart-item-price">
                        {item.price}
                        {item.qty > 1 && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>×{item.qty}</span>}
                      </div>
                    </div>
                    <button className="cart-item-remove" onClick={() => onRemove(item.id)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="cart-footer">
                {/* ── Tax breakdown ── */}
                <div style={{ marginBottom: 16, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {t.ticketBase > 0 && <TaxRow small label="Ticket subtotal" value={`₹${t.ticketBase.toLocaleString('en-IN')}`} />}
                  {t.merchBase  > 0 && <TaxRow small label="Merch subtotal" value={`₹${t.merchBase.toLocaleString('en-IN')}`} />}
                  {t.convFee    > 0 && <TaxRow small label={`Convenience fee (₹30 × ticket)`} value={`₹${t.convFee.toLocaleString('en-IN')}`} />}
                  {t.ticketGST > 0 && <TaxRow small label="GST 18% (tickets)" value={`₹${(t.ticketGST + t.convFeeGST).toLocaleString('en-IN')}`} />}
                  {t.merchGST  > 0 && <TaxRow small label="GST 5% (merch)" value={`₹${t.merchGST.toLocaleString('en-IN')}`} />}
                  <TaxRow small label="Shipping" value="FREE" accent="rgba(0,229,255,0.7)" />
                </div>

                <div className="cart-total">
                  <span className="cart-total-label">TOTAL (INCL. GST)</span>
                  <span className="cart-total-amount">₹{t.total.toLocaleString('en-IN')}</span>
                </div>

                {/* ── Payment method selector ── */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { id: 'razorpay', label: 'RAZORPAY', sub: 'Cards, UPI, NetBanking' },
                    { id: 'upi',      label: 'GOOGLE PAY', sub: 'Scan QR code' },
                  ].map(m => (
                    <button key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      style={{
                        flex: 1, background: payMethod === m.id ? 'rgba(0,229,255,0.08)' : 'transparent',
                        border: `1px solid ${payMethod === m.id ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: payMethod === m.id ? 'var(--cyan)' : 'rgba(255,255,255,0.4)',
                        padding: '10px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                      }}>
                      <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 2, marginBottom: 3 }}>
                        {m.label}
                      </div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, opacity: 0.6 }}>{m.sub}</div>
                    </button>
                  ))}
                </div>

                {/* ── Error message ── */}
                {checkoutState === 'error' && (
                  <div style={{
                    background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)',
                    padding: '10px 14px', marginBottom: 12,
                    fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,120,120,0.9)', lineHeight: 1.5,
                  }}>
                    {errorMsg}
                  </div>
                )}

                {/* ── Email capture ── */}
                <div style={{ marginBottom: 14 }}>
                  <input
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    placeholder="Email for tickets *"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                    style={{ ...inputStyle, borderColor: emailError ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.12)' }}
                  />
                  {emailError && (
                    <p style={{ margin: '-4px 0 8px', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,100,100,0.9)' }}>
                      {emailError}
                    </p>
                  )}
                  <input
                    type="tel"
                    placeholder="WhatsApp number (optional)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 0 }}
                  />
                </div>

                {/* ── Promo code ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="Promo code (optional)"
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(false); setPromoMsg(''); setPromoDiscount(0); }}
                      style={{ ...inputStyle, marginBottom: 0, flex: 1, letterSpacing: 2 }}
                      disabled={promoApplied}
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoLoading || promoApplied || !promoCode.trim()}
                      style={{
                        background: promoApplied ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${promoApplied ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        color: promoApplied ? 'var(--cyan)' : 'rgba(255,255,255,0.5)',
                        fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2,
                        padding: '0 14px', cursor: promoApplied ? 'default' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {promoLoading ? '...' : promoApplied ? '✓' : 'APPLY'}
                    </button>
                  </div>
                  {promoMsg && (
                    <p style={{
                      margin: '4px 0 0', fontFamily: 'var(--font-ui)', fontSize: 11,
                      color: promoApplied ? 'rgba(0,229,255,0.8)' : 'rgba(255,100,100,0.9)',
                    }}>{promoMsg}</p>
                  )}
                </div>

                {/* ── Discount line ── */}
                {promoDiscount > 0 && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 1 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>PROMO DISCOUNT</span>
                      <span style={{ color: 'var(--cyan)' }}>− ₹{promoDiscount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 1, marginTop: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>FINAL TOTAL</span>
                      <span style={{ color: '#fff' }}>₹{finalTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}

                {/* ── CTA button ── */}
                <button
                  className="btn-checkout"
                  disabled={checkoutState === 'loading'}
                  onClick={payMethod === 'upi'
                    ? () => { if (validateEmail()) setCheckoutState('upi'); }
                    : handleRazorpay}
                  style={{ opacity: checkoutState === 'loading' ? 0.6 : 1, cursor: checkoutState === 'loading' ? 'not-allowed' : 'pointer' }}
                >
                  {checkoutState === 'loading'
                    ? 'CREATING ORDER...'
                    : payMethod === 'upi'
                      ? `PAY ₹${finalTotal.toLocaleString('en-IN')} VIA UPI`
                      : `PAY ₹${finalTotal.toLocaleString('en-IN')} SECURELY`}
                </button>

                <p className="cart-note" style={{ marginTop: 10 }}>
                  {payMethod === 'razorpay' ? '256-BIT SSL · RAZORPAY SECURED' : 'UPI · GOOGLE PAY · DIRECT TRANSFER'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
