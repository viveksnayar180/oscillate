// Express server for Render deployment
// Serves the built React frontend AND handles /api/* routes
// Run: node server.js   (after: npm run build)

import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ─── API routes (import serverless handlers) ─────────────────────────────────
// Wrap Vercel-style handlers (req, res) into Express middleware
function wrapHandler(handlerModule) {
  return async (req, res) => {
    try {
      const handler = handlerModule.default || handlerModule;
      await handler(req, res);
    } catch (err) {
      console.error('API handler error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Dynamically import and register API routes
async function registerApiRoutes() {
  const [
    { default: razorpayOrder },
    { default: razorpayVerify },
  ] = await Promise.all([
    import('./api/razorpay-order.js'),
    import('./api/razorpay-verify.js'),
  ]);

  app.post('/api/razorpay-order', wrapHandler({ default: razorpayOrder }));
  app.post('/api/razorpay-verify', wrapHandler({ default: razorpayVerify }));

  // Optional: claude proxy (if needed)
  try {
    const { default: claudeHandler } = await import('./api/claude.js');
    app.post('/api/claude', wrapHandler({ default: claudeHandler }));
  } catch { /* not required */ }
}

// ─── Serve static frontend ────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — all non-API routes return index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`OSCILLATE server running on port ${PORT}`);
});

registerApiRoutes().catch((err) => {
  console.error('Failed to register API routes:', err);
});
