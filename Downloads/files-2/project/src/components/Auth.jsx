import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ─── Auth modal — email magic link login ──────────────────────────────────
export default function Auth({ onClose }) {
  const [email, setEmail]   = useState('');
  const [state, setState]   = useState('idle'); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !supabase) return;
    setState('sending');
    setErrMsg('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setErrMsg(error.message);
      setState('error');
    } else {
      setState('sent');
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="ticket-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {state === 'sent' ? (
          <div className="booking-success">
            <div className="success-icon" style={{ fontSize: 36 }}>✉</div>
            <div className="success-title">CHECK YOUR INBOX</div>
            <div className="success-sub" style={{ maxWidth: 280 }}>
              A login link was sent to<br />
              <span style={{ color: 'var(--cyan)' }}>{email}</span>.<br /><br />
              Click the link to sign in. You can close this window.
            </div>
            <button className="btn-confirm" style={{ marginTop: 24 }} onClick={onClose}>
              CLOSE
            </button>
          </div>
        ) : (
          <>
            <p className="modal-eyebrow">FAN LOGIN</p>
            <h3 className="modal-title" style={{ fontSize: 18 }}>MY TICKETS</h3>
            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: 13,
              color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.6,
            }}>
              Enter your email to receive a sign-in link. No password needed.
              Your past tickets will be waiting.
            </p>

            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">EMAIL</label>
                <input
                  className="form-input"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
                  autoFocus
                />
              </div>

              {state === 'error' && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: 12,
                  color: 'rgba(255,100,100,0.9)', padding: '8px 0',
                }}>
                  {errMsg}
                </div>
              )}

              <button
                className="btn-confirm"
                type="submit"
                disabled={state === 'sending'}
                style={{ opacity: state === 'sending' ? 0.6 : 1 }}
              >
                {state === 'sending' ? 'SENDING LINK...' : 'SEND MAGIC LINK'}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
