import { useState, useEffect } from 'react';
import OscillateLogo from './OscillateLogo';

const NEXT_EVENT_DATE = '2026-04-11T17:00:00+05:30'; // UBERKIKZ × OSCILLATE, 5PM IST

function useCountdown(isoDate) {
  const [diff, setDiff] = useState(null);

  useEffect(() => {
    function compute() {
      const ms = new Date(isoDate) - new Date();
      if (ms <= 0) return setDiff({ days: 0, hours: 0, mins: 0, past: true });
      const days  = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const mins  = Math.floor((ms % 3600000) / 60000);
      setDiff({ days, hours, mins, past: false });
    }
    compute();
    const id = setInterval(compute, 30000);
    return () => clearInterval(id);
  }, [isoDate]);

  return diff;
}

export default function Hero({ setActivePage }) {
  const cd = useCountdown(NEXT_EVENT_DATE);

  const countdownLabel = cd
    ? cd.past
      ? 'LIVE NOW'
      : cd.days > 1
        ? `${cd.days} DAYS`
        : cd.days === 1
          ? `1 DAY ${cd.hours}H`
          : `${cd.hours}H ${cd.mins}M`
    : 'APR 11';

  return (
    <section className="hero">
      <div className="hero-bg-gradient" />

      <div className="hero-logo-wrap">
        <OscillateLogo size={220} className="hero-logo" />
      </div>

      <h1 className="hero-title">OSCILLATE</h1>
      <p className="hero-sub">TECHNO COLLECTIVE · BANGALORE, INDIA</p>
      <p className="hero-collab">NEXT: UBERKIKZ × OSCILLATE · APR 11 · BENGALURU</p>

      <div className="hero-btns">
        <button className="btn-primary" onClick={() => setActivePage('events')}>
          GET TICKETS
        </button>
        <button className="btn-secondary" onClick={() => setActivePage('merch')}>
          MERCH DROP
        </button>
      </div>

      <div className="hero-event-strip">
        <div className="hero-stat">
          <span className="hero-stat-label">NEXT EVENT</span>
          <span className="hero-stat-value">APR 11</span>
        </div>
        <div className="hero-stat" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="hero-stat-label">CITY</span>
          <span className="hero-stat-value">BENGALURU</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-label">T-MINUS</span>
          <span className="hero-stat-value" style={{ color: 'var(--cyan)', textShadow: 'var(--glow-sm)' }}>
            {countdownLabel}
          </span>
        </div>
      </div>

      <div className="scroll-hint">
        <span>SCROLL</span>
        <div className="scroll-line" />
      </div>
    </section>
  );
}
