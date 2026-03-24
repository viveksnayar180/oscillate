import { useState } from 'react';

// ─── Admin broadcast page (/broadcast) ───────────────────────────────────────
// PIN-gated. Compose → preview → send to full mailing list via Resend Broadcasts.
export default function Broadcast() {
  const [pin, setPin]           = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState('');
  const [preview, setPreview]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null); // null | { ok, count, error }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, subject, body }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, ...data });
    } catch {
      setResult({ ok: false, error: 'Network error' });
    } finally {
      setSending(false);
    }
  }

  // Build preview HTML
  const previewHtml = `
    <div style="background:#000;padding:24px;font-family:monospace;min-height:200px;">
      <div style="max-width:560px;margin:0 auto;background:#0a0a0a;border:1px solid #1a1a1a;padding:32px;">
        <p style="color:#00e5ff;font-size:10px;letter-spacing:4px;margin:0 0 8px;">◈ OSCILLATE</p>
        <h2 style="color:#fff;font-size:16px;margin:0 0 20px;letter-spacing:2px;">${subject.replace(/</g,'&lt;')}</h2>
        <div style="color:#aaa;font-size:13px;line-height:1.8;white-space:pre-wrap;">${body.replace(/</g,'&lt;')}</div>
        <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1a1a1a;color:#333;font-size:10px;">
          OSCILLATE · TECHNO COLLECTIVE · INDIA
        </div>
      </div>
    </div>
  `;

  return (
    <div style={{
      minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--font-head)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 22, marginBottom: 8, color: '#fff', letterSpacing: 6 }}>◈ OSCILLATE</div>
        <div style={{ fontSize: 9, color: '#00e5ff', letterSpacing: 4 }}>BROADCAST ADMIN</div>
      </div>

      {!pinSaved ? (
        /* PIN gate */
        <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, marginBottom: 12 }}>
            ENTER STAFF PIN
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pin.length >= 4 && setPinSaved(true)}
            placeholder="••••"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontFamily: 'var(--font-head)', fontSize: 28, textAlign: 'center',
              padding: '14px 12px', letterSpacing: 12, outline: 'none',
            }}
          />
          <button
            onClick={() => setPinSaved(true)}
            disabled={pin.length < 4}
            style={{
              marginTop: 14, width: '100%', background: '#00e5ff', border: 'none',
              color: '#000', fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 3,
              padding: '13px 0', cursor: pin.length < 4 ? 'not-allowed' : 'pointer',
              opacity: pin.length < 4 ? 0.4 : 1,
            }}
          >
            UNLOCK
          </button>
        </div>

      ) : result?.ok ? (
        /* Success state */
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 40, color: '#00e5ff', marginBottom: 16, filter: 'drop-shadow(0 0 20px #00e5ff)' }}>◈</div>
          <div style={{ fontSize: 14, letterSpacing: 4, color: '#fff', marginBottom: 12 }}>BROADCAST SENT</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 28 }}>
            {result.count ? `Sent to ${result.count} subscribers.` : 'Broadcast dispatched.'}
          </div>
          <button
            onClick={() => { setResult(null); setSubject(''); setBody(''); setPreview(false); }}
            style={{
              background: 'transparent', border: '1px solid rgba(0,229,255,0.3)',
              color: 'var(--cyan)', fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2,
              padding: '12px 24px', cursor: 'pointer',
            }}
          >
            NEW BROADCAST
          </button>
        </div>

      ) : (
        /* Compose */
        <div style={{ width: '100%', maxWidth: preview ? 880 : 560 }}>
          <div style={{ display: 'flex', gap: preview ? 24 : 0, alignItems: 'flex-start' }}>

            {/* Form */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, marginBottom: 16 }}>
                COMPOSE EMAIL
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 6 }}>SUBJECT</div>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Early access — SIGNAL 002 tickets live"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 13,
                    padding: '10px 12px', outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 6 }}>BODY</div>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={"Hey,\n\nEarly access tickets for SIGNAL 002 are live...\n\nBook now: oscillate-eta.vercel.app/events\n\n— OSCILLATE"}
                  rows={10}
                  style={{
                    width: '100%', boxSizing: 'border-box', resize: 'vertical',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 13,
                    padding: '10px 12px', outline: 'none', lineHeight: 1.6,
                  }}
                />
              </div>

              {result && !result.ok && (
                <div style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid rgba(255,60,60,0.3)', background: 'rgba(255,60,60,0.06)', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,100,100,0.9)' }}>
                  {result.error || 'Send failed. Check RESEND_AUDIENCE_ID env var.'}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setPreview(p => !p)}
                  disabled={!subject || !body}
                  style={{
                    flex: 1, background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-head)', fontSize: 9,
                    letterSpacing: 2, padding: '12px 0', cursor: 'pointer',
                  }}
                >
                  {preview ? 'HIDE PREVIEW' : 'PREVIEW'}
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !subject || !body}
                  style={{
                    flex: 2, background: sending ? 'rgba(0,229,255,0.3)' : '#00e5ff',
                    border: 'none', color: '#000', fontFamily: 'var(--font-head)', fontSize: 9,
                    letterSpacing: 2, padding: '12px 0', cursor: sending ? 'not-allowed' : 'pointer',
                    opacity: (!subject || !body) ? 0.4 : 1,
                  }}
                >
                  {sending ? 'SENDING...' : 'SEND TO ALL SUBSCRIBERS'}
                </button>
              </div>

              <button
                onClick={() => { setPinSaved(false); setPin(''); }}
                style={{
                  marginTop: 16, width: '100%', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-head)', fontSize: 7,
                  letterSpacing: 2, padding: '9px 0', cursor: 'pointer',
                }}
              >
                LOCK
              </button>
            </div>

            {/* Preview panel */}
            {preview && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, marginBottom: 16 }}>
                  EMAIL PREVIEW
                </div>
                <div
                  style={{ border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
