// Serverless function — verifies Razorpay payment signature server-side
// After successful verification, dispatches ticket email + stores in DB
// CRITICAL: Never skip this — client-side success callbacks can be spoofed

import crypto from 'crypto';
import { dispatchTickets } from './_mailer.js';
import { isRateLimited, getIP } from './_ratelimit.js';
import { isOriginAllowed } from './_origin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Forbidden' });
  if (isRateLimited(`${getIP(req)}:razorpay-verify`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay secret not configured' });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Customer + cart data for ticket dispatch
      email,
      name,
      phone = '',
      items = [],
      total = 0,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment fields' });
    }

    // Razorpay signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.warn('Razorpay signature mismatch — possible tampered request');
      return res.status(400).json({ success: false, error: 'Signature verification failed' });
    }

    // Payment verified — now dispatch tickets
    // This is the only place tickets are emailed for Razorpay purchases
    if (email && items.length > 0) {
      dispatchTickets({ email, name, phone, items, paymentId: razorpay_payment_id, total })
        .catch(err => console.error('Ticket dispatch error (non-blocking):', err.message));
    }

    return res.status(200).json({
      success: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });

  } catch (err) {
    console.error('razorpay-verify error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
