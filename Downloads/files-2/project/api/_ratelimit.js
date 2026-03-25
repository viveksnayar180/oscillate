// In-memory sliding window rate limiter — per IP + endpoint key
// Resets per Vercel cold start; best-effort protection for hot paths.
// For cross-instance limiting, swap in Upstash Redis.

const _windows = new Map();

/**
 * Returns true if the key has exceeded the limit within the sliding window.
 * @param {string} key       — e.g. `ip:endpoint`
 * @param {number} limit     — max allowed hits
 * @param {number} windowMs  — sliding window in milliseconds
 */
export function isRateLimited(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const hits = (_windows.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return true;
  hits.push(now);
  _windows.set(key, hits);
  return false;
}

/** Extract client IP from Vercel/CDN headers */
export function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
