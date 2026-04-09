import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

const isValidUrl = (s) => { try { return /^https?:/.test(new URL(s).protocol); } catch { return false; } };

// Nullable — all consumers must guard with `if (supabase)`
export const supabase = isValidUrl(url) && key ? createClient(url, key) : null;
