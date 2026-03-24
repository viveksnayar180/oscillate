export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-logo">OSCILLATE</div>
      <ul className="footer-links">
        {['INSTAGRAM', 'SOUNDCLOUD', 'RA', 'CONTACT'].map(l => (
          <li key={l}><a>{l}</a></li>
        ))}
      </ul>
      <div className="footer-copy">© 2026 OSCILLATE COLLECTIVE · BANGALORE</div>
    </footer>
  );
}
