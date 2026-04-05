// Serverless function — POS (Point of Sale) ticket issuance
// PIN-gated via POS_PIN env var. Supports cash, comp, and Razorpay payment methods.
// Called by PointOfSale.jsx

import { dispatchTickets } from './_mailer.js';
import { isRateLimited, getIP } from './_ratelimit.js';
import { isOriginAllowed } from './_origin.js';
import { isValidEmail, sanitizeStr } from './_validate.js';
import { POS_EVENTS } from './_prices.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

function getRazorpay() {
  const id  = process.env.RAZORPAY_KEY_ID;
  const sec = process.env.RAZORPAY_KEY_SECRET;
  return id && sec ? { id, sec } : null;
}

function generatePosPaymentId(method) {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ts   = Date.now().toString(36).toUpperCase();
  const prefix = method === 'comp' ? 'COMP' : 'CASH';
  return `${prefix}-${ts}-${rand}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Forbidden' });
  if (isRateLimited(`${getIP(req)}:pos-issue`, 30, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const POS_PIN = process.env.POS_PIN;
  if (!POS_PIN) return res.status(500).json({ error: 'POS not configured' });

  const {
    pin,
    probe       = false,
    event_name,
    tier,
    buyer_name,
    buyer_email,
    payment_method, // 'cash' | 'comp' | 'razorpay' | 'razorpay_link'
    payment_id,
    amount,
    auto_checkin = false,
  } = req.body || {};

  // ── PIN validation ────────────────────────────────────────────────────────
  if (!pin || pin !== POS_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Probe: just validate PIN, return immediately
  if (probe) return res.status(200).json({ ok: true });

  // ── Input validation ──────────────────────────────────────────────────────
  if (!buyer_email || !isValidEmail(buyer_email)) {
    return res.status(400).json({ error: 'Valid buyer email required' });
  }
  if (!event_name || !tier) {
    return res.status(400).json({ error: 'Event and tier required' });
  }
  if (!payment_method) {
    return res.status(400).json({ error: 'Payment method required' });
  }

  // Validate event + tier against canonical list
  const event = POS_EVENTS.find(e => e.name === event_name);
  if (!event) return res.status(400).json({ error: 'Unknown event' });
  const tierObj = event.tiers.find(t => t.name === tier);
  if (!tierObj) return res.status(400).json({ error: 'Unknown tier for this event' });

  // ── Razorpay payment link creation ────────────────────────────────────────
  if (payment_method === 'razorpay_link') {
    const rzp = getRazorpay();
    if (!rzp) return res.status(500).json({ error: 'Razorpay not configured' });

    try {
      const credentials = Buffer.from(`${rzp.id}:${rzp.sec}`).toString('base64');
      const linkAmount  = Math.round(tierObj.price * 100); // paise
      const response    = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: linkAmount,
          currency: 'INR',
          description: `${event_name} — ${tier}`,
          customer: {
            name:  sanitizeStr(buyer_name || '', 100),
            email: buyer_email,
          },
          notify: { email: true },
          reminder_enable: false,
          notes: { source: 'oscillate-pos', event: event_name, tier },
        }),
      });
      const link = await response.json();
      if (!response.ok) {
        return res.status(500).json({ error: link.error?.description || 'Failed to create payment link' });
      }
      return res.status(200).json({ ok: true, payment_link_url: link.short_url, link_id: link.id });
    } catch (err) {
      console.error('pos-issue razorpay_link error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Razorpay: verify captured payment ────────────────────────────────────
  if (payment_method === 'razorpay') {
    if (!payment_id || !payment_id.startsWith('pay_')) {
      return res.status(400).json({ error: 'Valid Razorpay payment ID required' });
    }
    const rzp = getRazorpay();
    if (!rzp) return res.status(500).json({ error: 'Razorpay not configured' });

    try {
      const credentials = Buffer.from(`${rzp.id}:${rzp.sec}`).toString('base64');
      const r = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}`, {
        headers: { 'Authorization': `Basic ${credentials}` },
      });
      if (!r.ok) return res.status(402).json({ error: 'Payment not found' });
      const pay = await r.json();
      if (pay.status !== 'captured') {
        return res.status(402).json({ error: `Payment not captured (status: ${pay.status})` });
      }
    } catch (err) {
      console.error('pos-issue razorpay verify error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Determine final payment ID + amount ──────────────────────────────────
  const finalPaymentId = (payment_method === 'cash' || payment_method === 'comp')
    ? generatePosPaymentId(payment_method)
    : payment_id; // razorpay

  const finalAmount = payment_method === 'comp' ? 0 : (amount ?? tierObj.price);

  // ── Issue ticket via dispatchTickets ─────────────────────────────────────
  try {
    const result = await dispatchTickets({
      email:     buyer_email,
      name:      sanitizeStr(buyer_name || '', 100),
      phone:     '',
      items: [{
        type:   'ticket',
        name:   event_name,
        detail: `${tier} · POS`,
        price:  finalAmount,
        qty:    1,
      }],
      paymentId: finalPaymentId,
      total:     finalAmount,
    });

    if (!result.sent && result.reason?.includes('Duplicate')) {
      return res.status(409).json({ error: 'Ticket already issued for this payment' });
    }

    // ── Auto check-in ─────────────────────────────────────────────────────
    // Find the ticket_id just inserted so we can return QR data + optionally mark scanned
    const supabase = getSupabase();
    let ticketRow = null;
    if (supabase) {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .eq('payment_id', finalPaymentId)
        .single();
      ticketRow = data;

      if (ticketRow && auto_checkin) {
        await supabase
          .from('tickets')
          .update({ is_scanned: true, scanned_at: new Date().toISOString() })
          .eq('ticket_id', ticketRow.ticket_id);
        ticketRow.is_scanned = true;
      }
    }

    return res.status(200).json({
      ok:          true,
      ticket_id:   ticketRow?.ticket_id  ?? finalPaymentId,
      qr_data:     ticketRow?.qr_data    ?? null,
      event_name,
      tier,
      buyer_name:  buyer_name  || '',
      buyer_email,
      amount:      finalAmount,
      payment_method,
      payment_id:  finalPaymentId,
      is_scanned:  ticketRow?.is_scanned ?? false,
    });

  } catch (err) {
    console.error('pos-issue dispatch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
