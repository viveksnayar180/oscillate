// Serverless function — sends broadcast email to Resend audience
// PIN-gated (uses VENUE_CHECKIN_PIN)
// POST /api/broadcast { pin, subject, body }

import { Resend } from 'resend';
import { isRateLimited, getIP } from './_ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (isRateLimited(`${getIP(req)}:broadcast`, 3, 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  const VENUE_PIN   = process.env.VENUE_CHECKIN_PIN || '0000';
  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
  const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || 'hello@oscillate.in';

  const { pin, subject, body } = req.body || {};

  if (pin !== VENUE_PIN) {
    return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  }

  if (!subject?.trim() || !body?.trim()) {
    return res.status(400).json({ ok: false, error: 'Subject and body are required' });
  }

  if (!RESEND_KEY) {
    return res.status(503).json({ ok: false, error: 'RESEND_API_KEY not configured' });
  }

  if (!AUDIENCE_ID) {
    return res.status(503).json({ ok: false, error: 'RESEND_AUDIENCE_ID not configured — create an audience in Resend dashboard first' });
  }

  const resend = new Resend(RESEND_KEY);

  // Convert plain text body to minimal HTML
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="background:#000;margin:0;padding:32px 16px;font-family:monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0a0a0a;border:1px solid #1a1a1a;padding:32px;">
        <tr><td style="padding-bottom:24px;border-bottom:1px solid #1a1a1a;">
          <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:#fff;letter-spacing:8px;">◈ OSCILLATE</p>
          <p style="margin:0;font-size:9px;color:#00e5ff;letter-spacing:4px;">TECHNO COLLECTIVE · INDIA</p>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <h2 style="margin:0 0 20px;font-size:15px;color:#fff;letter-spacing:2px;">${subject.replace(/</g, '&lt;')}</h2>
          <div style="font-size:13px;color:#aaaaaa;line-height:1.8;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div>
        </td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #1a1a1a;margin-top:32px;">
          <p style="margin:0;font-size:9px;color:#333;letter-spacing:2px;">OSCILLATE · TECHNO COLLECTIVE · INDIA</p>
          <p style="margin:6px 0 0;font-size:9px;color:#222;">You received this because you booked a ticket or joined the waitlist.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    // Create broadcast
    const { data: broadcast, error: createErr } = await resend.broadcasts.create({
      audienceId: AUDIENCE_ID,
      name: `${subject} — ${new Date().toISOString().split('T')[0]}`,
      from: `OSCILLATE <${FROM_EMAIL}>`,
      subject,
      replyTo: FROM_EMAIL,
    });

    if (createErr) {
      console.error('Resend create broadcast error:', createErr);
      return res.status(500).json({ ok: false, error: createErr.message });
    }

    // Update with HTML content
    const { error: updateErr } = await resend.broadcasts.update({
      id: broadcast.id,
      html,
    });

    if (updateErr) {
      console.error('Resend update broadcast error:', updateErr);
      return res.status(500).json({ ok: false, error: updateErr.message });
    }

    // Send
    const { error: sendErr } = await resend.broadcasts.send({ id: broadcast.id });

    if (sendErr) {
      console.error('Resend send broadcast error:', sendErr);
      return res.status(500).json({ ok: false, error: sendErr.message });
    }

    return res.status(200).json({ ok: true, broadcastId: broadcast.id });

  } catch (err) {
    console.error('Broadcast error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
