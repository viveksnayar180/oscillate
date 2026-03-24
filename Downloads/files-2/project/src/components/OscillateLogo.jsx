// High-fidelity chrome star logo matching the OSCILLATE brand reference image
export default function OscillateLogo({ size = 200, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Chrome gradient - main face */}
        <linearGradient id="chrome-main" x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#f5f5f5" />
          <stop offset="12%" stopColor="#d0d0d0" />
          <stop offset="28%" stopColor="#e8e8e8" />
          <stop offset="42%" stopColor="#909090" />
          <stop offset="55%" stopColor="#c8c8c8" />
          <stop offset="68%" stopColor="#585858" />
          <stop offset="80%" stopColor="#a8a8a8" />
          <stop offset="92%" stopColor="#d8d8d8" />
          <stop offset="100%" stopColor="#b0b0b0" />
        </linearGradient>

        {/* Chrome gradient - highlights */}
        <linearGradient id="chrome-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="30%" stopColor="#e0e0e0" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#a0a0a0" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#606060" stopOpacity="0.7" />
        </linearGradient>

        {/* Chrome gradient - shadows */}
        <linearGradient id="chrome-dark" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c0c0c0" />
          <stop offset="35%" stopColor="#707070" />
          <stop offset="65%" stopColor="#909090" />
          <stop offset="100%" stopColor="#404040" />
        </linearGradient>

        {/* Diagonal gradient for individual spikes */}
        <linearGradient id="spike-tl-br" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0f0f0" />
          <stop offset="40%" stopColor="#888888" />
          <stop offset="70%" stopColor="#cccccc" />
          <stop offset="100%" stopColor="#505050" />
        </linearGradient>

        <linearGradient id="spike-tr-bl" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8e8e8" />
          <stop offset="35%" stopColor="#aaaaaa" />
          <stop offset="70%" stopColor="#d8d8d8" />
          <stop offset="100%" stopColor="#686868" />
        </linearGradient>

        <linearGradient id="spike-v" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#f8f8f8" />
          <stop offset="30%" stopColor="#b8b8b8" />
          <stop offset="60%" stopColor="#e0e0e0" />
          <stop offset="100%" stopColor="#707070" />
        </linearGradient>

        <linearGradient id="spike-h" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="30%" stopColor="#a0a0a0" />
          <stop offset="60%" stopColor="#d0d0d0" />
          <stop offset="100%" stopColor="#787878" />
        </linearGradient>

        {/* Radial glow for center */}
        <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#e8f4ff" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#c0d8f0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#80b0e0" stopOpacity="0" />
        </radialGradient>

        {/* Outer glow filter */}
        <filter id="outer-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="blur1" />
          <feColorMatrix in="blur1" type="matrix"
            values="0.3 0.5 1 0 0  0.3 0.5 1 0 0  0.5 0.7 1 0 0  0 0 0 0.6 0" result="blue-blur" />
          <feGaussianBlur stdDeviation="16" result="blur2" />
          <feColorMatrix in="blur2" type="matrix"
            values="0.2 0.4 1 0 0  0.2 0.4 1 0 0  0.4 0.6 1 0 0  0 0 0 0.3 0" result="wide-blur" />
          <feMerge>
            <feMergeNode in="wide-blur" />
            <feMergeNode in="blue-blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Sharp edge filter */}
        <filter id="sharp">
          <feGaussianBlur stdDeviation="0.3" />
        </filter>

        {/* Inner shine filter */}
        <filter id="shine">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g filter="url(#outer-glow)">
        {/* === MAIN LONG SPIKES (8 primary directions) === */}

        {/* Spike: UP (long, slightly tilted right) */}
        <polygon points="200,200 207,148 200,18 193,148"
          fill="url(#spike-v)" />
        {/* Spike: UP shadow side */}
        <polygon points="200,200 200,18 196,148"
          fill="url(#chrome-dark)" opacity="0.5" />

        {/* Spike: DOWN */}
        <polygon points="200,200 207,252 200,382 193,252"
          fill="url(#spike-v)" />
        <polygon points="200,200 200,382 204,252"
          fill="url(#chrome-dark)" opacity="0.4" />

        {/* Spike: LEFT */}
        <polygon points="200,200 148,207 18,200 148,193"
          fill="url(#spike-h)" />
        <polygon points="200,200 18,200 148,196"
          fill="url(#chrome-dark)" opacity="0.5" />

        {/* Spike: RIGHT */}
        <polygon points="200,200 252,207 382,200 252,193"
          fill="url(#spike-h)" />
        <polygon points="200,200 382,200 252,204"
          fill="url(#chrome-dark)" opacity="0.4" />

        {/* Spike: TOP-LEFT diagonal */}
        <polygon points="200,200 190,154 64,64 154,190"
          fill="url(#spike-tl-br)" />
        <polygon points="200,200 64,64 155,186"
          fill="url(#chrome-dark)" opacity="0.45" />

        {/* Spike: BOTTOM-RIGHT diagonal */}
        <polygon points="200,200 210,246 336,336 246,210"
          fill="url(#spike-tl-br)" />
        <polygon points="200,200 336,336 244,214"
          fill="url(#chrome-dark)" opacity="0.4" />

        {/* Spike: TOP-RIGHT diagonal */}
        <polygon points="200,200 246,190 336,64 210,154"
          fill="url(#spike-tr-bl)" />
        <polygon points="200,200 336,64 214,155"
          fill="url(#chrome-dark)" opacity="0.45" />

        {/* Spike: BOTTOM-LEFT diagonal */}
        <polygon points="200,200 154,210 64,336 190,246"
          fill="url(#spike-tr-bl)" />
        <polygon points="200,200 64,336 186,244"
          fill="url(#chrome-dark)" opacity="0.4" />

        {/* === SECONDARY SPIKES (between main ones, shorter) === */}

        {/* Between UP and TOP-RIGHT */}
        <polygon points="200,200 212,168 258,82 188,172"
          fill="url(#chrome-light)" opacity="0.85" />
        <polygon points="200,200 258,82 205,165"
          fill="url(#chrome-dark)" opacity="0.35" />

        {/* Between TOP-RIGHT and RIGHT */}
        <polygon points="200,200 232,188 318,142 228,212"
          fill="url(#chrome-light)" opacity="0.85" />
        <polygon points="200,200 318,142 232,205"
          fill="url(#chrome-dark)" opacity="0.35" />

        {/* Between RIGHT and BOTTOM-RIGHT */}
        <polygon points="200,200 232,212 318,258 228,188"
          fill="url(#chrome-light)" opacity="0.8" />

        {/* Between BOTTOM-RIGHT and DOWN */}
        <polygon points="200,200 212,232 258,318 188,228"
          fill="url(#chrome-light)" opacity="0.8" />

        {/* Between DOWN and BOTTOM-LEFT */}
        <polygon points="200,200 188,232 142,318 212,228"
          fill="url(#chrome-light)" opacity="0.8" />

        {/* Between BOTTOM-LEFT and LEFT */}
        <polygon points="200,200 168,212 82,258 172,188"
          fill="url(#chrome-light)" opacity="0.8" />

        {/* Between LEFT and TOP-LEFT */}
        <polygon points="200,200 168,188 82,142 172,212"
          fill="url(#chrome-light)" opacity="0.85" />

        {/* Between TOP-LEFT and UP */}
        <polygon points="200,200 188,168 142,82 212,172"
          fill="url(#chrome-light)" opacity="0.85" />

        {/* === TERTIARY MICRO SPIKES (very fine, close to center) === */}
        <polygon points="200,200 204,178 218,130 196,182" fill="#e0e0e0" opacity="0.7" />
        <polygon points="200,200 222,196 270,178 218,204" fill="#d8d8d8" opacity="0.65" />
        <polygon points="200,200 196,222 178,270 204,218" fill="#d0d0d0" opacity="0.65" />
        <polygon points="200,200 178,204 130,222 182,196" fill="#d8d8d8" opacity="0.65" />

        {/* === CENTER CORE === */}
        <circle cx="200" cy="200" r="22" fill="url(#chrome-main)" />
        <circle cx="200" cy="200" r="16" fill="url(#chrome-light)" />
        <circle cx="200" cy="200" r="10" fill="url(#center-glow)" />
        <circle cx="200" cy="200" r="5" fill="#ffffff" opacity="0.95" />

        {/* Specular highlight on center */}
        <ellipse cx="196" cy="196" rx="5" ry="4" fill="white" opacity="0.8" transform="rotate(-30,196,196)" />
      </g>
    </svg>
  );
}
