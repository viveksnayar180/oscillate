import OscillateLogo from './OscillateLogo';

export default function Hero({ setActivePage }) {
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
        {[
          { label: 'NEXT EVENT', value: 'APR 11' },
          { label: 'CITY', value: 'BENGALURU' },
          { label: 'FROM', value: '₹569' },
        ].map(s => (
          <div className="hero-stat" key={s.label}>
            <span className="hero-stat-label">{s.label}</span>
            <span className="hero-stat-value">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="scroll-hint">
        <span>SCROLL</span>
        <div className="scroll-line" />
      </div>
    </section>
  );
}
