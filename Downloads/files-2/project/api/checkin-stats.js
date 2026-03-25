// PIN-gated endpoint — returns total tickets issued vs checked-in count
// Used by the check-in page to show live capacity counter

import { createClient } from '@supabase/supabase-js';

const CHECKIN_PIN = process.env.VENUE_CHECKIN_PIN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin } = req.body ?? {};
  if (!CHECKIN_PIN || pin !== CHECKIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const [{ count: total }, { count: scanned }] = await Promise.all([
    supabase.from('tickets').select('*', { count: 'exact', head: true }),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('is_scanned', true),
  ]);

  return res.status(200).json({ total: total || 0, scanned: scanned || 0 });
}
