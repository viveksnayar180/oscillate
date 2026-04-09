import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const GENRES = ["ALL", "TECHNO", "AMBIENT", "INDUSTRIAL", "DARK TECHNO", "ACID", "EXPERIMENTAL"];
const CITIES  = ["ALL", "BENGALURU", "MUMBAI", "GOA", "DELHI", "HYDERABAD"];

export default function SearchPage() {
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();

  const [query, setQuery]       = useState(urlParams.get("q") || "");
  const [genre, setGenre]       = useState("ALL");
  const [city, setCity]         = useState("ALL");
  const [results, setResults]   = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  const doSearch = async (q = query) => {
    setSearching(true); setResults(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (genre !== "ALL") params.set("genre", genre);
      if (city !== "ALL") params.set("city", city);
      const r = await axios.get(`${API}/search?${params}`);
      setResults(r.data);
    } catch { setResults({ events: [], artists: [] }); }
    finally { setSearching(false); }
  };

  useEffect(() => {
    if (urlParams.get("q")) doSearch(urlParams.get("q"));
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalResults = (results?.events?.length || 0) + (results?.artists?.length || 0);

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
        <span className="font-sg text-[9px] uppercase tracking-[0.3em]" style={{ color: VN.outlineVar }}>SEARCH</span>
      </div>

      <div className="px-6 md:px-12 pt-12 max-w-[1200px] mx-auto">

        {/* Header */}
        <div className="mb-10">
          <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-3" style={{ color: VN.outline }}>
            VOLTAGE NOIR
          </p>
          <h1 className="font-display text-[clamp(4rem,15vw,10rem)] uppercase leading-[0.85]"
            style={{ color: VN.onSurface }}>
            SEARCH
          </h1>
        </div>

        {/* Search input */}
        <div className="relative mb-8">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="ARTIST, EVENT, VENUE..."
            className="w-full font-display text-2xl md:text-3xl uppercase bg-transparent pb-3 focus:outline-none"
            style={{
              color: VN.onSurface,
              borderBottom: `2px solid ${VN.cta}`,
              caretColor: VN.cyan,
            }}
          />
          <p className="font-sg text-[8px] uppercase tracking-[0.3em] mt-2" style={{ color: VN.outlineVar }}>
            TYPE TO SEARCH · PRESS ENTER
          </p>
        </div>

        {/* Genre filter chips */}
        <div className="mb-5">
          <p className="font-sg text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>
            GENRE_FILTER
          </p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button key={g} onClick={() => setGenre(g)}
                className="font-sg text-[9px] uppercase tracking-[0.12em] px-3 py-1.5 transition-all"
                style={genre === g
                  ? { background: VN.cta, color: VN.ctaText }
                  : { background: VN.surfaceHigh, color: VN.outline }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* City filter */}
        <div className="mb-8">
          <p className="font-sg text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>
            ZONE_SELECT
          </p>
          <div className="flex flex-wrap gap-2">
            {CITIES.map(c => (
              <button key={c} onClick={() => setCity(c)}
                className="font-sg text-[9px] uppercase tracking-[0.12em] px-3 py-1.5 transition-all"
                style={city === c
                  ? { background: VN.surfaceHigh, color: VN.cyan, border: `1px solid ${VN.cyan}` }
                  : { background: VN.surfaceMid, color: VN.outline }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* INITIALIZE SEARCH button */}
        <button onClick={() => doSearch()} disabled={searching}
          className="w-full py-4 font-sg font-bold text-[12px] uppercase tracking-[0.3em] mb-12 transition-all"
          style={{ background: VN.cta, color: VN.ctaText, opacity: searching ? 0.6 : 1 }}>
          {searching ? "SCANNING..." : "INITIALIZE SEARCH"}
        </button>

        {/* RESULTS MATRIX */}
        {results && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-1" style={{ color: VN.outline }}>
                  RESULTS MATRIX
                </p>
                <p className="font-sg text-[11px]" style={{ color: VN.outlineVar }}>
                  {searching ? "SCANNING..." : `${totalResults} SIGNALS FOUND`}
                </p>
              </div>
            </div>

            {totalResults === 0 ? (
              <div className="text-center py-20">
                <p className="font-sg text-[11px] uppercase tracking-[0.2em]" style={{ color: VN.outlineVar }}>
                  NO SIGNALS DETECTED
                </p>
                <p className="font-sg text-[10px] mt-2" style={{ color: VN.outlineVar }}>
                  Try broadening your search parameters
                </p>
              </div>
            ) : (
              <>
                {/* Events results */}
                {results.events?.length > 0 && (
                  <div className="mb-10">
                    <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-4" style={{ color: VN.outline }}>
                      EVENTS — {results.events.length}
                    </p>
                    {results.events.map(ev => (
                      <a key={ev.id} href={`/event/${ev.id}`}
                        className="flex items-center justify-between py-4 group block transition-all"
                        style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}
                        onMouseEnter={e => e.currentTarget.style.background = VN.surfaceLow}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div>
                          <h3 className="font-sg font-semibold text-base uppercase mb-0.5" style={{ color: VN.onSurface }}>
                            {ev.title}
                          </h3>
                          <p className="font-sg text-[10px] uppercase" style={{ color: VN.outline }}>
                            {ev.date} · {ev.city} · {ev.venue}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {ev.genre && (
                            <span className="font-sg text-[8px] uppercase px-2 py-0.5 hidden md:inline-block"
                              style={{ background: VN.surfaceMid, color: VN.outline }}>
                              {ev.genre}
                            </span>
                          )}
                          <span className="font-sg font-bold text-[10px] uppercase tracking-[0.1em] px-4 py-2"
                            style={{ background: VN.cta, color: VN.ctaText }}>
                            TICKETS
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Artists results */}
                {results.artists?.length > 0 && (
                  <div className="mb-10">
                    <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-4" style={{ color: VN.outline }}>
                      ARTISTS — {results.artists.length}
                    </p>
                    {results.artists.map((a, i) => (
                      <div key={a.id || i} className="flex items-center justify-between py-4"
                        style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[9px] w-5" style={{ color: VN.outlineVar }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <p className="font-sg font-semibold text-base uppercase" style={{ color: VN.onSurface }}>
                              {a.name}
                            </p>
                            <p className="font-sg text-[10px] uppercase" style={{ color: VN.outline }}>{a.role}</p>
                          </div>
                        </div>
                        <button className="font-sg text-[9px] uppercase tracking-[0.15em] px-4 py-2"
                          style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}>
                          FOLLOW
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!results && !searching && (
          <div className="text-center py-20">
            <p className="font-sg text-[9px] uppercase tracking-[0.4em]" style={{ color: VN.outlineVar }}>
              AWAITING INPUT · SIGNAL READY
            </p>
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div className="pb-20" />
    </div>
  );
}
