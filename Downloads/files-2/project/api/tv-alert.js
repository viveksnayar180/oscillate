// api/tv-alert.js
// TradingView webhook relay — Vercel serverless function
// TradingView POSTs here → dashboard polls GET every 5s

let lastAlert = {};

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      lastAlert = {
        ...body,
        id: Date.now(),
        ts: Date.now(),
        receivedAt: new Date().toISOString()
      };
      console.log('[TV Alert received]', lastAlert);
      return res.status(200).json({ ok: true, id: lastAlert.id });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json(lastAlert);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
