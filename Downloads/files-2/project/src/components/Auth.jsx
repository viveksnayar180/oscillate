import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ─── Auth modal — Google OAuth + email magic link ─────────────────────────
export default function Auth({ onClose }) {
  const [email, setEmail]   = useState('');
  const [state, setState]   = useState('idle'); // idle | sending | sent | error | oauth
  const [errMsg, setErrMsg] = useState('');

  async function handleGoogle() {
    if (!supabase) return;
    setState('oauth');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setErrMsg(error.message); setState('error'); }
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    if (!email.trim() || !supabase) return;
    setState('sending');
    setErrMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setErrMsg(error.message); setState('error'); }
    else setState('sent');
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
            <button className="btn-confirm" style={{ marginTop: 24 }} onClick={onClose}>CLOSE</button>
          </div>
        ) : (
          <>
            <p className="modal-eyebrow">WELCOME BACK</p>
            <h3 className="modal-title" style={{ fontSize: 18 }}>SIGN IN</h3>

            {/* Google OAuth */}
            <button
              className="btn-google"
              onClick={handleGoogle}
              disabled={state === 'oauth'}
              style={{ opacity: state === 'oauth' ? 0.6 : 1 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10, flexShrink: 0 }}>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {state === 'oauth' ? 'REDIRECTING...' : 'CONTINUE WITH GOOGLE'}
            </button>

            <div className="auth-divider">
              <span>OR</span>
            </div>

            {/* Magic link fallback */}
            <form className="modal-form" onSubmit={handleMagicLink}>
              <div className="form-group">
                <label className="form-label">EMAIL</label>
                <input
                  className="form-input"
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
                />
              </div>

              {state === 'error' && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,100,100,0.9)', padding: '8px 0' }}>
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

            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 20, textAlign: 'center', lineHeight: 1.6 }}>
              By signing in you agree to receive your tickets and event updates from OSCILLATE.
            </p>
          </>
        )}
      </div>
    </>
  );
}
