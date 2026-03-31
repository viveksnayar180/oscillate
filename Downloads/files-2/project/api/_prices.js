// Server-side canonical price catalog — single source of truth for all ticket prices.
// Must be kept in sync with the tiers defined in src/components/Events.jsx.
// razorpay-order.js uses this to validate the amount the client claims to owe.

const TICKET_PRICES = {
  // ÜBERKIKZ × OSCILLATE — APR 11
  'EARLY BIRD':          569,
  'STANDARD':            799,
  'PREMIUM':             1299,
  // SIGNAL 002 — MAY 17
  'VIP PASS':            1999,
  // STELLAR MAP — JUN 21
  'GENERAL':             1499,
  "COLLECTOR'S BUNDLE":  4999,
};

const TICKET_GST_RATE = 0.18;
const MERCH_GST_RATE  = 0.05;
const CONVENIENCE_FEE = 30;

/**
 * Replicates Cart.jsx calcTotals() on the server.
 * items: array of { type: 'ticket'|'merch', tier?: string, price: string like '₹569', qty?: number }
 * Returns expected total in INR (integer rupees).
 */
export function calcExpectedTotal(items) {
  let ticketBase = 0, merchBase = 0, convFee = 0;

  for (const item of items) {
    const qty = Math.max(1, parseInt(item.qty) || 1);

    if (item.type === 'ticket') {
      // Prefer server catalog price; fall back to client-sent price only if tier is unknown
      const catalogPrice = TICKET_PRICES[item.tier];
      const price = catalogPrice ?? parseInt(String(item.price ?? '0').replace(/[₹,]/g, ''));
      ticketBase += price * qty;
      convFee    += CONVENIENCE_FEE * qty;
    } else {
      const price = parseInt(String(item.price ?? '0').replace(/[₹,]/g, ''));
      merchBase += price * qty;
    }
  }

  const ticketGST  = Math.round(ticketBase * TICKET_GST_RATE);
  const convFeeGST = Math.round(convFee * TICKET_GST_RATE);
  const merchGST   = Math.round(merchBase * MERCH_GST_RATE);

  return ticketBase + merchBase + convFee + ticketGST + convFeeGST + merchGST;
}
