import { useState, useEffect } from "react";
import { addEvent, getEvents, addArtist, updateArtist, deleteArtist, getArtists, getAllTickets, markTicketScanned } from "@/lib/db";
import { supabase } from "@/lib/supabase";

const inputCls = "w-full bg-black border border-zinc-700 px-3 py-2.5 font-mono text-[12px] uppercase text-white placeholder:text-zinc-600 focus:border-[#FF3B00] focus:outline-none";
const btnPrimary = "px-4 py-2.5 bg-[#FF3B00] text-black font-mono text-[11px] uppercase tracking-[0.15em] hover:bg-[#FF5722] transition-colors disabled:opacity-50";

// ─── Events Tab (add-only — immutable after creation) ─────────────────────────
const EventsTab = () => {
  const [events, setEvents] = useState([]);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    name: "", date_iso: "", date_display: "",
    venue: "TBA", city: "", description: "", tags: "",
    flyer_url: "", collab: "", num: "",
  });
  const [tiers, setTiers] = useState([{ name: "STANDARD", price: 500, perks: "", available: true }]);

  const load = async () => {
    const data = await getEvents();
    setEvents(data);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.date_iso || !form.city) {
      setMsg("Name, date, and city are required."); return;
    }
    setCreating(true); setMsg("");
    try {
      await addEvent({
        ...form,
        tags: form.tags ? form.tags.split(",").map(t => t.trim().toUpperCase()).filter(Boolean) : [],
        tiers,
        lineup: [],
      });
      setMsg("EVENT CREATED.");
      setForm({ name: "", date_iso: "", date_display: "", venue: "TBA", city: "", description: "", tags: "", flyer_url: "", collab: "", num: "" });
      setTiers([{ name: "STANDARD", price: 500, perks: "", available: true }]);
      load();
    } catch (e) {
      setMsg("ERROR: " + (e.message || "Create failed"));
    } finally { setCreating(false); }
  };

  const updateTier = (i, key, value) => {
    const n = [...tiers];
    n[i] = { ...n[i], [key]: key === "price" ? Number(value) : value };
    setTiers(n);
  };

  return (
    <div>
      {/* Add form */}
      <div className="border border-zinc-800 p-4 mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF3B00] mb-4">ADD EVENT</p>
        <p className="font-mono text-[9px] text-zinc-600 mb-4">Events cannot be edited or deleted after creation.</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            placeholder="EVENT NAME" className={inputCls} />
          <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
            placeholder="CITY" className={inputCls} />
          <input type="datetime-local" value={form.date_iso} onChange={e => setForm(f => ({...f, date_iso: e.target.value}))}
            className={inputCls} title="Date & Time" />
          <input value={form.date_display} onChange={e => setForm(f => ({...f, date_display: e.target.value}))}
            placeholder="SAT APR 11, 2026 · 5PM" className={inputCls} />
          <input value={form.venue} onChange={e => setForm(f => ({...f, venue: e.target.value}))}
            placeholder="VENUE" className={inputCls} />
          <input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))}
            placeholder="TAGS (comma separated: TECHNO, INTERNATIONAL)" className={inputCls} />
          <input value={form.flyer_url} onChange={e => setForm(f => ({...f, flyer_url: e.target.value}))}
            placeholder="FLYER URL" className={inputCls} />
          <input value={form.collab} onChange={e => setForm(f => ({...f, collab: e.target.value}))}
            placeholder="COLLAB (e.g. SPACENAUT × TECHNO AFFAIRS)" className={inputCls} />
        </div>
        <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
          placeholder="DESCRIPTION" className={inputCls + " h-16 mb-3"} />

        {/* Tiers */}
        <p className="font-mono text-[9px] uppercase text-zinc-500 mb-2">TICKET TIERS</p>
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
            <input value={t.name} onChange={e => updateTier(i, "name", e.target.value)}
              placeholder="TIER NAME" className={inputCls + " col-span-3"} />
            <input type="number" value={t.price} onChange={e => updateTier(i, "price", e.target.value)}
              placeholder="PRICE ₹" className={inputCls + " col-span-2"} />
            <input value={t.perks} onChange={e => updateTier(i, "perks", e.target.value)}
              placeholder="PERKS" className={inputCls + " col-span-5"} />
            <div className="col-span-1 flex items-center gap-1">
              <input type="checkbox" checked={t.available} onChange={e => updateTier(i, "available", e.target.checked)}
                className="accent-[#FF3B00]" id={`avail-${i}`} />
              <label htmlFor={`avail-${i}`} className="font-mono text-[8px] text-zinc-500 uppercase">ON</label>
            </div>
            <button onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
              className="col-span-1 text-red-500 text-xs font-mono">✕</button>
          </div>
        ))}
        <button onClick={() => setTiers([...tiers, { name: "", price: 0, perks: "", available: true }])}
          className="font-mono text-[10px] text-[#FF3B00] border border-[#FF3B00] px-3 py-1 mb-4 hover:bg-[#FF3B00] hover:text-black transition-all">
          + ADD TIER
        </button>

        {msg && <p className={`font-mono text-[10px] mb-3 ${msg.startsWith("ERROR") ? "text-red-500" : "text-green-400"}`}>{msg}</p>}
        <button onClick={create} disabled={creating || !form.name || !form.city} className={btnPrimary + " w-full"}>
          {creating ? "CREATING..." : "CREATE EVENT"}
        </button>
      </div>

      {/* Events list (read-only) */}
      <div className="border border-zinc-800">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-zinc-800 font-mono text-[9px] uppercase text-zinc-500">
          <div className="col-span-5">NAME</div>
          <div className="col-span-2">CITY</div>
          <div className="col-span-3">DATE</div>
          <div className="col-span-2">TIERS</div>
        </div>
        {events.map(ev => (
          <div key={ev.id} className="grid grid-cols-12 px-4 py-3 border-b border-zinc-900 font-mono text-[11px] items-center">
            <div className="col-span-5 truncate text-white">{ev.name}</div>
            <div className="col-span-2 text-zinc-400">{ev.city}</div>
            <div className="col-span-3 text-zinc-500">{ev.date_iso ? new Date(ev.date_iso).toLocaleDateString("en-IN") : ev.date_display}</div>
            <div className="col-span-2 text-zinc-500">{ev.tiers?.length || 0} tier{ev.tiers?.length !== 1 ? "s" : ""}</div>
          </div>
        ))}
        {events.length === 0 && (
          <p className="px-4 py-6 font-mono text-[11px] text-zinc-600">No events yet.</p>
        )}
      </div>
    </div>
  );
};

