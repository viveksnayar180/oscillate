import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

const EVENT_CAL = {
  'ÜBERKIKZ × OSCILLATE': { iso: '2026-04-11T17:00:00+05:30', durationH: 8, venue: 'TBA, Bengaluru' },
  'SIGNAL 002':            { iso: '2026-05-17T22:00:00+05:30', durationH: 8, venue: 'Subterranean, Bengaluru' },
  'STELLAR MAP':           { iso: '2026-06-21T04:00:00+05:30', durationH: 6, venue: 'Open Air, Goa' },
};

function toICSDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function downloadICS(ticket) {
  const ev = EVENT_CAL[ticket.event_name];
  if (!ev) return;
  const start = new Date(ev.iso);
  const end   = new Date(start.getTime() + ev.durationH * 3600 * 1000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OSCILLATE//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ticket.ticket_id}@oscillate.in`,
    `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
    `SUMMARY:${ticket.event_name}`, `LOCATION:${ev.venue}`,
    `DESCRIPTION:Ticket ID: ${ticket.ticket_id}\\nTier: ${ticket.event_detail || ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `oscillate-${(ticket.event_name || 'event').toLowerCase().replace(/\s+/g, '-')}.ics`;
  a.click(); URL.revokeObjectURL(url);
}

export default function MyTickets({ user, onSetPage }) {
  const [tickets, setTickets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user || !supabase) { setLoading(false); return; }
    supabase.from('tickets').select('*')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => { if (!error) setTickets(data || []); setLoading(false); });
  }, [user]);

  if (!supabase) {
    return (
      <div className="page">
        <div className="section" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p className="section-eyebrow">SUPABASE NOT CONFIGURED</p>
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

        <p className="mytickets-meta">
          SIGNED IN AS <span style={{ color: 'var(--cyan)' }}>{user?.email}</span>
        </p>

        {loading ? (
          <p className="mytickets-loading">LOADING...</p>
        ) : tickets.length === 0 ? (
          <div className="mytickets-empty">
            <div className="mytickets-empty-icon">◈</div>
            <p className="mytickets-empty-title">NO TICKETS YET</p>
            <p className="mytickets-empty-sub">Book tickets for an upcoming event to see them here.</p>
            <button className="hero-cta-primary" style={{ width: 'auto', padding: '12px 32px' }} onClick={() => onSetPage('events')}>
              SEE EVENTS
            </button>
          </div>
        ) : (
          <div className="mytickets-list">
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                className={`mytickets-card corner-box${expanded === ticket.id ? ' mytickets-card--open' : ''}`}
                onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
              >
                <div className="mytickets-card-row">
                  <div>
                    <div className="mytickets-event">{ticket.event_name}</div>
                    <div className="mytickets-tier">{ticket.event_detail}</div>
                    <div className={`mytickets-status${ticket.is_scanned ? ' mytickets-status--used' : ''}`}>
                      {ticket.is_scanned ? '✓ USED' : '◈ VALID'}
                    </div>
                  </div>
                  <div className="mytickets-chevron">{expanded === ticket.id ? '▲' : '▼'}</div>
                </div>

                {expanded === ticket.id && (
                  <div className="mytickets-expanded" onClick={e => e.stopPropagation()}>
                    <div className="mytickets-qr-wrap">
                      <QRCodeSVG value={ticket.qr_data} size={180} bgColor="#ffffff" fgColor="#000000" level="H" />
                    </div>
                    <div className="mytickets-id-block">
                      <div className="mytickets-id-label">TICKET ID</div>
                      <div className="mytickets-id-value">{ticket.ticket_id}</div>
                    </div>
                    {ticket.is_scanned && ticket.scanned_at && (
                      <div className="mytickets-scanned-at">
                        SCANNED {new Date(ticket.scanned_at).toLocaleString('en-IN')}
                      </div>
                    )}
                    {EVENT_CAL[ticket.event_name] && !ticket.is_scanned && (
                      <button className="mytickets-cal-btn" onClick={() => downloadICS(ticket)}>
                        + ADD TO CALENDAR
                      </button>
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
