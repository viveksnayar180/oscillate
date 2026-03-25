import { useState } from 'react';

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontFamily: 'var(--font-head)',
  fontSize: 14,
  letterSpacing: 3,
  padding: '12px 16px',
  marginBottom: 12,
  boxSizing: 'border-box',
  outline: 'none',
  textAlign: 'center',
  width: '100%',
};

export default function Admin() {
  const [pin, setPin]         = useState('');
  const [authed, setAuthed]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [data, setData]       = useState(null);
  const [search, setSearch]   = useState('');
  const [pinVal, setPinVal]   = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(1);

  const PAGE_SIZE = 100;

  async function fetchStats(p, pg = 1) {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p, page: pg, pageSize: PAGE_SIZE }),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error || 'Access denied'); setLoading(false); return; }
      setData(json);
      setPage(pg);
      setPinVal(p);
      setAuthed(true);
    } catch (e) {
      setError('Connection error');
    }
    setLoading(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    fetchStats(pin, 1);
  }

  function exportCSV() {
    const tickets = data?.tickets ?? [];
    if (!tickets.length) return;
    const cols = ['ticket_id', 'customer_name', 'customer_email', 'event_name', 'tier', 'amount', 'payment_id', 'created_at', 'is_scanned'];
    const rows = tickets.map(t =>
      cols.map(c => `"${(t[c] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oscillate-attendees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── PIN Gate ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20,
      }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 6,
            color: 'var(--cyan)', marginBottom: 8,
          }}>
            OSCILLATE
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: 4,
            color: 'rgba(255,255,255,0.3)', marginBottom: 40,
          }}>
            ADMIN DASHBOARD
          </div>
          <input
            type="password"
            placeholder="ENTER PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            style={inputStyle}
          />
          {error && (
            <p style={{ color: 'rgba(255,80,80,0.9)', fontFamily: 'var(--font-ui)', fontSize: 11, marginBottom: 10 }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', background: 'var(--cyan)', color: '#000', border: 'none',
            fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 4, padding: '13px 0',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'LOADING...' : 'ENTER'}
          </button>
        </form>
      </section>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────
  const tickets    = data?.tickets ?? [];
  const summary    = data?.summary ?? {};
  const byEvent    = summary.byEvent ?? {};
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  const filtered = tickets.filter(t => {
    const matchSearch = !search.trim() ||
      [t.customer_email, t.customer_name, t.event_name, t.payment_id, t.tier, t.event_detail]
        .some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const created = t.created_at ? new Date(t.created_at) : null;
    const matchFrom = !fromDate || (created && created >= new Date(fromDate + 'T00:00:00'));
    const matchTo   = !toDate   || (created && created <= new Date(toDate   + 'T23:59:59'));
    return matchSearch && matchFrom && matchTo;
  });

  const dateFiltered = fromDate || toDate;
  const filteredRevenue = filtered.reduce((s, t) => s + (t.amount || 0), 0);
  const filteredScanned = filtered.filter(t => t.is_scanned).length;

  const statCard = (val, lbl) => (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      padding: '20px 24px', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, color: 'var(--cyan)', letterSpacing: 2 }}>{val}</div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{lbl}</div>
    </div>
  );

  const th = (label) => (
    <th key={label} style={{
      padding: '8px 12px', textAlign: 'left',
      color: 'rgba(255,255,255,0.3)', letterSpacing: 2,
      fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 400,
    }}>{label}</th>
  );

  return (
    <section style={{ padding: '100px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, letterSpacing: 6, color: 'var(--cyan)' }}>
            ADMIN DASHBOARD
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: 2 }}>
            OSCILLATE COLLECTIVE
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fetchStats(pinVal, 1)} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 3,
            padding: '8px 16px', cursor: 'pointer',
          }}>↻ REFRESH</button>
          <button onClick={exportCSV} disabled={!tickets.length} style={{
            background: 'var(--cyan)', border: 'none', color: '#000',
            fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 3,
            padding: '8px 16px', cursor: tickets.length ? 'pointer' : 'not-allowed',
            opacity: tickets.length ? 1 : 0.4,
          }}>↓ EXPORT CSV</button>
        </div>
      </div>

      {/* Date range filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.25)', marginRight: 4 }}>
          DATE RANGE
        </div>
        {[
          { label: 'FROM', val: fromDate, set: setFromDate },
          { label: 'TO',   val: toDate,   set: setToDate },
        ].map(({ label, val, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-head)', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>{label}</span>
            <input
              type="date"
              value={val}
              onChange={e => set(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: val ? '#fff' : 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)', fontSize: 11,
                padding: '6px 10px', outline: 'none', colorScheme: 'dark',
              }}
            />
          </div>
        ))}
        {dateFiltered && (
          <button onClick={() => { setFromDate(''); setToDate(''); }} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-head)', fontSize: 8,
            letterSpacing: 2, padding: '6px 12px', cursor: 'pointer',
          }}>✕ CLEAR</button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
        {statCard(`₹${(dateFiltered ? filteredRevenue : summary.totalRevenue || 0).toLocaleString('en-IN')}`, dateFiltered ? 'REVENUE (FILTERED)' : 'TOTAL REVENUE')}
        {statCard(dateFiltered ? filtered.length : summary.totalTickets || 0, dateFiltered ? 'TICKETS (FILTERED)' : 'TICKETS SOLD')}
        {statCard(dateFiltered ? filteredScanned : summary.totalScanned || 0, 'CHECKED IN')}
        {statCard(Object.keys(byEvent).length, 'EVENTS')}
      </div>

      {/* Per-event breakdown */}
      {Object.keys(byEvent).length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>
            BY EVENT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(byEvent).map(([name, stats]) => (
              <div key={name} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>{name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(stats.tiers).map(([tier, count]) => (
                      <span key={tier} style={{
                        fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.5)',
                        background: 'rgba(255,255,255,0.05)', padding: '3px 10px', letterSpacing: 1,
                      }}>{tier}: {count}</span>
                    ))}
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: 10, color: '#4ade80',
                      background: 'rgba(74,222,128,0.08)', padding: '3px 10px', letterSpacing: 1,
                    }}>✓ {stats.scanned} SCANNED</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, color: 'var(--cyan)' }}>
                    {stats.revenue > 0 ? `₹${stats.revenue.toLocaleString('en-IN')}` : '—'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    {stats.count} ticket{stats.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendee list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: 4, color: 'rgba(255,255,255,0.25)' }}>
            ATTENDEES ({search ? `${filtered.length} of ${tickets.length} on page` : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`})
          </div>
          <input
            type="text"
            placeholder="Search name / email / payment ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 11, padding: '8px 14px',
              width: 300, maxWidth: '100%', outline: 'none',
            }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['NAME', 'EMAIL', 'EVENT', 'TIER', 'AMOUNT', 'PAYMENT ID', 'DATE', 'STATUS'].map(h => th(h))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.ticket_id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                    {t.customer_name || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {t.customer_email}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {t.event_name || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-head)', fontSize: 10, color: 'var(--cyan)', letterSpacing: 1 }}>
                    {t.tier || t.event_detail || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                    {t.amount ? `₹${Number(t.amount).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {t.payment_id ? t.payment_id.slice(-10) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {t.is_scanned ? (
                      <span style={{ fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2, color: '#4ade80' }}>✓ IN</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{
                    padding: '60px 0', textAlign: 'center',
                    fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.2)',
                    letterSpacing: 2,
                  }}>
                    {tickets.length === 0 ? 'NO TICKETS SOLD YET' : 'NO RESULTS'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
            <button
              disabled={page <= 1 || loading}
              onClick={() => fetchStats(pinVal, page - 1)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: page <= 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2,
                padding: '8px 18px', cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >← PREV</button>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              PAGE {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => fetchStats(pinVal, page + 1)}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: page >= totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 2,
                padding: '8px 18px', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >NEXT →</button>
          </div>
        )}
      </div>
    </section>
  );
}
