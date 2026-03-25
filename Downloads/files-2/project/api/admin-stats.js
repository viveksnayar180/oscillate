import { createClient } from '@supabase/supabase-js';

const ADMIN_PIN = process.env.ADMIN_PIN;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin } = req.body ?? {};
  if (!ADMIN_PIN || pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const supabase = getSupabase();

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate revenue per event
  const byEvent = {};
  for (const t of tickets) {
    const key = t.event_name || 'Unknown';
    if (!byEvent[key]) byEvent[key] = { count: 0, revenue: 0, tiers: {}, scanned: 0 };
    byEvent[key].count++;
    byEvent[key].revenue += t.amount || 0;
    if (t.is_scanned) byEvent[key].scanned++;
    const tier = t.tier || t.event_detail || 'STANDARD';
    byEvent[key].tiers[tier] = (byEvent[key].tiers[tier] || 0) + 1;
  }

  const totalRevenue = tickets.reduce((s, t) => s + (t.amount || 0), 0);
  const totalScanned = tickets.filter(t => t.is_scanned).length;

  return res.status(200).json({
    tickets,
    summary: {
      totalRevenue,
      totalTickets: tickets.length,
      totalScanned,
      byEvent,
    },
  });
}
