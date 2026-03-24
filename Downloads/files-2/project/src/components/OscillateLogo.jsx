export default function OscillateLogo({ size = 200, className = '' }) {
  return (
    <video
      src="/logo.mp4"
      autoPlay
      muted
      loop
      playsInline
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', objectFit: 'cover', mixBlendMode: 'screen' }}
    />
  );
}
