/**
 * Data access layer — all Supabase calls go through here.
 * When the backend moves to MongoDB, swap implementations in this file only.
 */
import { supabase } from './supabase';

// ─── Events ──────────────────────────────────────────────────────────────────

export async function getEvents() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date_iso', { ascending: true });
  if (error) { console.error('db.getEvents:', error); return []; }
  return data || [];
}

export async function addEvent(payload) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('events').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

// ─── Artists ─────────────────────────────────────────────────────────────────

export async function getArtists() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('artists').select('*').order('name');
  if (error) { console.error('db.getArtists:', error); return []; }
  return data || [];
}

export async function addArtist(payload) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('artists').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function updateArtist(id, payload) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('artists').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteArtist(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('artists').delete().eq('id', id);
  if (error) throw error;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export async function getTicketsByEmail(email) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('customer_email', email)
    .order('created_at', { ascending: false });
  if (error) { console.error('db.getTicketsByEmail:', error); return []; }
  return data || [];
}

export async function getAllTickets() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('db.getAllTickets:', error); return []; }
  return data || [];
}

export async function markTicketScanned(ticketId) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('tickets')
    .update({ is_scanned: true, scanned_at: new Date().toISOString() })
    .eq('ticket_id', ticketId);
  if (error) throw error;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') { console.error('db.getProfile:', error); }
  return data || null;
}

export async function upsertProfile(userId, payload) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
