// Shared utility — generates ticket QR codes, sends email via Resend, stores in Supabase
// Called by:
//   api/razorpay-verify.js  (after server-side payment verification — Razorpay flow)
//   api/send-ticket.js      (after UPI self-confirm — no server verification available)

import { Resend } from 'resend';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp } from './_whatsapp.js';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

function generateTicketId(code) {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `OSC-${code}-${ts}-${rand}`;
}

async function makeQR(data) {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H', width: 240, margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

function eventCode(name = '') {
  if (name.toLowerCase().includes('uberkikz')) return 'UBK';
  if (name.toLowerCase().includes('signal')) return 'SIG';
  if (name.toLowerCase().includes('stellar')) return 'STL';
  return 'EVT';
}

function buildHTML({ name, items, paymentId, total, ticketBlocks }) {
  // Collect venue/lineup from the first ticket block that has it
  const firstTicket = ticketBlocks.find(t => t.type === 'ticket');
  const venueInfo = firstTicket?.venue ? `${firstTicket.venue}, ${firstTicket.city || ''}`.trim().replace(/,$/, '') : null;
  const eventDate = firstTicket?.eventDate || null;
  const eventTime = firstTicket?.eventTime || null;
  const lineup = firstTicket?.lineup?.length ? firstTicket.lineup : null;
  const mapsUrl = venueInfo ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueInfo)}` : null;

  const ticketItemsHTML = ticketBlocks.map(t => `
    <tr>
      <td style="padding:24px 0;border-bottom:1px solid #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top;padding-right:24px;">
              <p style="margin:0 0 4px;font-family:monospace;font-size:10px;color:#00e5ff;letter-spacing:3px;">${t.type === 'ticket' ? `EVENT TICKET${t.totalTickets > 1 ? ` · ${t.ticketNum} OF ${t.totalTickets}` : ''}` : 'MERCH ORDER'}</p>
              <p style="margin:0 0 6px;font-family:monospace;font-size:15px;color:#ffffff;font-weight:bold;">${t.name}</p>
              <p style="margin:0 0 4px;font-family:monospace;font-size:12px;color:#666666;">${t.detail || ''}</p>
              <p style="margin:0 0 4px;font-family:monospace;font-size:12px;color:#ffffff;">${t.price}</p>
              ${t.type === 'ticket' ? `
              <p style="margin:12px 0 4px;font-family:monospace;font-size:9px;color:#444444;letter-spacing:1px;">TICKET ID</p>
              <p style="margin:0;font-family:monospace;font-size:11px;color:#00e5ff;">${t.ticketId}</p>` : ''}
            </td>
            ${t.type === 'ticket' ? `
            <td style="vertical-align:top;text-align:right;min-width:120px;">
              <img src="${t.qrDataUrl}" width="120" height="120" style="display:block;border:3px solid #00e5ff;border-radius:4px;" alt="Ticket QR" />
              <p style="margin:6px 0 0;font-family:monospace;font-size:9px;color:#444444;text-align:center;">SHOW AT VENUE</p>
            </td>` : ''}
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:monospace;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0a0a0a;border:1px solid #1a1a1a;">
      <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #1a1a1a;text-align:center;">
        <p style="margin:0 0 8px;font-family:monospace;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:8px;">◈ OSCILLATE</p>
        <p style="margin:0;font-family:monospace;font-size:10px;color:#00e5ff;letter-spacing:4px;">BOOKING CONFIRMED</p>
      </td></tr>
      <tr><td style="padding:24px 32px 8px;">
        <p style="margin:0;font-family:monospace;font-size:13px;color:#cccccc;line-height:1.7;">
          ${name ? `Hey ${name},` : 'Hey,'}<br>
          Your order is confirmed. Show the QR at the venue entrance — phone screen is fine.
        </p>
      </td></tr>
      <tr><td style="padding:8px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">${ticketItemsHTML}</table>
      </td></tr>
      <tr><td style="padding:20px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1a1a1a;padding:16px;">
          <tr>
            <td style="font-family:monospace;font-size:10px;color:#444444;letter-spacing:2px;">ORDER TOTAL (INCL. GST)</td>
            <td style="font-family:monospace;font-size:16px;color:#00e5ff;text-align:right;font-weight:bold;">₹${Number(total).toLocaleString('en-IN')}</td>
          </tr>
          ${paymentId ? `<tr><td colspan="2" style="padding-top:10px;font-family:monospace;font-size:10px;color:#333333;">Payment ID: <span style="color:#555555;">${paymentId}</span></td></tr>` : ''}
        </table>
      </td></tr>
      ${venueInfo ? `
      <tr><td style="padding:0 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f0f;border:1px solid #0d2626;padding:20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-family:monospace;font-size:9px;color:#00e5ff;letter-spacing:3px;">EVENT DETAILS</p>
            ${eventDate ? `<p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#aaaaaa;">📅 ${eventDate}${eventTime ? ` · ${eventTime}` : ''}</p>` : ''}
            <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#aaaaaa;">📍 ${venueInfo}</p>
            ${mapsUrl ? `<p style="margin:0 0 0;font-family:monospace;font-size:11px;"><a href="${mapsUrl}" style="color:#00e5ff;text-decoration:none;">→ VIEW ON GOOGLE MAPS</a></p>` : ''}
          </td></tr>
        </table>
      </td></tr>` : ''}
      ${lineup ? `
      <tr><td style="padding:0 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;border:1px solid #1a1a2e;padding:20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-family:monospace;font-size:9px;color:#00e5ff;letter-spacing:3px;">LINEUP</p>
            ${lineup.map(a => `<p style="margin:0 0 4px;font-family:monospace;font-size:12px;color:#cccccc;border-left:2px solid #00e5ff44;padding-left:10px;">◈ ${a}</p>`).join('')}
          </td></tr>
        </table>
      </td></tr>` : ''}
      <tr><td style="padding:0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:20px;">
          <tr><td>
            <p style="margin:0 0 12px;font-family:monospace;font-size:9px;color:#00e5ff;letter-spacing:3px;">WHAT TO BRING</p>
            <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#888888;">◈ This QR code (phone screen is fine)</p>
            <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#888888;">◈ Valid photo ID matching your name</p>
            <p style="margin:0;font-family:monospace;font-size:12px;color:#888888;">◈ Arrive at listed venue time</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #1a1a1a;text-align:center;">
        <p style="margin:0 0 6px;font-family:monospace;font-size:10px;color:#333333;">Questions? Reply to this email.</p>
        <p style="margin:0;font-family:monospace;font-size:9px;color:#222222;letter-spacing:2px;">OSCILLATE · TECHNO COLLECTIVE · INDIA</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Main exported function ─────────────────────────────────────────────────
export async function dispatchTickets({ email, name, phone = '', items = [], paymentId = '', total = 0 }) {
  const resend = getResend();
  const supabase = getSupabase();
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'tickets@oscillate.in';

  // Build ticket blocks — one entry per individual ticket seat (expand qty)
  const ticketBlocks = [];
  for (const item of items) {
    if (item.type !== 'ticket') {
      ticketBlocks.push({ ...item });
      continue;
    }
    const qty = item.qty || 1;
    for (let i = 0; i < qty; i++) {
      const ticketId = generateTicketId(eventCode(item.name));
      const qrData = `OSCILLATE|${ticketId}|${email}|${paymentId || 'UPI'}`;
      const qrDataUrl = await makeQR(qrData);
      ticketBlocks.push({ ...item, qty: 1, ticketId, qrDataUrl, qrData, ticketNum: i + 1, totalTickets: qty });
    }
  }

  // Store tickets in Supabase — one row per individual ticket
  if (supabase) {
    // Idempotency: skip insert if tickets for this paymentId already exist
    if (paymentId) {
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('payment_id', paymentId);
      if (count > 0) {
        console.warn(`Idempotency: tickets for payment ${paymentId} already exist — aborting duplicate dispatch`);
        return { sent: false, reason: 'Duplicate payment — tickets already issued' };
      }
    }

    const ticketItems = ticketBlocks.filter(t => t.type === 'ticket');
    const perTicketAmount = ticketItems.length > 0 ? Math.round(total / ticketItems.length) : 0;
    const rows = ticketItems.map(t => ({
      ticket_id: t.ticketId,
      qr_data: t.qrData,
      event_name: t.name,
      event_detail: t.detail || '',
      customer_email: email,
      customer_name: name || '',
      payment_id: paymentId || '',
      amount: perTicketAmount,
      tier: t.detail?.split(' · ')[0] || '',
      is_scanned: false,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from('tickets').insert(rows);
      if (error) console.warn('Supabase insert error:', error.message);
    }
  }

  // Send confirmation email
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return { sent: false, reason: 'Email not configured' };
  }

  const html = buildHTML({ name: name || '', items, paymentId, total, ticketBlocks });
  const ticketCount = items.filter(i => i.type === 'ticket').length;

  const { data, error } = await resend.emails.send({
    from: `OSCILLATE <${FROM_EMAIL}>`,
    to: [email],
    subject: `◈ Your OSCILLATE ticket${ticketCount > 1 ? 's are' : ' is'} confirmed`,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    return { sent: false, error: error.message };
  }

  // Add to mailing list audience
  const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
  if (AUDIENCE_ID) {
    try {
      await resend.contacts.create({
        email, unsubscribed: false, audienceId: AUDIENCE_ID,
        firstName: name?.split(' ')[0] || '',
        lastName: name?.split(' ').slice(1).join(' ') || '',
      });
    } catch (e) {
      console.warn('Audience add failed (non-fatal):', e.message);
    }
  }

  // Send WhatsApp confirmation if phone provided (non-blocking)
  if (phone) {
    const ticketList = ticketBlocks.filter(t => t.type === 'ticket');
    sendWhatsApp({ phone, name, tickets: ticketList, paymentId })
      .catch(err => console.warn('WhatsApp (non-fatal):', err.message));
  }

  return { sent: true, id: data?.id };
}
