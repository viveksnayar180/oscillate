import { useNavigate } from "react-router-dom";

const C = { surface: "#131313", surfaceLow: "#1c1b1b", cta: "#ff562d", onSurface: "#e5e2e1", outline: "#ae887f", outlineVar: "#5e3f38" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.outlineVar}20` }}>
    <h2 className="font-display" style={{ fontSize: 20, textTransform: "uppercase", color: C.onSurface, marginBottom: 12 }}>{title}</h2>
    <div className="font-mono" style={{ fontSize: 12, color: C.outline, lineHeight: 1.8 }}>{children}</div>
  </div>
);

export default function TermsPage() {
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
        <h1 className="font-display" style={{ fontSize: 48, textTransform: "uppercase", color: C.onSurface, marginBottom: 8 }}>TERMS</h1>
        <h2 className="font-display" style={{ fontSize: 32, textTransform: "uppercase", color: C.cta, marginBottom: 32 }}>OF SERVICE</h2>
        <p style={{ fontSize: 10, color: C.outlineVar, letterSpacing: "0.15em", marginBottom: 40 }}>LAST UPDATED: APRIL 2026</p>

        <Section title="1. Acceptance">
          <p>By purchasing tickets or using the Oscillate platform, you agree to these Terms of Service. If you do not agree, do not use our services.</p>
        </Section>

        <Section title="2. Ticket Purchases">
          <ul style={{ paddingLeft: 20 }}>
            <li>Tickets are issued per person and are non-transferable without explicit permission from Oscillate.</li>
            <li>Ticket resale for profit is strictly prohibited. Tickets sold above face value will be cancelled without refund.</li>
            <li>Each ticket grants access to the specific event, tier, and date stated on the ticket only.</li>
            <li>Tickets must be presented digitally (QR code) at the door. Lost or inaccessible tickets are your responsibility.</li>
          </ul>
        </Section>

        <Section title="3. Entry & Conduct">
          <ul style={{ paddingLeft: 20 }}>
            <li>Oscillate reserves the right to refuse entry to anyone, including ticket holders, at our sole discretion.</li>
            <li>No re-entry once you have left the venue unless explicitly stated.</li>
            <li>Any behaviour deemed harmful, discriminatory, or disruptive will result in immediate removal without refund.</li>
            <li>Photography and recording restrictions may apply at individual events — follow on-site instructions.</li>
          </ul>
        </Section>

        <Section title="4. Refunds & Cancellations">
          <p>Tickets are generally non-refundable. See our <a href="/refund" style={{ color: C.cta }}>Refund Policy</a> for full details.</p>
          <p style={{ marginTop: 8 }}>In the event of cancellation by Oscillate, ticket holders will be offered a full refund or credit towards a future event.</p>
        </Section>

        <Section title="5. Event Changes">
          <p>Oscillate reserves the right to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Change the lineup, venue, or date of an event</li>
            <li>Cancel an event due to circumstances beyond our control (force majeure, venue closures, government restrictions)</li>
          </ul>
          <p style={{ marginTop: 8 }}>Significant changes will be communicated via email. Minor changes (supporting act replacements, minor schedule adjustments) do not entitle a refund.</p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>All content on this platform — including event artwork, photography, mixes, and branding — is owned by Oscillate or licensed from the respective artists. You may not reproduce or use this content commercially without written permission.</p>
        </Section>

        <Section title="7. Liability">
          <p>Oscillate's liability is limited to the face value of your ticket. We are not liable for personal injury, loss of property, or consequential damages at or related to our events, except where required by law.</p>
        </Section>

        <Section title="8. Governing Law">
          <p>These terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka.</p>
        </Section>

        <Section title="9. Contact">
          <p>For questions about these terms: <span style={{ color: C.onSurface }}>hello@oscillate.in</span></p>
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
