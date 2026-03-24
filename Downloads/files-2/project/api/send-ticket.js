// Serverless function — sends ticket confirmation email with QR codes via Resend
// Also stores each ticket in Supabase for venue check-in scanning
// Called after payment success (both Razorpay and UPI flows)

import { Resend } from 'resend';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY; // service key — never expose client-side
  if (!url || !key) return null;
  return createClient(url, key);
}

// Generate a unique ticket ID for each ticket
function generateTicketId(eventCode) {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `OSC-${eventCode}-${ts}-${rand}`;
}

// Build QR code as base64 PNG data URL
async function makeQR(data) {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    width: 240,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// Map event names to short codes for ticket IDs
function eventCode(eventName = '') {
  if (eventName.toLowerCase().includes('uberkikz')) return 'UBK';
  if (eventName.toLowerCase().includes('signal')) return 'SIG';
  if (eventName.toLowerCase().includes('stellar')) return 'STL';
  return 'EVT';
}

// Minimal inline styles for dark email (Gmail-compatible)
function buildEmailHTML({ name, items, paymentId, total, ticketBlocks }) {
  const ticketItemsHTML = ticketBlocks.map(t => `
    <tr>
      <td style="padding:24px 0; border-bottom:1px solid #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top; padding-right:24px;">
              <p style="margin:0 0 4px; font-family:monospace; font-size:10px; color:#00e5ff; letter-spacing:3px;">${t.type === 'ticket' ? 'EVENT TICKET' : 'MERCH ORDER'}</p>
              <p style="margin:0 0 6px; font-family:monospace; font-size:15px; color:#ffffff; font-weight:bold;">${t.name}</p>
              <p style="margin:0 0 4px; font-family:monospace; font-size:12px; color:#666666;">${t.detail || ''}</p>
              <p style="margin:0 0 4px; font-family:monospace; font-size:12px; color:#ffffff;">${t.price}${t.qty > 1 ? ' ×' + t.qty : ''}</p>
              ${t.type === 'ticket' ? `
              <p style="margin:12px 0 4px; font-family:monospace; font-size:9px; color:#444444; letter-spacing:1px;">TICKET ID</p>
              <p style="margin:0; font-family:monospace; font-size:11px; color:#00e5ff;">${t.ticketId}</p>
              ` : ''}
            </td>
            ${t.type === 'ticket' ? `
            <td style="vertical-align:top; text-align:right; min-width:120px;">
              <img src="${t.qrDataUrl}" width="120" height="120" style="display:block; border:3px solid #00e5ff; border-radius:4px;" alt="Ticket QR" />
              <p style="margin:6px 0 0; font-family:monospace; font-size:9px; color:#444444; text-align:center;">SHOW AT VENUE</p>
            </td>
            ` : ''}
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
    <tr><td align="center" style="padding:32px 16px;">

      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0a0a0a;border:1px solid #1a1a1a;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 32px 24px;border-bottom:1px solid #1a1a1a;text-align:center;">
            <p style="margin:0 0 8px;font-family:monospace;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:8px;">◈ OSCILLATE</p>
            <p style="margin:0;font-family:monospace;font-size:10px;color:#00e5ff;letter-spacing:4px;">BOOKING CONFIRMED</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <p style="margin:0;font-family:monospace;font-size:13px;color:#cccccc;line-height:1.7;">
              ${name ? `Hey ${name},` : 'Hey,'}<br>
              Your order is confirmed. Find your tickets below — show the QR code at the venue entrance. No printout needed, phone is fine.
            </p>
          </td>
        </tr>

        <!-- Ticket / Merch items -->
        <tr>
          <td style="padding:8px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${ticketItemsHTML}
            </table>
          </td>
        </tr>

        <!-- Order total -->
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a1a1a;padding:16px;">
              <tr>
                <td style="font-family:monospace;font-size:10px;color:#444444;letter-spacing:2px;">ORDER TOTAL (INCL. GST)</td>
                <td style="font-family:monospace;font-size:16px;color:#00e5ff;text-align:right;font-weight:bold;">₹${total.toLocaleString('en-IN')}</td>
              </tr>
              ${paymentId ? `
              <tr>
                <td colspan="2" style="padding-top:10px;font-family:monospace;font-size:10px;color:#333333;">
                  Payment ID: <span style="color:#555555;">${paymentId}</span>
                </td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- What to bring -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:20px;">
              <tr><td>
                <p style="margin:0 0 12px;font-family:monospace;font-size:9px;color:#00e5ff;letter-spacing:3px;">WHAT TO BRING</p>
                <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#888888;">◈ This QR code (phone screen is fine)</p>
                <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#888888;">◈ Valid photo ID matching your name</p>
                <p style="margin:0;font-family:monospace;font-size:12px;color:#888888;">◈ Arrive at listed venue time</p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1a1a1a;text-align:center;">
            <p style="margin:0 0 6px;font-family:monospace;font-size:10px;color:#333333;">Questions? Reply to this email.</p>
            <p style="margin:0;font-family:monospace;font-size:9px;color:#222222;letter-spacing:2px;">OSCILLATE · TECHNO COLLECTIVE · INDIA</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'tickets@oscillate.in';

  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return res.status(200).json({ sent: false, reason: 'Email not configured' });
  }

  try {
    const { email, name, items = [], paymentId = '', total = 0 } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Build ticket blocks with QR codes for ticket items
    const ticketBlocks = await Promise.all(items.map(async (item) => {
      if (item.type !== 'ticket') return { ...item };

      const qty = item.qty || 1;
      // Generate one QR per ticket quantity (for simplicity, combine into one block)
      const ticketId = generateTicketId(eventCode(item.name));
      const qrData = `OSCILLATE|${ticketId}|${email}|${paymentId || 'UPI'}`;
      const qrDataUrl = await makeQR(qrData);

      return { ...item, ticketId, qrDataUrl };
    }));

    // ── Store tickets in Supabase for venue check-in ─────────────────────────
    const supabase = getSupabase();
    if (supabase) {
      const ticketRows = ticketBlocks
        .filter(t => t.type === 'ticket')
        .map(t => ({
          ticket_id: t.ticketId,
          qr_data: `OSCILLATE|${t.ticketId}|${email}|${paymentId || 'UPI'}`,
          event_name: t.name,
          event_detail: t.detail || '',
          customer_email: email,
          customer_name: name || '',
          payment_id: paymentId || '',
          is_scanned: false,
        }));

      if (ticketRows.length > 0) {
        const { error: dbErr } = await supabase.from('tickets').insert(ticketRows);
        if (dbErr) console.warn('Supabase insert error:', dbErr.message);
      }
    }

    const html = buildEmailHTML({ name: name || '', items, paymentId, total, ticketBlocks });

    const { data, error } = await resend.emails.send({
      from: `OSCILLATE <${FROM_EMAIL}>`,
      to: [email],
      subject: `◈ Your OSCILLATE ticket${items.filter(i => i.type === 'ticket').length > 1 ? 's are' : ' is'} confirmed`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ sent: false, error: error.message });
    }

    // Also add to mailing list if Resend audience ID is configured
    const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
    if (AUDIENCE_ID) {
      try {
        await resend.contacts.create({
          email,
          firstName: name?.split(' ')[0] || '',
          lastName: name?.split(' ').slice(1).join(' ') || '',
          unsubscribed: false,
          audienceId: AUDIENCE_ID,
        });
      } catch (audienceErr) {
        console.warn('Could not add to audience:', audienceErr.message);
        // Non-fatal — ticket email already sent
      }
    }

    return res.status(200).json({ sent: true, id: data?.id });

  } catch (err) {
    console.error('send-ticket error:', err);
    return res.status(500).json({ sent: false, error: 'Internal server error' });
  }
}
