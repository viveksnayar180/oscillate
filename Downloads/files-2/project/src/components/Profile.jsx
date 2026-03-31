import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

// ─── Calendar export (reused from MyTickets) ─────────────────────────────────
const EVENT_CAL = {
  'ÜBERKIKZ × OSCILLATE': { iso: '2026-04-11T17:00:00+05:30', durationH: 8, venue: 'TBA, Bengaluru' },
  'SIGNAL 002':            { iso: '2026-05-17T22:00:00+05:30', durationH: 8, venue: 'Subterranean, Bengaluru' },
  'STELLAR MAP':           { iso: '2026-06-21T04:00:00+05:30', durationH: 6, venue: 'Open Air, Goa' },
};

function toICSDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function downloadICS(ticket) {
  const ev = EVENT_CAL[ticket.event_name];
  if (!ev) return;
  const start = new Date(ev.iso);
  const end   = new Date(start.getTime() + ev.durationH * 3600 * 1000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OSCILLATE//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ticket.ticket_id}@oscillate.in`,
    `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
    `SUMMARY:${ticket.event_name}`, `LOCATION:${ev.venue}`,
    `DESCRIPTION:Ticket ID: ${ticket.ticket_id}\\nTier: ${ticket.event_detail || ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `oscillate-${(ticket.event_name || 'event').toLowerCase().replace(/\s+/g, '-')}.ics`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Avatar initials fallback ──────────────────────────────────────────────
function Initials({ name, size = 72 }) {
  const letters = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(0,229,255,0.12)',
      border: '1px solid rgba(0,229,255,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-head)', fontSize: size * 0.32,
      color: 'var(--cyan)', letterSpacing: 2, flexShrink: 0,
    }}>{letters}</div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Profile({ user, onSetPage }) {
  const [profile, setProfile]   = useState(null);
  const [tickets, setTickets]   = useState([]);
  const [tab, setTab]           = useState('tickets'); // tickets | following | settings
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [saveMsg, setSaveMsg]   = useState('');

  // Edit form state
  const [form, setForm] = useState({
    display_name: '', city: '', bio: '', instagram: '', soundcloud: '', ra_link: '',
  });

  // ── Load profile + tickets ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || !supabase) return;

    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setForm({
            display_name: data.display_name || '',
            city:         data.city         || '',
            bio:          data.bio          || '',
            instagram:    data.instagram    || '',
            soundcloud:   data.soundcloud   || '',
            ra_link:      data.ra_link      || '',
          });
        }
      });

    supabase.from('tickets').select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTickets(data || []));
  }, [user]);

  // ── Save profile edits ──────────────────────────────────────────────────
  async function saveProfile() {
    if (!supabase || !user) return;
    setSaving(true);
    const updates = {
      id:           user.id,
      display_name: form.display_name.trim().slice(0, 60) || null,
      city:         form.city.trim().slice(0, 60)         || null,
      bio:          form.bio.trim().slice(0, 160)         || null,
      instagram:    form.instagram.trim().replace(/^@/, '').slice(0, 60) || null,
      soundcloud:   form.soundcloud.trim().replace(/^@/, '').slice(0, 60) || null,
      ra_link:      form.ra_link.trim().slice(0, 200)     || null,
      updated_at:   new Date().toISOString(),
    };
    const { data, error } = await supabase.from('profiles').upsert(updates).select().single();
    if (!error && data) {
      setProfile(data);
      setSaveMsg('SAVED');
      setEditing(false);
      setTimeout(() => setSaveMsg(''), 2000);
    }
    setSaving(false);
  }

  if (!user) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 120 }}>
        <p style={{ fontFamily: 'var(--font-head)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 4 }}>
          NOT SIGNED IN
        </p>
      </div>
    );
  }

  const displayName = profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'FAN';
  const avatarUrl   = profile?.avatar_url   || user.user_metadata?.avatar_url || null;
  const memberSince = new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const upcomingTickets = tickets.filter(t => !t.is_scanned);
  const pastTickets     = tickets.filter(t =>  t.is_scanned);

  return (
    <div className="page profile-page">

      {/* ── Profile header ─────────────────────────────────────────────── */}
      <div className="profile-header">
        <div className="profile-header-inner">
          <div className="profile-avatar-wrap">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="profile-avatar" />
              : <Initials name={displayName} size={80} />
            }
          </div>

          <div className="profile-meta">
            <div className="profile-name">{displayName}</div>
            <div className="profile-sub">
              {profile?.city && <span>{profile.city} · </span>}
              <span>MEMBER SINCE {memberSince.toUpperCase()}</span>
              {tickets.length > 0 && <span> · {tickets.length} EVENT{tickets.length !== 1 ? 'S' : ''}</span>}
            </div>
            {profile?.bio && (
              <p className="profile-bio">{profile.bio}</p>
            )}
            <div className="profile-socials">
              {profile?.instagram && (
                <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noreferrer" className="profile-social-link">
                  IG
                </a>
              )}
              {profile?.soundcloud && (
                <a href={`https://soundcloud.com/${profile.soundcloud}`} target="_blank" rel="noreferrer" className="profile-social-link">
                  SC
                </a>
              )}
              {profile?.ra_link && (
                <a href={profile.ra_link} target="_blank" rel="noreferrer" className="profile-social-link">
                  RA
                </a>
              )}
            </div>
          </div>

          <button
            className="profile-edit-btn"
            onClick={() => { setEditing(e => !e); setTab('settings'); }}
          >
            {editing ? 'CANCEL' : 'EDIT PROFILE'}
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="profile-tabs">
        {[
          { id: 'tickets',   label: `TICKETS (${tickets.length})` },
          { id: 'following', label: 'FOLLOWING' },
          { id: 'settings',  label: 'SETTINGS' },
        ].map(t => (
          <button
            key={t.id}
            className={`profile-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => { setTab(t.id); if (t.id !== 'settings') setEditing(false); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────── */}
      <div className="profile-content">

        {/* TICKETS TAB */}
        {tab === 'tickets' && (
          <div className="profile-tickets">
            {tickets.length === 0 ? (
              <div className="profile-empty">
                <p className="profile-empty-head">NO TICKETS YET</p>
                <p className="profile-empty-sub">Your tickets will appear here after purchase.</p>
                <button className="btn-confirm" style={{ marginTop: 20 }} onClick={() => onSetPage('events')}>
                  BROWSE EVENTS →
                </button>
              </div>
            ) : (
              <>
                {upcomingTickets.length > 0 && (
                  <div className="profile-ticket-group">
                    <div className="profile-ticket-group-label">UPCOMING</div>
                    {upcomingTickets.map(t => (
                      <TicketCard key={t.ticket_id} ticket={t} expanded={expanded} setExpanded={setExpanded} />
                    ))}
                  </div>
                )}
                {pastTickets.length > 0 && (
                  <div className="profile-ticket-group">
                    <div className="profile-ticket-group-label">ATTENDED</div>
                    {pastTickets.map(t => (
                      <TicketCard key={t.ticket_id} ticket={t} expanded={expanded} setExpanded={setExpanded} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* FOLLOWING TAB */}
        {tab === 'following' && (
          <div className="profile-empty">
            <p className="profile-empty-head">COMING SOON</p>
            <p className="profile-empty-sub">Follow artists and collectives to get notified about new events.</p>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div className="profile-settings">
            <div className="profile-settings-section">
              <div className="profile-settings-label">DISPLAY NAME</div>
              <input
                className="form-input"
                value={form.display_name}
                placeholder={user.user_metadata?.full_name || 'Your name'}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                maxLength={60}
              />
            </div>

            <div className="profile-settings-section">
              <div className="profile-settings-label">CITY</div>
              <input
                className="form-input"
                value={form.city}
                placeholder="Bengaluru, Mumbai, Goa..."
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                maxLength={60}
              />
            </div>

            <div className="profile-settings-section">
              <div className="profile-settings-label">BIO <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>({form.bio.length}/160)</span></div>
              <textarea
                className="form-input"
                value={form.bio}
                placeholder="Into dark techno, early mornings, good sound systems."
                onChange={e => setForm(f => ({ ...f, bio: e.target.value.slice(0, 160) }))}
                rows={3}
                style={{ resize: 'vertical', minHeight: 72 }}
              />
            </div>

            <div className="profile-settings-section">
              <div className="profile-settings-label">INSTAGRAM</div>
              <input
                className="form-input"
                value={form.instagram}
                placeholder="@yourhandle"
                onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                maxLength={60}
              />
            </div>

            <div className="profile-settings-section">
              <div className="profile-settings-label">SOUNDCLOUD</div>
              <input
                className="form-input"
                value={form.soundcloud}
                placeholder="@yourhandle"
                onChange={e => setForm(f => ({ ...f, soundcloud: e.target.value }))}
                maxLength={60}
              />
            </div>

            <div className="profile-settings-section">
              <div className="profile-settings-label">RESIDENT ADVISOR</div>
              <input
                className="form-input"
                value={form.ra_link}
                placeholder="https://ra.co/people/..."
                onChange={e => setForm(f => ({ ...f, ra_link: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
              <button
                className="btn-confirm"
                onClick={saveProfile}
                disabled={saving}
                style={{ opacity: saving ? 0.6 : 1, flexShrink: 0 }}
              >
                {saving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              {saveMsg && (
                <span style={{ fontFamily: 'var(--font-head)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 3 }}>
                  ✓ {saveMsg}
                </span>
              )}
            </div>

            <div className="profile-settings-divider" />

            <div className="profile-settings-label" style={{ marginBottom: 8 }}>ACCOUNT</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
              {user.email}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              Member since {memberSince}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ticket card ──────────────────────────────────────────────────────────────
function TicketCard({ ticket, expanded, setExpanded }) {
  const isOpen = expanded === ticket.ticket_id;
  return (
    <div className={`profile-ticket-card${ticket.is_scanned ? ' used' : ''}`}>
      <div className="profile-ticket-top" onClick={() => setExpanded(isOpen ? null : ticket.ticket_id)}>
        <div className="profile-ticket-info">
          <div className="profile-ticket-event">{ticket.event_name}</div>
          <div className="profile-ticket-tier">{ticket.event_detail || 'GENERAL'}</div>
          <div className="profile-ticket-id">{ticket.ticket_id}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {ticket.is_scanned && (
            <span style={{ fontFamily: 'var(--font-head)', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>
              ✓ ATTENDED
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 1 }}>
            {isOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="profile-ticket-qr-wrap">
          {!ticket.is_scanned ? (
            <>
              <QRCodeSVG
                value={ticket.ticket_id}
                size={160}
                bgColor="#000000"
                fgColor="#ffffff"
                level="H"
              />
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 12 }}>
                Show this at the door
              </div>
              <button
                className="profile-ical-btn"
                onClick={() => downloadICS(ticket)}
              >
                + ADD TO CALENDAR
              </button>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px 0' }}>
              This ticket has been scanned.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
