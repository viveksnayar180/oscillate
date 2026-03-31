// Serverless function — sends ticket email for UPI flow (no server-side payment verification)
// For Razorpay: ticket email is sent directly from razorpay-verify.js after sig check

import { dispatchTickets } from './_mailer.js';
import { isRateLimited, getIP } from './_ratelimit.js';
import { isOriginAllowed } from './_origin.js';
import { isValidEmail, isValidPaymentId, sanitizeStr } from './_validate.js';

async function verifyRazorpayPayment(paymentId) {
  const KEY_ID     = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY_ID || !KEY_SECRET) return false;

  try {
    const credentials = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    // Only accept payments that are fully captured
    return data.status === 'captured';
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Forbidden' });
  if (isRateLimited(`${getIP(req)}:send-ticket`, 5, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { email, name, phone = '', items = [], paymentId = '', total = 0 } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Require a real, captured Razorpay payment ID — blocks free-ticket generation
  if (!isValidPaymentId(paymentId)) {
    return res.status(400).json({ error: 'Valid payment ID required' });
  }

  const captured = await verifyRazorpayPayment(paymentId);
  if (!captured) {
    console.warn(`send-ticket: unverified payment attempt — paymentId=${paymentId} email=${email}`);
    return res.status(402).json({ error: 'Payment not verified' });
  }

  try {
    const result = await dispatchTickets({
      email:     sanitizeStr(email, 254),
      name:      sanitizeStr(name, 100),
      phone:     sanitizeStr(phone, 20),
      items,
      paymentId,
      total,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('send-ticket error:', err);
    return res.status(500).json({ sent: false, error: 'Internal server error' });
  }
}
