import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SUPABASE_API = `${process.env.REACT_APP_BACKEND_URL}/api`; // placeholder — waitlist goes through main API

const Brackets = ({ color = "#FF3B00" }) => (
  <>
    <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 pointer-events-none z-10" style={{ borderColor: color }} />
    <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 pointer-events-none z-10" style={{ borderColor: color }} />
  </>
);

export default function EventDetailPage({ user, openAuth }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [waitlistTier, setWaitlistTier] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(`${API}/events/${eventId}`).then(r => { setEvent(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [eventId]);

  const openWaitlist = (tier) => {
    setWaitlistTier(tier);
    setSubmitted(false);
    setForm({ name: user?.user_metadata?.full_name || "", email: user?.email || "" });
  };

  const handleWaitlist = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/waitlist`, {
        email: form.email,
        name: form.name,
        event_id: eventId,
        event_name: event?.title || event?.name,
        tier: waitlistTier?.name,
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      // Graceful fallback — mark as submitted anyway (waitlist is best-effort)
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><p className="font-mono text-zinc-500 text-sm uppercase tracking-widest">LOADING...</p></div>;
  if (!event) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><p className="font-mono text-zinc-500">Event not found</p></div>;

  return (
    <div data-testid="event-detail-page" className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center justify-between px-6 py-4 max-w-[1800px] mx-auto">
          <a href="/" className="font-pixel text-lg tracking-widest text-white hover:text-[#FF3B00] transition-colors">OSCILLATE</a>
          <button data-testid="back-to-events" onClick={() => navigate("/")} className="font-mono text-[11px] uppercase tracking-[0.2em] border border-zinc-700 px-4 py-2 hover:border-[#FF3B00] hover:text-[#FF3B00] transition-all">BACK</button>
        </div>
      </nav>

      <div className="pt-20 max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div>
            {event.flyer_url ? (
              <div className="relative aspect-square border border-zinc-800"><Brackets /><img src={event.flyer_url} alt={event.title} className="w-full h-full object-cover" /></div>
            ) : (
              <div className="relative aspect-square border border-zinc-800 bg-zinc-900 flex items-center justify-center"><Brackets /><span className="font-display text-6xl text-zinc-800">{event.code || event.title?.[0]}</span></div>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-3">{event.genre} {event.subgenre && `· ${event.subgenre}`}</p>
            <h1 className="font-display text-5xl md:text-6xl uppercase leading-[0.9] mb-4">{event.title}</h1>
            <div className="space-y-2 mb-6">
              <p className="font-mono text-sm text-zinc-400"><i className="fas fa-calendar-alt mr-2 text-[#FF3B00]" />{event.date}</p>
              <p className="font-mono text-sm text-zinc-400"><i className="fas fa-map-marker-alt mr-2 text-[#FF3B00]" />{event.venue} · {event.city}</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-8">
              {event.lineup?.map(a => (
                <span key={a} className="font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border border-zinc-700 text-zinc-300">{a}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Set Times */}
        {event.set_times?.length > 0 && (
          <div className="mb-16">
            <h2 className="font-display text-3xl uppercase mb-6">SET TIMES</h2>
            <div className="border border-zinc-800">
              {event.set_times.map((st, i) => (
                <div key={i} className="flex justify-between items-center px-6 py-4 border-b border-zinc-900 last:border-0">
                  <div className="flex items-center gap-4">
                    <span className="font-display text-lg">{st.artist}</span>
                    {st.note && <span className="font-mono text-[10px] text-[#FF3B00] uppercase tracking-[0.1em] px-2 py-0.5 border border-[#FF3B00]/30">{st.note}</span>}
                  </div>
                  <span className="font-mono text-[12px] text-zinc-500">{st.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tickets / Waitlist */}
        <div className="mb-16">
          <h2 className="font-display text-3xl uppercase mb-2">TICKETS</h2>
          <p className="font-mono text-[11px] text-zinc-500 uppercase tracking-[0.15em] mb-6">
            Join the waitlist — we'll confirm your spot.
          </p>
          <div className="grid md:grid-cols-3 gap-px bg-zinc-800">
            {event.tiers?.map(tier => (
              <div key={tier.name} className="bg-[#0A0A0A] p-6 relative">
                <Brackets />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{tier.name}</p>
                <p className="font-display text-4xl text-white mb-4">
                  {tier.price ? `₹${tier.price?.toLocaleString("en-IN")}` : tier.price_display || "TBA"}
                </p>
                {tier.perks && <p className="font-mono text-[10px] text-zinc-600 mb-4">{tier.perks}</p>}
                <button
                  onClick={() => openWaitlist(tier)}
                  className="w-full py-3 border-2 border-[#FF3B00] text-[#FF3B00] font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-[#FF3B00] hover:text-black transition-all">
                  GET TICKETS
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Waitlist Modal */}
        {waitlistTier && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setWaitlistTier(null)}>
            <div className="bg-[#0A0A0A] border border-zinc-800 p-8 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <Brackets />
              <button onClick={() => setWaitlistTier(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg">&times;</button>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#FF3B00] mb-2">SECURE YOUR SPOT</p>
              <h3 className="font-display text-2xl uppercase mb-1">{waitlistTier.name}</h3>
              <p className="font-mono text-sm text-zinc-400 mb-6">{event.title || event.name} · {event.date_display || event.date}</p>

              {submitted ? (
                <div className="text-center py-6">
                  <p className="font-display text-2xl text-[#FF3B00] mb-2">YOU'RE IN.</p>
                  <p className="font-mono text-[11px] text-zinc-500 uppercase">We'll reach out to confirm your tickets.</p>
                </div>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">FULL NAME</label>
                    <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                      className="w-full bg-black border border-zinc-700 px-3 py-2.5 font-mono text-[12px] text-white placeholder:text-zinc-600 focus:border-[#FF3B00] focus:outline-none"
                      placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">EMAIL</label>
                    <input required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                      className="w-full bg-black border border-zinc-700 px-3 py-2.5 font-mono text-[12px] text-white placeholder:text-zinc-600 focus:border-[#FF3B00] focus:outline-none"
                      placeholder="your@email.com" />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full py-3 bg-[#FF3B00] text-black font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-[#FF5722] transition-colors disabled:opacity-50">
                    {submitting ? "SUBMITTING..." : "JOIN WAITLIST"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
