import { useNavigate } from "react-router-dom";

const C = { surface: "#131313", surfaceLow: "#1c1b1b", cta: "#ff562d", onSurface: "#e5e2e1", outline: "#ae887f", outlineVar: "#5e3f38" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.outlineVar}20` }}>
    <h2 className="font-display" style={{ fontSize: 20, textTransform: "uppercase", color: C.onSurface, marginBottom: 12 }}>{title}</h2>
    <div className="font-mono" style={{ fontSize: 12, color: C.outline, lineHeight: 1.8 }}>{children}</div>
  </div>
);

export default function PrivacyPage() {
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
        <h1 className="font-display" style={{ fontSize: 48, textTransform: "uppercase", color: C.onSurface, marginBottom: 8 }}>PRIVACY</h1>
        <h2 className="font-display" style={{ fontSize: 32, textTransform: "uppercase", color: C.cta, marginBottom: 32 }}>POLICY</h2>
        <p style={{ fontSize: 10, color: C.outlineVar, letterSpacing: "0.15em", marginBottom: 40 }}>LAST UPDATED: APRIL 2026</p>

        <Section title="1. Who We Are">
          <p>Oscillate is an independent techno collective based in Bengaluru, India. We organise underground electronic music events and issue event tickets to attendees.</p>
          <p style={{ marginTop: 8 }}>Contact: <span style={{ color: C.onSurface }}>hello@oscillate.in</span></p>
        </Section>

        <Section title="2. Information We Collect">
          <p>When you sign in or purchase tickets, we collect:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Your name and email address (from Google OAuth or entered by you)</li>
            <li>Profile information you voluntarily provide (city, bio, social handles)</li>
            <li>Ticket purchase records (event, tier, payment reference)</li>
            <li>Session data (managed by Supabase Auth)</li>
          </ul>
          <p style={{ marginTop: 8 }}>We do not collect payment card details — payments are processed via Razorpay.</p>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul style={{ paddingLeft: 20 }}>
            <li>To issue and verify event tickets</li>
            <li>To send ticket confirmation and event updates to your email</li>
            <li>To display your profile and ticket history in the app</li>
            <li>To manage door entry at events</li>
          </ul>
          <p style={{ marginTop: 8 }}>We do not sell your data to third parties. We do not use your data for advertising.</p>
        </Section>

        <Section title="4. Data Storage">
          <p>Your data is stored securely on Supabase (hosted on AWS). Ticket payment records are also stored in our MongoDB database. Access is restricted to authorised staff only.</p>
          <p style={{ marginTop: 8 }}>Supabase enforces Row-Level Security — you can only access your own data.</p>
        </Section>

        <Section title="5. Google Authentication">
          <p>If you sign in via Google, we receive your name, email, and profile picture from Google. We store these to populate your Oscillate profile. We do not receive your Google password or access to your Google account beyond basic identity.</p>
        </Section>

        <Section title="6. Cookies">
          <p>We use a session cookie set by Supabase Auth to keep you signed in. We do not use advertising or tracking cookies. See our <a href="/cookies" style={{ color: C.cta }}>Cookie Policy</a> for details.</p>
        </Section>

        <Section title="7. Your Rights">
          <ul style={{ paddingLeft: 20 }}>
            <li>Request a copy of your personal data</li>
            <li>Request deletion of your account and data</li>
            <li>Update your profile information at any time via Settings</li>
          </ul>
          <p style={{ marginTop: 8 }}>To exercise these rights, email <span style={{ color: C.onSurface }}>hello@oscillate.in</span>.</p>
        </Section>

        <Section title="8. Data Retention">
          <p>Ticket records are retained for 7 years for accounting and legal compliance. Profile data is deleted within 30 days of account deletion requests.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this policy. Material changes will be notified via email. Continued use of the platform after changes constitutes acceptance.</p>
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
