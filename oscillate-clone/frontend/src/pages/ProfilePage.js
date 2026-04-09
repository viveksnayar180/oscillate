import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getProfile, upsertProfile, getTicketsByEmail, getArtists } from "@/lib/db";

const COLORS = {
  surface:     "#131313",
  surfaceLow:  "#1c1b1b",
  surfaceMid:  "#201f1f",
  surfaceHigh: "#2a2a2a",
  cta:         "#ff562d",
  ctaText:     "#560d00",
  cyan:        "#00eefc",
  onSurface:   "#e5e2e1",
  onSurfaceVar:"#e8bdb3",
  outline:     "#ae887f",
  outlineVar:  "#5e3f38",
};

const FieldInput = ({ label, value, onChange, placeholder, maxLength, textarea }) => (
  <div style={{ marginBottom: 16 }}>
    <p className="font-sg" style={{ fontSize: 9, letterSpacing: "0.3em", color: COLORS.outline, marginBottom: 6, textTransform: "uppercase" }}>
      {label}
    </p>
    {textarea ? (
      <textarea
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="osc-input font-sg"
        style={{
          width: "100%", padding: "10px 12px", background: COLORS.surfaceHigh,
          border: `1px solid ${COLORS.outlineVar}`, color: COLORS.onSurface,
          fontSize: 12, letterSpacing: "0.05em", resize: "vertical",
          boxSizing: "border-box", outline: "none",
        }}
      />
    ) : (
      <input
        type="text"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="osc-input font-sg"
        style={{
          width: "100%", padding: "10px 12px", background: COLORS.surfaceHigh,
          border: `1px solid ${COLORS.outlineVar}`, color: COLORS.onSurface,
          fontSize: 12, letterSpacing: "0.05em", boxSizing: "border-box", outline: "none",
        }}
      />
    )}
  </div>
);

