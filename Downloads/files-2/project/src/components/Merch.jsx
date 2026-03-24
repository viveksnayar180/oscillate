import { useState } from 'react';
import OscillateLogo from './OscillateLogo';

// ─── Product catalogue ────────────────────────────────────────────────────────
// To add a real product image:
//   1. Drop your image file into public/merch/  (e.g. public/merch/tee-001.jpg)
//   2. Set image: '/merch/tee-001.jpg'  on the product below
//   3. Push to main → Vercel auto-deploys with the new image
// When image is null the SVG mockup renders as a placeholder.
const PRODUCTS = [
  {
    id: 'tee-001', category: 'tees',
    name: 'SIGNAL 001',
    sub: 'Drop One · Heavyweight Tee',
    label: 'NEW DROP',
    price: 2499,
    sizes: ['XS','S','M','L','XL','XXL'],
    bgColor: '#0a0a0a',
    accentColor: '#ffffff',
    imgType: 'tee-signal',
    image: null, // set to '/merch/tee-001.jpg' when design is ready
  },
  {
    id: 'tee-002', category: 'tees',
    name: 'VOID STATIC',
    sub: 'Acid Wash · Distressed',
    label: 'LIMITED',
    price: 2999,
    sizes: ['S','M','L','XL'],
    bgColor: '#111111',
    accentColor: '#888888',
    imgType: 'tee-void',
    image: null,
  },
  {
    id: 'tee-003', category: 'tees',
    name: 'ENTITY LONGSLEEVE',
    sub: 'Long Sleeve · Black',
    label: null,
    price: 2199,
    sizes: ['XS','S','M','L','XL'],
    bgColor: '#080808',
    accentColor: '#00e5ff',
    imgType: 'tee-entity',
    image: null,
  },
  {
    id: 'hood-001', category: 'hoodies',
    name: 'ENTITY HOODIE',
    sub: 'Pullover · 400gsm Fleece',
    label: 'BESTSELLER',
    price: 5499,
    sizes: ['XS','S','M','L','XL','XXL'],
    bgColor: '#0c0f1a',
    accentColor: '#ffffff',
    imgType: 'hoodie-entity',
    image: null,
  },
  {
    id: 'hood-002', category: 'hoodies',
    name: 'OSCILLATE CORP',
    sub: 'Full-Zip · Charcoal',
    label: null,
    price: 5999,
    sizes: ['S','M','L','XL'],
    bgColor: '#0d0d0d',
    accentColor: '#888888',
    imgType: 'hoodie-corp',
    image: null,
  },
  {
    id: 'acc-001', category: 'accessories',
    name: 'ARIA SHIELD',
    sub: 'Rave Sunglasses · UV400',
    label: 'COLLAB',
    price: 3499,
    sizes: ['ONE SIZE'],
    bgColor: '#050810',
    accentColor: '#1a8fff',
    imgType: 'acc-aria',
    image: null,
  },
  {
    id: 'acc-002', category: 'accessories',
    name: 'STELLAR MAP',
    sub: 'Folding Fan · Black Satin',
    label: 'NEW',
    price: 1299,
    sizes: ['ONE SIZE'],
    bgColor: '#080808',
    accentColor: '#c0c0c0',
    imgType: 'acc-fan',
    image: null,
  },
  {
    id: 'acc-003', category: 'accessories',
    name: 'VOID PULSE UV',
    sub: 'UV Rave Set · Glow',
    label: 'GLOW',
    price: 2199,
    sizes: ['XS/S','M/L','XL'],
    bgColor: '#030810',
    accentColor: '#00ff88',
    imgType: 'acc-uv',
    image: null,
  },
  {
    id: 'acc-004', category: 'accessories',
    name: 'ENTITY LANYARD',
    sub: 'Woven Lanyard + Badge',
    label: null,
    price: 599,
    sizes: ['ONE SIZE'],
    bgColor: '#060606',
    accentColor: '#00e5ff',
    imgType: 'acc-lanyard',
    image: null,
  },
];

// ─── SVG Mockups ───────────────────────────────────────────────────────────
function StarMark({ accent = '#fff', size = 60, opacity = 0.9 }) {
  const s = size / 120;
  return (
    <g transform={`scale(${s})`} opacity={opacity}>
      <polygon points="0,-58 5,-8 0,0 -5,-8" fill={accent} />
      <polygon points="0,58 5,8 0,0 -5,8" fill={accent} />
      <polygon points="-58,0 -8,5 0,0 -8,-5" fill={accent} />
      <polygon points="58,0 8,5 0,0 8,-5" fill={accent} />
      <polygon points="-41,-41 -4,-4 0,0 -4,4" fill={accent} opacity="0.8" />
      <polygon points="41,41 4,4 0,0 4,-4" fill={accent} opacity="0.8" />
      <polygon points="41,-41 4,-4 0,0 -4,-4" fill={accent} opacity="0.8" />
      <polygon points="-41,41 -4,4 0,0 4,4" fill={accent} opacity="0.8" />
      <circle cx="0" cy="0" r="5" fill={accent} />
    </g>
  );
}

