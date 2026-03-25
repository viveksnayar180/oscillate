import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Venue staff check-in page ─────────────────────────────────────────────
// Staff open /checkin on their phone/tablet.
// Enter PIN once, then scan QR codes with a handheld scanner
// (or type/paste ticket IDs manually).
// The scanner acts as a keyboard — it types the QR string and hits Enter.

// ─── Web Audio beep/buzz ───────────────────────────────────────────────────
function playTone(freq, duration, type = 'sine', gain = 0.4) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* non-fatal — AudioContext blocked in some envs */ }
}

function beepSuccess() { playTone(880, 0.18); }
function beepDuplicate() { playTone(330, 0.35, 'sawtooth', 0.3); }
function beepError() { playTone(160, 0.4, 'square', 0.3); }

export default function CheckIn() {
  const [pin, setPin]           = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [result, setResult]     = useState(null); // null | { ok, message, ... }
  const [checking, setChecking] = useState(false);
  const [flash, setFlash]       = useState(null); // 'ok' | 'dup' | 'err'
  const [stats, setStats]       = useState(null); // { total, scanned }
  const inputRef = useRef(null);

  // Auto-focus ticket input when unlocked
  useEffect(() => {
    if (pinSaved && inputRef.current) inputRef.current.focus();
  }, [pinSaved]);

  // Fetch capacity stats on unlock and after each scan
  const fetchStats = useCallback(async (p) => {
    try {
      const res = await fetch('/api/checkin-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (pinSaved) fetchStats(pin);
  }, [pinSaved]);

  // Flash the result card colour briefly for visual feedback
  function triggerFlash(type) {
    setFlash(type);
    setTimeout(() => setFlash(null), 600);
  }

  // Auto-submit when a scanner pastes a ticket ID and fires Enter
  function handleKeyDown(e) {
    if (e.key === 'Enter') checkTicket();
  }

  async function checkTicket() {
    const id = ticketId.trim();
    if (!id) return;
    setChecking(true);
    setResult(null);

    try {
      const res = await fetch('/api/check-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: id, pin }),
      });
      const data = await res.json();
      const merged = { ...data, status: res.status };
      setResult(merged);

      if (res.status === 200 && data.ok) {
        beepSuccess();
        triggerFlash('ok');
        fetchStats(pin); // refresh counter after successful check-in
      } else if (res.status === 409) {
        beepDuplicate();
        triggerFlash('dup');
      } else {
        beepError();
        triggerFlash('err');
      }
    } catch {
      setResult({ ok: false, error: 'Network error — check connection.' });
      beepError();
      triggerFlash('err');
    } finally {
      setChecking(false);
      setTicketId('');
      if (inputRef.current) inputRef.current.focus();
    }
  }

  const resultColor = result
    ? result.ok
      ? '#00ff88'
      : result.status === 409
        ? '#ffaa00'
        : '#ff4444'
    : 'transparent';

  // Flash overlay color
  const flashBg = flash === 'ok' ? 'rgba(0,255,136,0.07)' : flash === 'dup' ? 'rgba(255,170,0,0.07)' : flash === 'err' ? 'rgba(255,68,68,0.07)' : 'transparent';

  return (
    <div style={{
      minHeight: '100vh', background: flash ? flashBg : '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'var(--font-head)',
      transition: 'background 0.15s',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8, color: '#fff', letterSpacing: 6 }}>◈ OSCILLATE</div>
        <div style={{ fontSize: 10, color: '#00e5ff', letterSpacing: 4 }}>VENUE CHECK-IN</div>

        {/* Capacity counter — shown when unlocked and stats loaded */}
        {pinSaved && stats && (
          <div style={{
            marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)',
            padding: '8px 20px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, color: '#00e5ff', letterSpacing: 2 }}>{stats.scanned}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginTop: 2 }}>CHECKED IN</div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 18 }}>/</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>{stats.total}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginTop: 2 }}>TOTAL TICKETS</div>
            </div>
          </div>
        )}
      </div>

      {/* PIN gate */}
      {!pinSaved ? (
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

      ) : (
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Scan input */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, marginBottom: 10 }}>
              SCAN QR OR ENTER TICKET ID
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={ticketId}
                onChange={e => setTicketId(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="OSC-UBK-..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontFamily: 'monospace', fontSize: 13,
                  padding: '12px 14px', outline: 'none',
                }}
              />
              <button
                onClick={checkTicket}
                disabled={checking || !ticketId.trim()}
                style={{
                  background: '#00e5ff', border: 'none', color: '#000',
                  fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 2,
                  padding: '0 18px', cursor: 'pointer',
                  opacity: !ticketId.trim() ? 0.4 : 1,
                }}
              >
                {checking ? '...' : 'CHECK'}
              </button>
            </div>
          </div>

          {/* Result card */}
          {result && (
            <div style={{
              border: `2px solid ${resultColor}`,
              background: `${resultColor}11`,
              padding: '20px 22px',
              transition: 'all 0.2s',
            }}>
              {/* Status badge */}
              <div style={{
                fontFamily: 'var(--font-head)', fontSize: 14, letterSpacing: 3,
                color: resultColor, marginBottom: 14,
              }}>
                {result.ok
                  ? '✓ ' + (result.message || 'VALID')
                  : '✗ ' + (result.error || 'INVALID')}
              </div>

              {/* Details */}
              {(result.event || result.customer || result.email) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.event && (
                    <Row label="EVENT" value={result.event} />
                  )}
                  {result.event_detail && (
                    <Row label="DETAILS" value={result.event_detail} />
                  )}
                  {result.customer && (
                    <Row label="CUSTOMER" value={result.customer} />
                  )}
                  {result.email && (
                    <Row label="EMAIL" value={result.email} dim />
                  )}
                  {result.ticket_id && (
                    <Row label="TICKET ID" value={result.ticket_id} dim />
                  )}
                  {result.scanned_at && result.status === 409 && (
                    <Row label="SCANNED AT" value={new Date(result.scanned_at).toLocaleString('en-IN')} accent="#ffaa00" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Clear PIN */}
          <button
            onClick={() => { setPinSaved(false); setPin(''); setResult(null); setStats(null); }}
            style={{
              marginTop: 24, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-head)', fontSize: 8,
              letterSpacing: 2, padding: '10px 0', width: '100%', cursor: 'pointer',
            }}
          >
            LOCK / CHANGE PIN
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, dim, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
      <span style={{ fontFamily: 'var(--font-head)', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, flexShrink: 0, paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: accent || (dim ? 'rgba(255,255,255,0.35)' : '#fff'), textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
