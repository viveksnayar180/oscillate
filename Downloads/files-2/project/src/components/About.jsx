const STATS = [
  { num: '18+', label: 'EVENTS HOSTED' },
  { num: '40+', label: 'ARTISTS PLATFORMED' },
  { num: '5K+', label: 'COMMUNITY' },
  { num: '3',   label: 'CITIES' },
];

const APPROACH = [
  {
    num: '01',
    title: 'SOUND',
    body: 'Dark, industrial, and euphoric. Our programming spans the full spectrum — techno, EBM, ambient, industrial, and experimental electronic music. No compromises on the lineup.',
  },
  {
    num: '02',
    title: 'SPACE',
    body: 'We curate the room as carefully as the music. Warehouse, rooftop, basement, sunrise field — the space is part of the set. Every venue is chosen for the feeling it creates.',
  },
  {
    num: '03',
    title: 'SIGNAL',
    body: 'Each event is a transmission. We are building the underground in India — city by city, frequency by frequency — connecting local artists to a global circuit.',
  },
];

export default function About() {
  return (
    <div className="about-page">

      {/* Fixed full-page video background */}
      <video
        className="about-bg-video"
        src="/videos/crowd.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="about-bg-tint" />

      <div className="about-page-content">

        {/* ── 01. HERO ── */}
        <section className="about-hero">
          <div className="about-hero-overlay" />
          <div className="about-hero-content">
            <p className="about-hero-eyebrow">
              <span className="about-hero-eyebrow-line" />
              BENGALURU
            </p>
            <h1 className="about-hero-title">TO THE<br />WORLD.</h1>
            <div className="about-hero-scroll">
              <div className="about-hero-scroll-line" />
              <span className="about-hero-scroll-label">SCROLL</span>
            </div>
          </div>
        </section>

        {/* ── 02. STATS STRIP ── */}
        <div className="about-stats-strip">
          {STATS.map(s => (
            <div key={s.label} className="about-stat-cell corner-box">
              <span className="about-stat-num">{s.num}</span>
              <span className="about-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── 03. MANIFESTO ── */}
        <section className="about-manifesto">
          <div className="about-manifesto-inner">
            <div className="about-manifesto-tag">
              <span className="about-manifesto-dash">—</span>
              <span className="about-manifesto-eyebrow">THE COLLECTIVE</span>
            </div>
            <p className="about-manifesto-headline">
              We build spaces<br />for the underground.
            </p>
            <p className="about-manifesto-body">
              A Bangalore-based techno collective dedicated to cultivating underground
              electronic music culture in India. We create rooms where sound, art, and
              community converge — from intimate basement events to outdoor sunrise
              experiences. We platform artists across the full spectrum and bring
              international acts to Indian shores. Every event is a signal.
            </p>
          </div>
        </section>

        {/* ── 04. APPROACH ── */}
        <section className="about-approach">
          <div className="about-approach-header">
            <span className="about-approach-label">OUR APPROACH</span>
            <div className="about-approach-rule" />
          </div>
          <div className="about-approach-grid">
            {APPROACH.map(item => (
              <div key={item.title} className="about-approach-item">
                <span className="about-approach-num">{item.num}</span>
                <h3 className="about-approach-title">{item.title}</h3>
                <p className="about-approach-body">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 05. SOCIAL ── */}
        <section className="about-social">
          <p className="about-social-eyebrow">FOLLOW THE SIGNAL</p>
          <div className="about-social-links">
            {[
              { label: 'INSTAGRAM',  handle: '@oscillate.in',       href: 'https://www.instagram.com/oscillate.in' },
              { label: 'SOUNDCLOUD', handle: 'oscillate-in',        href: 'https://soundcloud.com/oscillate-in' },
              { label: 'RA',         handle: 'oscillate-collective', href: 'https://ra.co' },
            ].map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="about-social-item corner-box"
              >
                <span className="about-social-platform">{s.label}</span>
                <span className="about-social-handle">{s.handle}</span>
              </a>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
