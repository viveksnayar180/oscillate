import { useState } from "react";
import { supabase } from "../lib/supabase";

const COLORS = {
  surface:    "#131313",
  surfaceMid: "#201f1f",
  surfaceHigh:"#2a2a2a",
  cta:        "#ff562d",
  cyan:       "#00eefc",
  onSurface:  "#e5e2e1",
  onSurfaceVar:"#e8bdb3",
  outline:    "#ae887f",
  outlineVar: "#5e3f38",
};

export default function AuthModal({ open, onClose }) {
  const [step, setStep] = useState("idle"); // idle | sending | sent | error
  const [email, setEmail] = useState("");
  const [errMsg, setErrMsg] = useState("");

  if (!open) return null;

  const handleGoogle = async () => {
    if (!supabase) { setErrMsg("Auth not configured."); setStep("error"); return; }
    setStep("oauth");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setErrMsg(error.message); setStep("error"); }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!supabase) { setErrMsg("Auth not configured."); setStep("error"); return; }
    if (!email.trim()) return;
    setStep("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setErrMsg(error.message); setStep("error"); }
    else setStep("sent");
  };

  return (
    <div
      className="osc-grain"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setStep("idle"); setEmail(""); setErrMsg(""); } }}
    >
      <div
        style={{
          background: COLORS.surfaceMid,
          width: "100%", maxWidth: 380,
          padding: "2rem",
          position: "relative",
        }}
      >
        {/* Corner brackets */}
        <span style={{ position:"absolute", top:8, left:8, width:14, height:14, borderTop:`2px solid ${COLORS.cyan}`, borderLeft:`2px solid ${COLORS.cyan}` }} />
        <span style={{ position:"absolute", top:8, right:8, width:14, height:14, borderTop:`2px solid ${COLORS.cyan}`, borderRight:`2px solid ${COLORS.cyan}` }} />
        <span style={{ position:"absolute", bottom:8, left:8, width:14, height:14, borderBottom:`2px solid ${COLORS.cyan}`, borderLeft:`2px solid ${COLORS.cyan}` }} />
        <span style={{ position:"absolute", bottom:8, right:8, width:14, height:14, borderBottom:`2px solid ${COLORS.cyan}`, borderRight:`2px solid ${COLORS.cyan}` }} />

        {/* Close */}
        <button
          onClick={() => { onClose(); setStep("idle"); setEmail(""); setErrMsg(""); }}
          style={{ position:"absolute", top:14, right:20, background:"none", border:"none", color:COLORS.outline, fontSize:18, cursor:"pointer" }}
        >✕</button>

        <p className="font-sg" style={{ fontSize:9, letterSpacing:"0.4em", color:COLORS.outline, marginBottom:8 }}>OSCILLATE_AUTH</p>
        <h2 className="font-sg" style={{ fontSize:22, fontWeight:700, letterSpacing:"0.06em", color:COLORS.onSurface, marginBottom:4 }}>
          IDENTIFY
        </h2>
        <p className="font-sg" style={{ fontSize:11, letterSpacing:"0.1em", color:COLORS.onSurfaceVar, marginBottom:24 }}>
          YOURSELF
        </p>

        {step === "sent" ? (
          <div style={{ textAlign:"center", padding:"1rem 0" }}>
            <p className="font-sg" style={{ color:COLORS.cyan, fontSize:12, letterSpacing:"0.2em" }}>SIGNAL SENT</p>
            <p className="font-sg" style={{ color:COLORS.outline, fontSize:11, marginTop:8 }}>Check {email} for your login link.</p>
          </div>
        ) : (
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              disabled={step === "oauth" || step === "sending"}
              className="osc-btn-primary font-sg"
              style={{
                width: "100%", padding: "12px",
                background: COLORS.cta, border: "none",
                color: "#fff", fontSize: 11, letterSpacing: "0.25em",
                fontWeight: 700, cursor: "pointer",
                opacity: step === "oauth" ? 0.6 : 1,
              }}
            >
              {step === "oauth" ? "REDIRECTING..." : "▶  SIGN IN WITH GOOGLE"}
            </button>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
              <div style={{ flex:1, height:1, background:COLORS.outlineVar }} />
              <span className="font-sg" style={{ fontSize:9, color:COLORS.outline, letterSpacing:"0.3em" }}>OR</span>
              <div style={{ flex:1, height:1, background:COLORS.outlineVar }} />
            </div>

            {/* Magic link */}
            <form onSubmit={handleMagicLink}>
              <p className="font-sg" style={{ fontSize:9, letterSpacing:"0.3em", color:COLORS.outline, marginBottom:6 }}>EMAIL_MAGIC_LINK</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="osc-input font-sg"
                style={{
                  width: "100%", padding: "10px 12px",
                  background: COLORS.surfaceHigh || "#2a2a2a",
                  border: `1px solid ${COLORS.outlineVar}`,
                  color: COLORS.onSurface, fontSize: 12,
                  letterSpacing: "0.05em", outline: "none",
                  boxSizing: "border-box", marginBottom: 10,
                }}
              />
              <button
                type="submit"
                disabled={step === "sending" || !email.trim()}
                className="font-sg"
                style={{
                  width: "100%", padding: "10px",
                  background: "transparent",
                  border: `1px solid ${COLORS.cta}`,
                  color: COLORS.cta, fontSize: 11, letterSpacing: "0.25em",
                  fontWeight: 700, cursor: "pointer",
                  opacity: (!email.trim() || step === "sending") ? 0.5 : 1,
                }}
              >
                {step === "sending" ? "SENDING..." : "SEND LINK"}
              </button>
            </form>

            {step === "error" && (
              <p className="font-sg" style={{ color: "#ff4444", fontSize: 10, marginTop: 12, letterSpacing:"0.15em" }}>
                {errMsg || "AUTH FAILED"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
