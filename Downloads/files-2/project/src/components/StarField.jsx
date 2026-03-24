import { useEffect, useRef } from 'react';

export default function StarField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let W, H;

    const stars = [];
    const particles = [];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function initStars() {
      stars.length = 0;
      for (let i = 0; i < 280; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.4 + 0.2,
          opacity: Math.random() * 0.8 + 0.1,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          color: Math.random() > 0.85 ? '#a0cfff' : '#ffffff',
        });
      }
      // floating particles (snow/dust)
      particles.length = 0;
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 2 + 0.5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: Math.random() * 0.4 + 0.1,
          opacity: Math.random() * 0.5 + 0.1,
          color: Math.random() > 0.5 ? 'rgba(0,229,255,' : 'rgba(180,210,255,',
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // radial blue glow at center
      const grd = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.55);
      grd.addColorStop(0, 'rgba(13,40,100,0.35)');
      grd.addColorStop(0.5, 'rgba(5,15,40,0.15)');
      grd.addColorStop(1, 'rgba(4,6,15,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // bottom blue light shafts
      for (let i = 0; i < 5; i++) {
        const x = W * (0.15 + i * 0.18);
        const g2 = ctx.createLinearGradient(x, H, x, H * 0.3);
        g2.addColorStop(0, 'rgba(0,100,255,0.18)');
        g2.addColorStop(1, 'rgba(0,100,255,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(x - 30, H);
        ctx.lineTo(x + 30, H);
        ctx.lineTo(x + 80, H * 0.3);
        ctx.lineTo(x - 80, H * 0.3);
        ctx.closePath();
        ctx.fill();
      }

      // stars
      for (const s of stars) {
        s.opacity += s.twinkleSpeed * s.twinkleDir;
        if (s.opacity > 0.9 || s.opacity < 0.05) s.twinkleDir *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color.replace(')', `,${s.opacity})`).replace('#ffffff', `rgba(255,255,255,`).replace('#a0cfff', `rgba(160,207,255,`);
        // simpler approach
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // floating particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
        if (p.x > W + 10) p.x = -10;
        if (p.x < -10) p.x = W + 10;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    initStars();
    draw();

    window.addEventListener('resize', () => { resize(); initStars(); });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="starfield" />;
}