function TeeCard({ color, accent, label }) {
  return (
    <svg viewBox="0 0 280 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0 }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`tg${label}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={color === '#111111' ? '#2a2a2a' : '#1a1a1a'} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
        <linearGradient id={`fold${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Tee shape */}
      <path d="M52,38 L14,75 L52,92 L52,290 L228,290 L228,92 L266,75 L228,38 L186,58 C175,65 165,70 140,70 C115,70 105,65 94,58 Z"
        fill={`url(#tg${label})`} />
      {/* Subtle fold */}
      <path d="M52,38 L52,290 L228,290 L228,38" fill={`url(#fold${label})`} />
      {/* Collar shadow */}
      <ellipse cx="140" cy="68" rx="50" ry="12" fill="rgba(0,0,0,0.3)" />
      {/* Star */}
      <g transform="translate(140,180)">
        <StarMark accent={accent} size={72} />
      </g>
      {/* Label text */}
      <text x="140" y="264" textAnchor="middle" fill={accent} opacity="0.4"
        style={{ fontSize: 9, fontFamily: 'Orbitron, monospace', letterSpacing: 4 }}>
        OSCILLATE
      </text>
    </svg>
  );
}

function HoodieCard({ color, accent }) {
  const bg = color === '#0c0f1a' ? '#1c2035' : '#1e1e1e';
  return (
    <svg viewBox="0 0 300 360" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0 }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`hg${color.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <path d="M58,68 L14,110 L58,128 L58,330 L242,330 L242,128 L286,110 L242,68 L198,44 C185,30 165,22 150,22 C135,22 115,30 102,44 Z"
        fill={`url(#hg${color.replace('#','')})`} />
      {/* Hood */}
      <path d="M102,44 C102,44 110,18 150,18 C190,18 198,44 198,44 C185,48 170,52 150,52 C130,52 115,48 102,44 Z"
        fill={bg} opacity="0.9" />
      {/* Pocket */}
      <path d="M95,240 L205,240 L205,280 Q150,292 95,280 Z"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      {/* Drawstring */}
      <line x1="130" y1="52" x2="118" y2="90" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
      <line x1="170" y1="52" x2="182" y2="90" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
      {/* Star */}
      <g transform="translate(150,185)">
        <StarMark accent={accent} size={68} />
      </g>
    </svg>
  );
}

function AriaCard() {
  return (
    <svg viewBox="0 0 300 200" width="100%" height="80%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)' }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lens-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#001840" />
          <stop offset="40%" stopColor="#002d8c" />
          <stop offset="100%" stopColor="#000f28" />
        </linearGradient>
        <linearGradient id="frame-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#555" />
          <stop offset="50%" stopColor="#999" />
          <stop offset="100%" stopColor="#333" />
        </linearGradient>
        <filter id="lensglow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Frame bridge */}
      <rect x="126" y="88" width="48" height="7" rx="3.5" fill="url(#frame-g)" />
      {/* Arms */}
      <path d="M18,100 L18,130 Q16,135 14,130" stroke="url(#frame-g)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M282,100 L282,130 Q284,135 286,130" stroke="url(#frame-g)" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* Left lens */}
      <ellipse cx="83" cy="97" rx="65" ry="44" fill="url(#lens-g)" stroke="url(#frame-g)" strokeWidth="2.5" />
      {/* Right lens */}
      <ellipse cx="217" cy="97" rx="65" ry="44" fill="url(#lens-g)" stroke="url(#frame-g)" strokeWidth="2.5" />
      {/* Reflections */}
      <ellipse cx="62" cy="79" rx="28" ry="13" fill="rgba(100,160,255,0.18)" transform="rotate(-25,62,79)" />
      <ellipse cx="196" cy="79" rx="28" ry="13" fill="rgba(100,160,255,0.18)" transform="rotate(-25,196,79)" />
      {/* Mini star on right lens */}
      <g transform="translate(217,97)" filter="url(#lensglow)">
        <StarMark accent="rgba(180,210,255,0.5)" size={24} opacity={0.6} />
      </g>
      <text x="150" y="165" textAnchor="middle" fill="rgba(0,229,255,0.5)"
        style={{ fontSize: 8, fontFamily: 'Orbitron, monospace', letterSpacing: 4 }}>ARIA SHIELD</text>
    </svg>
  );
}

function FanCard() {
  return (
    <svg viewBox="0 0 260 260" width="100%" height="90%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', top: '5%', left: 0, right: 0 }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fan-bg" x1="0%" y1="100%" x2="60%" y2="0%">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="100%" stopColor="#2e2e2e" />
        </linearGradient>
      </defs>
      {/* Fan ribs */}
      {[...Array(10)].map((_, i) => {
        const a = (-90 + i * 20) * Math.PI / 180;
        return (
          <line key={i} x1="130" y1="205"
            x2={130 + Math.cos(a) * 155} y2={205 + Math.sin(a) * 155}
            stroke="#3a3a3a" strokeWidth="1.5" />
        );
      })}
      {/* Fan fill */}
      <path d="M130,205 L22,55 A165,165,0,0,1,238,55 Z"
        fill="url(#fan-bg)" stroke="#252525" strokeWidth="0.5" />
      {/* Fabric texture lines */}
      {[...Array(9)].map((_, i) => {
        const a1 = (-90 + i * 20) * Math.PI / 180;
        const a2 = (-90 + (i + 1) * 20) * Math.PI / 180;
        const r = 100;
        return (
          <path key={i}
            d={`M ${130 + Math.cos(a1)*r} ${205 + Math.sin(a1)*r} A ${r} ${r} 0 0 1 ${130 + Math.cos(a2)*r} ${205 + Math.sin(a2)*r}`}
            fill="none" stroke="#3a3a3a" strokeWidth="0.5" />
        );
      })}
      {/* Star */}
      <g transform="translate(130,130)">
        <StarMark accent="#c0c0c0" size={52} opacity={0.85} />
      </g>
      {/* Handle */}
      <rect x="124" y="202" width="12" height="40" rx="6" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
      <text x="130" y="255" textAnchor="middle" fill="rgba(200,200,200,0.4)"
        style={{ fontSize: 7, fontFamily: 'Orbitron, monospace', letterSpacing: 3 }}>STELLAR MAP</text>
    </svg>
  );
}

function UVCard() {
  return (
    <svg viewBox="0 0 260 280" width="90%" height="90%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', top: '5%', left: '5%' }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="uvglow2">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="uv-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#001808" />
          <stop offset="100%" stopColor="#002510" />
        </linearGradient>
      </defs>
      {/* UV top */}
      <path d="M72,50 Q130,28 188,50 L200,100 Q165,120 130,120 Q95,120 60,100 Z"
        fill="url(#uv-top)" stroke="#00ff6622" strokeWidth="1" />
      {/* Shoulder straps */}
      <path d="M72,50 L64,18" stroke="#00ff88" strokeWidth="4" strokeLinecap="round" filter="url(#uvglow2)" opacity="0.9" />
      <path d="M188,50 L196,18" stroke="#00ff88" strokeWidth="4" strokeLinecap="round" filter="url(#uvglow2)" opacity="0.9" />
      {/* Center star */}
      <g transform="translate(130,85)" filter="url(#uvglow2)">
        <StarMark accent="#00ff88" size={44} opacity={0.95} />
      </g>
      {/* Goggles */}
      <g filter="url(#uvglow2)">
        <rect x="28" y="160" width="78" height="36" rx="18" fill="#001808" stroke="#00ff6633" strokeWidth="1.5" />
        <rect x="154" y="160" width="78" height="36" rx="18" fill="#001808" stroke="#00ff6633" strokeWidth="1.5" />
        <line x1="106" y1="178" x2="154" y2="178" stroke="#1a1a1a" strokeWidth="4" />
        <ellipse cx="67" cy="178" rx="28" ry="14" fill="rgba(0,255,80,0.08)" />
        <ellipse cx="193" cy="178" rx="28" ry="14" fill="rgba(0,255,80,0.08)" />
      </g>
      <text x="130" y="230" textAnchor="middle" fill="rgba(0,255,136,0.55)"
        style={{ fontSize: 7, fontFamily: 'Orbitron, monospace', letterSpacing: 3 }}>VOID PULSE UV</text>
    </svg>
  );
}

function LanyardCard() {
  return (
    <svg viewBox="0 0 200 260" width="70%" height="90%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', top: '5%', left: '15%' }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cord-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="50%" stopColor="#0088cc" />
          <stop offset="100%" stopColor="#00e5ff" />
        </linearGradient>
      </defs>
      {/* Cord */}
      <path d="M100,12 Q58,72 100,122 Q142,172 100,202"
        fill="none" stroke="url(#cord-g)" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      {/* Badge card */}
      <rect x="62" y="200" width="76" height="50" rx="5" fill="#080810" stroke="rgba(0,229,255,0.3)" strokeWidth="1" />
      <rect x="67" y="205" width="66" height="40" rx="3" fill="#040408" />
      {/* Star on badge */}
      <g transform="translate(100,222)">
        <StarMark accent="#00e5ff" size={28} opacity={0.9} />
      </g>
      <text x="100" y="238" textAnchor="middle" fill="rgba(0,229,255,0.7)"
        style={{ fontSize: 5, fontFamily: 'Orbitron, monospace', letterSpacing: 2 }}>OSCILLATE</text>
      {/* Clip */}
      <rect x="90" y="193" width="20" height="10" rx="3" fill="#222" stroke="#444" strokeWidth="0.5" />
      <text x="100" y="264" textAnchor="middle" fill="rgba(0,229,255,0.4)"
        style={{ fontSize: 6, fontFamily: 'Orbitron, monospace', letterSpacing: 2 }}>ENTITY LANYARD</text>
    </svg>
  );
}

function ProductVisual({ type, bgColor, accentColor, image }) {
  // If a real product image is set, show it
  if (image) {
    return (
      <img
        src={image}
        alt=""
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'contain', padding: 16,
        }}
      />
    );
  }
  // Otherwise fall back to SVG mockup
  const map = {
    'tee-signal': <TeeCard color={bgColor} accent={accentColor} label="signal" />,
    'tee-void':   <TeeCard color={bgColor} accent={accentColor} label="void" />,
    'tee-entity': <TeeCard color={bgColor} accent={accentColor} label="entity" />,
    'hoodie-entity': <HoodieCard color={bgColor} accent={accentColor} />,
    'hoodie-corp':   <HoodieCard color={bgColor} accent={accentColor} />,
    'acc-aria':   <AriaCard />,
    'acc-fan':    <FanCard />,
    'acc-uv':     <UVCard />,
    'acc-lanyard':<LanyardCard />,
  };
  return map[type] || null;
}

