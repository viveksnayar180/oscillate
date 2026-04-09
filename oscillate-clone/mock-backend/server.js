// Oscillate mock backend — in-memory state, QR generation, full S1/S2 flow
const http = require('http');
const QRCode = require('qrcode');

const POS_PINS = {
  '9969': { role: 'master', label: 'MASTER POS' },
  '1812': { role: 'god',    label: 'GOD MODE' },
  '0051': { role: 's1',     label: 'STATION 1 · GATE' },
  '0052': { role: 's2',     label: 'STATION 2 · COVER CHARGE' },
};

// In-memory state — resets on restart
const tickets = {};       // ticket_id → ticket object
const coverCharges = [];  // cover charge records

const EVENTS = [
  {
    id: 'uberkikz-2026',
    title: 'ÜBERKIKZ × OSCILLATE',
    date: 'SAT APR 11, 2026',
    date_iso: '2026-04-11',
    venue: 'TBA, Bengaluru',
    city: 'Bengaluru',
    time: '5:00 PM ONWARDS',
    genre: 'Techno',
    is_featured: true,
    description: 'ÜBERKIKZ headlines Oscillate.',
    tiers: [
      { name: 'EARLY BIRD', price: 569,  capacity: 100, sold: 73 },
      { name: 'STANDARD',   price: 799,  capacity: 300, sold: 141 },
      { name: 'PREMIUM',    price: 1299, capacity: 50,  sold: 31 },
    ],
  },
  {
    id: 'signal-002',
    title: 'SIGNAL 002',
    date: 'SUN MAY 17, 2026',
    date_iso: '2026-05-17',
    venue: 'Subterranean, Bengaluru',
    city: 'Bengaluru',
    genre: 'Dark Techno',
    is_featured: false,
    tiers: [
      { name: 'STANDARD', price: 599, capacity: 200, sold: 44 },
    ],
  },
];

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

