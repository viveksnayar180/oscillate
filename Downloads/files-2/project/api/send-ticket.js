// Serverless function — sends ticket email for UPI flow (no server-side payment verification)
// For Razorpay: ticket email is sent directly from razorpay-verify.js after sig check

import { dispatchTickets } from './_mailer.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, name, items = [], paymentId = '', total = 0 } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    const result = await dispatchTickets({ email, name, items, paymentId, total });
    return res.status(200).json(result);
  } catch (err) {
    console.error('send-ticket error:', err);
    return res.status(500).json({ sent: false, error: 'Internal server error' });
  }
}
