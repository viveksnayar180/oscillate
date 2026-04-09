import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VN = {
  surface:    "#131313",
  surfaceLow: "#1c1b1b",
  surfaceMid: "#201f1f",
  surfaceHigh:"#2a2a2a",
  cta:        "#ff562d",
  ctaText:    "#560d00",
  cyan:       "#00eefc",
  onSurface:  "#e5e2e1",
  onSurfaceVar:"#e8bdb3",
  outline:    "#ae887f",
  outlineVar: "#5e3f38",
};

export default function VenueDetailPage() {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derive venue name from venueId slug
  const venueName = venueId
    ? venueId.replace(/-/g, " ").toUpperCase()
    : "THE WAREHOUSE";

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/events`);
        // Filter events for this venue
        const all = r.data;
        const venueEvents = venueId
          ? all.filter(e => e.venue?.toLowerCase().replace(/\s+/g, "-") === venueId)
          : all;
        setEvents(venueEvents.length > 0 ? venueEvents : all.slice(0, 4));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [venueId]);

  const upcoming = events.filter(e => !e.is_past);
  const past = events.filter(e => e.is_past);

  return (
    <div className="min-h-screen font-sg" style={{ background: VN.surface, color: VN.onSurface }}>

      {/* Top nav */}
      <div className="px-5 py-3 flex items-center justify-between sticky top-0 z-40"
        style={{ background: VN.surfaceLow, borderBottom: `1px solid ${VN.outlineVar}20` }}>
        <button onClick={() => navigate(-1)}
          className="font-sg text-[9px] uppercase tracking-[0.3em]" style={{ color: VN.outline }}>
          ← BACK
        </button>
        <span className="font-pixel text-sm tracking-[0.2em]" style={{ color: VN.cta }}>OSCILLATE</span>
        <span className="font-sg text-[9px] uppercase tracking-[0.3em]" style={{ color: VN.outlineVar }}>VENUE</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: 300, background: VN.surfaceLow }}>
        {/* Dark industrial background texture */}
        <div className="absolute inset-0 grid-overlay opacity-10 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none opacity-30" />

        <div className="relative z-10 px-6 md:px-12 py-16 max-w-[1200px] mx-auto">
          <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-4" style={{ color: VN.outline }}>
            VOLTAGE NOIR · VENUE
          </p>
          <h1 className="font-display text-[clamp(3rem,10vw,8rem)] uppercase leading-[0.85] mb-6"
            style={{ color: VN.onSurface }}>
            {venueName}
          </h1>
          <div className="flex flex-wrap gap-3">
            <span className="font-sg text-[9px] uppercase tracking-[0.2em] px-3 py-1.5"
              style={{ background: VN.surfaceMid, color: VN.outline }}>
              UNDERGROUND VENUE
            </span>
            <span className="font-sg text-[9px] uppercase tracking-[0.2em] px-3 py-1.5"
              style={{ background: VN.surfaceMid, color: VN.cyan }}>
              ● ACTIVE
            </span>
          </div>
          <p className="font-sg text-[12px] mt-6 max-w-xl leading-relaxed" style={{ color: VN.onSurfaceVar }}>
            Raw concrete, industrial sound. No frills, no compromise — just the music and the darkness that surrounds it. India's underground lives here.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 px-0" style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
        {[
          ["TOTAL SHOWS", events.length],
          ["UPCOMING", upcoming.length],
          ["CAPACITY", "TBA"],
        ].map(([l, v]) => (
          <div key={l} className="text-center py-5" style={{ borderRight: `1px solid ${VN.outlineVar}20` }}>
            <p className="font-sg text-[8px] uppercase tracking-[0.2em] mb-1" style={{ color: VN.outline }}>{l}</p>
            <p className="font-sg font-bold text-xl" style={{ color: VN.onSurface }}>{v}</p>
          </div>
        ))}
      </div>

      {/* THE CALENDAR */}
      <div className="px-6 md:px-12 py-12 max-w-[1200px] mx-auto">
        <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-2" style={{ color: VN.outline }}>
          UPCOMING
        </p>
        <h2 className="font-display text-4xl uppercase mb-8" style={{ color: VN.onSurface }}>
          THE CALENDAR
        </h2>

        {loading ? (
          <p className="font-sg text-[11px] uppercase py-12 text-center" style={{ color: VN.outline }}>
            LOADING...
          </p>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-sg text-[11px] uppercase tracking-[0.2em]" style={{ color: VN.outlineVar }}>
              NO UPCOMING EVENTS AT THIS VENUE
            </p>
          </div>
        ) : (
          <div>
            {upcoming.map((ev, i) => (
              <div key={ev.id}
                className="flex items-center justify-between py-5 group transition-all"
                style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}
                onMouseEnter={e => e.currentTarget.style.background = VN.surfaceLow}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                <div className="flex items-start gap-6">
                  {/* Date block */}
                  <div className="text-center w-14 flex-shrink-0">
                    <p className="font-mono text-[9px] uppercase" style={{ color: VN.outline }}>
                      {ev.date?.split(",")[0] || ""}
                    </p>
                    <p className="font-display text-2xl" style={{ color: VN.cta }}>
                      {ev.date?.match(/\d+/)?.[0] || i + 1}
                    </p>
                  </div>

                  {/* Event info */}
                  <div>
                    <h3 className="font-display text-xl md:text-2xl uppercase mb-1" style={{ color: VN.onSurface }}>
                      {ev.title}
                    </h3>
                    <p className="font-sg text-[11px] uppercase" style={{ color: VN.outline }}>
                      {ev.venue}
                    </p>
                    {ev.lineup?.length > 0 && (
                      <p className="font-mono text-[10px] uppercase mt-0.5" style={{ color: VN.outlineVar }}>
                        {ev.lineup.join(" · ")}
                      </p>
                    )}
                    {ev.genre && (
                      <span className="inline-block mt-2 font-sg text-[8px] uppercase tracking-[0.2em] px-2 py-0.5"
                        style={{ background: VN.surfaceMid, color: VN.outline }}>
                        {ev.genre}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + tickets */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-mono text-sm hidden md:block" style={{ color: VN.onSurface }}>
                    {ev.price}
                  </span>
                  <a href={`/event/${ev.id}`}
                    className="font-sg font-bold text-[10px] uppercase tracking-[0.15em] px-5 py-2.5 transition-all"
                    style={{ background: VN.cta, color: VN.ctaText }}>
                    TICKETS
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past events */}
        {past.length > 0 && (
          <div className="mt-16">
            <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-6" style={{ color: VN.outlineVar }}>
              ARCHIVE · PAST EVENTS
            </p>
            {past.map(ev => (
              <div key={ev.id} className="flex items-center justify-between py-4"
                style={{ borderBottom: `1px solid ${VN.outlineVar}15` }}>
                <div>
                  <h3 className="font-sg text-[13px] uppercase" style={{ color: VN.outlineVar }}>{ev.title}</h3>
                  <p className="font-mono text-[10px] mt-0.5" style={{ color: VN.outlineVar }}>{ev.date}</p>
                </div>
                <span className="font-sg text-[9px] uppercase tracking-[0.2em] px-2 py-0.5"
                  style={{ background: VN.surfaceMid, color: VN.outlineVar }}>
                  PAST
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back to events */}
      <div className="px-6 md:px-12 pb-16 max-w-[1200px] mx-auto">
        <a href="/#events"
          className="inline-block font-sg font-bold text-[11px] uppercase tracking-[0.2em] px-8 py-4"
          style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}>
          ← ALL EVENTS
        </a>
      </div>
    </div>
  );
}
