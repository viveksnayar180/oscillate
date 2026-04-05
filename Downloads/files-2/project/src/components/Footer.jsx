const LINKS = [
  { label: 'INSTAGRAM',  href: 'https://www.instagram.com/oscillate.in' },
  { label: 'SOUNDCLOUD', href: 'https://soundcloud.com/oscillate-in' },
  { label: 'RA',         href: 'https://ra.co' },
  { label: 'MERCH',      href: '#merch', internal: true },
  { label: 'CONTACT',    href: 'mailto:hello@oscillate.in' },
];

const MARQUEE_ITEMS = [
  'TECHNO', 'BENGALURU', 'OSCILLATE', 'UNDERGROUND', 'AMBIENT', 'INDUSTRIAL',
  'DARK TECHNO', 'SIGNAL', 'COLLECTIVE', 'INDIA', 'LIVE AV', 'SUNRISE',
  'TECHNO', 'BENGALURU', 'OSCILLATE', 'UNDERGROUND', 'AMBIENT', 'INDUSTRIAL',
  'DARK TECHNO', 'SIGNAL', 'COLLECTIVE', 'INDIA', 'LIVE AV', 'SUNRISE',
];

export default function Footer({ onSetPage }) {
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
              {l.internal ? (
                <a style={{ cursor: 'pointer' }} onClick={() => onSetPage?.('merch')}>
                  {l.label}
                </a>
              ) : (
                <a
                  href={l.href}
                  target={l.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                >
                  {l.label}
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="footer-copy">
          © 2026 OSCILLATE COLLECTIVE · BANGALORE
        </div>
      </footer>
    </>
  );
}
