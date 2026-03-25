// Serverless function — venue staff endpoint to verify and scan tickets
// POST /api/check-ticket  { ticket_id, pin }
//   → returns ticket info + marks is_scanned = true
// GET  /api/check-ticket?ticket_id=OSC-...&pin=...
//   → same but via query string (for simple scanner setups)

import { createClient } from '@supabase/supabase-js';
import { isRateLimited, getIP } from './_ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Allow generous rate for fast venue scanning (60/min per IP)
  if (isRateLimited(`${getIP(req)}:check-ticket`, 60, 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const VENUE_PIN    = process.env.VENUE_CHECKIN_PIN || '0000';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ ok: false, error: 'Database not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const isGet = req.method === 'GET';
  const ticket_id = isGet ? req.query?.ticket_id : req.body?.ticket_id;
  const pin       = isGet ? req.query?.pin        : req.body?.pin;

  if (!ticket_id) {
    return res.status(400).json({ ok: false, error: 'ticket_id required' });
  }

  // Simple PIN auth — venue staff enter this once per shift
  if (pin !== VENUE_PIN) {
    return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  }

  // Fetch ticket
  const { data: ticket, error: fetchErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', ticket_id)
    .single();

  if (fetchErr || !ticket) {
    return res.status(404).json({ ok: false, error: 'Ticket not found', ticket_id });
  }

  if (ticket.is_scanned) {
    return res.status(409).json({
      ok: false,
      error: 'ALREADY SCANNED',
      ticket_id,
      event: ticket.event_name,
      customer: ticket.customer_name,
      email: ticket.customer_email,
      scanned_at: ticket.scanned_at,
    });
  }

  // Mark as scanned
  const scanned_at = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('tickets')
    .update({ is_scanned: true, scanned_at })
    .eq('ticket_id', ticket_id);

  if (updateErr) {
    console.error('Failed to mark ticket as scanned:', updateErr.message);
    return res.status(500).json({ ok: false, error: 'Database update failed' });
  }

  return res.status(200).json({
    ok: true,
    message: 'VALID — LET THEM IN',
    ticket_id,
    event: ticket.event_name,
    event_detail: ticket.event_detail,
    customer: ticket.customer_name || 'Guest',
    email: ticket.customer_email,
    payment_id: ticket.payment_id,
    scanned_at,
  });
}
