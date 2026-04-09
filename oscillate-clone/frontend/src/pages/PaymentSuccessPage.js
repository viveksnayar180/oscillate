import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-2.5" style={{ borderBottom: `1px solid ${VN.outlineVar}20` }}>
    <span className="font-sg text-[9px] uppercase tracking-[0.25em]" style={{ color: VN.outline }}>{label}</span>
    <span className="font-sg text-[12px] font-semibold text-right" style={{ color: VN.onSurface }}>{value}</span>
  </div>
);

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState("checking");
  const [ticket, setTicket] = useState(null);
  const [ticketIds, setTicketIds] = useState([]);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    const poll = async () => {
      try {
        const res = await axios.get(`${API}/checkout/status/${sessionId}`);
        if (res.data.payment_status === "paid") {
          setStatus("paid");
          setTicket(res.data.ticket);
          setTicketIds(res.data.ticket_ids || [res.data.ticket?.id]);
        } else if (res.data.status === "expired") {
          setStatus("expired");
        } else {
          if (attempts < 8) {
            setTimeout(() => setAttempts(a => a + 1), 2500);
          } else {
            setStatus("timeout");
          }
        }
      } catch { if (attempts < 8) setTimeout(() => setAttempts(a => a + 1), 2500); else setStatus("error"); }
    };
    poll();
  }, [sessionId, attempts]);

  return (
    <div data-testid="payment-success-page" className="min-h-screen flex flex-col font-sg"
      style={{ background: VN.surface, color: VN.onSurface }}>

      {/* Top brand bar */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: VN.surfaceLow }}>
        <span className="font-pixel text-sm tracking-[0.2em]" style={{ color: VN.cta }}>OSCILLATE</span>
        <span className="font-sg text-[9px] uppercase tracking-[0.3em]" style={{ color: VN.outline }}>VOLTAGE NOIR</span>
        <button onClick={() => navigate("/")}
          className="font-sg text-[9px] uppercase tracking-[0.2em]" style={{ color: VN.outline }}>
          ✕ CLOSE
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">

          {/* CHECKING */}
          {status === "checking" && (
            <div className="text-center py-20">
              <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-6 animate-pulse" style={{ color: VN.outline }}>
                VERIFYING TRANSMISSION...
              </p>
              <div className="flex justify-center gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 animate-bounce" style={{ background: VN.cta, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* PAID — ENTRY AUTHORIZED */}
          {status === "paid" && ticket && (
            <>
              {/* Header */}
              <div className="mb-8">
                <p className="font-sg text-[9px] uppercase tracking-[0.4em] mb-2" style={{ color: VN.outline }}>
                  TRANSMISSION RECEIVED
                </p>
                <h1 className="font-sg font-bold text-4xl leading-tight uppercase" style={{ color: VN.onSurface }}>
                  ENTRY<br />
                  <span style={{ color: VN.cta }}>AUTHORIZED</span>
                </h1>
              </div>

              {/* QR Card */}
              <div className="relative p-1 mb-6" style={{ background: VN.surfaceMid }}>
                {/* Corner brackets */}
                <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 z-10 pointer-events-none" style={{ borderColor: VN.cta }} />
                <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 z-10 pointer-events-none" style={{ borderColor: VN.cta }} />
                <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 z-10 pointer-events-none" style={{ borderColor: VN.cta }} />
                <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 z-10 pointer-events-none" style={{ borderColor: VN.cta }} />

                <div className="p-5 flex flex-col items-center" style={{ background: VN.surfaceHigh }}>
                  {ticket.qr_code ? (
                    <div className="p-2 mb-3" style={{ background: "#fff" }}>
                      <img data-testid="ticket-qr-code"
                        src={`data:image/png;base64,${ticket.qr_code}`}
                        alt="QR Code"
                        className="w-44 h-44 block" />
                    </div>
                  ) : (
                    <div className="w-44 h-44 mb-3 flex items-center justify-center font-sg text-[10px] uppercase"
                      style={{ background: VN.surfaceMid, color: VN.outline }}>
                      QR NOT AVAILABLE
                    </div>
                  )}
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: VN.outline }}>
                    {ticket.id}
                  </p>
                </div>
              </div>

              {/* Event details */}
              <div className="mb-6 px-1">
                <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-3" style={{ color: VN.outline }}>
                  CURRENT SEQUENCE
                </p>
                <p className="font-sg font-bold text-xl uppercase mb-4" style={{ color: VN.onSurface }}>
                  {ticket.event_name}
                </p>
                <DetailRow label="DATE" value={ticket.event_date || "—"} />
                <DetailRow label="VENUE" value={ticket.venue || "—"} />
                <DetailRow label="TIER" value={ticket.ticket_type} />
                <DetailRow label="HOLDER" value={ticket.buyer_name} />
              </div>

              {/* Multi-ticket note */}
              {ticketIds?.length > 1 && (
                <div className="mb-4 px-3 py-3" style={{ background: VN.surfaceLow }}>
                  <p className="font-sg text-[9px] uppercase tracking-[0.2em] mb-2" style={{ color: VN.outline }}>
                    {ticketIds.length} TICKETS ISSUED
                  </p>
                  {ticketIds.map(id => (
                    <p key={id} className="font-mono text-[10px]" style={{ color: VN.cta }}>{id}</p>
                  ))}
                </div>
              )}

              <p className="font-sg text-[10px] mb-5 leading-relaxed" style={{ color: VN.outline }}>
                Present this QR at the door for entry. Confirmation sent to {ticket.buyer_email || "your email"}.
              </p>

              {/* Primary CTA */}
              <button data-testid="download-qr"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = `${API}/ticket/${ticket.id}/qr`;
                  a.download = `${ticket.id}.png`;
                  a.click();
                }}
                className="w-full py-4 font-sg font-bold text-[11px] uppercase tracking-[0.2em] mb-3 transition-all"
                style={{ background: VN.cta, color: VN.ctaText }}>
                SAVE QR / ADD TO WALLET
              </button>

              {/* Secondary CTAs */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button data-testid="whatsapp-share"
                  onClick={async () => {
                    try {
                      const r = await axios.get(`${API}/ticket/${ticket.id}/whatsapp`);
                      window.open(r.data.whatsapp_url, "_blank");
                    } catch {
                      window.open(`https://wa.me/?text=${encodeURIComponent(`OSCILLATE TICKET: ${ticket.id}\n${ticket.event_name}`)}`, "_blank");
                    }
                  }}
                  className="py-3 font-sg text-[10px] uppercase tracking-[0.1em] transition-all"
                  style={{ background: "#25D366", color: "#000" }}>
                  <i className="fab fa-whatsapp mr-1.5" />SHARE
                </button>
                <button onClick={() => navigate("/")}
                  className="py-3 font-sg text-[10px] uppercase tracking-[0.1em] transition-all"
                  style={{ border: `1px solid ${VN.outlineVar}40`, color: VN.outline }}>
                  ← EXPLORE
                </button>
              </div>

              {/* Stats footer */}
              <div className="grid grid-cols-3 gap-1 mt-6">
                {[
                  ["BPM", "142 – 150"],
                  ["DOORS", "22:00 IST"],
                  ["PROTOCOL", "ENCRYPTED"],
                ].map(([l, v]) => (
                  <div key={l} className="text-center py-2" style={{ background: VN.surfaceLow }}>
                    <p className="font-sg text-[7px] uppercase tracking-[0.2em]" style={{ color: VN.outlineVar }}>{l}</p>
                    <p className="font-mono text-[9px]" style={{ color: VN.onSurfaceVar }}>{v}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ERROR / EXPIRED / TIMEOUT */}
          {(status === "expired" || status === "error" || status === "timeout") && (
            <div className="text-center py-20">
              <p className="font-sg text-[9px] uppercase tracking-[0.3em] mb-4" style={{ color: VN.outlineVar }}>
                TRANSMISSION FAILED
              </p>
              <h1 className="font-sg font-bold text-3xl uppercase mb-4" style={{ color: VN.onSurface }}>
                {status === "expired" ? "SESSION EXPIRED" : "SIGNAL LOST"}
              </h1>
              <p className="font-sg text-[11px] mb-8" style={{ color: VN.outline }}>
                Something went wrong. Please try again or contact support.
              </p>
              <button onClick={() => navigate("/")}
                className="px-8 py-4 font-sg font-bold text-[11px] uppercase tracking-[0.2em]"
                style={{ background: VN.cta, color: VN.ctaText }}>
                BACK TO BASE
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
