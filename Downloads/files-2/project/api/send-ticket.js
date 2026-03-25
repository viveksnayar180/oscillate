// Serverless function — sends ticket email for UPI flow (no server-side payment verification)
// For Razorpay: ticket email is sent directly from razorpay-verify.js after sig check

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
  if (isRateLimited(`${getIP(req)}:send-ticket`, 5, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { email, name, phone = '', items = [], paymentId = '', total = 0 } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const result = await dispatchTickets({ email, name, phone, items, paymentId, total });
    return res.status(200).json(result);
  } catch (err) {
    console.error('send-ticket error:', err);
    return res.status(500).json({ sent: false, error: 'Internal server error' });
  }
}
