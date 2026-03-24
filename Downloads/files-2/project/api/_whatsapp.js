// Shared utility — sends WhatsApp message via Twilio REST API (no SDK needed)
// Called from _mailer.js after email dispatch, non-blocking

export async function sendWhatsApp({ phone, name, tickets = [], paymentId = '' }) {
  const SID   = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM  = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886 (sandbox) or your approved number

  if (!SID || !TOKEN || !FROM) {
    console.warn('Twilio credentials not set — skipping WhatsApp');
    return { sent: false, reason: 'Twilio not configured' };
  }

  // Normalise Indian phone — strip leading 0, add +91 if no country code
  const cleaned = phone.replace(/\D/g, '');
  const e164 = cleaned.startsWith('91') && cleaned.length === 12
    ? `+${cleaned}`
    : cleaned.length === 10
      ? `+91${cleaned}`
      : `+${cleaned}`;

  // Build message body
  const firstTicket = tickets[0];
  const lines = [
    '◈ OSCILLATE — Booking Confirmed',
    '',
    firstTicket ? `Event: ${firstTicket.name}` : '',
    firstTicket ? `Date: ${firstTicket.detail || ''}` : '',
    firstTicket ? `Ticket ID: ${firstTicket.ticketId || 'See email'}` : '',
    tickets.length > 1 ? `(+${tickets.length - 1} more ticket${tickets.length > 2 ? 's' : ''})` : '',
    '',
    'Show your QR code at the venue entrance.',
    'Check your email for the full QR ticket.',
    '',
    'Questions? Reply to this message.',
    '— OSCILLATE',
  ].filter(l => l !== undefined);

  const body = lines.join('\n');

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`;
    const params = new URLSearchParams({
      From: FROM,
      To:   `whatsapp:${e164}`,
      Body: body,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString('base64')}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn('Twilio error:', data.message);
      return { sent: false, error: data.message };
    }

    return { sent: true, sid: data.sid };
  } catch (err) {
    console.warn('WhatsApp send failed (non-fatal):', err.message);
    return { sent: false, error: err.message };
  }
}