export default function ProfilePage({ user, openAuth }) {
  const navigate = useNavigate();
  const [tab, setTab]             = useState("tickets");
  const [profile, setProfile]     = useState(null);
  const [tickets, setTickets]     = useState([]);
  const [artists, setArtists]     = useState([]);
  const [following, setFollowing] = useState(new Set());
  const [loading, setLoading]     = useState(true);
  const [savingProfile, setSaving] = useState(false);
  const [saveMsg, setSaveMsg]     = useState("");
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [form, setForm] = useState({
    display_name: "", city: "", bio: "", instagram: "", soundcloud: "", ra_link: "",
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const loadAll = async () => {
      setLoading(true);
      try {
        const [prof, tix, arts] = await Promise.all([
          getProfile(user.id),
          getTicketsByEmail(user.email),
          getArtists(),
        ]);

        const p = prof || {
          display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "USER",
          city: "",
          bio: "",
          avatar_url: user.user_metadata?.avatar_url || null,
        };
        setProfile(p);
        setForm({
          display_name: p.display_name || "",
          city: p.city || "",
          bio: p.bio || "",
          instagram: p.instagram || "",
          soundcloud: p.soundcloud || "",
          ra_link: p.ra_link || "",
        });
        setTickets(tix);
        setArtists(arts);
      } catch (err) {
        console.error("ProfilePage load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [user]);

  const toggleFollow = (id) => {
    setFollowing(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true); setSaveMsg("");
    try {
      const saved = await upsertProfile(user.id, form);
      setProfile(saved);
      setSaveMsg("SAVED");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (err) {
      setSaveMsg("ERROR: " + (err.message || "SAVE FAILED"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate("/");
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).getFullYear()
    : "—";

  const displayName = profile?.display_name || user?.email?.split("@")[0]?.toUpperCase() || "USER";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  const upcomingTickets = tickets.filter(t => !t.is_scanned);
  const pastTickets     = tickets.filter(t => t.is_scanned);

  // ── Unauthenticated state ──────────────────────────────────────────────────
  if (!loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center osc-grain font-sg"
        style={{ background: COLORS.surface, color: COLORS.onSurface }}>
        <div className="text-center px-6">
          <p style={{ fontSize: 9, letterSpacing: "0.4em", color: COLORS.outline, marginBottom: 16 }}>
            OSCILLATE_IDENTITY
          </p>
          <h1 className="font-display" style={{ fontSize: 48, color: COLORS.onSurface, marginBottom: 8 }}>
            IDENTIFY
          </h1>
          <h2 className="font-display" style={{ fontSize: 36, color: COLORS.cta, marginBottom: 24 }}>
            YOURSELF
          </h2>
          <p style={{ fontSize: 11, color: COLORS.outline, letterSpacing: "0.1em", marginBottom: 32 }}>
            Sign in to access your tickets and profile.
          </p>
          <button
            onClick={openAuth}
            className="osc-btn-primary font-sg"
            style={{
              padding: "14px 32px", background: COLORS.cta, border: "none",
              color: "#fff", fontSize: 11, letterSpacing: "0.25em",
              fontWeight: 700, cursor: "pointer",
            }}
          >
            SIGN IN
          </button>
          <button onClick={() => navigate("/")}
            style={{ display: "block", margin: "16px auto 0", background: "none", border: "none",
              color: COLORS.outline, fontSize: 10, letterSpacing: "0.2em", cursor: "pointer" }}>
            ← BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sg" style={{ background: COLORS.surface, color: COLORS.onSurface }}>

      {/* Top nav */}
      <div className="px-5 py-3 flex items-center justify-between sticky top-0 z-40"
        style={{ background: COLORS.surfaceLow, borderBottom: `1px solid ${COLORS.outlineVar}20` }}>
        <button onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: COLORS.outline, fontSize: 9,
            letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer" }}>
          ← BACK
        </button>
        <span className="font-pixel" style={{ fontSize: 14, letterSpacing: "0.2em", color: COLORS.cta }}>
          OSCILLATE
        </span>
        <span style={{ fontSize: 9, letterSpacing: "0.3em", color: COLORS.outlineVar, textTransform: "uppercase" }}>
          PROFILE
        </span>
      </div>

      {/* Profile hero */}
      <div className="relative overflow-hidden" style={{ background: COLORS.surfaceLow, minHeight: 200 }}>
        <div className="absolute inset-0 grid-overlay opacity-10 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none opacity-20" />
        <div className="relative z-10 px-6 md:px-12 pt-10 pb-6">
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16, border: `2px solid ${COLORS.cyan}`,
            overflow: "hidden", background: COLORS.surfaceMid,
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span className="font-sg" style={{ fontSize: 28, fontWeight: 700, color: COLORS.cyan }}>{initials}</span>
            }
          </div>

          <p style={{ fontSize: 9, letterSpacing: "0.4em", color: COLORS.outline, marginBottom: 4, textTransform: "uppercase" }}>
            OSCILLATE · MEMBER
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", textTransform: "uppercase", color: COLORS.onSurface }}>
            {displayName}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {profile?.city && (
              <span style={{ fontSize: 9, letterSpacing: "0.2em", color: COLORS.outline, textTransform: "uppercase" }}>
                {profile.city}
              </span>
            )}
            <span style={{ color: COLORS.outlineVar }}>·</span>
            <span style={{ fontSize: 9, letterSpacing: "0.2em", color: COLORS.outline, textTransform: "uppercase" }}>
              MEMBER SINCE {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${COLORS.outlineVar}20` }}>
        {[
          ["TICKETS", tickets.length],
          ["ATTENDED", pastTickets.length],
          ["UPCOMING", upcomingTickets.length],
        ].map(([l, v]) => (
          <div key={l} className="text-center py-4" style={{ borderRight: `1px solid ${COLORS.outlineVar}20` }}>
            <p style={{ fontSize: 7, letterSpacing: "0.2em", color: COLORS.outlineVar, textTransform: "uppercase", marginBottom: 4 }}>{l}</p>
            <p className="font-sg" style={{ fontWeight: 700, fontSize: 18, color: COLORS.onSurface }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex" style={{ borderBottom: `1px solid ${COLORS.outlineVar}20` }}>
        {[["tickets","TICKETS"],["vault","THE VAULT"],["settings","SETTINGS"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-3 font-sg"
            style={{
              fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
              borderBottom: `2px solid ${tab === id ? COLORS.cta : "transparent"}`,
              color: tab === id ? COLORS.cta : COLORS.outline,
              background: tab === id ? COLORS.surfaceMid : "transparent",
              border: "none", cursor: "pointer",
            }}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-6 md:px-12 py-8" style={{ maxWidth: 900, margin: "0 auto" }}>

        {loading && (
          <p className="font-sg text-center py-12"
            style={{ fontSize: 11, letterSpacing: "0.2em", color: COLORS.outline, textTransform: "uppercase" }}>
            LOADING...
          </p>
        )}

        {/* ── TICKETS TAB ── */}
        {!loading && tab === "tickets" && (
          <div>
            <p style={{ fontSize: 9, letterSpacing: "0.4em", color: COLORS.outline, textTransform: "uppercase", marginBottom: 24 }}>
              YOUR TRANSMISSIONS
            </p>

            {tickets.length === 0 ? (
              <div className="text-center" style={{ paddingTop: 80 }}>
                <p style={{ fontSize: 11, letterSpacing: "0.2em", color: COLORS.outlineVar, textTransform: "uppercase" }}>
                  NO TICKETS YET
                </p>
                <a href="/"
                  style={{
                    display: "inline-block", marginTop: 24,
                    padding: "12px 24px", background: COLORS.cta, color: "#fff",
                    fontSize: 10, letterSpacing: "0.2em", textDecoration: "none",
                    fontWeight: 700, textTransform: "uppercase",
                  }}>
                  EXPLORE EVENTS
                </a>
              </div>
            ) : (
              <>
                {upcomingTickets.length > 0 && (
                  <>
                    <p style={{ fontSize: 8, letterSpacing: "0.3em", color: COLORS.cyan, textTransform: "uppercase", marginBottom: 12 }}>
                      UPCOMING
                    </p>
                    <TicketList tickets={upcomingTickets} expandedTicket={expandedTicket} setExpandedTicket={setExpandedTicket} />
                  </>
                )}
                {pastTickets.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <p style={{ fontSize: 8, letterSpacing: "0.3em", color: COLORS.outline, textTransform: "uppercase", marginBottom: 12 }}>
                      ATTENDED
                    </p>
                    <TicketList tickets={pastTickets} expandedTicket={expandedTicket} setExpandedTicket={setExpandedTicket} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── THE VAULT — FOLLOWING TAB ── */}
        {!loading && tab === "vault" && (
          <div>
            <p style={{ fontSize: 9, letterSpacing: "0.4em", color: COLORS.outline, textTransform: "uppercase", marginBottom: 8 }}>
              THE VAULT
            </p>
            <h2 className="font-display" style={{ fontSize: 30, textTransform: "uppercase", color: COLORS.onSurface, marginBottom: 24 }}>
              FOLLOWING
            </h2>
            {artists.length === 0 ? (
              <p style={{ fontSize: 11, color: COLORS.outlineVar, letterSpacing: "0.1em" }}>No artists yet.</p>
            ) : (
              artists.map((artist, i) => (
                <div key={artist.id}
                  className="flex items-center justify-between py-4 group transition-all"
                  style={{ borderBottom: `1px solid ${COLORS.outlineVar}20`, cursor: "default" }}>
                  <div className="flex items-center gap-4">
                    <span className="font-mono" style={{ fontSize: 9, width: 20, color: COLORS.outlineVar }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ width: 40, height: 40, display: "flex", alignItems: "center",
                      justifyContent: "center", background: COLORS.surfaceHigh }}>
                      {artist.photo_url
                        ? <img src={artist.photo_url} alt={artist.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span className="font-sg" style={{ fontSize: 12, color: COLORS.outline }}>
                            {artist.name.charAt(0)}
                          </span>
                      }
                    </div>
                    <div>
                      <p className="font-sg" style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", color: COLORS.onSurface }}>
                        {artist.name}
                      </p>
                      <p className="font-sg" style={{ fontSize: 9, textTransform: "uppercase", color: COLORS.outline }}>
                        {[artist.role, artist.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFollow(artist.id)}
                    className="font-sg"
                    style={{
                      padding: "8px 16px", fontSize: 9, letterSpacing: "0.15em",
                      textTransform: "uppercase", cursor: "pointer", border: "none",
                      ...(following.has(artist.id)
                        ? { background: COLORS.cta, color: "#fff" }
                        : { background: "transparent", border: `1px solid ${COLORS.outlineVar}40`, color: COLORS.outline })
                    }}>
                    {following.has(artist.id) ? "FOLLOWING" : "FOLLOW"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {!loading && tab === "settings" && (
          <div>
            <p style={{ fontSize: 9, letterSpacing: "0.4em", color: COLORS.outline, textTransform: "uppercase", marginBottom: 24 }}>
              SYSTEM_PROTOCOLS
            </p>

            <FieldInput label="DISPLAY NAME" value={form.display_name} maxLength={60}
              onChange={v => setForm(f => ({ ...f, display_name: v }))} placeholder="Your name" />
            <FieldInput label="CITY" value={form.city} maxLength={60}
              onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Mumbai, Bengaluru..." />
            <FieldInput label="BIO" value={form.bio} maxLength={160} textarea
              onChange={v => setForm(f => ({ ...f, bio: v }))} placeholder="Into dark techno..." />

            <p style={{ fontSize: 9, letterSpacing: "0.3em", color: COLORS.outline, textTransform: "uppercase", margin: "24px 0 12px" }}>
              SIGNAL_LINKS
            </p>
            <FieldInput label="INSTAGRAM (handle without @)" value={form.instagram} maxLength={60}
              onChange={v => setForm(f => ({ ...f, instagram: v.replace(/^@/, "") }))} placeholder="handle" />
            <FieldInput label="SOUNDCLOUD (handle without @)" value={form.soundcloud} maxLength={60}
              onChange={v => setForm(f => ({ ...f, soundcloud: v.replace(/^@/, "") }))} placeholder="handle" />
            <FieldInput label="RESIDENT ADVISOR (full URL)" value={form.ra_link} maxLength={200}
              onChange={v => setForm(f => ({ ...f, ra_link: v }))} placeholder="https://ra.co/dj/..." />

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="font-sg"
                style={{
                  flex: 1, padding: "14px", background: COLORS.cta, border: "none",
                  color: "#fff", fontSize: 11, letterSpacing: "0.25em",
                  fontWeight: 700, cursor: savingProfile ? "wait" : "pointer",
                  opacity: savingProfile ? 0.6 : 1, textTransform: "uppercase",
                }}>
                {savingProfile ? "SAVING..." : "SAVE PROFILE"}
              </button>
              {saveMsg && (
                <span className="font-sg" style={{
                  fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
                  color: saveMsg.startsWith("ERROR") ? "#ff4444" : COLORS.cyan,
                }}>{saveMsg}</span>
              )}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.outlineVar}20` }}>
              <p style={{ fontSize: 9, color: COLORS.outline, letterSpacing: "0.15em", marginBottom: 8, textTransform: "uppercase" }}>
                SIGNED IN AS: {user?.email}
              </p>
              <button
                onClick={handleLogout}
                className="font-sg"
                style={{
                  padding: "12px 32px", background: "transparent",
                  border: `1px solid ${COLORS.outlineVar}40`,
                  color: COLORS.outline, fontSize: 11,
                  letterSpacing: "0.2em", cursor: "pointer", textTransform: "uppercase",
                }}>
                SIGN OUT
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ paddingBottom: 80 }} />
    </div>
  );
}

// ── ICS calendar download ─────────────────────────────────────────────────────
const EVENT_META = {
  "ÜBERKIKZ × OSCILLATE": { iso: "2026-04-11T17:00:00+05:30", durationH: 8, venue: "TBA, Bengaluru" },
  "SIGNAL 002":            { iso: "2026-05-17T22:00:00+05:30", durationH: 8, venue: "Subterranean, Bengaluru" },
  "STELLAR MAP":           { iso: "2026-06-21T04:00:00+05:30", durationH: 6, venue: "Open Air, Goa" },
};

function toICSDate(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function downloadICS(ticket) {
  const ev = EVENT_META[ticket.event_name];
  if (!ev) return;
  const start = new Date(ev.iso);
  const end   = new Date(start.getTime() + ev.durationH * 3600 * 1000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OSCILLATE//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ticket.ticket_id}@oscillate.in`,
    `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
    `SUMMARY:${ticket.event_name}`, `LOCATION:${ev.venue}`,
    `DESCRIPTION:Ticket ID: ${ticket.ticket_id}\\nTier: ${ticket.event_detail || ""}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `oscillate-${(ticket.event_name || "event").toLowerCase().replace(/\s+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Ticket card with QR expand ────────────────────────────────────────────────
function TicketList({ tickets, expandedTicket, setExpandedTicket }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {tickets.map(ticket => (
        <div
          key={ticket.ticket_id}
          style={{ background: "#1c1b1b", padding: 20, position: "relative", cursor: "pointer" }}
          onClick={() => setExpandedTicket(expandedTicket === ticket.ticket_id ? null : ticket.ticket_id)}
        >
          <span style={{ position:"absolute", top:0, left:0, width:12, height:12,
            borderTop:`2px solid #ff562d`, borderLeft:`2px solid #ff562d` }} />
          <span style={{ position:"absolute", bottom:0, right:0, width:12, height:12,
            borderBottom:`2px solid #ff562d`, borderRight:`2px solid #ff562d` }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="font-sg" style={{ fontSize: 9, letterSpacing: "0.2em", color: "#ae887f",
                textTransform: "uppercase", marginBottom: 4 }}>
                {ticket.event_name}
              </p>
              <p className="font-sg" style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase",
                color: "#e5e2e1", marginBottom: 6 }}>
                {ticket.event_detail || "GENERAL"}
              </p>
              <p className="font-mono" style={{ fontSize: 9, color: "#5e3f38" }}>
                {ticket.ticket_id}
              </p>
              {ticket.is_scanned && (
                <span className="font-sg" style={{
                  display: "inline-block", marginTop: 8, padding: "3px 8px",
                  background: "#201f1f", color: "#ae887f", fontSize: 8, letterSpacing: "0.2em",
                }}>ATTENDED</span>
              )}
            </div>

            <div style={{ width: 56, height: 56, background: "#fff", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {ticket.qr_data
                ? <QRCodeSVG value={ticket.qr_data} size={48} level="M" />
                : <span className="font-sg" style={{ fontSize: 8, color: "#000", textAlign: "center" }}>QR</span>
              }
            </div>
          </div>

          {expandedTicket === ticket.ticket_id && ticket.qr_data && (
            <div style={{ marginTop: 20, textAlign: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "inline-block", padding: 16, background: "#fff" }}>
                <QRCodeSVG value={ticket.qr_data} size={200} level="H" />
              </div>
              <p className="font-sg" style={{ marginTop: 12, fontSize: 9, letterSpacing: "0.2em",
                color: "#ae887f", textTransform: "uppercase" }}>
                SHOW THIS AT THE DOOR
              </p>
              {!ticket.is_scanned && EVENT_META[ticket.event_name] && (
                <button
                  onClick={() => downloadICS(ticket)}
                  className="font-sg"
                  style={{
                    marginTop: 12, padding: "8px 20px", background: "transparent",
                    border: "1px solid #5e3f38", color: "#ae887f",
                    fontSize: 9, letterSpacing: "0.2em", cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  + ADD TO CALENDAR
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
