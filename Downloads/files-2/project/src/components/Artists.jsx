import { useState } from 'react';

// ─── Artists ──────────────────────────────────────────────────────────────────
// To add a real photo: drop into public/artists/ and set photo: '/artists/filename.jpg'
const ARTISTS = [
  {
    id: 'uphoria',
    name: 'UPHORIA',
    role: 'RESIDENT · BENGALURU',
    bio: 'OSCILLATE\'s anchor and leading voice. UPHORIA has headlined every major OSCILLATE chapter, commanding peak-hour dancefloors with a sound that cuts between industrial techno and hypnotic groove. Her July 2025 headline set at Hyatt Centric is still talked about in Bengaluru\'s underground.',
    genres: ['TECHNO', 'INDUSTRIAL', 'PEAK HOUR'],
    photo: '/artists/uphoria.jpg',
    soundcloud: null,
    instagram: null,
    upcomingEvents: ['SIGNAL 002'],
    pastEvents: ['THE PORTAL (JUL 2025)', 'CHAPTER II (AUG 2025)'],
  },
  {
    id: 'malware',
    name: 'MALWARE',
    role: 'RESIDENT · BENGALURU',
    bio: 'The most consistent presence in OSCILLATE\'s history. MALWARE has played every chapter since The Portal — a relentless selector known for driving, hypnotic sets that hold the dancefloor from open to close. Dark, mechanical, and uncompromising.',
    genres: ['DARK TECHNO', 'HYPNOTIC', 'INDUSTRIAL'],
    photo: '/artists/malware.jpg',
    soundcloud: null,
    instagram: null,
    upcomingEvents: ['SIGNAL 002', 'STELLAR MAP'],
    pastEvents: ['THE PORTAL (JUL 2025)', 'CHAPTER II (AUG 2025)', 'CHAPTER IV (MAR 2026)'],
  },
  {
    id: 'oddible',
    name: 'ODDIBLE',
    role: 'RESIDENT · BENGALURU',
    bio: 'Oddible bridges the gap between raw energy and surgical precision. A key fixture across multiple OSCILLATE editions, their sets move through groove-heavy minimalism into full-throttle techno without ever losing the thread. Trust the machine.',
    genres: ['MINIMAL TECHNO', 'GROOVE', 'ACID'],
    photo: '/artists/oddible.jpg',
    soundcloud: null,
    instagram: null,
    upcomingEvents: ['ÜBERKIKZ × OSCILLATE', 'SIGNAL 002'],
    pastEvents: ['THE PORTAL (JUL 2025)', 'CHAPTER IV (MAR 2026)'],
  },
  {
    id: 'uberkikz',
    name: 'ÜBERKIKZ',
    role: 'INTERNATIONAL GUEST',
    bio: 'Making her India debut at OSCILLATE. ÜBERKIKZ has carved a reputation across Europe for marathon sets that blend raw techno with deep electronic textures. Her first India appearance lands in Bengaluru — co-presented with SPACENAUT and TECHNO AFFAIRS.',
    genres: ['TECHNO', 'ELECTRONIC', 'PEAK HOUR'],
    photo: '/artists/uberkikz.jpg',
    soundcloud: null,
    instagram: null,
    upcomingEvents: ['ÜBERKIKZ × OSCILLATE (APR 11, 2026)'],
    pastEvents: [],
  },
  {
    id: 'annabstracts',
    name: 'ANNABSTRACTS',
    role: 'ARTIST · BENGALURU',
    bio: 'A fresh but formidable name in Bengaluru\'s underground. ANNABSTRACTS made an immediate impact at OSCILLATE: THE PORTAL, arriving with a sound rooted in abstract rhythms and warehouse techno. A name to watch.',
    genres: ['ABSTRACT TECHNO', 'WAREHOUSE', 'EXPERIMENTAL'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: ['ÜBERKIKZ × OSCILLATE (APR 11, 2026)'],
    pastEvents: ['THE PORTAL (JUL 2025)'],
  },
  {
    id: 'marlon',
    name: 'MARLON',
    role: 'ARTIST · BENGALURU',
    bio: 'MARLON opens with intention. A master of mood, their opening sets at OSCILLATE events set the tone for everything that follows — layered, atmospheric, and always moving toward the dark.',
    genres: ['TECHNO', 'ATMOSPHERIC', 'OPENING SETS'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: ['ÜBERKIKZ × OSCILLATE (APR 11, 2026)'],
    pastEvents: ['THE PORTAL (JUL 2025)'],
  },
  {
    id: 'sumia',
    name: 'SUMIA',
    role: 'ARTIST · BENGALURU',
    bio: 'SUMIA brought CHAPTER II to life with a set that moved between hypnotic minimalism and pounding techno. A refined selector with impeccable taste — the kind of artist that makes a room feel like a different city.',
    genres: ['MINIMAL', 'TECHNO', 'HYPNOTIC'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: [],
    pastEvents: ['CHAPTER II (AUG 2025)'],
  },
  {
    id: 'esilise',
    name: 'ESILISE',
    role: 'GUEST · BENGALURU',
    bio: 'CHAPTER III opener. ESILISE commands space with restraint — building slow, deliberate arcs that hit without warning. A set that never rushed but never stood still.',
    genres: ['TECHNO', 'DARK MINIMAL'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: [],
    pastEvents: ['CHAPTER III (SEPT 2025)'],
  },
  {
    id: 'hanaa',
    name: 'HANAA aka LA PENDERIE NOIR',
    role: 'INTERNATIONAL GUEST · MUMBAI',
    bio: 'Hanaa, performing as La Penderie Noir, brought a commanding international presence to OSCILLATE\'s Mumbai debut at Waves. A DJ and selector with roots in the darker corners of European club culture — hypnotic, relentless, and deeply intentional.',
    genres: ['DARK TECHNO', 'HYPNOTIC', 'INDUSTRIAL'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: [],
    pastEvents: ['WAVES · MUMBAI (DEC 7, 2025)'],
  },
  {
    id: 'skeef-menezes',
    name: 'SKEEF MENEZES',
    role: 'ARTIST · MUMBAI',
    bio: 'A fixture in Mumbai\'s underground, SKEEF MENEZES brought raw local energy to OSCILLATE\'s first Mumbai chapter at Waves. Expect warehouse-ready selections and relentless forward motion.',
    genres: ['TECHNO', 'WAREHOUSE', 'PEAK HOUR'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: [],
    pastEvents: ['WAVES · MUMBAI (DEC 7, 2025)'],
  },
  {
    id: 'kruze',
    name: 'KRUZE',
    role: 'ARTIST · MUMBAI',
    bio: 'KRUZE has appeared across multiple OSCILLATE chapters, building a reputation for sets that find the groove and refuse to let it go. Chapter II in Bengaluru and the Mumbai Waves edition — consistency is the signature.',
    genres: ['TECHNO', 'GROOVE', 'DARK'],
    photo: null,
    soundcloud: null,
    instagram: null,
    upcomingEvents: [],
    pastEvents: ['CHAPTER II (AUG 2025)', 'WAVES · MUMBAI (DEC 7, 2025)'],
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
      <text x="110" y="130" textAnchor="middle" fill="rgba(0,229,255,0.15)"
        style={{ fontFamily: 'Orbitron, monospace', fontSize: 90, fontWeight: 900 }}>
        {initial}
      </text>
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
              {artist.photo ? (
                <img
                  src={artist.photo}
                  alt={artist.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <AvatarPlaceholder name={artist.name} />
              )}

              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
              }} />

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
                    }}>{g}</span>
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

            <div style={{ position: 'relative', height: 200, margin: '-32px -32px 24px', overflow: 'hidden', background: '#060606' }}>
              {selected.photo ? (
                <img
                  src={selected.photo}
                  alt={selected.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
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

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
              {selected.genres.map(g => <span key={g} className="event-tag">{g}</span>)}
            </div>

            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: 20 }}>
              {selected.bio}
            </p>

            {selected.upcomingEvents?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
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
                    }}>◈ {ev}</div>
                  ))}
                </div>
              </div>
            )}

            {selected.pastEvents?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 3, marginBottom: 10 }}>
                  PLAYED
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selected.pastEvents.map(ev => (
                    <span key={ev} style={{
                      fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                      padding: '4px 10px',
                    }}>{ev}</span>
                  ))}
                </div>
              </div>
            )}

            {(selected.soundcloud || selected.instagram) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {selected.soundcloud && (
                  <a href={selected.soundcloud} target="_blank" rel="noopener noreferrer"
                    className="btn-confirm"
                    style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 9 }}>
                    SOUNDCLOUD
                  </a>
                )}
                {selected.instagram && (
                  <a href={selected.instagram} target="_blank" rel="noopener noreferrer"
                    className="btn-confirm"
                    style={{ textDecoration: 'none', padding: '10px 20px', fontSize: 9, background: 'transparent', border: '1px solid rgba(0,229,255,0.4)', color: 'var(--cyan)' }}>
                    INSTAGRAM
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
