import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
// POS calls go to the local backend (server.py) which has multi-station PIN support
const POS_API = `${process.env.REACT_APP_POS_URL || process.env.REACT_APP_BACKEND_URL}/api`;

/* ── Design tokens (inline for portability) ── */
const VN = {
  surface:    "#131313",
  surfaceLow: "#1c1b1b",
  surfaceMid: "#201f1f",
  surfaceHigh:"#2a2a2a",
  surfaceTop: "#353534",
  cta:        "#ff562d",
  ctaText:    "#560d00",
  cyan:       "#00eefc",
  onSurface:  "#e5e2e1",
  onSurfaceVar:"#e8bdb3",
  outline:    "#ae887f",
  outlineVar: "#5e3f38",
  primary:    "#ffb4a2",
};

/* ── Shared style strings ── */
const inputCls = "vn-input";
const btnPrimary = "vn-btn-primary";

/* ── Corner brackets accent ── */
const Brackets = ({ color = VN.cta }) => (
  <>
    <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 pointer-events-none z-10" style={{ borderColor: color }} />
  </>
);

/* ── Status pill ── */
const StatusPill = ({ label, active = true }) => (
  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-sg text-[9px] uppercase tracking-[0.2em]"
    style={{ background: VN.surfaceMid, color: active ? VN.cyan : VN.outline }}>
    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: active ? VN.cyan : VN.outline }} />
    {label}
  </span>
);

/* ============================================================
   PIN GATE — POS_TERMINAL_LOGIN
   ============================================================ */
