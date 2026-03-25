const LINKS = [
  { label: 'INSTAGRAM',  href: 'https://www.instagram.com/oscillate.in' },
  { label: 'SOUNDCLOUD', href: 'https://soundcloud.com/oscillate-in' },
  { label: 'RA',         href: 'https://ra.co' },
  { label: 'CONTACT',    href: 'mailto:hello@oscillate.in' },
];

const PARTNERS = ['SPACENAUT', 'TECHNO AFFAIRS', 'THE BPM THEORY', 'ASTRALWORX'];

const MARQUEE_ITEMS = [
  'TECHNO', 'BENGALURU', 'OSCILLATE', 'UNDERGROUND', 'AMBIENT', 'INDUSTRIAL',
  'DARK TECHNO', 'SIGNAL', 'COLLECTIVE', 'INDIA', 'LIVE AV', 'SUNRISE',
  'TECHNO', 'BENGALURU', 'OSCILLATE', 'UNDERGROUND', 'AMBIENT', 'INDUSTRIAL',
  'DARK TECHNO', 'SIGNAL', 'COLLECTIVE', 'INDIA', 'LIVE AV', 'SUNRISE',
];

export default function Footer() {
  return (
    <>
      {/* Marquee strip */}
      <div className="marquee-strip">
        <div className="marquee-inner">
          {MARQUEE_ITEMS.map((item, i) => (
            <span key={i} className="marquee-item">
              {item}
              <span className="marquee-dot"> · </span>
            </span>
          ))}
        </div>
      </div>

      <footer className="footer">
        <div className="footer-logo corner-box" style={{ padding: '4px 8px' }}>
          OSCILLATE
        </div>

        <ul className="footer-links">
          {LINKS.map(l => (
            <li key={l.label}>
              <a
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: 10,
          color: 'rgba(255,255,255,0.18)', letterSpacing: 2, marginBottom: 8,
        }}>
          {PARTNERS.join('  ·  ')}
        </div>

        <div className="footer-copy">
          © 2026 OSCILLATE COLLECTIVE · BANGALORE
          <span style={{ marginLeft: 12, opacity: 0.4 }}>A SPACENAUT VENTURE</span>
        </div>
      </footer>
    </>
  );
}
