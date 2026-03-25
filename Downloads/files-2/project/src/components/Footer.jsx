const LINKS = [
  { label: 'INSTAGRAM',  href: 'https://www.instagram.com/oscillate.in' },
  { label: 'SOUNDCLOUD', href: 'https://soundcloud.com/oscillate-in' },
  { label: 'RA',         href: 'https://ra.co' },
  { label: 'CONTACT',    href: 'mailto:hello@oscillate.in' },
];

const PARTNERS = ['SPACENAUT', 'TECHNO AFFAIRS', 'THE BPM THEORY', 'ASTRALWORX'];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-logo">OSCILLATE</div>

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
  );
}
