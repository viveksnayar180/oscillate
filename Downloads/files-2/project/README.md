# Quant Futures Dashboard

ICT · SMC · ORB · CRT · AI Scanner · Forward Test · Strategy AI Chat · Tradovate · TradingView

## Run locally in 3 commands

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel (free, 1 minute)

1. Push this folder to GitHub
2. Go to vercel.com/new → import your repo
3. Vercel auto-detects Vite → click Deploy
4. Done — you get a live HTTPS URL

**Optional**: Add `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables
to enable the AI features server-side (no key needed in the dashboard UI).

## Deploy to Netlify

```bash
npm run build
```
Drag the `dist/` folder to netlify.com/drop — done.

---

## Features

| Tab | What it does |
|-----|-------------|
| 📈 Live Chart | Tradovate WebSocket · candlesticks · OBs · FVGs · IRL/ERL · sessions |
| 📐 Strategies | All built-in strategies · custom builder · Pine Script |
| 📚 Concepts | ICT/SMC reference library |
| 🔢 Calculator | Fibonacci · ORB · SD levels auto-calculated from chart |
| 🤖 AI Scanner | Claude scans 1000 candles against all active strategies |
| ⚡ Control | Tradovate login · TV webhook · position manager · audit log |
| 📓 Journal | Trade journal · session calendar · auto-journal at NY close |
| 🔬 Backtest | Multi-strategy backtester · Tradovate data · equity curve |
| 🚀 Forward Test | Paper trading · signal queue · live P&L · stats analytics |
| ✨ Strategy AI | Chat with Claude to fine-tune strategy rules + Pine Script |

---

## Tradovate Setup

1. Open ⚡ Control tab
2. Click **Connect Tradovate**
3. Enter credentials (demo or live)
4. All price data, order placement, and market data stream live

---

## TradingView Webhooks

1. Enable webhook in ⚡ Control tab
2. In TradingView → Alert → Webhook URL → `https://YOUR-DOMAIN/api/tv-alert`
3. Alert message format:
```json
{
  "direction": "LONG",
  "grade": "A",
  "entry": {{close}},
  "sl": 0,
  "tp1": 0,
  "strategy": "Vivek Unicorn"
}
```
4. Signals appear in Forward Test queue automatically

---

## AI Features — No API Key Required

The AI Scanner, Strategy Optimizer, and Strategy AI Chat all work without an API key
when deployed behind a proxy (Vercel/Netlify with the included `api/claude.js` function).

To use your own key: enter it in the **AI Scanner** tab → it saves to localStorage
and is reused across all AI features.

Get a key at: https://console.anthropic.com (separate from Claude.ai subscription)

---

## File Structure

```
├── index.html          # HTML shell
├── src/
│   ├── main.jsx        # React entry point
│   └── App.jsx         # Entire application (11,800+ lines)
├── api/
│   ├── tv-alert.js     # TradingView webhook relay
│   └── claude.js       # Anthropic API proxy (keeps key server-side)
├── package.json
├── vite.config.js
├── vercel.json         # Vercel config
└── netlify.toml        # Netlify config
```
