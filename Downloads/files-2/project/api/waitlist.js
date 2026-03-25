import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, event_id, event_name, tier_name } = req.body ?? {};
  if (!email || !event_id || !tier_name) {
    return res.status(400).json({ error: 'email, event_id, and tier_name are required' });
  }

  const supabase = getSupabase();

  // Upsert into waitlist (ignore duplicate email+event+tier)
  const { error } = await supabase.from('waitlist').upsert(
    { email, event_id, event_name: event_name || '', tier_name },
    { onConflict: 'email,event_id,tier_name', ignoreDuplicates: true }
  );

  if (error) {
    console.error('Waitlist insert error:', error.message);
    return res.status(500).json({ error: 'Could not add to waitlist' });
  }

  // Send confirmation email (non-fatal)
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'tickets@oscillate.in';
  if (resendKey) {
    const resend = new Resend(resendKey);
    try {
      await resend.emails.send({
        from: `OSCILLATE <${fromEmail}>`,
        to: [email],
        subject: `OSCILLATE — You're on the waitlist · ${event_name || tier_name}`,
        html: `
          <div style="background:#000;color:#fff;font-family:monospace;padding:40px;max-width:520px;margin:0 auto;">
            <p style="font-size:22px;font-weight:900;letter-spacing:8px;margin:0 0 24px;">◈ OSCILLATE</p>
            <p style="color:#00e5ff;font-size:10px;letter-spacing:4px;margin:0 0 24px;">YOU'RE ON THE WAITLIST</p>
            <p style="font-size:14px;color:rgba(255,255,255,0.8);margin:0 0 8px;">${tier_name}</p>
            <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 32px;">${event_name || ''}</p>
            <p style="font-size:12px;color:rgba(255,255,255,0.5);line-height:1.8;margin:0 0 32px;">
              We'll email you immediately if a spot opens up.<br>
              You'll have <span style="color:#00e5ff;">24 hours</span> to complete your purchase once notified.
            </p>
            <p style="font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:2px;">OSCILLATE COLLECTIVE · BANGALORE</p>
          </div>
        `,
      });
    } catch (e) {
      console.warn('Waitlist email failed (non-fatal):', e.message);
    }
  }

  return res.status(200).json({ ok: true, added: true });
}
