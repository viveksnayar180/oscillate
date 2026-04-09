/**
 * Role helpers — email-based access control.
 * Lists are stored in .env and never hardcoded.
 * Note: these are client-side checks only (UX gating).
 * All sensitive operations must also be protected via Supabase RLS.
 */

const parseList = (envVar) =>
  (process.env[envVar] || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isAdmin = (user) =>
  !!user && parseList('REACT_APP_ADMIN_EMAILS').includes(user.email?.toLowerCase());

export const isPOS = (user) =>
  !!user && parseList('REACT_APP_POS_EMAILS').includes(user.email?.toLowerCase());
