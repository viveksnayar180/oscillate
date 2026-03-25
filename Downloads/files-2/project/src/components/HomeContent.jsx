// HomeContent — Teletech-inspired editorial sections below the hero
// Drop crowd photos into /public/photos/ (crowd-1.jpg, crowd-2.jpg, crowd-3.jpg, crowd-4.jpg)

const RESIDENTS = [
  'ODDIBLE', 'MALWARE', 'ANNABSTRACTS', 'UPHORIA', 'MARLON',
  'FLUID STATE', 'KAMARI', 'INSIN', 'ANUSHA', 'ZEKT',
];

const MOSAIC = [
  { src: '/flyers/halloween.jpg',   span: 'tall',   label: 'HALLOWEEN EDITION',  sub: 'NOV 2025 · BENGALURU' },
  { src: '/flyers/march-15.jpg',    span: 'normal', label: 'CHAPTER IV',          sub: 'MAR 2026 · BENGALURU' },
  { src: '/flyers/waves-mumbai.jpg',span: 'normal', label: 'WAVES · MUMBAI',      sub: 'DEC 2025 · MUMBAI' },
  { src: '/flyers/uberkikz.jpg',    span: 'wide',   label: 'ÜBERKIKZ × OSCILLATE',sub: 'APR 2026 · BENGALURU' },
];

export default function HomeContent({ setActivePage }) {
  return (
    <div className="home-content">

      {/* ── A. EDITORIAL STATEMENT ── */}
      <section className="home-statement">
        <div className="home-statement-left">
          <p className="home-statement-tag">
            <span className="home-tag-line" />
            THE COLLECTIVE
          </p>
          <h2 className="home-statement-title">
            UNDERGROUND.<br />
            UNAPOLOGETIC.<br />
            BENGALURU.
          </h2>
        </div>
        <div className="home-statement-right">
          <div className="home-stats-col">
            {[
              { num: '18+', label: 'EVENTS HOSTED' },
              { num: '40+', label: 'ARTISTS PLATFORMED' },
              { num: '5K+', label: 'COMMUNITY' },
              { num: '3',   label: 'CITIES' },
            ].map(s => (
              <div key={s.label} className="home-stat-row">
                <span className="home-stat-num">{s.num}</span>
                <span className="home-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
          <p className="home-statement-body">
            No headliners. No guestlists. We book artists we believe in and
            build rooms we'd want to be in. This is Bengaluru's underground —
            uncompromised, intentional, and just getting started.
          </p>
          <button className="home-statement-cta" onClick={() => setActivePage('about')}>
            OUR STORY →
          </button>
        </div>
      </section>

      {/* ── B. CROWD VIDEO STRIP ── */}
      <div className="home-video-strip">
        <video
          src="/videos/crowd.mp4"
          autoPlay muted loop playsInline
          className="home-strip-vid"
        />
        <div className="home-strip-gradient" />
        <div className="home-strip-marquee">
          {[
            'UNDERGROUND', 'BENGALURU', 'TECHNO', 'NO COMPROMISE',
            'MÜNCHEN', 'SOUND FIRST', 'DARK TECHNO', 'THE COLLECTIVE',
            'UNDERGROUND', 'BENGALURU', 'TECHNO', 'NO COMPROMISE',
            'MÜNCHEN', 'SOUND FIRST', 'DARK TECHNO', 'THE COLLECTIVE',
          ].map((t, i) => (
            <span key={i} className="marquee-item">
              {t}<span className="marquee-dot"> · </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── C. EVENTS MOSAIC ── */}
      <section className="home-mosaic">
        <div className="home-mosaic-header">
          <span className="home-mosaic-label">TRANSMISSIONS</span>
          <div className="home-mosaic-rule" />
          <button className="home-mosaic-all" onClick={() => setActivePage('events')}>
            ALL EVENTS →
          </button>
        </div>
        <div className="home-mosaic-grid">
          {MOSAIC.map((item, i) => (
            <div
              key={i}
              className={`home-mosaic-cell corner-box home-mosaic-${item.span}`}
            >
              <img src={item.src} alt={item.label} />
              <div className="home-mosaic-info">
                <span className="home-mosaic-event">{item.label}</span>
                <span className="home-mosaic-meta">{item.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── D. RESIDENTS STRIP ── */}
      <section className="home-residents">
        <div className="home-residents-header">
          <span className="home-residents-label">RESIDENTS</span>
          <div className="home-residents-rule" />
          <button className="home-residents-cta" onClick={() => setActivePage('artists')}>
            ALL ARTISTS →
          </button>
        </div>
        <div className="home-residents-scroll">
          {RESIDENTS.map((name, i) => (
            <div key={i} className="home-resident-tag">
              <span className="home-resident-num">0{i + 1}</span>
              <span className="home-resident-name">{name}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
