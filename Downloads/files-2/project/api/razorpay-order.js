// Serverless function — creates a Razorpay order server-side
// Called by Cart.jsx before opening the Razorpay checkout modal
// Uses native fetch + Basic auth — no npm package required

import { isRateLimited, getIP } from './_ratelimit.js';
import { isOriginAllowed } from './_origin.js';
import { calcExpectedTotal } from './_prices.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Forbidden' });
  if (isRateLimited(`${getIP(req)}:razorpay-order`, 15, 60_000)) {
    return res.status(429).json({ error: 'Too many requests — please wait a moment' });
  }

  const KEY_ID = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay keys not configured' });
  }

  try {
    const { amount, items = [], currency = 'INR', receipt, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Validate amount server-side — client must not control the price
    if (items.length > 0) {
      const expectedTotal = calcExpectedTotal(items);
      // Allow ₹2 tolerance for rounding differences
      if (Math.abs(amount - expectedTotal) > 2) {
        console.warn(`Amount mismatch: client sent ₹${amount}, server calculated ₹${expectedTotal}`);
        return res.status(400).json({ error: 'Amount does not match item prices' });
      }
    }

    // Hard cap — no single order should exceed ₹50,000
    if (amount > 50000) {
      return res.status(400).json({ error: 'Order amount exceeds maximum limit' });
    }

    // amount must be in paise (smallest currency unit) — multiply by 100
    const amountInPaise = Math.round(amount * 100);

    const credentials = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: receipt || `oscillate_${Date.now()}`,
        notes: notes || { source: 'oscillate-platform' },
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('Razorpay order creation failed:', order);
      return res.status(response.status).json({ error: order.error?.description || 'Order creation failed' });
    }

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: KEY_ID, // safe to return — only used to open modal
    });

  } catch (err) {
    console.error('razorpay-order error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
