import { useState } from 'react';

// ─── Resident artists ─────────────────────────────────────────────────────────
// To add a real photo:
//   1. Drop into public/artists/  (e.g. public/artists/entity.jpg)
//   2. Set photo: '/artists/entity.jpg'  on the artist below
const ARTISTS = [
  {
    id: 'entity',
    name: 'ENTITY',
    role: 'RESIDENT · BENGALURU',
    bio: 'The foundation of OSCILLATE\'s sound. Entity weaves relentless dark techno with industrial textures, holding down the peak hour at every OSCILLATE event since the collective\'s inception. Known for extended sets that push the 909 to its absolute limit.',
    genres: ['DARK TECHNO', 'INDUSTRIAL', 'EBM'],
    photo: null, // set to '/artists/entity.jpg' when ready
    soundcloud: null,
    mixcloud: null,
    upcomingEvents: ['UBERKIKZ × OSCILLATE', 'SIGNAL 002'],
  },
  {
    id: 'signal',
    name: 'SIGNAL',
    role: 'RESIDENT · BENGALURU',
    bio: 'Ambient architect and resident DJ. SIGNAL constructs immersive soundscapes that bridge the gap between club music and cinematic electronica. Their sets are navigational — always moving, never rushing.',
    genres: ['AMBIENT TECHNO', 'MODULAR', 'DRONE'],
    photo: null,
    soundcloud: null,
    mixcloud: null,
    upcomingEvents: ['SIGNAL 002', 'STELLAR MAP'],
  },
  {
    id: 'prism',
    name: 'PRISM',
    role: 'RESIDENT · DELHI',
    bio: 'Delhi-based selector with a razor-sharp ear for groove. PRISM pulls from deep in the crates — minimal, hypnotic, and unmistakably dancefloor-focused. A regular at OSCILLATE\'s touring programme, bringing the capital\'s underground sensibility south.',
    genres: ['MINIMAL TECHNO', 'ACID', 'DEEP HOUSE'],
    photo: null,
    soundcloud: null,
    mixcloud: null,
    upcomingEvents: ['SIGNAL 002'],
  },
  {
    id: 'zero-state',
    name: 'ZERO STATE',
    role: 'GUEST · MUMBAI',
    bio: 'Mumbai-based live act and producer. ZERO STATE performs entirely on modular hardware, building and destroying tracks in real time. A singular experience that exists nowhere else on the Indian circuit.',
    genres: ['LIVE MODULAR', 'NOISE TECHNO', 'EXPERIMENTAL'],
    photo: null,
    soundcloud: null,
    mixcloud: null,
    upcomingEvents: ['STELLAR MAP'],
  },
];

// ─── SVG initials avatar ──────────────────────────────────────────────────────
function AvatarPlaceholder({ name, size = 220 }) {
  const initial = name.charAt(0);
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={`ag-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c1a2e" />
          <stop offset="100%" stopColor="#060606" />
        </linearGradient>
      </defs>
      <rect width="220" height="220" fill={`url(#ag-${name})`} />
      <text x="110" y="130" textAnchor="middle" fill="rgba(0,229,255,0.2)"
        style={{ fontFamily: 'Orbitron, monospace', fontSize: 90, fontWeight: 900 }}>
        {initial}
      </text>
      {/* subtle grid lines */}
      {[44,88,132,176].map(y => (
        <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(0,229,255,0.04)" strokeWidth="1" />
      ))}
      {[44,88,132,176].map(x => (
        <line key={x} x1={x} y1="0" x2={x} y2="220" stroke="rgba(0,229,255,0.04)" strokeWidth="1" />
      ))}
    </svg>
  );
}

export default function Artists() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="page">
      <div className="section">
        <div className="section-header">
          <p className="section-eyebrow">OSCILLATE COLLECTIVE</p>
          <h2 className="section-title">ARTISTS</h2>
          <div className="section-divider" />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 2,
          marginTop: 8,
        }}>
          {ARTISTS.map(artist => (
            <div
              key={artist.id}
              onClick={() => setSelected(artist)}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1.1',
                background: '#060606',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {/* Photo or placeholder */}
              {artist.photo ? (
                <img src={artist.photo} alt={artist.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <AvatarPlaceholder name={artist.name} />
              )}

              {/* Gradient overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
              }} />

              {/* Hover overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,229,255,0.04)',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
                className="artist-hover-overlay"
              />

              {/* Info */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 14, color: '#fff', letterSpacing: 3, marginBottom: 4 }}>
                  {artist.name}
                </div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 7, color: 'rgba(0,229,255,0.7)', letterSpacing: 2 }}>
                  {artist.role}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {artist.genres.slice(0, 2).map(g => (
                    <span key={g} style={{
                      fontFamily: 'var(--font-head)', fontSize: 6, letterSpacing: 1,
                      color: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      padding: '2px 6px',
                    }}>
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Artist detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="ticket-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>

            {/* Photo strip */}
            <div style={{ position: 'relative', height: 160, margin: '-32px -32px 24px', overflow: 'hidden', background: '#060606' }}>
              {selected.photo ? (
                <img src={selected.photo} alt={selected.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              ) : (
                <AvatarPlaceholder name={selected.name} size={560} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,10,1) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: 16, left: 24 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, color: '#fff', letterSpacing: 4 }}>
                  {selected.name}
                </div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, color: 'var(--cyan)', letterSpacing: 3, marginTop: 4 }}>
                  {selected.role}
                </div>
              </div>
            </div>

            {/* Genres */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
              {selected.genres.map(g => (
                <span key={g} className="event-tag">{g}</span>
              ))}
            </div>

            {/* Bio */}
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: 20 }}>
              {selected.bio}
            </p>

            {/* Upcoming events */}
            {selected.upcomingEvents?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 3, marginBottom: 10 }}>
                  UPCOMING
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selected.upcomingEvents.map(ev => (
                    <div key={ev} style={{
                      fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2,
                      color: 'rgba(0,229,255,0.7)',
                      border: '1px solid rgba(0,229,255,0.15)',
                      padding: '8px 12px',
                    }}>
                      ◈ {ev}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(selected.soundcloud || selected.mixcloud) && (
              <div style={{ display: 'flex', gap: 8 }}>
                {selected.soundcloud && (
                  <a href={selected.soundcloud} target="_blank" rel="noopener noreferrer"
                    className="btn-confirm"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '10px 20px', fontSize: 9 }}>
                    SOUNDCLOUD
                  </a>
                )}
                {selected.mixcloud && (
                  <a href={selected.mixcloud} target="_blank" rel="noopener noreferrer"
                    className="btn-confirm"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '10px 20px', fontSize: 9, background: 'transparent', border: '1px solid rgba(0,229,255,0.4)', color: 'var(--cyan)' }}>
                    MIXCLOUD
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
