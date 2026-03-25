import { createClient } from '@supabase/supabase-js';
import { isRateLimited, getIP } from './_ratelimit.js';

const ADMIN_PIN = process.env.ADMIN_PIN;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (isRateLimited(`${getIP(req)}:admin-stats`, 20, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { pin, page = 1, pageSize = 100 } = req.body ?? {};
  if (!ADMIN_PIN || pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const supabase = getSupabase();

  // Summary query — lightweight fields from all tickets for accurate aggregates
  const { data: allLight, error: summaryError } = await supabase
    .from('tickets')
    .select('event_name, tier, event_detail, amount, is_scanned');

  if (summaryError) return res.status(500).json({ error: summaryError.message });

  // Aggregate summary from full dataset
  const byEvent = {};
  for (const t of allLight || []) {
    const key = t.event_name || 'Unknown';
    if (!byEvent[key]) byEvent[key] = { count: 0, revenue: 0, tiers: {}, scanned: 0 };
    byEvent[key].count++;
    byEvent[key].revenue += t.amount || 0;
    if (t.is_scanned) byEvent[key].scanned++;
    const tier = t.tier || t.event_detail || 'STANDARD';
    byEvent[key].tiers[tier] = (byEvent[key].tiers[tier] || 0) + 1;
  }

  const totalRevenue = (allLight || []).reduce((s, t) => s + (t.amount || 0), 0);
  const totalScanned = (allLight || []).filter(t => t.is_scanned).length;
  const totalTickets = allLight?.length || 0;

  // Paginated attendee list
  const pageNum  = Math.max(1, Number(page));
  const pageSz   = Math.min(200, Math.max(1, Number(pageSize)));
  const from     = (pageNum - 1) * pageSz;
  const to       = from + pageSz - 1;

  const { data: tickets, error: listError, count: totalCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (listError) return res.status(500).json({ error: listError.message });

  return res.status(200).json({
    tickets: tickets || [],
    totalCount: totalCount || 0,
    page: pageNum,
    pageSize: pageSz,
    summary: { totalRevenue, totalTickets, totalScanned, byEvent },
  });
}