const PINGate = ({ onAuth }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (p) => {
    const code = p || pin;
    if (code.length < 4) return;
    setLoading(true); setError("");
    try {
      const res = await axios.post(`${POS_API}/pos/auth`, { pin: code });
      if (res.data.authenticated) onAuth(res.data);
    } catch { setError("ACCESS DENIED"); setPin(""); }
    finally { setLoading(false); }
  };

  const handleKey = (val) => {
    if (val === "DEL") { setPin(p => p.slice(0, -1)); setError(""); }
    else if (val === "GO") { submit(); }
    else if (pin.length < 6) { const np = pin + val; setPin(np); setError(""); if (np.length === 4) submit(np); }
  };

  useEffect(() => {
    const h = (e) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      else if (e.key === 'Backspace') handleKey('DEL');
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const keys = [["1","2","3"],["4","5","6"],["7","8","9"],["DEL","0","GO"]];

  return (
    <div data-testid="pos-pin-gate" className="min-h-screen flex items-center justify-center relative overflow-hidden vn-grain"
      style={{ background: VN.surface }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-20 pointer-events-none" />
      <div className="absolute inset-0 scanline pointer-events-none" />

      <div className="relative z-10 w-full max-w-xs px-6">
        {/* Header */}
        <div className="mb-10">
          <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-3" style={{ color: VN.outline }}>
            TERMINAL_v1.0
          </p>
          <h1 className="font-sg font-700 text-2xl tracking-[0.08em] leading-tight mb-1" style={{ color: VN.onSurface }}>
            POS_TERMINAL
          </h1>
          <h2 className="font-sg font-bold text-2xl tracking-[0.08em]" style={{ color: VN.cta }}>
            LOGIN
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <StatusPill label="SYSTEM ONLINE" active={true} />
          </div>
        </div>

        {/* Operator ID label */}
        <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>
          OPERATOR_ID
        </p>

        {/* PIN display */}
        <div className="relative mb-6 p-5" style={{ background: VN.surfaceMid }}>
          <Brackets />
          <div className="flex justify-center gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="w-11 h-12 flex items-center justify-center"
                style={{ borderBottom: `2px solid ${pin.length > i ? VN.cta : VN.outlineVar}` }}>
                {pin.length > i && (
                  <span className="font-mono text-xl" style={{ color: VN.cta }}>●</span>
                )}
              </div>
            ))}
          </div>
          {error && (
            <p data-testid="pos-pin-error"
              className="text-center font-sg text-[10px] uppercase tracking-[0.2em] mt-3 animate-pulse"
              style={{ color: "#ffb4ab" }}>
              {error}
            </p>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-1.5 mb-8">
          {keys.flat().map(k => (
            <button
              key={k}
              data-testid={`pos-key-${k.toLowerCase()}`}
              onClick={() => handleKey(k)}
              disabled={loading}
              className="pos-key h-14 font-sg font-semibold text-sm uppercase tracking-[0.05em] transition-all duration-100"
              style={
                k === "GO"
                  ? { background: VN.cta, color: VN.ctaText, border: "none" }
                  : k === "DEL"
                  ? { background: VN.surfaceMid, color: VN.outlineVar, border: `1px solid ${VN.outlineVar}30` }
                  : { background: VN.surfaceHigh, color: VN.onSurface, border: `1px solid ${VN.outlineVar}20` }
              }
            >
              {k}
            </button>
          ))}
        </div>

        <p className="text-center font-sg text-[8px] uppercase tracking-[0.3em]" style={{ color: VN.outlineVar }}>
          AUTHORIZED PERSONNEL ONLY
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */
const TopBar = ({ label, pin, onLock }) => (
  <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-40"
    style={{ background: VN.surfaceLow, borderBottom: `1px solid ${VN.outlineVar}20` }}>
    <div className="flex items-center gap-4">
      <span className="font-pixel text-sm tracking-[0.2em]" style={{ color: VN.cta }}>OSCILLATE</span>
      <span className="font-sg text-[9px] uppercase tracking-[0.2em]" style={{ color: VN.outline }}>{label}</span>
    </div>
    <button data-testid="pos-lock" onClick={onLock}
      className="font-sg text-[9px] uppercase tracking-[0.15em] px-4 py-1.5 transition-all"
      style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff562d"; e.currentTarget.style.color = VN.cta; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${VN.outlineVar}40`; e.currentTarget.style.color = VN.outline; }}>
      LOCK
    </button>
  </div>
);

const TabBar = ({ tabs, active, onChange }) => (
  <div className="flex" style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
    {tabs.map(t => (
      <button key={t.id} data-testid={`pos-tab-${t.id}`} onClick={() => onChange(t.id)}
        className="flex-1 py-3 font-sg text-[10px] uppercase tracking-[0.15em] transition-all"
        style={{
          borderBottom: `2px solid ${active === t.id ? VN.cta : "transparent"}`,
          color: active === t.id ? VN.cta : VN.outline,
          background: active === t.id ? `${VN.surfaceMid}` : "transparent",
        }}>
        {t.label}
      </button>
    ))}
  </div>
);

const Field = ({ label, children }) => (
  <div className="mb-4">
    <label className="block font-sg text-[9px] uppercase tracking-[0.25em] mb-1.5" style={{ color: VN.outline }}>
      {label}
    </label>
    {children}
  </div>
);

/* ============================================================
   MASTER POS
   ============================================================ */
const MasterPOS = ({ session, onLock, isGod = false }) => {
  const [tab, setTab] = useState("issue");
  const tabs = [
    { id: "issue", label: "ISSUE TICKET" },
    { id: "doordata", label: "DOOR DATA" },
    { id: "promoter", label: "PROMOTER SALES" },
    { id: "scan", label: "SCAN" },
    ...(isGod ? [{ id: "analytics", label: "ANALYTICS" }] : []),
  ];
  return (
    <div data-testid="pos-master" className="min-h-screen font-sg" style={{ background: VN.surface, color: VN.onSurface }}>
      <TopBar label={session.label} pin={session.pin} onLock={onLock} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <div className="mt-6">
          {tab === "issue" && <IssueTicketTab pin={session.pin} />}
          {tab === "doordata" && <DoorDataTab pin={session.pin} />}
          {tab === "promoter" && <PromoterTab pin={session.pin} />}
          {tab === "scan" && <ScanTab pin={session.pin} />}
          {tab === "analytics" && <AnalyticsTab pin={session.pin} />}
        </div>
      </div>
    </div>
  );
};

/* ── ANALYTICS ── */
const AnalyticsTab = ({ pin }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const r = await axios.get(`${POS_API}/analytics?pin=${pin}`); setData(r.data); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, []);

  if (loading && !data) return (
    <p className="text-center font-sg text-[10px] py-8 uppercase tracking-[0.2em]" style={{ color: VN.outline }}>
      LOADING ANALYTICS...
    </p>
  );
  if (!data) return (
    <p className="text-center font-sg text-[10px] py-8" style={{ color: "#ffb4ab" }}>FAILED TO LOAD</p>
  );

  return (
    <div data-testid="pos-analytics">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {[
          ["TICKETS", data.total_tickets],
          ["REVENUE", `₹${data.total_revenue?.toLocaleString("en-IN")}`],
          ["CHECKED IN", data.total_checked_in],
          ["COVER REV", `₹${data.cover_revenue?.toLocaleString("en-IN")}`],
          ["COVERS", data.cover_count],
        ].map(([l, v]) => (
          <div key={l} className="p-3 text-center" style={{ background: VN.surfaceLow }}>
            <p className="font-sg text-[8px] uppercase tracking-[0.15em]" style={{ color: VN.outline }}>{l}</p>
            <p className="font-sg font-bold text-xl mt-1" style={{ color: VN.onSurface }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Revenue by method */}
      <div className="p-4 mb-4" style={{ background: VN.surfaceLow }}>
        <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-3" style={{ color: VN.cta }}>
          REVENUE BY PAYMENT METHOD
        </p>
        {data.revenue_by_method?.map(m => (
          <div key={m.method} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
            <span className="font-sg text-[11px] uppercase" style={{ color: VN.onSurface }}>{m.method}</span>
            <div className="flex items-center gap-3">
              <div className="w-32 h-1.5" style={{ background: VN.surfaceHigh }}>
                <div className="h-full" style={{ width: `${Math.min((m.revenue / Math.max(data.total_revenue, 1)) * 100, 100)}%`, background: VN.cta }} />
              </div>
              <span className="font-mono text-[11px] w-20 text-right" style={{ color: VN.onSurfaceVar }}>
                ₹{m.revenue?.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue by event */}
      <div className="p-4 mb-4" style={{ background: VN.surfaceLow }}>
        <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-3" style={{ color: VN.cta }}>REVENUE BY EVENT</p>
        {data.revenue_by_event?.map(e => (
          <div key={e.event} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
            <span className="font-sg text-[11px] truncate max-w-[200px]" style={{ color: VN.onSurface }}>{e.event}</span>
            <span className="font-mono text-[11px]" style={{ color: VN.cta }}>₹{e.revenue?.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>

      {/* Source breakdown */}
      <div className="p-4 mb-4" style={{ background: VN.surfaceLow }}>
        <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-3" style={{ color: VN.cta }}>TICKET SOURCE</p>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(data.source_breakdown || {}).map(([k, v]) => (
            <div key={k} className="text-center">
              <p className="font-sg font-bold text-2xl" style={{ color: VN.onSurface }}>{v}</p>
              <p className="font-sg text-[8px] uppercase" style={{ color: VN.outline }}>{k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Promoter leaderboard */}
      <div className="p-4 mb-4" style={{ background: VN.surfaceLow }}>
        <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-3" style={{ color: VN.cta }}>PROMOTER LEADERBOARD</p>
        {data.promoter_leaderboard?.length === 0
          ? <p className="font-sg text-[11px]" style={{ color: VN.outline }}>NO PROMOTER SALES YET</p>
          : data.promoter_leaderboard?.map((p, i) => (
            <div key={p.name} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] w-6" style={{ color: VN.outlineVar }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="font-sg text-[12px]" style={{ color: VN.onSurface }}>{p.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-sg text-[10px]" style={{ color: VN.outline }}>{p.tickets} TIX</span>
                <span className="font-mono text-[11px]" style={{ color: VN.cta }}>₹{p.revenue?.toLocaleString("en-IN")}</span>
              </div>
            </div>
          ))
        }
      </div>

      <button onClick={load}
        className="w-full py-2 font-sg text-[10px] uppercase tracking-[0.2em] transition-all"
        style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = VN.cta; e.currentTarget.style.color = VN.cta; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = `${VN.outlineVar}40`; e.currentTarget.style.color = VN.outline; }}>
        REFRESH DATA
      </button>
    </div>
  );
};

/* ── ISSUE TICKET ── */
const IssueTicketTab = ({ pin }) => {
  const [method, setMethod] = useState("cash");
  const [events, setEvents] = useState([]);
  const [selEvent, setSelEvent] = useState("");
  const [selTier, setSelTier] = useState("");
  const [price, setPrice] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios.get(`${API}/events`).then(r => {
      setEvents(r.data);
      if (r.data[0]) {
        setSelEvent(r.data[0].id);
        if (r.data[0].tiers?.[0]) { setSelTier(r.data[0].tiers[0].name); setPrice(r.data[0].tiers[0].price); }
      }
    });
  }, []);

  const currentEvent = events.find(e => e.id === selEvent);
  const tiers = currentEvent?.tiers || [];

  const onTierChange = (tierName) => {
    setSelTier(tierName);
    const t = tiers.find(x => x.name === tierName);
    setPrice(t ? t.price : 0);
  };

  const issue = async () => {
    setIssuing(true);
    try {
      const res = await axios.post(`${POS_API}/pos/issue-ticket`, {
        pin, event_id: selEvent, event_name: currentEvent?.title || "",
        ticket_type: selTier, ticket_price: method === "comp" ? 0 : price,
        payment_method: method, buyer_name: name, buyer_email: email, quantity: 1, source: "pos",
      });
      setResult(res.data);
    } catch (e) { console.error(e); }
    finally { setIssuing(false); }
  };

  if (result) return (
    <div className="text-center py-12">
      <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-3" style={{ color: VN.outline }}>TICKET ISSUED</p>
      <div className="font-sg font-bold text-4xl mb-4" style={{ color: VN.cta }}>✓</div>
      {result.qr_code && (
        <div className="flex justify-center mb-4">
          <div className="p-2" style={{ background: "#fff" }}>
            <img data-testid="pos-ticket-qr" src={`data:image/png;base64,${result.qr_code}`} alt="QR" className="w-40 h-40" />
          </div>
        </div>
      )}
      <div className="font-mono text-sm mb-2" style={{ color: VN.onSurfaceVar }}>{result.id}</div>
      <div className="font-sg text-[11px] mb-1" style={{ color: VN.onSurface }}>{result.buyer_name} · {result.event_name}</div>
      <div className="font-mono text-[11px] mb-8" style={{ color: VN.outline }}>
        {result.payment_method === "comp" ? "COMPLIMENTARY" : `₹${result.amount}`} · {result.payment_method?.toUpperCase()}
      </div>
      <button onClick={() => { setResult(null); setName(""); setEmail(""); }} className={`${btnPrimary} max-w-xs mx-auto block`}>
        ISSUE ANOTHER
      </button>
    </div>
  );

  return (
    <div data-testid="pos-issue-ticket" className="max-w-xl mx-auto">
      {/* Payment method selector */}
      <div className="flex mb-6" style={{ background: VN.surfaceMid }}>
        {[["cash","CASH"],["comp","COMP"],["razorpay","RAZORPAY UPI"]].map(([id,lbl]) => (
          <button key={id} data-testid={`pos-method-${id}`} onClick={() => setMethod(id)}
            className="flex-1 py-2.5 font-sg text-[10px] uppercase tracking-[0.15em] transition-all"
            style={{
              background: method === id ? VN.cta : "transparent",
              color: method === id ? VN.ctaText : VN.outline,
            }}>
            {lbl}
          </button>
        ))}
      </div>

      <Field label="EVENT">
        <select data-testid="pos-event-select" value={selEvent}
          onChange={e => { setSelEvent(e.target.value); const ev = events.find(x => x.id === e.target.value); if (ev?.tiers?.[0]) { setSelTier(ev.tiers[0].name); setPrice(ev.tiers[0].price); } }}
          className={inputCls}>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} — {ev.date?.split(",")[0]?.replace("SAT ","").replace("SUN ","").replace("FRI ","")}</option>)}
        </select>
      </Field>
      <Field label="TIER">
        <select data-testid="pos-tier-select" value={selTier} onChange={e => onTierChange(e.target.value)} className={inputCls}>
          {tiers.map(t => <option key={t.name} value={t.name}>{t.name} — ₹{t.price}</option>)}
        </select>
      </Field>

      <div className="font-sg font-bold text-4xl mb-6" style={{ color: VN.cta }}>
        {method === "comp" ? "COMPLIMENTARY — ₹0" : `₹${price.toLocaleString("en-IN")}`}
      </div>

      <Field label="BUYER_NAME">
        <input data-testid="pos-buyer-name" value={name} onChange={e => setName(e.target.value)} placeholder="FULL NAME" className={inputCls} />
      </Field>
      <Field label="BUYER_EMAIL">
        <input data-testid="pos-buyer-email" value={email} onChange={e => setEmail(e.target.value)} placeholder="EMAIL ADDRESS" className={inputCls} />
      </Field>

      <button data-testid="pos-confirm-issue" onClick={issue} disabled={issuing || !name} className={btnPrimary}>
        {issuing ? "ISSUING..." : method === "comp" ? "ISSUE COMP TICKET" : "CONFIRM PAYMENT — ISSUE TICKET"}
      </button>
    </div>
  );
};

/* ── DOOR DATA ── */
const DoorDataTab = ({ pin }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const r = await axios.get(`${POS_API}/pos/door-data`); setData(r.data); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div data-testid="pos-door-data">
      <button data-testid="pos-load-door-data" onClick={load} disabled={loading} className={btnPrimary}>
        {loading ? "LOADING..." : data ? "REFRESH" : "LOAD DOOR DATA"}
      </button>
      {data && (
        <div className="mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            {[
              ["TOTAL PEOPLE", data.total],
              ["CHECKED IN", data.checked_in],
              ["TICKET REVENUE", `₹${data.ticket_revenue?.toLocaleString("en-IN")}`],
              ["COVER REVENUE", `₹${data.cover_revenue?.toLocaleString("en-IN")}`],
            ].map(([l, v]) => (
              <div key={l} className="p-3 text-center" style={{ background: VN.surfaceLow }}>
                <p className="font-sg text-[8px] uppercase tracking-[0.15em]" style={{ color: VN.outline }}>{l}</p>
                <p className="font-sg font-bold text-xl mt-1" style={{ color: VN.onSurface }}>{v}</p>
              </div>
            ))}
          </div>
          {data.tickets?.length > 0 && (
            <div style={{ background: VN.surfaceLow }}>
              <div className="grid grid-cols-12 px-3 py-2 font-sg text-[8px] uppercase tracking-[0.12em]"
                style={{ color: VN.outline, borderBottom: `1px solid ${VN.outlineVar}20` }}>
                <div className="col-span-3">NAME</div>
                <div className="col-span-2">TYPE</div>
                <div className="col-span-2">METHOD</div>
                <div className="col-span-2">AMOUNT</div>
                <div className="col-span-3">TIME</div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {data.tickets.map(t => (
                  <div key={t.id} className="grid grid-cols-12 px-3 py-2 font-sg text-[11px] items-center"
                    style={{ color: VN.onSurface, borderBottom: `1px solid ${VN.outlineVar}15` }}>
                    <div className="col-span-3 truncate">{t.buyer_name || "—"}</div>
                    <div className="col-span-2">{t.ticket_type}</div>
                    <div className="col-span-2" style={{ color: VN.outline }}>{t.payment_method?.toUpperCase()}</div>
                    <div className="col-span-2">{t.amount === 0 ? "COMP" : `₹${t.amount}`}</div>
                    <div className="col-span-3 font-mono text-[10px]" style={{ color: VN.outline }}>
                      {t.issued_at ? new Date(t.issued_at).toLocaleTimeString("en-US", { hour12: false }) : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── PROMOTER SALES ── */
const PromoterTab = ({ pin }) => {
  const [subTab, setSubTab] = useState("log");
  const [events, setEvents] = useState([]);
  const [selEvent, setSelEvent] = useState("");
  const [selTier, setSelTier] = useState("");
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({ promoter: "", name: "", email: "", phone: "" });
  const [issuing, setIssuing] = useState(false);
  const [salesData, setSalesData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/events`).then(r => {
      setEvents(r.data);
      if (r.data[0]) { setSelEvent(r.data[0].id); if (r.data[0].tiers?.[0]) { setSelTier(r.data[0].tiers[0].name); setPrice(r.data[0].tiers[0].price); } }
    });
  }, []);
  const currentEvent = events.find(e => e.id === selEvent);
  const tiers = currentEvent?.tiers || [];

  const logSale = async () => {
    setIssuing(true);
    try {
      await axios.post(`${POS_API}/pos/issue-ticket`, {
        pin, event_id: selEvent, event_name: currentEvent?.title || "",
        ticket_type: selTier, ticket_price: price, payment_method: "promoter",
        buyer_name: form.name, buyer_email: form.email, buyer_phone: form.phone,
        quantity: qty, source: "promoter", promoter_name: form.promoter,
      });
      setForm({ promoter: "", name: "", email: "", phone: "" }); setQty(1);
    } catch (e) { console.error(e); } finally { setIssuing(false); }
  };

  const loadSales = async () => {
    try { const r = await axios.get(`${POS_API}/pos/promoter-sales`); setSalesData(r.data); } catch (e) { console.error(e); }
  };

  return (
    <div data-testid="pos-promoter">
      <TabBar
        tabs={[{ id: "log", label: "LOG SALE" }, { id: "data", label: "SALES DATA" }]}
        active={subTab}
        onChange={(id) => { setSubTab(id); if (id === "data") loadSales(); }}
      />
      <div className="mt-6 max-w-xl mx-auto">
        {subTab === "log" ? (
          <>
            <Field label="PROMOTER_NAME">
              <input data-testid="pos-promoter-name" value={form.promoter} onChange={e => setForm(f => ({...f, promoter: e.target.value}))} placeholder="FULL NAME" className={inputCls} />
            </Field>
            <Field label="BUYER_NAME">
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="FULL NAME" className={inputCls} />
            </Field>
            <Field label="BUYER_EMAIL">
              <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="EMAIL ADDRESS" className={inputCls} />
            </Field>
            <Field label="BUYER_PHONE">
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="10-DIGIT MOBILE NUMBER" className={inputCls} />
            </Field>
            <Field label="EVENT">
              <select value={selEvent} onChange={e => { setSelEvent(e.target.value); const ev = events.find(x => x.id === e.target.value); if (ev?.tiers?.[0]) { setSelTier(ev.tiers[0].name); setPrice(ev.tiers[0].price); } }} className={inputCls}>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} — {ev.date?.split(",")[0]?.replace(/SAT |SUN |FRI /g,"")}</option>)}
              </select>
            </Field>
            <Field label="TICKET_CATEGORY">
              <select value={selTier} onChange={e => { setSelTier(e.target.value); const t = tiers.find(x => x.name === e.target.value); setPrice(t?.price || 0); }} className={inputCls}>
                {tiers.map(t => <option key={t.name} value={t.name}>{t.name} — ₹{t.price}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Field label="AMOUNT ₹">
                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="NO_OF_TICKETS">
                <select value={qty} onChange={e => setQty(Number(e.target.value))} className={inputCls}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>
            <div className="font-sg font-bold text-3xl mb-6" style={{ color: VN.cta }}>
              ₹{(price * qty).toLocaleString("en-IN")}
            </div>
            <button data-testid="pos-log-sale" onClick={logSale} disabled={issuing || !form.promoter} className={btnPrimary}>
              {issuing ? "LOGGING..." : "LOG PROMOTER SALE"}
            </button>
          </>
        ) : (
          <div>
            {!salesData
              ? <p className="text-center font-sg text-[11px] py-8 uppercase" style={{ color: VN.outline }}>NO PROMOTER SALES YET</p>
              : salesData.promoters?.map(p => (
                <div key={p.promoter} className="p-4 mb-2" style={{ background: VN.surfaceLow }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-sg font-semibold text-lg" style={{ color: VN.onSurface }}>{p.promoter}</span>
                    <span className="font-mono text-[11px]" style={{ color: VN.cta }}>{p.paid} / {p.qty}</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

/* ── SCAN TAB — SIGNAL_VALIDATOR ── */
const ScanTab = ({ pin }) => {
  const [ticketId, setTicketId] = useState("");
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  const scan = async (id) => {
    const tid = id || ticketId;
    if (!tid) return;
    setScanning(true); setResult(null);
    try {
      const r = await axios.post(`${POS_API}/pos/scan`, { pin, ticket_id: tid.trim() });
      setResult(r.data);
    } catch (e) {
      setResult({ status: "error", message: e.response?.data?.detail || "Ticket not found" });
    } finally { setScanning(false); }
  };

  const startCamera = async () => {
    stopCamera();
    setCameraActive(true);
    setResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise(r => setTimeout(r, 100));
      const el = document.getElementById("qr-reader");
      if (!el) { setCameraActive(false); return; }
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          const tid = decoded.trim();
          setTicketId(tid);
          try { const state = scanner.getState(); if (state === 2) scanner.stop().catch(() => {}); } catch {}
          scannerRef.current = null;
          setCameraActive(false);
          scan(tid);
        },
        () => {}
      );
    } catch (err) {
      console.error("Camera error:", err);
      scannerRef.current = null;
      setCameraActive(false);
      setResult({ status: "error", message: "Camera access denied or not available" });
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      try { const state = scannerRef.current.getState(); if (state === 2 || state === 3) scannerRef.current.stop().catch(() => {}); } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => { return () => { stopCamera(); }; }, []);

  const isValid = result?.status === "checked_in";
  const isDupe  = result?.status === "already_checked_in";

  return (
    <div data-testid="pos-scan" className="max-w-xl mx-auto">
      {/* Status indicators */}
      <div className="flex gap-2 mb-5">
        <StatusPill label="SIGNAL_VALIDATOR" active={true} />
        <StatusPill label={scanning ? "SCANNING..." : "READY_FOR_SCAN"} active={!scanning} />
      </div>

      {/* SCANNER_WINDOW */}
      {cameraActive ? (
        <div className="mb-6">
          <p className="font-sg text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>SCANNER_WINDOW</p>
          <div id="qr-reader" data-testid="qr-camera-view" className="w-full" style={{ minHeight: 300, background: VN.surfaceMid, border: `1px solid ${VN.cta}40` }} />
          <button data-testid="pos-stop-camera" onClick={stopCamera}
            className="w-full mt-2 py-3 font-sg text-[10px] uppercase tracking-[0.15em] transition-all"
            style={{ border: `1px solid #ff000040`, color: "#ffb4ab" }}>
            STOP CAMERA
          </button>
        </div>
      ) : (
        <button data-testid="pos-tap-scan" onClick={startCamera} className={`${btnPrimary} mb-6`}>
          <i className="fas fa-qrcode mr-2" /> TAP TO SCAN QR
        </button>
      )}

      <p className="text-center font-sg text-[9px] uppercase tracking-[0.25em] mb-4" style={{ color: VN.outline }}>
        OR ENTER TICKET ID MANUALLY
      </p>
      <div className="flex gap-2">
        <input data-testid="pos-ticket-id" value={ticketId} onChange={e => setTicketId(e.target.value.toUpperCase())}
          placeholder="OSC-..." className={`${inputCls} flex-1`} onKeyDown={e => e.key === "Enter" && scan()} />
        <button data-testid="pos-scan-go" onClick={() => scan()} disabled={scanning}
          className="px-6 font-sg text-[11px] uppercase tracking-[0.1em]"
          style={{ background: VN.cta, color: VN.ctaText }}>
          GO
        </button>
      </div>

      {result && (
        <div className="mt-6 p-4" style={{
          background: VN.surfaceLow,
          borderLeft: `3px solid ${isValid ? "#4ade80" : isDupe ? "#facc15" : "#f87171"}`,
        }}>
          <p className="font-sg text-[12px] uppercase tracking-[0.1em]" style={{ color: VN.onSurface }}>
            {isValid ? "✓ CHECKED IN SUCCESSFULLY" : isDupe ? "⚠ ALREADY CHECKED IN" : result.message || "ERROR"}
          </p>
          {result.ticket && (
            <p className="font-sg text-[10px] mt-1" style={{ color: VN.outline }}>
              {result.ticket.buyer_name} · {result.ticket.event_name} · {result.ticket.ticket_type}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   S1 — GATE / DOOR — CUSTOMER_CHECK_IN
   ============================================================ */
const GateStation = ({ session, onLock }) => {
  const [tab, setTab]           = useState("door");
  const [events, setEvents]     = useState([]);
  const [selEvent, setSelEvent] = useState("");
  const [selTier, setSelTier]   = useState("");
  const [price, setPrice]       = useState(0);
  const [method, setMethod]     = useState("cash");
  const [buyerName, setBuyerName]   = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [issuing, setIssuing]   = useState(false);
  const [result, setResult]     = useState(null);

  useEffect(() => {
    axios.get(`${API}/events`).then(r => {
      setEvents(r.data);
      if (r.data[0]) {
        setSelEvent(r.data[0].id);
        if (r.data[0].tiers?.[0]) { setSelTier(r.data[0].tiers[0].name); setPrice(r.data[0].tiers[0].price); }
      }
    });
  }, []);

  const currentEvent = events.find(e => e.id === selEvent);
  const tiers = currentEvent?.tiers || [];

  const issue = async () => {
    setIssuing(true);
    try {
      const res = await axios.post(`${POS_API}/pos/issue-ticket`, {
        pin: session.pin, event_id: selEvent, event_name: currentEvent?.title || "",
        ticket_type: selTier, ticket_price: method === "comp" ? 0 : price,
        payment_method: method, buyer_name: buyerName, buyer_phone: buyerPhone,
        quantity: 1, source: "door",
      });
      setResult(res.data);
    } catch (e) { console.error(e); } finally { setIssuing(false); }
  };

  const reset = () => { setResult(null); setBuyerName(""); setBuyerPhone(""); };

  /* ── Success screen ── */
  if (result && tab === "door") return (
    <div data-testid="pos-gate" className="min-h-screen font-sg" style={{ background: VN.surface, color: VN.onSurface }}>
      <TopBar label={session.label} pin={session.pin} onLock={onLock} />
      <div className="max-w-sm mx-auto px-4 py-10 text-center">
        <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>TICKET ISSUED</p>
        <p className="font-sg font-bold text-2xl mb-1" style={{ color: VN.cta }}>{result.buyer_name}</p>
        <p className="font-sg text-[11px] mb-6" style={{ color: VN.outline }}>{result.event_name} · {result.tier}</p>

        {result.qr_code && (
          <div className="flex justify-center mb-6">
            <div className="p-3 inline-block" style={{ background: "#fff" }}>
              <img data-testid="s1-ticket-qr" src={`data:image/png;base64,${result.qr_code}`} alt="QR" className="w-48 h-48" />
            </div>
          </div>
        )}

        <p className="font-mono text-[11px] mb-1" style={{ color: VN.outlineVar }}>{result.ticket_id || result.id}</p>
        <p className="font-sg text-[11px] mb-6" style={{ color: VN.outline }}>
          {result.payment_method === "comp" ? "COMPLIMENTARY" : `₹${result.amount}`} · {(result.payment_method || "").toUpperCase()}
        </p>

        {result.whatsapp_url ? (
          <a href={result.whatsapp_url} target="_blank" rel="noopener noreferrer" data-testid="s1-whatsapp-btn"
            className="flex items-center justify-center gap-2 w-full py-3 font-sg text-[11px] uppercase tracking-[0.1em] mb-3"
            style={{ background: "#25D366", color: "#000" }}>
            ✓ SEND QR ON WHATSAPP
          </a>
        ) : (
          <div className="w-full py-3 font-sg text-[11px] uppercase text-center mb-3"
            style={{ border: `1px solid #4ade8060`, color: "#4ade80" }}>
            ✓ TICKET ISSUED
          </div>
        )}

        <button onClick={reset} className={btnPrimary}>ISSUE ANOTHER</button>
      </div>
    </div>
  );

  /* ── Issue form ── */
  return (
    <div data-testid="pos-gate" className="min-h-screen font-sg" style={{ background: VN.surface, color: VN.onSurface }}>
      <TopBar label={session.label} pin={session.pin} onLock={onLock} />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <TabBar tabs={[{ id: "door", label: "ISSUE TICKET" }, { id: "scan", label: "SCAN" }]} active={tab} onChange={setTab} />
        <div className="mt-6">
          {tab === "door" ? (
            <div className="max-w-xl mx-auto">
              {/* Status bar */}
              <div className="flex gap-2 mb-6">
                <StatusPill label="CUSTOMER_CHECK_IN" active={true} />
                <StatusPill label="AUTHORIZE_READY" active={true} />
              </div>

              <Field label="CUSTOMER_NAME">
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="FULL NAME" className={inputCls} />
              </Field>
              <Field label="PHONE_NUMBER">
                <input type="tel" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
              </Field>
              <Field label="EVENT">
                <select value={selEvent} onChange={e => { setSelEvent(e.target.value); const ev = events.find(x => x.id === e.target.value); if (ev?.tiers?.[0]) { setSelTier(ev.tiers[0].name); setPrice(ev.tiers[0].price); } }} className={inputCls}>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </Field>
              <Field label="TIER">
                <select value={selTier} onChange={e => { setSelTier(e.target.value); const t = tiers.find(x => x.name === e.target.value); setPrice(t?.price || 0); }} className={inputCls}>
                  {tiers.map(t => <option key={t.name} value={t.name}>{t.name} — ₹{t.price}</option>)}
                </select>
              </Field>

              <div className="font-sg font-bold text-4xl mb-4" style={{ color: VN.cta }}>
                {method === "comp" ? "COMP — ₹0" : `₹${price.toLocaleString("en-IN")}`}
              </div>

              {/* PAYMENT_PROTOCOL toggle */}
              <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-2" style={{ color: VN.outline }}>
                PAYMENT_PROTOCOL
              </p>
              <div className="flex mb-6" style={{ background: VN.surfaceMid }}>
                {[["cash","CASH"],["upi","UPI"],["comp","COMP"]].map(([id,lbl]) => (
                  <button key={id} onClick={() => setMethod(id)}
                    className="flex-1 py-2.5 font-sg text-[10px] uppercase tracking-[0.15em] transition-all"
                    style={{
                      background: method === id ? VN.cta : "transparent",
                      color: method === id ? VN.ctaText : VN.outline,
                    }}>
                    {lbl}
                  </button>
                ))}
              </div>

              <button onClick={issue} disabled={issuing || !buyerName || !buyerPhone} className={btnPrimary}>
                {issuing ? "PROCESSING..." : "AUTHORIZE_ENTRY"}
              </button>
            </div>
          ) : (
            <S1ScanTab pin={session.pin} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ── S1 SCAN TAB ── */
const S1ScanTab = ({ pin }) => {
  const [ticketId, setTicketId]   = useState("");
  const [result, setResult]       = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  const scan = async (id) => {
    const tid = (id || ticketId).trim();
    if (!tid) return;
    setScanning(true); setResult(null);
    try {
      const r = await axios.post(`${POS_API}/pos/scan`, { pin, ticket_id: tid });
      setResult(r.data);
    } catch (e) {
      setResult({ status: "error", message: e.response?.data?.detail || "Ticket not found" });
    } finally { setScanning(false); }
  };

  const startCamera = async () => {
    stopCamera(); setCameraActive(true); setResult(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise(r => setTimeout(r, 100));
      const el = document.getElementById("s1-qr-reader");
      if (!el) { setCameraActive(false); return; }
      const scanner = new Html5Qrcode("s1-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          const tid = decoded.trim();
          setTicketId(tid);
          try { if (scanner.getState() === 2) scanner.stop().catch(() => {}); } catch {}
          scannerRef.current = null; setCameraActive(false);
          scan(tid);
        },
        () => {}
      );
    } catch (err) {
      console.error("Camera error:", err);
      scannerRef.current = null; setCameraActive(false);
      setResult({ status: "error", message: "Camera access denied or not available" });
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      try { const s = scannerRef.current.getState(); if (s === 2 || s === 3) scannerRef.current.stop().catch(() => {}); } catch {}
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const isValid = result?.status === "checked_in";
  const isDupe  = result?.status === "already_checked_in";

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex gap-2 mb-5">
        <StatusPill label="SIGNAL_VALIDATOR" active={true} />
        <StatusPill label={isValid ? "PAYMENT_VERIFIED" : "READY_FOR_SCAN"} active={true} />
      </div>

      {cameraActive ? (
        <div className="mb-6">
          <p className="font-sg text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>SCANNER_WINDOW</p>
          <div id="s1-qr-reader" className="w-full" style={{ minHeight: 300, background: VN.surfaceMid, border: `1px solid ${VN.cta}40` }} />
          <button onClick={stopCamera}
            className="w-full mt-2 py-3 font-sg text-[10px] uppercase tracking-[0.15em]"
            style={{ border: `1px solid #ff000040`, color: "#ffb4ab" }}>
            STOP CAMERA
          </button>
        </div>
      ) : (
        <button onClick={startCamera} className={`${btnPrimary} mb-6`}>
          TAP TO SCAN QR
        </button>
      )}

      <p className="text-center font-sg text-[9px] uppercase tracking-[0.25em] mb-4" style={{ color: VN.outline }}>
        OR ENTER TICKET ID MANUALLY
      </p>
      <div className="flex gap-2 mb-4">
        <input value={ticketId} onChange={e => setTicketId(e.target.value.toUpperCase())}
          placeholder="OSC-..." className={`${inputCls} flex-1`} onKeyDown={e => e.key === "Enter" && scan()} />
        <button onClick={() => scan()} disabled={scanning}
          className="px-6 font-sg text-[11px] uppercase"
          style={{ background: VN.cta, color: VN.ctaText }}>
          GO
        </button>
      </div>

      {result && (
        <div className="p-4" style={{
          background: VN.surfaceLow,
          borderLeft: `3px solid ${isValid ? "#4ade80" : isDupe ? "#facc15" : "#f87171"}`,
        }}>
          <p className="font-sg text-[12px] uppercase mb-1" style={{ color: VN.onSurface }}>
            {isValid ? "✓ VALID — LET THEM IN" : isDupe ? "⚠ ALREADY CHECKED IN" : result.message || "ERROR"}
          </p>
          {(result.buyer_name || result.ticket?.buyer_name) && (
            <p className="font-sg text-[11px]" style={{ color: VN.onSurfaceVar }}>
              {result.buyer_name || result.ticket?.buyer_name}
            </p>
          )}
          {result.buyer_phone && (
            <p className="font-mono text-[10px]" style={{ color: VN.outline }}>{result.buyer_phone}</p>
          )}
          {(result.tier || result.ticket?.ticket_type) && (
            <p className="font-sg text-[10px] mt-1" style={{ color: VN.outline }}>
              {result.event || result.ticket?.event_name} · {result.tier || result.ticket?.ticket_type}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ============================================================
   S2 — COVER CHARGE — COVER_ENGINE
   ============================================================ */
const CoverStation = ({ session, onLock }) => {
  const [tab, setTab]           = useState("queue");
  const [queue, setQueue]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount]     = useState(500);
  const [method, setMethod]     = useState("cash");
  const [charging, setCharging] = useState(false);
  const [flash, setFlash]       = useState(null);
  const [stats, setStats]       = useState({ count: 0, total_revenue: 0 });
  const [s2CameraActive, setS2CameraActive] = useState(false);
  const s2ScannerRef = useRef(null);

  const loadQueue = async () => {
    try { const r = await axios.get(`${POS_API}/pos/s2-queue`); setQueue(r.data.queue || []); } catch {}
  };
  const loadStats = async () => {
    try { const r = await axios.get(`${POS_API}/pos/cover-data`); setStats({ count: r.data.count, total_revenue: r.data.total_revenue }); } catch {}
  };

  useEffect(() => {
    loadQueue(); loadStats();
    const iv = setInterval(() => { loadQueue(); loadStats(); }, 8000);
    return () => clearInterval(iv);
  }, []);

  const selectPerson = (person) => { setSelected(person); setTab("charge"); };

  const charge = async () => {
    if (!selected) return;
    setCharging(true);
    try {
      await axios.post(`${POS_API}/pos/cover-charge`, {
        pin: session.pin, ticket_id: selected.ticket_id,
        guest_name: selected.buyer_name, buyer_name: selected.buyer_name,
        amount, payment_method: method, event_id: selected.event_id || "",
      });
      setFlash(`✓ ${selected.buyer_name} — ₹${amount} CHARGED`);
      setSelected(null);
      loadQueue(); loadStats();
      setTimeout(() => { setFlash(null); setTab("queue"); }, 2200);
    } catch (e) { console.error(e); } finally { setCharging(false); }
  };

  const startS2Camera = async () => {
    stopS2Camera(); setS2CameraActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise(r => setTimeout(r, 100));
      const el = document.getElementById("s2-qr-reader");
      if (!el) { setS2CameraActive(false); return; }
      const scanner = new Html5Qrcode("s2-qr-reader");
      s2ScannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded) => {
          try { if (scanner.getState() === 2) scanner.stop().catch(() => {}); } catch {}
          s2ScannerRef.current = null; setS2CameraActive(false);
          const tid = decoded.trim();
          try {
            const r = await axios.get(`${POS_API}/pos/ticket-info?ticket_id=${encodeURIComponent(tid)}`);
            const t = r.data;
            if (t.checked_in && !t.cover_charged) {
              selectPerson({ ticket_id: t.ticket_id, buyer_name: t.buyer_name, buyer_phone: t.buyer_phone, event_name: t.event_name, event_id: t.event_id, tier: t.tier, checked_in_at: t.checked_in_at });
            }
          } catch {}
        },
        () => {}
      );
    } catch (err) {
      console.error("S2 camera error:", err);
      s2ScannerRef.current = null; setS2CameraActive(false);
    }
  };

  const stopS2Camera = () => {
    if (s2ScannerRef.current) {
      try { const s = s2ScannerRef.current.getState(); if (s === 2 || s === 3) s2ScannerRef.current.stop().catch(() => {}); } catch {}
      s2ScannerRef.current = null;
    }
    setS2CameraActive(false);
  };

  useEffect(() => () => stopS2Camera(), []);

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  return (
    <div data-testid="pos-cover" className="min-h-screen font-sg" style={{ background: VN.surface, color: VN.onSurface }}>
      <TopBar label={session.label} pin={session.pin} onLock={onLock} />
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* COVER_ENGINE header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-sg text-[9px] uppercase tracking-[0.3em]" style={{ color: VN.outline }}>COVER_ENGINE</p>
          </div>
          <StatusPill label="OPERATOR_ACTIVE" active={true} />
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="p-3 text-center" style={{ background: VN.surfaceLow }}>
            <p className="font-sg text-[8px] uppercase tracking-[0.12em]" style={{ color: VN.outline }}>IN QUEUE</p>
            <p className="font-sg font-bold text-2xl" style={{ color: VN.cta }}>{queue.length}</p>
          </div>
          <div className="p-3 text-center" style={{ background: VN.surfaceLow }}>
            <p className="font-sg text-[8px] uppercase tracking-[0.12em]" style={{ color: VN.outline }}>CHARGED</p>
            <p className="font-sg font-bold text-2xl" style={{ color: VN.onSurface }}>{stats.count}</p>
          </div>
          <div className="p-3 text-center" style={{ background: VN.surfaceLow }}>
            <p className="font-sg text-[8px] uppercase tracking-[0.12em]" style={{ color: VN.outline }}>REVENUE</p>
            <p className="font-sg font-bold text-2xl" style={{ color: VN.onSurface }}>₹{stats.total_revenue?.toLocaleString("en-IN")}</p>
          </div>
        </div>

        <TabBar
          tabs={[{ id: "queue", label: `QUEUE (${queue.length})` }, { id: "charge", label: "CHARGE" }]}
          active={tab}
          onChange={setTab}
        />

        {/* ── QUEUE TAB ── */}
        {tab === "queue" && (
          <div className="mt-6">
            {s2CameraActive ? (
              <div className="mb-4">
                <p className="font-sg text-[8px] uppercase tracking-[0.3em] mb-2" style={{ color: VN.outline }}>SCANNER_WINDOW</p>
                <div id="s2-qr-reader" className="w-full" style={{ minHeight: 260, background: VN.surfaceMid, border: `1px solid ${VN.cta}40` }} />
                <button onClick={stopS2Camera}
                  className="w-full mt-2 py-2 font-sg text-[10px] uppercase tracking-[0.15em]"
                  style={{ border: `1px solid #ff000040`, color: "#ffb4ab" }}>
                  STOP CAMERA
                </button>
              </div>
            ) : (
              <button onClick={startS2Camera}
                className="w-full py-3 font-sg text-[10px] uppercase tracking-[0.15em] mb-4 transition-all"
                style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = VN.cta; e.currentTarget.style.color = VN.cta; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${VN.outlineVar}40`; e.currentTarget.style.color = VN.outline; }}>
                SCAN QR TO FIND PERSON
              </button>
            )}

            {queue.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-sg text-[11px] uppercase tracking-[0.2em]" style={{ color: VN.outlineVar }}>NO ONE IN QUEUE YET</p>
                <p className="font-sg text-[10px] mt-2" style={{ color: VN.outlineVar }}>Waiting for S1 check-ins...</p>
              </div>
            ) : (
              <div style={{ background: VN.surfaceLow }}>
                <div className="grid grid-cols-12 px-3 py-2 font-sg text-[8px] uppercase tracking-[0.12em]"
                  style={{ color: VN.outline, borderBottom: `1px solid ${VN.outlineVar}20` }}>
                  <div className="col-span-4">NAME</div>
                  <div className="col-span-3">TIER</div>
                  <div className="col-span-2">IN AT</div>
                  <div className="col-span-3 text-right">ACTION</div>
                </div>
                {queue.map(person => (
                  <div key={person.ticket_id} className="grid grid-cols-12 px-3 py-3 items-center transition-colors"
                    style={{ borderBottom: `1px solid ${VN.outlineVar}15` }}
                    onMouseEnter={e => e.currentTarget.style.background = VN.surfaceMid}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div className="col-span-4">
                      <p className="font-sg text-[12px] truncate" style={{ color: VN.onSurface }}>{person.buyer_name}</p>
                      <p className="font-mono text-[10px] truncate" style={{ color: VN.outlineVar }}>{person.buyer_phone}</p>
                    </div>
                    <div className="col-span-3 font-sg text-[11px] truncate" style={{ color: VN.onSurfaceVar }}>{person.tier}</div>
                    <div className="col-span-2 font-mono text-[11px]" style={{ color: VN.outline }}>{fmt(person.checked_in_at)}</div>
                    <div className="col-span-3 text-right">
                      <button onClick={() => selectPerson(person)}
                        className="px-3 py-1.5 font-sg text-[10px] uppercase tracking-[0.08em] transition-all"
                        style={{ background: VN.cta, color: VN.ctaText }}>
                        CHARGE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CHARGE TAB — COLLECT_COVER ── */}
        {tab === "charge" && (
          <div className="mt-6 max-w-xl mx-auto">
            {flash && (
              <div className="p-4 mb-6 text-center" style={{ background: VN.surfaceLow, borderLeft: `3px solid #4ade80` }}>
                <p className="font-sg text-[12px] uppercase" style={{ color: "#4ade80" }}>{flash}</p>
              </div>
            )}

            {selected ? (
              <div className="p-4 mb-6 relative" style={{ background: VN.surfaceMid }}>
                <Brackets color={VN.cta} />
                <p className="font-sg font-semibold text-lg" style={{ color: VN.onSurface }}>{selected.buyer_name}</p>
                <p className="font-sg text-[10px] mt-1" style={{ color: VN.outline }}>{selected.tier} · {selected.event_name}</p>
                <p className="font-mono text-[10px]" style={{ color: VN.outlineVar }}>Checked in at {fmt(selected.checked_in_at)}</p>
              </div>
            ) : (
              <div className="p-4 mb-6 text-center" style={{ background: VN.surfaceLow }}>
                <p className="font-sg text-[11px] uppercase tracking-[0.15em]" style={{ color: VN.outline }}>
                  No person selected — go back to QUEUE or scan QR
                </p>
              </div>
            )}

            {/* COVER AMOUNT with quick-select */}
            <Field label="COVER_AMOUNT ₹">
              <input data-testid="pos-cover-amount" type="number" value={amount}
                onChange={e => setAmount(Number(e.target.value))} className={inputCls} />
            </Field>
            {/* Quick-select amounts */}
            <div className="flex gap-2 mb-4">
              {[500, 1000, 2000].map(a => (
                <button key={a} onClick={() => setAmount(a)}
                  className="flex-1 py-2 font-sg text-[11px] uppercase tracking-[0.08em] transition-all"
                  style={{
                    background: amount === a ? VN.cta : VN.surfaceMid,
                    color: amount === a ? VN.ctaText : VN.outline,
                  }}>
                  ₹{a}
                </button>
              ))}
            </div>

            {/* Payment method */}
            <p className="font-sg text-[9px] uppercase tracking-[0.25em] mb-2" style={{ color: VN.outline }}>
              PAYMENT_PROTOCOL
            </p>
            <div className="flex mb-6" style={{ background: VN.surfaceMid }}>
              {[["cash","CASH"],["upi","UPI"],["comp","COMP"]].map(([id,lbl]) => (
                <button key={id} onClick={() => setMethod(id)}
                  className="flex-1 py-2.5 font-sg text-[10px] uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: method === id ? VN.cta : "transparent",
                    color: method === id ? VN.ctaText : VN.outline,
                  }}>
                  {lbl}
                </button>
              ))}
            </div>

            <button data-testid="pos-charge-cover" onClick={charge} disabled={charging || !selected} className={btnPrimary}>
              {charging ? "CHARGING..." : selected ? `COLLECT_COVER — ₹${amount} / ${selected.buyer_name?.split(" ")[0]}` : `COLLECT_COVER — ₹${amount}`}
            </button>
            <button onClick={() => { setSelected(null); setTab("queue"); }}
              className="w-full mt-3 py-2 font-sg text-[10px] uppercase tracking-[0.15em] transition-all"
              style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#f87171"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${VN.outlineVar}40`; e.currentTarget.style.color = VN.outline; }}>
              ← BACK TO QUEUE
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   MAIN POS PAGE
   ============================================================ */
export default function POSPage() {
  const [session, setSession] = useState(null);

  const handleAuth = (data) => setSession(data);
  const handleLock = () => setSession(null);

  if (!session) return <PINGate onAuth={handleAuth} />;

  switch (session.role) {
    case "s1": return <GateStation session={session} onLock={handleLock} />;
    case "s2": return <CoverStation session={session} onLock={handleLock} />;
    case "god": return <MasterPOS session={session} onLock={handleLock} isGod={true} />;
    default: return <MasterPOS session={session} onLock={handleLock} />;
  }
}
