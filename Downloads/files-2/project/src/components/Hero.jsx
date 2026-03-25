import { useState, useEffect } from 'react';
import OscillateLogo from './OscillateLogo';

const NEXT_EVENT = {
  isoDate: '2026-04-11T17:00:00+05:30',
  name: 'ÜBERKIKZ × OSCILLATE',
  date: 'SAT APR 11, 2026',
  venue: 'BENGALURU',
  flyer: '/flyers/uberkikz.jpg',
  gigPhoto: '/photos/gig-hero.jpg',
};

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
  const cd = useCountdown(NEXT_EVENT.isoDate);

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

      {/* Layer 1 — blurred full-bleed background: use gig photo */}
      <div className="hero-flyer-bg">
        <img src={NEXT_EVENT.gigPhoto} alt="" aria-hidden="true" />
      </div>

      {/* Layer 2 — sharp right panel with Teletech gig photo treatment */}
      <div className="hero-flyer-crisp">
        <img src={NEXT_EVENT.gigPhoto} alt="Live at Oscillate" className="hero-flyer-gig" />
        <div className="hero-flyer-scanlines" />
        <div className="hero-flyer-tint" />
      </div>

      {/* Layer 3 — dark vignette + stone texture */}
      <div className="hero-overlay" />

      {/* Layer 4 — left-anchored content */}
      <div className="hero-content">
        <div className="hero-logo-wrap">
          <OscillateLogo size={160} className="hero-logo" />
        </div>

        <p className="hero-sub">TECHNO COLLECTIVE · BANGALORE, INDIA</p>

        <div className="corner-box" style={{ display: 'inline-block' }}>
          <button
            className="hero-cta-primary"
            onClick={() => setActivePage('events')}
          >
            GET TICKETS
          </button>
        </div>
      </div>

      {/* Layer 5 — DICE-style bottom info strip */}
      <div className="hero-info-strip">
        <div className="hero-strip-item corner-box">
          <span className="hero-strip-label">EVENT</span>
          <span className="hero-strip-value">{NEXT_EVENT.name}</span>
        </div>
        <div className="hero-strip-item corner-box">
          <span className="hero-strip-label">DATE</span>
          <span className="hero-strip-value">{NEXT_EVENT.date}</span>
        </div>
        <div className="hero-strip-item corner-box">
          <span className="hero-strip-label">VENUE</span>
          <span className="hero-strip-value">{NEXT_EVENT.venue}</span>
        </div>
        <div className="hero-strip-item corner-box">
          <span className="hero-strip-label">T-MINUS</span>
          <span className="hero-strip-value countdown">{countdownLabel}</span>
        </div>
      </div>

    </section>
  );
}
