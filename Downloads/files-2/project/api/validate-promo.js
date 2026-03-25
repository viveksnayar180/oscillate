import { createClient } from '@supabase/supabase-js';
import { isRateLimited, getIP } from './_ratelimit.js';
import { isOriginAllowed } from './_origin.js';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Forbidden' });
  if (isRateLimited(`${getIP(req)}:validate-promo`, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { code, total } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'Code required' });
  if (!total || total <= 0) return res.status(400).json({ error: 'Invalid total' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Code not found or inactive' });
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This code has expired' });
  }

  // Check max uses
  if (data.max_uses != null && data.uses >= data.max_uses) {
    return res.status(400).json({ error: 'Code has reached maximum uses' });
  }

  // Calculate discount amount (in rupees)
  let discount = 0;
  if (data.discount_type === 'percent') {
    discount = Math.round((total * data.discount_value) / 100);
  } else if (data.discount_type === 'flat') {
    discount = Math.min(data.discount_value, total);
  }

  // Increment usage counter (non-blocking, non-fatal)
  supabase
    .from('promo_codes')
    .update({ uses: (data.uses || 0) + 1 })
    .eq('code', data.code)
    .then(({ error: e }) => { if (e) console.warn('promo uses update:', e.message); });

  return res.status(200).json({
    valid: true,
    code: data.code,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    discount,
    final_total: total - discount,
  });
}
