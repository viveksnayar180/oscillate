import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

export default function MyTickets({ user, onSetPage }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user || !supabase) { setLoading(false); return; }

    supabase
      .from('tickets')
      .select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setTickets(data || []);
        setLoading(false);
      });
  }, [user]);

  if (!supabase) {
    return (
      <div className="page">
        <div className="section" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontFamily: 'var(--font-head)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3 }}>
            SUPABASE NOT CONFIGURED
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 12 }}>
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="section">
        <div className="section-header">
          <p className="section-eyebrow">YOUR ACCOUNT</p>
          <h2 className="section-title">MY TICKETS</h2>
          <div className="section-divider" />
        </div>

        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 32, textAlign: 'center' }}>
          Signed in as <span style={{ color: 'var(--cyan)' }}>{user?.email}</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--font-head)', fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.2)' }}>
            LOADING...
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.15 }}>◈</div>
            <p style={{ fontFamily: 'var(--font-head)', fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
              NO TICKETS YET
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.2)', marginBottom: 28 }}>
              Book tickets for an upcoming event to see them here.
            </p>
            <button className="btn-confirm" style={{ width: 'auto', padding: '12px 32px' }} onClick={() => onSetPage('events')}>
              SEE EVENTS
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, margin: '0 auto' }}>
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                style={{
                  background: '#0a0a0a',
                  border: expanded === ticket.id ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
              >
                {/* Ticket header */}
                <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, color: '#fff', letterSpacing: 2, marginBottom: 4 }}>
                      {ticket.event_name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {ticket.event_detail}
                    </div>
                    <div style={{ fontFamily: 'var(--font-head)', fontSize: 8, color: ticket.is_scanned ? 'rgba(255,100,100,0.7)' : 'rgba(0,229,255,0.6)', letterSpacing: 2, marginTop: 6 }}>
                      {ticket.is_scanned ? '✓ USED' : '◈ VALID'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
                    {expanded === ticket.id ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded QR */}
                {expanded === ticket.id && (
                  <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ background: '#fff', padding: 16, marginTop: 20, borderRadius: 4, border: '3px solid var(--cyan)' }}>
                      <QRCodeSVG
                        value={ticket.qr_data}
                        size={180}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="H"
                      />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>TICKET ID</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--cyan)', letterSpacing: 1 }}>
                        {ticket.ticket_id}
                      </div>
                    </div>
                    {ticket.is_scanned && ticket.scanned_at && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,100,100,0.6)', textAlign: 'center' }}>
                        Scanned: {new Date(ticket.scanned_at).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
