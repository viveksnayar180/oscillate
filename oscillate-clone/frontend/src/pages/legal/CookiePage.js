import { useNavigate } from "react-router-dom";

const C = { surface: "#131313", surfaceLow: "#1c1b1b", cta: "#ff562d", onSurface: "#e5e2e1", outline: "#ae887f", outlineVar: "#5e3f38" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.outlineVar}20` }}>
    <h2 className="font-display" style={{ fontSize: 20, textTransform: "uppercase", color: C.onSurface, marginBottom: 12 }}>{title}</h2>
    <div className="font-mono" style={{ fontSize: 12, color: C.outline, lineHeight: 1.8 }}>{children}</div>
  </div>
);

export default function CookiePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen font-sg" style={{ background: C.surface, color: C.onSurface }}>
      <div style={{ background: C.surfaceLow, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.outlineVar}20` }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: C.outline, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer" }}>← BACK</button>
        <a href="/" className="font-pixel" style={{ fontSize: 14, letterSpacing: "0.2em", color: C.cta, textDecoration: "none" }}>OSCILLATE</a>
        <span />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <p style={{ fontSize: 9, letterSpacing: "0.4em", color: C.outline, marginBottom: 8, textTransform: "uppercase" }}>LEGAL</p>
        <h1 className="font-display" style={{ fontSize: 48, textTransform: "uppercase", color: C.onSurface, marginBottom: 8 }}>COOKIE</h1>
        <h2 className="font-display" style={{ fontSize: 32, textTransform: "uppercase", color: C.cta, marginBottom: 32 }}>POLICY</h2>
        <p style={{ fontSize: 10, color: C.outlineVar, letterSpacing: "0.15em", marginBottom: 40 }}>LAST UPDATED: APRIL 2026</p>

        <Section title="1. What Are Cookies">
          <p>Cookies are small text files stored on your device when you visit a website. They help maintain your session and preferences.</p>
        </Section>

        <Section title="2. Cookies We Use">
          <p>We use only strictly necessary cookies:</p>
          <div style={{ marginTop: 12, padding: 16, background: C.surfaceLow }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8, marginBottom: 8 }}>
              <strong style={{ color: C.onSurface }}>Name</strong>
              <strong style={{ color: C.onSurface }}>Provider</strong>
              <strong style={{ color: C.onSurface }}>Purpose</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8, paddingTop: 8, borderTop: `1px solid ${C.outlineVar}20` }}>
              <span>sb-auth-token</span>
              <span>Supabase</span>
              <span>Keeps you signed in across pages</span>
            </div>
          </div>
        </Section>

        <Section title="3. Cookies We Do NOT Use">
          <ul style={{ paddingLeft: 20 }}>
            <li>Advertising or retargeting cookies</li>
            <li>Analytics tracking cookies (e.g. Google Analytics)</li>
            <li>Third-party marketing cookies</li>
            <li>Social media pixel trackers</li>
          </ul>
          <p style={{ marginTop: 8 }}>We do not share cookie data with advertisers.</p>
        </Section>

        <Section title="4. How to Control Cookies">
          <p>You can disable cookies in your browser settings. However, disabling the session cookie will prevent you from signing in.</p>
          <p style={{ marginTop: 8 }}>To sign out and clear your session cookie: go to Profile → Settings → Sign Out.</p>
        </Section>

        <Section title="5. Changes">
          <p>If we introduce new cookies, we will update this policy and notify users where required by law.</p>
        </Section>

        <Section title="6. Contact">
          <p>Questions about cookies: <span style={{ color: C.onSurface }}>hello@oscillate.in</span></p>
        </Section>
      </div>

      <LegalFooter />
    </div>
  );
}

function LegalFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${C.outlineVar}20`, padding: "24px", textAlign: "center" }}>
      <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
        {[["PRIVACY", "/privacy"], ["TERMS", "/terms"], ["COOKIES", "/cookies"], ["REFUNDS", "/refund"]].map(([l, h]) => (
          <a key={l} href={h} className="font-mono" style={{ fontSize: 10, color: C.outlineVar, letterSpacing: "0.15em", textDecoration: "none" }}>{l}</a>
        ))}
      </div>
      <p className="font-mono" style={{ fontSize: 9, color: C.outlineVar, letterSpacing: "0.1em", marginTop: 16 }}>© 2026 OSCILLATE. ALL RIGHTS RESERVED.</p>
    </footer>
  );
}
