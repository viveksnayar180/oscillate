import OscillateLogo from './OscillateLogo';

export default function About() {
  return (
    <div className="page">
      <div className="section">
        <div className="section-header">
          <p className="section-eyebrow">THE COLLECTIVE</p>
          <h2 className="section-title">ABOUT</h2>
          <div className="section-divider" />
        </div>

        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 40 }}>
            <OscillateLogo size={100} />
          </div>

          <p style={{ fontSize: 17, lineHeight: 1.9, color: 'rgba(200,216,240,0.7)', letterSpacing: 0.5, marginBottom: 32 }}>
            OSCILLATE is a Bangalore-based techno collective dedicated to cultivating underground
            electronic music culture in India. We create spaces where sound, art, and community
            converge — from intimate basement events to outdoor sunrise experiences.
          </p>

          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'rgba(200,216,240,0.45)', letterSpacing: 0.5, marginBottom: 60 }}>
            Founded in the spirit of exploration, we platform artists across the spectrum of techno,
            industrial, EBM, ambient, and experimental electronic music. Every event is a signal.
          </p>
        </div>

        <div className="about-grid">
          {[
            { num: '18+', label: 'EVENTS HOSTED' },
            { num: '40+', label: 'ARTISTS PLATFORMED' },
            { num: '5K+', label: 'COMMUNITY MEMBERS' },
            { num: '3', label: 'CITIES & GROWING' },
          ].map(s => (
            <div className="about-stat" key={s.label}>
              <span className="stat-num">{s.num}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 80, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {[
            { title: 'TECHNO', desc: 'Dark, industrial, and euphoric — our core sound.' },
            { title: 'COMMUNITY', desc: 'A space for artists, dancers, and explorers.' },
            { title: 'CULTURE', desc: 'Original merchandise, art collaborations, and experiences.' },
            { title: 'SIGNAL', desc: 'Our event series — each one a transmission.' },
          ].map(item => (
            <div key={item.title} style={{
              background: 'rgba(8,16,36,0.7)',
              border: '1px solid rgba(0,229,255,0.15)',
              padding: '24px 28px',
              clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
            }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 4, color: 'var(--cyan)', marginBottom: 10 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(200,216,240,0.55)', lineHeight: 1.6, letterSpacing: 0.5 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 80, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 5, color: 'rgba(200,216,240,0.3)', marginBottom: 20 }}>
            FOLLOW THE SIGNAL
          </p>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'INSTAGRAM', handle: '@oscillate.in' },
              { label: 'SOUNDCLOUD', handle: 'oscillate-india' },
              { label: 'RA', handle: 'oscillate-collective' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(0,229,255,0.05)',
                border: '1px solid rgba(0,229,255,0.2)',
                padding: '10px 24px',
                clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
              }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, letterSpacing: 3, color: 'rgba(200,216,240,0.4)', marginBottom: 3 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 1, color: 'var(--cyan)' }}>
                  {s.handle}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
