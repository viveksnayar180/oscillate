export default function OscillateLogo({ size = 200, className = '' }) {
  return (
    <img
      src="/oscillate-logo.png"
      alt="OSCILLATE"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', objectFit: 'contain', mixBlendMode: 'screen' }}
    />
  );
}
