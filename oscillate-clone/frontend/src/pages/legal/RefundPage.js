import { useNavigate } from "react-router-dom";

const C = { surface: "#131313", surfaceLow: "#1c1b1b", cta: "#ff562d", onSurface: "#e5e2e1", outline: "#ae887f", outlineVar: "#5e3f38" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: `1px solid ${C.outlineVar}20` }}>
    <h2 className="font-display" style={{ fontSize: 20, textTransform: "uppercase", color: C.onSurface, marginBottom: 12 }}>{title}</h2>
    <div className="font-mono" style={{ fontSize: 12, color: C.outline, lineHeight: 1.8 }}>{children}</div>
  </div>
);

export default function RefundPage() {
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
        <h1 className="font-display" style={{ fontSize: 48, textTransform: "uppercase", color: C.onSurface, marginBottom: 8 }}>REFUND</h1>
        <h2 className="font-display" style={{ fontSize: 32, textTransform: "uppercase", color: C.cta, marginBottom: 32 }}>POLICY</h2>
        <p style={{ fontSize: 10, color: C.outlineVar, letterSpacing: "0.15em", marginBottom: 40 }}>LAST UPDATED: APRIL 2026</p>

        <Section title="1. General Policy">
          <p><strong style={{ color: C.onSurface }}>All ticket sales are final.</strong> We do not offer refunds once a ticket has been issued, except in the cases described below.</p>
          <p style={{ marginTop: 8 }}>This policy applies to all tickets purchased through Oscillate, including online purchases and POS door tickets.</p>
        </Section>

        <Section title="2. When You Are Entitled to a Refund">
          <ul style={{ paddingLeft: 20 }}>
            <li><strong style={{ color: C.onSurface }}>Event Cancellation:</strong> If Oscillate cancels an event entirely, all ticket holders will receive a full refund to the original payment method within 10 business days.</li>
            <li style={{ marginTop: 8 }}><strong style={{ color: C.onSurface }}>Duplicate Charge:</strong> If you were charged more than once for the same ticket, contact us with proof and we will refund the duplicate charge immediately.</li>
            <li style={{ marginTop: 8 }}><strong style={{ color: C.onSurface }}>Technical Failure:</strong> If a payment was processed but no ticket was issued due to a platform error on our end, you will receive a full refund or a replacement ticket.</li>
          </ul>
        </Section>

        <Section title="3. When Refunds Are NOT Issued">
          <ul style={{ paddingLeft: 20 }}>
            <li>Change of personal plans or inability to attend</li>
            <li>Denied entry due to misconduct or violation of event rules</li>
            <li>Lineup changes (artist substitutions, schedule adjustments)</li>
            <li>Venue changes to a comparable alternative location</li>
            <li>Rescheduled events — your ticket remains valid for the new date</li>
          </ul>
        </Section>

        <Section title="4. Event Postponement">
          <p>If an event is postponed, your ticket will automatically transfer to the new date. If you cannot attend the rescheduled event, you may request a refund within 14 days of the rescheduling announcement by emailing us.</p>
        </Section>

        <Section title="5. Complimentary Tickets">
          <p>Complimentary (COMP) tickets have no monetary value and are not eligible for cash refunds under any circumstances.</p>
        </Section>

        <Section title="6. How to Request a Refund">
          <p>Email <span style={{ color: C.onSurface }}>hello@oscillate.in</span> with:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Your ticket ID (e.g. OSC-XXX-...)</li>
            <li>Your order email address</li>
            <li>Reason for refund request</li>
          </ul>
          <p style={{ marginTop: 8 }}>Refunds to card/UPI are processed within 5–10 business days. Bank processing times may vary.</p>
        </Section>

        <Section title="7. Contact">
          <p>Refund queries: <span style={{ color: C.onSurface }}>hello@oscillate.in</span></p>
          <p style={{ marginTop: 4 }}>We aim to respond within 2 business days.</p>
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
