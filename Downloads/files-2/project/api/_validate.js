// Server-side input validation helpers
// Used across all API routes that accept user input

const EMAIL_RE  = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/;
const PAY_ID_RE = /^pay_[a-zA-Z0-9]{14,20}$/;

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_RE.test(email.trim());
}

// Trim and hard-cap a string — never throw, always return something safe
export function sanitizeStr(str, maxLen = 100) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

// Razorpay payment IDs are always pay_<14-20 alphanumeric chars>
export function isValidPaymentId(id) {
  if (!id || typeof id !== 'string') return false;
  return PAY_ID_RE.test(id);
}