// ─── Artists Tab (full CRUD) ──────────────────────────────────────────────────
const ArtistsTab = () => {
  const [artists, setArtists] = useState([]);
  const [form, setForm] = useState({ name: "", role: "Resident", bio: "", location: "", photo_url: "", instagram: "", soundcloud: "", ra_link: "" });
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => setArtists(await getArtists());
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { setMsg("Name is required."); return; }
    setCreating(true); setMsg("");
    try {
      if (editingId) {
        await updateArtist(editingId, form);
        setMsg("SAVED.");
      } else {
        await addArtist(form);
        setMsg("ARTIST ADDED.");
      }
      setForm({ name: "", role: "Resident", bio: "", location: "", photo_url: "", instagram: "", soundcloud: "", ra_link: "" });
      setEditingId(null);
      load();
    } catch (e) { setMsg("ERROR: " + (e.message || "Save failed")); }
    finally { setCreating(false); }
  };

  const startEdit = (artist) => {
    setEditingId(artist.id);
    setForm({
      name: artist.name || "", role: artist.role || "Resident",
      bio: artist.bio || "", location: artist.location || "",
      photo_url: artist.photo_url || "", instagram: artist.instagram || "",
      soundcloud: artist.soundcloud || "", ra_link: artist.ra_link || "",
    });
    setMsg("");
  };

  const cancel = () => { setEditingId(null); setForm({ name: "", role: "Resident", bio: "", location: "", photo_url: "", instagram: "", soundcloud: "", ra_link: "" }); setMsg(""); };

  const del = async (id) => {
    if (!window.confirm("Delete this artist?")) return;
    try { await deleteArtist(id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="border border-zinc-800 p-4 mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF3B00] mb-4">
          {editingId ? "EDIT ARTIST" : "ADD ARTIST"}
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            placeholder="ARTIST NAME" className={inputCls} />
          <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className={inputCls}>
            <option value="Resident">RESIDENT</option>
            <option value="Guest">GUEST</option>
            <option value="International">INTERNATIONAL</option>
          </select>
          <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
            placeholder="LOCATION" className={inputCls} />
          <input value={form.photo_url} onChange={e => setForm(f => ({...f, photo_url: e.target.value}))}
            placeholder="PHOTO URL" className={inputCls} />
          <input value={form.instagram} onChange={e => setForm(f => ({...f, instagram: e.target.value}))}
            placeholder="INSTAGRAM HANDLE" className={inputCls} />
          <input value={form.soundcloud} onChange={e => setForm(f => ({...f, soundcloud: e.target.value}))}
            placeholder="SOUNDCLOUD HANDLE" className={inputCls} />
        </div>
        <textarea value={form.bio} onChange={e => setForm(f => ({...f, bio: e.target.value}))}
          placeholder="BIO..." className={inputCls + " h-16 mb-3"} />
        {msg && <p className={`font-mono text-[10px] mb-3 ${msg.startsWith("ERROR") ? "text-red-500" : "text-green-400"}`}>{msg}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={creating || !form.name} className={btnPrimary + " flex-1"}>
            {creating ? "SAVING..." : editingId ? "SAVE CHANGES" : "ADD ARTIST"}
          </button>
          {editingId && (
            <button onClick={cancel} className="px-4 py-2.5 border border-zinc-700 font-mono text-[11px] uppercase text-zinc-400 hover:border-zinc-500 transition-colors">
              CANCEL
            </button>
          )}
        </div>
      </div>

      <div className="border border-zinc-800">
        {artists.map((a, i) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <span className="font-mono text-zinc-600 text-[10px] w-5">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <span className="font-display text-lg">{a.name}</span>
                <span className="ml-2 font-mono text-zinc-500 text-[10px] uppercase">{a.role}</span>
                {a.location && <span className="ml-2 font-mono text-zinc-600 text-[10px]">· {a.location}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(a)}
                className="font-mono text-[10px] text-zinc-400 border border-zinc-700 px-2 py-1 hover:border-zinc-500 transition-all">
                EDIT
              </button>
              <button onClick={() => del(a.id)}
                className="font-mono text-[10px] text-red-500 border border-red-800 px-2 py-1 hover:bg-red-600 hover:text-black transition-all">
                DEL
              </button>
            </div>
          </div>
        ))}
        {artists.length === 0 && <p className="px-4 py-6 font-mono text-[11px] text-zinc-600">No artists yet.</p>}
      </div>
    </div>
  );
};

// ─── Tickets Tab (read-only, with mark-scanned) ───────────────────────────────
const TicketsTab = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setTickets(await getAllTickets());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markScanned = async (ticketId) => {
    try {
      await markTicketScanned(ticketId);
      setMsg(`SCANNED: ${ticketId}`);
      load();
    } catch (e) { setMsg("ERROR: " + e.message); }
    setTimeout(() => setMsg(""), 3000);
  };

  const filtered = filter
    ? tickets.filter(t => t.ticket_id?.includes(filter.toUpperCase()) || t.customer_email?.includes(filter.toLowerCase()) || t.event_name?.toLowerCase().includes(filter.toLowerCase()))
    : tickets;

  const stats = {
    total: tickets.length,
    scanned: tickets.filter(t => t.is_scanned).length,
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[["TOTAL", stats.total], ["ATTENDED", stats.scanned], ["PENDING", stats.total - stats.scanned]].map(([l, v]) => (
          <div key={l} className="border border-zinc-800 p-3 text-center">
            <p className="font-mono text-[9px] uppercase text-zinc-500">{l}</p>
            <p className="font-display text-2xl mt-1 text-white">{v}</p>
          </div>
        ))}
      </div>

      <input value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="SEARCH BY TICKET ID, EMAIL, OR EVENT..." className={inputCls + " mb-4"} />

      {msg && <p className={`font-mono text-[10px] mb-3 ${msg.startsWith("ERROR") ? "text-red-500" : "text-green-400"}`}>{msg}</p>}

      {loading ? (
        <p className="font-mono text-[11px] text-zinc-600 text-center py-8">LOADING...</p>
      ) : (
        <div className="border border-zinc-800 max-h-[500px] overflow-y-auto">
          <div className="grid grid-cols-12 px-3 py-2 border-b border-zinc-800 font-mono text-[9px] uppercase text-zinc-500 sticky top-0 bg-black">
            <div className="col-span-3">TICKET ID</div>
            <div className="col-span-2">EMAIL</div>
            <div className="col-span-3">EVENT</div>
            <div className="col-span-1">TIER</div>
            <div className="col-span-1">AMT</div>
            <div className="col-span-2 text-right">STATUS</div>
          </div>
          {filtered.map(t => (
            <div key={t.ticket_id} className="grid grid-cols-12 px-3 py-2.5 border-b border-zinc-900 font-mono text-[10px] items-center">
              <div className="col-span-3 text-[#FF3B00] truncate">{t.ticket_id}</div>
              <div className="col-span-2 text-zinc-400 truncate">{t.customer_email}</div>
              <div className="col-span-3 truncate text-zinc-300">{t.event_name?.substring(0, 20)}</div>
              <div className="col-span-1 text-zinc-500">{t.tier?.substring(0, 8)}</div>
              <div className="col-span-1 text-zinc-500">{t.amount === 0 ? "COMP" : `₹${t.amount}`}</div>
              <div className="col-span-2 text-right">
                {t.is_scanned ? (
                  <span className="text-green-500">IN</span>
                ) : (
                  <button onClick={() => markScanned(t.ticket_id)}
                    className="text-[9px] border border-zinc-700 px-2 py-0.5 hover:border-[#FF3B00] hover:text-[#FF3B00] transition-all">
                    MARK IN
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="px-4 py-6 font-mono text-[11px] text-zinc-600">No tickets found.</p>}
        </div>
      )}
    </div>
  );
};

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminPage({ user }) {
  const [tab, setTab] = useState("events");

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/";
  };

  const tabs = [{ id: "events", label: "EVENTS" }, { id: "artists", label: "ARTISTS" }, { id: "tickets", label: "TICKETS" }];

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between bg-black/95 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <span className="font-pixel text-sm tracking-[0.2em] text-[#FF3B00]">OSCILLATE</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em]">ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-zinc-600 hidden md:block">{user?.email}</span>
          <a href="/" className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] border border-zinc-800 px-3 py-1 hover:border-zinc-500 transition-colors">HOME</a>
          <button onClick={handleLogout} className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] border border-zinc-800 px-3 py-1 hover:border-red-500 hover:text-red-500 transition-colors">SIGN OUT</button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex border-b border-zinc-800 mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-3 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 transition-all ${tab === t.id ? "border-[#FF3B00] text-[#FF3B00]" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "events"  && <EventsTab />}
        {tab === "artists" && <ArtistsTab />}
        {tab === "tickets" && <TicketsTab />}
      </div>
    </div>
  );
}