const CATS = ['all', 'tees', 'hoodies', 'accessories'];

export default function Merch({ onAddToCart }) {
  const [cat, setCat] = useState('all');
  const [selectedSizes, setSelectedSizes] = useState({});

  const filtered = cat === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === cat);

  function selectSize(id, size) {
    setSelectedSizes(s => ({ ...s, [id]: size }));
  }

  function addToCart(product) {
    const size = selectedSizes[product.id] || product.sizes[0];
    onAddToCart({
      id: `${product.id}-${size}`,
      name: product.name,
      detail: `${product.sub} · ${size}`,
      price: `₹${product.price.toLocaleString('en-IN')}`,
      type: 'merch',
    });
  }

  return (
    <div className="page">
      <div className="section">
        <div className="section-header">
          <p className="section-eyebrow">SIGNAL 001 DROP</p>
          <h2 className="section-title">MERCH</h2>
          <div className="section-divider" />
        </div>

        <div className="merch-tabs">
          {CATS.map(c => (
            <button key={c} className={`merch-tab ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}>
              {c === 'all' ? 'ALL ITEMS' : c.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="merch-grid">
          {filtered.map(product => (
            <div className="merch-card" key={product.id}>
              <div className="merch-img-wrap"
                style={{ background: `linear-gradient(160deg, ${product.bgColor === '#000000' ? '#0d0d0d' : product.bgColor} 0%, #000 100%)` }}>

                <ProductVisual type={product.imgType} bgColor={product.bgColor} accentColor={product.accentColor} image={product.image} />

                {product.label && <div className="merch-badge">{product.label}</div>}

                {/* Hover overlay with quick-add */}
                <div className="merch-overlay">
                  <button className="merch-overlay-btn" onClick={() => addToCart(product)}>
                    QUICK ADD
                  </button>
                </div>
              </div>

              <div className="merch-info">
                <div className="merch-product-name">{product.name}</div>
                <div className="merch-product-sub">{product.sub}</div>

                {product.sizes.length > 1 && (
                  <div className="merch-sizes">
                    {product.sizes.map(size => (
                      <button key={size}
                        className={`size-btn ${(selectedSizes[product.id] || product.sizes[0]) === size ? 'selected' : ''}`}
                        onClick={() => selectSize(product.id, size)}>
                        {size}
                      </button>
                    ))}
                  </div>
                )}

                <div className="merch-bottom">
                  <div className="merch-price">
                    ₹{product.price.toLocaleString('en-IN')}
                    <span>INC. GST</span>
                  </div>
                  <button className="btn-add-cart" onClick={() => addToCart(product)}>
                    + CART
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