function buildWhatsappUrl(phone, ticket_id, event_name, tier, buyer_name) {
  const ph = (phone || '').replace(/\D/g, '');
  if (!ph) return null;
  const msg = encodeURIComponent(
    `OSCILLATE TICKET CONFIRMED ✓\n\nTicket ID: ${ticket_id}\nEvent: ${event_name}\nTier: ${tier}\nName: ${buyer_name}\n\nShow this QR code at the gate.`
  );
  return `https://wa.me/${ph}?text=${msg}`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { json(res, 200, {}); return; }

  const url = req.url.split('?')[0];

  // ─── AUTH ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/pos/auth') {
    const { pin } = await body(req);
    const cfg = POS_PINS[pin];
    if (!cfg) { json(res, 401, { detail: 'INVALID PIN' }); return; }
    json(res, 200, { authenticated: true, role: cfg.role, label: cfg.label, pin });
    return;
  }

  // ─── ISSUE TICKET ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/pos/issue-ticket') {
    const b = await body(req);
    const ticket_id = `OSC-${Date.now()}`;

    let qr_b64 = null;
    try {
      const dataUrl = await QRCode.toDataURL(ticket_id, { width: 320, margin: 2, color: { dark: '#000', light: '#fff' } });
      qr_b64 = dataUrl.replace('data:image/png;base64,', '');
    } catch (e) { console.error('QR gen error:', e); }

    const buyer_name  = b.buyer_name  || '';
    const buyer_phone = b.buyer_phone || '';
    const event_name  = b.event_name  || '';
    const tier        = b.ticket_type || b.tier || '';
    const amount      = b.ticket_price ?? b.amount ?? 0;

    const ticket = {
      id: ticket_id,
      buyer_name,
      buyer_phone,
      event_name,
      event_id:       b.event_id || '',
      tier,
      amount,
      payment_method: b.payment_method || 'cash',
      checked_in:     false,
      cover_charged:  false,
      issued_at:      new Date().toISOString(),
      checked_in_at:  null,
      qr_b64,
    };
    tickets[ticket_id] = ticket;

    const whatsapp_url = buildWhatsappUrl(buyer_phone, ticket_id, event_name, tier, buyer_name);

    json(res, 200, {
      ok: true,
      id: ticket_id,
      ticket_id,
      qr_code:       qr_b64,
      whatsapp_url,
      buyer_name,
      buyer_phone,
      event_name,
      tier,
      amount,
      payment_method: ticket.payment_method,
    });
    return;
  }

  // ─── SCAN / CHECK-IN (S1) ────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/pos/scan') {
    const { ticket_id } = await body(req);
    const tid    = (ticket_id || '').trim();
    const ticket = tickets[tid];

    if (!ticket) {
      json(res, 404, { status: 'error', message: 'TICKET NOT FOUND' });
      return;
    }
    if (ticket.checked_in) {
      json(res, 200, {
        status: 'already_checked_in', ok: false,
        ticket_id: tid, buyer_name: ticket.buyer_name, buyer_phone: ticket.buyer_phone,
        event: ticket.event_name, tier: ticket.tier,
        checked_in_at: ticket.checked_in_at,
        ticket: { buyer_name: ticket.buyer_name, event_name: ticket.event_name, ticket_type: ticket.tier },
        message: 'ALREADY CHECKED IN',
      });
      return;
    }

    tickets[tid].checked_in     = true;
    tickets[tid].checked_in_at  = new Date().toISOString();

    json(res, 200, {
      status: 'checked_in', ok: true,
      ticket_id: tid, buyer_name: ticket.buyer_name, buyer_phone: ticket.buyer_phone,
      event: ticket.event_name, tier: ticket.tier,
      message: 'VALID — LET THEM IN',
      ticket: { buyer_name: ticket.buyer_name, event_name: ticket.event_name, ticket_type: ticket.tier },
    });
    return;
  }

  // ─── TICKET LOOKUP (S2 scan pre-fill) ────────────────────────────────────────
  if (req.method === 'GET' && url.startsWith('/api/pos/ticket-info')) {
    const params    = Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || ''));
    const tid       = (params.ticket_id || '').trim();
    const ticket    = tickets[tid];
    if (!ticket) { json(res, 404, { detail: 'Ticket not found' }); return; }
    json(res, 200, {
      ticket_id:     ticket.id,
      buyer_name:    ticket.buyer_name,
      buyer_phone:   ticket.buyer_phone,
      event_name:    ticket.event_name,
      event_id:      ticket.event_id,
      tier:          ticket.tier,
      amount:        ticket.amount,
      checked_in:    ticket.checked_in,
      cover_charged: ticket.cover_charged,
      checked_in_at: ticket.checked_in_at,
    });
    return;
  }

  // ─── S2 QUEUE (checked-in, not yet cover-charged) ────────────────────────────
  if (req.method === 'GET' && url === '/api/pos/s2-queue') {
    const queue = Object.values(tickets)
      .filter(t => t.checked_in && !t.cover_charged)
      .sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at))
      .map(t => ({
        ticket_id:    t.id,
        buyer_name:   t.buyer_name,
        buyer_phone:  t.buyer_phone,
        event_name:   t.event_name,
        event_id:     t.event_id,
        tier:         t.tier,
        amount:       t.amount,
        checked_in_at: t.checked_in_at,
      }));
    json(res, 200, { queue });
    return;
  }

  // ─── COVER CHARGE (S2) ───────────────────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/pos/cover-charge') {
    const b = await body(req);
    if (b.ticket_id && tickets[b.ticket_id]) {
      tickets[b.ticket_id].cover_charged = true;
    }
    const record = {
      id:             `CC-${Date.now()}`,
      ticket_id:      b.ticket_id || null,
      guest_name:     b.guest_name || b.buyer_name || '',
      amount:         b.amount || 0,
      payment_method: b.payment_method || 'cash',
      event_id:       b.event_id || '',
      charged_at:     new Date().toISOString(),
    };
    coverCharges.push(record);
    json(res, 200, { ok: true, ticket_id: b.ticket_id, guest_name: record.guest_name, amount: record.amount });
    return;
  }

  // ─── COVER DATA ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/api/pos/cover-data') {
    const total_revenue = coverCharges.reduce((s, r) => s + (r.amount || 0), 0);
    json(res, 200, { records: [...coverCharges].reverse(), count: coverCharges.length, total_revenue });
    return;
  }

  // ─── DOOR DATA ───────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/api/pos/door-data') {
    const all       = Object.values(tickets);
    const byTier    = {};
    all.forEach(t => {
      if (!byTier[t.tier]) byTier[t.tier] = { total: 0, scanned: 0 };
      byTier[t.tier].total++;
      if (t.checked_in) byTier[t.tier].scanned++;
    });
    json(res, 200, {
      total:          all.length,
      checked_in:     all.filter(t => t.checked_in).length,
      ticket_revenue: all.reduce((s, t) => s + (t.amount || 0), 0),
      cover_revenue:  coverCharges.reduce((s, r) => s + (r.amount || 0), 0),
      by_tier:        byTier,
      tickets:        all.map(t => ({ id: t.id, buyer_name: t.buyer_name, ticket_type: t.tier, payment_method: t.payment_method, amount: t.amount, issued_at: t.issued_at })),
    });
    return;
  }

  // ─── PROMOTER SALES ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/api/pos/promoter-sales') {
    json(res, 200, { sales: [], total_revenue: 0 });
    return;
  }

  // ─── ANALYTICS ───────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/api/analytics') {
    const all = Object.values(tickets);
    json(res, 200, {
      total_tickets:   all.length,
      total_revenue:   all.reduce((s, t) => s + (t.amount || 0), 0),
      total_checked_in: all.filter(t => t.checked_in).length,
      cover_revenue:   coverCharges.reduce((s, r) => s + (r.amount || 0), 0),
      cover_count:     coverCharges.length,
      revenue_by_method: [],
      revenue_by_event:  [],
      source_breakdown:  {},
      promoter_leaderboard: [],
    });
    return;
  }

  // ─── EVENTS ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/api/events') { json(res, 200, EVENTS); return; }
  if (req.method === 'GET' && url === '/api/events/featured/next') { json(res, 200, EVENTS[0]); return; }
  if (req.method === 'GET' && url.startsWith('/api/events/')) {
    const id = url.replace('/api/events/', '');
    const ev = EVENTS.find(e => e.id === id);
    if (!ev) { json(res, 404, { detail: 'Not found' }); return; }
    json(res, 200, ev); return;
  }

  // ─── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/api/artists') {
    json(res, 200, [{ id: 'uberkikz', name: 'ÜBERKIKZ', genre: 'Techno', city: 'Berlin', order: 1 }, { id: 'uphoria', name: 'UPHORIA', genre: 'Techno', city: 'Bengaluru', order: 2 }]); return;
  }
  if (req.method === 'GET' && url === '/api/stats') {
    json(res, 200, { events_hosted: 18, artists_platformed: 40, community: '5K+', cities: 3, tickets_sold: Object.keys(tickets).length }); return;
  }
  if (req.method === 'GET'  && url === '/api/merch')    { json(res, 200, []); return; }
  if (req.method === 'GET'  && url === '/api/gallery')  { json(res, 200, []); return; }
  if (req.method === 'GET'  && url === '/api/search')   { json(res, 200, { events: [], artists: [] }); return; }
  if (req.method === 'POST' && url === '/api/newsletter') { json(res, 200, { message: 'Subscribed' }); return; }
  if (req.method === 'POST' && url === '/api/checkout/create') { json(res, 200, { session_id: `mock_${Date.now()}`, url: '#' }); return; }

  json(res, 404, { detail: 'Not found' });
});

const PORT = 8001;
server.listen(PORT, () => console.log(`🎛  Mock backend on http://localhost:${PORT}`));
