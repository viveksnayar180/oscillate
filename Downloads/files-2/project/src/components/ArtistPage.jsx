// ─── AvatarPlaceholder (duplicated from Artists.jsx — Phase 2: extract to shared) ──
function AvatarPlaceholder({ name }) {
  const initial = name.charAt(0);
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={`agp-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#120d08" />
          <stop offset="100%" stopColor="#060606" />
        </linearGradient>
      </defs>
      <rect width="220" height="220" fill={`url(#agp-${name})`} />
      <text x="110" y="130" textAnchor="middle" fill="rgba(200,120,50,0.08)"
        style={{ fontFamily: 'Orbitron, monospace', fontSize: 90, fontWeight: 900 }}>
        {initial}
      </text>
      {[44,88,132,176].map(y => (
        <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(200,120,50,0.03)" strokeWidth="1" />
      ))}
      {[44,88,132,176].map(x => (
        <line key={x} x1={x} y1="0" x2={x} y2="220" stroke="rgba(200,120,50,0.03)" strokeWidth="1" />
      ))}
    </svg>
  );
}

export default function ArtistPage({ artist, onBack, onSetPage }) {
  return (
    <div className="artist-page">

      {/* ── Hero (70vh) ── */}
      <div className="artist-page-hero">
        {artist.photo ? (
          <img
            src={artist.photo}
            alt={artist.name}
            className="artist-page-hero-img"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <AvatarPlaceholder name={artist.name} />
        )}
        <div className="artist-page-hero-overlay" />

        <div className="artist-page-hero-content">
          <button className="artist-back-btn" onClick={onBack}>
            ← ARTISTS
          </button>
          <h1 className="artist-page-name">{artist.name}</h1>
          <p className="artist-page-role">{artist.role}</p>
          <div className="artist-page-genres">
            {artist.genres.map(g => <span key={g} className="event-tag">{g}</span>)}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="artist-page-body">

        {/* Bio */}
        <p className="artist-page-bio">{artist.bio}</p>

        {/* Upcoming events */}
        {artist.upcomingEvents?.length > 0 && (
          <div className="artist-page-section">
            <div className="artist-page-section-label">UPCOMING</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {artist.upcomingEvents.map(ev => (
                <div key={ev} className="artist-event-row">
                  <span>◈ {ev}</span>
                </div>
              ))}
            </div>
            <button
              className="artist-tickets-btn"
              onClick={() => onSetPage('events')}
            >
              GET TICKETS →
            </button>
          </div>
        )}

        {/* Past events */}
        {artist.pastEvents?.length > 0 && (
          <div className="artist-page-section">
            <div className="artist-page-section-label">PLAYED</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {artist.pastEvents.map(ev => (
                <span key={ev} className="artist-past-tag">{ev}</span>
              ))}
            </div>
          </div>
        )}

        {/* Social links */}
        {(artist.soundcloud || artist.instagram) && (
          <div className="artist-page-section">
            <div style={{ display: 'flex', gap: 10 }}>
              {artist.soundcloud && (
                <a href={artist.soundcloud} target="_blank" rel="noopener noreferrer" className="artist-social-btn">
                  SOUNDCLOUD
                </a>
              )}
              {artist.instagram && (
                <a href={artist.instagram} target="_blank" rel="noopener noreferrer" className="artist-social-btn secondary">
                  INSTAGRAM
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
