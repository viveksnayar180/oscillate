// Serverless function — verifies Razorpay payment signature server-side
// CRITICAL: Never skip this — client-side success callbacks can be spoofed
// Uses Node.js built-in `crypto` — no npm package required

import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay secret not configured' });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment fields' });
    }

    // Razorpay signature verification:
    // expected_signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
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

    // Here you would save the order to your database
    // For now we return success and let the client clear the cart
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
