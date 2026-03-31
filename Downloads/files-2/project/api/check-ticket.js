// Serverless function — venue staff endpoint to verify and scan tickets
// POST /api/check-ticket  { ticket_id, pin }
//   → returns ticket info + marks is_scanned = true
// GET  /api/check-ticket?ticket_id=OSC-...&pin=...
//   → same but via query string (for simple scanner setups)

import { createClient } from '@supabase/supabase-js';
import { isRateLimited, getIP } from './_ratelimit.js';

// PIN failure lockout — per IP, resets after LOCKOUT_MS
const PIN_FAILURES   = new Map(); // ip → { count, lockedUntil }
const MAX_FAILURES   = 5;
const LOCKOUT_MS     = 15 * 60 * 1000; // 15 minutes

function isPinLockedOut(ip) {
  const rec = PIN_FAILURES.get(ip);
  if (!rec) return false;
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) return true;
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) {
    PIN_FAILURES.delete(ip); // lock expired
  }
  return false;
}

function recordPinFailure(ip) {
  const rec = PIN_FAILURES.get(ip) ?? { count: 0, lockedUntil: null };
  rec.count += 1;
  if (rec.count >= MAX_FAILURES) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    console.warn(`check-ticket: PIN lockout triggered for IP ${ip}`);
  }
  PIN_FAILURES.set(ip, rec);
}

function clearPinFailures(ip) {
  PIN_FAILURES.delete(ip);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIP(req);

  // Allow generous rate for fast venue scanning (60/min per IP)
  if (isRateLimited(`${ip}:check-ticket`, 60, 60_000)) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  // Block IPs that have repeatedly entered the wrong PIN
  if (isPinLockedOut(ip)) {
    return res.status(403).json({ ok: false, error: 'Too many failed PIN attempts — locked for 15 minutes' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const VENUE_PIN    = process.env.VENUE_CHECKIN_PIN;

  if (!VENUE_PIN) {
    console.error('VENUE_CHECKIN_PIN is not set — check-in is disabled');
    return res.status(503).json({ ok: false, error: 'Check-in not configured' });
  }

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
    recordPinFailure(ip);
    return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  }
  clearPinFailures(ip); // reset on success

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
