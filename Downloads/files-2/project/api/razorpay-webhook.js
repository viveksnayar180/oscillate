// Razorpay webhook handler — catches payment.captured as safety net
// Vercel auto-parses JSON body, so we re-stringify for HMAC verification.
// Set RAZORPAY_WEBHOOK_SECRET in env (Razorpay Dashboard → Webhooks → Secret).

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set — webhook cannot be validated');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Verify Razorpay HMAC-SHA256 signature
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
  }

  // Vercel parses the body as JSON; re-stringify for deterministic HMAC input
  const rawBody = JSON.stringify(req.body);
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    console.warn('Razorpay webhook: signature mismatch — possible replay or misconfiguration');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const eventType = req.body?.event;

  // Only act on payment.captured
  if (eventType !== 'payment.captured') {
    return res.status(200).json({ ok: true, note: `Event "${eventType}" acknowledged but not handled` });
  }

  const payment = req.body?.payload?.payment?.entity;
  if (!payment?.id) {
    return res.status(400).json({ error: 'Missing payment entity in webhook payload' });
  }

  const paymentId = payment.id;
  const email     = payment.email || '';
  const contact   = payment.contact || '';
  const amount    = payment.amount ? payment.amount / 100 : 0; // paise → rupees

  console.log(`Webhook payment.captured: ${paymentId} | ₹${amount} | ${email || contact}`);

  // Safety net: check if tickets were already issued for this payment
  const supabase = getSupabase();
  if (supabase && paymentId) {
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('payment_id', paymentId);

    if (count > 0) {
      // Tickets exist — razorpay-verify.js already handled this payment
      console.log(`Webhook: tickets already exist for ${paymentId} — no action needed`);
      return res.status(200).json({ ok: true, note: 'Tickets already issued' });
    }

    // Tickets NOT found — payment was captured but razorpay-verify.js may have been dropped
    // Log critical alert for manual intervention (cart data is not available in the webhook)
    console.error(
      `⚠ WEBHOOK ALERT: payment ${paymentId} captured (₹${amount}) for ${email || contact} ` +
      `but NO tickets found in DB. razorpay-verify.js may have failed. Manual issuance required.`
    );

    // Store a flag row in Supabase for admin visibility (non-fatal if this fails)
    await supabase
      .from('webhook_alerts')
      .insert({
        payment_id: paymentId,
        email: email || contact,
        amount,
        event: 'payment.captured',
        resolved: false,
        created_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.warn('webhook_alerts insert failed (non-fatal):', error.message);
      });
  }

  // Always return 200 to acknowledge receipt (Razorpay retries on non-2xx)
  return res.status(200).json({ ok: true });
}
