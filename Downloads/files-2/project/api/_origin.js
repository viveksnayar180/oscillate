// Basic CSRF protection — rejects requests with disallowed Origin/Referer
// Webhooks and server-to-server calls (no Origin header) are allowed through

const ALLOWED = [
  'https://oscillate-eta.vercel.app',
  'https://oscillate.in',
  'https://www.oscillate.in',
];

export function isOriginAllowed(req) {
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  if (!origin) return true; // server-to-server / webhook / curl
  return (
    ALLOWED.some(o => origin.startsWith(o)) ||
    /^https:\/\/oscillate[^.]*\.vercel\.app/.test(origin) ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1')
  );
}
