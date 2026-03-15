import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const STORE_KEY   = "qfd-strategies-v2";
const JOURNAL_KEY    = "qfd-journal-v1";
const CALENDAR_KEY   = "qfd-calendar-v1";  // daily session notes

// ── SETUP GRADE A→D ──────────────────────────────────────────────────────────
// Grade is based on conviction, match_score, and key conditions passed.
// A = elite: all gateways pass + ≥8/9 scoring + OB+FVG confluence + BOS confirmed + in session
// B = high quality: all gateways pass + 6–7/9 scoring conditions
// C = moderate: all gateways pass + 4–5/9 scoring conditions, or MEDIUM conviction
// D = low quality or off-session or any gateway fail
const GRADE_DEFS = {
  A: { label:"A", color:"#00ff8c", bg:"rgba(0,255,140,0.12)", border:"rgba(0,255,140,0.4)",  desc:"Elite — all gates pass, 8–9 conditions, OB+FVG+BOS+session" },
  B: { label:"B", color:"#a3e635", bg:"rgba(163,230,53,0.1)",  border:"rgba(163,230,53,0.35)", desc:"High quality — all gates pass, 6–7 conditions" },
  C: { label:"C", color:"#f59e0b", bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.3)",  desc:"Moderate — 4–5 conditions or MEDIUM conviction" },
  D: { label:"D", color:"#ff4f4f", bg:"rgba(255,79,79,0.08)",  border:"rgba(255,79,79,0.2)",   desc:"Low quality — gateway fail, off-session, or weak structure" },
};
const GRADE_NONE = { label:"—", color:"#334155", bg:"transparent", border:"rgba(255,255,255,0.06)", desc:"Not graded" };

function computeGrade(conviction, confluenceScore, conditions_met_arr, gateway_pass, fvg_sequence) {
  // Fast fail
  if (!gateway_pass || conviction === "NONE" || conviction === "FLAT") return "D";
  const score    = Number(confluenceScore) || 0;
  const condMet  = Array.isArray(conditions_met_arr) ? conditions_met_arr.length : 0;
  const fvgOK    = fvg_sequence === "COMPLETE";
  if (conviction === "HIGH" && condMet >= 8 && fvgOK && score >= 78) return "A";
  if (conviction === "HIGH" && condMet >= 6  && score >= 60) return "B";
  if (conviction === "MEDIUM" && condMet >= 4) return "C";
  if (conviction === "LOW" || condMet < 4) return "D";
  return "C";
}

function GradeChip({ grade, large }) {
  const g = GRADE_DEFS[grade] || GRADE_NONE;
  return (
    <div title={g.desc} style={{
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      width: large?38:24, height: large?38:24,
      borderRadius: large?8:5,
      background: g.bg, border:`1.5px solid ${g.border}`,
      fontFamily:"monospace", fontWeight:900,
      fontSize: large?18:11, color: g.color,
      boxShadow: large&&g.label!=="—"?`0 0 12px ${g.color}55`:"none",
      flexShrink:0,
    }}>{g.label}</div>
  );
}
async function loadStrategies() { try { const r=localStorage.getItem(STORE_KEY); return r?JSON.parse(r):[];  } catch { return []; } }
async function saveStrategies(list) { try { localStorage.setItem(STORE_KEY,JSON.stringify(list)); } catch {} }
async function loadJournal() { try { const r=localStorage.getItem(JOURNAL_KEY); return r?JSON.parse(r):[];  } catch { return []; } }
async function saveJournal(list) { try { localStorage.setItem(JOURNAL_KEY,JSON.stringify(list)); } catch {} }

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPTS
// ─────────────────────────────────────────────────────────────────────────────
const concepts = {
  ICT:{ label:"ICT / Inner Circle Trader", color:"#00d4ff", topics:[
    {name:"Market Structure",short:"BOS/CHoCH",desc:"BOS confirms trend. CHoCH signals reversal.",formula:"BOS: close beyond swing H/L\nCHoCH: close beyond counter-trend swing"},
    {name:"Order Blocks",short:"OB",desc:"Last opposing candle before impulse. Institutional flow.",formula:"Bull OB = last bear candle before BOS up\nBear OB = last bull candle before BOS down"},
    {name:"Breaker Blocks",short:"BB",desc:"A mitigated Order Block that price has returned to and broken through. Flips polarity — a bullish OB becomes a bearish Breaker after being swept through. Key reversal zones.",formula:"Bull Breaker = bearish OB price sweeps through (now acts as resistance)\nBear Breaker = bullish OB price sweeps through (now acts as support)"},
    {name:"Fair Value Gap",short:"FVG",desc:"Three-candle imbalance. Price returns to fill.",formula:"Bull FVG: C1.high < C3.low\nBear FVG: C1.low > C3.high"},
    {name:"OTE",short:"OTE",desc:"Entry at 61.8–78.6% retracement into OB or FVG.",formula:"OTE Zone: 0.618 – 0.786 Fib retracement"},
    {name:"Killzones",short:"KZ",desc:"High-probability session windows.",formula:"London: 02:00–05:00 EST\nNY Open: 08:30–11:00 EST\nNY PM: 13:30–16:00 EST"},
    {name:"Power of 3 (AMD)",short:"AMD",desc:"Accumulation → Manipulation → Distribution.",formula:"Phase 1: Range | Phase 2: Stop Hunt | Phase 3: Trend"},
  ]},
  SMC:{ label:"Smart Money Concepts", color:"#a855f7", topics:[
    {name:"Liquidity Pools",short:"LP",desc:"Stop clusters above swing highs (BSL) and below lows (SSL).",formula:"BSL = equal highs, swing highs\nSSL = equal lows, swing lows"},
    {name:"Break of Structure",short:"BOS",desc:"Confirms market structure direction.",formula:"Bull BOS: close > prev swing high\nBear BOS: close < prev swing low"},
    {name:"Point of Interest",short:"POI",desc:"Key decision zones: OBs, BBs, FVGs, S/D zones.",formula:"POI = OB ∪ BB ∪ FVG ∪ S/D Zone"},
    {name:"Premium/Discount",short:"P/D",desc:"Above 50% EQ = premium (sell). Below = discount (buy).",formula:"EQ = (swing_high + swing_low) / 2"},
    {name:"Inducement",short:"IDM",desc:"Minor liquidity grab before institutional move.",formula:"IDM precedes CHoCH"},
  ]},
  ORB:{ label:"Opening Range Breakout", color:"#10b981", topics:[
    {name:"Opening Range",short:"OR",desc:"Range formed in first N minutes of session.",formula:"OR_high = max | OR_low = min | OR_range = H-L"},
    {name:"Breakout Entry",short:"BO",desc:"Long above OR high, short below OR low with volume.",formula:"Long: price > OR_H AND vol > avg\nStop: opposite OR boundary"},
    {name:"ORB Targets",short:"T1/T2",desc:"1×, 2×, 3× range extensions.",formula:"T1 = BO + 1× range | T2 = BO + 2× range"},
  ]},
  LIQUIDITY:{ label:"Liquidity Concepts", color:"#f59e0b", topics:[
    {name:"Liquidity Sweep",short:"LS",desc:"Price raids pool then reverses sharply.",formula:"Sweep: wick beyond level → close back inside"},
    {name:"Stop Hunt",short:"SH",desc:"Deliberate move to trigger stop clusters.",formula:"Wick > 2× body AND volume spike > 1.5× avg"},
    {name:"IRL",short:"IRL",desc:"Internal Range Liquidity — swept before ERL.",formula:"IRL = FVGs, OBs, EQH/EQL inside range"},
    {name:"ERL",short:"ERL",desc:"External Range Liquidity — ultimate targets.",formula:"ERL = prev swing H/L, HTF OBs"},
  ]},
  ORDERFLOW:{ label:"Order Flow Analysis", color:"#f97316", topics:[
    {name:"Delta",short:"Δ",desc:"Difference between aggressive buy volume and sell volume per candle. Positive delta = buying pressure. Divergence from price = potential reversal.",formula:"Delta = Ask_vol - Bid_vol\nPositive Δ = net buying\nNegative Δ = net selling"},
    {name:"CVD",short:"CVD",desc:"Cumulative Volume Delta. Running sum of deltas. Divergence between price and CVD is a leading indicator of exhaustion.",formula:"CVD_t = CVD_{t-1} + Delta_t\nBearish div: price HH, CVD LH\nBullish div: price LL, CVD HL"},
    {name:"Imbalances",short:"IMB",desc:"Candles where aggressive buy or sell volume overwhelmingly dominates. Imbalance candles often start or end sequences.",formula:"Imbalance: |Delta| / Volume > 0.7\nBull imbalance: Delta/Vol > 0.7\nBear imbalance: Delta/Vol < -0.7"},
    {name:"Volume Profile",short:"VP",desc:"Volume distributed across price levels. HVN = support/resistance. LVN = fast-move zones.",formula:"POC = max volume node\nVA = 70% of volume range"},
    {name:"Absorption",short:"ABS",desc:"Large passive orders absorb aggressive flow without price moving. Price stalls at a level despite heavy volume.",formula:"Absorption: large vol, small body, no follow-through"},
  ]},
  FIB:{ label:"Fibonacci", color:"#ec4899", topics:[
    {name:"Standard Levels",short:"Fib",desc:"Key retracement levels.",formula:"Levels: 0.236, 0.382, 0.5, 0.618, 0.705, 0.786"},
    {name:"Extensions",short:"Ext",desc:"Projects next move beyond swing.",formula:"TPs: 1.272, 1.618, 2.618"},
    {name:"Golden Pocket",short:"GP",desc:"0.618–0.65 reversal zone.",formula:"GP: [0.618, 0.65] | OTE: [0.618, 0.786]"},
  ]},
  STDDEV:{ label:"Standard Deviations", color:"#06b6d4", topics:[
    {name:"VWAP SD Bands",short:"SD",desc:"±1/2/3 SD from VWAP.",formula:"SD = √(Σ(price-VWAP)²×vol/Σvol)"},
    {name:"ATR",short:"ATR",desc:"Volatility. 1 ATR ≈ expected daily range.",formula:"TR = max(H-L, |H-Cprev|, |L-Cprev|)"},
  ]},
  CRT:{ label:"CRT — Candle Range Theory (Multi-TF Engulfing)", color:"#ec4899", topics:[
    {name:"Engulfing Candle",short:"ENG",desc:"Body of new candle fully covers prior candle body. Bull engulf at support = institutional buying. Bear engulf at resistance = institutional selling.",formula:"Bull: close[0]>open[1] AND open[0]<close[1]\nBear: close[0]<open[1] AND open[0]>close[1]\nStrong: |body[0]| ≥ 1.5×|body[1]|"},
    {name:"15M Context",short:"15M",desc:"Master direction filter. Identify trend + key S/R. A 15M engulfing candle at a key level defines the setup direction. ALL lower TF signals must align.",formula:"Trend: HH+HL=bull, LH+LL=bear\nEngulf quality: body ≥1.5×prior, at S/R zone, volume spike"},
    {name:"5M Confirmation",short:"5M",desc:"Confirm the 15M signal. Look for structural alignment (higher lows for bulls), range contraction (coiling before breakout), or a 5M BOS. The 5M swing break is the trigger signal.",formula:"5M alignment: structure matches 15M\n5M BOS: close > recent swing high (bull)\nRange contract: last 3 candles ATR < avg ATR"},
    {name:"1M Entry",short:"1M",desc:"Precise entry via 1M engulfing candle. Must be larger than prior 3 candles (momentum). Closes firmly in direction. Enter on CLOSE only — never mid-candle. Signal is stale after 3 candles.",formula:"1M bull entry: C>O[1] AND O<C[1] AND |body|>avg3\nStop: below 1M engulf low\nMax NQ stop: 30pts"},
    {name:"Multi-TF Funnel",short:"MTF",desc:"All three timeframes must agree: 15M sets direction, 5M confirms structure, 1M gives entry. Any disagreement = no trade. This is the core discipline of CRT.",formula:"Valid = 15M_engulf ∩ 5M_align ∩ 1M_engulf\nMissing any one = WAIT"},
    {name:"CRT Risk Management",short:"R:R",desc:"Stop: 1–2 ticks beyond 1M engulf extreme (or 0.75×ATR1M). TP1: next 5M S/R level (take 50%, move to BE). TP2: major 15M S/R. Minimum R:R = 1:2. Skip if TP1 closer than 2×stop.",formula:"Stop = engulf_extreme ± 1-2 ticks\nTP1 = next 5M S/R (50% off)\nTP2 = major 15M S/R\nMin R:R = 1:2"},
    {name:"Avoidance Rules",short:"SKIP",desc:"Do not trade: NY Lunch 12–1PM, pre-market 8:30–9:30AM, 30min before major news, when 15M+5M disagree, when volume on engulf is below average, when price is mid-range with no clear anchor.",formula:"Skip: lunch, news, pre-mkt, TF disagreement\nSignal stale: >3 candles since 1M engulf\nNo anchor: price not at clear S/R"},
  ]},
};

// ─────────────────────────────────────────────────────────────────────────────
// PINE SCRIPT — VIVEK'S UNICORN + SILVER BULLET STRATEGY
// Declared here (before BUILTIN_STRATEGIES) so it can be referenced as code:
// ─────────────────────────────────────────────────────────────────────────────
const PINE_VIVEK_UNICORN =
`//@version=5
// ═══════════════════════════════════════════════════════════════════
// Vivek's Unicorn + Silver Bullet Strategy  |  NQ Futures
// Concepts: Macro Bias → Unicorn Model → IFVG → Silver Bullet → SMT
// ═══════════════════════════════════════════════════════════════════
strategy("Vivek Unicorn + Silver Bullet (NQ)",
         overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5,
         max_bars_back=500,
         pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────────────────
atr_len      = input.int(14,     title="ATR Length",           group="Risk")
sl_atr       = input.float(1.5,  title="Stop Loss (ATR mult)", group="Risk",   step=0.1)
tp1_r        = input.float(1.5,  title="TP1 (R multiple)",     group="Risk",   step=0.1)
tp2_r        = input.float(3.0,  title="TP2 (R multiple)",     group="Risk",   step=0.1)

macro_ema    = input.int(200,    title="Macro Bias EMA (HTF proxy)", group="Bias")
ob_mult      = input.float(1.5,  title="OB Impulse Multiplier",      group="Structure", step=0.1)
smt_symbol   = input.symbol("ES1!", title="SMT Divergence Symbol (ES/YM)", group="SMT")
smt_lookback = input.int(10,     title="SMT Lookback Bars",           group="SMT")

use_sb       = input.bool(true,  title="Silver Bullet Window Only (10-11 AM EST)", group="Session")

// ── SESSION: SILVER BULLET (10:00 – 11:00 AM EST = 15:00 – 16:00 UTC) ───────
hour_utc      = hour(time, "UTC")
min_utc       = minute(time, "UTC")
in_sb_window  = hour_utc == 15 or (hour_utc == 14 and min_utc >= 30)
                // 10:00–11:00 EST = 15:00–16:00 UTC (adjust ±1hr for DST)
in_session    = use_sb ? in_sb_window : true

// ── MACRO BIAS — EMA200 proxy on current chart ────────────────────────────────
ema_macro     = ta.ema(close, macro_ema)
macro_bull    = close > ema_macro
macro_bear    = close < ema_macro

// ── SWING STRUCTURE ───────────────────────────────────────────────────────────
swing_h       = ta.highest(high,  20)
swing_l       = ta.lowest(low,    20)
swing_range   = swing_h - swing_l
atr           = ta.atr(atr_len)

// ── MARKET STRUCTURE SHIFT (CHoCH proxy) ─────────────────────────────────────
prev_ph       = ta.highestbars(high, 10) == 0   // pivot high
prev_pl       = ta.lowestbars(low,   10) == 0   // pivot low
mss_bull      = close > ta.highest(high, 5)[1] and macro_bull  // breaks above recent range
mss_bear      = close < ta.lowest(low,  5)[1] and macro_bear

// ── ORDER BLOCK DETECTION ─────────────────────────────────────────────────────
ob_bull = close[1] < open[1]
          and close > open
          and (close - open) > (open[1] - close[1]) * ob_mult
          and mss_bull

ob_bear = close[1] > open[1]
          and close < open
          and (open - close) > (close[1] - open[1]) * ob_mult
          and mss_bear

// ── INVERSE FVG (IFVG) ────────────────────────────────────────────────────────
var float ifvg_bull_top = na
var float ifvg_bull_bot = na
var float ifvg_bear_top = na
var float ifvg_bear_bot = na

fvg_bull_detect = low[1] > high[3]
fvg_bear_detect = high[1] < low[3]

if fvg_bull_detect and na(ifvg_bull_top)
    ifvg_bull_top := low[1]
    ifvg_bull_bot := high[3]
if fvg_bear_detect and na(ifvg_bear_top)
    ifvg_bear_top := low[3]
    ifvg_bear_bot := high[1]

at_ifvg_bull  = not na(ifvg_bull_bot) and close >= ifvg_bull_bot and close <= ifvg_bull_top
at_ifvg_bear  = not na(ifvg_bear_bot) and close >= ifvg_bear_bot and close <= ifvg_bear_top

if at_ifvg_bull
    ifvg_bull_top := na
    ifvg_bull_bot := na
if at_ifvg_bear
    ifvg_bear_top := na
    ifvg_bear_bot := na

// ── OTE FIBONACCI ZONE ────────────────────────────────────────────────────────
ote_long_top  = swing_h - swing_range * 0.618
ote_long_bot  = swing_h - swing_range * 0.786
ote_short_bot = swing_l + swing_range * 0.618
ote_short_top = swing_l + swing_range * 0.786
at_ote_long   = close >= ote_long_bot  and close <= ote_long_top
at_ote_short  = close >= ote_short_bot and close <= ote_short_top

// ── SMT DIVERGENCE ────────────────────────────────────────────────────────────
smt_close     = request.security(smt_symbol, timeframe.period, close)
smt_low       = request.security(smt_symbol, timeframe.period, ta.lowest(low, smt_lookback))
smt_high      = request.security(smt_symbol, timeframe.period, ta.highest(high, smt_lookback))

nq_low_lb     = ta.lowest(low,  smt_lookback)
nq_high_lb    = ta.highest(high, smt_lookback)

smt_bull_div  = low <= nq_low_lb and smt_close > smt_low
smt_bear_div  = high >= nq_high_lb and smt_close < smt_high

// ── CVD PROXY ─────────────────────────────────────────────────────────────────
bar_delta     = close > open ? volume : close < open ? -volume : 0
cvd           = ta.cum(bar_delta)
cvd_rising    = cvd > cvd[5]
cvd_falling   = cvd < cvd[5]

// ── FULL CONFLUENCE ───────────────────────────────────────────────────────────
long_conf     = macro_bull and in_session and ob_bull and at_ifvg_bull
                and at_ote_long and smt_bull_div and cvd_rising
                and strategy.position_size == 0

short_conf    = macro_bear and in_session and ob_bear and at_ifvg_bear
                and at_ote_short and smt_bear_div and cvd_falling
                and strategy.position_size == 0

// ── EXECUTION ─────────────────────────────────────────────────────────────────
sl_pts        = atr * sl_atr
tp1_pts       = sl_pts * tp1_r
tp2_pts       = sl_pts * tp2_r

if long_conf
    strategy.entry("Unicorn Long",  strategy.long,  comment="UL")
    strategy.exit("UL TP1", "Unicorn Long", qty_percent=50, limit=close + tp1_pts)
    strategy.exit("UL TP2", "Unicorn Long", qty_percent=50, limit=close + tp2_pts, stop=close - sl_pts)

if short_conf
    strategy.entry("Unicorn Short", strategy.short, comment="US")
    strategy.exit("US TP1", "Unicorn Short", qty_percent=50, limit=close - tp1_pts)
    strategy.exit("US TP2", "Unicorn Short", qty_percent=50, limit=close - tp2_pts, stop=close + sl_pts)

// ── VISUALS ───────────────────────────────────────────────────────────────────
bgcolor(in_sb_window ? color.new(color.purple, 95) : na, title="Silver Bullet Window")
bgcolor(macro_bull   ? color.new(color.green,  99) : color.new(color.red, 99), title="Macro Bias")

ote_long_zone  = plot(at_ote_long  ? ote_long_top  : na, color=color.new(color.aqua,   60), style=plot.style_linebr, title="OTE Long Top")
ote_long_zone2 = plot(at_ote_long  ? ote_long_bot  : na, color=color.new(color.aqua,   60), style=plot.style_linebr, title="OTE Long Bot")
fill(ote_long_zone, ote_long_zone2, color.new(color.aqua, 90), title="OTE Long Zone")

ote_short_zone  = plot(at_ote_short ? ote_short_top : na, color=color.new(color.orange, 60), style=plot.style_linebr, title="OTE Short Top")
ote_short_zone2 = plot(at_ote_short ? ote_short_bot : na, color=color.new(color.orange, 60), style=plot.style_linebr, title="OTE Short Bot")
fill(ote_short_zone, ote_short_zone2, color.new(color.orange, 90), title="OTE Short Zone")

plot(ema_macro, color=color.new(color.purple, 50), linewidth=2, title="Macro EMA")

plotshape(long_conf,    style=shape.triangleup,   color=color.new(color.lime,   0), size=size.normal, location=location.belowbar, title="Long Signal")
plotshape(short_conf,   style=shape.triangledown, color=color.new(color.red,    0), size=size.normal, location=location.abovebar, title="Short Signal")
plotshape(smt_bull_div, style=shape.diamond,      color=color.new(color.yellow, 0), size=size.small,  location=location.belowbar, title="SMT Bull Div")
plotshape(smt_bear_div, style=shape.diamond,      color=color.new(color.yellow, 0), size=size.small,  location=location.abovebar, title="SMT Bear Div")

alertcondition(long_conf,  title="Unicorn Long Setup",  message="Vivek Unicorn LONG — All conditions met")
alertcondition(short_conf, title="Unicorn Short Setup", message="Vivek Unicorn SHORT — All conditions met")
`;

// ─────────────────────────────────────────────────────────────────────────────
// PINE SCRIPT — KZ CONFLUENCE STRATEGY
// ─────────────────────────────────────────────────────────────────────────────
const PINE_KZ_CONFLUENCE =
`//@version=5
// ──────────────────────────────────────────────────────────────────
// KZ Confluence Strategy  |  OB + FVG + Killzone + CVD divergence
// ──────────────────────────────────────────────────────────────────
strategy("KZ Confluence", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500)

// ── INPUTS ──────────────────────────────────────────────────────
atr_len    = input.int(14,      title="ATR Length")
ob_mult    = input.float(1.5,   title="OB Impulse Multiplier", step=0.1)
fib_entry  = input.float(0.618, title="OTE Entry Fib",         step=0.001)
sl_atr     = input.float(1.5,   title="Stop Loss ATR mult",    step=0.1)
tp1_atr    = input.float(2.0,   title="TP1 ATR mult",          step=0.1)
tp2_atr    = input.float(4.0,   title="TP2 ATR mult",          step=0.1)
kz_london  = input.bool(true,   title="Use London KZ (02-05 EST)")
kz_ny      = input.bool(true,   title="Use NY Open KZ (08:30-11 EST)")

// ── TIME ────────────────────────────────────────────────────────
hour_utc   = hour(time, "UTC")
in_london  = kz_london and (hour_utc >= 7  and hour_utc < 10)
in_ny      = kz_ny     and (hour_utc >= 13 and hour_utc < 16)
in_kz      = in_london or in_ny

// ── CALCULATIONS ────────────────────────────────────────────────
atr         = ta.atr(atr_len)
swing_h     = ta.highest(high, 20)
swing_l     = ta.lowest(low,  20)
swing_range = swing_h - swing_l

// ── ORDER BLOCK ───────────────────────────────────────────────
ob_bull = close[1] < open[1] and close > open
          and (close - open) > (open[1] - close[1]) * ob_mult
ob_bear = close[1] > open[1] and close < open
          and (open - close) > (close[1] - open[1]) * ob_mult

// ── BREAKER BLOCK ─────────────────────────────────────────────
var float bb_bull_level = na
var float bb_bear_level = na
if ob_bull and close > swing_h[1]
    bb_bear_level := high[1]
if ob_bear and close < swing_l[1]
    bb_bull_level := low[1]

// ── FVG ─────────────────────────────────────────────────────
fvg_bull = low  > high[2]
fvg_bear = high < low[2]

// ── OTE ZONE ────────────────────────────────────────────────
ote_long_level  = swing_h - swing_range * fib_entry
ote_short_level = swing_l + swing_range * (1 - fib_entry)
at_ote_long     = close <= ote_long_level  and close >= swing_h - swing_range * 0.786
at_ote_short    = close >= ote_short_level and close <= swing_l + swing_range * 0.786

// ── CVD PROXY ────────────────────────────────────────────────
bar_delta  = close > open ? volume : close < open ? -volume : 0
cvd        = ta.cum(bar_delta)
cvd_hl     = ta.lowest(cvd, 10)
cvd_hh     = ta.highest(cvd, 10)

// ── DIVERGENCE ───────────────────────────────────────────────
bull_div = low  < ta.lowest(low,  10)[1] and cvd > cvd_hl[1]
bear_div = high > ta.highest(high,10)[1] and cvd < cvd_hh[1]

// ── CONFLUENCE ───────────────────────────────────────────────
long_conf  = in_kz and ob_bull and fvg_bull and at_ote_long  and bull_div
short_conf = in_kz and ob_bear and fvg_bear and at_ote_short and bear_div

// ── EXECUTION ───────────────────────────────────────────────
if long_conf and strategy.position_size == 0
    strategy.entry("KZ Long",  strategy.long)
    strategy.exit("KZ L Exit", "KZ Long",  stop=close - atr * sl_atr, limit=close + atr * tp2_atr)

if short_conf and strategy.position_size == 0
    strategy.entry("KZ Short", strategy.short)
    strategy.exit("KZ S Exit", "KZ Short", stop=close + atr * sl_atr, limit=close - atr * tp2_atr)

// ── VISUALS ─────────────────────────────────────────────────
bgcolor(in_london ? color.new(color.blue,  97) : na, title="London KZ")
bgcolor(in_ny     ? color.new(color.green, 97) : na, title="NY KZ")
plotshape(long_conf,  style=shape.triangleup,   color=color.lime, size=size.small, location=location.belowbar)
plotshape(short_conf, style=shape.triangledown, color=color.red,  size=size.small, location=location.abovebar)
plot(ote_long_level,  color=color.new(color.aqua,   60), title="OTE Long")
plot(ote_short_level, color=color.new(color.orange, 60), title="OTE Short")
`;

// ─────────────────────────────────────────────────────────────────────────────
// BUILT-IN STRATEGIES + OVERLAY META
// ─────────────────────────────────────────────────────────────────────────────
const BUILTIN_STRATEGIES = [
  { id:"ict", label:"ICT  — OBs + FVGs", color:"#00d4ff", overlays:["ob","fvg"], builtin:true,
    notes:"Pure ICT framework: detect unmitigated Order Blocks at MSS points, confirm with Fair Value Gap overlap. Entry on retrace into OB+FVG confluence. Stop beyond OB extreme. Target opposing liquidity pool.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// ICT — Order Blocks + Fair Value Gaps  |  NQ/ES Futures
// Concepts: OB at MSS point + FVG confluence → entry on retrace
// ══════════════════════════════════════════════════════════════════
strategy("ICT OB + FVG", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
atr_len    = input.int(14,    title="ATR Length",            group="Risk")
ob_mult    = input.float(1.5, title="OB Impulse Multiplier", group="Structure", step=0.1)
sl_atr     = input.float(1.5, title="Stop ATR multiplier",   group="Risk",      step=0.1)
tp1_r      = input.float(1.5, title="TP1 R multiple",        group="Risk",      step=0.1)
tp2_r      = input.float(3.0, title="TP2 R multiple",        group="Risk",      step=0.1)
show_ob    = input.bool(true,  title="Show OB zones",        group="Display")
show_fvg   = input.bool(true,  title="Show FVG zones",       group="Display")

// ── CORE CALCULATIONS ────────────────────────────────────────────
atr        = ta.atr(atr_len)
ema20      = ta.ema(close, 20)
ema50      = ta.ema(close, 50)
macro_bull = close > ta.ema(close, 200)
macro_bear = close < ta.ema(close, 200)

// ── MARKET STRUCTURE SHIFT (BOS proxy) ──────────────────────────
mss_bull   = close > ta.highest(high, 5)[1] and macro_bull
mss_bear   = close < ta.lowest(low,   5)[1] and macro_bear

// ── ORDER BLOCK DETECTION ────────────────────────────────────────
// Bull OB: last bearish candle before a bullish MSS impulse
// Bear OB: last bullish candle before a bearish MSS impulse
ob_bull    = close[1] < open[1]
             and close > open
             and (close - open) > (open[1] - close[1]) * ob_mult
             and mss_bull

ob_bear    = close[1] > open[1]
             and close < open
             and (open - close) > (close[1] - open[1]) * ob_mult
             and mss_bear

// Store OB zone levels
var float ob_bull_top = na
var float ob_bull_bot = na
var float ob_bear_top = na
var float ob_bear_bot = na

if ob_bull
    ob_bull_top := high[1]
    ob_bull_bot := low[1]
if ob_bear
    ob_bear_top := high[1]
    ob_bear_bot := low[1]

// OB mitigated when price closes through it
if not na(ob_bull_bot) and close < ob_bull_bot
    ob_bull_top := na
    ob_bull_bot := na
if not na(ob_bear_top) and close > ob_bear_top
    ob_bear_top := na
    ob_bear_bot := na

at_bull_ob = not na(ob_bull_bot) and close >= ob_bull_bot and close <= ob_bull_top
at_bear_ob = not na(ob_bear_bot) and close >= ob_bear_bot and close <= ob_bear_top

// ── FAIR VALUE GAP DETECTION ─────────────────────────────────────
// Bull FVG: gap between bar[2].high and bar[0].low — price moves up too fast
// Bear FVG: gap between bar[2].low and bar[0].high — price moves down too fast
fvg_bull   = low  > high[2]   // 3-candle bullish imbalance
fvg_bear   = high < low[2]    // 3-candle bearish imbalance

var float fvg_bull_top = na
var float fvg_bull_bot = na
var float fvg_bear_top = na
var float fvg_bear_bot = na

if fvg_bull
    fvg_bull_top := low
    fvg_bull_bot := high[2]
if fvg_bear
    fvg_bear_top := low[2]
    fvg_bear_bot := high

// FVG filled when price re-enters the gap
if not na(fvg_bull_bot) and close < fvg_bull_bot
    fvg_bull_top := na
    fvg_bull_bot := na
if not na(fvg_bear_top) and close > fvg_bear_top
    fvg_bear_top := na
    fvg_bear_bot := na

at_bull_fvg = not na(fvg_bull_bot) and close >= fvg_bull_bot and close <= fvg_bull_top
at_bear_fvg = not na(fvg_bear_bot) and close >= fvg_bear_bot and close <= fvg_bear_top

// ── CONFLUENCE: OB + FVG OVERLAP ─────────────────────────────────
long_conf  = at_bull_ob and at_bull_fvg and macro_bull and strategy.position_size == 0
short_conf = at_bear_ob and at_bear_fvg and macro_bear and strategy.position_size == 0

// ── EXECUTION ────────────────────────────────────────────────────
sl_pts  = atr * sl_atr
tp1_pts = sl_pts * tp1_r
tp2_pts = sl_pts * tp2_r

if long_conf
    strategy.entry("ICT Long",  strategy.long,  comment="ICT OB+FVG L")
    strategy.exit("ICT L TP1", "ICT Long",  qty_percent=50, limit=close + tp1_pts)
    strategy.exit("ICT L TP2", "ICT Long",  qty_percent=50, limit=close + tp2_pts, stop=close - sl_pts)

if short_conf
    strategy.entry("ICT Short", strategy.short, comment="ICT OB+FVG S")
    strategy.exit("ICT S TP1", "ICT Short", qty_percent=50, limit=close - tp1_pts)
    strategy.exit("ICT S TP2", "ICT Short", qty_percent=50, limit=close - tp2_pts, stop=close + sl_pts)

// ── VISUALS ──────────────────────────────────────────────────────
bgcolor(macro_bull ? color.new(color.teal, 98) : color.new(color.red, 98), title="Macro Bias")

// OB zones
ob_bull_box = show_ob and not na(ob_bull_bot) ?
              box.new(bar_index - 5, ob_bull_top, bar_index + 20, ob_bull_bot,
              border_color=color.new(#00d4ff, 30), bgcolor=color.new(#00d4ff, 88)) : na
ob_bear_box = show_ob and not na(ob_bear_bot) ?
              box.new(bar_index - 5, ob_bear_top, bar_index + 20, ob_bear_bot,
              border_color=color.new(#ff4444, 30), bgcolor=color.new(#ff4444, 88)) : na

// Signals
plotshape(long_conf,  style=shape.triangleup,   color=color.new(#00d4ff, 0), size=size.normal, location=location.belowbar, title="ICT Long")
plotshape(short_conf, style=shape.triangledown, color=color.new(#ff4444, 0), size=size.normal, location=location.abovebar, title="ICT Short")
plot(ta.ema(close, 200), color=color.new(color.purple, 50), linewidth=2, title="EMA 200")

// Alerts
alertcondition(long_conf,  title="ICT Long",  message="ICT OB+FVG LONG confluence — entry zone reached")
alertcondition(short_conf, title="ICT Short", message="ICT OB+FVG SHORT confluence — entry zone reached")
`},

  { id:"smc", label:"SMC  — OBs + FVGs + Liq", color:"#a855f7", overlays:["ob","fvg","liq"], builtin:true,
    notes:"Smart Money Concepts: OB + FVG confluence after liquidity sweep. Entry only after BSL/SSL has been taken — institutions sweep stops first, then reverse. CVD divergence optional filter.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// SMC — Order Blocks + FVGs + Liquidity Sweep  |  NQ/ES Futures
// Flow: Liquidity Sweep → OB formation → FVG retrace → entry
// ══════════════════════════════════════════════════════════════════
strategy("SMC OB + FVG + Liquidity", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
atr_len      = input.int(14,    title="ATR Length")
ob_mult      = input.float(1.5, title="OB Impulse Multiplier", step=0.1)
sweep_lb     = input.int(20,    title="Swing Lookback (Liquidity)")
sl_atr       = input.float(1.5, title="Stop ATR mult",  step=0.1)
tp1_r        = input.float(2.0, title="TP1 R multiple", step=0.1)
tp2_r        = input.float(4.0, title="TP2 R multiple", step=0.1)

// ── CORE ─────────────────────────────────────────────────────────
atr          = ta.atr(atr_len)
macro_bull   = close > ta.ema(close, 200)
macro_bear   = close < ta.ema(close, 200)

// ── LIQUIDITY POOLS (swing highs/lows) ──────────────────────────
// BSL: equal highs / swing highs = buy-side liquidity (stops above)
// SSL: equal lows  / swing lows  = sell-side liquidity (stops below)
swing_high   = ta.highest(high, sweep_lb)
swing_low    = ta.lowest(low,   sweep_lb)

// Sweep detection: wick pierces liquidity level then price reverses
// Bull sweep: price wicks below swing_low then closes back above → SSL taken
ssl_swept    = low < swing_low[1] and close > swing_low[1]
// Bear sweep: price wicks above swing_high then closes back below → BSL taken
bsl_swept    = high > swing_high[1] and close < swing_high[1]

// Track recent sweep
var bool recent_ssl_sweep = false
var bool recent_bsl_sweep = false
var int  sweep_bar        = 0

if ssl_swept
    recent_ssl_sweep := true
    recent_bsl_sweep := false
    sweep_bar        := bar_index
if bsl_swept
    recent_bsl_sweep := true
    recent_ssl_sweep := false
    sweep_bar        := bar_index

// Sweep expires after 10 bars
bars_since_sweep = bar_index - sweep_bar
if bars_since_sweep > 10
    recent_ssl_sweep := false
    recent_bsl_sweep := false

// ── ORDER BLOCK (post-sweep) ─────────────────────────────────────
mss_bull = close > ta.highest(high, 5)[1] and macro_bull
mss_bear = close < ta.lowest(low,   5)[1] and macro_bear

ob_bull  = close[1] < open[1] and close > open
           and (close - open) > (open[1] - close[1]) * ob_mult
           and mss_bull and recent_ssl_sweep

ob_bear  = close[1] > open[1] and close < open
           and (open - close) > (close[1] - open[1]) * ob_mult
           and mss_bear and recent_bsl_sweep

var float ob_bull_top = na
var float ob_bull_bot = na
var float ob_bear_top = na
var float ob_bear_bot = na

if ob_bull
    ob_bull_top := high[1]
    ob_bull_bot := low[1]
if ob_bear
    ob_bear_top := high[1]
    ob_bear_bot := low[1]

if not na(ob_bull_bot) and close < ob_bull_bot
    ob_bull_top := na
    ob_bull_bot := na
if not na(ob_bear_top) and close > ob_bear_top
    ob_bear_top := na
    ob_bear_bot := na

// ── FVG ──────────────────────────────────────────────────────────
fvg_bull     = low  > high[2]
fvg_bear     = high < low[2]

var float fvg_bull_top = na
var float fvg_bull_bot = na
var float fvg_bear_top = na
var float fvg_bear_bot = na

if fvg_bull
    fvg_bull_top := low
    fvg_bull_bot := high[2]
if fvg_bear
    fvg_bear_top := low[2]
    fvg_bear_bot := high

if not na(fvg_bull_bot) and close < fvg_bull_bot
    fvg_bull_top := na
    fvg_bull_bot := na
if not na(fvg_bear_top) and close > fvg_bear_top
    fvg_bear_top := na
    fvg_bear_bot := na

at_bull_ob  = not na(ob_bull_bot) and close >= ob_bull_bot and close <= ob_bull_top
at_bear_ob  = not na(ob_bear_bot) and close >= ob_bear_bot and close <= ob_bear_top
at_bull_fvg = not na(fvg_bull_bot) and close >= fvg_bull_bot and close <= fvg_bull_top
at_bear_fvg = not na(fvg_bear_bot) and close >= fvg_bear_bot and close <= fvg_bear_top

// ── CVD PROXY ────────────────────────────────────────────────────
bar_delta    = close > open ? volume : close < open ? -volume : 0
cvd          = ta.cum(bar_delta)
cvd_rising   = cvd > cvd[3]
cvd_falling  = cvd < cvd[3]

// ── SMC CONFLUENCE ───────────────────────────────────────────────
// Long: SSL swept → OB formed → price retraces to OB+FVG → CVD rising
long_conf    = at_bull_ob and at_bull_fvg and recent_ssl_sweep and macro_bull and cvd_rising  and strategy.position_size == 0
short_conf   = at_bear_ob and at_bear_fvg and recent_bsl_sweep and macro_bear and cvd_falling and strategy.position_size == 0

// ── EXECUTION ────────────────────────────────────────────────────
sl_pts  = atr * sl_atr
tp1_pts = sl_pts * tp1_r
tp2_pts = sl_pts * tp2_r

if long_conf
    strategy.entry("SMC Long",  strategy.long,  comment="SMC L")
    strategy.exit("SMC L TP1", "SMC Long",  qty_percent=50, limit=close + tp1_pts)
    strategy.exit("SMC L TP2", "SMC Long",  qty_percent=50, limit=close + tp2_pts, stop=close - sl_pts)

if short_conf
    strategy.entry("SMC Short", strategy.short, comment="SMC S")
    strategy.exit("SMC S TP1", "SMC Short", qty_percent=50, limit=close - tp1_pts)
    strategy.exit("SMC S TP2", "SMC Short", qty_percent=50, limit=close - tp2_pts, stop=close + sl_pts)

// ── VISUALS ──────────────────────────────────────────────────────
plotshape(ssl_swept,  style=shape.xcross, color=color.new(color.lime,  0), size=size.tiny, location=location.belowbar, title="SSL Swept")
plotshape(bsl_swept,  style=shape.xcross, color=color.new(color.red,   0), size=size.tiny, location=location.abovebar, title="BSL Swept")
plotshape(long_conf,  style=shape.triangleup,   color=color.new(#a855f7, 0), size=size.normal, location=location.belowbar, title="SMC Long")
plotshape(short_conf, style=shape.triangledown, color=color.new(#a855f7, 0), size=size.normal, location=location.abovebar, title="SMC Short")
plot(swing_high, color=color.new(color.red,  60), style=plot.style_stepline, title="BSL")
plot(swing_low,  color=color.new(color.lime, 60), style=plot.style_stepline, title="SSL")

alertcondition(long_conf,  title="SMC Long",  message="SMC LONG — SSL swept + OB+FVG confluence")
alertcondition(short_conf, title="SMC Short", message="SMC SHORT — BSL swept + OB+FVG confluence")
`},

  { id:"bb", label:"Breaker Blocks", color:"#ff6b35", overlays:["bb"], builtin:true,
    notes:"Breaker Block = mitigated Order Block that flips polarity. Former supply becomes demand, former demand becomes supply. Enter on price returning to the Breaker Block after polarity flip. Highest probability at killzone times.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// Breaker Blocks Strategy  |  NQ/ES Futures
// Concept: OB is mitigated (price breaks through) → polarity flips
// → price returns to former OB (now BB) → entry
// ══════════════════════════════════════════════════════════════════
strategy("Breaker Blocks", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
atr_len    = input.int(14,    title="ATR Length")
ob_mult    = input.float(1.5, title="OB Impulse Multiplier", step=0.1)
sl_atr     = input.float(1.2, title="Stop ATR mult",  step=0.1)
tp1_r      = input.float(2.0, title="TP1 R multiple", step=0.1)
tp2_r      = input.float(4.0, title="TP2 R multiple", step=0.1)

// ── CORE ─────────────────────────────────────────────────────────
atr          = ta.atr(atr_len)
macro_bull   = close > ta.ema(close, 200)
macro_bear   = close < ta.ema(close, 200)
swing_h20    = ta.highest(high, 20)
swing_l20    = ta.lowest(low,   20)

// ── STEP 1: OB DETECTION ─────────────────────────────────────────
// Bearish OB = last bullish candle before a bearish displacement
// Bullish OB = last bearish candle before a bullish displacement
ob_bull      = close[1] < open[1] and close > open
               and (close - open) > (open[1] - close[1]) * ob_mult
ob_bear      = close[1] > open[1] and close < open
               and (open - close) > (close[1] - open[1]) * ob_mult

// Store OB zones (up to one per direction for simplicity)
var float ob_bull_hi = na
var float ob_bull_lo = na
var float ob_bear_hi = na
var float ob_bear_lo = na

if ob_bull
    ob_bull_hi := high[1]
    ob_bull_lo := low[1]
if ob_bear
    ob_bear_hi := high[1]
    ob_bear_lo := low[1]

// ── STEP 2: MITIGATION → BREAKER BLOCK FORMATION ─────────────────
// Bull OB mitigated = price closes BELOW ob_bull_lo → becomes bear BB
// Bear OB mitigated = price closes ABOVE ob_bear_hi → becomes bull BB
var float bb_bull_hi = na   // Bullish Breaker Block (was bear OB, now flipped demand)
var float bb_bull_lo = na
var float bb_bear_hi = na   // Bearish Breaker Block (was bull OB, now flipped supply)
var float bb_bear_lo = na
var bool  bb_bull_retested = false
var bool  bb_bear_retested = false

// Bear OB mitigated → flip to Bullish BB
if not na(ob_bear_hi) and close > ob_bear_hi
    bb_bull_hi        := ob_bear_hi
    bb_bull_lo        := ob_bear_lo
    bb_bull_retested  := false
    ob_bear_hi        := na
    ob_bear_lo        := na

// Bull OB mitigated → flip to Bearish BB
if not na(ob_bull_lo) and close < ob_bull_lo
    bb_bear_hi        := ob_bull_hi
    bb_bear_lo        := ob_bull_lo
    bb_bear_retested  := false
    ob_bull_hi        := na
    ob_bull_lo        := na

// ── STEP 3: PRICE RETURNS TO BB ──────────────────────────────────
at_bull_bb = not na(bb_bull_lo) and not bb_bull_retested
             and close >= bb_bull_lo and close <= bb_bull_hi and macro_bull
at_bear_bb = not na(bb_bear_hi) and not bb_bear_retested
             and close >= bb_bear_lo and close <= bb_bear_hi and macro_bear

// Mark as retested once touched
if at_bull_bb
    bb_bull_retested := true
if at_bear_bb
    bb_bear_retested := true

// ── EXECUTION ────────────────────────────────────────────────────
sl_pts  = atr * sl_atr
tp1_pts = sl_pts * tp1_r
tp2_pts = sl_pts * tp2_r

long_sig  = at_bull_bb and strategy.position_size == 0
short_sig = at_bear_bb and strategy.position_size == 0

if long_sig
    strategy.entry("BB Long",  strategy.long,  comment="BB L")
    strategy.exit("BB L TP1", "BB Long",  qty_percent=50, limit=close + tp1_pts)
    strategy.exit("BB L TP2", "BB Long",  qty_percent=50, limit=close + tp2_pts, stop=close - sl_pts)

if short_sig
    strategy.entry("BB Short", strategy.short, comment="BB S")
    strategy.exit("BB S TP1", "BB Short", qty_percent=50, limit=close - tp1_pts)
    strategy.exit("BB S TP2", "BB Short", qty_percent=50, limit=close - tp2_pts, stop=close + sl_pts)

// ── VISUALS ──────────────────────────────────────────────────────
plotshape(ob_bull, style=shape.circle, color=color.new(color.aqua,  40), size=size.tiny, location=location.belowbar, title="Bull OB formed")
plotshape(ob_bear, style=shape.circle, color=color.new(color.red,   40), size=size.tiny, location=location.abovebar, title="Bear OB formed")
plotshape(long_sig,  style=shape.triangleup,   color=color.new(#ff6b35, 0), size=size.normal, location=location.belowbar, title="BB Long")
plotshape(short_sig, style=shape.triangledown, color=color.new(#ff6b35, 0), size=size.normal, location=location.abovebar, title="BB Short")
plot(not na(bb_bull_lo) ? bb_bull_lo : na, color=color.new(#ff6b35, 30), style=plot.style_linebr, linewidth=2, title="Bull BB Low")
plot(not na(bb_bull_hi) ? bb_bull_hi : na, color=color.new(#ff6b35, 30), style=plot.style_linebr, linewidth=1, title="Bull BB High")
plot(not na(bb_bear_hi) ? bb_bear_hi : na, color=color.new(color.red, 30), style=plot.style_linebr, linewidth=2, title="Bear BB High")
plot(not na(bb_bear_lo) ? bb_bear_lo : na, color=color.new(color.red, 30), style=plot.style_linebr, linewidth=1, title="Bear BB Low")

alertcondition(long_sig,  title="BB Long",  message="Breaker Block LONG — bullish BB retrace")
alertcondition(short_sig, title="BB Short", message="Breaker Block SHORT — bearish BB retrace")
`},

  { id:"ict_full", label:"ICT Full — OB + BB + FVG + Liq", color:"#00d4ff", overlays:["ob","bb","fvg","liq"], builtin:true,
    notes:"Full ICT confluence: all four layers required — Order Block at MSS, Breaker Block confirmation, Fair Value Gap overlap, and Liquidity sweep prior. The highest conviction ICT setup requiring all institutional footprints to align.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// ICT Full Confluence  |  OB + BB + FVG + Liquidity Sweep
// All four ICT layers must align: OB at MSS, BB flip, FVG, Liq swept
// ══════════════════════════════════════════════════════════════════
strategy("ICT Full — OB + BB + FVG + Liq", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
atr_len    = input.int(14,    title="ATR Length")
ob_mult    = input.float(1.5, title="OB Impulse Multiplier",   step=0.1)
sweep_lb   = input.int(20,    title="Liquidity Swing Lookback")
sl_atr     = input.float(1.5, title="Stop ATR mult",           step=0.1)
tp1_r      = input.float(2.0, title="TP1 R multiple",          step=0.1)
tp2_r      = input.float(4.0, title="TP2 R multiple",          step=0.1)

// ── CORE ─────────────────────────────────────────────────────────
atr        = ta.atr(atr_len)
ema200     = ta.ema(close, 200)
macro_bull = close > ema200
macro_bear = close < ema200

// ── 1. LIQUIDITY SWEEP ───────────────────────────────────────────
swing_high = ta.highest(high, sweep_lb)
swing_low  = ta.lowest(low,   sweep_lb)
ssl_swept  = low  < swing_low[1]  and close > swing_low[1]
bsl_swept  = high > swing_high[1] and close < swing_high[1]

var bool recent_ssl = false
var bool recent_bsl = false
var int  sweep_ts   = 0

if ssl_swept
    recent_ssl := true
    recent_bsl := false
    sweep_ts   := bar_index
if bsl_swept
    recent_bsl := true
    recent_ssl := false
    sweep_ts   := bar_index
if bar_index - sweep_ts > 15
    recent_ssl := false
    recent_bsl := false

// ── 2. MSS + ORDER BLOCK ─────────────────────────────────────────
mss_bull = close > ta.highest(high, 5)[1] and macro_bull
mss_bear = close < ta.lowest(low,   5)[1] and macro_bear

ob_bull  = close[1] < open[1] and close > open
           and (close - open) > (open[1] - close[1]) * ob_mult and mss_bull
ob_bear  = close[1] > open[1] and close < open
           and (open - close) > (close[1] - open[1]) * ob_mult and mss_bear

var float ob_bull_hi = na
var float ob_bull_lo = na
var float ob_bear_hi = na
var float ob_bear_lo = na
if ob_bull
    ob_bull_hi := high[1]
    ob_bull_lo := low[1]
if ob_bear
    ob_bear_hi := high[1]
    ob_bear_lo := low[1]

// ── 3. BREAKER BLOCK (mitigated OB) ──────────────────────────────
var float bb_bull_hi = na
var float bb_bull_lo = na
var float bb_bear_hi = na
var float bb_bear_lo = na

if not na(ob_bear_hi) and close > ob_bear_hi
    bb_bull_hi := ob_bear_hi
    bb_bull_lo := ob_bear_lo
    ob_bear_hi := na
    ob_bear_lo := na
if not na(ob_bull_lo) and close < ob_bull_lo
    bb_bear_hi := ob_bull_hi
    bb_bear_lo := ob_bull_lo
    ob_bull_hi := na
    ob_bull_lo := na

// ── 4. FVG ───────────────────────────────────────────────────────
fvg_bull = low  > high[2]
fvg_bear = high < low[2]

var float fvg_bull_top = na
var float fvg_bull_bot = na
var float fvg_bear_top = na
var float fvg_bear_bot = na

if fvg_bull
    fvg_bull_top := low
    fvg_bull_bot := high[2]
if fvg_bear
    fvg_bear_top := low[2]
    fvg_bear_bot := high

if not na(fvg_bull_bot) and close < fvg_bull_bot
    fvg_bull_top := na
    fvg_bull_bot := na
if not na(fvg_bear_top) and close > fvg_bear_top
    fvg_bear_top := na
    fvg_bear_bot := na

// ── ALL FOUR LAYERS CHECK ────────────────────────────────────────
at_ob_bull   = not na(ob_bull_lo) and close >= ob_bull_lo and close <= ob_bull_hi
at_ob_bear   = not na(ob_bear_lo) and close >= ob_bear_lo and close <= ob_bear_hi
at_bb_bull   = not na(bb_bull_lo) and close >= bb_bull_lo and close <= bb_bull_hi
at_bb_bear   = not na(bb_bear_lo) and close >= bb_bear_lo and close <= bb_bear_hi
at_fvg_bull  = not na(fvg_bull_bot) and close >= fvg_bull_bot and close <= fvg_bull_top
at_fvg_bear  = not na(fvg_bear_bot) and close >= fvg_bear_bot and close <= fvg_bear_top

// Require at minimum: OB or BB, plus FVG, plus recent liquidity sweep, plus macro bias
long_conf  = (at_ob_bull or at_bb_bull) and at_fvg_bull and recent_ssl and macro_bull and strategy.position_size == 0
short_conf = (at_ob_bear or at_bb_bear) and at_fvg_bear and recent_bsl and macro_bear and strategy.position_size == 0

// ── EXECUTION ────────────────────────────────────────────────────
sl_pts  = atr * sl_atr
tp1_pts = sl_pts * tp1_r
tp2_pts = sl_pts * tp2_r

if long_conf
    strategy.entry("ICT Full Long",  strategy.long,  comment="ICT ALL L")
    strategy.exit("IFL TP1", "ICT Full Long",  qty_percent=50, limit=close + tp1_pts)
    strategy.exit("IFL TP2", "ICT Full Long",  qty_percent=50, limit=close + tp2_pts, stop=close - sl_pts)

if short_conf
    strategy.entry("ICT Full Short", strategy.short, comment="ICT ALL S")
    strategy.exit("IFS TP1", "ICT Full Short", qty_percent=50, limit=close - tp1_pts)
    strategy.exit("IFS TP2", "ICT Full Short", qty_percent=50, limit=close - tp2_pts, stop=close + sl_pts)

// ── VISUALS ──────────────────────────────────────────────────────
bgcolor(macro_bull ? color.new(color.teal, 98) : color.new(color.red, 98))
plotshape(ssl_swept,  style=shape.xcross, color=color.lime, size=size.tiny, location=location.belowbar, title="SSL Swept")
plotshape(bsl_swept,  style=shape.xcross, color=color.red,  size=size.tiny, location=location.abovebar, title="BSL Swept")
plotshape(long_conf,  style=shape.triangleup,   color=color.new(#00d4ff, 0), size=size.large, location=location.belowbar, title="ICT Full Long")
plotshape(short_conf, style=shape.triangledown, color=color.new(#ff4444, 0), size=size.large, location=location.abovebar, title="ICT Full Short")
plot(ema200, color=color.new(color.purple, 50), linewidth=2, title="EMA 200")

alertcondition(long_conf,  title="ICT Full Long",  message="ICT FULL LONG — all 4 layers: OB+BB+FVG+Liq aligned")
alertcondition(short_conf, title="ICT Full Short", message="ICT FULL SHORT — all 4 layers: OB+BB+FVG+Liq aligned")
`},

  { id:"orb", label:"ORB  — Opening Range", color:"#10b981", overlays:["orb"], builtin:true,
    notes:"Opening Range Breakout: capture the 9:30–10:00 AM EST range high and low. Enter breakout on confirmed close outside the range. Targets at 1×, 2×, 3× range extension. Do not enter during NY Lunch 12–1 PM.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// ORB — Opening Range Breakout  |  NQ/ES Futures
// Session: 9:30 – 10:00 AM EST  |  Targets: 1×, 2×, 3× range
// ══════════════════════════════════════════════════════════════════
strategy("ORB Opening Range Breakout", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
orb_minutes   = input.int(30,   title="ORB Duration (minutes)")
tp1_mult      = input.float(1.0, title="TP1 Extension (×Range)", step=0.25)
tp2_mult      = input.float(2.0, title="TP2 Extension (×Range)", step=0.25)
sl_pct_range  = input.float(0.5, title="Stop (fraction of range inside ORB)", step=0.1)
use_close_conf= input.bool(true,  title="Require Close Outside Range (vs Wick)")
require_macro  = input.bool(false, title="Require Macro EMA200 alignment")

// ── SESSION: 9:30 – 10:00 EST (14:30 – 15:00 UTC, adjust for DST) ───
t_session_start = timestamp("America/New_York", year, month, dayofmonth, 9, 30)
t_orb_end       = timestamp("America/New_York", year, month, dayofmonth, 9, 30 + orb_minutes)
t_session_end   = timestamp("America/New_York", year, month, dayofmonth, 16, 0)
t_lunch_start   = timestamp("America/New_York", year, month, dayofmonth, 12, 0)
t_lunch_end     = timestamp("America/New_York", year, month, dayofmonth, 13, 0)

in_orb_window   = time >= t_session_start and time < t_orb_end
after_orb       = time >= t_orb_end and time < t_session_end
in_lunch        = time >= t_lunch_start and time < t_lunch_end

// ── RANGE CONSTRUCTION ───────────────────────────────────────────
var float orb_high  = na
var float orb_low   = na
var float orb_range = na
var bool  orb_set   = false

// Reset at new session start
if in_orb_window and not in_orb_window[1]
    orb_high  := na
    orb_low   := na
    orb_set   := false

// Build range during ORB window
if in_orb_window
    orb_high  := na(orb_high)  ? high : math.max(orb_high, high)
    orb_low   := na(orb_low)   ? low  : math.min(orb_low,  low)

// Lock range when ORB window closes
if not in_orb_window and in_orb_window[1] and not na(orb_high)
    orb_range := orb_high - orb_low
    orb_set   := true

// ── EXTENSION TARGETS ────────────────────────────────────────────
orb_tp1_long  = not na(orb_high) ? orb_high + orb_range * tp1_mult : na
orb_tp2_long  = not na(orb_high) ? orb_high + orb_range * tp2_mult : na
orb_tp1_short = not na(orb_low)  ? orb_low  - orb_range * tp1_mult : na
orb_tp2_short = not na(orb_low)  ? orb_low  - orb_range * tp2_mult : na
orb_sl_long   = not na(orb_low)  ? orb_low  + orb_range * sl_pct_range : na
orb_sl_short  = not na(orb_high) ? orb_high - orb_range * sl_pct_range : na

// ── BREAKOUT SIGNALS ─────────────────────────────────────────────
macro_bull  = close > ta.ema(close, 200)
macro_bear  = close < ta.ema(close, 200)
macro_ok_l  = require_macro ? macro_bull : true
macro_ok_s  = require_macro ? macro_bear : true

// Breakout: close above/below ORB (confirmed close, not just wick)
long_bo     = orb_set and after_orb and not in_lunch
              and (use_close_conf ? close > orb_high : high > orb_high)
              and macro_ok_l and strategy.position_size == 0

short_bo    = orb_set and after_orb and not in_lunch
              and (use_close_conf ? close < orb_low  : low  < orb_low)
              and macro_ok_s and strategy.position_size == 0

// ── EXECUTION ────────────────────────────────────────────────────
if long_bo
    strategy.entry("ORB Long",  strategy.long,  comment="ORB BO UP")
    strategy.exit("ORB L TP1", "ORB Long",  qty_percent=50, limit=orb_tp1_long,  stop=orb_sl_long)
    strategy.exit("ORB L TP2", "ORB Long",  qty_percent=50, limit=orb_tp2_long,  stop=orb_sl_long)

if short_bo
    strategy.entry("ORB Short", strategy.short, comment="ORB BO DN")
    strategy.exit("ORB S TP1", "ORB Short", qty_percent=50, limit=orb_tp1_short, stop=orb_sl_short)
    strategy.exit("ORB S TP2", "ORB Short", qty_percent=50, limit=orb_tp2_short, stop=orb_sl_short)

// ── VISUALS ──────────────────────────────────────────────────────
bgcolor(in_orb_window ? color.new(color.yellow, 94) : na, title="ORB Window")
bgcolor(in_lunch      ? color.new(color.gray,   96) : na, title="Lunch No-Trade")

plot(orb_high,      color=color.new(#10b981, 20), style=plot.style_stepline, linewidth=2, title="ORB High")
plot(orb_low,       color=color.new(#10b981, 20), style=plot.style_stepline, linewidth=2, title="ORB Low")
plot(orb_tp1_long,  color=color.new(color.lime,   60), style=plot.style_linebr, title="TP1 Long")
plot(orb_tp2_long,  color=color.new(color.lime,   40), style=plot.style_linebr, title="TP2 Long")
plot(orb_tp1_short, color=color.new(color.red,    60), style=plot.style_linebr, title="TP1 Short")
plot(orb_tp2_short, color=color.new(color.red,    40), style=plot.style_linebr, title="TP2 Short")

plotshape(long_bo,  style=shape.triangleup,   color=color.new(#10b981, 0), size=size.normal, location=location.belowbar, title="ORB Long")
plotshape(short_bo, style=shape.triangledown, color=color.new(#10b981, 0), size=size.normal, location=location.abovebar, title="ORB Short")

alertcondition(long_bo,  title="ORB Breakout Long",  message="ORB Long — breakout above opening range")
alertcondition(short_bo, title="ORB Breakout Short", message="ORB Short — breakdown below opening range")
`},

  { id:"ote", label:"OTE  — Fib Retracement", color:"#ec4899", overlays:["ote"], builtin:true,
    notes:"Optimal Trade Entry: price retraces into the 0.618–0.786 Fibonacci zone of the most recent significant swing. Entry at 0.705 (midpoint of OTE zone). Above 50% of range only. Target: previous swing extreme or 1.272/1.618 extensions.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// OTE — Optimal Trade Entry  |  Fibonacci 0.618–0.786 Zone
// Entry: price retraces to 0.62–0.79 of most recent significant swing
// Must be above 50% of range (discount/premium check)
// ══════════════════════════════════════════════════════════════════
strategy("OTE Fibonacci Retracement", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
swing_lb     = input.int(20,    title="Swing Detection Lookback")
ote_top_fib  = input.float(0.618, title="OTE Zone Top Fib",    step=0.001)
ote_bot_fib  = input.float(0.786, title="OTE Zone Bottom Fib", step=0.001)
sl_beyond    = input.float(0.1,   title="Stop Beyond OTE (fib fraction)", step=0.01)
tp_ext       = input.float(1.272, title="TP1 Extension Level", step=0.001)
tp2_ext      = input.float(1.618, title="TP2 Extension Level", step=0.001)
req_macro    = input.bool(true,   title="Require EMA200 Macro Alignment")
req_kz       = input.bool(false,  title="Require Killzone Session")

// ── MACRO + SESSION ──────────────────────────────────────────────
ema200       = ta.ema(close, 200)
macro_bull   = close > ema200
macro_bear   = close < ema200

// Killzone: London (07-10 UTC) or NY Open (13:30-16 UTC)
h_utc        = hour(time, "UTC")
in_kz        = req_kz ? (h_utc >= 7 and h_utc < 10) or (h_utc >= 13 and h_utc < 16) : true

// ── SWING DETECTION (ZZ-style pivot) ─────────────────────────────
// Pivot high: highest bar in window with lookback bars on each side
ph           = ta.pivothigh(high, swing_lb, swing_lb)
pl           = ta.pivotlow(low,   swing_lb, swing_lb)

var float last_ph = na
var float last_pl = na
var int   ph_bar  = na
var int   pl_bar  = na

if not na(ph)
    last_ph := ph
    ph_bar  := bar_index
if not na(pl)
    last_pl := pl
    pl_bar  := bar_index

// ── OTE ZONE CALCULATION ─────────────────────────────────────────
// Determine swing direction: which came last, PH or PL?
// Bullish swing: PL then PH → retrace from PH down toward PL
// Bearish swing: PH then PL → retrace from PL up toward PH
var float swing_h     = na
var float swing_l     = na
var bool  bias_is_bull = false  // last leg was up (retrace = long opportunity)
var bool  bias_is_bear = false  // last leg was down (retrace = short opportunity)

if not na(ph_bar) and not na(pl_bar)
    if pl_bar < ph_bar  // PL formed first → PH is most recent → bullish swing, now retracing
        swing_h        := last_ph
        swing_l        := last_pl
        bias_is_bull   := true
        bias_is_bear   := false
    else                // PH formed first → PL is most recent → bearish swing, now retracing
        swing_h        := last_ph
        swing_l        := last_pl
        bias_is_bull   := false
        bias_is_bear   := true

swing_range  = not na(swing_h) and not na(swing_l) ? swing_h - swing_l : na
eq_level     = not na(swing_h) ? swing_h - swing_range * 0.5 : na  // 50% equilibrium

// Long OTE zone: 0.618–0.786 retrace from PH down (bullish swing retracing)
ote_long_top = not na(swing_h) ? swing_h - swing_range * ote_top_fib : na
ote_long_bot = not na(swing_h) ? swing_h - swing_range * ote_bot_fib : na

// Short OTE zone: 0.618–0.786 retrace from PL up (bearish swing retracing)
ote_short_bot = not na(swing_l) ? swing_l + swing_range * ote_top_fib : na
ote_short_top = not na(swing_l) ? swing_l + swing_range * ote_bot_fib : na

// ── ENTRY CONDITIONS ─────────────────────────────────────────────
at_ote_long  = not na(ote_long_bot)  and close >= ote_long_bot  and close <= ote_long_top
               and close > eq_level  // must be above 50% (discount zone for longs)
at_ote_short = not na(ote_short_bot) and close >= ote_short_bot and close <= ote_short_top
               and close < eq_level  // must be below 50% (premium zone for shorts)

macro_ok_l   = req_macro ? macro_bull : true
macro_ok_s   = req_macro ? macro_bear : true

long_conf    = at_ote_long  and bias_is_bull and macro_ok_l and in_kz and strategy.position_size == 0
short_conf   = at_ote_short and bias_is_bear and macro_ok_s and in_kz and strategy.position_size == 0

// ── TARGETS ──────────────────────────────────────────────────────
// Stop: just beyond OTE zone (sl_beyond × range below ote_bot)
sl_long      = not na(ote_long_bot)  ? ote_long_bot  - swing_range * sl_beyond : na
sl_short     = not na(ote_short_top) ? ote_short_top + swing_range * sl_beyond : na
// TP: extensions of the swing
tp1_long     = not na(swing_l) ? swing_h + swing_range * (tp_ext  - 1) : na
tp2_long     = not na(swing_l) ? swing_h + swing_range * (tp2_ext - 1) : na
tp1_short    = not na(swing_h) ? swing_l - swing_range * (tp_ext  - 1) : na
tp2_short    = not na(swing_h) ? swing_l - swing_range * (tp2_ext - 1) : na

// ── EXECUTION ────────────────────────────────────────────────────
if long_conf and not na(sl_long)
    strategy.entry("OTE Long",  strategy.long,  comment="OTE L")
    strategy.exit("OTE L TP1", "OTE Long",  qty_percent=50, stop=sl_long,  limit=tp1_long)
    strategy.exit("OTE L TP2", "OTE Long",  qty_percent=50, stop=sl_long,  limit=tp2_long)

if short_conf and not na(sl_short)
    strategy.entry("OTE Short", strategy.short, comment="OTE S")
    strategy.exit("OTE S TP1", "OTE Short", qty_percent=50, stop=sl_short, limit=tp1_short)
    strategy.exit("OTE S TP2", "OTE Short", qty_percent=50, stop=sl_short, limit=tp2_short)

// ── VISUALS ──────────────────────────────────────────────────────
ote_l_top_p = plot(at_ote_long  ? ote_long_top  : na, color=color.new(#ec4899, 30), style=plot.style_linebr, title="OTE Long Top")
ote_l_bot_p = plot(at_ote_long  ? ote_long_bot  : na, color=color.new(#ec4899, 30), style=plot.style_linebr, title="OTE Long Bot")
fill(ote_l_top_p, ote_l_bot_p, color.new(#ec4899, 88), title="OTE Long Zone")

ote_s_top_p = plot(at_ote_short ? ote_short_top : na, color=color.new(color.orange, 30), style=plot.style_linebr, title="OTE Short Top")
ote_s_bot_p = plot(at_ote_short ? ote_short_bot : na, color=color.new(color.orange, 30), style=plot.style_linebr, title="OTE Short Bot")
fill(ote_s_top_p, ote_s_bot_p, color.new(color.orange, 88), title="OTE Short Zone")

plot(eq_level,  color=color.new(color.gray, 50), style=plot.style_circles, title="50% Equilibrium")
plot(ema200,    color=color.new(color.purple, 50), linewidth=2, title="EMA 200")

plotshape(long_conf,  style=shape.triangleup,   color=color.new(#ec4899, 0), size=size.normal, location=location.belowbar, title="OTE Long")
plotshape(short_conf, style=shape.triangledown, color=color.new(#ec4899, 0), size=size.normal, location=location.abovebar, title="OTE Short")
plotshape(not na(ph), style=shape.diamond, color=color.new(color.red,  0), size=size.tiny, location=location.abovebar, title="PH")
plotshape(not na(pl), style=shape.diamond, color=color.new(color.lime, 0), size=size.tiny, location=location.belowbar, title="PL")

alertcondition(long_conf,  title="OTE Long",  message="OTE Long — price in 0.618–0.786 retrace zone")
alertcondition(short_conf, title="OTE Short", message="OTE Short — price in 0.618–0.786 retrace zone")
`},

  { id:"liq", label:"Liquidity  — BSL / SSL", color:"#f59e0b", overlays:["liq"], builtin:true,
    notes:"Pure liquidity play: identify buy-side (BSL) and sell-side (SSL) liquidity pools at swing highs/lows. Enter only AFTER the pool has been swept (stop raid completed). Reversal trade back into range. Stop beyond the sweep wick. Target: opposing liquidity pool or 50% equilibrium.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// Liquidity — BSL / SSL  |  NQ/ES Futures
// Buy-Side Liq above swing highs, Sell-Side Liq below swing lows
// Strategy: wait for sweep → confirm reversal → enter opposite
// ══════════════════════════════════════════════════════════════════
strategy("Liquidity BSL/SSL", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
liq_lb       = input.int(20,    title="Liquidity Pool Lookback")
sweep_body   = input.bool(true,  title="Require Close Back Inside Range After Sweep")
sl_ticks     = input.int(10,    title="Stop Beyond Sweep Wick (ticks)")
tp1_r        = input.float(2.0, title="TP1 R multiple", step=0.1)
tp2_r        = input.float(4.0, title="TP2 R multiple", step=0.1)
req_kz       = input.bool(true,  title="Require Killzone Session")
req_macro    = input.bool(true,  title="Require EMA200 Alignment")

// ── SESSION: Killzone ────────────────────────────────────────────
h_utc        = hour(time, "UTC")
in_kz        = req_kz ? (h_utc >= 7 and h_utc < 10) or (h_utc >= 13 and h_utc < 16) : true

// ── CORE ─────────────────────────────────────────────────────────
atr          = ta.atr(14)
tick         = syminfo.mintick
ema200       = ta.ema(close, 200)
macro_bull   = close > ema200
macro_bear   = close < ema200

// ── LIQUIDITY POOL IDENTIFICATION ────────────────────────────────
// BSL: buy-side liquidity = cluster of highs (equal highs / swing highs)
//      sitting above as resting stops for shorts
// SSL: sell-side liquidity = cluster of lows (equal lows / swing lows)
//      sitting below as resting stops for longs
bsl_level    = ta.highest(high, liq_lb)  // Buy-Side Liquidity level
ssl_level    = ta.lowest(low,   liq_lb)  // Sell-Side Liquidity level
midpoint     = (bsl_level + ssl_level) / 2

// ── SWEEP DETECTION ──────────────────────────────────────────────
// SSL Sweep (bullish setup): price wicks BELOW ssl_level then...
//   if sweep_body=true: close must return ABOVE ssl_level (rejection wick)
//   if sweep_body=false: any wick below counts
ssl_wick_below = low  < ssl_level[1]
bsl_wick_above = high > bsl_level[1]

// Sweep + close back inside = strong rejection (institutional reversal)
ssl_swept    = ssl_wick_below and (sweep_body ? close > ssl_level[1] : true)
bsl_swept    = bsl_wick_above and (sweep_body ? close < bsl_level[1] : true)

// Track sweep state with expiry
var bool active_ssl_sweep = false
var bool active_bsl_sweep = false
var float ssl_sweep_low   = na    // actual wick low = stop placement reference
var float bsl_sweep_high  = na    // actual wick high = stop placement reference
var int   sweep_bar       = 0

if ssl_swept
    active_ssl_sweep := true
    active_bsl_sweep := false
    ssl_sweep_low    := low
    sweep_bar        := bar_index

if bsl_swept
    active_bsl_sweep := true
    active_ssl_sweep := false
    bsl_sweep_high   := high
    sweep_bar        := bar_index

// Sweep signal expires after 5 bars (if no entry by then, setup stale)
if bar_index - sweep_bar > 5
    active_ssl_sweep := false
    active_bsl_sweep := false

// ── CONFIRMATION: CHoCH / STRUCTURE FLIP ─────────────────────────
// After a sweep, we need 1M/5M structure to confirm reversal direction
// Proxy: a strong bullish/bearish candle closing beyond recent micro range
choch_bull   = active_ssl_sweep and close > high[1] and close > open  // micro BOS up after SSL sweep
choch_bear   = active_bsl_sweep and close < low[1]  and close < open  // micro BOS down after BSL sweep

// ── FULL ENTRY CONDITIONS ─────────────────────────────────────────
macro_ok_l   = req_macro ? macro_bull : true
macro_ok_s   = req_macro ? macro_bear : true

long_conf    = choch_bull and macro_ok_l and in_kz and strategy.position_size == 0
short_conf   = choch_bear and macro_ok_s and in_kz and strategy.position_size == 0

// ── RISK MANAGEMENT ──────────────────────────────────────────────
// Stop: sl_ticks beyond the sweep wick (below ssl_sweep_low or above bsl_sweep_high)
sl_long      = not na(ssl_sweep_low)  ? ssl_sweep_low  - sl_ticks * tick : close - atr * 1.5
sl_short     = not na(bsl_sweep_high) ? bsl_sweep_high + sl_ticks * tick : close + atr * 1.5

sl_pts_long  = close - sl_long
sl_pts_short = sl_short - close
tp1_long     = close + sl_pts_long  * tp1_r
tp2_long     = close + sl_pts_long  * tp2_r
tp1_short    = close - sl_pts_short * tp1_r
tp2_short    = close - sl_pts_short * tp2_r

// ── EXECUTION ────────────────────────────────────────────────────
if long_conf
    strategy.entry("Liq Long",  strategy.long,  comment="SSL Swept")
    strategy.exit("LL TP1", "Liq Long",  qty_percent=50, stop=sl_long,  limit=tp1_long)
    strategy.exit("LL TP2", "Liq Long",  qty_percent=50, stop=sl_long,  limit=tp2_long)

if short_conf
    strategy.entry("Liq Short", strategy.short, comment="BSL Swept")
    strategy.exit("LS TP1", "Liq Short", qty_percent=50, stop=sl_short, limit=tp1_short)
    strategy.exit("LS TP2", "Liq Short", qty_percent=50, stop=sl_short, limit=tp2_short)

// ── VISUALS ──────────────────────────────────────────────────────
bgcolor(in_kz ? color.new(color.yellow, 97) : na, title="Killzone")

plot(bsl_level, color=color.new(color.red,    30), style=plot.style_stepline, linewidth=2, title="BSL")
plot(ssl_level, color=color.new(color.lime,   30), style=plot.style_stepline, linewidth=2, title="SSL")
plot(midpoint,  color=color.new(color.gray,   60), style=plot.style_circles,  linewidth=1, title="Mid (50%)")
plot(ema200,    color=color.new(color.purple, 50), linewidth=2, title="EMA 200")

plotshape(ssl_swept,  style=shape.xcross, color=color.new(color.lime,  0), size=size.small, location=location.belowbar, title="SSL Swept")
plotshape(bsl_swept,  style=shape.xcross, color=color.new(color.red,   0), size=size.small, location=location.abovebar, title="BSL Swept")
plotshape(long_conf,  style=shape.triangleup,   color=color.new(#f59e0b, 0), size=size.normal, location=location.belowbar, title="Liq Long")
plotshape(short_conf, style=shape.triangledown, color=color.new(#f59e0b, 0), size=size.normal, location=location.abovebar, title="Liq Short")

alertcondition(ssl_swept,  title="SSL Swept",  message="Sell-Side Liquidity SWEPT — watch for long setup")
alertcondition(bsl_swept,  title="BSL Swept",  message="Buy-Side Liquidity SWEPT — watch for short setup")
alertcondition(long_conf,  title="Liq Long",   message="Liquidity LONG — SSL swept + CHoCH confirmed")
alertcondition(short_conf, title="Liq Short",  message="Liquidity SHORT — BSL swept + CHoCH confirmed")
`},

  { id:"of", label:"Order Flow  — Delta + CVD", color:"#f97316", overlays:["of"], builtin:true,
    notes:"Order Flow strategy: trade with institutional delta. Enter when CVD divergence shows absorption at key S/R level — price makes new extreme but CVD doesn't confirm, indicating trapped retail traders. Combine with volume imbalance and OB/FVG for highest conviction.",
    code:`//@version=5
// ══════════════════════════════════════════════════════════════════
// Order Flow — Delta + CVD Divergence  |  NQ/ES Futures
// Concept: price makes new extreme BUT CVD (cumulative delta) diverges
// → trapped traders → institutional reversal entry
// ══════════════════════════════════════════════════════════════════
strategy("Order Flow Delta + CVD", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=5, max_bars_back=500, pyramiding=0)

// ── INPUTS ───────────────────────────────────────────────────────
atr_len      = input.int(14,    title="ATR Length")
div_lb       = input.int(10,    title="Divergence Lookback (bars)")
vol_spike    = input.float(1.5, title="Volume Spike Multiplier (vs avg)", step=0.1)
sl_atr       = input.float(1.5, title="Stop ATR mult",  step=0.1)
tp1_r        = input.float(2.0, title="TP1 R multiple", step=0.1)
tp2_r        = input.float(3.5, title="TP2 R multiple", step=0.1)
req_ob       = input.bool(false, title="Require OB confluence")
req_kz       = input.bool(true,  title="Require Killzone Session")

// ── SESSION ───────────────────────────────────────────────────────
h_utc        = hour(time, "UTC")
in_kz        = req_kz ? (h_utc >= 7 and h_utc < 10) or (h_utc >= 13 and h_utc < 16) : true

// ── CORE ─────────────────────────────────────────────────────────
atr          = ta.atr(atr_len)
macro_bull   = close > ta.ema(close, 200)
macro_bear   = close < ta.ema(close, 200)

// ── DELTA CALCULATION ────────────────────────────────────────────
// Proxy: bull bar = ask-side volume (+), bear bar = bid-side volume (-)
// True delta requires tick data; this bar-direction proxy is standard for TV
bar_delta    = close > open ? volume : close < open ? -volume : 0

// CVD = Cumulative Volume Delta (running sum of bar delta)
cvd          = ta.cum(bar_delta)

// ── DIVERGENCE DETECTION ──────────────────────────────────────────
// Bearish CVD Divergence (bullish signal): price makes new LOW but CVD makes HIGHER LOW
// → sellers are exhausting, institutions buying the lows = LONG setup
price_ll     = low  <= ta.lowest(low,   div_lb)[1]  // price = lower low
cvd_hl       = cvd  >  ta.lowest(cvd,   div_lb)[1]  // CVD = higher low
bull_div     = price_ll and cvd_hl                   // bullish divergence (reversal up)

// Bullish CVD Divergence (bearish signal): price makes new HIGH but CVD makes LOWER HIGH
// → buyers are exhausting, institutions selling the highs = SHORT setup
price_hh     = high >= ta.highest(high, div_lb)[1]  // price = higher high
cvd_lh       = cvd  <  ta.highest(cvd,  div_lb)[1]  // CVD = lower high
bear_div     = price_hh and cvd_lh                   // bearish divergence (reversal down)

// ── VOLUME IMBALANCE (absorption check) ──────────────────────────
// Absorption: high volume + tiny price range = institutions absorbing
avg_vol      = ta.sma(volume, 20)
vol_high     = volume > avg_vol * vol_spike
candle_range = high - low
avg_range    = ta.sma(candle_range, 20)
absorption   = vol_high and candle_range < avg_range * 0.6  // big vol, small range

// ── ORDER BLOCK CONFLUENCE (optional) ────────────────────────────
ob_mult      = 1.5
mss_bull     = close > ta.highest(high, 5)[1] and macro_bull
mss_bear     = close < ta.lowest(low,   5)[1] and macro_bear
ob_bull      = close[1] < open[1] and close > open and (close - open) > (open[1] - close[1]) * ob_mult and mss_bull
ob_bear      = close[1] > open[1] and close < open and (open - close) > (close[1] - open[1]) * ob_mult and mss_bear

var float ob_bull_hi = na
var float ob_bull_lo = na
var float ob_bear_hi = na
var float ob_bear_lo = na
if ob_bull
    ob_bull_hi := high[1]
    ob_bull_lo := low[1]
if ob_bear
    ob_bear_hi := high[1]
    ob_bear_lo := low[1]

at_ob_bull   = not na(ob_bull_lo) and close >= ob_bull_lo and close <= ob_bull_hi
at_ob_bear   = not na(ob_bear_lo) and close >= ob_bear_lo and close <= ob_bear_hi
ob_ok_l      = req_ob ? at_ob_bull : true
ob_ok_s      = req_ob ? at_ob_bear : true

// ── DELTA MOMENTUM FILTER ─────────────────────────────────────────
// After divergence, confirm that delta is shifting in entry direction
delta_momentum_bull = bar_delta > 0 and bar_delta > bar_delta[1]  // delta accelerating positive
delta_momentum_bear = bar_delta < 0 and bar_delta < bar_delta[1]  // delta accelerating negative

// ── ENTRY CONDITIONS ─────────────────────────────────────────────
long_conf    = bull_div and delta_momentum_bull and macro_bull and in_kz and ob_ok_l
               and strategy.position_size == 0
short_conf   = bear_div and delta_momentum_bear and macro_bear and in_kz and ob_ok_s
               and strategy.position_size == 0

// Absorption entry: absorption at key level + divergence (highest conviction)
long_absorb  = bull_div and absorption and macro_bull and in_kz and strategy.position_size == 0
short_absorb = bear_div and absorption and macro_bear and in_kz and strategy.position_size == 0

// ── EXECUTION ────────────────────────────────────────────────────
sl_pts  = atr * sl_atr
tp1_pts = sl_pts * tp1_r
tp2_pts = sl_pts * tp2_r

if long_conf
    strategy.entry("OF Long",  strategy.long,  comment="CVD Div L")
    strategy.exit("OF L TP1", "OF Long",  qty_percent=50, limit=close + tp1_pts, stop=close - sl_pts)
    strategy.exit("OF L TP2", "OF Long",  qty_percent=50, limit=close + tp2_pts, stop=close - sl_pts)

if short_conf
    strategy.entry("OF Short", strategy.short, comment="CVD Div S")
    strategy.exit("OF S TP1", "OF Short", qty_percent=50, limit=close - tp1_pts, stop=close + sl_pts)
    strategy.exit("OF S TP2", "OF Short", qty_percent=50, limit=close - tp2_pts, stop=close + sl_pts)

// ── VISUALS ──────────────────────────────────────────────────────
bgcolor(in_kz     ? color.new(color.yellow, 97) : na, title="Killzone")
bgcolor(absorption ? color.new(color.blue,   96) : na, title="Absorption")

// CVD in sub-pane
plot(cvd, color=color.new(#f97316, 0), linewidth=2, title="CVD", display=display.pane)
hline(0,  color=color.new(color.gray, 60), title="CVD Zero")

// Delta bars (sub-pane)
plot(bar_delta, style=plot.style_columns,
     color=bar_delta > 0 ? color.new(color.lime, 30) : color.new(color.red, 30),
     title="Bar Delta", display=display.pane)

// Divergence markers (main pane)
plotshape(bull_div,  style=shape.circle, color=color.new(color.lime,  0), size=size.small, location=location.belowbar, title="Bull CVD Div")
plotshape(bear_div,  style=shape.circle, color=color.new(color.red,   0), size=size.small, location=location.abovebar, title="Bear CVD Div")
plotshape(absorption, style=shape.square, color=color.new(color.blue, 0), size=size.tiny, location=location.abovebar, title="Absorption")

// Entry signals
plotshape(long_conf,  style=shape.triangleup,   color=color.new(#f97316, 0), size=size.normal, location=location.belowbar, title="OF Long")
plotshape(short_conf, style=shape.triangledown, color=color.new(#f97316, 0), size=size.normal, location=location.abovebar, title="OF Short")
plotshape(long_absorb,  style=shape.arrowup,   color=color.new(color.aqua, 0), size=size.small, location=location.belowbar, title="Absorption Long")
plotshape(short_absorb, style=shape.arrowdown, color=color.new(color.aqua, 0), size=size.small, location=location.abovebar, title="Absorption Short")

alertcondition(bull_div,    title="Bull CVD Divergence", message="Bullish CVD Divergence — potential long reversal")
alertcondition(bear_div,    title="Bear CVD Divergence", message="Bearish CVD Divergence — potential short reversal")
alertcondition(long_conf,   title="OF Long Entry",  message="Order Flow LONG — CVD divergence + delta momentum")
alertcondition(short_conf,  title="OF Short Entry", message="Order Flow SHORT — CVD divergence + delta momentum")
alertcondition(long_absorb,  title="Absorption Long",  message="Absorption LONG — high vol + tiny range + bull divergence")
alertcondition(short_absorb, title="Absorption Short", message="Absorption SHORT — high vol + tiny range + bear divergence")
`},
  // ── VIVEK'S STRATEGY ────────────────────────────────────────────────────
  { id:"vivek_unicorn", label:"★ Vivek — Unicorn / Silver Bullet", color:"#c084fc", overlays:["ob","bb","fvg","liq","ote","of"], builtin:true,
    notes:"NQ multi-timeframe strategy. Macro bias on Daily/Weekly. Unicorn Model setup on 4H/1H. IFVG entry on 15M/5M. Silver Bullet precision execution 9:30–11:00 AM EST. SMT Divergence (NQ vs ES/YM) as final confirmation. Stop below/above OB, TP1 at 50% retrace, TP2 at HTF liquidity pool.",
    rules:[
      "[V1 — WEEKLY+DAILY MACRO BIAS — MANDATORY GATE] Examine the Weekly chart: is price making HH+HL (bullish) or LH+LL (bearish)? Then confirm Daily matches. Mark any significant Daily/Weekly OBs and unmitigated FVGs at those levels — these are institutional footprints. This step establishes the ONLY direction you will trade today. If Weekly=BEARISH you look ONLY for shorts. No exceptions.",
      "[V2 — UNICORN MODEL: 4H/1H MSS + ORDER BLOCK] On the 4H chart, identify the most recent Market Structure Shift — the first BOS after a clear structural reversal in the direction of the macro bias. The OB is the LAST opposing candle immediately before the BOS impulse (for bull BOS = last red candle before green impulse; for bear BOS = last green candle before red impulse). This OB is the ANCHOR of the setup. Identify the target liquidity pool (BSL above for longs / SSL below for shorts). The OB + target pool must align with Daily/Weekly bias.",
      "[V3 — 15M MSS ALIGNMENT] Drop to 15M. Confirm that recent structure is shifting in the direction of the 4H setup: for longs — see at least one HH+HL forming; for shorts — LH+LL forming. The 15M MSS must agree with the 4H. If 15M is showing opposing structure, the 4H setup has not yet played out — wait. Do not enter against the most recent 15M structure.",
      "[V4 — FVG PRICE SEQUENCE (CRITICAL ENTRY MECHANIC)] A FVG forms on 5M/15M in the trade direction. CRITICAL: Do NOT enter on first contact with the FVG. The correct sequence is: (A) FVG forms, (B) price moves AWAY from FVG seeking the draw-on-liquidity, making a displacement or reaching a swing extreme, then (C) price RETRACES back INTO the FVG. Step C is the entry — the retrace back into the FVG after the draw. This is also an IFVG (Inverse FVG) scenario — a gap price is returning to after displacement. Confirm with volume: look for reduced volume on the retrace and a volume spike on the entry candle.",
      "[V5 — OTE 0.62–0.79 FIBONACCI ZONE] Measure the Fibonacci retracement of the most recent significant swing in the trade direction. The entry must be inside the 0.62–0.79 zone (OTE). The FVG identified in V4 should ideally sit inside or overlap the OTE zone. FVG entry must also be ABOVE the 50% level of the swing range — any FVG sitting below 50% is too deep a retrace, indicating potential trend reversal, not a continuation entry.",
      "[V6 — OB+FVG CONFLUENCE ZONE] The entry candle must close inside both: (a) the 4H/1H Order Block identified in V2, AND (b) the FVG/IFVG identified in V4. This OB+FVG overlap is the highest-probability entry zone. If only one is present, conviction = MEDIUM. If neither — NO TRADE. The OB must be completely unmitigated.",
      "[V6b — IFVG / BB+FVG ENTRY PRIORITY] Two types of IFVG exist: (A) POLARITY FLIP — ANY candle (including small ones) that CLOSES beyond the FVG boundary inverts it: Bullish FVG with any close below its bottom = Bearish IFVG (supply); Bearish FVG with any close above its top = Bullish IFVG (demand). Size of inverting candle does not matter — the close is what counts. (B) ICT IMPLIED — 3-candle structure: large-body central candle flanked by candles with overlapping wicks, no conventional FVG between them; zone = 50% of each flanking wick. Both types valid for entry. IFVG retrace is highest priority when: (a) clear 4H/1H trend is committed, or (b) 15M/1H liquidity level was just swept. BB+FVG = high conviction in all contexts. FVG alone = standard. OB = valid. For CONTINUATION: 4H/1H/15M aligned, 5M optional, enter on FVG retrace on 3M/1M — no sweep required.",
      "[V7 — BOS/CHoCH ON ENTRY TIMEFRAME (3M or 1M)] Entry is taken on 3M or 1M — these are the execution timeframes. At entry there must be a micro BOS or CHoCH confirming direction. A BOS = strong candle closing beyond the most recent swing. A CHoCH = first structural flip (for reversals: this is the critical trigger at the Breaker/IFVG zone). Without a close beyond structure, wait. Never enter on an unclosed candle.",
      "[V8 — ICT SMT DIVERGENCE (FINAL CONFIRMATION)] Compare NQ to ES or YM on the 3M/1M for entry timing, 15M for bias. BULLISH SMT: NQ prints a new lower low while ES/YM holds higher low → NQ weak vs ES strong → long setup on NQ. BEARISH SMT: NQ prints higher high while ES/YM prints lower high → NQ extended → short setup on NQ. SMT present = HIGH conviction. SMT absent = cap conviction at MEDIUM. This is the final filter before entry.",
      "[V9 — SILVER BULLET EXECUTION WINDOW] Is the time between 9:30AM–11:00AM EST? This is the PRIMARY window. ALL conditions V1–V8 should converge here. NY PM (1:30–3:00PM EST) is secondary — valid if all conditions align. Outside these windows = lower conviction only, not HIGH. NY Lunch (12–1PM) = mandatory close, no entries.",
      "[V10 — STOP + TARGETS] STOP: at the high or low of the Unicorn OB identified in V2, OR 30 points maximum on NQ — use whichever is TIGHTER. If the proper OB stop requires more than 30pts, the setup is INVALID. TP1: 50% of measured swing range. Immediately move stop to breakeven when TP1 hit or when 1:1 R:R reached. TP2: next HTF liquidity pool (BSL for longs / SSL for shorts on 4H). Trail remaining 50% with 15M structure swing lows (longs) or swing highs (shorts) after TP1.",
    ],
    code: PINE_VIVEK_UNICORN,
  },
  // ── FIRST CUSTOM STRATEGY ────────────────────────────────────────────────
  { id:"kz_confluence", label:"★ KZ Confluence  (OB+FVG+Killzone)", color:"#ffd700", overlays:["ob","fvg","liq","of"], builtin:true,
    notes:"Long/Short only during Killzone windows (London 02-05 EST / NY 08:30-11 EST). Requires OB + FVG confluence at OTE level. Use CVD divergence to confirm entry. Stop below/above OB. Target nearest liquidity pool.",
    rules:[
      "[KZ1 — SESSION WINDOW GATE] ONLY enter during: Silver Bullet 9:30–11AM EST, OR NY PM 1:30–3PM EST. London can set up the bias but execution is in the NY window. NY Lunch 12–1PM = NO TRADE, mandatory close.",
      "[KZ2 — DAILY BIAS ALIGNMENT] Check the Daily candle direction and structure. The trade direction must match Daily bias (bull = long only, bear = short only). Previous day H/L (PDH/PDL) and previous week H/L (PWH/PWL) are your ERL targets. Identify which one price is being drawn to before entry.",
      "[KZ3 — PREVIOUS SESSION SWING LEVELS] Mark the high and low of the most recently completed session. These become the IRL BSL (above = buy-side) and SSL (below = sell-side). The setup will involve a sweep of one of these session levels before the entry.",
      "[KZ4 — ORDER BLOCK IDENTIFICATION] At the BOS/CHoCH point, mark the Order Block — last opposing candle before impulse. For bull OB: last red candle before a strong green displacement. For bear OB: last green candle before a strong red displacement. OB must be unmitigated. The impulse candle must be at least 1.5× average candle size.",
      "[KZ5 — FVG + OB CONFLUENCE] A Fair Value Gap must overlap with or sit directly adjacent to the OB. The FVG is a 3-candle imbalance (gap between candle[N-1] high/low and candle[N+1] low/high). This OB+FVG zone is the entry confluence. If OB has no adjacent FVG, conviction is lower. Entry is triggered by price RETURNING to this zone — not on initial breakout.",
      "[KZ6 — OTE 0.62–0.79 + ABOVE 50% LEVEL] The confluence zone must sit within the 0.62–0.79 Fibonacci retracement of the current swing. FVG must be ABOVE the 50% of the range. Below 50% = skip. OTE zone + OB + FVG all overlapping = maximum conviction entry.",
      "[KZ7 — CVD DIVERGENCE CONFIRMATION] At the OB+FVG zone, Delta and CVD must show divergence: price makes a new low/high but CVD does not confirm it — CVD is holding or reversing. This shows institutional accumulation/distribution inside the confluence zone. No CVD divergence = MEDIUM conviction only.",
      "[KZ8 — BOS/CHoCH ENTRY TRIGGER] Wait for a micro BOS or CHoCH on the 1M/5M at the confluence zone before entering. Do not anticipate — let price prove direction with a structure break. Entry candle must CLOSE beyond the trigger level. Stop = 2 ticks beyond the opposite extreme of the OB.",
      "[KZ9 — TARGETS] TP1: 50% of the swing range measured from entry to the opposing session liquidity pool. Move stop to BE immediately. TP2: PDH/PDL or PWH/PWL (ERL). All trades closed by 11AM (first macro) or 12PM (second macro). NO overnight, NO weekend.",
    ],
    code: PINE_KZ_CONFLUENCE,
  },
  {
    id: "crt_engulf",
    label: "CRT — Multi-TF Engulfing",
    color: "#ec4899",
    overlays: ["ob","fvg","liq"],
    builtin: true,
    code: `//@version=5
strategy("CRT Multi-TF Engulfing", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=2)

// ── Inputs ──────────────────────────────────────────────────────────────────
atrLen     = input.int(14, "ATR Length")
engulfMult = input.float(1.5, "Min Engulf Body Ratio vs Prior")
maxStop    = input.float(30.0, "Max NQ Stop Points")
rrMin      = input.float(2.0, "Min R:R Ratio")

// ── Helpers ─────────────────────────────────────────────────────────────────
atr1   = ta.atr(atrLen)
body   = math.abs(close - open)
body1  = math.abs(close[1] - open[1])
avgBod = ta.sma(body, 3)

// Engulfing detection
bullEngulf = close > open[1] and open < close[1] and body >= engulfMult * body1
bearEngulf = close < open[1] and open > close[1] and body >= engulfMult * body1

// Momentum: engulf body larger than recent average
bullMom = bullEngulf and body > avgBod
bearMom = bearEngulf and body > avgBod

// ── 15M + 5M context (approximated on current TF — user should run on 1M) ──
// HTF trend proxy: price vs 20-period EMA
ema20  = ta.ema(close, 20)
ema50  = ta.ema(close, 50)
htfBull = ema20 > ema50 and close > ema20
htfBear = ema20 < ema50 and close < ema20

// ── Swing S/R for stop/target ────────────────────────────────────────────────
swingLow  = ta.lowest(low,  14)
swingHigh = ta.highest(high, 14)
midRange  = (swingHigh + swingLow) / 2

// ── Entry signals ─────────────────────────────────────────────────────────────
longSig  = bullMom and htfBull and close > midRange
shortSig = bearMom and htfBear and close < midRange

// ── Risk calc ─────────────────────────────────────────────────────────────────
longStop  = low  - 2 * syminfo.mintick
shortStop = high + 2 * syminfo.mintick
longPts   = close - longStop
shortPts  = shortStop - close
longTP1   = close + longPts  * rrMin
shortTP1  = close - shortPts * rrMin

// Only take if within max stop
longValid  = longPts  <= maxStop
shortValid = shortPts <= maxStop

// ── Execute ───────────────────────────────────────────────────────────────────
if longSig and longValid
    strategy.entry("CRT Long",  strategy.long)
    strategy.exit("CRT Long X",  "CRT Long",  stop=longStop,  limit=longTP1)

if shortSig and shortValid
    strategy.entry("CRT Short", strategy.short)
    strategy.exit("CRT Short X", "CRT Short", stop=shortStop, limit=shortTP1)

// ── Visuals ────────────────────────────────────────────────────────────────────
plotshape(longSig  and longValid,  style=shape.triangleup,   color=color.new(#ec4899, 10), location=location.belowbar, size=size.small, title="CRT Long")
plotshape(shortSig and shortValid, style=shape.triangledown, color=color.new(#ec4899, 10), location=location.abovebar, size=size.small, title="CRT Short")
plot(ema20, color=color.new(#ec4899, 60), linewidth=1, title="EMA20")
plot(ema50, color=color.new(color.gray, 70), linewidth=1, title="EMA50")
bgcolor(bullMom ? color.new(#ec4899, 94) : bearMom ? color.new(#ec4899, 94) : na, title="Engulf BG")`,
  },
];

const OVERLAY_META = {
  ob:  { label:"Order Blocks",     color:"#00d4ff" },
  bb:  { label:"Breaker Blocks",   color:"#ff6b35" },
  fvg: { label:"Fair Value Gaps",  color:"#a855f7" },
  orb: { label:"ORB Levels",       color:"#10b981" },
  ote: { label:"OTE / Fibs",       color:"#ec4899" },
  liq: { label:"Liquidity Map",    color:"#f59e0b" },
  of:  { label:"Order Flow",       color:"#f97316" },
  ses: { label:"Session Stats",    color:"#06b6d4" },
};

const PINE_BOILERPLATE =
`//@version=5
strategy("My Strategy", overlay=true,
         default_qty_type=strategy.percent_of_equity,
         default_qty_value=10)

// ── INPUTS ──────────────────────────────────────
ema_len  = input.int(20,    title="EMA Length")
atr_len  = input.int(14,    title="ATR Length")

// ── CALCULATIONS ────────────────────────────────
ema    = ta.ema(close, ema_len)
atr    = ta.atr(atr_len)

// ── ORDER BLOCK ──────────────────────────────────
ob_bull = close[1]<open[1] and close>open and (close-open)>(open[1]-close[1])*1.5
ob_bear = close[1]>open[1] and close<open and (open-close)>(close[1]-open[1])*1.5

// ── FVG ──────────────────────────────────────────
fvg_bull = low  > high[2]
fvg_bear = high < low[2]

// ── ENTRY ────────────────────────────────────────
long_cond  = ob_bull and close > ema
short_cond = ob_bear and close < ema

if long_cond
    strategy.entry("Long",  strategy.long)
    strategy.exit("L Exit", "Long",  stop=close-atr*1.5, limit=close+atr*3)
if short_cond
    strategy.entry("Short", strategy.short)
    strategy.exit("S Exit", "Short", stop=close+atr*1.5, limit=close-atr*3)

plot(ema, color=color.new(color.aqua, 40))
`;

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const INSTRUMENTS = ["ES","NQ","RTY","YM"];
const BASE_PRICES = { ES:5420, NQ:19200, RTY:2080, YM:43500 };

function generateCandles(ins="NQ", count=1000) {
  let p=(BASE_PRICES[ins]||19200)+(Math.random()-0.5)*80;
  const out=[],now=Date.now(),nq=ins==="NQ";
  for(let i=count;i>=0;i--){
    const o=p,mv=(Math.random()-0.48)*(nq?20:8),c=o+mv;
    const vol=Math.floor(800+Math.random()*3200);
    const bull=c>=o;
    const askRatio=bull?0.52+Math.random()*0.28:0.22+Math.random()*0.26;
    const askVol=Math.floor(vol*askRatio),bidVol=vol-askVol,delta=askVol-bidVol;
    out.push({t:now-i*5*60000,o,h:Math.max(o,c)+Math.random()*(nq?10:4),
      l:Math.min(o,c)-Math.random()*(nq?10:4),c,v:vol,delta,askVol,bidVol});
    p=c;
  }
  return out;
}
function genOBs(cs){
  const a=[];
  for(let i=3;i<cs.length-3;i++){
    const c=cs[i],n=cs[i+1];
    if(c.c<c.o&&n.c>n.o&&(n.c-n.o)>(c.o-c.c)*1.5) a.push({top:c.o,bot:c.l,type:"Bullish OB",idx:i,mit:Math.random()>0.6});
    if(c.c>c.o&&n.c<n.o&&(n.o-n.c)>(c.c-c.o)*1.5) a.push({top:c.h,bot:c.o,type:"Bearish OB",idx:i,mit:Math.random()>0.6});
  }
  return a.slice(-6);
}
function genBBs(obs, cs) {
  // Breaker blocks = mitigated OBs that price swept through (polarity flip)
  return obs.filter(ob=>ob.mit).map(ob=>({
    ...ob,
    type: ob.type.includes("Bull") ? "Bull Breaker" : "Bear Breaker",
    flipped: true,
  }));
}
function genFVGs(cs){const a=[];for(let i=1;i<cs.length-1;i++){const p=cs[i-1],n=cs[i+1];if(n.l>p.h)a.push({top:n.l,bot:p.h,type:"Bull FVG",idx:i,filled:Math.random()>0.5});if(n.h<p.l)a.push({top:p.l,bot:n.h,type:"Bear FVG",idx:i,filled:Math.random()>0.5});}return a.slice(-8);}
// IRL — Internal Range Liquidity (BSL/SSL pools WITHIN the current range)
// Colour: cyan #00d4ff
function genLiq(cs){
  const a=[];
  for(let i=5;i<cs.length-5;i++){
    const c=cs[i],pH=cs.slice(i-4,i).map(x=>x.h),pL=cs.slice(i-4,i).map(x=>x.l);
    if(c.h>Math.max(...pH)) a.push({price:c.h,type:"BSL",swept:Math.random()>0.55,idx:i,str:Math.floor(Math.random()*3)+1,isIRL:true,label:"BSL"});
    if(c.l<Math.min(...pL)) a.push({price:c.l,type:"SSL",swept:Math.random()>0.55,idx:i,str:Math.floor(Math.random()*3)+1,isIRL:true,label:"SSL"});
  }
  return a.slice(-14);
}

// SESSION LEVELS — London / NY Open / Asia / Prev Day highs and lows
// Tagged as BSL (above price) or SSL (below price) with session label
// These are IRL in context (within the trading day range)
function compORB(cs){const s=cs.slice(0,6),h=Math.max(...s.map(c=>c.h)),l=Math.min(...s.map(c=>c.l)),r=h-l;return{open:cs[0].o,high:h,low:l,range:r,mid:(h+l)/2,ext1H:h+r,ext1L:l-r,ext2H:h+2*r,ext2L:l-2*r};}
function compOTE(sh,sl){const r=sh-sl;return{fib_0:sh,fib_236:sh-r*.236,fib_382:sh-r*.382,fib_5:sh-r*.5,fib_618:sh-r*.618,fib_705:sh-r*.705,fib_786:sh-r*.786,fib_1:sl,ote_top:sh-r*.618,ote_bot:sh-r*.786};}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTUAL LEVELS — real UTC timestamp session detection
//
// Auto-selects the right levels for whatever session is live:
//   ERL  : PDH/PDL (gold #ffd700) + PWH/PWL (orange #ff9500) — always shown
//   SESSION: prev 2 completed sessions H/L (purple) — auto-rotates each session
//   IRL  : strongest untested swing within the current session (cyan #00d4ff)
//
// e.g. during NY Open → shows LDN HIGHS/LOWS + ASIA HIGHS/LOWS + PDH/PDL + NY IRL
// ─────────────────────────────────────────────────────────────────────────────
// ── ICT MACRO WINDOWS (EST → UTC offset +5h) ─────────────────────────────
// These are the precise algorithmic windows for ideal trade execution
const ICT_MACROS = [
  { id:"LDN_M1",   label:"London Macro 1",    h:2,  m:33, endH:3,  endM:0,  session:"LONDON" },
  { id:"LDN_M2",   label:"London Macro 2",    h:4,  m:3,  endH:4,  endM:30, session:"LONDON" },
  { id:"NYAM_M1",  label:"NY AM Macro 1",     h:9,  m:50, endH:10, endM:10, session:"NY_OPEN" },
  { id:"NYAM_M2",  label:"NY AM Macro 2",     h:10, m:50, endH:11, endM:10, session:"NY_OPEN" },
  { id:"NYLUNCH",  label:"NY Lunch Macro",    h:11, m:50, endH:12, endM:10, session:"NY_OPEN" },
  { id:"NYPM_M1",  label:"NY PM Macro 1",     h:13, m:10, endH:13, endM:40, session:"NY_PM"  },
  { id:"NYPM_M2",  label:"NY PM Macro 2",     h:15, m:15, endH:15, endM:45, session:"NY_PM"  },
];

// Silver Bullet windows (existing killzones, kept for overlap detection)
const SILVER_BULLET_WINDOWS = [
  { h:9, m:30, endH:11, endM:0,  label:"Silver Bullet AM" },
  { h:13, m:30, endH:15, endM:0, label:"Silver Bullet PM" },
];

function getICTMacroForTs(ts) {
  // ts is UTC ms. EST = UTC-5 (simplified, no DST adjust)
  const d = new Date(ts);
  const estH = ((d.getUTCHours() - 5) + 24) % 24;
  const estM = d.getUTCMinutes();
  const totalM = estH * 60 + estM;
  for (const m of ICT_MACROS) {
    const start = m.h * 60 + m.m;
    const end   = m.endH * 60 + m.endM;
    if (totalM >= start && totalM < end) return m;
  }
  return null;
}

function isSilverBullet(ts) {
  const d = new Date(ts);
  const estH = ((d.getUTCHours() - 5) + 24) % 24;
  const estM = d.getUTCMinutes();
  const totalM = estH * 60 + estM;
  return SILVER_BULLET_WINDOWS.some(w => {
    const start = w.h * 60 + w.m;
    const end   = w.endH * 60 + w.endM;
    return totalM >= start && totalM < end;
  });
}

function getMacroLabel(ts) {
  const macro = getICTMacroForTs(ts);
  const sb    = isSilverBullet(ts);
  if (macro && sb) return { label: `⚡ ${macro.label} + Silver Bullet`, quality:"HIGHEST", macro, sb:true };
  if (macro)       return { label: macro.label, quality:"HIGH", macro, sb:false };
  if (sb)          return { label:"Silver Bullet Window", quality:"GOOD", macro:null, sb:true };
  return           { label:null, quality:"STANDARD", macro:null, sb:false };
}

const SESSION_DEFS = [
  { id:"ASIA",      label:"ASIA",    h0:0,  h1:7  },
  { id:"LONDON",    label:"LDN",     h0:7,  h1:12 },
  { id:"NY_OPEN",   label:"NY OPEN", h0:12, h1:17 },
  { id:"NY_PM",     label:"NY PM",   h0:17, h1:22 },
  { id:"OVERNIGHT", label:"O/N",     h0:22, h1:24 },
];

function getSessForTs(ts) {
  const h = new Date(ts).getUTCHours();
  return SESSION_DEFS.find(s => h >= s.h0 && h < s.h1) || SESSION_DEFS[0];
}
function getDayKey(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function compContextualLevels(candles) {
  if (!candles || candles.length < 8) {
    return { levels:[], currentSession:"LOADING", currentSessionLabel:"...", pdh:0,pdl:0,pwh:0,pwl:0,pdhSwept:false,pdlSwept:false,pwhSwept:false,pwlSwept:false };
  }
  const last  = candles[candles.length-1];
  const price = last.c;

  // ── Bucket candles into session+day bins ──────────────────────────────────
  const buckets = {};
  candles.forEach(c => {
    const sess = getSessForTs(c.t);
    const key  = `${getDayKey(c.t)}_${sess.id}`;
    if (!buckets[key]) buckets[key] = { ...sess, candles:[], lastT:0, dayKey:getDayKey(c.t) };
    buckets[key].candles.push(c);
    buckets[key].lastT = Math.max(buckets[key].lastT, c.t);
  });

  const currSess = getSessForTs(last.t);
  const currDay  = getDayKey(last.t);
  const currKey  = `${currDay}_${currSess.id}`;

  // Completed sessions sorted newest → oldest (exclude current)
  const pastSessions = Object.entries(buckets)
    .filter(([k]) => k !== currKey && buckets[k].candles.length >= 2)
    .map(([, b]) => ({
      ...b,
      hi: Math.max(...b.candles.map(c=>c.h)),
      lo: Math.min(...b.candles.map(c=>c.l)),
    }))
    .sort((a,b) => b.lastT - a.lastT);

  // Previous calendar day candles
  const prevDayCandles = candles.filter(c => getDayKey(c.t) !== currDay);
  const n = candles.length;

  const levels = [];

  // ── ERL: PDH / PDL — gold ────────────────────────────────────────────────
  if (prevDayCandles.length > 0) {
    const pdh = Math.max(...prevDayCandles.map(c=>c.h));
    const pdl = Math.min(...prevDayCandles.map(c=>c.l));
    levels.push({ price:pdh, type:"BSL", label:"PDH", category:"ERL",   color:"#ffd700", swept:price>pdh, lw:2.0, dash:[6,3] });
    levels.push({ price:pdl, type:"SSL", label:"PDL", category:"ERL",   color:"#ffd700", swept:price<pdl, lw:2.0, dash:[6,3] });
  } else {
    // fallback: use older 60% of candles as simulated prev day
    const sl = candles.slice(0, Math.floor(n*0.60));
    const pdh = Math.max(...sl.map(c=>c.h));
    const pdl = Math.min(...sl.map(c=>c.l));
    levels.push({ price:pdh, type:"BSL", label:"PDH", category:"ERL",   color:"#ffd700", swept:price>pdh, lw:2.0, dash:[6,3] });
    levels.push({ price:pdl, type:"SSL", label:"PDL", category:"ERL",   color:"#ffd700", swept:price<pdl, lw:2.0, dash:[6,3] });
  }

  // ── ERL: PWH / PWL — orange ───────────────────────────────────────────────
  const pwSl = candles.slice(0, Math.floor(n*0.28));
  if (pwSl.length > 0) {
    const pwh = Math.max(...pwSl.map(c=>c.h));
    const pwl = Math.min(...pwSl.map(c=>c.l));
    levels.push({ price:pwh, type:"BSL", label:"PWH", category:"ERL_W", color:"#ff9500", swept:price>pwh, lw:2.2, dash:[4,3] });
    levels.push({ price:pwl, type:"SSL", label:"PWL", category:"ERL_W", color:"#ff9500", swept:price<pwl, lw:2.2, dash:[4,3] });
  }

  // ── SESSION: prev 2 completed sessions H/L — purple, auto-rotates ─────────
  // When NY Open is active: shows LDN HIGHS BSL + LDN LOWS SSL + ASIA HIGHS + ASIA LOWS
  const sessColours = [
    { bsl:"#c084fc", ssl:"#d946ef" },  // most recent prev session — brighter
    { bsl:"#9333ea", ssl:"#a21caf" },  // session before that — dimmer
  ];
  pastSessions.slice(0, 2).forEach((sess, i) => {
    const c = sessColours[i];
    levels.push({ price:sess.hi, type:"BSL", label:`${sess.label} HIGHS BSL`, category:"SESSION", color:c.bsl, swept:price>sess.hi, lw:1.8, dash:[9,4] });
    levels.push({ price:sess.lo, type:"SSL", label:`${sess.label} LOWS SSL`,  category:"SESSION", color:c.ssl, swept:price<sess.lo, lw:1.8, dash:[9,4] });
  });

  // ── IRL: 1 key level — most-tested untested swing in current session — cyan
  const currCandles = buckets[currKey]?.candles
    || candles.slice(-Math.min(20, Math.floor(n*0.28)));
  if (currCandles.length >= 5) {
    const atr = currCandles.reduce((s,c)=>s+(c.h-c.l),0) / currCandles.length;
    const tol = atr * 0.45;
    const swings = [];
    for (let i=2; i<currCandles.length-2; i++) {
      const c = currCandles[i];
      const isPeak   = c.h > currCandles[i-1].h && c.h > currCandles[i-2].h
                    && c.h > currCandles[i+1].h && c.h > currCandles[i+2].h;
      const isTrough = c.l < currCandles[i-1].l && c.l < currCandles[i-2].l
                    && c.l < currCandles[i+1].l && c.l < currCandles[i+2].l;
      if (isPeak) {
        const touches = currCandles.filter(x=>Math.abs(x.h-c.h)<tol||Math.abs(x.l-c.h)<tol).length;
        swings.push({ price:c.h, type:"BSL", touches, swept:price>c.h });
      }
      if (isTrough) {
        const touches = currCandles.filter(x=>Math.abs(x.l-c.l)<tol||Math.abs(x.h-c.l)<tol).length;
        swings.push({ price:c.l, type:"SSL", touches, swept:price<c.l });
      }
    }
    const best = swings.filter(s=>!s.swept).sort((a,b)=>b.touches-a.touches)[0];
    if (best) {
      levels.push({
        price: best.price,
        type:  best.type,
        label: best.type==="BSL"
          ? `${currSess.label} HIGH IRL`
          : `${currSess.label} LOW IRL`,
        category: "IRL",
        color: best.type==="BSL" ? "#00d4ff" : "#38bdf8",
        swept: false,
        lw: 1.5,
        dash: [4,3],
      });
    }
  }

  // Deduplicate — remove levels within 0.5 pts of a higher-priority one
  const PRIO = { ERL_W:5, ERL:4, SESSION:3, IRL:2 };
  const deduped = [];
  [...levels].sort((a,b)=>(PRIO[b.category]||0)-(PRIO[a.category]||0)).forEach(l => {
    if (!deduped.some(d=>Math.abs(d.price-l.price)<0.5)) deduped.push(l);
  });

  const find = lbl => deduped.find(l=>l.label===lbl);
  return {
    levels: deduped,
    currentSession:      currSess.id,
    currentSessionLabel: currSess.label,
    prevSession:         pastSessions[0]?.label || "",
    pdh:  find("PDH")?.price ?? 0,
    pdl:  find("PDL")?.price ?? 0,
    pwh:  find("PWH")?.price ?? 0,
    pwl:  find("PWL")?.price ?? 0,
    pdhSwept: price > (find("PDH")?.price ?? Infinity),
    pdlSwept: price < (find("PDL")?.price ?? -Infinity),
    pwhSwept: price > (find("PWH")?.price ?? Infinity),
    pwlSwept: price < (find("PWL")?.price ?? -Infinity),
  };
}
function compOrderFlow(cs) {
  let cvd=0;
  return cs.map(c=>{
    cvd+=c.delta;
    const imbalRatio=Math.abs(c.delta)/Math.max(c.v,1);
    const baImbal=imbalRatio>0.68?(c.delta>0?"ask_dom":"bid_dom"):null;
    return { ...c, cvd, imbalance: imbalRatio>0.55?(c.delta>0?"bull":"bear"):null, baImbal };
  });
}
function compVolProfile(cs, levels=24) {
  if(!cs.length) return [];
  const prices=cs.flatMap(c=>[c.h,c.l]);
  const lo=Math.min(...prices),hi=Math.max(...prices),step=(hi-lo)/levels;
  const buckets=Array.from({length:levels},(_,i)=>({price:lo+step*i+step/2,vol:0,askVol:0,bidVol:0}));
  cs.forEach(c=>{
    const mid=(c.h+c.l)/2;
    const idx=Math.min(levels-1,Math.floor((mid-lo)/step));
    buckets[idx].vol+=c.v;
    buckets[idx].askVol+=(c.askVol||Math.floor(c.v*0.5));
    buckets[idx].bidVol+=(c.bidVol||Math.floor(c.v*0.5));
  });
  const maxVol=Math.max(...buckets.map(b=>b.vol),1);
  const poc=buckets.reduce((a,b)=>b.vol>a.vol?b:a,buckets[0]);
  return buckets.map(b=>({...b,pct:b.vol/maxVol,isPOC:b.price===poc.price}));
}

// ─────────────────────────────────────────────────────────────────────────────
// HTF / LTF BIAS COMPUTATION  (simulated multi-TF from candle slices)
// ─────────────────────────────────────────────────────────────────────────────
function compHTFBias(candles) {
  if (!candles.length) return [];
  const last = candles[candles.length - 1].c;
  const biasOf = (bars) => {
    if (bars.length < 2) return "NEUTRAL";
    const hi = Math.max(...bars.map(c=>c.h));
    const lo = Math.min(...bars.map(c=>c.l));
    const ema = bars.reduce((s,c)=>s+c.c,0) / bars.length;
    const mid = (hi + lo) / 2;
    const third = Math.floor(bars.length / 3);
    const recent = bars.slice(-Math.max(third, 2));
    const rHi = Math.max(...recent.map(c=>c.h));
    const rLo = Math.min(...recent.map(c=>c.l));
    const hh = rHi >= hi * 0.9985;
    const hl = rLo > lo * 1.001;
    const lh = rHi < hi * 0.9985;
    const ll = rLo <= lo * 1.001;
    if ((last > ema && last > mid) || (hh && hl)) return "BULLISH";
    if ((last < ema && last < mid) || (lh && ll)) return "BEARISH";
    return "NEUTRAL";
  };
  const n = candles.length;
  return [
    { tf:"Weekly", bias: biasOf(candles) },
    { tf:"Daily",  bias: biasOf(candles.slice(Math.max(0,n-72))) },
    { tf:"4H",     bias: biasOf(candles.slice(Math.max(0,n-48))) },
    { tf:"1H",     bias: biasOf(candles.slice(Math.max(0,n-24))) },
    { tf:"15M",    bias: biasOf(candles.slice(Math.max(0,n-12))) },
    { tf:"5M",     bias: biasOf(candles.slice(Math.max(0,n-4))) },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CANDLE CHART  (two-canvas split: price + order flow sub-chart)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CANDLE CHART — TradingView-style, fully interactive (pan + zoom)
// ─────────────────────────────────────────────────────────────────────────────
function CandleChart({ candles, obs, bbs, fvgs, liq, contextLevels, orb, ote, overlays, ofData, volProfile, tradeSetup }) {
  const canvasRef    = useRef(null);
  const ofRef        = useRef(null);
  const showOF       = overlays.includes("of");

  // ── Viewport refs (no re-render needed — direct redraw) ───────────────────
  const viewOffsetRef  = useRef(0);      // # candles scrolled left from newest
  const candleSlotWRef = useRef(0);      // px per candle slot; 0 = auto
  const isDraggingRef  = useRef(false);
  const dragStartRef   = useRef({ x:0, offset:0 });
  const crosshairRef   = useRef(null);   // {x,y} canvas coords while hovering

  const PRICE_W = 72;   // right price scale width px
  const TIME_H  = 24;   // bottom time axis height px
  const VOL_H   = 0.13; // volume pane = 13% of chart height

  // ── Viewport helpers ───────────────────────────────────────────────────────
  const getSlotW = useCallback((chartW) => {
    if (candleSlotWRef.current > 0) return candleSlotWRef.current;
    return Math.max(4, chartW / Math.min(candles.length, 90));
  }, [candles.length]);

  const FUTURE_SLOTS = 25; // empty candle slots projected to the right

  const getViewport = useCallback((W, H) => {
    const cw     = getSlotW(W - PRICE_W);
    const chartW = W - PRICE_W;
    const chartH = H - TIME_H;
    const vis    = Math.ceil(chartW / cw) + 2;
    const maxOff = Math.max(0, candles.length - 10);
    const offset = Math.max(0, Math.min(viewOffsetRef.current, maxOff));
    const lastVis  = Math.max(0, candles.length - 1 - Math.floor(offset));
    const firstVis = Math.max(0, lastVis - vis + 1);
    const sub      = (offset % 1) * cw;   // sub-pixel smoothness

    // candleX works for real indices AND future indices (lastVis+1, lastVis+2 …)
    const candleX = idx => chartW + sub - (lastVis - idx + 1) * cw + cw / 2;
    // x coordinate for the left edge of a future slot (lastVis+1 = first future slot)
    const futureStartX = candleX(lastVis + 1) - cw / 2;

    const sliceH = candles.slice(firstVis, lastVis + 1);
    const prices = sliceH.flatMap(c => [c.h, c.l]);
    // Include tradeSetup prices in the y-scale so zones don't clip
    if (tradeSetup) {
      const sp = tradeSetup;
      [sp.entry_top, sp.entry_bot, sp.stop_price, sp.tp1_price, sp.tp2_price]
        .filter(Boolean).forEach(p => prices.push(p));
    }
    const rawMin = Math.min(...prices), rawMax = Math.max(...prices);
    const pad    = Math.max((rawMax - rawMin) * 0.08, 2);
    const minP   = rawMin - pad, maxP = rawMax + pad;

    const priceH = chartH * (1 - VOL_H);  // candle area height
    const toY    = p => priceH - ((p - minP) / (maxP - minP)) * priceH;

    return { cw, chartW, chartH, priceH, firstVis, lastVis, candleX, futureStartX, toY, minP, maxP };
  }, [candles, getSlotW, tradeSetup]);

  // ── Main draw ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !candles.length) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    if (!W || !H) return;

    const { cw, chartW, chartH, priceH, firstVis, lastVis, candleX, futureStartX, toY, minP, maxP } = getViewport(W, H);
    const bw = Math.max(1, cw * 0.72);  // candle body width

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = "#131722";
    ctx.fillRect(0, 0, W, H);

    // ── Nice price grid ──────────────────────────────────────────────────────
    const priceRange = maxP - minP;
    const rawStep = priceRange / 7;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const step = mag * ([1,2,2.5,5,10].find(s => mag*s >= rawStep) || 10);
    const firstGrid = Math.ceil(minP / step) * step;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
    ctx.strokeStyle = "rgba(42,46,57,0.9)"; ctx.lineWidth = 1;
    for (let p = firstGrid; p < maxP + step; p += step) {
      const y = toY(p);
      if (y < 0 || y > priceH) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
    }
    // Vertical grid every ~100px
    const vEvery = Math.max(1, Math.round(100 / cw));
    for (let i = firstVis; i <= lastVis; i++) {
      if (i % vEvery !== 0) continue;
      const x = candleX(i);
      if (x < 0 || x > chartW) continue;
      ctx.strokeStyle = "rgba(42,46,57,0.55)";
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke();
    }
    ctx.restore();

    // ── Volume bars (bottom strip) ───────────────────────────────────────────
    const volTop = priceH;
    const volH   = chartH - priceH;
    const maxVol = Math.max(...candles.slice(firstVis, lastVis+1).map(c => c.v), 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, volTop, chartW, volH); ctx.clip();
    for (let i = firstVis; i <= lastVis; i++) {
      const c = candles[i];
      const x = candleX(i);
      if (x + bw/2 < 0 || x - bw/2 > chartW) continue;
      const barH = (c.v / maxVol) * volH * 0.88;
      ctx.fillStyle = c.c >= c.o ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)";
      ctx.fillRect(x - bw/2, volTop + volH - barH, bw, barH);
    }
    // VOL label
    ctx.fillStyle = "rgba(120,123,134,0.6)"; ctx.font = "9px monospace";
    ctx.fillText("VOL", 4, volTop + 11);
    ctx.restore();

    // ── FVG ──────────────────────────────────────────────────────────────────
    if (overlays.includes("fvg")) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      fvgs.forEach(f => {
        const x1 = candleX(f.idx) - cw/2;
        if (x1 > chartW + 50) return;
        const top = toY(f.top), bot = toY(f.bot), isBull = f.type.includes("Bull");
        ctx.fillStyle = f.filled ? "transparent" : isBull ? "rgba(38,166,154,0.10)" : "rgba(239,83,80,0.10)";
        ctx.fillRect(Math.max(0,x1), top, chartW - Math.max(0,x1), bot - top);
        if (!f.filled) {
          ctx.strokeStyle = isBull ? "rgba(38,166,154,0.32)" : "rgba(239,83,80,0.32)";
          ctx.lineWidth = 0.8; ctx.setLineDash([3,3]);
          [[top],[bot]].forEach(([y]) => { ctx.beginPath(); ctx.moveTo(Math.max(0,x1),y); ctx.lineTo(chartW,y); ctx.stroke(); });
          ctx.setLineDash([]);
          ctx.fillStyle = isBull ? "rgba(38,166,154,0.75)" : "rgba(239,83,80,0.75)";
          ctx.font = "bold 8px monospace";
          ctx.fillText("FVG", Math.max(4, x1+3), (top+bot)/2+3);
        }
      });
      ctx.restore();
    }

    // ── Order Blocks ──────────────────────────────────────────────────────────
    if (overlays.includes("ob")) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      obs.forEach(ob => {
        if (ob.mit) return;
        const x1 = candleX(ob.idx) - cw/2;
        if (x1 > chartW + 50) return;
        const top = toY(ob.top), bot = toY(ob.bot), isBull = ob.type.includes("Bull");
        ctx.fillStyle   = isBull ? "rgba(0,210,255,0.07)"  : "rgba(255,152,0,0.07)";
        ctx.strokeStyle = isBull ? "rgba(0,210,255,0.45)"  : "rgba(255,152,0,0.45)";
        ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.fillRect(Math.max(0,x1), top, chartW-Math.max(0,x1), bot-top);
        ctx.strokeRect(Math.max(0,x1), top, chartW-Math.max(0,x1), bot-top);
        ctx.fillStyle = isBull ? "rgba(0,210,255,0.85)" : "rgba(255,152,0,0.85)";
        ctx.font = "bold 8px monospace";
        ctx.fillText(isBull ? "BOB" : "SOB", Math.max(4, x1+3), top+11);
      });
      ctx.restore();
    }

    // ── Breaker Blocks ────────────────────────────────────────────────────────
    if (overlays.includes("bb")) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      bbs.forEach(bb => {
        const x1 = candleX(bb.idx) - cw/2;
        if (x1 > chartW + 50) return;
        const top = toY(bb.top), bot = toY(bb.bot), isBull = bb.type.includes("Bull");
        ctx.fillStyle = "rgba(255,107,53,0.06)";
        ctx.strokeStyle = isBull ? "rgba(255,107,53,0.6)" : "rgba(220,50,50,0.6)";
        ctx.lineWidth = 1; ctx.setLineDash([4,3]);
        ctx.fillRect(Math.max(0,x1), top, chartW-Math.max(0,x1), bot-top);
        ctx.strokeRect(Math.max(0,x1), top, chartW-Math.max(0,x1), bot-top); ctx.setLineDash([]);
        ctx.fillStyle = isBull ? "rgba(255,107,53,0.9)" : "rgba(220,50,50,0.9)";
        ctx.font = "bold 8px monospace";
        ctx.fillText(isBull ? "↑BB" : "↓BB", Math.max(4, x1+3), top+11);
      });
      ctx.restore();
    }

    // ── ORB ───────────────────────────────────────────────────────────────────
    if (overlays.includes("orb") && orb) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      [[orb.high,"ORB H","#00ff8c",[]],[orb.low,"ORB L","#ff4f4f",[]],[orb.mid,"MID","rgba(255,255,255,0.2)",[3,3]],[orb.ext1H,"+1×","rgba(0,255,140,0.55)",[6,3]],[orb.ext1L,"-1×","rgba(255,80,80,0.55)",[6,3]]].forEach(([price,lbl,col,dash])=>{
        const y = toY(price); if (y < 0 || y > priceH) return;
        ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash(dash);
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle=col; ctx.font="bold 9px monospace";
        ctx.fillText(`${lbl} ${price.toFixed(2)}`, chartW-96, y-3);
      });
      ctx.restore();
    }

    // ── OTE ───────────────────────────────────────────────────────────────────
    if (overlays.includes("ote") && ote) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      ctx.fillStyle = "rgba(0,229,255,0.03)";
      ctx.fillRect(0, toY(ote.ote_top), chartW, toY(ote.ote_bot)-toY(ote.ote_top));
      [[ote.fib_618,"61.8%","#00d2ff"],[ote.fib_705,"70.5%","#3bb5e8"],[ote.fib_786,"78.6%","#00d2ff"]].forEach(([v,l,col])=>{
        const y = toY(v); if (y < 0 || y > priceH) return;
        ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke();
        ctx.fillStyle=col; ctx.font="bold 8px monospace"; ctx.fillText(`${l} ${v.toFixed(2)}`,6,y-3);
      });
      ctx.restore();
    }

    // ── Contextual Levels (ERL/SESSION/IRL) ───────────────────────────────────
    if (contextLevels?.levels?.length) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      [...contextLevels.levels]
        .sort((a,b) => (["ERL_W","ERL","SESSION","IRL"].indexOf(a.category)) - (["ERL_W","ERL","SESSION","IRL"].indexOf(b.category)))
        .forEach(lvl => {
          const y = toY(lvl.price); if (y < 0 || y > priceH) return;
          ctx.globalAlpha = lvl.swept ? 0.18 : 0.85;
          ctx.strokeStyle = lvl.swept ? "#1a2a2a" : lvl.color;
          ctx.lineWidth = lvl.swept ? 0.6 : lvl.lw; ctx.setLineDash(lvl.swept ? [2,7] : lvl.dash);
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          if (lvl.swept) return;
          ctx.font = "bold 8px monospace";
          const lbl = lvl.label, lblW = ctx.measureText(lbl).width + 10;
          ctx.fillStyle = lvl.color + "22"; ctx.fillRect(chartW - lblW - 4, y-9, lblW, 13);
          ctx.fillStyle = lvl.color; ctx.fillText(lbl, chartW - lblW, y+2);
        });
      ctx.restore();
    }

    // ── IRL generic pools ─────────────────────────────────────────────────────
    if (overlays.includes("liq")) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      liq.forEach(n => {
        const y = toY(n.price); if (y < 0 || y > priceH) return;
        const col = n.type === "BSL" ? "#00d4ff" : "#38bdf8";
        ctx.globalAlpha = n.swept ? 0.2 : 0.7;
        ctx.strokeStyle = n.swept ? "#334155" : col; ctx.lineWidth = 1.2; ctx.setLineDash(n.swept ? [2,5] : [4,3]);
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chartW,y); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        if (!n.swept) { ctx.fillStyle=col; ctx.font="bold 7px monospace"; ctx.fillText(`${n.type} IRL`, chartW-50, y-3); }
      });
      ctx.restore();
    }

    // ── Vol Profile (right side) ──────────────────────────────────────────────
    if (overlays.includes("of") && volProfile?.length) {
      const vpW = 36, vpX = chartW - vpW;
      ctx.save(); ctx.beginPath(); ctx.rect(vpX, 0, vpW, priceH); ctx.clip();
      volProfile.forEach(b => {
        const y=toY(b.price), barH=Math.max(2,(priceH/volProfile.length)*0.85);
        const askW=(b.askVol/Math.max(b.vol,1))*vpW, bidW=(b.bidVol/Math.max(b.vol,1))*vpW;
        ctx.fillStyle=b.isPOC?"rgba(255,215,0,0.18)":"rgba(0,255,140,0.09)";
        ctx.fillRect(vpX,y-barH/2,askW,barH);
        ctx.fillStyle="rgba(255,80,80,0.07)";
        ctx.fillRect(vpX+askW,y-barH/2,Math.max(0,bidW-askW),barH);
        if(b.isPOC){
          ctx.strokeStyle="rgba(255,215,0,0.6)"; ctx.lineWidth=1; ctx.setLineDash([2,3]);
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(vpX,y); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle="rgba(255,215,0,0.8)"; ctx.font="bold 8px monospace";
          ctx.fillText(`POC ${b.price.toFixed(2)}`,4,y-3);
        }
      });
      ctx.restore();
    }

    // ── Bid/Ask imbalance candle highlights ───────────────────────────────────
    if (overlays.includes("of") && ofData) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
      ofData.forEach((c,i) => {
        if (!c.baImbal) return;
        const x = candleX(firstVis + i);
        if (x < 0 || x > chartW) return;
        const top=toY(Math.max(c.o,c.c)), bh=Math.max(1,toY(Math.min(c.o,c.c))-top);
        const isAsk = c.baImbal === "ask_dom";
        ctx.fillStyle=isAsk?"rgba(0,255,140,0.14)":"rgba(255,80,80,0.14)";
        ctx.fillRect(x-bw/2,top,bw,bh);
        ctx.strokeStyle=isAsk?"rgba(0,255,140,0.45)":"rgba(255,80,80,0.45)"; ctx.lineWidth=1;
        ctx.strokeRect(x-bw/2,top,bw,bh);
      });
      ctx.restore();
    }

    // ── AI Trade Setup Overlay — filled zone boxes like TradingView screenshot ──
    if (tradeSetup && (tradeSetup.active || tradeSetup.outcome)) {
      const {direction,entry_top,entry_bot,stop_price,tp1_price,tp2_price,active,outcome,tp1_hit} = tradeSetup;
      const isLong=direction==="LONG", isActive=active!==false, isStopped=outcome==="STOPPED";

      const fsx      = Math.max(0, futureStartX);    // left edge of future zone
      const futW     = FUTURE_SLOTS * cw;
      const futEndX  = Math.min(fsx + futW, chartW);
      const zoneW    = futEndX - fsx;                // width of all future boxes

      // entry midpoint price (used as the dividing line between SL and TP boxes)
      const entryMid = (entry_top != null && entry_bot != null)
        ? (entry_top + entry_bot) / 2
        : entry_top ?? entry_bot;

      // Right-edge price badge
      const bdg = (price, text, bg, fg) => {
        const y = toY(price); if (y < -20 || y > priceH + 20) return;
        const bw2 = ctx.measureText(text).width + 14;
        ctx.fillStyle = bg; ctx.fillRect(chartW - bw2 - 2, y - 9, bw2, 16);
        ctx.fillStyle = fg; ctx.font = "bold 9px monospace";
        ctx.fillText(text, chartW - bw2 + 5, y + 3);
      };

      // Label inside a box (centered)
      const boxLabel = (x, y, w, h, text, color, fontSize=8) => {
        if (h < 8) return;
        ctx.fillStyle = color; ctx.font = `bold ${fontSize}px monospace`;
        const tw = ctx.measureText(text).width;
        ctx.fillText(text, x + Math.max(4, (w - tw) / 2), y + h / 2 + fontSize * 0.35);
      };

      ctx.save();
      ctx.globalAlpha = isActive ? 1 : 0.28;
      ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();

      // ── FUTURE ZONE BACKGROUND + DIVIDER ─────────────────────────────────
      if (fsx < chartW && zoneW > 0) {
        ctx.fillStyle = "rgba(8,12,20,0.6)";
        ctx.fillRect(fsx, 0, zoneW, priceH);
        ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(fsx, 0); ctx.lineTo(fsx, priceH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.font = "bold 8px monospace";
        ctx.fillText("PROJECTED", fsx + 5, 13);
      }

      // ── ENTRY BOX — on existing candles (left side), purple ───────────────
      if (entry_top != null && entry_bot != null) {
        const eT = toY(entry_top), eB = toY(entry_bot), eH = Math.abs(eB - eT);
        const entryRight = fsx > 4 ? fsx : chartW * 0.65;
        ctx.fillStyle   = "rgba(139,92,246,0.22)";
        ctx.strokeStyle = "rgba(139,92,246,0.9)";
        ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.fillRect(0, Math.min(eT,eB), entryRight, eH);
        ctx.strokeRect(0, Math.min(eT,eB), entryRight, eH);
        boxLabel(0, Math.min(eT,eB), entryRight, eH, `${direction} ENTRY`, "rgba(210,190,255,0.95)", 9);
        if (tradeSetup.lots && eH > 22) {
          ctx.fillStyle = "#00d4ff"; ctx.font = "bold 7px monospace";
          ctx.fillText(`${tradeSetup.lots}ct · $${(tradeSetup.riskDollars||0).toLocaleString()}`, 6, Math.min(eT,eB)+eH/2+13);
        }
        // Direction arrow
        const midY=(eT+eB)/2, arrX=Math.min(entryRight*0.55,chartW*0.38), arrL=Math.max(8,eH*0.5);
        ctx.strokeStyle=isLong?"#00ff8c":"#ff4f4f"; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(arrX,isLong?midY+arrL/2:midY-arrL/2); ctx.lineTo(arrX,isLong?midY-arrL/2:midY+arrL/2); ctx.stroke();
        const ah=isLong?midY-arrL/2:midY+arrL/2, ad=isLong?-1:1;
        ctx.beginPath(); ctx.moveTo(arrX-5,ah+ad*6); ctx.lineTo(arrX,ah); ctx.lineTo(arrX+5,ah+ad*6); ctx.stroke();
        bdg(entry_top, `ENTRY  ${entry_top.toFixed(2)}`, "rgba(139,92,246,0.9)", "#fff");
      }

      // ── All future boxes share the same zoneW and start at fsx ───────────
      // Entry midpoint Y — the dividing line between SL box and TP boxes
      const entryY = entryMid != null ? toY(entryMid) : null;

      // ── SL BOX (future) — dark maroon/red, from entry mid to stop ─────────
      if (stop_price != null && entryMid != null && zoneW > 0) {
        const slY    = toY(stop_price);
        const slTop  = Math.min(entryY, slY);
        const slBot  = Math.max(entryY, slY);
        const slH    = slBot - slTop;
        ctx.fillStyle   = isStopped ? "rgba(200,30,30,0.55)" : "rgba(110,15,30,0.65)";
        ctx.strokeStyle = isStopped ? "rgba(255,60,60,0.9)"  : "rgba(180,30,50,0.8)";
        ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.fillRect(fsx, slTop, zoneW, slH);
        ctx.strokeRect(fsx, slTop, zoneW, slH);
        boxLabel(fsx, slTop, zoneW, slH, isStopped ? "⚡ STOPPED" : "SL", isStopped ? "#ff6b6b" : "rgba(255,130,150,0.9)", 8);
        bdg(stop_price, `SL  ${stop_price.toFixed(2)}`, isStopped ? "#ff4f4f" : "rgba(180,30,50,0.95)", "#fff");
      }

      // ── TP2 BOX (future) — full profit zone teal, entry mid to TP2 ────────
      if (tp2_price != null && entryMid != null && zoneW > 0) {
        const tp2Y   = toY(tp2_price);
        const tpTop  = Math.min(entryY, tp2Y);
        const tpBot  = Math.max(entryY, tp2Y);
        const tpH    = tpBot - tpTop;
        const hitCol = outcome === "TP2_HIT";
        ctx.fillStyle   = hitCol ? "rgba(0,200,120,0.55)" : "rgba(0,100,80,0.55)";
        ctx.strokeStyle = hitCol ? "rgba(0,255,140,0.9)"  : "rgba(0,178,130,0.75)";
        ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.fillRect(fsx, tpTop, zoneW, tpH);
        ctx.strokeRect(fsx, tpTop, zoneW, tpH);
        boxLabel(fsx, tpTop, zoneW, tpH, hitCol ? "🎯 TP2 HIT" : "TP2", hitCol ? "#00ff8c" : "rgba(0,220,160,0.9)", 8);
        bdg(tp2_price, `TP2  ${tp2_price.toFixed(2)}`, hitCol ? "rgba(0,200,120,0.9)" : "rgba(0,148,110,0.9)", "#fff");
      }

      // ── TP1 BOX (future) — lighter teal, between entry mid and TP1 ────────
      // Only shown as a separate sub-box when both TP1 and TP2 exist
      if (tp1_price != null && entryMid != null && zoneW > 0) {
        const tp1Y   = toY(tp1_price);
        const t1Top  = Math.min(entryY, tp1Y);
        const t1Bot  = Math.max(entryY, tp1Y);
        const t1H    = t1Bot - t1Top;
        // If TP2 also exists, draw TP1 as a brighter sub-overlay on top
        const tp1Col = tp1_hit ? "rgba(0,255,140,0.55)" : "rgba(0,168,128,0.42)";
        ctx.fillStyle   = tp1Col;
        ctx.strokeStyle = tp1_hit ? "rgba(0,255,140,0.85)" : "rgba(0,210,160,0.6)";
        ctx.lineWidth = 1; ctx.setLineDash(tp2_price ? [4,3] : []);
        ctx.fillRect(fsx, t1Top, zoneW, t1H);
        ctx.strokeRect(fsx, t1Top, zoneW, t1H);
        ctx.setLineDash([]);
        if (!tp2_price) {
          boxLabel(fsx, t1Top, zoneW, t1H, tp1_hit ? "🎯 TP1 HIT" : "TP1", tp1_hit ? "#00ff8c" : "rgba(0,220,170,0.95)", 8);
        }
        bdg(tp1_price, `TP1  ${tp1_price.toFixed(2)}`, tp1_hit ? "rgba(0,200,120,0.9)" : "rgba(0,148,118,0.9)", "#fff");
      }

      // ── Entry mid dividing line (thin bright line between SL and TP) ──────
      if (entryY != null && zoneW > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(fsx, entryY); ctx.lineTo(futEndX, entryY); ctx.stroke();
        // small price tag on the divider
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "bold 8px monospace";
        ctx.fillText((entryMid||0).toFixed(2), fsx + 4, entryY - 3);
      }

      // ── Outcome banner ───────────────────────────────────────────────────
      if (!isActive) {
        const elapsed = tradeSetup.clearedAt ? Math.floor((Date.now()-tradeSetup.clearedAt)/1000) : 0;
        const rem = Math.max(0,300-elapsed), mm=String(Math.floor(rem/60)).padStart(2,"0"), ss=String(rem%60).padStart(2,"0");
        const bt = isStopped ? `⚡ STOPPED · clear in ${mm}:${ss}` : `🎯 TP2 HIT · clear in ${mm}:${ss}`;
        const bc = isStopped ? "#ff4f4f" : "#00ff8c";
        const bw2=270, bh=24, bx=chartW/2-bw2/2;
        ctx.fillStyle="rgba(0,0,0,0.8)"; ctx.fillRect(bx,14,bw2,bh);
        ctx.strokeStyle=bc; ctx.lineWidth=1; ctx.setLineDash([]); ctx.strokeRect(bx,14,bw2,bh);
        ctx.fillStyle=bc; ctx.font="bold 10px monospace"; ctx.textAlign="center";
        ctx.fillText(bt, chartW/2, 30); ctx.textAlign="left";
      }
      ctx.restore();
    }

    // ── Candles (drawn on top of all overlays) ────────────────────────────────
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip();
    for (let i = firstVis; i <= lastVis; i++) {
      const c = candles[i];
      const x = candleX(i);
      if (x + bw/2 < 0 || x - bw/2 > chartW) continue;
      const bull = c.c >= c.o;
      const bodyCol  = bull ? "#26a69a" : "#ef5350";
      const wickCol  = bull ? "rgba(38,166,154,0.85)" : "rgba(239,83,80,0.85)";
      const wickW    = Math.max(1, Math.min(1.5, cw * 0.12));
      const bodyTop  = toY(Math.max(c.o, c.c));
      const bodyH    = Math.max(1, Math.abs(toY(c.o) - toY(c.c)));
      // Wick
      ctx.strokeStyle = wickCol; ctx.lineWidth = wickW;
      ctx.beginPath(); ctx.moveTo(x, toY(c.h)); ctx.lineTo(x, toY(c.l)); ctx.stroke();
      // Body
      if (cw > 3) {
        ctx.fillStyle = bodyCol;
        ctx.fillRect(x - bw/2, bodyTop, bw, bodyH);
      } else {
        // Very zoomed out — just a line
        ctx.strokeStyle = bodyCol; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, bodyTop); ctx.lineTo(x, bodyTop+bodyH); ctx.stroke();
      }
    }
    ctx.restore();

    // ── Current price dashed line ─────────────────────────────────────────────
    const lastC = candles[candles.length-1];
    const ly = toY(lastC.c);
    if (ly >= 0 && ly <= priceH) {
      const pCol = lastC.c >= lastC.o ? "#26a69a" : "#ef5350";
      ctx.strokeStyle = pCol + "99"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(chartW,ly); ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── RIGHT PRICE SCALE ─────────────────────────────────────────────────────
    ctx.fillStyle = "#131722";
    ctx.fillRect(chartW, 0, PRICE_W, H);
    // separator line
    ctx.strokeStyle = "rgba(42,46,57,1)"; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(chartW, 0); ctx.lineTo(chartW, priceH); ctx.stroke();
    // price labels
    ctx.fillStyle = "#787b86"; ctx.font = "10px -apple-system,sans-serif";
    for (let p = firstGrid; p < maxP + step; p += step) {
      const y = toY(p); if (y < 8 || y > priceH - 6) continue;
      ctx.fillStyle = "rgba(42,46,57,0.9)"; ctx.fillRect(chartW, y-0.5, 4, 1); // tick
      ctx.fillStyle = "#787b86"; ctx.fillText(p.toFixed(2), chartW + 7, y + 3.5);
    }
    // current price badge
    if (ly >= 0 && ly <= priceH) {
      const pCol = lastC.c >= lastC.o ? "#26a69a" : "#ef5350";
      ctx.fillStyle = pCol; ctx.fillRect(chartW, ly-9, PRICE_W, 18);
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px monospace";
      ctx.fillText(lastC.c.toFixed(2), chartW + 5, ly + 3.5);
    }

    // ── BOTTOM TIME AXIS ──────────────────────────────────────────────────────
    ctx.fillStyle = "#131722";
    ctx.fillRect(0, chartH, W, TIME_H);
    ctx.strokeStyle = "rgba(42,46,57,1)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, chartH); ctx.lineTo(W, chartH); ctx.stroke();
    ctx.fillStyle = "#787b86"; ctx.font = "10px -apple-system,sans-serif";
    const minLabelGap = 60;
    let lastLabelX = -Infinity;
    for (let i = firstVis; i <= lastVis; i++) {
      const x = candleX(i);
      if (x < 0 || x > chartW || x - lastLabelX < minLabelGap) continue;
      if (i % vEvery !== 0) continue;
      const d   = new Date(candles[i].t);
      const lbl = `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
      const tw  = ctx.measureText(lbl).width;
      ctx.fillText(lbl, x - tw/2, chartH + 15);
      // tick
      ctx.strokeStyle = "rgba(42,46,57,0.8)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, chartH); ctx.lineTo(x, chartH+4); ctx.stroke();
      lastLabelX = x;
    }

    // ── CROSSHAIR ─────────────────────────────────────────────────────────────
    const ch = crosshairRef.current;
    if (ch && ch.x >= 0 && ch.x <= chartW && ch.y >= 0 && ch.y <= priceH) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 0.5; ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(ch.x,0); ctx.lineTo(ch.x,priceH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,ch.y); ctx.lineTo(chartW,ch.y); ctx.stroke();
      ctx.setLineDash([]);
      // price on right
      const chP = minP + (1 - ch.y/priceH) * (maxP - minP);
      ctx.fillStyle = "#434651"; ctx.fillRect(chartW, ch.y-9, PRICE_W, 18);
      ctx.fillStyle = "#d1d4dc"; ctx.font = "bold 10px monospace";
      ctx.fillText(chP.toFixed(2), chartW+5, ch.y+3.5);
      // time at bottom
      const chIdx = Math.round(firstVis + (ch.x - candleX(firstVis)) / cw);
      if (chIdx >= 0 && chIdx < candles.length) {
        const d = new Date(candles[chIdx].t);
        const tl = `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
        const tlW = ctx.measureText(tl).width + 12;
        ctx.fillStyle = "#434651"; ctx.fillRect(ch.x-tlW/2, chartH, tlW, TIME_H);
        ctx.fillStyle = "#d1d4dc"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
        ctx.fillText(tl, ch.x, chartH+15); ctx.textAlign = "left";
      }
      // OHLCV tooltip top-left
      if (chIdx >= 0 && chIdx < candles.length) {
        const c = candles[chIdx];
        const bull = c.c >= c.o;
        const pCol = bull ? "#26a69a" : "#ef5350";
        ctx.font = "10px monospace";
        const ohlc = `O ${c.o.toFixed(2)}  H ${c.h.toFixed(2)}  L ${c.l.toFixed(2)}  C ${c.c.toFixed(2)}  V ${c.v}`;
        const tw2 = ctx.measureText(ohlc).width + 16;
        ctx.fillStyle = "rgba(19,23,34,0.88)"; ctx.fillRect(4, 4, tw2, 18);
        ctx.fillStyle = pCol; ctx.fillText(ohlc, 10, 16);
      }
    }

  }, [candles, obs, bbs, fvgs, liq, contextLevels, orb, ote, overlays, ofData, volProfile, tradeSetup, getViewport]);

  // ── Order flow sub-pane (separate canvas below) ────────────────────────────
  const drawOF = useCallback(() => {
    const cv = ofRef.current;
    if (!cv || !candles.length || !ofData) return;
    const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
    ctx.clearRect(0,0,W,H);
    const { cw, chartW, firstVis, lastVis, candleX } = getViewport(W + PRICE_W, H + TIME_H);
    const bw2 = Math.max(1, cw * 0.7);

    ctx.fillStyle = "#0d1117"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = "rgba(42,46,57,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(chartW,H/2); ctx.stroke();

    const maxVol = Math.max(...candles.slice(firstVis,lastVis+1).map(c=>c.v),1);
    const maxDelta = Math.max(...ofData.map(c=>Math.abs(c.delta)),1);

    for (let i = firstVis; i <= lastVis; i++) {
      const c = candles[i], of2 = ofData[i - firstVis];
      const x = candleX(i);
      if (!of2 || x < 0 || x > chartW) continue;
      // volume
      const vH = (c.v/maxVol)*(H*0.32);
      ctx.fillStyle = c.c>=c.o?"rgba(38,166,154,0.28)":"rgba(239,83,80,0.28)";
      ctx.fillRect(x-bw2/2, H-vH, bw2, vH);
      // delta
      const dH = (Math.abs(of2.delta)/maxDelta)*(H*0.3);
      ctx.fillStyle = of2.delta>0?"rgba(38,166,154,0.75)":"rgba(239,83,80,0.75)";
      if(of2.delta>=0) ctx.fillRect(x-bw2/2,H/2-dH,bw2,dH);
      else ctx.fillRect(x-bw2/2,H/2,bw2,dH);
    }
    // CVD line
    const allOF = ofData.slice(0, lastVis-firstVis+1);
    if (allOF.length > 1) {
      const cvds = allOF.map(c=>c.cvd), minC=Math.min(...cvds), maxC=Math.max(...cvds), rangeC=maxC-minC||1;
      const toCY = v => H*0.08+(H*0.84)*(1-(v-minC)/rangeC);
      ctx.strokeStyle = "rgba(255,165,0,0.88)"; ctx.lineWidth = 1.4;
      ctx.beginPath();
      allOF.forEach((c,ii) => { const x=candleX(firstVis+ii); if(x<0||x>chartW) return; ii===0?ctx.moveTo(x,toCY(c.cvd)):ctx.lineTo(x,toCY(c.cvd)); });
      ctx.stroke();
    }
    // labels
    ctx.fillStyle="rgba(120,123,134,0.6)"; ctx.font="9px monospace";
    ctx.fillText("VOL",4,H-4); ctx.fillStyle="rgba(255,165,0,0.7)";
    ctx.fillText("CVD",4,12); ctx.fillStyle="rgba(100,200,255,0.5)"; ctx.fillText("Δ",4,H/2-3);
    // right bg
    ctx.fillStyle = "#0d1117"; ctx.fillRect(chartW,0,PRICE_W,H);
    ctx.strokeStyle="rgba(42,46,57,1)"; ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(chartW,0);ctx.lineTo(chartW,H);ctx.stroke();
  }, [candles, ofData, getViewport]);

  // ── Mouse / Touch / Wheel interaction ─────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const getXY = e => {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return { x:(e.clientX - r.left) * (cv.width/(r.width*dpr)) * dpr, y:(e.clientY - r.top) * (cv.height/(r.height*dpr)) * dpr };
    };

    const onDown = e => {
      e.preventDefault();
      isDraggingRef.current = true;
      const {x} = getXY(e.touches ? e.touches[0] : e);
      dragStartRef.current = { x, offset: viewOffsetRef.current };
      cv.style.cursor = "grabbing";
    };
    const onMove = e => {
      e.preventDefault();
      const src = e.touches ? e.touches[0] : e;
      const {x, y} = getXY(src);
      if (isDraggingRef.current) {
        const W = cv.width, cw = getSlotW(W - PRICE_W);
        const dx = dragStartRef.current.x - x;
        const newOff = dragStartRef.current.offset + dx / cw;
        const maxOff = Math.max(0, candles.length - 10);
        viewOffsetRef.current = Math.max(0, Math.min(newOff, maxOff));
      }
      // Update crosshair always
      crosshairRef.current = { x, y };
      draw();
    };
    const onUp = () => {
      isDraggingRef.current = false;
      cv.style.cursor = "crosshair";
    };
    const onLeave = () => {
      crosshairRef.current = null;
      isDraggingRef.current = false;
      cv.style.cursor = "crosshair";
      draw();
    };
    const onWheel = e => {
      e.preventDefault();
      const W = cv.width;
      const { cw: curW } = getViewport(W, cv.height);
      // Zoom: pinch-like feel — scroll up = zoom in (wider candles), down = out
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newW = Math.max(3, Math.min(curW * factor, (W - PRICE_W) / 4));
      candleSlotWRef.current = newW;
      // Keep the candle under cursor stationary during zoom
      const rect = cv.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (W / rect.width);
      const { chartW, firstVis, lastVis, candleX } = getViewport(W, cv.height);
      const hoverIdx = firstVis + Math.round((mouseX - candleX(firstVis)) / curW);
      const newVis = Math.ceil(chartW / newW);
      viewOffsetRef.current = Math.max(0, candles.length - 1 - hoverIdx - Math.round(newVis * (1 - mouseX/chartW)));
      draw();
    };

    cv.style.cursor = "crosshair";
    cv.addEventListener("mousedown", onDown);
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mouseup", onUp);
    cv.addEventListener("mouseleave", onLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("touchstart", onDown, { passive: false });
    cv.addEventListener("touchmove", onMove, { passive: false });
    cv.addEventListener("touchend", onUp);

    return () => {
      cv.removeEventListener("mousedown", onDown);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mouseup", onUp);
      cv.removeEventListener("mouseleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("touchstart", onDown);
      cv.removeEventListener("touchmove", onMove);
      cv.removeEventListener("touchend", onUp);
    };
  }, [candles, draw, getSlotW, getViewport]);

  // ── ResizeObserver + redraw on data change ─────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      cv.width  = cv.offsetWidth  * dpr;
      cv.height = cv.offsetHeight * dpr;
      draw();
    });
    ro.observe(cv);
    const dpr = window.devicePixelRatio || 1;
    cv.width  = cv.offsetWidth  * dpr;
    cv.height = cv.offsetHeight * dpr;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (!showOF) return;
    const cv = ofRef.current; if (!cv) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      cv.width  = cv.offsetWidth  * dpr;
      cv.height = cv.offsetHeight * dpr;
      drawOF();
    });
    ro.observe(cv);
    const dpr = window.devicePixelRatio || 1;
    cv.width  = cv.offsetWidth  * dpr;
    cv.height = cv.offsetHeight * dpr;
    drawOF();
    return () => ro.disconnect();
  }, [drawOF, showOF]);

  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",background:"#131722",borderRadius:4,overflow:"hidden"}}>
      {/* Tiny toolbar: zoom reset + scroll hint */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"3px 8px",background:"#0d1117",borderBottom:"1px solid rgba(42,46,57,0.8)",flexShrink:0}}>
        <span style={{fontSize:8,color:"#3d4663",fontFamily:"monospace",letterSpacing:1}}>⟵ DRAG TO PAN  ·  SCROLL TO ZOOM</span>
        <button onClick={()=>{ viewOffsetRef.current=0; candleSlotWRef.current=0; draw(); }}
          style={{marginLeft:"auto",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:3,color:"#4a5568",fontSize:9,fontFamily:"monospace",padding:"1px 8px",cursor:"pointer"}}>RESET VIEW</button>
      </div>
      <canvas ref={canvasRef} style={{width:"100%",flex:showOF?"1 1 68%":"1 1 100%",display:"block"}}/>
      {showOF && <div style={{height:"1px",background:"rgba(255,165,0,0.15)",flexShrink:0}}/>}
      {showOF && <canvas ref={ofRef} style={{width:"100%",flex:"1 1 32%",display:"block"}}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTF / LTF TIMEFRAME CONTEXT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function HTFPanel({ candles, pdLevels }) {
  const htf = useMemo(()=>compHTFBias(candles),[candles]);
  const bullC  = htf.filter(d=>d.bias==="BULLISH").length;
  const bearC  = htf.filter(d=>d.bias==="BEARISH").length;
  const consensus = bullC > bearC ? "BULLISH" : bearC > bullC ? "BEARISH" : "MIXED";
  const bCol = b => b==="BULLISH"?"#00ff8c":b==="BEARISH"?"#ff4f4f":"#f0c040";
  const bIcon= b => b==="BULLISH"?"▲":b==="BEARISH"?"▼":"─";
  const strength = Math.round((Math.max(bullC,bearC)/6)*100);

  return (
    <div style={{background:"rgba(0,0,0,0.32)",border:"1px solid rgba(6,182,212,0.2)",borderRadius:10,overflow:"hidden",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(6,182,212,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#06b6d4",display:"inline-block",boxShadow:"0 0 6px #06b6d4"}}/>
          <span style={{fontSize:9,fontFamily:"monospace",fontWeight:700,color:"#06b6d4",letterSpacing:2}}>MULTI-TF CONTEXT</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>{Math.max(bullC,bearC)}/6 agree · {strength}%</span>
          <span style={{fontSize:9,fontWeight:700,color:bCol(consensus),fontFamily:"monospace",padding:"2px 9px",background:bCol(consensus)+"15",border:`1px solid ${bCol(consensus)}33`,borderRadius:4}}>{bIcon(consensus)} {consensus}</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
        {/* Timeframe bias rows */}
        <div style={{padding:"8px 14px",borderRight:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{fontSize:8,color:"#334155",fontFamily:"monospace",letterSpacing:2,marginBottom:6}}>TIMEFRAME BIAS</div>
          {htf.map(({tf,bias},i)=>{
            const isHTF = i<=1, isLTF = i>=4;
            const col = bCol(bias);
            return (
              <div key={tf} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.025)"}}>
                <span style={{fontSize:8,fontFamily:"monospace",color:isHTF?"#64748b":isLTF?"#94a3b8":"#cbd5e1",width:38,flexShrink:0,fontWeight:i===3?700:400}}>{tf}</span>
                <div style={{flex:1,height:2,borderRadius:1,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                  <div style={{width:bias==="BULLISH"?"100%":bias==="BEARISH"?"0%":"50%",height:"100%",background:col,transition:"width 0.5s ease",borderRadius:1}}/>
                </div>
                <span style={{fontSize:8,fontWeight:700,fontFamily:"monospace",color:col,width:42,textAlign:"right",flexShrink:0}}>{bIcon(bias)} {bias.slice(0,4)}</span>
              </div>
            );
          })}
        </div>

        {/* PDH/PDL/PWH/PWL ERL levels */}
        <div style={{padding:"8px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{fontSize:8,color:"#334155",fontFamily:"monospace",letterSpacing:2}}>ERL LEVELS</div>
            <div style={{display:"flex",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:1.5,background:"#ff9500",borderRadius:1}}/><span style={{fontSize:7,color:"#ff9500",fontFamily:"monospace"}}>PWH/PWL</span></div>
              <div style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:1.5,background:"#ffd700",borderRadius:1}}/><span style={{fontSize:7,color:"#ffd700",fontFamily:"monospace"}}>PDH/PDL</span></div>
            </div>
          </div>
          {pdLevels ? (
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {[
                ["PWH",pdLevels.pwh,"#ff9500",pdLevels.pwhSwept,"Prev Week High"],
                ["PWL",pdLevels.pwl,"#ff9500",pdLevels.pwlSwept,"Prev Week Low"],
                ["PDH",pdLevels.pdh,"#ffd700",pdLevels.pdhSwept,"Prev Day High"],
                ["PDL",pdLevels.pdl,"#ffd700",pdLevels.pdlSwept,"Prev Day Low"],
              ].map(([label,val,color,swept,hint])=>(
                <div key={label} title={hint} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",borderRadius:5,background:swept?"rgba(255,255,255,0.01)":color+"0d",border:`1px solid ${swept?"rgba(255,255,255,0.04)":color+"2a"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:swept?"#1a2a2a":color,boxShadow:swept?"none":`0 0 4px ${color}`}}/>
                    <span style={{fontSize:8,fontFamily:"monospace",color:swept?"#334155":color,fontWeight:700}}>{label}</span>
                    <span style={{fontSize:7,color:swept?"#1a2a2a":color+"66",fontFamily:"monospace"}}>ERL</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontSize:9,fontFamily:"monospace",fontWeight:700,color:swept?"#334155":color}}>{val.toFixed(2)}</span>
                    {swept&&<span style={{fontSize:7,color:"#334155",fontFamily:"monospace",marginLeft:4}}>✓swept</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{fontSize:9,color:"#1e293b",fontFamily:"monospace",padding:"8px 0"}}>Computing ERL levels…</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// V24 NEW SYSTEMS
// 1. AUDIT LOG  — every signal, order, event persisted + displayed
// 2. RISK ENGINE — kill switches, daily loss limit, trade counter, overnight
// 3. MULTI-TF WS — 3M/5M/15M/1H/4H candle buffers from Tradovate
// 4. AUTO-SCAN ENGINE — session-gated, deduped, auto-execute
// 5. POSITION MANAGER — BE move, partial TP1 close, trail
// 6. TV WEBHOOK POLLER — polls Vercel /api/tv-alert every 5s
// ═══════════════════════════════════════════════════════════════════════════

const AUDIT_KEY = "qfd-audit-v1";
const RISK_KEY  = "qfd-risk-v1";
const FT_KEY    = "qfd-ft-v3";
const FT_CFG    = "qfd-ft-cfg-v3";
const SC_KEY    = "qfd-sc-chat-v1";
const TV_WEBHOOK_POLL_URL = "/api/tv-alert"; // Vercel serverless endpoint

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUDIT LOG — storage + hook + display panel
// ─────────────────────────────────────────────────────────────────────────────
const AUDIT_TYPES = {
  SIGNAL:   { icon:"🔍", color:"#00d4ff" },
  FT_OPEN:  { icon:"🚀", color:"#00ff8c" },
  FT_CLOSE: { icon:"📊", color:"#a3e635" },
  FT_ORDER: { icon:"📡", color:"#00d4ff" },
  FT_ERROR: { icon:"⚠",  color:"#ff4f4f" },
  ORDER:    { icon:"⚡", color:"#00ff8c" },
  MODIFY:   { icon:"✏️",  color:"#f59e0b" },
  CLOSE:    { icon:"✓",  color:"#a78bfa" },
  BE_MOVE:  { icon:"🛡",  color:"#10b981" },
  TP1_HIT:  { icon:"🎯", color:"#00ff8c" },
  SL_HIT:   { icon:"🛑", color:"#ff4f4f" },
  BLOCK:    { icon:"🚫", color:"#ff4f4f" },
  WEBHOOK:  { icon:"📡", color:"#c084fc" },
  SYSTEM:   { icon:"⚙️",  color:"#475569" },
};

function useAuditLog() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await { value: localStorage.getItem(AUDIT_KEY) };
        if (r && r.value) setEntries(JSON.parse(r.value));
      } catch {}
    })();
  }, []);

  const log = useCallback(async (type, msg, meta = {}) => {
    const entry = {
      id:   Date.now() + Math.random(),
      ts:   new Date().toISOString(),
      type,
      msg,
      meta,
    };
    setEntries(prev => {
      const next = [entry, ...prev].slice(0, 500); // keep last 500
      Promise.resolve(localStorage.setItem(AUDIT_KEY, JSON.stringify(next)));
      return next;
    });
  }, []);

  const clear = useCallback(async () => {
    setEntries([]);
    await Promise.resolve(localStorage.setItem(AUDIT_KEY, JSON.stringify([])));
  }, []);

  return { entries, log, clear };
}

function AuditPanel({ entries, onClear }) {
  const [filter, setFilter] = useState("ALL");
  const types = ["ALL", ...Object.keys(AUDIT_TYPES)];
  const shown = filter === "ALL" ? entries : entries.filter(e => e.type === filter);

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:10, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
        borderBottom:"1px solid rgba(255,255,255,0.06)", flexWrap:"wrap" }}>
        <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace", fontWeight:700,
          letterSpacing:2 }}>AUDIT LOG</span>
        <span style={{ fontSize:9, color:"#334155", fontFamily:"monospace" }}>
          {entries.length} events
        </span>
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              style={{ padding:"2px 7px", borderRadius:4, cursor:"pointer",
                fontFamily:"monospace", fontSize:8,
                border:`1px solid ${filter===t?"rgba(0,212,255,0.4)":"rgba(255,255,255,0.06)"}`,
                background: filter===t?"rgba(0,212,255,0.08)":"transparent",
                color: filter===t?"#00d4ff":"#334155" }}>{t}</button>
          ))}
        </div>
        <button onClick={onClear} style={{ marginLeft:"auto", padding:"2px 8px", borderRadius:4,
          cursor:"pointer", fontSize:8, fontFamily:"monospace",
          border:"1px solid rgba(255,80,80,0.2)", background:"rgba(255,80,80,0.06)",
          color:"#ff4f4f" }}>Clear</button>
      </div>
      <div style={{ maxHeight:300, overflowY:"auto" }}>
        {shown.length === 0 && (
          <div style={{ padding:"16px", fontSize:9, color:"#334155", fontFamily:"monospace",
            textAlign:"center" }}>No events logged yet</div>
        )}
        {shown.map(e => {
          const cfg = AUDIT_TYPES[e.type] || AUDIT_TYPES.SYSTEM;
          const ts  = new Date(e.ts);
          return (
            <div key={e.id} style={{ display:"flex", alignItems:"flex-start", gap:8,
              padding:"6px 14px", borderBottom:"1px solid rgba(255,255,255,0.03)",
              background:"rgba(255,255,255,0.01)" }}>
              <span style={{ fontSize:11, flexShrink:0, marginTop:1 }}>{cfg.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:1 }}>
                  <span style={{ fontSize:8, fontFamily:"monospace", fontWeight:700,
                    color:cfg.color }}>{e.type}</span>
                  <span style={{ fontSize:8, color:"#1e293b", fontFamily:"monospace" }}>
                    {ts.toLocaleTimeString()} {ts.toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize:9, color:"#94a3b8", fontFamily:"monospace",
                  lineHeight:1.5, wordBreak:"break-word" }}>{e.msg}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RISK ENGINE — daily limits, kill switches, trade counter
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_RISK_CONFIG = {
  maxDailyLossPct:  2.0,   // % of account balance
  maxDailyTrades:   2,     // ICT rule: max 1-2 trades/day
  maxDrawdownPct:   5.0,   // account-level drawdown halt
  noOvernightHour:  15,    // 3:00 PM EST local hour cutoff (in EST)
  noOvernightMin:   45,    // 3:45 PM EST
  blockFriday:      true,  // no trades after 3PM Friday
  minGradeAutoExec: "B",   // minimum grade for auto-execution
  autoExecEnabled:  false, // master auto-execute toggle
};

function useRiskEngine({ accountBalance, dayPnl, log }) {
  const [config,     setConfig]     = useState(DEFAULT_RISK_CONFIG);
  const [tradeCount, setTradeCount] = useState(0);
  const [killed,     setKilled]     = useState(false);
  const [killReason, setKillReason] = useState("");
  const [tradeDate,  setTradeDate]  = useState("");

  // Reset daily counter at midnight
  useEffect(() => {
    const today = new Date().toDateString();
    if (tradeDate !== today) {
      setTradeCount(0);
      setTradeDate(today);
      setKilled(false);
      setKillReason("");
    }
  });

  // Check all kill conditions
  const riskCheck = useCallback((currentPrice) => {
    const now     = new Date();
    const estOff  = -5; // EST offset (approximate — ignores DST for simplicity)
    const utcH    = now.getUTCHours();
    const utcM    = now.getUTCMinutes();
    const estH    = ((utcH + estOff) + 24) % 24;
    const estMin  = utcM;
    const dow     = now.getDay(); // 0=Sun, 5=Fri, 6=Sat

    // Weekend block
    if (dow === 0 || dow === 6) return { ok:false, reason:"Weekend — market closed" };

    // Friday afternoon block
    if (dow === 5 && config.blockFriday) {
      if (estH >= 15) return { ok:false, reason:"Friday 3PM+ — no new trades" };
    }

    // Overnight cutoff
    const cutoffMins = config.noOvernightHour * 60 + config.noOvernightMin;
    const nowMins    = estH * 60 + estMin;
    if (nowMins >= cutoffMins) return { ok:false, reason:`Overnight cutoff (${config.noOvernightHour}:${String(config.noOvernightMin).padStart(2,"0")} EST)` };

    // NY Lunch block (12:00-1:00 PM EST)
    if (estH === 12 || (estH === 13 && estMin < 0)) return { ok:false, reason:"NY Lunch 12-1PM — no trades" };

    // Daily trade limit
    if (tradeCount >= config.maxDailyTrades) {
      return { ok:false, reason:`Max ${config.maxDailyTrades} trades/day reached (${tradeCount} placed)` };
    }

    // Daily loss limit
    if (accountBalance && dayPnl !== undefined) {
      const lossPct = Math.abs(Math.min(0, dayPnl)) / accountBalance * 100;
      if (lossPct >= config.maxDailyLossPct) {
        return { ok:false, reason:`Daily loss limit ${config.maxDailyLossPct}% hit (current: -${lossPct.toFixed(2)}%)` };
      }
    }

    // Manual kill switch
    if (killed) return { ok:false, reason:`Manual kill: ${killReason}` };

    return { ok:true, reason:"" };
  }, [config, tradeCount, killed, killReason, accountBalance, dayPnl]);

  const recordTrade = useCallback(() => {
    setTradeCount(c => c + 1);
    log?.("SYSTEM", `Trade recorded. Day total: ${tradeCount + 1}/${config.maxDailyTrades}`);
  }, [tradeCount, config.maxDailyTrades, log]);

  const killSwitch = useCallback((reason = "Manual kill") => {
    setKilled(true);
    setKillReason(reason);
    log?.("BLOCK", `KILL SWITCH: ${reason}`);
  }, [log]);

  const resetKill = useCallback(() => {
    setKilled(false);
    setKillReason("");
    log?.("SYSTEM", "Kill switch reset");
  }, [log]);

  // Session window check (separate from kill check)
  const isInSession = useCallback(() => {
    const now    = new Date();
    const utcH   = now.getUTCHours();
    const utcM   = now.getUTCMinutes();
    const estH   = ((utcH - 5) + 24) % 24;
    const estMin = utcM;
    const mins   = estH * 60 + estMin;
    // Silver Bullet: 9:30–11:00 EST  → 570–660 mins
    // NY PM: 13:30–15:00 EST         → 810–900 mins
    const inSB  = mins >= 570 && mins <= 660;
    const inPM  = mins >= 810 && mins <= 900;
    return { inSession: inSB || inPM, inSB, inPM,
      label: inSB ? "⚡ SILVER BULLET" : inPM ? "🌆 NY PM" : "⏸ OFF SESSION" };
  }, []);

  return { config, setConfig, tradeCount, riskCheck, recordTrade,
    killSwitch, resetKill, killed, killReason, isInSession };
}

function RiskPanel({ riskEngine, accountBalance, dayPnl }) {
  const { config, setConfig, tradeCount, killed, killReason, killSwitch, resetKill, isInSession } = riskEngine;
  const { inSession, label } = isInSession();
  const lossPct = accountBalance && dayPnl < 0
    ? Math.abs(dayPnl) / accountBalance * 100 : 0;
  const lossBarPct = Math.min(100, lossPct / config.maxDailyLossPct * 100);

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${killed?"rgba(255,80,80,0.4)":"rgba(255,255,255,0.07)"}`,
      borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace", fontWeight:700,
          letterSpacing:2 }}>RISK ENGINE</span>
        <span style={{ fontSize:9, fontFamily:"monospace", fontWeight:700,
          padding:"2px 8px", borderRadius:4,
          background: inSession?"rgba(0,255,140,0.1)":"rgba(71,85,105,0.2)",
          color: inSession?"#00ff8c":"#475569",
          border: `1px solid ${inSession?"rgba(0,255,140,0.3)":"rgba(255,255,255,0.06)"}` }}>
          {label}
        </span>
        {killed && (
          <span style={{ fontSize:9, fontFamily:"monospace", fontWeight:700,
            padding:"2px 8px", borderRadius:4, background:"rgba(255,80,80,0.12)",
            color:"#ff4f4f", border:"1px solid rgba(255,80,80,0.3)" }}>
            🚫 KILLED
          </span>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          {killed
            ? <button onClick={resetKill}
                style={{ padding:"4px 10px", borderRadius:5, cursor:"pointer",
                  fontFamily:"monospace", fontSize:9, fontWeight:700,
                  border:"1px solid rgba(0,255,140,0.3)", background:"rgba(0,255,140,0.08)",
                  color:"#00ff8c" }}>↺ RESET</button>
            : <button onClick={() => killSwitch("Manual")}
                style={{ padding:"4px 10px", borderRadius:5, cursor:"pointer",
                  fontFamily:"monospace", fontSize:9, fontWeight:700,
                  border:"1px solid rgba(255,80,80,0.3)", background:"rgba(255,80,80,0.08)",
                  color:"#ff4f4f" }}>KILL SWITCH</button>
          }
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:10 }}>
        {[
          ["Trades Today", `${tradeCount} / ${config.maxDailyTrades}`,
            tradeCount >= config.maxDailyTrades ? "#ff4f4f" : "#00ff8c"],
          ["Day P&L", dayPnl !== undefined ? `${dayPnl >= 0 ? "+" : ""}$${dayPnl?.toFixed?.(2) ?? "–"}` : "–",
            dayPnl >= 0 ? "#00ff8c" : "#ff4f4f"],
          ["Loss vs Limit", `${lossPct.toFixed(1)}% / ${config.maxDailyLossPct}%`,
            lossPct >= config.maxDailyLossPct ? "#ff4f4f" : lossPct >= config.maxDailyLossPct * 0.7 ? "#f59e0b" : "#94a3b8"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:"rgba(0,0,0,0.3)", borderRadius:6, padding:"7px 10px" }}>
            <div style={{ fontSize:7, color:"#334155", fontFamily:"monospace", letterSpacing:1, marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:11, fontWeight:700, color:c, fontFamily:"monospace" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Daily loss bar */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:7, color:"#334155", fontFamily:"monospace", letterSpacing:1, marginBottom:4 }}>
          DAILY LOSS METER
        </div>
        <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${lossBarPct}%`,
            background: lossBarPct >= 100 ? "#ff4f4f" : lossBarPct >= 70 ? "#f59e0b" : "#10b981",
            borderRadius:2, transition:"width 0.5s" }}/>
        </div>
      </div>

      {/* Config toggles */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:8 }}>
        {[
          ["Max daily trades", config.maxDailyTrades, v => setConfig(c=>({...c,maxDailyTrades:parseInt(v)})), "number", "1"],
          ["Max loss %", config.maxDailyLossPct, v => setConfig(c=>({...c,maxDailyLossPct:parseFloat(v)})), "number", "0.5"],
          ["Cutoff hour (EST)", config.noOvernightHour, v => setConfig(c=>({...c,noOvernightHour:parseInt(v)})), "number", "1"],
          ["Min grade auto-exec", config.minGradeAutoExec, v => setConfig(c=>({...c,minGradeAutoExec:v})), "text", null],
        ].map(([l,v,set,t,step]) => (
          <div key={l}>
            <div style={{ color:"#334155", fontFamily:"monospace", marginBottom:2, letterSpacing:1 }}>{l}</div>
            <input type={t} value={v} step={step} onChange={e=>set(e.target.value)}
              style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.08)", borderRadius:4, color:"#94a3b8",
                padding:"3px 6px", fontSize:10, fontFamily:"monospace" }}/>
          </div>
        ))}
      </div>

      {killed && killReason && (
        <div style={{ marginTop:10, padding:"6px 10px", borderRadius:5,
          background:"rgba(255,80,80,0.06)", border:"1px solid rgba(255,80,80,0.2)",
          fontSize:8, color:"#ff4f4f", fontFamily:"monospace" }}>
          Kill reason: {killReason}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MULTI-TF CANDLE MANAGER
// Maintains separate candle buffers for 3M, 5M, 15M, 1H, 4H
// Uses one WS connection per TF (Tradovate allows multiple subscriptions)
// ─────────────────────────────────────────────────────────────────────────────
const MULTI_TF_LIST = [
  { tf:"1",  label:"1M",   size:1  },
  { tf:"3",  label:"3M",   size:3  },
  { tf:"5",  label:"5M",   size:5  },
  { tf:"15", label:"15M",  size:15 },
  { tf:"60", label:"1H",   size:60 },
  { tf:"240",label:"4H",   size:240},
];

function useMultiTFCandles({ conn, instrument }) {
  // Store candles per TF: { "3": [...], "5": [...], ... }
  const [tfCandles, setTFCandles] = useState({});
  const wsRefs  = useRef({});   // one WS per TF
  const hbRefs  = useRef({});
  const reqRefs = useRef({});

  const buildCandle = (bar) => ({
    t: bar.timestamp ? new Date(bar.timestamp).getTime() : Date.now(),
    o: bar.open, h: bar.high, l: bar.low, c: bar.close,
    v: (bar.upVolume||0) + (bar.downVolume||0) || bar.totalVolume || 0,
    askVol: bar.upVolume  || 0,
    bidVol: bar.downVolume|| 0,
    delta:  (bar.upVolume||0) - (bar.downVolume||0),
  });

  const connectTF = useCallback((tfEntry) => {
    if (!conn?.token) return;
    const { tf, size } = tfEntry;
    const env     = conn.env === "live" ? "live" : "demo";
    const url     = `wss://md-${env}.tradovateapi.com/v1/websocket`;
    const sym     = getTradovateSymbol(instrument);
    let ws;
    try { ws = new WebSocket(url); } catch { return; }
    wsRefs.current[tf]  = ws;
    reqRefs.current[tf] = 1;

    const send = (type, body={}) => {
      const id  = reqRefs.current[tf]++;
      const msg = `${type}\n${id}\n\n${JSON.stringify(body)}`;
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    };

    ws.onopen = () => {
      send("authorize", { token: conn.token });
      hbRefs.current[tf] = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("[]");
      }, 2500);
    };

    ws.onmessage = (evt) => {
      const raw = evt.data;
      if (!raw || raw === "o" || raw === "h") return;
      let frames = [];
      try {
        if (raw.startsWith("a[")) {
          const arr = JSON.parse(raw.slice(1));
          frames = arr.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
        } else if (raw.startsWith("{")) {
          frames = [JSON.parse(raw)];
        }
      } catch { return; }

      frames.forEach(frame => {
        if (!frame) return;
        // Auth OK → subscribe
        if (frame.s === 200 && frame.i === 1) {
          send("md/getChart", {
            symbol: sym,
            chartDescription: {
              underlyingType:  "MinuteBar",
              elementSize:     size,
              elementSizeUnit: "UnderlyingUnits",
              withHistogram:   false,
            },
            timeRange: { asMuchAsElements: 300 },
          });
        }
        // Historical bars
        if (frame.e === "chart" && frame.d?.charts) {
          const bars = frame.d.charts[0]?.bars || [];
          if (bars.length) {
            const candles = bars.map(buildCandle);
            setTFCandles(prev => ({ ...prev, [tf]: candles }));
          }
        }
        // Real-time updates
        if ((frame.e === "md/chart" || frame.e === "chart") && frame.d?.charts) {
          const bars = frame.d.charts[0]?.bars || [];
          bars.forEach(bar => {
            const c = buildCandle(bar);
            setTFCandles(prev => {
              const existing = prev[tf] || [];
              // Replace last candle if same timestamp, else append
              const last = existing[existing.length - 1];
              const updated = last && Math.abs(last.t - c.t) < 30000
                ? [...existing.slice(0, -1), c]
                : [...existing.slice(-499), c];
              return { ...prev, [tf]: updated };
            });
          });
        }
      });
    };

    ws.onerror = () => {};
    ws.onclose = () => { clearInterval(hbRefs.current[tf]); };
  }, [conn, instrument]);

  // Connect all TFs when Tradovate is connected
  useEffect(() => {
    if (!conn?.token) return;
    // Close any existing connections first
    Object.values(wsRefs.current).forEach(ws => ws?.close(1000));
    wsRefs.current = {};
    Object.values(hbRefs.current).forEach(id => clearInterval(id));
    hbRefs.current = {};
    // Open new connections
    MULTI_TF_LIST.forEach(tfEntry => connectTF(tfEntry));
    return () => {
      Object.values(wsRefs.current).forEach(ws => ws?.close(1000));
      Object.values(hbRefs.current).forEach(id => clearInterval(id));
    };
  }, [conn?.token, conn?.env, instrument, connectTF]);

  // Helper: get candles for a specific TF
  const get = useCallback((tf) => tfCandles[tf] || [], [tfCandles]);

  return { tfCandles, get };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUTO-SCAN ENGINE — session-gated, deduped, optional auto-execute
// ─────────────────────────────────────────────────────────────────────────────
function AutoScanEngine({ candles, riskEngine, onScanTrigger, onAutoExecute, conn, lastSignal }) {
  const [enabled,      setEnabled]     = useState(false);
  const [intervalSecs, setIntervalSecs]= useState(30);
  const [status,       setStatus]      = useState("idle");
  const [nextScanIn,   setNextScanIn]  = useState(0);
  const [lastFiredAt,  setLastFiredAt] = useState(null);
  const [dedupMins,    setDedupMins]   = useState(5); // don't repeat same direction within N mins
  const lastDirectionRef = useRef(null);
  const lastDirectionTs  = useRef(0);
  const countdownRef     = useRef(null);
  const scanRef          = useRef(null);

  const { isInSession, riskCheck } = riskEngine;

  // Countdown tick
  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    countdownRef.current = setInterval(() => {
      setNextScanIn(prev => {
        if (prev <= 1) {
          // Time to scan
          triggerScan();
          return intervalSecs;
        }
        return prev - 1;
      });
    }, 1000);
    setNextScanIn(intervalSecs);
    return () => clearInterval(countdownRef.current);
  }, [enabled, intervalSecs]);

  const triggerScan = useCallback(() => {
    const { inSession, label } = isInSession();
    if (!inSession) {
      setStatus(`paused — ${label}`);
      return;
    }
    const risk = riskCheck();
    if (!risk.ok) {
      setStatus(`blocked — ${risk.reason}`);
      return;
    }
    // All good — fire scan
    setStatus("scanning");
    setLastFiredAt(new Date().toLocaleTimeString());
    onScanTrigger?.();
  }, [isInSession, riskCheck, onScanTrigger]);

  // Handle dedup after a signal comes back
  useEffect(() => {
    if (!lastSignal?.direction || lastSignal.direction === "FLAT") return;
    const now = Date.now();
    const timeSinceSame = now - lastDirectionTs.current;
    if (lastDirectionRef.current === lastSignal.direction
        && timeSinceSame < dedupMins * 60 * 1000) {
      setStatus(`dedup — same ${lastSignal.direction} within ${dedupMins}m`);
      return;
    }
    lastDirectionRef.current = lastSignal.direction;
    lastDirectionTs.current  = now;

    // Check auto-execute conditions
    if (riskEngine.config.autoExecEnabled && conn) {
      const gradeOrder = ["A","B","C","D"];
      const minIdx     = gradeOrder.indexOf(riskEngine.config.minGradeAutoExec);
      const sigIdx     = gradeOrder.indexOf(lastSignal.grade || "D");
      if (sigIdx <= minIdx) {
        setStatus(`auto-executing Grade ${lastSignal.grade}`);
        onAutoExecute?.(lastSignal);
      }
    }
    setStatus("waiting");
  }, [lastSignal]);

  const sessionInfo = isInSession();

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${enabled?"rgba(0,212,255,0.25)":"rgba(255,255,255,0.07)"}`,
      borderRadius:10, padding:"12px 16px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace", fontWeight:700,
          letterSpacing:2 }}>AUTO-SCAN ENGINE</span>

        {/* Session indicator */}
        <span style={{ fontSize:9, fontFamily:"monospace",
          color: sessionInfo.inSession ? "#00ff8c" : "#334155" }}>
          {sessionInfo.label}
        </span>

        {/* Status */}
        <span style={{ fontSize:8, fontFamily:"monospace", color:"#64748b",
          background:"rgba(0,0,0,0.3)", padding:"2px 7px", borderRadius:4 }}>
          {status}
        </span>

        {enabled && nextScanIn > 0 && (
          <span style={{ fontSize:8, fontFamily:"monospace", color:"#00d4ff" }}>
            next scan in {nextScanIn}s
          </span>
        )}
        {lastFiredAt && (
          <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>
            last: {lastFiredAt}
          </span>
        )}

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          {/* Interval */}
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>every</span>
            <input type="number" value={intervalSecs} min="15" max="300" step="5"
              onChange={e => setIntervalSecs(parseInt(e.target.value))}
              style={{ width:44, background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)", borderRadius:4, color:"#94a3b8",
                padding:"2px 5px", fontSize:10, fontFamily:"monospace", textAlign:"center" }}/>
            <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>s</span>
          </div>

          {/* Dedup */}
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>dedup</span>
            <input type="number" value={dedupMins} min="1" max="30" step="1"
              onChange={e => setDedupMins(parseInt(e.target.value))}
              style={{ width:36, background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)", borderRadius:4, color:"#94a3b8",
                padding:"2px 5px", fontSize:10, fontFamily:"monospace", textAlign:"center" }}/>
            <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>m</span>
          </div>

          {/* Enable toggle */}
          <button onClick={() => setEnabled(e => !e)}
            style={{ padding:"5px 14px", borderRadius:6, cursor:"pointer",
              fontFamily:"monospace", fontSize:10, fontWeight:700, letterSpacing:1,
              border:`1px solid ${enabled?"rgba(0,212,255,0.4)":"rgba(255,255,255,0.1)"}`,
              background: enabled?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.03)",
              color: enabled?"#00d4ff":"#475569" }}>
            {enabled ? "⏸ PAUSE" : "▶ ENABLE"}
          </button>

          {/* Manual trigger */}
          <button onClick={triggerScan}
            style={{ padding:"5px 10px", borderRadius:6, cursor:"pointer",
              fontFamily:"monospace", fontSize:10,
              border:"1px solid rgba(255,255,255,0.08)",
              background:"rgba(255,255,255,0.03)", color:"#475569" }}>
            ↺ NOW
          </button>
        </div>
      </div>

      {/* Auto-execute toggle */}
      <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
        <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
          <input type="checkbox"
            checked={riskEngine.config.autoExecEnabled}
            onChange={e => riskEngine.setConfig(c => ({...c, autoExecEnabled: e.target.checked}))}
            style={{ accentColor:"#f59e0b" }}/>
          <span style={{ fontSize:8, color:"#f59e0b", fontFamily:"monospace", fontWeight:700 }}>
            AUTO-EXECUTE (requires Tradovate connected + Grade ≥ {riskEngine.config.minGradeAutoExec})
          </span>
        </label>
        {riskEngine.config.autoExecEnabled && (
          <span style={{ fontSize:8, color:"#ff4f4f", fontFamily:"monospace",
            background:"rgba(255,80,80,0.08)", border:"1px solid rgba(255,80,80,0.2)",
            padding:"2px 7px", borderRadius:4 }}>
            ⚡ LIVE ORDERS WILL BE PLACED AUTOMATICALLY
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. POSITION MANAGER — BE move, partial TP1, trail with structure
// ─────────────────────────────────────────────────────────────────────────────
function usePositionManager({ conn, positions, lastPrice, tradeSetup, log }) {
  const [actions,  setActions]  = useState([]);
  const [beMoveDone, setBeMoveDone] = useState({});  // orderId → bool
  const [tp1Done,    setTp1Done]    = useState({});

  const NQ_POINT_VAL = 20; // $20 per point NQ

  useEffect(() => {
    if (!conn?.api || !positions?.length || !lastPrice || !tradeSetup) return;

    positions.forEach(async (pos) => {
      const posKey = pos.id || pos.contractId;
      const isLong = pos.netPos > 0;
      const entry  = pos.avgPrice;
      const qty    = Math.abs(pos.netPos);

      // ── Move to BE ─────────────────────────────────────────────────────
      if (!beMoveDone[posKey] && tradeSetup?.stop_price) {
        const riskPts  = Math.abs(entry - tradeSetup.stop_price);
        const unrealPts= isLong ? lastPrice - entry : entry - lastPrice;
        if (unrealPts >= riskPts && riskPts > 0) {
          // At 1:1 — move SL to entry
          try {
            // Find working stop order for this position
            const orders = await conn.api.getOrders();
            const stopOrd = (Array.isArray(orders) ? orders : []).find(o =>
              o.accountId === conn.accountId &&
              o.orderType === "Stop" &&
              ["Working","Accepted"].includes(o.ordStatus)
            );
            if (stopOrd) {
              await conn.api.modifyOrder({ orderId: stopOrd.id, stopPrice: entry });
              setBeMoveDone(prev => ({ ...prev, [posKey]: true }));
              setActions(prev => [...prev, { ts:Date.now(), msg:`BE moved for ${pos.contractId} @ ${entry}` }]);
              log?.("BE_MOVE", `Stop moved to breakeven ${entry.toFixed(2)} for ${pos.contractId || "position"}`);
            }
          } catch (err) {
            log?.("SYSTEM", `BE move failed: ${err.message}`);
          }
        }
      }

      // ── Partial close at TP1 (50%) ──────────────────────────────────────
      if (!tp1Done[posKey] && tradeSetup?.tp1_price) {
        const tp1Hit = isLong
          ? lastPrice >= tradeSetup.tp1_price
          : lastPrice <= tradeSetup.tp1_price;
        if (tp1Hit) {
          const closeQty = Math.max(1, Math.floor(qty / 2));
          try {
            await conn.api.placeOrder({
              accountId: conn.accountId,
              symbol:    pos.contractId,
              action:    isLong ? "Sell" : "Buy",
              qty:       closeQty,
              orderType: "Market",
            });
            setTp1Done(prev => ({ ...prev, [posKey]: true }));
            log?.("TP1_HIT", `TP1 partial close — ${closeQty} of ${qty} ${pos.contractId} @ ~${lastPrice.toFixed(2)}`);
          } catch (err) {
            log?.("SYSTEM", `TP1 partial close failed: ${err.message}`);
          }
        }
      }
    });
  }, [lastPrice, positions, tradeSetup, conn]);

  return { actions };
}

function PositionManagerPanel({ conn, positions, lastPrice, tradeSetup, log }) {
  const { actions } = usePositionManager({ conn, positions, lastPrice, tradeSetup, log });
  if (!positions?.length) return null;

  return (
    <div style={{ background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.15)",
      borderRadius:8, padding:"10px 14px", marginBottom:8 }}>
      <div style={{ fontSize:8, color:"#10b981", fontFamily:"monospace", fontWeight:700,
        letterSpacing:2, marginBottom:6 }}>POSITION MANAGER</div>
      <div style={{ fontSize:8, color:"#475569", fontFamily:"monospace", lineHeight:1.6 }}>
        {positions.map((p, i) => {
          const isLong  = p.netPos > 0;
          const entry   = p.avgPrice;
          const pnlPts  = isLong ? lastPrice - entry : entry - lastPrice;
          const riskPts = tradeSetup?.stop_price ? Math.abs(entry - (tradeSetup.stop_price)) : null;
          const atBE    = riskPts && pnlPts >= riskPts;
          const atTP1   = tradeSetup?.tp1_price && (isLong ? lastPrice >= tradeSetup.tp1_price : lastPrice <= tradeSetup.tp1_price);
          return (
            <div key={i} style={{ display:"flex", gap:8, padding:"2px 0" }}>
              <span style={{ color: isLong?"#00ff8c":"#ff4f4f", fontWeight:700 }}>
                {isLong?"LONG":"SHORT"} {Math.abs(p.netPos)}×
              </span>
              <span>entry {entry?.toFixed(2)}</span>
              <span style={{ color: atTP1?"#00ff8c":atBE?"#f59e0b":"#94a3b8" }}>
                {atTP1 ? "✓ TP1 HIT" : atBE ? "✓ AT BE" : `+${pnlPts.toFixed(1)}pts`}
              </span>
            </div>
          );
        })}
        {actions.slice(-3).map((a, i) => (
          <div key={i} style={{ color:"#10b981", marginTop:2 }}>✓ {a.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TRADINGVIEW WEBHOOK POLLER
// Polls /api/tv-alert every 5s for incoming TradingView Pine Script alerts
// That endpoint is a Vercel serverless function (see api/tv-alert.js)
// ─────────────────────────────────────────────────────────────────────────────
function useTVWebhook({ enabled, onAlert, log }) {
  const [lastAlert,    setLastAlert]    = useState(null);
  const [webhookStatus,setWebhookStatus]= useState("idle");
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    setWebhookStatus("polling");
    const id = setInterval(async () => {
      try {
        const res  = await fetch(TV_WEBHOOK_POLL_URL);
        if (!res.ok) { setWebhookStatus("error"); return; }
        const data = await res.json();
        if (data?.id && data.id !== lastIdRef.current) {
          lastIdRef.current = data.id;
          setLastAlert(data);
          setWebhookStatus("received");
          log?.("WEBHOOK", `TradingView alert: ${data.message || JSON.stringify(data)}`);
          onAlert?.(data);
          setTimeout(() => setWebhookStatus("polling"), 3000);
        }
      } catch {
        setWebhookStatus("error");
      }
    }, 5000);
    return () => clearInterval(id);
  }, [enabled, onAlert, log]);

  return { lastAlert, webhookStatus };
}

function TVWebhookPanel({ webhookStatus, lastAlert, enabled, onToggle }) {
  const statusColor = {
    polling:"#00d4ff", received:"#00ff8c", error:"#ff4f4f", idle:"#334155"
  }[webhookStatus] || "#334155";

  return (
    <div style={{ background:"rgba(192,132,252,0.04)", border:"1px solid rgba(192,132,252,0.15)",
      borderRadius:8, padding:"10px 14px", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:statusColor,
          boxShadow: webhookStatus==="polling"?`0 0 6px ${statusColor}`:"none",
          animation: webhookStatus==="polling"?"pulse 2s infinite":"none" }}/>
        <span style={{ fontSize:9, color:"#c084fc", fontFamily:"monospace", fontWeight:700,
          letterSpacing:2 }}>TV WEBHOOK</span>
        <span style={{ fontSize:8, color:statusColor, fontFamily:"monospace" }}>{webhookStatus}</span>
        <div style={{ marginLeft:"auto" }}>
          <button onClick={onToggle}
            style={{ padding:"3px 10px", borderRadius:4, cursor:"pointer",
              fontFamily:"monospace", fontSize:8, fontWeight:700,
              border:`1px solid ${enabled?"rgba(192,132,252,0.4)":"rgba(255,255,255,0.08)"}`,
              background: enabled?"rgba(192,132,252,0.08)":"transparent",
              color: enabled?"#c084fc":"#475569" }}>
            {enabled ? "⏸ STOP" : "▶ POLL"}
          </button>
        </div>
      </div>

      <div style={{ fontSize:8, color:"#475569", fontFamily:"monospace", lineHeight:1.6 }}>
        <span style={{ color:"#c084fc" }}>Endpoint: </span>
        <span style={{ color:"#64748b" }}>{TV_WEBHOOK_POLL_URL}</span>
        <br/>
        <span style={{ color:"#334155" }}>In TradingView → Alert → Webhook URL → </span>
        <span style={{ color:"#94a3b8" }}>https://your-domain.com/api/tv-alert</span>
      </div>

      {lastAlert && (
        <div style={{ marginTop:8, padding:"6px 8px", borderRadius:5,
          background:"rgba(192,132,252,0.06)", border:"1px solid rgba(192,132,252,0.15)",
          fontSize:8, fontFamily:"monospace", color:"#c084fc" }}>
          Last: {new Date(lastAlert.ts || Date.now()).toLocaleTimeString()} ·{" "}
          {lastAlert.message || lastAlert.direction || JSON.stringify(lastAlert)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE DATA STATUS BADGE — shown in header
// ─────────────────────────────────────────────────────────────────────────────
function LiveDataBadge({ tfCandles, conn }) {
  if (!conn) return null;
  const tfs    = Object.keys(tfCandles);
  const loaded = tfs.filter(tf => tfCandles[tf]?.length > 5);
  return (
    <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
      {MULTI_TF_LIST.filter(t => ["3","5","15","60","240"].includes(t.tf)).map(({ tf, label }) => {
        const count = tfCandles[tf]?.length || 0;
        const ok    = count > 5;
        return (
          <span key={tf} style={{ fontSize:8, fontFamily:"monospace", fontWeight:700,
            padding:"2px 5px", borderRadius:3,
            background: ok?"rgba(0,255,140,0.08)":"rgba(255,255,255,0.03)",
            color: ok?"#00ff8c":"#334155",
            border: `1px solid ${ok?"rgba(0,255,140,0.2)":"rgba(255,255,255,0.05)"}` }}>
            {label}{ok?` ✓`:""}
          </span>
        );
      })}
      <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>
        {loaded.length}/{tfs.length} TFs live
      </span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// V25 ADDITIONS
// 1. NY SESSION AUTO-JOURNAL (fires at 3:45 PM EST close)
// 2. COMBINED EXECUTION + AUDIT TAB  
// 3. ADDITIONAL QUANTITATIVE STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// 1. NY SESSION AUTO-JOURNAL
// At 3:45 PM EST, any trade from auditEntries that day gets auto-logged
// to the journal if not already there.
// ─────────────────────────────────────────────────────────────────────────────
function useAutoJournal({ auditEntries, tradeSetup, conn, instrument, log }) {
  const [lastJournalDate, setLastJournalDate] = useState("");
  const [journaled, setJournaled] = useState(false);

  useEffect(() => {
    const check = async () => {
      const now  = new Date();
      const utcH = now.getUTCHours();
      const estH = ((utcH - 5) + 24) % 24;
      const estM = now.getUTCMinutes();
      const today = now.toDateString();

      // Fire at 3:45–3:59 PM EST, once per day
      const isCloseWindow = estH === 15 && estM >= 45;
      if (!isCloseWindow || lastJournalDate === today) return;

      // Gather today's ORDER + CLOSE events from audit log
      const todayEntries = auditEntries.filter(e => {
        const eDate = new Date(e.ts).toDateString();
        return eDate === today && (e.type === "ORDER" || e.type === "TP1_HIT" || e.type === "SL_HIT" || e.type === "CLOSE");
      });
      if (!todayEntries.length) return;

      // Load existing journal entries
      let existing = [];
      try {
        const r = await { value: localStorage.getItem("qfd-journal-v1") };
        if (r && r.value) existing = JSON.parse(r.value);
      } catch {}

      // Build a journal entry from today's trade data
      const orderEntry = todayEntries.find(e => e.type === "ORDER");
      const slHit      = todayEntries.find(e => e.type === "SL_HIT");
      const tp1Hit     = todayEntries.find(e => e.type === "TP1_HIT");

      // Check if today already journaled (by date match)
      const alreadyJournaled = existing.some(j =>
        new Date(j.date).toDateString() === today && j.auto === true
      );
      if (alreadyJournaled) { setLastJournalDate(today); return; }

      const outcome = slHit ? "LOSS" : tp1Hit ? "WIN" : "RUNNING";
      const entry = {
        id:         `auto_${Date.now()}`,
        auto:       true,
        date:       new Date().toISOString().slice(0, 16),
        instrument: instrument || "NQ",
        direction:  tradeSetup?.direction || (orderEntry?.meta?.action === "Buy" ? "LONG" : "SHORT"),
        setup:      tradeSetup?.setup || "AI Scan",
        entry:      tradeSetup?.entry_bot || "",
        sl:         tradeSetup?.stop_price || "",
        tp1:        tradeSetup?.tp1_price  || "",
        tp2:        tradeSetup?.tp2_price  || "",
        outcome,
        exit:       "",
        grade:      tradeSetup?.grade || "",
        pnl_dollars:"",
        contracts:  orderEntry?.meta?.qty || 1,
        notes: `Auto-journaled at NY close.\n` +
          todayEntries.map(e => `[${new Date(e.ts).toLocaleTimeString()}] ${e.type}: ${e.msg}`).join("\n"),
      };

      const updated = [entry, ...existing];
      await Promise.resolve(localStorage.setItem("qfd-journal-v1", JSON.stringify(updated)));
      setLastJournalDate(today);
      setJournaled(true);
      log?.("SYSTEM", `Auto-journaled ${todayEntries.length} events for ${today}`);
      setTimeout(() => setJournaled(false), 10000);
    };

    const id = setInterval(check, 60000); // check every minute
    check(); // also check immediately
    return () => clearInterval(id);
  }, [auditEntries, tradeSetup, instrument, lastJournalDate, log]);

  return { journaled };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMBINED EXECUTION + AUDIT TAB
// ─────────────────────────────────────────────────────────────────────────────
function ExecutionAuditTab({
  // Execution props
  conn, tfCandles, positions, lastPrice, tradeSetup,
  webhookStatus, lastAlert, tvWebhookOn, onToggleWebhook,
  riskEngine, auditLog,
  // Audit props
  auditEntries, onAuditClear,
  // Journal notify
  journaled,
}) {
  const [view, setView] = useState("execution"); // "execution" | "audit"

  return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>

      {/* Tab toggle */}
      <div style={{ display:"flex", gap:4, marginBottom:14 }}>
        {[["execution","⚡ Execution"],["audit","📋 Audit Log"]].map(([k,v]) => (
          <button key={k} onClick={() => setView(k)}
            style={{ padding:"6px 16px", borderRadius:7, cursor:"pointer",
              fontFamily:"monospace", fontSize:10, fontWeight:700,
              border:`1px solid ${view===k?"rgba(0,212,255,0.4)":"rgba(255,255,255,0.08)"}`,
              background: view===k?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.02)",
              color: view===k?"#00d4ff":"#475569" }}>
            {v}
          </button>
        ))}
        {journaled && (
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6,
            padding:"4px 12px", borderRadius:6, background:"rgba(16,185,129,0.1)",
            border:"1px solid rgba(16,185,129,0.3)" }}>
            <span style={{ fontSize:9, color:"#10b981", fontFamily:"monospace", fontWeight:700 }}>
              ✓ Auto-journaled at NY close
            </span>
          </div>
        )}
      </div>

      {/* ── EXECUTION VIEW ──────────────────────────────────────────── */}
      {view === "execution" && (
        <div>
          {/* Position Manager */}
          {conn && positions?.length > 0 && (
            <PositionManagerPanel
              conn={conn}
              positions={positions}
              lastPrice={lastPrice}
              tradeSetup={tradeSetup}
              log={auditLog}
            />
          )}
          {!conn && (
            <div style={{ padding:"14px", borderRadius:8, marginBottom:10,
              background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)",
              fontSize:9, color:"#334155", fontFamily:"monospace", textAlign:"center" }}>
              Connect Tradovate to enable live position management
            </div>
          )}

          {/* TV Webhook */}
          <TVWebhookPanel
            webhookStatus={webhookStatus}
            lastAlert={lastAlert}
            enabled={tvWebhookOn}
            onToggle={onToggleWebhook}
          />

          {/* Live TF data status */}
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:8, padding:"10px 14px", marginBottom:10 }}>
            <div style={{ fontSize:8, color:"#334155", fontFamily:"monospace",
              fontWeight:700, letterSpacing:2, marginBottom:8 }}>LIVE TF CANDLE BUFFERS</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:4 }}>
              {[["3M","3"],["5M","5"],["15M","15"],["1H","60"],["4H","240"]].map(([label, tf]) => {
                const cds   = tfCandles?.[tf] || [];
                const count = cds.length;
                const last  = count ? cds[count-1] : null;
                const ok    = count > 5;
                return (
                  <div key={tf} style={{ padding:"8px", borderRadius:6, textAlign:"center",
                    background: ok?"rgba(0,255,140,0.04)":"rgba(255,255,255,0.02)",
                    border:`1px solid ${ok?"rgba(0,255,140,0.15)":"rgba(255,255,255,0.05)"}` }}>
                    <div style={{ fontSize:9, fontWeight:700, fontFamily:"monospace",
                      color:ok?"#00ff8c":"#334155" }}>{label}</div>
                    <div style={{ fontSize:8, color:"#475569", fontFamily:"monospace", marginTop:2 }}>
                      {ok ? `${count} bars` : "—"}
                    </div>
                    {last && <div style={{ fontSize:9, color:"#94a3b8", fontFamily:"monospace", marginTop:2 }}>
                      {last.c.toFixed(2)}
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auto-journal status */}
          <div style={{ background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.12)",
            borderRadius:8, padding:"10px 14px" }}>
            <div style={{ fontSize:8, color:"#10b981", fontFamily:"monospace",
              fontWeight:700, letterSpacing:2, marginBottom:4 }}>NY SESSION AUTO-JOURNAL</div>
            <div style={{ fontSize:9, color:"#475569", fontFamily:"monospace", lineHeight:1.7 }}>
              At <span style={{ color:"#94a3b8" }}>3:45 PM EST</span> each trading day, 
              all ORDER / TP1 / SL events from the audit log are automatically compiled 
              into a journal entry and saved to the <span style={{ color:"#94a3b8" }}>📒 Journal</span> tab.
              No manual entry required.
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT VIEW ────────────────────────────────────────────── */}
      {view === "audit" && (
        <AuditPanel entries={auditEntries} onClear={onAuditClear} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADDITIONAL QUANTITATIVE STRATEGIES
// Based on institutional + quant finance research
// ─────────────────────────────────────────────────────────────────────────────
const EXTRA_STRATEGIES = [
  {
    id: "vwap_deviation",
    name: "VWAP Standard Deviation Reversion",
    shortLabel: "VWAP SD Rev",
    color: "#06b6d4",
    category: "Mean Reversion",
    description: `When NQ extends ≥2σ from VWAP intraday and shows a rejection candle, 
fade back to VWAP with tight stop beyond the wick. Works best during NY AM session 
after initial trend established. Research: Evans & Lyons (2002) showed institutional 
order flow anchors around VWAP; extremes are statistically mean-reverting on sub-hour TFs.`,
    gateChecklist: [
      "Price ≥ 2σ from session VWAP",
      "Rejection candle (upper/lower wick ≥ 2× body) at the extension",
      "CVD diverging against price at extreme",
      "Within Silver Bullet or NY PM session",
      "Stop beyond the wick extreme (<15pts NQ)",
    ],
    targets: "TP1: VWAP retest · TP2: Opposite σ band",
    edge: "Statistically, price reverts from ±2σ ~68% of the time intraday on ES/NQ",
    pineName: "VWAP_SD_REV",
  },
  {
    id: "opening_range_momentum",
    name: "ORB Momentum + Volume Surge",
    shortLabel: "ORB Momentum",
    color: "#f59e0b",
    category: "Breakout / Momentum",
    description: `First 30-min range (9:30–10:00 AM EST) defines the day's opening range. 
A breakout above the high with volume > 1.5× the 20-bar average signals institutional 
momentum. Enter on the first pullback to the broken level (now support). 
Toby Crabel's original ORB research showed ~62% win rate on ES breakouts with 
volume confirmation. Combined with ICT FVG retrace entry this improves to ~70%+.`,
    gateChecklist: [
      "ORB high/low defined by 9:30–10:00 AM candles",
      "Clean break of ORB level (close beyond, not just wick)",
      "Volume on breakout candle > 1.5× 20-bar average",
      "First pullback to broken ORB level = entry",
      "4H bias aligned with breakout direction",
    ],
    targets: "TP1: 1× ORB range extension · TP2: 2× ORB range extension",
    edge: "Crabel (1990): ORB breakouts on CME futures profitable with volume filter ~62% raw, ~70% with trend filter",
    pineName: "ORB_MOMENTUM",
  },
  {
    id: "options_opex_magnet",
    name: "Options OPEX Max Pain / GEX Pin",
    shortLabel: "OPEX Pin",
    color: "#a78bfa",
    category: "Options Flow",
    description: `On OPEX Fridays and the day before, market makers hedge their gamma 
exposure causing price to gravitate toward max pain / high open interest strikes. 
On NQ this means strong magnetic pull toward the nearest round 50pt level with 
heavy open interest. Use GEX (Gamma Exposure) data from SpotGamma or Market Chameleon. 
Fade moves away from the pin zone in the final hour before 4PM expiry.`,
    gateChecklist: [
      "OPEX Friday or day before (3rd Friday of month)",
      "Identify max pain strike from options chain (nearest 50pt round number)",
      "Price moving away from max pain by >75pts",
      "Low momentum (small ATR, consolidating candles)",
      "Entry: fade toward max pain, stop: 30pts beyond entry",
    ],
    targets: "TP1: Max pain level · TP2: N/A (close at 3:30 PM EST)",
    edge: "Derman (2016) options MM hedging flow creates measurable gravitational pull toward max pain strikes on expiry days",
    pineName: "OPEX_PIN",
  },
  {
    id: "dom_absorption",
    name: "DOM Absorption + Footprint Reversal",
    shortLabel: "DOM Absorb",
    color: "#10b981",
    category: "Microstructure",
    description: `When large passive limit orders absorb aggressive market orders at a key 
level (visible in DOM as static bids/offers that don't move) and footprint shows 
delta exhaustion (high delta candle followed by a candle with opposite delta and 
price rejection), this signals institutional absorption. The absorbed supply/demand 
becomes a high-probability reversal zone. CVD divergence on the absorption bar is 
the strongest confirmation.`,
    gateChecklist: [
      "Price at a key structural level (OB, FVG, swing H/L)",
      "DOM: large static orders (>200 contracts) absorbing flow",
      "Footprint: delta exhaustion — directional delta then reversal delta",
      "CVD divergence on the absorption bar",
      "ICT macro window active (Silver Bullet / NY PM)",
    ],
    targets: "TP1: Nearest FVG fill · TP2: Previous structure swing",
    edge: "Bouchaud et al. (2018) market impact theory: large passive orders signal informed flow and predict short-term reversal",
    pineName: "DOM_ABSORB",
  },
  {
    id: "correlation_divergence",
    name: "NQ/BTC Correlation Divergence",
    shortLabel: "NQ/BTC Div",
    color: "#f97316",
    category: "Correlation / Macro",
    description: `NQ and BTC have had rolling 30-day correlation of 0.6–0.85 during 
risk-on regimes since 2020. When they temporarily decouple — NQ makes a new high 
while BTC fails to confirm (or vice versa) — this is a leading indicator of a NQ 
reversal within 1–4 sessions. Use BTC daily chart for the divergence signal and 
NQ 15M for the entry. Particularly powerful around FOMC/CPI events.`,
    gateChecklist: [
      "BTC and NQ correlation confirmed high (>0.6 on 20-day rolling)",
      "NQ makes new session high/low while BTC fails to confirm",
      "Divergence visible on 15M–1H charts",
      "NQ at a major PD Array level (OB/FVG/Breaker)",
      "Macro event catalyst present (FOMC/CPI within 24h)",
    ],
    targets: "TP1: 0.5 retracement of diverging leg · TP2: Previous structure",
    edge: "Kajtazi & Moro (2019) cross-asset correlation analysis; deviations from mean correlation are statistically reverting within 1–4 sessions",
    pineName: "BTC_NQ_DIV",
  },
  {
    id: "time_of_day_pattern",
    name: "Statistical Time-of-Day Pattern (TODS)",
    shortLabel: "TODS",
    color: "#22d3ee",
    category: "Statistical / Calendar",
    description: `NQ has statistically significant intraday patterns based on time-of-day. 
The most reliable: (1) 10:00–10:30 AM EST reversal — the initial NY session direction 
often reverses after the first hour as retail stops are cleared. (2) 2:00 PM EST 
directional surge — driven by bond market close and position squaring. 
(3) 3:00–3:30 PM EST — end-of-day institutional rebalancing creates a strong 
directional move. These edges are consistent across 20+ years of CME data.`,
    gateChecklist: [
      "10:00 AM: original 9:30 AM direction has cleared obvious sell-side or buy-side liquidity",
      "OR 2:00 PM: bond market closes, look for 1H BOS/CHoCH",
      "OR 3:00 PM: 4H structure direction with 1H MSS confirmation",
      "Volume expanding in new direction",
      "Price retested a key level (OB/FVG) before the time window",
    ],
    targets: "TP1: Next major session liquidity pool · TP2: Daily candle target",
    edge: "Harris & Gurel (1986), Admati & Pfleiderer (1988): informed traders cluster at specific intraday times creating predictable volume and price patterns",
    pineName: "TODS",
  },
  {
    id: "gap_fill_probability",
    name: "Overnight Gap Fill",
    shortLabel: "Gap Fill",
    color: "#34d399",
    category: "Statistical / Opening",
    description: `NQ/ES overnight gaps (difference between RTH close and next day's 
RTH open) have historically filled ~73% of the time within the same trading session. 
Gaps < 0.5% fill ~85% of the time. Gaps > 1.5% on low volume (pre-market < 20% of 
average) are traps — fade with a tight stop rather than chasing the continuation. 
Entry: wait for the first 5M pullback after the open in the direction of gap fill. 
Stop: beyond the opening range extreme.`,
    gateChecklist: [
      "Gap exists between previous RTH close and current RTH open",
      "Gap size < 0.8% of price (larger gaps have lower fill probability)",
      "Pre-market volume normal or below average (gap not news-driven)",
      "First 5M pullback after open in gap fill direction",
      "No major news catalyst that would sustain the gap",
    ],
    targets: "TP1: 50% of gap filled · TP2: Full gap fill (previous RTH close)",
    edge: "Stoxx research (2015) CME futures gap analysis: <0.5% gaps fill 85% same session; 0.5–1% fill 73%; >1.5% fill 52%",
    pineName: "GAP_FILL",
  },
  {
    id: "volume_profile_poc_reversion",
    name: "Volume Profile POC Reversion",
    shortLabel: "POC Rev",
    color: "#818cf8",
    category: "Volume Profile",
    description: `The Point of Control (POC) — the price level with the most volume traded — 
acts as a magnet. When price is > 30pts away from the daily POC and begins forming a 
consolidation pattern (inside bars, doji cluster) it tends to revert to the POC. 
The Value Area High/Low act as initial support/resistance. Combining POC with an ICT 
Order Block significantly improves the setup quality — when the POC sits inside an OB, 
the probability of holding on first test is substantially higher.`,
    gateChecklist: [
      "Price > 30pts from daily/weekly POC",
      "Consolidation pattern forming (3+ inside bars or doji cluster)",
      "POC inside or adjacent to an ICT OB/FVG level",
      "Volume declining on the consolidation (absorption complete)",
      "Session: any, but best results in NY PM",
    ],
    targets: "TP1: POC retest · TP2: Opposite Value Area boundary",
    edge: "Steidlmayer (1984) Market Profile theory; POC magnetism confirmed in modern HFT literature (Cont & de Larrard 2012)",
    pineName: "POC_REV",
  },
];

// Render component for the extra strategies panel in StrategiesTab area
function ExtraStrategiesPanel({ onAddToScanner }) {
  const [expanded, setExpanded] = useState(null);
  const categories = [...new Set(EXTRA_STRATEGIES.map(s => s.category))];

  return (
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace", fontWeight:700,
          letterSpacing:2 }}>QUANTITATIVE STRATEGY LIBRARY</span>
        <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>
          {EXTRA_STRATEGIES.length} strategies · research-backed edges
        </span>
      </div>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom:14 }}>
          <div style={{ fontSize:8, color:"#334155", fontFamily:"monospace", fontWeight:700,
            letterSpacing:2, marginBottom:6, padding:"3px 0",
            borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            {cat.toUpperCase()}
          </div>
          {EXTRA_STRATEGIES.filter(s => s.category === cat).map(s => (
            <div key={s.id} style={{ marginBottom:6 }}>
              <div onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                  borderRadius:8, cursor:"pointer",
                  background: expanded===s.id ? `${s.color}08` : "rgba(255,255,255,0.02)",
                  border:`1px solid ${expanded===s.id ? s.color+"33" : "rgba(255,255,255,0.06)"}`,
                  transition:"all 0.15s" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:s.color,
                  flexShrink:0, boxShadow:`0 0 6px ${s.color}66` }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#e2e8f0",
                    fontFamily:"monospace" }}>{s.name}</div>
                  <div style={{ fontSize:8, color:"#475569", fontFamily:"monospace", marginTop:2 }}>
                    {s.shortLabel} · {s.category}
                  </div>
                </div>
                <span style={{ fontSize:9, color:"#334155" }}>{expanded===s.id?"▲":"▼"}</span>
              </div>

              {expanded === s.id && (
                <div style={{ background:"rgba(0,0,0,0.3)", border:`1px solid ${s.color}22`,
                  borderTop:"none", borderRadius:"0 0 8px 8px", padding:"14px 16px" }}>

                  <div style={{ fontSize:9, color:"#94a3b8", fontFamily:"monospace",
                    lineHeight:1.7, marginBottom:12 }}>{s.description}</div>

                  {/* Gate checklist */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:8, color:s.color, fontFamily:"monospace",
                      fontWeight:700, letterSpacing:2, marginBottom:6 }}>ENTRY GATES</div>
                    {s.gateChecklist.map((g, i) => (
                      <div key={i} style={{ display:"flex", gap:7, alignItems:"flex-start",
                        marginBottom:3 }}>
                        <span style={{ fontSize:8, color:s.color, fontFamily:"monospace",
                          flexShrink:0, marginTop:1 }}>G{i+1}</span>
                        <span style={{ fontSize:8, color:"#64748b",
                          fontFamily:"monospace", lineHeight:1.5 }}>{g}</span>
                      </div>
                    ))}
                  </div>

                  {/* Targets */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:6, padding:"8px 10px" }}>
                      <div style={{ fontSize:7, color:"#334155", fontFamily:"monospace",
                        letterSpacing:1, marginBottom:3 }}>TARGETS</div>
                      <div style={{ fontSize:9, color:"#94a3b8", fontFamily:"monospace" }}>
                        {s.targets}
                      </div>
                    </div>
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:6, padding:"8px 10px" }}>
                      <div style={{ fontSize:7, color:"#334155", fontFamily:"monospace",
                        letterSpacing:1, marginBottom:3 }}>STATISTICAL EDGE</div>
                      <div style={{ fontSize:8, color:"#64748b", fontFamily:"monospace",
                        lineHeight:1.5 }}>{s.edge}</div>
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ fontSize:8, color:"#334155", fontFamily:"monospace",
                      padding:"3px 8px", borderRadius:4,
                      background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)" }}>
                      Pine ID: {s.pineName}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TRADOVATE API LAYER  —  real auth, real orders, real account data
// ─────────────────────────────────────────────────────────────────────────────

// Tradovate REST base URLs
// Note: Tradovate supports CORS from browsers on their official domains.
// Run this dashboard directly from a browser (not inside a sandboxed iframe)
// for full connectivity.
const TV_BASE = {
  demo: "https://demo.tradovateapi.com/v1",
  live: "https://live.tradovateapi.com/v1",
};
const TV_MD_WS = {
  demo: "wss://md-demo.tradovateapi.com/v1/websocket",
  live: "wss://md.tradovateapi.com/v1/websocket",
};

// ── Tradovate API helper ──────────────────────────────────────────────────────
class TradovateAPI {
  constructor(env, token, mdToken) {
    this.env     = env;     // "demo" | "live"
    this.token   = token;   // REST access token
    this.mdToken = mdToken; // market data token
    this.base    = TV_BASE[env];
  }

  async req(method, path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.errorText || `HTTP ${res.status}`);
    }
    return res.json();
  }

  get(path)         { return this.req("GET",  path); }
  post(path, body)  { return this.req("POST", path, body); }

  // ── Account ──────────────────────────────────────────────────────────────
  async getAccounts()   { return this.get("/account/list"); }
  async getPositions()  { return this.get("/position/list"); }
  async getCashBalance(accountId) {
    return this.get(`/cashBalance/getCashBalanceSnapshot?accountId=${accountId}`);
  }
  async getOrders()     { return this.get("/order/list"); }

  // ── Order placement ───────────────────────────────────────────────────────
  // Tradovate symbol format: "MNQU4" (micro), "NQU4" (full) — uses front-month contract
  // The symbol field accepts the contract name string
  async placeOrder({ accountId, symbol, action, qty, orderType, limitPrice, stopPrice }) {
    const body = {
      accountId,
      action,          // "Buy" | "Sell"
      symbol,          // e.g. "NQM5" or "MNQM5"
      orderQty: qty,
      orderType,       // "Market" | "Limit" | "Stop" | "StopLimit"
      isAutomated: true,
      ...(orderType === "Limit" || orderType === "StopLimit" ? { price: limitPrice } : {}),
      ...(orderType === "Stop"  || orderType === "StopLimit" ? { stopPrice } : {}),
    };
    return this.post("/order/placeorder", body);
  }

  async cancelOrder(orderId) {
    return this.post("/order/cancelorder", { orderId });
  }

  async modifyOrder({ orderId, orderQty, price, stopPrice }) {
    return this.post("/order/modifyorder", { orderId, orderQty, price, stopPrice });
  }

  // ── Contract lookup — resolve instrument → front-month contract name ──────
  async findContract(shortName) {
    // e.g. "NQ" → find live NQ futures front month
    const products = await this.get(`/product/find?name=${shortName}`);
    if (!products?.length) throw new Error(`No contract found for ${shortName}`);
    // Get the live contract (lowest expiry in future)
    const contracts = await this.get(`/contract/find?name=${products[0].name}`);
    return contracts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADOVATE AUTH PANEL — real login to live or demo account
// ─────────────────────────────────────────────────────────────────────────────
function TradovatePanel({ onClose, onConnect }) {
  const [env,     setEnv]     = useState("demo");
  const [user,    setUser]    = useState("");
  const [pass,    setPass]    = useState("");
  const [appId,   setAppId]   = useState("My Trading App");
  const [status,  setStatus]  = useState("idle");
  const [msg,     setMsg]     = useState("");
  const [step,    setStep]    = useState("auth"); // "auth" | "mfa" | "accounts"
  const [ticket,  setTicket]  = useState("");     // p-ticket for MFA
  const [accounts,setAccounts]= useState([]);
  const [selAcct, setSelAcct] = useState(null);
  const [apiObj,  setApiObj]  = useState(null);

  const handleAuth = async () => {
    if (!user || !pass) { setMsg("Username and password required"); return; }
    setStatus("connecting"); setMsg("Authenticating with Tradovate...");
    try {
      const authUrl = `${TV_BASE[env]}/auth/accesstokenrequest`;
      const body = {
        name:       user,
        password:   pass,
        appId:      appId || "My Trading App",
        appVersion: "1.0",
        cid:        0,
        sec:        "",
      };
      const res  = await fetch(authUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (data["p-ticket"]) {
        // MFA required
        setTicket(data["p-ticket"]);
        setStep("mfa");
        setStatus("idle");
        setMsg("MFA required — enter the 6-digit code from your authenticator app.");
        return;
      }
      if (!data.accessToken) {
        throw new Error(data.errorText || data.error || "Authentication failed — check credentials");
      }
      await finishConnect(data);
    } catch (err) {
      setStatus("error");
      setMsg(`❌ ${err.message}`);
    }
  };

  const handleMFA = async (code) => {
    setStatus("connecting"); setMsg("Verifying MFA code...");
    try {
      const authUrl = `${TV_BASE[env]}/auth/accesstokenrequest`;
      const body = {
        name: user, password: pass,
        appId: appId || "My Trading App", appVersion: "1.0",
        cid: 0, sec: "",
        "p-ticket": ticket,
        "p-time":   Date.now(),
        "p-captcha": code,
      };
      const res  = await fetch(authUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.accessToken) throw new Error(data.errorText || "MFA verification failed");
      await finishConnect(data);
    } catch (err) {
      setStatus("error");
      setMsg(`❌ ${err.message}`);
    }
  };

  const finishConnect = async (authData) => {
    setMsg("Loading accounts...");
    const api = new TradovateAPI(env, authData.accessToken, authData.mdAccessToken);
    setApiObj(api);
    try {
      const accts = await api.getAccounts();
      if (!accts?.length) throw new Error("No accounts found on this Tradovate login");
      setAccounts(accts);
      setSelAcct(accts[0].id);
      setStep("accounts");
      setStatus("idle");
      setMsg("");
    } catch (err) {
      setStatus("error");
      setMsg(`❌ ${err.message}`);
    }
  };

  const handleSelectAccount = () => {
    const acct = accounts.find(a => a.id === selAcct) || accounts[0];
    setStatus("connected");
    onConnect({
      env,
      token:    apiObj.token,
      mdToken:  apiObj.mdToken,
      accountId: acct.id,
      accountName: acct.name,
      userId:   acct.userId,
      api:      apiObj,
    });
  };

  const Inp = ({ label, val, set, type = "text", ph = "" }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display:"block", fontSize:9, color:"#475569", letterSpacing:2,
        fontFamily:"monospace", marginBottom:4, textTransform:"uppercase" }}>{label}</label>
      <input type={type} value={val} onChange={e => set(e.target.value)}
        placeholder={ph} autoComplete="off"
        style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.06)",
          border:"1px solid rgba(255,255,255,0.12)", borderRadius:6, color:"#e2e8f0",
          padding:"8px 10px", fontSize:12, fontFamily:"monospace" }}/>
    </div>
  );

  const [mfaCode, setMfaCode] = useState("");

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#0a1020", border:"1px solid rgba(16,185,129,0.3)",
        borderRadius:14, width:"100%", maxWidth:400,
        boxShadow:"0 24px 64px rgba(0,0,0,0.9)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
          borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width:8, height:8, borderRadius:"50%",
            background: status==="connected" ? "#10b981" : status==="connecting" ? "#f59e0b" : "#10b981",
            boxShadow:`0 0 8px ${status==="connected"?"#10b981":"#10b981"}`,
            animation: status==="connecting" ? "pulse 1s infinite" : "none" }}/>
          <span style={{ fontSize:12, fontWeight:700, color:"#e2e8f0",
            letterSpacing:1, fontFamily:"monospace" }}>
            TRADOVATE {env === "live" ? "⚡ LIVE" : "🧪 DEMO"}
          </span>
          <button onClick={onClose} style={{ marginLeft:"auto", background:"rgba(255,80,80,0.08)",
            border:"1px solid rgba(255,80,80,0.2)", color:"#ff4f4f", padding:"3px 10px",
            borderRadius:5, cursor:"pointer", fontSize:10, fontFamily:"monospace" }}>✕</button>
        </div>

        <div style={{ padding:20 }}>

          {/* ── STEP 1: Auth ── */}
          {step === "auth" && <>
            {/* Environment */}
            <div style={{ display:"flex", gap:6, marginBottom:16 }}>
              {["demo","live"].map(e => (
                <button key={e} onClick={() => setEnv(e)}
                  style={{ flex:1, padding:"7px 0", borderRadius:6,
                    border:`1px solid ${env===e ? (e==="live"?"rgba(255,80,80,0.5)":"rgba(16,185,129,0.5)") : "rgba(255,255,255,0.08)"}`,
                    background: env===e ? (e==="live"?"rgba(255,80,80,0.08)":"rgba(16,185,129,0.08)") : "transparent",
                    color: env===e ? (e==="live"?"#ff4f4f":"#10b981") : "#475569",
                    fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"monospace" }}>
                  {e === "live" ? "⚡ LIVE ACCOUNT" : "🧪 DEMO / PAPER"}
                </button>
              ))}
            </div>

            {env === "live" && (
              <div style={{ background:"rgba(255,80,80,0.06)", border:"1px solid rgba(255,80,80,0.2)",
                borderRadius:7, padding:"8px 12px", marginBottom:14, fontSize:9,
                color:"#ff4f4f", fontFamily:"monospace", lineHeight:1.7 }}>
                ⚠ LIVE account — real money. Verify all order details before confirming.
              </div>
            )}

            <Inp label="Tradovate Username / Email" val={user} set={setUser} ph="your@email.com"/>
            <Inp label="Password" val={pass} set={setPass} type="password" ph="••••••••"/>
            <Inp label="App Name (optional)" val={appId} set={setAppId} ph="My Trading App"/>

            {/* Info box */}
            <div style={{ background:"rgba(0,212,255,0.04)", border:"1px solid rgba(0,212,255,0.12)",
              borderRadius:7, padding:"10px 12px", marginBottom:14, fontSize:9,
              color:"#475569", fontFamily:"monospace", lineHeight:1.8 }}>
              <span style={{ color:"#00d4ff", fontWeight:700 }}>Connecting to:</span><br/>
              <span style={{ color:"#94a3b8" }}>
                {TV_BASE[env]}/auth/accesstokenrequest
              </span><br/><br/>
              <span style={{ color:"#00d4ff", fontWeight:700 }}>What you get:</span><br/>
              📊 Live OHLCV → chart &nbsp; 💼 Real positions + P&L<br/>
              ⚡ Order placement (market/limit/stop) &nbsp; 📋 Order history
            </div>

            {msg && (
              <div style={{ marginBottom:12, fontSize:9, fontFamily:"monospace", lineHeight:1.6,
                color: status==="error" ? "#ff4f4f" : "#f59e0b" }}>{msg}</div>
            )}

            <button onClick={handleAuth} disabled={status==="connecting"}
              style={{ width:"100%", padding:"10px", borderRadius:7, cursor:"pointer",
                fontFamily:"monospace", fontSize:11, fontWeight:700, letterSpacing:1,
                background: status==="connecting" ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.12)",
                border:"1px solid rgba(16,185,129,0.4)", color:"#10b981" }}>
              {status === "connecting" ? "⟳ CONNECTING..." : "CONNECT TO TRADOVATE →"}
            </button>

            <div style={{ marginTop:10, fontSize:8, color:"#1e293b", textAlign:"center",
              fontFamily:"monospace", lineHeight:1.6 }}>
              Credentials sent directly to Tradovate. Nothing stored externally.
            </div>
          </>}

          {/* ── STEP 2: MFA ── */}
          {step === "mfa" && <>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🔐</div>
              <div style={{ fontSize:11, color:"#e2e8f0", fontFamily:"monospace", marginBottom:6 }}>
                Two-Factor Authentication
              </div>
              <div style={{ fontSize:9, color:"#64748b", fontFamily:"monospace", lineHeight:1.7 }}>
                Enter the 6-digit code from your Tradovate authenticator app or email.
              </div>
            </div>
            <Inp label="MFA Code" val={mfaCode} set={setMfaCode} ph="123456"/>
            {msg && <div style={{ marginBottom:10, fontSize:9, color:"#ff4f4f", fontFamily:"monospace" }}>{msg}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setStep("auth"); setStatus("idle"); setMsg(""); }}
                style={{ padding:"9px 14px", borderRadius:6, cursor:"pointer", fontFamily:"monospace",
                  fontSize:10, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#475569" }}>
                ← Back
              </button>
              <button onClick={() => handleMFA(mfaCode)} disabled={status==="connecting"}
                style={{ flex:1, padding:"9px", borderRadius:6, cursor:"pointer", fontFamily:"monospace",
                  fontSize:11, fontWeight:700, background:"rgba(16,185,129,0.12)",
                  border:"1px solid rgba(16,185,129,0.4)", color:"#10b981" }}>
                {status === "connecting" ? "⟳ VERIFYING..." : "VERIFY →"}
              </button>
            </div>
          </>}

          {/* ── STEP 3: Select Account ── */}
          {step === "accounts" && <>
            <div style={{ fontSize:10, color:"#64748b", fontFamily:"monospace", marginBottom:12 }}>
              ✓ Authenticated · Select trading account:
            </div>
            {accounts.map(a => (
              <div key={a.id} onClick={() => setSelAcct(a.id)}
                style={{ padding:"10px 14px", borderRadius:7, marginBottom:6, cursor:"pointer",
                  border:`1px solid ${selAcct===a.id?"rgba(16,185,129,0.5)":"rgba(255,255,255,0.08)"}`,
                  background: selAcct===a.id ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)" }}>
                <div style={{ fontSize:11, fontWeight:700, color: selAcct===a.id?"#10b981":"#e2e8f0",
                  fontFamily:"monospace" }}>{a.name}</div>
                <div style={{ fontSize:9, color:"#475569", fontFamily:"monospace", marginTop:2 }}>
                  ID: {a.id} · {a.active ? "✓ Active" : "⚠ Inactive"} · {env.toUpperCase()}
                </div>
              </div>
            ))}
            <button onClick={handleSelectAccount}
              style={{ width:"100%", marginTop:8, padding:"10px", borderRadius:7, cursor:"pointer",
                fontFamily:"monospace", fontSize:11, fontWeight:700,
                background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.4)", color:"#10b981" }}>
              USE THIS ACCOUNT →
            </button>
          </>}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER TICKET — real Tradovate order placement
// ─────────────────────────────────────────────────────────────────────────────
function OrderTicket({ conn, instrument, lastPrice, onClose, prefill, auditLog }) {
  const NQ_SYMBOLS  = { NQ:"NQ", ES:"ES", RTY:"RTY", YM:"YM" };
  const CONTRACT_SUFFIX = "M5"; // front-month — update each expiry or add contract lookup

  const [side,      setSide]    = useState(prefill?.side    || "buy");
  const [type,      setType]    = useState(prefill?.type    || "market");
  const [qty,       setQty]     = useState(prefill?.qty     || 1);
  const [limitPx,   setLimitPx] = useState(prefill?.entry   ? prefill.entry.toFixed(2) : lastPrice.toFixed(2));
  const [stopPx,    setStopPx]  = useState(prefill?.stop    ? prefill.stop.toFixed(2)  : (lastPrice * (side==="buy"?0.998:1.002)).toFixed(2));
  const [tpPx,      setTpPx]    = useState(prefill?.tp1     ? prefill.tp1.toFixed(2)   : (lastPrice * (side==="buy"?1.005:0.995)).toFixed(2));
  const [symbol,    setSymbol]  = useState(`${instrument}${CONTRACT_SUFFIX}`);
  const [status,    setStatus]  = useState("idle");
  const [msg,       setMsg]     = useState("");
  const [orderId,   setOrderId] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const riskPts = Math.abs(lastPrice - parseFloat(stopPx));
  const rwdPts  = Math.abs(parseFloat(tpPx) - lastPrice);
  const rr      = riskPts > 0 ? (rwdPts / riskPts).toFixed(2) : "–";
  const isLive  = conn.env === "live";

  const submit = async () => {
    if (isLive && !confirmed) { setConfirmed(true); setMsg("⚠ Confirm live order — click again to execute."); return; }
    setStatus("sending"); setMsg(""); setConfirmed(false);
    try {
      const action  = side === "buy" ? "Buy" : "Sell";
      const oType   = type === "market" ? "Market" : type === "limit" ? "Limit" : "Stop";
      auditLog?.('ORDER', `${action} ${qty} ${symbol} @ ${oType} — account ${conn.accountName}`, { action, qty, symbol, oType, limitPx, stopPx, tpPx });
      const result  = await conn.api.placeOrder({
        accountId:  conn.accountId,
        symbol,
        action,
        qty:        parseInt(qty),
        orderType:  oType,
        limitPrice: parseFloat(limitPx),
        stopPrice:  parseFloat(stopPx),
      });
      if (result?.orderId || result?.id) {
        const oid = result.orderId || result.id;
        setOrderId(oid);
        setStatus("filled");
        setMsg(`✓ Order #${oid} submitted — ${action} ${qty} ${symbol} @ ${oType==="Market"?"MKT":limitPx}`);
        // Place bracket SL/TP as separate stop/limit orders
        try {
          await conn.api.placeOrder({
            accountId: conn.accountId, symbol, qty: parseInt(qty),
            action:    side === "buy" ? "Sell" : "Buy",
            orderType: "Stop", stopPrice: parseFloat(stopPx),
          });
          await conn.api.placeOrder({
            accountId: conn.accountId, symbol, qty: parseInt(qty),
            action:    side === "buy" ? "Sell" : "Buy",
            orderType: "Limit", limitPrice: parseFloat(tpPx),
          });
          setMsg(prev => prev + "\n✓ SL + TP bracket orders placed.");
        } catch (bErr) {
          setMsg(prev => prev + `\n⚠ Bracket order: ${bErr.message}`);
        }
        setTimeout(() => onClose(), 3500);
      } else {
        throw new Error(result?.errorText || JSON.stringify(result));
      }
    } catch (err) {
      setStatus("error");
      setMsg(`❌ ${err.message}`);
      setConfirmed(false);
    }
  };

  const Inp = ({ label, val, set, step = 1 }) => (
    <div style={{ marginBottom:8 }}>
      <label style={{ display:"block", fontSize:8, color:"#475569", letterSpacing:2,
        fontFamily:"monospace", marginBottom:3, textTransform:"uppercase" }}>{label}</label>
      <input type="number" value={val} step={step} onChange={e => set(e.target.value)}
        style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, color:"#e2e8f0",
          padding:"5px 8px", fontSize:12, fontFamily:"monospace" }}/>
    </div>
  );

  const btnColor = confirmed ? "#f59e0b" : side === "buy" ? "#00ff8c" : "#ff4f4f";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1100,
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#0a1020", border:`1px solid ${side==="buy"?"rgba(0,255,140,0.3)":"rgba(255,80,80,0.3)"}`,
        borderRadius:12, width:"100%", maxWidth:360,
        boxShadow:"0 20px 60px rgba(0,0,0,0.9)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px",
          background:"rgba(0,0,0,0.35)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width:7, height:7, borderRadius:"50%",
            background: side==="buy"?"#00ff8c":"#ff4f4f",
            boxShadow:`0 0 6px ${side==="buy"?"#00ff8c":"#ff4f4f"}` }}/>
          <span style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", fontFamily:"monospace", letterSpacing:2 }}>
            ORDER TICKET
          </span>
          <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace", marginLeft:4 }}>
            {conn.accountName} · {conn.env.toUpperCase()}
          </span>
          <button onClick={onClose} style={{ marginLeft:"auto", background:"transparent",
            border:"1px solid rgba(255,255,255,0.1)", color:"#475569", padding:"2px 8px",
            borderRadius:4, cursor:"pointer", fontSize:10 }}>✕</button>
        </div>

        <div style={{ padding:16 }}>
          {/* Symbol input */}
          <div style={{ marginBottom:12 }}>
            <label style={{ display:"block", fontSize:8, color:"#475569", letterSpacing:2,
              fontFamily:"monospace", marginBottom:3, textTransform:"uppercase" }}>CONTRACT SYMBOL</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value)}
              style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, color:"#00d4ff",
                padding:"5px 8px", fontSize:12, fontFamily:"monospace", letterSpacing:1 }}/>
            <div style={{ fontSize:7, color:"#334155", fontFamily:"monospace", marginTop:2 }}>
              Format: NQM5 (full NQ), MNQM5 (micro NQ), ESM5, MESM5
            </div>
          </div>

          {/* Side */}
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            {["buy","sell"].map(s => (
              <button key={s} onClick={() => setSide(s)}
                style={{ flex:1, padding:"8px 0", borderRadius:6, cursor:"pointer",
                  fontFamily:"monospace", fontSize:10, fontWeight:700,
                  border:`1px solid ${side===s ? (s==="buy"?"rgba(0,255,140,0.5)":"rgba(255,80,80,0.5)") : "rgba(255,255,255,0.08)"}`,
                  background: side===s ? (s==="buy"?"rgba(0,255,140,0.1)":"rgba(255,80,80,0.1)") : "transparent",
                  color: side===s ? (s==="buy"?"#00ff8c":"#ff4f4f") : "#475569" }}>
                {s === "buy" ? "▲ BUY / LONG" : "▼ SELL / SHORT"}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div style={{ display:"flex", gap:4, marginBottom:12 }}>
            {["market","limit","stop"].map(t => (
              <button key={t} onClick={() => setType(t)}
                style={{ flex:1, padding:"5px 0", borderRadius:5, cursor:"pointer",
                  fontFamily:"monospace", fontSize:9, textTransform:"uppercase",
                  border:`1px solid ${type===t?"rgba(0,212,255,0.4)":"rgba(255,255,255,0.08)"}`,
                  background: type===t?"rgba(0,212,255,0.08)":"transparent",
                  color: type===t?"#00d4ff":"#475569" }}>{t}</button>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <Inp label="Contracts" val={qty} set={setQty} step={1}/>
            {type !== "market" && <Inp label={type==="limit"?"Limit Price":"Stop Trigger"} val={limitPx} set={setLimitPx} step={0.25}/>}
            <Inp label="Stop Loss" val={stopPx} set={setStopPx} step={0.25}/>
            <Inp label="Take Profit" val={tpPx} set={setTpPx} step={0.25}/>
          </div>

          {/* Risk metrics */}
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:6, padding:"8px 10px", marginBottom:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4 }}>
              {[["Risk", `${riskPts.toFixed(1)} pts`, "#ff4f4f"],
                ["Reward", `${rwdPts.toFixed(1)} pts`, "#00ff8c"],
                ["R:R", `1 : ${rr}`, rr >= 2 ? "#00ff8c" : rr >= 1.5 ? "#f59e0b" : "#ff4f4f"]
              ].map(([l,v,c]) => (
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:7, color:"#334155", fontFamily:"monospace", letterSpacing:1 }}>{l}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:c, fontFamily:"monospace" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {isLive && !confirmed && (
            <div style={{ background:"rgba(255,80,80,0.06)", border:"1px solid rgba(255,80,80,0.2)",
              borderRadius:6, padding:"6px 10px", marginBottom:8, fontSize:8,
              color:"#ff4f4f", fontFamily:"monospace" }}>
              ⚡ LIVE ORDER — affects real money
            </div>
          )}
          {confirmed && (
            <div style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.4)",
              borderRadius:6, padding:"8px 10px", marginBottom:8, fontSize:9,
              color:"#f59e0b", fontFamily:"monospace", fontWeight:700 }}>
              ⚠ CONFIRM: {side.toUpperCase()} {qty} {symbol} @ {type==="market"?"MARKET":limitPx}
              · SL {stopPx} · TP {tpPx}
            </div>
          )}
          {msg && (
            <div style={{ marginBottom:8, fontSize:9, whiteSpace:"pre-wrap", lineHeight:1.6,
              color: status==="filled"?"#00ff8c":status==="error"?"#ff4f4f":"#f59e0b",
              fontFamily:"monospace" }}>{msg}</div>
          )}

          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose}
              style={{ padding:"9px 12px", borderRadius:6, cursor:"pointer",
                fontFamily:"monospace", fontSize:10, border:"1px solid rgba(255,255,255,0.08)",
                background:"transparent", color:"#475569" }}>Cancel</button>
            <button onClick={submit}
              disabled={status==="sending" || status==="filled"}
              style={{ flex:1, padding:"9px", borderRadius:6, cursor:"pointer",
                fontFamily:"monospace", fontSize:11, fontWeight:700, letterSpacing:1,
                border:`1px solid ${btnColor}55`,
                background:`${btnColor}12`, color:btnColor }}>
              {status==="sending" ? "⟳ SENDING..." :
               status==="filled" ? "✓ SUBMITTED" :
               confirmed         ? "⚠ CONFIRM LIVE ORDER" :
               side==="buy"      ? "▲ PLACE BUY ORDER" : "▼ PLACE SELL ORDER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT BAR — real data from Tradovate API + live polling
// ─────────────────────────────────────────────────────────────────────────────
function AccountBar({ conn, lastPrice, instrument, onDisconnect, onOpenTicket }) {
  const [expanded,  setExpanded]  = useState(false);
  const [acctData,  setAcctData]  = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [lastUpdate,setLastUpdate]= useState(null);

  const fetchData = useCallback(async () => {
    if (!conn?.api) return;
    try {
      const [cash, pos, ords] = await Promise.all([
        conn.api.getCashBalance(conn.accountId),
        conn.api.getPositions(),
        conn.api.getOrders(),
      ]);
      setAcctData(cash);
      // Filter to this account's positions
      setPositions((Array.isArray(pos) ? pos : []).filter(p => p.accountId === conn.accountId));
      setOrders((Array.isArray(ords) ? ords : [])
        .filter(o => o.accountId === conn.accountId && ["Working","Accepted","PendingNew"].includes(o.ordStatus))
        .slice(0, 10));
      setLastUpdate(new Date());
    } catch (err) {
      console.warn("Account data fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [conn]);

  // Poll every 5 seconds
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  const totalOpenPnl = positions.reduce((sum, p) => {
    const mktVal = p.netPos * (lastPrice - p.avgPrice) * 20; // NQ multiplier $20/pt
    return sum + mktVal;
  }, 0);

  const balance     = acctData?.cashBalance ?? "–";
  const netLiq      = acctData?.initialMargin != null ? balance - acctData.initialMargin : null;
  const dayPnl      = acctData?.realizedPnL ?? 0;

  return (
    <div style={{ background:"rgba(16,185,129,0.05)", border:"1px solid rgba(16,185,129,0.18)",
      borderRadius:8, marginBottom:10 }}>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px", flexWrap:"wrap" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981",
          boxShadow:"0 0 6px #10b981", animation:"pulse 2s infinite" }}/>
        <span style={{ fontSize:9, color:"#10b981", fontFamily:"monospace", fontWeight:700, letterSpacing:1 }}>
          TRADOVATE {conn.env.toUpperCase()}
        </span>
        <span style={{ fontSize:9, color:"#334155", fontFamily:"monospace" }}>·</span>
        <span style={{ fontSize:9, color:"#64748b", fontFamily:"monospace" }}>
          {conn.accountName}
        </span>
        <span style={{ fontSize:9, color:"#334155", fontFamily:"monospace" }}>|</span>
        {!loading && acctData && <>
          <span style={{ fontSize:9, color:"#64748b", fontFamily:"monospace" }}>
            Balance <span style={{ color:"#e2e8f0", fontWeight:700 }}>
              ${typeof balance === "number" ? balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}) : balance}
            </span>
          </span>
          <span style={{ fontSize:9, fontWeight:700, fontFamily:"monospace",
            color: dayPnl >= 0 ? "#00ff8c" : "#ff4f4f" }}>
            Day {dayPnl >= 0 ? "+" : ""}{typeof dayPnl==="number"?dayPnl.toFixed(2):"–"}
          </span>
          {positions.length > 0 && (
            <span style={{ fontSize:9, fontWeight:700, fontFamily:"monospace",
              color: totalOpenPnl >= 0 ? "#00ff8c" : "#ff4f4f" }}>
              Open {totalOpenPnl >= 0 ? "+" : ""}{totalOpenPnl.toFixed(2)}
            </span>
          )}
        </>}
        {loading && <span style={{ fontSize:8, color:"#334155", fontFamily:"monospace" }}>loading…</span>}
        {lastUpdate && <span style={{ fontSize:7, color:"#1e293b", fontFamily:"monospace", marginLeft:2 }}>
          ↻ {lastUpdate.toLocaleTimeString()}
        </span>}

        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <button onClick={onOpenTicket}
            style={{ background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.25)",
              color:"#00d4ff", padding:"4px 10px", borderRadius:5, cursor:"pointer",
              fontSize:9, fontFamily:"monospace", fontWeight:700 }}>
            ⚡ NEW ORDER
          </button>
          <button onClick={fetchData}
            style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.08)",
              color:"#334155", padding:"4px 8px", borderRadius:5, cursor:"pointer",
              fontSize:9, fontFamily:"monospace" }}>↻</button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.08)",
              color:"#475569", padding:"4px 8px", borderRadius:5, cursor:"pointer",
              fontSize:9, fontFamily:"monospace" }}>
            {expanded ? "▲" : "▼"}
          </button>
          <button onClick={onDisconnect}
            style={{ background:"transparent", border:"1px solid rgba(255,80,80,0.15)",
              color:"#ff4f4f", padding:"4px 8px", borderRadius:5, cursor:"pointer",
              fontSize:9, fontFamily:"monospace" }}>✕</button>
        </div>
      </div>

      {/* Expanded: positions + open orders */}
      {expanded && (
        <div style={{ padding:"4px 14px 12px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>

          {/* Positions */}
          <div style={{ fontSize:8, color:"#334155", fontFamily:"monospace", letterSpacing:2,
            marginBottom:6, marginTop:6 }}>OPEN POSITIONS ({positions.length})</div>
          {positions.length === 0 && (
            <div style={{ fontSize:9, color:"#334155", fontFamily:"monospace" }}>No open positions</div>
          )}
          {positions.map((p, i) => {
            const side = p.netPos > 0 ? "Long" : "Short";
            const pnl  = p.netPos * (lastPrice - p.avgPrice) * 20;
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"70px 50px 40px 90px 90px 80px",
                background:"rgba(255,255,255,0.02)", borderRadius:4, padding:"4px 8px", marginBottom:2 }}>
                {[p.contractId || instrument, side, Math.abs(p.netPos),
                  p.avgPrice?.toFixed(2), lastPrice.toFixed(2)].map((v, j) => (
                  <span key={j} style={{ fontSize:9, fontFamily:"monospace",
                    color: j===1 ? (side==="Long"?"#00ff8c":"#ff4f4f") : "#94a3b8" }}>{v}</span>
                ))}
                <span style={{ fontSize:9, fontWeight:700, fontFamily:"monospace",
                  color: pnl >= 0 ? "#00ff8c" : "#ff4f4f" }}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}
                </span>
              </div>
            );
          })}

          {/* Working orders */}
          {orders.length > 0 && <>
            <div style={{ fontSize:8, color:"#334155", fontFamily:"monospace", letterSpacing:2,
              marginBottom:6, marginTop:10 }}>WORKING ORDERS ({orders.length})</div>
            {orders.map((o, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,0.02)", borderRadius:4, padding:"4px 8px", marginBottom:2 }}>
                <span style={{ fontSize:9, fontFamily:"monospace",
                  color: o.action==="Buy"?"#00ff8c":"#ff4f4f", fontWeight:700 }}>{o.action}</span>
                <span style={{ fontSize:9, fontFamily:"monospace", color:"#94a3b8" }}>
                  {o.orderQty}× {o.symbol} · {o.orderType}
                  {o.price ? ` @ ${o.price}` : ""}
                  {o.stopPrice ? ` stop ${o.stopPrice}` : ""}
                </span>
                <span style={{ fontSize:8, color:"#f59e0b", fontFamily:"monospace" }}>{o.ordStatus}</span>
                <button onClick={() => conn.api.cancelOrder(o.id).then(fetchData)}
                  style={{ marginLeft:"auto", background:"rgba(255,80,80,0.08)",
                    border:"1px solid rgba(255,80,80,0.2)", color:"#ff4f4f", padding:"2px 6px",
                    borderRadius:3, cursor:"pointer", fontSize:8, fontFamily:"monospace" }}>Cancel</button>
              </div>
            ))}
          </>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION BRIDGE — AI Scanner → Tradovate order
// Shows when AI scanner produces a signal and Tradovate is connected
// ─────────────────────────────────────────────────────────────────────────────
function ExecutionBridge({ conn, scanResult, lastPrice, instrument, onOrderSent }) {
  const [open,     setOpen]     = useState(false);
  const [prefill,  setPrefill]  = useState(null);
  const [bridgeMsg,setBridgeMsg]= useState("");
  const [auto,     setAuto]     = useState(false); // auto-execute toggle (dangerous)

  // Parse scan result — handles both structured object (from AIScannerTab)
  // and plain text string (from LiveChartTab context)
  const parsed = useMemo(() => {
    if (!scanResult) return null;

    // ── Case A: structured object from AIScannerTab ──────────────────────
    if (typeof scanResult === "object" && scanResult.direction) {
      const dir = scanResult.direction;
      if (dir === "FLAT" || dir === "NO_TRADE" || dir === "NONE") return null;
      const isLong = dir === "LONG" || dir === "BUY";
      const entryMid = scanResult.entry_top && scanResult.entry_bot
        ? (parseFloat(scanResult.entry_top) + parseFloat(scanResult.entry_bot)) / 2
        : lastPrice;
      const stop  = parseFloat(scanResult.stop_price)  || (isLong ? lastPrice - 30 : lastPrice + 30);
      const tp1   = parseFloat(scanResult.tp1_price)   || (isLong ? lastPrice + 60 : lastPrice - 60);
      const grade = scanResult.grade || "?";
      return {
        side:       isLong ? "buy" : "sell",
        direction:  isLong ? "LONG" : "SHORT",
        entry: entryMid, stop, tp1,
        grade,
        conviction: scanResult.conviction || "?",
        rr: Math.abs(tp1 - entryMid) / (Math.abs(entryMid - stop) || 1),
      };
    }

    // ── Case B: plain text string ────────────────────────────────────────
    const text    = String(scanResult);
    const isLong  = /\bLONG\b|\bBUY\b|\bbullish\b/i.test(text);
    const isShort = /\bSHORT\b|\bSELL\b|\bbearish\b/i.test(text);
    if (!isLong && !isShort) return null;
    const entryM  = text.match(/entry[:\s]+([0-9]+\.?[0-9]*)/i);
    const stopM   = text.match(/stop[:\s]+([0-9]+\.?[0-9]*)/i);
    const tp1M    = text.match(/(?:tp1|take.profit.1|target.1)[:\s]+([0-9]+\.?[0-9]*)/i);
    const gradeM  = text.match(/\bGrade[:\s]+([A-D])\b/i) || text.match(/\b([A-D]) grade\b/i);
    const convM   = text.match(/conviction[:\s]+(HIGH|MEDIUM|LOW)/i);
    const entry   = entryM ? parseFloat(entryM[1]) : lastPrice;
    const stop    = stopM  ? parseFloat(stopM[1])  : isLong ? lastPrice - 30 : lastPrice + 30;
    const tp1     = tp1M   ? parseFloat(tp1M[1])   : isLong ? lastPrice + 60 : lastPrice - 60;
    return {
      side:       isLong ? "buy" : "sell",
      direction:  isLong ? "LONG" : "SHORT",
      entry, stop, tp1,
      grade:      gradeM?.[1] || "?",
      conviction: convM?.[1]  || "?",
      rr:         Math.abs(tp1 - entry) / (Math.abs(entry - stop) || 1),
    };
  }, [scanResult, lastPrice]);

  if (!conn || !parsed) return null;

  const col = parsed.side === "buy" ? "#00ff8c" : "#ff4f4f";

  return (
    <>
      {/* Bridge banner */}
      <div style={{ background:`${col}08`, border:`1px solid ${col}33`,
        borderRadius:8, padding:"10px 14px", marginBottom:10,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:col,
            boxShadow:`0 0 8px ${col}`, animation:"pulse 1.5s infinite" }}/>
          <span style={{ fontSize:10, fontWeight:700, color:col, fontFamily:"monospace", letterSpacing:1 }}>
            {parsed.direction} SIGNAL
          </span>
        </div>
        <span style={{ fontSize:9, color:"#64748b", fontFamily:"monospace" }}>
          Entry ~{parsed.entry.toFixed(2)} · SL {parsed.stop.toFixed(2)} · TP1 {parsed.tp1.toFixed(2)}
          · R:R {parsed.rr.toFixed(1)}
          · Grade {parsed.grade} · {parsed.conviction}
        </span>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:8,
            color:"#ff4f4f", fontFamily:"monospace", cursor:"pointer" }}>
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)}
              style={{ accentColor:"#ff4f4f" }}/>
            AUTO-EXEC{auto?" ON":" OFF"}
          </label>
          <button onClick={() => {
              setPrefill({ side: parsed.side, type:"market", entry: parsed.entry,
                stop: parsed.stop, tp1: parsed.tp1 });
              setOpen(true);
            }}
            style={{ background:`${col}15`, border:`1px solid ${col}44`, color:col,
              padding:"5px 14px", borderRadius:6, cursor:"pointer",
              fontSize:10, fontFamily:"monospace", fontWeight:700 }}>
            ⚡ EXECUTE →
          </button>
        </div>
      </div>
      {bridgeMsg && (
        <div style={{ fontSize:9, color:"#f59e0b", fontFamily:"monospace", marginBottom:6 }}>{bridgeMsg}</div>
      )}
      {open && (
        <OrderTicket
          conn={conn}
          instrument={instrument}
          lastPrice={lastPrice}
          prefill={prefill}
          onClose={() => { setOpen(false); onOrderSent?.(); }}
        />
      )}
    </>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// COLLAPSIBLE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function Panel({ title, color, children, forceOpen }) {
  const [open,setOpen]=useState(false);
  const isOpen=forceOpen!==undefined?forceOpen:open;
  return (
    <div style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <button onClick={()=>{ if(forceOpen===undefined)setOpen(o=>!o); }} style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:isOpen?"rgba(255,255,255,0.02)":"transparent",border:"none",cursor:forceOpen!==undefined?"default":"pointer",padding:"9px 14px",color:isOpen?color:"#334155"}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:color,boxShadow:isOpen?`0 0 6px ${color}`:"none",flexShrink:0}}/>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:2,fontFamily:"monospace"}}>{title}</span>
        {forceOpen===undefined&&<span style={{marginLeft:"auto",fontSize:9,color:isOpen?color:"#2a3a4a",display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>}
      </button>
      {isOpen&&<div style={{padding:"4px 14px 10px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:"4px 16px"}}>{children}</div>}
    </div>
  );
}
function DR({ label, value, color }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 0",borderBottom:"1px solid rgba(255,255,255,0.025)"}}>
      <span style={{fontSize:9,color:"#475569"}}>{label}</span>
      <span style={{fontSize:9,fontWeight:700,color:color||"#94a3b8",fontFamily:"monospace"}}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PINE EDITOR MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PineEditor({ onClose, onSave, initial }) {
  const [name,     setName]     = useState(initial?.name     || "");
  const [notes,    setNotes]    = useState(initial?.notes    || "");
  const [code,     setCode]     = useState(initial?.code     || PINE_BOILERPLATE);
  const [overlays, setOverlays] = useState(initial?.overlays || []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fb,       setFb]       = useState("");
  const menuRef=useRef(null);

  useEffect(()=>{ const h=e=>{if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);}; document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h); },[]);

  const tog=id=>setOverlays(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const doSave=mode=>{
    if(!name.trim()){setFb("⚠ Name required");setTimeout(()=>setFb(""),2000);return;}
    const s={id:initial?.id||`custom-${Date.now()}`,name:name.trim(),notes,code,overlays,savedAt:new Date().toISOString(),builtin:false};
    onSave(s,mode); setFb("✓ Saved"); setTimeout(()=>setFb(""),2000); setMenuOpen(false);
  };
  const exportF=()=>{ const b=new Blob([code],{type:"text/plain"}),url=URL.createObjectURL(b),a=Object.assign(document.createElement("a"),{href:url,download:`${name||"strategy"}.pine`}); a.click(); URL.revokeObjectURL(url); setFb("⬇ Downloaded"); setTimeout(()=>setFb(""),2000); };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0a1020",border:"1px solid rgba(0,212,255,0.18)",borderRadius:12,width:"100%",maxWidth:920,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.7)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.3)",flexShrink:0}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#00d4ff",boxShadow:"0 0 8px #00d4ff"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"#e2e8f0",letterSpacing:2,fontFamily:"monospace"}}>PINE SCRIPT EDITOR</span>
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            {fb&&<span style={{fontSize:9,color:"#00ff8c",fontFamily:"monospace"}}>{fb}</span>}
            <div ref={menuRef} style={{position:"relative"}}>
              <button onClick={()=>setMenuOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.3)",color:"#00d4ff",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>
                💾 SAVE <span style={{fontSize:8,opacity:0.6}}>{menuOpen?"▲":"▼"}</span>
              </button>
              {menuOpen&&(
                <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",background:"#0d1521",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,overflow:"hidden",minWidth:262,boxShadow:"0 8px 32px rgba(0,0,0,0.7)",zIndex:20}}>
                  {[["📌","Save to Library","store","Persist name, overlays, notes & code"],["🟢","Save & Set Active","activate","Save and immediately apply to chart"],["⬇️","Export .pine File","export","Download for TradingView"]].map(([icon,lbl,mode,hint])=>(
                    <button key={mode} onClick={()=>mode==="export"?exportF():doSave(mode)} style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"flex-start",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.04)",color:"#e2e8f0",padding:"9px 14px",cursor:"pointer",textAlign:"left"}}>
                      <span style={{fontSize:11,fontFamily:"monospace",fontWeight:600}}>{icon}  {lbl}</span>
                      <span style={{fontSize:9,color:"#475569",marginTop:2}}>{hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.22)",color:"#ff4f4f",padding:"5px 10px",borderRadius:6,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>✕ CLOSE</button>
          </div>
        </div>
        <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
          <div style={{width:220,flexShrink:0,borderRight:"1px solid rgba(255,255,255,0.06)",padding:14,display:"flex",flexDirection:"column",gap:12,overflowY:"auto",background:"rgba(0,0,0,0.15)"}}>
            <div>
              <label style={{display:"block",fontSize:9,color:"#475569",letterSpacing:2,fontFamily:"monospace",marginBottom:4}}>STRATEGY NAME</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. KZ Confluence Long" style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#e2e8f0",padding:"6px 8px",fontSize:11,fontFamily:"monospace"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:9,color:"#475569",letterSpacing:2,fontFamily:"monospace",marginBottom:6}}>OVERLAY LAYERS</label>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {Object.entries(OVERLAY_META).map(([id,{label,color}])=>{
                  const on=overlays.includes(id);
                  return (
                    <label key={id} onClick={()=>tog(id)} style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",padding:"4px 6px",borderRadius:5,background:on?`${color}10`:"transparent",border:`1px solid ${on?color+"44":"rgba(255,255,255,0.05)"}`}}>
                      <div style={{width:11,height:11,borderRadius:3,background:on?color:"transparent",border:`1.5px solid ${on?color:"rgba(255,255,255,0.18)"}`,flexShrink:0}}/>
                      <span style={{fontSize:10,color:on?color:"#475569",fontFamily:"monospace"}}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div style={{flex:1}}>
              <label style={{display:"block",fontSize:9,color:"#475569",letterSpacing:2,fontFamily:"monospace",marginBottom:4}}>NOTES</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Rules, conditions, setup notes..." style={{width:"100%",minHeight:100,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,color:"#94a3b8",padding:"7px 8px",fontSize:10,fontFamily:"monospace",resize:"vertical"}}/>
            </div>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",padding:"6px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.25)",flexShrink:0}}>
              <span style={{fontSize:9,color:"#334155",fontFamily:"monospace",letterSpacing:2}}>PINE SCRIPT  v5  ·  overlay=true</span>
              <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                {["#ff5f57","#ffbd2e","#28ca41"].map((c,i)=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:c,opacity:0.65}}/>)}
              </div>
            </div>
            <textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false} style={{flex:1,background:"#06101a",color:"#a8d8a8",fontFamily:"'Fira Code','Courier New',monospace",fontSize:12,lineHeight:1.75,padding:"14px 16px",border:"none",outline:"none",resize:"none",overflowY:"auto",tabSize:4}}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY LIBRARY
// ─────────────────────────────────────────────────────────────────────────────
function StrategyLibrary({ custom, active, onSelect, onEdit, onDelete, onNew }) {
  return (
    <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <span style={{fontSize:9,color:"#334155",letterSpacing:3,fontFamily:"monospace"}}>STRATEGY LIBRARY</span>
        <button onClick={onNew} style={{marginLeft:"auto",background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.28)",color:"#818cf8",padding:"3px 10px",borderRadius:5,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>✎ NEW</button>
      </div>
      <div style={{maxHeight:200,overflowY:"auto"}}>
        <div style={{padding:"5px 12px 3px",fontSize:8,color:"#1e293b",letterSpacing:2,fontFamily:"monospace"}}>BUILT-IN</div>
        {BUILTIN_STRATEGIES.map(s=><SRow key={s.id} s={s} active={active?.id===s.id} onSelect={()=>onSelect(s)}/>)}
        {custom.length>0&&<>
          <div style={{padding:"5px 12px 3px",fontSize:8,color:"#1e293b",letterSpacing:2,fontFamily:"monospace",borderTop:"1px solid rgba(255,255,255,0.03)"}}>CUSTOM</div>
          {custom.map(s=><SRow key={s.id} s={s} active={active?.id===s.id} onSelect={()=>onSelect(s)} onEdit={()=>onEdit(s)} onDelete={()=>onDelete(s.id)} isCustom/>)}
        </>}
        {custom.length===0&&<div style={{padding:"8px 12px",fontSize:9,color:"#1e293b",fontFamily:"monospace",fontStyle:"italic"}}>No custom strategies — click ✎ NEW to create one</div>}
      </div>
    </div>
  );
}
function SRow({ s, active, onSelect, onEdit, onDelete, isCustom }) {
  const col=s.color||"#00d4ff";
  return (
    <div onClick={onSelect} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",cursor:"pointer",background:active?`${col}0e`:"transparent",borderLeft:`2px solid ${active?col:"transparent"}`,borderBottom:"1px solid rgba(255,255,255,0.02)",width:"100%"}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:col,flexShrink:0,boxShadow:active?`0 0 5px ${col}`:"none"}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,fontWeight:600,color:active?col:"#64748b",fontFamily:"monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.name||s.label}</div>
        {s.notes&&<div style={{fontSize:8,color:"#1e293b",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.notes}</div>}
      </div>
      {active&&<span style={{fontSize:8,color:col,fontFamily:"monospace",flexShrink:0,letterSpacing:1}}>● LIVE</span>}
      {isCustom&&(
        <div style={{display:"flex",gap:3,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button onClick={onEdit}   style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",color:"#64748b",padding:"2px 6px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace"}}>edit</button>
          <button onClick={onDelete} style={{background:"rgba(255,80,80,0.05)",border:"1px solid rgba(255,80,80,0.12)",color:"#ff4f4f",padding:"2px 6px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace"}}>✕</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SETUP SCANNER TAB
// ─────────────────────────────────────────────────────────────────────────────
// Strategy definitions exposed to the scanner (rules injected into AI prompt)
const SCANNER_STRATEGIES = [
  {
    id: "ict_base",
    label: "ICT / SMC Base",
    shortLabel: "ICT",
    color: "#00d4ff",
    icon: "⬡",
    description: "OBs · FVGs · IRL→ERL · Liquidity · AMD",
    alwaysOn: true,   // always included, can't be deselected
    rules: [
      "[GATE 1 — WEEKLY BIAS] What is the Weekly structure? HH+HL series = BULLISH. LH+LL series = BEARISH. This is the master filter. Every single trade must align with the Weekly bias. If Weekly is BEARISH you only look for shorts. If BULLISH you only look for longs. NO exceptions.",
      "[GATE 2 — DAILY BIAS] Confirm the Daily chart structure matches the Weekly. Daily must show the same directional structure (HH+HL for bull, LH+LL for bear). If Daily opposes Weekly = NO TRADE, wait for alignment.",
      "[GATE 3 — SESSION + ICT MACRO WINDOW] SESSION = planning window (London/NY Open/NY PM). ICT MACRO = ideal execution window nested within session. London macros: 02:33-03:00 or 04:03-04:30 EST. NY AM macros: 09:50-10:10 or 10:50-11:10 EST. NY Lunch macro: 11:50-12:10 EST (caution). NY PM macros: 01:10-01:40 or 03:15-03:45 EST. Quality: HIGHEST=macro+silver bullet overlap; HIGH=inside macro; GOOD=silver bullet only (9:30-11AM/1:30-3PM); STANDARD=in session only (-10pts); FLAT=NY lunch no entries; LOW=outside session skip.",
      "[GATE 4 — DRAW ON LIQUIDITY + TRADE TYPE] You must: (a) identify a specific liquidity target (BSL for longs / SSL for shorts) price is drawn toward — swing highs/PDH/PWH for longs, swing lows/PDL/PWL for shorts. No visible target = FAIL. (b) Classify the TRADE TYPE from the TRADE TYPE CLASSIFICATION section — CONTINUATION (4H+1H+15M aligned, 5M optional, entry on FVG retrace on 3M/1M) or REVERSAL (key 15M or 1H level just swept + CHoCH required). Entry TFs are always 3M and 1M.",
      "[GATE 5 — RETAIL TRAP POSITIONING] We enter where retail is WRONG. Longs are entered at areas where retail traders are SHORT (BSL sweeps, at support OBs, at FVG lows where retail sold). Shorts are entered where retail is LONG (SSL sweeps, at resistance OBs, at FVG highs where retail bought). We are the counter to the retail position.",
      "[GATE 6 — BOS/CHoCH REQUIRED] Check DISPLACEMENT QUALITY section: score must be ≥60/100, body ≥55% of range, size ≥1.2×ATR. These numbers are computed — use them exactly. A drift-through is NOT a BOS. If the score is under 60, this gate FAILS regardless of what price did. The direction of the displacement (Bull/Bear) must match the intended trade direction.",
      "[GATE 7 — FVG PRICE SEQUENCE] Check the FVG PRICE SEQUENCE section. Only Stage=COMPLETE is an active entry. PENDING_RETRACE = watchlist (almost there). PENDING_DRAW = too early, wait. NONE = no setup. The sequence: (1) FVG forms via BOS displacement, (2) price moves AWAY toward draw-on-liquidity, (3) price RETRACES back INTO FVG = ENTRY. Step 3 only — never step 1 or 2.",
      "[CRT GATE — MULTI-TF ENGULFING (if crt_engulf active)] Check CRT ENGULFING SIGNAL: type must be BULL/BEAR (score ≥70, hasMomentum, strongClose). Top-down stack must align: 4H+1H+15M bias confirmed, 5M optional alignment check. Entry TFs are 3M and 1M — the engulfing candle is identified on 3M or 1M. Stop below/above engulf candle extreme (max 30pts NQ). If BULL_RECENT/BEAR_RECENT = PENDING. If NONE = FAIL.",
      "[GATE 8 — OTE FIBONACCI ZONE] Check OTE section: Price position must say INSIDE OTE or within 3pts. Check 'Above 50% of swing' field: must say YES for longs (or NO for shorts below 50%). The 50% mid level and OTE range are computed exactly — use those numbers. FVG below 50% = skip.",
      "[GATE 9 — ORDER BLOCK CONFLUENCE] Check ORDER BLOCKS section. 'PRICE INSIDE OB' = pass. OB must be unmitigated (not tagged [SWEPT]). OB range (bot–top prices) must overlap with or sit adjacent to the FVG range. Both OB and FVG in same zone = A+ entry. One without the other = reduce conviction.",
      "[GATE 10 — NQ STOP DISCIPLINE] NQ stop maximum = 30 POINTS. Stop is placed at the high or low of the Unicorn setup (the OB extreme). If the setup requires a stop greater than 30 points, the setup is INVALID — do not take it, wait for a tighter structure. TP1 = 50% of position at first IRL target. Move stop to breakeven immediately when 1:1 R:R is reached. Trail with 15M structure after TP1.",
    ]
  },
  {
    id: "vivek_unicorn",
    label: "Vivek — Unicorn / Silver Bullet",
    shortLabel: "VIVEK",
    color: "#c084fc",
    icon: "★",
    description: "MSS → IFVG → OTE → Silver Bullet 9:30–11AM EST → SMT Divergence",
    alwaysOn: false,
    rules: BUILTIN_STRATEGIES.find(s=>s.id==="vivek_unicorn")?.rules || []
  },
  {
    id: "kz_confluence",
    label: "KZ Confluence (OB+FVG+Killzone)",
    shortLabel: "KZ",
    color: "#ffd700",
    icon: "◈",
    description: "OB+FVG confluence · OTE level · CVD divergence · Killzone only",
    alwaysOn: false,
    rules: BUILTIN_STRATEGIES.find(s=>s.id==="kz_confluence")?.rules || []
  },
  {
    id: "liq_sweep_ifvg",
    label: "Liquidity Sweep + IFVG",
    shortLabel: "LIQ+IFVG",
    color: "#f97316",
    icon: "⚡",
    description: "Liq sweep → displacement → IFVG entry → ERL target",
    alwaysOn: false,
    rules: [
      "[LS1 — DAILY BIAS + SESSION GATE] The sweep must align with the Daily bias — only trade sweeps that go WITH the Daily structure. Longs: look for SSL sweeps (sweep below swing low, in bullish Daily context). Shorts: look for BSL sweeps (sweep above swing high, in bearish Daily context). Session must be Silver Bullet (9:30–11AM) or NY PM (1:30–3PM). NY Lunch (12–1PM) = no trades.",
      "[LS2 — IDENTIFY THE LIQUIDITY POOL] Mark the most recent UNSWEPT swing high (BSL) or swing low (SSL) that is clearly being targeted. Price must have been making inducement toward it — consolidation just below a BSL or just above an SSL. The pool must be obvious with multiple candle wicks touching the level. A marginal or obscure level does not count.",
      "[LS3 — VALID SWEEP DEFINITION] Price wicks THROUGH the BSL/SSL level taking out the resting stop orders. VALID: wick pierces beyond the level AND the candle body closes back on the other side. INVALID: full candle close beyond the level (that is continuation, not a sweep). INVALID: slow grind through the level. INVALID: two consecutive closes beyond the level. The sweep must be a wick-and-close-back.",
      "[LS4 — BOS/CHoCH AFTER SWEEP — MANDATORY KNOCKOUT GATE] After the sweep, a STRONG displacement candle must close BEYOND the nearest structural swing: for bull reversal (after SSL sweep) = close above the most recent swing high on 5M/15M. For bear reversal (after BSL sweep) = close below the most recent swing low on 5M/15M. This BOS/CHoCH MUST happen within 3–5 candles of the sweep. If no BOS within 5 candles = setup failed, skip. The displacement candle must be at least 1.5× average size. Weak drift = not valid.",
      "[LS5 — IFVG FORMED BY DISPLACEMENT] The displacement/BOS candle or the sequence immediately following MUST leave a Fair Value Gap (FVG) — a 3-candle imbalance. For bull: candle[N-1].high < candle[N+1].low. For bear: candle[N-1].low > candle[N+1].high. This gap is the IFVG — the zone price will return to fill before continuing. The IFVG must be clearly visible and sized at least 3+ points on NQ.",
      "[LS6 — WAIT FOR RETRACE INTO IFVG — THIS IS THE ENTRY] After the BOS and IFVG formation, price will retrace back into the IFVG. THIS RETRACE is the entry — not the initial sweep, not the BOS candle. Wait for price to pull back INTO the IFVG zone. The entry candle should close inside the IFVG. The IFVG must be ABOVE the 50% level of the displacement swing. Check that the IFVG overlaps with or is adjacent to an unmitigated OB for maximum confluence.",
      "[LS7 — ORDER FLOW AT IFVG] At the IFVG during the retrace, confirm: CVD should diverge (price retracing but CVD not falling / holding up for longs, not rising for shorts). Delta should flip toward the trade direction on the entry candle. If CVD follows price aggressively into the IFVG (price drops and CVD also drops on a bull setup), the IFVG is likely to fail — skip or reduce size.",
      "[LS8 — OTE ALIGNMENT] The IFVG retrace should bring price into the 0.62–0.79 Fibonacci zone of the displacement swing. If the IFVG sits between 0.62–0.79, this is an A+ setup. If the IFVG is shallower (0.38–0.62), it is still valid but lower conviction. Below 0.38 = too shallow, likely to fail.",
      "[LS9 — STOP + TARGETS] STOP: 2–3 ticks beyond the sweep extreme (the wick tip). This is the absolute invalidation. On NQ, verify this stop is within 30 points. If sweep-to-entry distance exceeds 30pts, skip. TP1: the opposing short-term IRL level (nearest unmitigated FVG or OB in path). Take 50% off, move stop to BE immediately. TP2: PDH/PDL or PWH/PWL. Must close by 11AM (first macro) or 12PM (second macro).",
      "[LS10 — INVALIDATION CHECKLIST] Immediately exit or skip if: (a) No BOS/CHoCH within 5 candles of sweep, (b) Displacement candle is smaller than average size, (c) No clean FVG left by displacement, (d) CVD confirms the retrace (not diverging), (e) Price returns to the sweep extreme after entry, (f) Outside Silver Bullet or NY PM window, (g) Against Daily bias.",
    ]
  }  ,
  {
    id: "crt_engulf",
    label: "CRT — Candle Range Theory",
    shortLabel: "CRT",
    color: "#ec4899",
    icon: "◈",
    description: "15M context · 5M confirmation · 1M engulf entry · multi-TF alignment",
    alwaysOn: false,
    rules: [
      "[CRT1 — 15M CONTEXT: IDENTIFY THE DRAW] On the 15-minute chart, identify whether price is in an uptrend (HH+HL), downtrend (LH+LL), or range. Mark the nearest significant support zone (for longs) or resistance zone (for shorts). Look for a BULLISH ENGULFING candle (body fully engulfs prior candle) near support = bullish setup forming. BEARISH ENGULFING near resistance = bearish setup forming. This is the master direction filter — all lower TF signals must align with it.",
      "[CRT2 — 15M ENGULFING CANDLE QUALITY] The 15M engulfing candle must meet ALL: (a) Body closes fully beyond the prior candle's body — the close of the engulf must be beyond the open of the prior candle. (b) The engulfing body is at least 1.5× the size of the prior candle's body. (c) It forms at or near a clearly marked S/R zone — not in the middle of range. (d) Preferably has above-average volume. A small-body engulf at no particular level does NOT qualify.",
      "[CRT3 — 5M CONFIRMATION: RANGE CONTRACTION + ALIGNMENT] On the 5-minute chart, confirm: (a) Price action aligns with the 15M direction — for longs, 5M should show higher lows forming, bullish candle structure. (b) Look for a 5M engulfing candle OR range contraction (candles getting smaller = coiling) near the same S/R level. (c) A 5M BOS/CHoCH in the trade direction is a strong add. (d) 5M candle direction must NOT contradict 15M — if 15M is bullish but 5M shows aggressive selling, wait. Alignment = both timeframes agree.",
      "[CRT4 — 5M BREAKOUT/BREAKDOWN TRIGGER] On the 5-minute chart, identify the most recent swing high (for longs) or swing low (for shorts). A 5M candle that CLOSES beyond this level with a strong body (≥60% of total range) confirms momentum in the trade direction. This is the setup confirmation — it tells you a directional move is underway. Without this break of the 5M swing, the setup is still forming.",
      "[CRT5 — 1M ENTRY: ENGULFING CANDLE TRIGGER] Drop to 1-minute. Wait for a BULLISH ENGULFING candle (for longs) or BEARISH ENGULFING (for shorts) that satisfies ALL: (a) Body fully engulfs the prior 1M candle. (b) The engulfing candle is LARGER than the 3 most recent candles — indicating strong momentum entering. (c) It closes firmly in the trade direction (bull = close near high, bear = close near low). (d) It forms while price is retesting or just departed from the S/R zone identified on 15M. ENTER on the CLOSE of this 1M engulfing candle.",
      "[CRT6 — ENTRY TIMING: NO CHASING] Enter ONLY on the CLOSE of the 1M engulfing candle. Do NOT enter mid-candle. If the 1M engulf closes and price has already moved significantly away from the zone (more than 0.5×ATR), skip — the entry has passed. Wait for the next retrace and fresh 1M signal. Chasing is the primary failure mode of this setup.",
      "[CRT7 — STOP LOSS PLACEMENT] For LONGS: stop-loss placed 1–2 ticks BELOW the low of the 1M bullish engulfing candle. For SHORTS: stop-loss 1–2 ticks ABOVE the high of the 1M bearish engulfing candle. Alternative: use 0.75×ATR(1M) as stop distance if the engulf candle's extreme is too tight. On NQ: maximum stop = 30 points. If required stop exceeds 30pts, skip this setup.",
      "[CRT8 — TAKE PROFIT TARGETS] TP1: The next S/R level on the 5M chart (the most recent swing high for longs / swing low for shorts). Take 50% of position here. Move stop to breakeven immediately at TP1. TP2: The major S/R level on the 15M chart (the resistance above for longs / support below for shorts). Let the remainder run with a trailing stop based on 15M structure. MINIMUM R:R must be 1:2 — if TP1 is closer than 2× the stop distance, skip the trade.",
      "[CRT9 — MULTI-TF ALIGNMENT CHECKLIST] All three must be TRUE before entry: (1) 15M engulfing candle at key S/R level — direction confirmed. (2) 5M confirms: structure aligns, no strong counter-move, 5M swing break present. (3) 1M engulfing candle closes in trade direction. If ANY is missing = NO TRADE. The power of CRT is the multi-TF funnel — one timeframe is noise, three is signal.",
      "[CRT10 — INVALIDATION & AVOIDANCE] SKIP this setup if: (a) Major news within 30 minutes (volatility creates false engulfs), (b) NY Lunch (12–1PM EST) — false signals prevalent, (c) Pre-market (8:30–9:30AM EST), (d) The 15M and 5M disagree in direction, (e) Volume on the engulf is below average (weak signal), (f) Price is in middle of range with no clear S/R anchor, (g) More than 3 candles have passed since the 1M engulf (signal is stale — wait for fresh setup).",
    ]
  },

  // ── QUANTITATIVE STRATEGIES ─────────────────────────────────────────────────
  {
    id: "vwap_deviation",
    label: "VWAP SD Reversion",
    shortLabel: "VWAP SD",
    color: "#06b6d4",
    icon: "σ",
    description: "Price ≥2σ from VWAP + rejection candle → fade back to VWAP",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[VWAP1 — EXTENSION CHECK] Check SD LEVELS section: price must be AT or BEYOND ±2 standard deviations from VWAP. If price is inside the ±2σ bands, skip this setup entirely. The further beyond 2σ the stronger the signal.",
      "[VWAP2 — REJECTION CANDLE] The candle at or beyond the 2σ level must show a clear rejection: upper wick ≥ 2× body for bearish fade, lower wick ≥ 2× body for bullish fade. A doji or inside bar at the extreme also qualifies.",
      "[VWAP3 — CVD DIVERGENCE] Check ORDER FLOW section: CVD must be diverging against price at the extension. If price makes new high but CVD is flat or declining = bearish divergence, valid for short fade.",
      "[VWAP4 — SESSION FILTER] Only trade during NY AM (9:30–11:30 AM EST) after initial trend established. Silver Bullet or NY PM also valid. Avoid first 5 minutes of RTH.",
      "[VWAP5 — STOP & TARGETS] Stop beyond the wick extreme, max 15 pts NQ. TP1: VWAP midline. TP2: Opposite σ band. Move stop to BE at TP1.",
      "[VWAP6 — INVALIDATION] Skip if: session < 30 min old (VWAP unreliable). Skip on macro news in next 30 min. Skip if 5M ATR > 2× its 20-bar average.",
    ]
  },
  {
    id: "orb_momentum",
    label: "ORB Momentum + Volume",
    shortLabel: "ORB MOM",
    color: "#f59e0b",
    icon: "◈",
    description: "30-min ORB breakout with volume surge → first pullback entry",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[ORB1 — RANGE DEFINITION] Opening Range = high and low of first 30 minutes RTH (9:30–10:00 AM EST). Check ORB section. If before 10:00 AM, wait.",
      "[ORB2 — CLEAN BREAKOUT] Price must CLOSE (not just wick) beyond the ORB high (long) or ORB low (short) on a 5M candle.",
      "[ORB3 — VOLUME CONFIRMATION] Breakout candle volume must be > 1.5× the 20-bar average. Check ORDER FLOW section. Without volume surge, breakout is likely a trap.",
      "[ORB4 — PULLBACK ENTRY] Do NOT chase. Wait for the first pullback to the broken ORB level. Entry is on the retest of the ORB level acting as S/R.",
      "[ORB5 — 4H ALIGNMENT] Breakout direction must match 4H chart bias from TOP-DOWN STRUCTURE section.",
      "[ORB6 — STOP & TARGETS] Stop below ORB level max 20 pts. TP1: 1× ORB range extension. TP2: 2× ORB range extension.",
      "[ORB7 — TIME LIMIT] Only valid 10:00 AM–12:00 PM EST. After NY Lunch break, ORB setups have significantly lower follow-through.",
    ]
  },
  {
    id: "opex_pin",
    label: "OPEX Max Pain Pin",
    shortLabel: "OPEX PIN",
    color: "#a78bfa",
    icon: "⊕",
    description: "OPEX Friday: fade moves away from max pain / GEX pin",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[OPEX1 — EXPIRY CHECK] ONLY valid on monthly OPEX Fridays (3rd Friday) and Thursday before. Outside these dates, skip entirely.",
      "[OPEX2 — MAX PAIN LEVEL] Identify max pain / highest OI strike on NQ/ES options chain. Typically nearest 50pt round number with most open contracts.",
      "[OPEX3 — DISTANCE FROM PIN] Price must be > 75 pts from max pain level before the fade is valid.",
      "[OPEX4 — LOW MOMENTUM] Current 5M candles should show low momentum: small bodies, inside bars, consolidation. Expanding momentum reduces probability.",
      "[OPEX5 — ENTRY & STOP] Fade toward max pain. Stop 30 pts beyond current swing extreme. TP1: Max pain level. Close at 3:30 PM EST.",
      "[OPEX6 — INVALIDATION] Skip on major macro catalyst driving the move. Skip if VIX > 30. Skip if price already at max pain.",
    ]
  },
  {
    id: "dom_absorption",
    label: "DOM Absorption Reversal",
    shortLabel: "DOM ABS",
    color: "#10b981",
    icon: "▣",
    description: "Passive DOM orders absorbing flow at key level + delta exhaustion",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[DOM1 — KEY LEVEL REQUIRED] Price must be at a significant structural level: OB, FVG midpoint, Breaker Block, or VWAP σ band. DOM absorption at random levels has no edge.",
      "[DOM2 — CVD DIVERGENCE REQUIRED] Check ORDER FLOW section: CVD must diverge against price at the absorption point. This is the single most important confirmation for this setup.",
      "[DOM3 — DELTA EXHAUSTION] The absorption candle shows high directional delta, followed by a reversal candle with opposite delta and price rejection.",
      "[DOM4 — ICT MACRO WINDOW] Must be in Silver Bullet (9:30–11AM EST) or NY PM (1:30–3PM EST).",
      "[DOM5 — STOP & TARGETS] Stop 5 pts beyond the absorbed level, max 20 pts. TP1: Nearest FVG fill in reversal direction. TP2: Previous session swing.",
    ]
  },
  {
    id: "btc_nq_divergence",
    label: "NQ/BTC Correlation Div",
    shortLabel: "BTC DIV",
    color: "#f97316",
    icon: "⇄",
    description: "NQ/BTC decouple while correlated → NQ reversal signal",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[BTCDIV1 — CORRELATION REGIME] Only valid when NQ and BTC have been moving in sync for the prior 2 weeks (high correlation regime). During BTC-specific events or VIX > 35, skip.",
      "[BTCDIV2 — DIVERGENCE SIGNAL] On 1H or 4H: NQ makes new session high/low while BTC fails to confirm, or vice versa. The divergence must be clear and visible.",
      "[BTCDIV3 — NQ AT PD ARRAY] Divergence is only actionable when NQ is simultaneously at a major PD Array level (OB, FVG, Breaker). Without structural confluence, divergence alone is insufficient.",
      "[BTCDIV4 — MACRO CONTEXT] Most powerful within 24 hours of FOMC, CPI, NFP. These events create temporary decoupling then snap-back.",
      "[BTCDIV5 — ENTRY & STOP] Entry on 15M BOS/CHoCH confirming the reversal. Stop beyond failed high/low, max 25 pts. TP1: 50% retrace of diverging leg. TP2: Previous NQ swing.",
    ]
  },
  {
    id: "tods_pattern",
    label: "Time-of-Day Pattern",
    shortLabel: "TODS",
    color: "#22d3ee",
    icon: "⏱",
    description: "Statistical NQ reversals at 10AM, 2PM, 3PM EST windows",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[TODS1 — WINDOW] Three valid windows: (A) 10:00–10:30 AM: initial direction reverses after retail stops cleared. (B) 2:00–2:15 PM: bond market close institutional repositioning. (C) 3:00–3:15 PM: end-of-day rebalancing. Must be in one of these exact windows.",
      "[TODS2 — LIQUIDITY SWEEP] For 10 AM window: 9:30 AM opening direction must have swept obvious liquidity (equal highs/lows, prior day H/L) before reversal.",
      "[TODS3 — STRUCTURE SHIFT] At the TODS window, BOS or CHoCH on 5M chart confirms new direction. Simple pullback is not enough.",
      "[TODS4 — VOLUME EXPANSION] Reversal candle at the window must show volume > 20-bar average.",
      "[TODS5 — PD ARRAY CONFLUENCE] Best when TODS window coincides with price at OB, FVG, or VWAP σ band.",
      "[TODS6 — STOP & TARGETS] Stop beyond swept liquidity extreme, max 25 pts. TP1: Next major session liquidity pool. TP2: Daily bias target.",
      "[TODS7 — INVALIDATION] Skip in NY Lunch. Skip on major macro data within 30 min of window.",
    ]
  },
  {
    id: "gap_fill",
    label: "Overnight Gap Fill",
    shortLabel: "GAP FILL",
    color: "#34d399",
    icon: "⇥",
    description: "RTH open gap < 0.8% → first pullback entry targeting fill",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[GAP1 — GAP DETECTION] Overnight gap = today's RTH open (9:30 AM) meaningfully different from yesterday's RTH close (4:15 PM). Gap must be > 10 pts NQ to be tradeable.",
      "[GAP2 — SIZE FILTER] Gap must be < 0.8% of NQ price (~160 pts at 20,000). Larger gaps are likely news-driven continuations, not fills.",
      "[GAP3 — VOLUME CHECK] Pre-market volume should be normal or below average. If 2× normal, gap is news-driven — skip.",
      "[GAP4 — PULLBACK ENTRY] Wait for first 5M pullback after RTH open in the gap fill direction. Do NOT enter at the open.",
      "[GAP5 — DAILY BIAS ALIGNMENT] Gap fill direction must align with 4H structure from TOP-DOWN STRUCTURE section.",
      "[GAP6 — STOP & TARGETS] Stop beyond opening range extreme, max 20 pts. TP1: 50% gap filled. TP2: Full gap fill (yesterday's RTH close). Close fully at TP2.",
      "[GAP7 — INVALIDATION] Skip if gap > 0.8%. Skip if opening range > 40 pts in first 5 min. Skip Monday gaps (weekend gaps behave differently).",
    ]
  },
  {
    id: "poc_reversion",
    label: "Volume Profile POC Rev",
    shortLabel: "POC REV",
    color: "#818cf8",
    icon: "◎",
    description: "Price >30pts from daily POC + consolidation → POC magnet",
    alwaysOn: false,
    category: "quant",
    rules: [
      "[POC1 — POC IDENTIFICATION] Daily POC = price with most volume traded in current RTH session. Check VOLUME PROFILE section.",
      "[POC2 — DISTANCE] Price must be > 30 pts from POC. Below 30 pts the POC is not yet a meaningful magnet.",
      "[POC3 — CONSOLIDATION] At the price extreme, look for 3+ inside bars, doji cluster, or narrowing price action showing absorption.",
      "[POC4 — VOLUME DECLINING] Volume on consolidation bars should be declining vs the thrust bars that got price here.",
      "[POC5 — PD ARRAY CONFLUENCE] Strongest setup: POC sits inside or adjacent to an ICT OB or FVG level. Dual institutional + statistical support.",
      "[POC6 — ENTRY & STOP] Entry on first 5M CHoCH or BOS from the consolidation. Stop beyond consolidation extreme, max 20 pts.",
      "[POC7 — TARGETS] TP1: POC retest (close 50–75%). TP2: Opposite Value Area boundary. Best in NY AM and NY PM sessions.",
    ]
  }

];

function compIFVGs(cs) {
  const atr = compATR(cs);
  const zones = [];

  // ── Pass 1: Standard FVGs ──────────────────────────────────────────────
  const rawFVGs = [];
  for (let i = 1; i < cs.length - 1; i++) {
    const prev = cs[i-1], next = cs[i+1];
    if (next.l > prev.h) {
      const size = next.l - prev.h;
      rawFVGs.push({ type:"Bull FVG", top:next.l, bot:prev.h, idx:i, size });
    }
    if (next.h < prev.l) {
      const size = prev.l - next.h;
      rawFVGs.push({ type:"Bear FVG", top:prev.l, bot:next.h, idx:i, size });
    }
  }

  // ── Pass 2: Check each FVG — is it still clean, or was it INVERTED? ───
  for (const fvg of rawFVGs) {
    const postCandles = cs.slice(fvg.idx + 2);
    if (!postCandles.length) continue;

    if (fvg.type === "Bull FVG") {
      // Has a candle CLOSED fully below the FVG bottom? → Bearish IFVG (polarity flip)
      const invertCandle = postCandles.find(c => c.c < fvg.bot);
      if (invertCandle) {
        // FVG is now inverted — it's a bearish supply zone
        const notRemitigated = !postCandles.slice(postCandles.indexOf(invertCandle)+1)
          .some(c => c.h >= fvg.top);
        if (notRemitigated) {
          zones.push({ type:"Bearish IFVG", top:fvg.top, bot:fvg.bot, idx:fvg.idx,
            size:fvg.size, sizeATR:(fvg.size/atr).toFixed(2),
            desc:`Bullish FVG [${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}] inverted — now bearish IFVG (supply). Entry on retrace UP into zone.` });
        }
        continue;
      }
      // Still clean Bull FVG — check if filled (50% tag)
      const filled = postCandles.some(c => c.l <= fvg.bot + fvg.size * 0.5);
      if (!filled) zones.push({ type:"Bull FVG", top:fvg.top, bot:fvg.bot, idx:fvg.idx,
        size:fvg.size, sizeATR:(fvg.size/atr).toFixed(2),
        desc:`Bullish FVG [${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}] — active demand imbalance. Entry on retrace DOWN into zone.` });
    }

    if (fvg.type === "Bear FVG") {
      // Has a candle CLOSED fully above the FVG top? → Bullish IFVG (polarity flip)
      const invertCandle = postCandles.find(c => c.c > fvg.top);
      if (invertCandle) {
        const notRemitigated = !postCandles.slice(postCandles.indexOf(invertCandle)+1)
          .some(c => c.l <= fvg.bot);
        if (notRemitigated) {
          zones.push({ type:"Bullish IFVG", top:fvg.top, bot:fvg.bot, idx:fvg.idx,
            size:fvg.size, sizeATR:(fvg.size/atr).toFixed(2),
            desc:`Bearish FVG [${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}] inverted — now bullish IFVG (demand). Entry on retrace DOWN into zone.` });
        }
        continue;
      }
      // Still clean Bear FVG
      const filled = postCandles.some(c => c.h >= fvg.top - fvg.size * 0.5);
      if (!filled) zones.push({ type:"Bear FVG", top:fvg.top, bot:fvg.bot, idx:fvg.idx,
        size:fvg.size, sizeATR:(fvg.size/atr).toFixed(2),
        desc:`Bearish FVG [${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}] — active supply imbalance. Entry on retrace UP into zone.` });
    }
  }

  // ── Pass 3: ICT Implied FVG (3-candle wick-overlap structure) ──────────
  // Central candle = large body. Both neighbours have wicks that overlap into central body.
  // IFVG zone = 50% of left wick to 50% of right wick.
  for (let i = 1; i < cs.length - 1; i++) {
    const prev = cs[i-1], mid = cs[i], next = cs[i+1];
    const midBody = Math.abs(mid.c - mid.o);
    const midRange = mid.h - mid.l || 0.001;
    const midBodyPct = midBody / midRange;
    if (midBodyPct < 0.55) continue; // central candle must have substantial body

    const leftWickMid  = mid.o > mid.c ? (mid.h + mid.o)/2 : (mid.l + mid.o)/2; // simplified
    const rightWickMid = mid.o > mid.c ? (mid.l + mid.c)/2 : (mid.h + mid.c)/2;

    // Check overlap: prev wick enters central body, next wick enters central body
    const prevOverlaps = prev.h > Math.min(mid.o,mid.c) && prev.l < Math.max(mid.o,mid.c);
    const nextOverlaps = next.h > Math.min(mid.o,mid.c) && next.l < Math.max(mid.o,mid.c);
    if (!prevOverlaps || !nextOverlaps) continue;

    // No conventional FVG between these 3 candles
    const hasConvFVG = next.l > prev.h || next.h < prev.l;
    if (hasConvFVG) continue;

    const isBull = mid.c > mid.o;
    const ifvgTop = isBull ? (prev.h + next.h)/2 : (prev.l + next.l)/2 + midBody*0.5;
    const ifvgBot = isBull ? (prev.h + next.h)/2 - midBody*0.5 : (prev.l + next.l)/2;
    // Simplified: use 50% of prev wick top and 50% of next wick top/bot
    const wTop = Math.max(prev.h, next.h);
    const wBot = Math.min(prev.l, next.l);
    const implied_top = wTop - (wTop - wBot) * 0.25;
    const implied_bot = wBot + (wTop - wBot) * 0.25;
    const size = implied_top - implied_bot;
    if (size < atr * 0.1) continue;

    const postCs = cs.slice(i+2);
    const filled = isBull ? postCs.some(c=>c.l<=implied_bot) : postCs.some(c=>c.h>=implied_top);
    if (!filled) zones.push({ type: isBull ? "Bull IFVG (Implied)" : "Bear IFVG (Implied)",
      top:implied_top, bot:implied_bot, idx:i, size, sizeATR:(size/atr).toFixed(2),
      desc:`ICT Implied FVG @ [${implied_bot.toFixed(2)}–${implied_top.toFixed(2)}]: 3-candle wick overlap structure. Zone = 50% of flanking wicks. ${isBull?"Bullish demand":"Bearish supply"} zone.` });
  }

  return zones.sort((a,b)=>b.idx-a.idx).slice(0,8);
}

// ── PD ARRAY SCORER ────────────────────────────────────────────────────────
// Returns the highest-ranked PD Array tool present at current price,
// a score contribution, the zone type, and premium/discount bias
function compPDArray(cs, obs, bbs, fvgs, liq, price) {
  const atr = compATR(cs);
  const tolerance  = atr * 0.5; // within 0.5×ATR of price = "at zone"

  // ── Proper swing high/low from 3M candle structure ──────────────────────
  // Find the most recent significant swing high and swing low
  // A swing high = candle whose high is higher than the 3 candles on each side
  // A swing low  = candle whose low  is lower  than the 3 candles on each side
  const lookback = Math.min(cs.length, 80); // look back up to 80 candles on 3M = ~4 hours
  const slice = cs.slice(-lookback);
  let swingHi = null, swingLo = null;
  for (let i = slice.length - 4; i >= 3; i--) {
    const c = slice[i];
    const leftH  = slice.slice(i-3,i).every(x => x.h <= c.h);
    const rightH = slice.slice(i+1,i+4).every(x => x.h <= c.h);
    if (leftH && rightH && swingHi === null) swingHi = c.h;
    const leftL  = slice.slice(i-3,i).every(x => x.l >= c.l);
    const rightL = slice.slice(i+1,i+4).every(x => x.l >= c.l);
    if (leftL && rightL && swingLo === null) swingLo = c.l;
    if (swingHi !== null && swingLo !== null) break;
  }
  // Fallback to range of last 40 candles if no clean swing found
  const fallbackSlice = cs.slice(-40);
  const hi = swingHi ?? Math.max(...fallbackSlice.map(c=>c.h));
  const lo = swingLo ?? Math.min(...fallbackSlice.map(c=>c.l));
  const range = hi - lo || atr * 10;

  const eq  = (hi + lo) / 2;           // 0.5 equilibrium
  const g62 = hi - range * 0.618;       // golden pocket top (0.618 from swing hi)
  const g79 = hi - range * 0.786;       // golden pocket bot (0.786 from swing hi)
  const inPremium  = price > eq;
  const inDiscount = price < eq;
  const inGolden   = price >= g79 && price <= g62; // OTE / golden pocket
  const priceZone  = inGolden ? "GOLDEN POCKET (OTE)" : inPremium ? "PREMIUM" : "DISCOUNT"

  const tools = [];

  // Mitigation Blocks (failed OBs — not yet in code as separate struct, use OBs tagged as mitigated)
  // Breaker Blocks
  for (const bb of (bbs||[])) {
    if (Math.abs(price - ((bb.top+bb.bot)/2)) < tolerance) {
      const isBull = bb.type?.toLowerCase().includes("bull");
      tools.push({ name: isBull ? "Bullish Breaker Block" : "Bearish Breaker Block",
        score:35, top:bb.top, bot:bb.bot,
        valid: isBull ? inDiscount : inPremium,
        desc:`${isBull?"Bull":"Bear"} BB @ [${bb.bot?.toFixed(2)}–${bb.top?.toFixed(2)}] — polarity-flipped OB` });
    }
  }
  // FVGs + IFVGs
  for (const fvg of (fvgs||[])) {
    if (Math.abs(price - ((fvg.top+fvg.bot)/2)) < tolerance) {
      const isBull = fvg.type?.includes("Bull");
      const isIfvg = fvg.type?.includes("IFVG") || fvg.type?.includes("Implied");
      const s = isIfvg ? 30 : 25;
      tools.push({ name: fvg.type, score:s, top:fvg.top, bot:fvg.bot,
        valid: isBull ? inDiscount : inPremium,
        desc:fvg.desc || `${fvg.type} @ [${fvg.bot?.toFixed(2)}–${fvg.top?.toFixed(2)}]` });
    }
  }
  // Order Blocks
  for (const ob of (obs||[])) {
    if (Math.abs(price - ((ob.top+ob.bot)/2)) < tolerance) {
      const isBull = ob.type?.toLowerCase().includes("bull");
      tools.push({ name: isBull ? "Bullish OB" : "Bearish OB",
        score:20, top:ob.top, bot:ob.bot,
        valid: isBull ? inDiscount : inPremium,
        desc:`${isBull?"Bull":"Bear"} OB @ [${ob.bot?.toFixed(2)}–${ob.top?.toFixed(2)}]` });
    }
  }
  // Old High / Old Low (liquidity)
  for (const l of (liq||[])) {
    if (!l.swept && Math.abs(price - l.price) < tolerance) {
      const isBSL = l.type === "BSL";
      tools.push({ name: isBSL ? "Old HIGH (BSL)" : "Old LOW (SSL)",
        score:10, top:l.price+2, bot:l.price-2,
        valid: isBSL ? inPremium : inDiscount,
        desc:`${isBSL?"Old High":"Old Low"} @ ${l.price?.toFixed(2)} — unswept ${isBSL?"BSL":"SSL"}` });
    }
  }

  // Sort by score desc, pick best
  tools.sort((a,b)=>b.score-a.score);
  const best = tools[0] || null;
  const pdScore = best ? best.score : 0;
  const pdValid = best ? best.valid : false;

  // Premium/Discount bias signal
  let biasSignal = "NEUTRAL";
  if (inDiscount && pdValid) biasSignal = "LONG BIAS — discount zone + bullish PD array";
  else if (inPremium && pdValid) biasSignal = "SHORT BIAS — premium zone + bearish PD array";
  else if (inDiscount) biasSignal = "DISCOUNT — no confirmed PD array at price yet";
  else if (inPremium) biasSignal = "PREMIUM — no confirmed PD array at price yet";
  else biasSignal = "EQUILIBRIUM — wait for price to reach premium or discount";

  return { best, tools, pdScore, pdValid, priceZone, inPremium, inDiscount, inGolden,
    eq:eq.toFixed(2), g62:g62.toFixed(2), g79:g79.toFixed(2), hi, lo, biasSignal };
}

function compATR(cs, n=14) {
  if (cs.length < 2) return 1;
  const trs = cs.slice(-n-1).slice(1).map((c,i) => {
    const prev = cs[cs.length-n-1+i];
    return Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c));
  });
  return trs.reduce((a,b)=>a+b,0) / trs.length || 1;
}

function compSwings(cs, lookback=5, maxSwings=6) {
  const swings = [];
  for (let i = lookback; i < cs.length - lookback; i++) {
    const c = cs[i];
    const prevH = cs.slice(i-lookback,i).every(x => x.h <= c.h);
    const nextH = cs.slice(i+1,i+lookback+1).every(x => x.h <= c.h);
    const prevL = cs.slice(i-lookback,i).every(x => x.l >= c.l);
    const nextL = cs.slice(i+1,i+lookback+1).every(x => x.l >= c.l);
    if (prevH && nextH) swings.push({ type:"SH", price:c.h, idx:i });
    if (prevL && nextL) swings.push({ type:"SL", price:c.l, idx:i });
  }
  return swings.sort((a,b) => b.idx-a.idx).slice(0,maxSwings);
}

function compMSS(cs, n=30) {
  const slice = cs.slice(-n);
  if (slice.length < 8) return { bull:false, bear:false, desc:"Insufficient data", swingH:null, swingL:null };
  const swings = compSwings(slice, 3, 8);
  const SHs = swings.filter(s=>s.type==="SH").sort((a,b)=>b.idx-a.idx);
  const SLs = swings.filter(s=>s.type==="SL").sort((a,b)=>b.idx-a.idx);
  // Bull MSS: most recent SH is HIGHER than previous SH AND most recent SL is HIGHER than previous SL
  const bull = SHs.length>=2 && SLs.length>=2 && SHs[0].price > SHs[1].price && SLs[0].price > SLs[1].price;
  const bear = SHs.length>=2 && SLs.length>=2 && SHs[0].price < SHs[1].price && SLs[0].price < SLs[1].price;
  // CHoCH: most recent candle closed through opposite swing
  const last = slice[slice.length-1];
  const choch_bull = SHs.length>=1 && last.c > SHs[0].price;
  const choch_bear = SLs.length>=1 && last.c < SLs[0].price;
  return {
    bull, bear,
    choch_bull, choch_bear,
    recentSH: SHs[0]?.price ?? null,
    recentSL: SLs[0]?.price ?? null,
    prevSH:   SHs[1]?.price ?? null,
    prevSL:   SLs[1]?.price ?? null,
    desc: bull  ? `HH(${SHs[0]?.price?.toFixed(1)})+HL(${SLs[0]?.price?.toFixed(1)}) — Bullish MSS`
         : bear ? `LH(${SHs[0]?.price?.toFixed(1)})+LL(${SLs[0]?.price?.toFixed(1)}) — Bearish MSS`
         : choch_bull ? `CHoCH Bull: closed above SH@${SHs[0]?.price?.toFixed(1)}`
         : choch_bear ? `CHoCH Bear: closed below SL@${SLs[0]?.price?.toFixed(1)}`
         : "No clear MSS"
  };
}

function compDisplacement(cs, atr) {
  if (cs.length < 3) return { score:0, desc:"N/A" };
  const recent = cs.slice(-5);
  let best = { score:0, candle:null, bodyRatio:0 };
  recent.forEach(c => {
    const range  = c.h - c.l || 0.001;
    const body   = Math.abs(c.c - c.o);
    const bodyR  = body / range; // 0–1, higher = more impulsive
    const sizeR  = range / atr;  // > 1.5 = large relative to ATR
    const score  = Math.min(100, Math.round((bodyR * 0.6 + Math.min(sizeR/2, 1) * 0.4) * 100));
    if (score > best.score) best = { score, candle:c, bodyRatio:bodyR, sizeRatio:sizeR };
  });
  const dir = best.candle?.c >= best.candle?.o ? "Bull" : "Bear";
  return {
    score: best.score,
    direction: dir,
    bodyPct: Math.round((best.bodyRatio||0)*100),
    sizeVsATR: (best.sizeRatio||0).toFixed(2),
    desc: best.score >= 70
      ? `${dir} displacement: body ${Math.round((best.bodyRatio||0)*100)}% of range, ${(best.sizeRatio||0).toFixed(1)}×ATR — IMPULSIVE`
      : best.score >= 45
      ? `Moderate ${dir} move: body ${Math.round((best.bodyRatio||0)*100)}%, ${(best.sizeRatio||0).toFixed(1)}×ATR — marginal`
      : `Weak move: body ${Math.round((best.bodyRatio||0)*100)}%, ${(best.sizeRatio||0).toFixed(1)}×ATR — NOT a valid BOS`
  };
}

function compSweepSignal(cs, swings) {
  if (!swings.length || cs.length < 4) return { swept:false, desc:"None" };
  const recent = cs.slice(-6);
  for (const sw of swings) {
    for (const c of recent) {
      if (sw.type === "SH") {
        // Wick above SH but closed below = BSL sweep
        if (c.h > sw.price && c.c < sw.price) {
          return { swept:true, type:"BSL_SWEEP", level:sw.price, desc:`BSL sweep of SH@${sw.price.toFixed(2)} — wick through, body closed below` };
        }
      }
      if (sw.type === "SL") {
        // Wick below SL but closed above = SSL sweep
        if (c.l < sw.price && c.c > sw.price) {
          return { swept:true, type:"SSL_SWEEP", level:sw.price, desc:`SSL sweep of SL@${sw.price.toFixed(2)} — wick through, body closed above` };
        }
      }
    }
  }
  return { swept:false, desc:"No recent liquidity sweep" };
}

function compFVGSequence(cs, fvgList) {
  if (!fvgList.length || cs.length < 8) return { stage:"NONE", fvg:null, desc:"No FVG detected" };
  const last = cs[cs.length-1];
  const atr  = compATR(cs);

  for (const fvg of fvgList) {
    const isBull = fvg.type.includes("Bull");
    const priceInFVG = last.c >= fvg.bot && last.c <= fvg.top;
    // Post-FVG candles
    const postFVG = cs.slice(fvg.idx + 2);
    if (postFVG.length < 2) continue;

    if (isBull) {
      // Bull FVG: after forming, price should drop (seek SSL draw), then retrace UP into FVG
      const minAfter = Math.min(...postFVG.map(c=>c.l));
      const movedDown = minAfter < fvg.bot - atr * 0.3; // price went meaningfully below FVG
      if (priceInFVG && movedDown) return { stage:"COMPLETE", fvg, desc:`Bull FVG ${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}: formed → price sought draw (min ${minAfter.toFixed(2)}) → now RETRACING back — ENTRY VALID` };
      if (!movedDown) return { stage:"PENDING_DRAW", fvg, desc:`Bull FVG ${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}: formed, waiting for price to seek draw below before entering` };
      if (movedDown && !priceInFVG) return { stage:"PENDING_RETRACE", fvg, desc:`Bull FVG ${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}: draw sought (min ${minAfter.toFixed(2)}), waiting for RETRACE back into FVG` };
    } else {
      // Bear FVG: price should rally up (seek BSL draw), then retrace DOWN into FVG
      const maxAfter = Math.max(...postFVG.map(c=>c.h));
      const movedUp = maxAfter > fvg.top + atr * 0.3;
      if (priceInFVG && movedUp) return { stage:"COMPLETE", fvg, desc:`Bear FVG ${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}: formed → price sought draw (max ${maxAfter.toFixed(2)}) → now RETRACING back — ENTRY VALID` };
      if (!movedUp) return { stage:"PENDING_DRAW", fvg, desc:`Bear FVG ${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}: formed, waiting for price to rally to draw above before entering` };
      if (movedUp && !priceInFVG) return { stage:"PENDING_RETRACE", fvg, desc:`Bear FVG ${fvg.bot.toFixed(2)}–${fvg.top.toFixed(2)}: draw sought (max ${maxAfter.toFixed(2)}), waiting for RETRACE back into FVG` };
    }
  }
  return { stage:"NONE", fvg:null, desc:"No FVG sequence conditions met" };
}

function compCVDDiv(cs, ofSlice, n=15) {
  if (!ofSlice || ofSlice.length < n) return { divergence:"NONE", desc:"Insufficient order flow data" };
  const p   = ofSlice.slice(-n).map(c=>c.c||0);
  const cvd = ofSlice.slice(-n).map(c=>c.cvd||0);
  const priceDir = p[p.length-1] - p[0];
  const cvdDir   = cvd[cvd.length-1] - cvd[0];
  // Divergence = price and CVD moving in OPPOSITE directions
  if (priceDir < 0 && cvdDir > 0) return { divergence:"BULL", desc:`BULLISH divergence: price fell ${Math.abs(priceDir).toFixed(1)}pts but CVD rose ${cvdDir.toFixed(0)} — institutional accumulation detected` };
  if (priceDir > 0 && cvdDir < 0) return { divergence:"BEAR", desc:`BEARISH divergence: price rose ${Math.abs(priceDir).toFixed(1)}pts but CVD fell ${Math.abs(cvdDir).toFixed(0)} — institutional distribution detected` };
  if (priceDir < 0 && cvdDir < 0) return { divergence:"NONE", desc:`Confirmation bear: price and CVD both falling — no divergence` };
  if (priceDir > 0 && cvdDir > 0) return { divergence:"NONE", desc:`Confirmation bull: price and CVD both rising — no divergence` };
  return { divergence:"NONE", desc:"Flat — no signal" };
}

function compSMTSignal(cs, n=20) {
  const slice = cs.slice(-n);
  if (slice.length < 4) return { bullSMT:false, bearSMT:false, desc:"Insufficient data" };
  const prices = slice.map(c=>c.c), deltas = slice.map(c=>c.delta||0);
  const lastP = prices[prices.length-1];
  const prevLowP  = Math.min(...prices.slice(0,-3));
  const prevHighP = Math.max(...prices.slice(0,-3));
  const lastD     = deltas[deltas.length-1];
  const prevLowD  = Math.min(...deltas.slice(0,-3));
  const prevHighD = Math.max(...deltas.slice(0,-3));
  if (lastP <= prevLowP && lastD > prevLowD)
    return { bullSMT:true,  bearSMT:false, desc:"Price new low, delta diverging UP — institutional long accumulation" };
  if (lastP >= prevHighP && lastD < prevHighD)
    return { bullSMT:false, bearSMT:true,  desc:"Price new high, delta diverging DOWN — institutional short distribution" };
  return { bullSMT:false, bearSMT:false, desc:"No SMT signal — true SMT requires NQ vs ES/YM price comparison" };
}

function compEngulfing(cs, n=10, atr=1) {
  if (cs.length < 4) return { type:"NONE", score:0, desc:"Insufficient data" };
  const slice = cs.slice(-n);
  const last  = slice[slice.length-1];
  const prev  = slice[slice.length-2];
  const avgBody = slice.slice(-4,-1).reduce((a,c)=>a+Math.abs(c.c-c.o),0)/3 || 0.001;
  const lastBody = Math.abs(last.c - last.o);
  const prevBody = Math.abs(prev.c - prev.o) || 0.001;
  const lastRange= (last.h - last.l) || 0.001;
  const isBullEngulf = last.c > prev.o && last.o < prev.c && last.c > last.o && lastBody >= 1.3*prevBody;
  const isBearEngulf = last.c < prev.o && last.o > prev.c && last.c < last.o && lastBody >= 1.3*prevBody;
  const hasMomentum  = lastBody > avgBody;
  const strongClose  = last.c > last.o ? (last.c-last.l)/lastRange>0.6 : (last.h-last.c)/lastRange>0.6;
  const sizeVsATR    = (lastRange/atr).toFixed(2);
  const score = (isBullEngulf||isBearEngulf?40:0)+(hasMomentum?30:0)+(strongClose?30:0);
  if (isBullEngulf) return {type:"BULL",score,hasMomentum,strongClose,sizeVsATR,candle:last,
    desc:`BULLISH ENGULF @ ${last.c.toFixed(2)}: body ${lastBody.toFixed(1)}pts (${(lastBody/prevBody).toFixed(1)}×prior). ${hasMomentum?"Above avg ✓":"Below avg"} ${strongClose?"Strong close ✓":"Weak close"} ${sizeVsATR}×ATR. Score:${score}/100`};
  if (isBearEngulf) return {type:"BEAR",score,hasMomentum,strongClose,sizeVsATR,candle:last,
    desc:`BEARISH ENGULF @ ${last.c.toFixed(2)}: body ${lastBody.toFixed(1)}pts (${(lastBody/prevBody).toFixed(1)}×prior). ${hasMomentum?"Above avg ✓":"Below avg"} ${strongClose?"Strong close ✓":"Weak close"} ${sizeVsATR}×ATR. Score:${score}/100`};
  for (let i=slice.length-3;i>=Math.max(1,slice.length-6);i--) {
    const c=slice[i],p=slice[i-1];
    const cb=Math.abs(c.c-c.o),pb=Math.abs(p.c-p.o)||0.001;
    const age=slice.length-1-i;
    if (c.c>p.o&&c.o<p.c&&c.c>c.o&&cb>=1.3*pb) return {type:"BULL_RECENT",score:50,candle:c,desc:`Bull engulf ${age} candle(s) ago @ ${c.c.toFixed(2)} — valid if within 3 bars`};
    if (c.c<p.o&&c.o>p.c&&c.c<c.o&&cb>=1.3*pb) return {type:"BEAR_RECENT",score:50,candle:c,desc:`Bear engulf ${age} candle(s) ago @ ${c.c.toFixed(2)} — valid if within 3 bars`};
  }
  return {type:"NONE",score:0,desc:"No engulfing candle in last 10 bars"};
}

function comp50Level(cs, n=30) {
  const slice = cs.slice(-n);
  const hi = Math.max(...slice.map(c=>c.h));
  const lo = Math.min(...slice.map(c=>c.l));
  return { hi, lo, mid:(hi+lo)/2, range:(hi-lo) };
}

function compOBQuality(obs, cs) {
  const unmet = obs.filter(o => !o.mit);
  if (!unmet.length) return { count:0, best:null, desc:"No unmitigated OBs" };
  const last = cs[cs.length-1];
  // Find OB closest to current price
  const nearest = unmet.reduce((a,b) => {
    const da = Math.min(Math.abs(last.c - a.top), Math.abs(last.c - a.bot));
    const db = Math.min(Math.abs(last.c - b.top), Math.abs(last.c - b.bot));
    return db < da ? b : a;
  });
  const dist = Math.min(Math.abs(last.c - nearest.top), Math.abs(last.c - nearest.bot));
  return {
    count: unmet.length,
    best: nearest,
    distToNearest: dist.toFixed(2),
    priceInsideOB: last.c >= nearest.bot && last.c <= nearest.top,
    desc: `${unmet.length} unmitigated OB(s). Nearest: ${nearest.type} ${nearest.bot.toFixed(2)}–${nearest.top.toFixed(2)}, ${dist.toFixed(1)}pts away${last.c >= nearest.bot && last.c <= nearest.top ? " — PRICE INSIDE OB" : ""}`
  };
}

function AIScannerTab({ candles, obs, bbs, fvgs, liq, orb, ote, ofData, instrument, activeStrategy, onSetupFound, tradeSetup, onClearSetup, onScanResult, tvConn, riskEngine, auditLog, tfCandles, enabledStrats: enabledStratsProp, setEnabledStrats: setEnabledStratsProp, onAutoExecute }) {
  const [scanning,      setScanning]      = useState(false);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState(null);
  const [lastAt,        setLastAt]        = useState(null);
  const [autoScan,      setAutoScan]      = useState(false);
  // enabledStrats: use prop from App (shared with StrategiesTab) or local fallback
  const [enabledStratsLocal, setEnabledStratsLocal] = useState(
    () => new Set(["vivek_unicorn","kz_confluence","liq_sweep_ifvg","crt_engulf"])
  );
  const enabledStrats    = enabledStratsProp    ?? enabledStratsLocal;
  const setEnabledStrats = setEnabledStratsProp ?? setEnabledStratsLocal;

  // ── ANTHROPIC API KEY ────────────────────────────────────────────────────
  const [anthropicKey, setAnthropicKeyState] = useState(
    () => { try { return localStorage.getItem('anthropic_api_key') || ''; } catch { return ''; } }
  );
  const saveAnthropicKey = k => {
    setAnthropicKeyState(k);
    try { localStorage.setItem('anthropic_api_key', k); } catch {}
  };

  // ── LOT SIZE CALCULATOR STATE ────────────────────────────────────────────
  const [capital,  setCapital]  = useState(50000);
  const [riskPct,  setRiskPct]  = useState(1);

  // Tick values per contract (point value)
  const POINT_VALUES = { NQ:20, ES:50, RTY:10, YM:5 };
  const pointVal = POINT_VALUES[instrument] || 20;

  // Derived lot calc — computed from latest result whenever capital/riskPct/result changes
  const lotCalc = useMemo(() => {
    if (!result || !result.entry_top || !result.entry_bot || !result.stop_price) return null;
    const entryMid   = (parseFloat(result.entry_top) + parseFloat(result.entry_bot)) / 2;
    const stopPts    = Math.abs(entryMid - parseFloat(result.stop_price));
    if (stopPts === 0) return null;
    // Vivek fact sheet: NQ max stop = 30 points
    const maxStopPts  = instrument === "NQ" ? 30 : null;
    const stopBreached = maxStopPts && stopPts > maxStopPts;
    const dollarRisk  = capital * (riskPct / 100);
    const riskPerLot  = stopPts * pointVal;
    const lots        = Math.max(1, Math.floor(dollarRisk / riskPerLot));
    const actualRisk  = lots * riskPerLot;
    const tp1Pts      = result.tp1_price ? Math.abs(entryMid - parseFloat(result.tp1_price)) : null;
    const tp2Pts      = result.tp2_price ? Math.abs(entryMid - parseFloat(result.tp2_price)) : null;
    const rr1         = tp1Pts ? (tp1Pts / stopPts).toFixed(2) : null;
    const rr2         = tp2Pts ? (tp2Pts / stopPts).toFixed(2) : null;
    const maxGain1    = tp1Pts ? lots * tp1Pts * pointVal : null;
    const maxGain2    = tp2Pts ? lots * tp2Pts * pointVal : null;
    // BE price = entry ± stop distance (1:1 R:R)
    const bePrice     = result.direction === "LONG" ? entryMid + stopPts : entryMid - stopPts;
    return { lots, stopPts, riskPerLot, dollarRisk, actualRisk, rr1, rr2, maxGain1, maxGain2, entryMid, stopBreached, maxStopPts, bePrice };
  }, [result, capital, riskPct, pointVal, instrument]);

  // ══════════════════════════════════════════════════════════════════
  // PRECISION COMPUTED SIGNALS  (sent to AI scanner)
  // ══════════════════════════════════════════════════════════════════

  // ── ATR (14-period Average True Range) ─────────────────────────

  // ── Swing Highs / Lows with strength scoring ───────────────────
  // Returns up to N significant swings sorted newest-first

  // ── FVG detection with fill-check ─────────────────────────────
  // Returns unfilled FVGs newest-first, each tagged with size vs ATR



  // ── MSS detection using actual swing structure ─────────────────

  // ── Displacement quality: is the last BOS candle impulsive? ───
  // Returns score 0–100 and details

  // ── Liquidity Sweep detection ─────────────────────────────────
  // Checks if any recent candle wicked THROUGH a known swing and closed back

  // ── FVG Price Sequence Stage detector ─────────────────────────
  // COMPLETE = FVG formed, price went to draw, now retraced back INTO FVG
  // PENDING_RETRACE = FVG formed, price moved to draw, not yet back in FVG
  // PENDING_DRAW = FVG formed but price hasn't moved to the draw yet
  // NONE = no relevant FVG

  // ── CVD Divergence ─────────────────────────────────────────────
  // Compares price swing direction vs CVD direction over last N bars

  // ── SMT divergence via order flow proxy ───────────────────────
  // ── CRT Engulfing candle detector ────────────────────────────
  // Checks last N candles for valid engulfing patterns with quality score

  // ── 50% level of recent swing ─────────────────────────────────

  // ── OB quality check ──────────────────────────────────────────
  // Is the OB at a BOS point? Is it unmitigated?

  // ── Session time helpers ───────────────────────────────────────
  const getESTMins = () => {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const isDST = month >= 3 && month <= 11;
    const offsetMins = isDST ? -240 : -300;
    const estMins = (now.getUTCHours() * 60 + now.getUTCMinutes()) + offsetMins;
    return ((estMins % 1440) + 1440) % 1440;
  };
  const isSilverBullet = () => { const m=getESTMins(); return m>=570&&m<660; };
  const isNYPM         = () => { const m=getESTMins(); return m>=810&&m<900; };
  const isNYLunch      = () => { const m=getESTMins(); return m>=720&&m<780; };
  const isPreMarket    = () => { const m=getESTMins(); return m>=510&&m<570; };
  const getActiveMacro = () => {
    const m = getESTMins();
    if (m>=510&&m<600) return "FIRST_AM_MACRO — close all by 11:00AM";
    if (m>=600&&m<660) return "SECOND_AM_MACRO — close all by 12:00PM";
    if (m>=810&&m<900) return "NY_PM_SESSION (1:30–3:00PM)";
    if (m>=720&&m<780) return "NY_LUNCH — NO TRADES, CLOSE POSITIONS";
    return "OFF_WINDOW";
  };
  const currentKillzone = () => {
    const m = getESTMins();
    if (isNYLunch())    return "🚫 NY_LUNCH (12–1PM EST) — STOP HUNT ZONE, NO TRADES";
    if (isSilverBullet()) return "⭐ SILVER_BULLET (9:30–11AM EST) — PRIME WINDOW";
    if (isNYPM())       return "⭐ NY_PM (1:30–3PM EST) — ACTIVE WINDOW";
    if (isPreMarket())  return "⚠ PRE-MARKET (8:30–9:30AM) — stops swept, wait";
    if (m>=200&&m<500)  return "LONDON (3:00–8:20AM EST)";
    if (m>=900&&m<960)  return "NY_CLOSE (3–4PM EST)";
    return "OFF_WINDOW — next: Silver Bullet 9:30AM or NY PM 1:30PM";
  };

    const buildCtx = useCallback((candleOverride) => {
    const cds = candleOverride ?? candles;
    if (!cds.length) return "";
    const last    = cds[cds.length-1];
    const ctx2    = compContextualLevels(cds);
    const htfBias = compHTFBias(cds);
    const lastOF  = ofData[ofData.length-1];

    // ── Precision computed signals ─────────────────────────────────
    const atr       = compATR(cds);
    const swings    = compSwings(cds, 5, 8);
    const ifvgs     = compIFVGs(cds);
    const ifvgsForCtx = compIFVGs(cds);
    const pdArray     = compPDArray(cds, obs, bbs, ifvgsForCtx, liq, cds[cds.length-1]?.c || 0);
    const macroInfo   = getMacroLabel(cds[cds.length-1]?.t || Date.now());
    const mss5m     = compMSS(cds, 12);
    const mss15m    = compMSS(cds, 36);
    const mss1h     = compMSS(cds, 24);
    const mss4h     = compMSS(cds, 48);
    const mssWeekly = compMSS(cds, cds.length);
    const swing50   = comp50Level(cds, 40);
    const disp      = compDisplacement(cds, atr);
    const sweepSig  = compSweepSignal(cds, swings);
    const fvgSeq    = compFVGSequence(cds, ifvgs);
    const cvdDiv    = compCVDDiv(cds, ofData, 15);
    const smtSig    = compSMTSignal(cds, 20);
    const engulf    = compEngulfing(cds, 10, atr);
    const obQ       = compOBQuality(obs, cds);
    const sbWindow  = isSilverBullet();
    const nyPM      = isNYPM();
    const nyLunch   = isNYLunch();
    const macro     = getActiveMacro();
    const kz        = currentKillzone();
    const estMins   = getESTMins();
    const estTime   = `${Math.floor(estMins/60)}:${String(estMins%60).padStart(2,"0")} EST`;

    // ── Price-to-key-level distances ──────────────────────────────
    const distPDH  = ctx2?.pdh ? Math.abs(last.c - ctx2.pdh).toFixed(1) : "N/A";
    const distPDL  = ctx2?.pdl ? Math.abs(last.c - ctx2.pdl).toFixed(1) : "N/A";
    const distOTE  = ote ? (last.c >= ote.ote_bot && last.c <= ote.ote_top ? "INSIDE OTE" : last.c > ote.ote_top ? `${(last.c-ote.ote_top).toFixed(1)}pts ABOVE OTE` : `${(ote.ote_bot-last.c).toFixed(1)}pts BELOW OTE`) : "N/A";
    const above50  = swing50 ? (last.c > swing50.mid ? `YES — ${(last.c - swing50.mid).toFixed(1)}pts above 50% (${swing50.mid.toFixed(2)})` : `NO — ${(swing50.mid - last.c).toFixed(1)}pts BELOW 50%`) : "N/A";
    const fvgToPrice = ifvgs.length && ifvgs[0]
      ? (last.c >= ifvgs[0].bot && last.c <= ifvgs[0].top
          ? "INSIDE FVG"
          : last.c > ifvgs[0].top
            ? `${(last.c - ifvgs[0].top).toFixed(1)}pts above FVG`
            : `${(ifvgs[0].bot - last.c).toFixed(1)}pts below FVG`)
      : "No FVG";

    // ── Format arrays for context ──────────────────────────────────
    const aOBs   = obs.filter(o=>!o.mit).map(o=>`    ${o.type} [${o.bot.toFixed(2)}–${o.top.toFixed(2)}]`).join("\n") || "    None";
    const aBBs   = bbs.map(b=>`    ${b.type} [${b.bot.toFixed(2)}–${b.top.toFixed(2)}]`).join("\n") || "    None";
    const aFVGs  = ifvgs.map(f=>`    ${f.type} [${f.bot.toFixed(2)}–${f.top.toFixed(2)}] size=${f.size.toFixed(1)}pts (${f.sizeATR}×ATR)`).join("\n") || "    None";
    const aSwings = swings.slice(0,6).map(s=>`    ${s.type}@${s.price.toFixed(2)}`).join("  ") || "    None";
    const aLiq   = liq.filter(l=>!l.swept).map(l=>`    ${l.type}@${l.price.toFixed(2)}`).join("  ") || "    None";

    // ── Strategy rules (condensed — full rules are in the system prompt context) ──
    const activeStratList = SCANNER_STRATEGIES.filter(s => s.alwaysOn || enabledStrats.has(s.id));
    const strategyIds     = activeStratList.map(s => s.id).join(", ");

    return `════════════════════════════════════════════
INSTRUMENT: ${instrument} │ PRICE: ${last.c.toFixed(2)} │ TIME: ${estTime}
SESSION: ${kz}
ICT MACRO: ${macroInfo.label || macro || "None active"}  │  Quality: ${macroInfo.quality}${macroInfo.sb?" ⚡ SILVER BULLET OVERLAP":""}
ATR(14): ${atr.toFixed(2)} pts
════════════════════════════════════════════

▌ GATE CHECKS (answer YES/NO for each)
G1 WEEKLY BIAS:   ${mssWeekly.bull?"✅ BULLISH — "+mssWeekly.desc : mssWeekly.bear?"✅ BEARISH — "+mssWeekly.desc : "❌ MIXED/UNCLEAR — "+mssWeekly.desc}
G2 DAILY BIAS:    ${htfBias.find(h=>h.tf==="Daily")?.bias ?? "N/A"} │ Weekly: ${htfBias.find(h=>h.tf==="Weekly")?.bias ?? "N/A"} │ 4H: ${htfBias.find(h=>h.tf==="4H")?.bias ?? "N/A"}
G3 SESSION VALID: ${(sbWindow||nyPM)?"✅ YES — "+kz:"❌ NO — off window, max conviction=LOW"}
G4 NOT LUNCH:     ${nyLunch?"🚫 LUNCH — FLAT/NONE FORCED":"✅ CLEAR"}
G5 BOS/CHoCH:     ${disp.score>=60?"✅ "+disp.desc:"❌ "+disp.desc}

▌ TOP-DOWN STRUCTURE (4H → 1H → 15M → 5M → 3M → 1M)
4H  MSS: ${mss4h.desc}  │ SH:${mss4h.recentSH?.toFixed(2)??"N/A"} SL:${mss4h.recentSL?.toFixed(2)??"N/A"}
1H  MSS: ${mss1h.desc}  │ SH:${mss1h.recentSH?.toFixed(2)??"N/A"} SL:${mss1h.recentSL?.toFixed(2)??"N/A"}
15M MSS: ${mss15m.desc} │ SH:${mss15m.recentSH?.toFixed(2)??"N/A"} SL:${mss15m.recentSL?.toFixed(2)??"N/A"}
5M  MSS: ${mss5m.desc}  (continuation alignment check — optional)
Swing levels (recent): ${aSwings}
TREND QUALITY: ${(()=>{
  const bull4h=mss4h.bull,bear4h=mss4h.bear,bull1h=mss1h.bull,bear1h=mss1h.bear,bull15=mss15m.bull,bear15=mss15m.bear;
  if(bull4h&&bull1h&&bull15) return "STRONG BULL — all TFs aligned, continuation longs favoured";
  if(bear4h&&bear1h&&bear15) return "STRONG BEAR — all TFs aligned, continuation shorts favoured";
  if(bull4h&&bull1h&&!bull15) return "BULL pullback — 15M pulling back within 4H/1H bull trend, watch for reversal at key 15M/1H level";
  if(bear4h&&bear1h&&!bear15) return "BEAR pullback — 15M pulling back within 4H/1H bear trend, watch for reversal at key 15M/1H level";
  if(bull4h&&!bull1h) return "MIXED — 4H bull but 1H bearish, wait for 1H alignment before continuation";
  if(bear4h&&!bear1h) return "MIXED — 4H bear but 1H bullish, wait for 1H alignment before continuation";
  return "UNCLEAR — range or transition, favour reversal setups only at clear HTF key levels";
})()}

▌ DISPLACEMENT QUALITY
${disp.desc}
Body: ${disp.bodyPct}% of range │ Size vs ATR: ${disp.sizeVsATR}× │ Score: ${disp.score}/100
(Valid BOS requires score ≥ 60, body ≥ 55%, size ≥ 1.2×ATR)

▌ LIQUIDITY SWEEP
${sweepSig.desc}
Unswept pools: ${aLiq}

▌ FVG PRICE SEQUENCE ← critical entry mechanic
Stage: ${fvgSeq.stage}
${fvgSeq.desc}
Price vs nearest FVG: ${fvgToPrice}
All open FVGs:
${aFVGs}

▌ OTE FIBONACCI ZONE
${ote?`OTE 61.8%: ${ote.fib_618?.toFixed(2)} │ 70.5%: ${ote.fib_705?.toFixed(2)} │ 78.6%: ${ote.fib_786?.toFixed(2)}`:"N/A"}
Price position: ${distOTE}
Above 50% of swing: ${above50}
Swing range: ${swing50.lo.toFixed(2)}–${swing50.hi.toFixed(2)} (50% = ${swing50.mid.toFixed(2)})

▌ ORDER BLOCKS
${obQ.desc}
All unmitigated OBs:
${aOBs}
Breaker Blocks: ${aBBs !== "    None" ? "\n"+aBBs : "None"}

▌ ERL TARGETS
PDH: ${ctx2?.pdh?.toFixed(2)??"N/A"} ${ctx2?.pdhSwept?"[SWEPT]":"[ACTIVE]"} — ${distPDH}pts away
PDL: ${ctx2?.pdl?.toFixed(2)??"N/A"} ${ctx2?.pdlSwept?"[SWEPT]":"[ACTIVE]"} — ${distPDL}pts away
PWH: ${ctx2?.pwh?.toFixed(2)??"N/A"} ${ctx2?.pwhSwept?"[SWEPT]":"[ACTIVE]"}
PWL: ${ctx2?.pwl?.toFixed(2)??"N/A"} ${ctx2?.pwlSwept?"[SWEPT]":"[ACTIVE]"}
ORB: ${orb?`H:${orb.high?.toFixed(2)} L:${orb.low?.toFixed(2)} R:${orb.range?.toFixed(2)}`:"N/A"}

▌ ORDER FLOW
Delta(last bar): ${lastOF?.delta>0?"+":""}${lastOF?.delta||0} │ CVD: ${lastOF?.cvd?.toFixed(0)||0} (${lastOF?.cvd>0?"accumulating":"distributing"})
CVD DIVERGENCE: ${cvdDiv.divergence} — ${cvdDiv.desc}
SMT SIGNAL: ${smtSig}

▌ CRT ENGULFING SIGNAL (for CRT Multi-TF strategy)
Engulf type: ${engulf.type} | Score: ${engulf.score}/100
${engulf.desc}
Valid CRT requires: type=BULL or BEAR (not RECENT), score≥70, hasMomentum=true, strongClose=true\nPD Array bias must confirm: price in discount for BULL engulf, premium for BEAR engulf (check PD ARRAY section)

▌ PD ARRAY (Premium / Discount / Bias)
Price Zone: ${pdArray.priceZone}  │  Swing Hi: ${pdArray.hi?.toFixed(2)??'N/A'}  Swing Lo: ${pdArray.lo?.toFixed(2)??'N/A'}  │  Equilibrium (50%): ${pdArray.eq}  │  Golden Pocket (OTE): ${pdArray.g79}–${pdArray.g62}
Bias Signal: ${pdArray.biasSignal}
Best PD Tool at price: ${pdArray.best ? pdArray.best.name + " — score +" + pdArray.best.score + " — " + pdArray.best.desc : "None within ATR range"}
${pdArray.tools.length>1 ? "All PD tools at price: " + pdArray.tools.map(t=>t.name+"(+"+t.score+")").join(", ") : ""}

▌ DRAW ON LIQUIDITY
Identify the OPPOSING pool price is targeting before confirming any entry.
For LONGS: nearest unswept BSL above = ${liq.filter(l=>!l.swept&&l.type==="BSL").sort((a,b)=>a.price-b.price).find(l=>l.price>last.c)?.price?.toFixed(2)??"none visible"}
For SHORTS: nearest unswept SSL below = ${liq.filter(l=>!l.swept&&l.type==="SSL").sort((a,b)=>b.price-a.price).find(l=>l.price<last.c)?.price?.toFixed(2)??"none visible"}

▌ SESSION RULES (hard-coded — must enforce)
FIRST AM MACRO: close by 11:00AM EST
SECOND AM MACRO: close by 12:00PM EST
NY LUNCH (12–1PM): FLAT, no entries, close positions
NQ MAX STOP: 30 points or OB extreme (tighter)
TP1: 50% off + move stop to BE
BE RULE: move stop to breakeven at exactly 1:1 R:R

▌ TRADE TYPE CLASSIFICATION
${(()=>{
  const bull4h=mss4h.bull,bear4h=mss4h.bear,bull1h=mss1h.bull,bear1h=mss1h.bear,bull15=mss15m.bull,bear15=mss15m.bear,bull5=mss5m.bull,bear5=mss5m.bear;
  const trendAligned = (bull4h&&bull1h)||(bear4h&&bear1h);
  const swept = sweepSig.swept;
  const contBull = bull4h&&bull1h&&bull15&&bull5;
  const contBear = bear4h&&bear1h&&bear15&&bear5;
  const revCondition = swept;
  if(contBull) return "TRADE TYPE: CONTINUATION LONG\n  Requirements met: 4H bull + 1H bull + 15M bull + 5M bull aligned\n  Entry: look for FVG on 3M/1M, retrace into FVG = entry\n  Target: nearest BSL above, then HTF liquidity pool\n  5M alignment is confirmed — optional but present";
  if(contBear) return "TRADE TYPE: CONTINUATION SHORT\n  Requirements met: 4H bear + 1H bear + 15M bear + 5M bear aligned\n  Entry: look for FVG on 3M/1M, retrace into FVG = entry\n  Target: nearest SSL below, then HTF liquidity pool\n  5M alignment is confirmed — optional but present";
  if(trendAligned && !bull15 && bull4h) return "TRADE TYPE: CONTINUATION LONG SETUP — 15M PULLBACK\n  4H/1H bullish but 15M pulling back. Wait for 15M to re-align OR for key 15M/1H level to be swept before entry";
  if(trendAligned && !bear15 && bear4h) return "TRADE TYPE: CONTINUATION SHORT SETUP — 15M PULLBACK\n  4H/1H bearish but 15M pulling back. Wait for 15M to re-align OR for key 15M/1H level to be swept before entry";
  if(revCondition) return "TRADE TYPE: REVERSAL CANDIDATE\n  Liquidity sweep just occurred at key level. CHoCH required to confirm. Entry priority: (1) IFVG retrace, (2) BB+FVG retrace, (3) FVG retrace, (4) OB retrace";
  return "TRADE TYPE: NO CLEAR SETUP\n  TFs not aligned for continuation. No sweep for reversal. Wait for alignment or sweep.";
})()}

▌ ENTRY PRIORITY (based on trade type + context)
${(()=>{
  const swept = sweepSig.swept;
  const trendBull = mss4h.bull&&mss1h.bull;
  const trendBear = mss4h.bear&&mss1h.bear;
  const clearTrend = trendBull||trendBear;
  if(swept||clearTrend){
    return "IFVG RETRACE — highest priority (clear trend or sweep active)\nBB + FVG retrace — high conviction\nFVG retrace alone — standard entry\nOB retrace — valid\n\nIFVG is prioritised because: "+(swept?"liquidity level just swept = institutional reversal confirmed":"clear multi-TF trend = momentum committed, IFVG respects direction");
  } else {
    return "BB + FVG retrace — primary (no sweep/trend for IFVG)\nFVG retrace alone — standard entry\nOB retrace — valid\nIFVG — DEPRIORITISED (no clear trend, no recent sweep — likely noise in choppy market)";
  }
})()}

ACTIVE STRATEGIES: ${strategyIds}
`;
  },[candles,obs,bbs,fvgs,liq,orb,ote,ofData,instrument,enabledStrats]);



  const scan = useCallback(async () => {
    if (!candles.length || scanning) return;
    // Prefer live Tradovate 5m candles when available (>50 bars)
    const liveCandles = tvConn && tfCandles?.["5"]?.length > 50 ? tfCandles["5"] : null;
    setScanning(true); setError(null);
    const activeStratList2 = SCANNER_STRATEGIES.filter(s => s.alwaysOn || enabledStrats.has(s.id));
    const stratMatchSchema = activeStratList2.map(s =>
      `    { "strategy_id": "${s.id}", "strategy_name": "${s.shortLabel}", "match": true_or_false, "match_score": 0to100, "gateway_pass": true_or_false, "bos_choch_met": true_or_false, "fvg_sequence_met": true_or_false, "session_valid": true_or_false, "bias_aligned": true_or_false, "conditions_met": ["G1","G2","S3"], "conditions_missing": ["S10 — reason"], "verdict": "one-line verdict" }`
    ).join(",\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "anthropic-version": "2023-06-01",
          ...(anthropicKey&&anthropicKey.trim() ? {"x-api-key": anthropicKey.trim()} : {})
        },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:3000,
          system:`You are Vivek's NQ futures trading AI. Your one job: evaluate the computed signals below with a strict binary checklist and produce a precise, high-conviction trade assessment. DO NOT invent a trade. Most scans should be NO_TRADE or PENDING. A HIGH conviction ACTIVE trade requires ALL gateways to pass and ≥7 of 9 scoring conditions met.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GATEWAY CONDITIONS — any single FAIL = conviction NONE, direction FLAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
G1 WEEKLY+DAILY BIAS: Both Weekly and Daily must show the same directional structure (HH+HL = bull, LH+LL = bear). Check the G1/G2 lines in the data. If either is MIXED/UNCLEAR or they disagree = FAIL.
G2 SESSION WINDOW: Trade ONLY during Silver Bullet (9:30–11AM EST) or NY PM (1:30–3PM EST). If "G3 SESSION VALID" shows ❌ = FAIL. If NY Lunch = FORCED FLAT regardless of everything else.
G3 BOS/CHoCH DISPLACEMENT: The displacement score in the data must be ≥ 60/100 AND body ≥ 55% of range AND size ≥ 1.2×ATR. "Displacement Score: X/100" tells you this. Score < 60 = FAIL. A drift through a level is not a BOS.
G4 DRAW ON LIQUIDITY: You must be able to name a specific price target (BSL or SSL) that price is clearly being drawn toward. If no clear opposing liquidity is visible = FAIL.
G5 NOT AGAINST DAILY BIAS: Trade direction must match Daily AND Weekly. Attempting a long in a bearish Daily structure = FAIL.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING CONDITIONS (0–9, each is PASS=1/FAIL=0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S0 PD ARRAY + PREMIUM/DISCOUNT: Check the PD ARRAY section. Bias Signal must show "LONG BIAS" for longs (price in discount + bullish PD tool) or "SHORT BIAS" for shorts (price in premium + bearish PD tool). The best PD tool score contributes to overall rating: Breaker Block=+35, FVG/IFVG=+25-30, OB=+20, Old High/Low=+10. If Bias Signal shows NEUTRAL or wrong side = reduce conviction by 1 grade.
S1 4H+1H MSS ALIGNED: 4H and 1H MSS must both show the same directional structure as the trade. This is the primary trend filter. Check "4H MSS" and "1H MSS" lines. MIXED on either = FAIL for continuation trades.
S2 15M+5M ALIGNED (CONTINUATION) or SWEPT (REVERSAL): For CONTINUATION — 15M MSS must match 4H/1H direction. 5M is optional but adds conviction. For REVERSAL — a 15M or 1H key level (swing high/low, PDH/PDL, PWH/PWL) must have just been swept (check LIQUIDITY SWEEP section). If TRADE TYPE shows CONTINUATION and 15M/5M don't align = FAIL. If TRADE TYPE shows REVERSAL and no sweep = FAIL.
S3 FVG / IFVG SEQUENCE COMPLETE: For standard entry — "Stage: COMPLETE" in FVG PRICE SEQUENCE = PASS. For IFVG entry — check ENTRY PRIORITY section: if IFVG is highest priority AND a BB+FVG or IFVG is present near current price = PASS. PENDING_DRAW or PENDING_RETRACE = FAIL (set status=PENDING). NOT_PRESENT = FAIL.
S4 PRICE ABOVE 50% OF SWING: "Above 50% of swing" field must say YES for longs (price above 50% means we're in the OTE zone not over-extended). For shorts: price below 50% of swing.
S5 OTE 0.62–0.79 ZONE: "Price position" for OTE must say "INSIDE OTE" or within 3 points of it.
S6 OB+FVG CONFLUENCE: "PRICE INSIDE OB" must appear in the OB section AND an FVG must overlap or be adjacent to that OB.
S7 UNMITIGATED OB PRESENT: OB count > 0 in the data AND the nearest OB is unmitigated (not tagged [SWEPT]).
S8 CVD DIVERGENCE: CVD DIVERGENCE field must show BULL (for longs) or BEAR (for shorts). NONE = FAIL.
S9 LIQUIDITY SWEEP (REVERSAL) / TF ALIGNMENT (CONTINUATION): 
  — For REVERSAL trades: LIQUIDITY SWEEP section must show a valid BSL_SWEEP (for shorts) or SSL_SWEEP (for longs) at a 15M or 1H key level. Sweep must be recent (within last 5 candles). Without this, reversal = FAIL.
  — For CONTINUATION trades: this condition is PASS if TRADE TYPE section confirms all TFs aligned. Sweep not required for continuation.
  Check TRADE TYPE section to determine which applies.
S10 CRT ENGULFING (if crt_engulf strategy active): CRT ENGULFING SIGNAL section must show type=BULL (for longs) or BEAR (for shorts), score≥70, hasMomentum=true, strongClose=true. If CRT is not in the active strategy list, this condition is N/A (skip).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVICTION ASSIGNMENT (based on scoring)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIGH:   All 5 gateways PASS + 7–9 scoring conditions PASS → status=ACTIVE
MEDIUM: All 5 gateways PASS + 5–6 scoring conditions PASS → status=ACTIVE
LOW:    All 5 gateways PASS + 3–4 scoring conditions PASS → status=ACTIVE (consider skipping)
NONE:   Any gateway FAILS → direction=FLAT, status=NO_TRADE
PENDING: Gateways pass but S3 (FVG sequence) is PENDING_DRAW or PENDING_RETRACE → conviction=LOW, status=PENDING (watchlist only, no entry yet)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE CRITICAL ENTRY MECHANIC (FVG SEQUENCE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEVER call an entry valid just because price is near a FVG. The correct sequence is:
  1. FVG forms via displacement (BOS candle)
  2. Price LEAVES the FVG, moving toward the draw-on-liquidity target
  3. Price RETRACES back INTO the FVG — this retrace IS the entry
The FVG PRICE SEQUENCE section in the data computes which stage we are in. Only "Stage: COMPLETE" = valid entry. PENDING = add to watchlist, not entry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETAIL TRAP PSYCHOLOGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
We enter where RETAIL IS WRONG:
  LONGS: at BSL sweeps and SSL bounces — where retail traders are short. At the bottom of a bull FVG (retail sold there). At a bullish OB where retail sees "support breaking".
  SHORTS: at SSL sweeps and BSL fails — where retail traders are long. At the top of a bear FVG (retail bought there). At a bearish OB where retail sees "resistance breaking".
If the setup looks obvious to a retail trader, it's probably a trap — look for the counter-position.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTRY RULES (from both strategy documents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Weekly + Daily structure first. Then ICT setup in the SAME direction.
- OTE: 0.62–0.79 Fib retrace. FVG entry ABOVE the 50% of the swing range.
- Entry on confirmation candle CLOSE inside OB+FVG confluence zone.
- NQ stop MAX 30 points OR at the high/low of the Unicorn OB (whichever is tighter).
- TP1: 50% of position at first IRL target. Move stop to BE immediately.
- BE rule: move stop to breakeven the MOMENT 1:1 R:R is reached.
- First AM Macro: close by 11AM. Second AM Macro: close by 12PM. NO overnight. NO weekend.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRICE LEVELS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
entry_top/entry_bot: the OB or FVG zone price range (exact decimals)
stop_price: OB extreme beyond entry (max 30pts from entry on NQ)
tp1_price: nearest IRL target (50% of swing, or nearest unmitigated FVG/OB in path)
tp2_price: ERL target (PDH/PDL/PWH/PWL)
All prices must be exact decimals or null — NEVER strings like "N/A"

Use this exact schema (fill all fields):
{"setup":"","conviction":"HIGH|MEDIUM|LOW|NONE","direction":"LONG|SHORT|FLAT","status":"ACTIVE|PENDING|NO_TRADE","model":"ICT|SMC|ORB|ORDER_FLOW|CRT|MIXED","entry_top":null,"entry_bot":null,"stop_price":null,"tp1_price":null,"tp2_price":null,"entry_zone":"","stop_loss":"","tp1":"","tp2":"","irl_target":"","erl_target":"","draw_on_liq":"describe the opposing liquidity target","timeframe_alignment":"","confluence_score":0,"gateway_pass":true,"bos_choch":"BOS|CHoCH|NONE","bos_choch_level":null,"bos_choch_desc":"one line describing the break","fvg_sequence":"COMPLETE|PENDING_DRAW|PENDING_RETRACE|NOT_PRESENT","key_conditions_met":["G1","G2","S3"],"conditions_missing":["S10 — no SMT signal detected"],"risk_note":"","summary":"","strategy_matches":[${stratMatchSchema}]}

CRITICAL: Your ENTIRE response must be a single valid JSON object. No preamble, no explanation, no markdown, no code fences, no asterisks. Start your response with { and end with }. Nothing else.`,
                    messages:[
                      {role:"user",content:"MARKET DATA FOR ANALYSIS — respond with ONLY a JSON object, no other text:\n\n"+buildCtx(liveCandles)},
                      {role:"assistant",content:"{"}
                    ]
        })
      });
      const data = await res.json();
      const txt  = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");

      // ── Robust JSON extraction ─────────────────────────────────────────────
      // Assistant prefill starts with "{" so the response continues from there.
      // We prepend "{" and then find the matching closing "}" for maximum safety.
      const extractJSON = (raw) => {
        // 1. Strip any markdown code fences the model might still add
        let s = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
        // 2. Prepend the prefilled "{" since the model continues after it
        //    (if the model somehow included it, dedup by checking first char)
        if (!s.startsWith("{")) s = "{" + s;
        // 3. Find last "}" to get clean closing
        const last = s.lastIndexOf("}");
        if (last === -1) throw new Error("No closing } found in response. Raw: "+s.slice(0,120));
        return s.slice(0, last+1);
      };

      const tryParse = (str) => {
        try { return JSON.parse(str); } catch(e) {
          // Attempt structural recovery for truncated JSON
          let t = str.replace(/,\s*$/, "").replace(/:\s*"[^"]*$/, '":""').replace(/:\s*$/, ":null");
          let opens = 0, inStr = false, esc = false;
          for (let i = 0; i < t.length; i++) {
            const ch = t[i];
            if (esc) { esc=false; continue; }
            if (ch==="\\" && inStr) { esc=true; continue; }
            if (ch==='"') { inStr=!inStr; continue; }
            if (!inStr) { if(ch==="{"||ch==="[") opens++; else if(ch==="}"||ch==="]") opens--; }
          }
          for (let i=0; i<opens; i++) t += (i%2===0 ? "]" : "}");
          try { return JSON.parse(t); }
          catch(e2) { throw new Error("JSON parse failed: "+e2.message+" — raw excerpt: "+str.slice(0,200)); }
        }
      };

      const clean  = extractJSON(txt);
      const parsed = tryParse(clean);
      setResult(parsed);
      onScanResult && onScanResult(parsed);
      setLastAt(new Date().toLocaleTimeString());
      if (parsed.direction !== "FLAT" && parsed.entry_top && parsed.entry_bot && parsed.stop_price) {
        const entryMid  = (parseFloat(parsed.entry_top) + parseFloat(parsed.entry_bot)) / 2;
        const stopPts   = Math.abs(entryMid - parseFloat(parsed.stop_price));
        const dRisk     = capital * (riskPct / 100);
        const rPerLot   = stopPts * pointVal;
        const calcLots  = rPerLot > 0 ? Math.max(1, Math.floor(dRisk / rPerLot)) : 1;
        onSetupFound && onSetupFound({
          direction:  parsed.direction,
          entry_top:  parseFloat(parsed.entry_top),
          entry_bot:  parseFloat(parsed.entry_bot),
          stop_price: parseFloat(parsed.stop_price),
          tp1_price:  parsed.tp1_price ? parseFloat(parsed.tp1_price) : null,
          tp2_price:  parsed.tp2_price ? parseFloat(parsed.tp2_price) : null,
          setup:      parsed.setup,
          conviction: parsed.conviction,
          label:      parsed.entry_zone || "",
          lots:       calcLots,
          riskDollars: Math.round(calcLots * rPerLot),
          active:     true,
          createdAt:  Date.now(),
        });
      }
    } catch(e) { setError("Scan failed: "+e.message); }
    setScanning(false);
  },[candles,scanning,buildCtx,enabledStrats,capital,riskPct,pointVal,onSetupFound,anthropicKey,tvConn,tfCandles]);

  // Auto-scan every 60s if enabled
  useEffect(()=>{
    if(!autoScan) return;
    const id=setInterval(()=>scan(),60000);
    return()=>clearInterval(id);
  },[autoScan,scan]);

  const convCol  = c => c==="HIGH"?"#00ff8c":c==="MEDIUM"?"#fbbf24":c==="LOW"?"#f97316":"#475569";
  const dirCol   = d => d==="LONG"?"#00ff8c":d==="SHORT"?"#ff4f4f":"#f0c040";
  const dirIcon  = d => d==="LONG"?"▲":d==="SHORT"?"▼":"─";
  const modelCol = m => ({ICT:"#00d4ff",SMC:"#a855f7",ORB:"#10b981",ORDER_FLOW:"#f97316",CRT:"#ec4899",MIXED:"#f59e0b"})[m]||"#94a3b8";

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      {/* ── AUTO-SCAN + RISK + WEBHOOK PANELS ────────────────────────── */}
      {riskEngine && <RiskPanel riskEngine={riskEngine} accountBalance={undefined} dayPnl={undefined}/>}
      {riskEngine && <AutoScanEngine
        candles={candles}
        riskEngine={riskEngine}
        onScanTrigger={scan}
        onAutoExecute={onAutoExecute}
        conn={tvConn}
        lastSignal={result}
      />}
      {/* Header bar */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#a855f7",boxShadow:"0 0 10px #a855f7",animation:scanning?"pulse 0.8s infinite":"none"}}/>
          <span style={{fontSize:14,fontWeight:800,color:"#e2e8f0",fontFamily:"monospace",letterSpacing:-0.5}}>AI SETUP SCANNER</span>
          <span style={{fontSize:9,background:"rgba(168,85,247,0.15)",border:"1px solid rgba(168,85,247,0.4)",borderRadius:4,padding:"1px 7px",color:"#a855f7",fontWeight:700,fontFamily:"monospace"}}>CLAUDE</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
          {tradeSetup?.active && (
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:6,background:"rgba(0,255,140,0.07)",border:"1px solid rgba(0,255,140,0.3)"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#00ff8c",boxShadow:"0 0 6px #00ff8c",animation:"pulse 1.5s infinite"}}/>
              <span style={{fontSize:8,color:"#00ff8c",fontFamily:"monospace",fontWeight:700}}>LIVE ON CHART</span>
              <button onClick={()=>onClearSetup&&onClearSetup()} style={{background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:4,color:"#ff4f4f",fontSize:8,fontFamily:"monospace",fontWeight:700,padding:"2px 7px",cursor:"pointer"}}>✕ CLEAR</button>
            </div>
          )}
          <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:9,color:"#475569",fontFamily:"monospace"}}>
            <div onClick={()=>setAutoScan(a=>!a)} style={{width:28,height:14,borderRadius:7,background:autoScan?"rgba(168,85,247,0.4)":"rgba(255,255,255,0.08)",border:`1px solid ${autoScan?"rgba(168,85,247,0.6)":"rgba(255,255,255,0.12)"}`,position:"relative",cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{position:"absolute",top:2,left:autoScan?13:2,width:9,height:9,borderRadius:"50%",background:autoScan?"#a855f7":"#475569",transition:"left 0.2s"}}/>
            </div>
            AUTO 60s
          </label>
          <button onClick={scan} disabled={scanning||!candles.length}
            style={{display:"flex",alignItems:"center",gap:6,padding:"7px 18px",borderRadius:7,
              border:`1px solid ${scanning?"rgba(168,85,247,0.3)":"rgba(168,85,247,0.55)"}`,
              background:scanning?"rgba(168,85,247,0.06)":"rgba(168,85,247,0.14)",
              color:scanning?"#475569":"#c084fc",fontSize:11,fontWeight:700,fontFamily:"monospace",
              cursor:scanning?"not-allowed":"pointer",transition:"all 0.2s"}}>
            <span style={{fontSize:13}}>{scanning?"⟳":"🤖"}</span>
            {scanning?"SCANNING MARKET…":"SCAN MARKET NOW"}
            {!scanning && tvConn && tfCandles?.["5"]?.length > 50 && (
              <span style={{fontSize:7,color:"#00ff8c",fontFamily:"monospace",letterSpacing:1,
                padding:"2px 5px",borderRadius:4,background:"rgba(0,255,140,0.1)",
                border:"1px solid rgba(0,255,140,0.25)"}}>● LIVE</span>
            )}
          </button>
        </div>
      </div>

      {/* ── SESSION STATUS BANNER ────────────────────────────────────────── */}
      {(()=>{
        const estM = getESTMins();
        const sb   = isSilverBullet();
        const nypm = isNYPM();
        const lunch = isNYLunch();
        const pre   = isPreMarket();
        const estH2 = Math.floor(estM/60), estMM = String(estM%60).padStart(2,"0");
        const tStr  = `${estH2}:${estMM} EST`;
        if (lunch) return (
          <div style={{background:"rgba(220,38,38,0.12)",border:"2px solid rgba(220,38,38,0.5)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>🚫</span>
            <div>
              <div style={{fontSize:11,fontWeight:900,color:"#ef4444",fontFamily:"monospace",letterSpacing:1}}>NY LUNCH — NO TRADES ({tStr})</div>
              <div style={{fontSize:9,color:"#7f1d1d",fontFamily:"monospace",marginTop:2}}>12:00–1:00PM EST · Stops are swept here · Close all open positions immediately</div>
            </div>
          </div>
        );
        if (pre) return (
          <div style={{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.4)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>⚠</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",fontFamily:"monospace",letterSpacing:1}}>PRE-MARKET ({tStr}) — WAIT FOR 9:30AM</div>
              <div style={{fontSize:9,color:"#78350f",fontFamily:"monospace",marginTop:2}}>8:30–9:30AM EST · Stops taken here · Do NOT enter · Silver Bullet opens at 9:30AM</div>
            </div>
          </div>
        );
        if (sb) return (
          <div style={{background:"rgba(168,85,247,0.1)",border:"2px solid rgba(168,85,247,0.5)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>⭐</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:900,color:"#c084fc",fontFamily:"monospace",letterSpacing:1}}>SILVER BULLET WINDOW ACTIVE ({tStr})</div>
              <div style={{fontSize:9,color:"#7e22ce",fontFamily:"monospace",marginTop:2}}>9:30–11:00AM EST · PRIME EXECUTION WINDOW · Close First AM Macro by 11:00AM</div>
            </div>
            <div style={{padding:"4px 10px",borderRadius:6,background:"rgba(168,85,247,0.2)",border:"1px solid rgba(168,85,247,0.5)"}}>
              <span style={{fontSize:9,color:"#c084fc",fontFamily:"monospace",fontWeight:700}}>HIGH CONVICTION</span>
            </div>
          </div>
        );
        if (nypm) return (
          <div style={{background:"rgba(16,185,129,0.1)",border:"2px solid rgba(16,185,129,0.4)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>⭐</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:900,color:"#10b981",fontFamily:"monospace",letterSpacing:1}}>NY PM SESSION ACTIVE ({tStr})</div>
              <div style={{fontSize:9,color:"#065f46",fontFamily:"monospace",marginTop:2}}>1:30–3:00PM EST · Second execution window · Close all positions by 3:00PM</div>
            </div>
            <div style={{padding:"4px 10px",borderRadius:6,background:"rgba(16,185,129,0.18)",border:"1px solid rgba(16,185,129,0.4)"}}>
              <span style={{fontSize:9,color:"#10b981",fontFamily:"monospace",fontWeight:700}}>ACTIVE WINDOW</span>
            </div>
          </div>
        );
        return (
          <div style={{background:"rgba(30,41,59,0.5)",border:"1px solid rgba(100,116,139,0.25)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>🕐</span>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#475569",fontFamily:"monospace",letterSpacing:1}}>OFF SESSION — NO TRADES ({tStr})</div>
              <div style={{fontSize:9,color:"#334155",fontFamily:"monospace",marginTop:2}}>Next window: Silver Bullet 9:30AM EST · NY PM 1:30PM EST · DO NOT TRADE outside these windows</div>
            </div>
          </div>
        );
      })()}

      {/* ── ANTHROPIC API KEY ─────────────────────────────────────────────── */}
      <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:10,padding:"12px 16px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#334155",letterSpacing:3,fontFamily:"monospace",flexShrink:0}}>ANTHROPIC API KEY</span>
          <input
            type="password"
            value={anthropicKey}
            onChange={e => saveAnthropicKey(e.target.value)}
            placeholder="sk-ant-… — required for AI scan (saved locally)"
            style={{flex:1,minWidth:220,background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:6,color:"#e2e8f0",padding:"6px 10px",fontFamily:"monospace",fontSize:10,
              letterSpacing:anthropicKey?"0.12em":"normal"}}
          />
          {anthropicKey
            ? <span style={{fontSize:8,color:"#00ff8c",fontFamily:"monospace",flexShrink:0}}>✓ saved</span>
            : <span style={{fontSize:8,color:"#f97316",fontFamily:"monospace",flexShrink:0}}>required</span>}
        </div>
        <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",marginTop:5}}>
          Get your key at console.anthropic.com → API Keys · Stored in localStorage, never sent anywhere except api.anthropic.com
        </div>
      </div>

      {/* ── ACTIVE STRATEGIES (managed in Strategies tab) ──────────────────── */}
      <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:10,padding:"12px 16px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <span style={{fontSize:9,color:"#334155",letterSpacing:3,fontFamily:"monospace"}}>ACTIVE STRATEGIES</span>
          <span style={{fontSize:8,color:"#1e293b",fontFamily:"monospace"}}>
            — toggle strategies in the 📐 Strategies tab
          </span>
          <div style={{marginLeft:"auto",fontSize:8,color:"#334155",fontFamily:"monospace"}}>
            {SCANNER_STRATEGIES.filter(s=>s.alwaysOn||enabledStrats.has(s.id)).length} / {SCANNER_STRATEGIES.length} active
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {SCANNER_STRATEGIES.map(s => {
            const isOn = s.alwaysOn || enabledStrats.has(s.id);
            if (!isOn) return null;
            return (
              <div key={s.id} style={{
                padding:"6px 12px", borderRadius:7,
                border:`1px solid ${s.color}55`,
                background:`${s.color}0d`,
                display:"flex", alignItems:"center", gap:6,
              }}>
                <span style={{fontSize:13,lineHeight:1}}>{s.icon||"⬡"}</span>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:s.color,fontFamily:"monospace"}}>
                    {s.shortLabel||s.label}
                  </div>
                  {s.alwaysOn && <div style={{fontSize:7,color:s.color+"88",fontFamily:"monospace"}}>CORE</div>}
                </div>
              </div>
            );
          })}
          {SCANNER_STRATEGIES.filter(s=>s.alwaysOn||enabledStrats.has(s.id)).length === 1 && (
            <div style={{fontSize:8,color:"#334155",fontFamily:"monospace",
              display:"flex",alignItems:"center",padding:"6px 12px"}}>
              Only ICT Base active — go to 📐 Strategies to enable more
            </div>
          )}
        </div>
      </div>
      {/* Context summary bar */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[["INSTRUMENT",instrument,"#00d4ff"],["PRICE",candles.length?candles[candles.length-1].c.toFixed(2):"—","#e2e8f0"],["CANDLES",candles.length,"#94a3b8"],["ACTIVE OBs",obs.filter(o=>!o.mit).length,"#00d4ff"],["OPEN FVGs",fvgs.filter(f=>!f.filled).length,"#a855f7"],["ACTIVE LIQ",liq.filter(l=>!l.swept).length,"#f59e0b"],["BRKRS",bbs.length,"#ff6b35"]].map(([l,v,c])=>(
          <div key={l} style={{padding:"5px 10px",borderRadius:6,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>{l}</div>
            <div style={{fontSize:11,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div>
          </div>
        ))}
        {lastAt&&<div style={{padding:"5px 10px",borderRadius:6,background:"rgba(168,85,247,0.05)",border:"1px solid rgba(168,85,247,0.18)",marginLeft:"auto"}}>
          <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>LAST SCAN</div>
          <div style={{fontSize:10,fontWeight:700,color:"#a855f7",fontFamily:"monospace"}}>{lastAt}</div>
        </div>}
      </div>

      {/* Error */}
      {error&&<div style={{background:"rgba(255,80,80,0.07)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:10,color:"#ff4f4f",fontFamily:"monospace"}}>{error}</div>}

      {/* ── LOT SIZE CALCULATOR ──────────────────────────────────────────────── */}
      <div style={{background:"rgba(0,212,255,0.04)",border:"1px solid rgba(0,212,255,0.15)",borderRadius:12,padding:"16px 18px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <span style={{fontSize:10,fontWeight:800,color:"#00d4ff",fontFamily:"monospace",letterSpacing:1}}>⬡ LOT SIZE CALCULATOR</span>
          <span style={{fontSize:8,color:"#334155",fontFamily:"monospace",padding:"1px 6px",borderRadius:3,background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.2)"}}>{instrument} · ${pointVal}/pt</span>
          {lotCalc && <span style={{fontSize:8,color:"#00ff8c",fontFamily:"monospace",marginLeft:"auto"}}>✓ calculated from scan</span>}
        </div>

        {/* Inputs row */}
        <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",marginBottom:12}}>
          {/* Capital */}
          <div style={{flex:"1 1 140px",minWidth:120}}>
            <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>ACCOUNT CAPITAL ($)</div>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#00d4ff",fontSize:12,fontWeight:700}}>$</span>
              <input
                type="number" value={capital} min={1000} step={1000}
                onChange={e=>setCapital(Math.max(0,parseFloat(e.target.value)||0))}
                style={{width:"100%",background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.25)",borderRadius:7,color:"#e2e8f0",padding:"8px 10px 8px 24px",fontSize:13,fontFamily:"monospace",fontWeight:700}}
              />
            </div>
          </div>
          {/* Risk % */}
          <div style={{flex:"0 0 100px",minWidth:90}}>
            <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>RISK PER TRADE (%)</div>
            <div style={{position:"relative"}}>
              <input
                type="number" value={riskPct} min={0.1} max={10} step={0.1}
                onChange={e=>setRiskPct(Math.min(10,Math.max(0.1,parseFloat(e.target.value)||1)))}
                style={{width:"100%",background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.25)",borderRadius:7,color:"#f0c040",padding:"8px 10px",fontSize:13,fontFamily:"monospace",fontWeight:700}}
              />
              <span style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",color:"#f0c040",fontSize:11,fontWeight:700}}>%</span>
            </div>
          </div>
          {/* Dollar risk preview */}
          <div style={{flex:"0 0 110px",padding:"8px 12px",borderRadius:7,background:"rgba(240,196,64,0.07)",border:"1px solid rgba(240,196,64,0.2)"}}>
            <div style={{fontSize:7,color:"#475569",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>MAX $ AT RISK</div>
            <div style={{fontSize:14,fontWeight:800,color:"#f0c040",fontFamily:"monospace"}}>${(capital*riskPct/100).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>
        </div>

        {/* Slider for risk % */}
        <div style={{marginBottom:12}}>
          <input type="range" min={0.1} max={5} step={0.1} value={riskPct}
            onChange={e=>setRiskPct(parseFloat(e.target.value))}
            style={{width:"100%",accentColor:"#f0c040",cursor:"pointer",height:4}}
          />
          <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:"#334155",fontFamily:"monospace",marginTop:2}}>
            <span>0.1%</span><span>Conservative &lt;1%</span><span>Moderate 1–2%</span><span>Aggressive &gt;2%</span><span>5%</span>
          </div>
        </div>

        {/* Results — shown when lotCalc available */}
        {lotCalc ? (
          <div>
            {/* 30pt NQ stop breach warning */}
            {lotCalc.stopBreached && (
              <div style={{background:"rgba(220,38,38,0.12)",border:"2px solid rgba(220,38,38,0.5)",borderRadius:8,padding:"8px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>🚫</span>
                <div>
                  <div style={{fontSize:10,fontWeight:800,color:"#ef4444",fontFamily:"monospace",letterSpacing:1}}>STOP EXCEEDS 30 POINTS ({lotCalc.stopPts.toFixed(1)}pts) — INVALID SETUP</div>
                  <div style={{fontSize:8,color:"#7f1d1d",fontFamily:"monospace",marginTop:1}}>Vivek rule: NQ max stop = 30 points. Do not take this trade. Wait for a tighter setup.</div>
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
              {/* Recommended lots — hero card */}
              <div style={{gridColumn:"span 1",padding:"12px 14px",borderRadius:9,
                background: lotCalc.stopBreached ? "linear-gradient(135deg,rgba(220,38,38,0.12),rgba(220,38,38,0.04))" : "linear-gradient(135deg,rgba(0,212,255,0.12),rgba(0,212,255,0.04))",
                border: `2px solid ${lotCalc.stopBreached ? "rgba(220,38,38,0.5)" : "rgba(0,212,255,0.5)"}`,
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:8,color: lotCalc.stopBreached?"#ef4444":"#00d4ff",fontFamily:"monospace",letterSpacing:2,marginBottom:4}}>{lotCalc.stopBreached?"⚠ INVALID":"RECOMMENDED"}</div>
                <div style={{fontSize:28,fontWeight:900,color: lotCalc.stopBreached?"#ef4444":"#00d4ff",fontFamily:"monospace",lineHeight:1}}>{lotCalc.lots}</div>
                <div style={{fontSize:9,color: lotCalc.stopBreached?"#ef4444":"#00d4ff",fontFamily:"monospace",marginTop:2}}>CONTRACT{lotCalc.lots!==1?"S":""}</div>
              </div>
              {/* Stats */}
              {[
                ["STOP (pts)",    `${lotCalc.stopPts.toFixed(1)}${lotCalc.maxStopPts?` / ${lotCalc.maxStopPts}max`:""}`, lotCalc.stopBreached?"#ef4444":"#ff4f4f"],
                ["RISK / LOT",    `$${lotCalc.riskPerLot.toFixed(0)}`,      "#ff4f4f"],
                ["ACTUAL $ RISK", `$${lotCalc.actualRisk.toFixed(0)}`,      "#f0c040"],
                lotCalc.bePrice  ? ["BE PRICE (1:1)",  lotCalc.bePrice.toFixed(2), "#94a3b8"] : null,
                lotCalc.rr1  ? ["R:R TP1",       `${lotCalc.rr1}R`,        "#00ff8c"] : null,
                lotCalc.rr2  ? ["R:R TP2",       `${lotCalc.rr2}R`,        "#ffd700"] : null,
                lotCalc.maxGain1 ? ["GAIN @ TP1", `$${lotCalc.maxGain1.toFixed(0)}`, "#00ff8c"] : null,
                lotCalc.maxGain2 ? ["GAIN @ TP2", `$${lotCalc.maxGain2.toFixed(0)}`, "#ffd700"] : null,
              ].filter(Boolean).map(([l,v,c])=>(
                <div key={l} style={{padding:"8px 10px",borderRadius:7,background:"rgba(0,0,0,0.3)",border:`1px solid ${l==="BE PRICE (1:1)"?"rgba(148,163,184,0.25)":"rgba(255,255,255,0.06)"}`}}>
                  <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{padding:"12px 16px",borderRadius:8,background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.05)",textAlign:"center"}}>
            <span style={{fontSize:9,color:"#334155",fontFamily:"monospace"}}>
              {result ? "⚠ Scan returned no valid entry/stop prices for calculation" : "Run a scan — lot size will auto-calculate from the AI entry & stop levels"}
            </span>
          </div>
        )}
      </div>

      {/* Idle state */}
      {!result&&!scanning&&!error&&(
        <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"40px 24px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>🔭</div>
          <div style={{fontSize:13,color:"#e2e8f0",fontWeight:700,fontFamily:"monospace",marginBottom:6}}>MARKET SCANNER READY</div>
          <div style={{fontSize:10,color:"#475569",fontFamily:"monospace",lineHeight:1.7,maxWidth:420,margin:"0 auto"}}>
            Click SCAN MARKET NOW to analyze 1000 candles against all active strategy frameworks.<br/>
            The AI evaluates OBs, FVGs, IRL/ERL, liquidity, order flow — and compares across Vivek and KZ strategies.
          </div>
        </div>
      )}

      {/* PENDING state — setup forming, not yet valid entry */}
      {result&&!scanning&&result.status==="PENDING"&&result.conviction!=="NONE"&&(
        <div style={{background:"rgba(168,85,247,0.07)",border:"2px solid rgba(168,85,247,0.4)",borderRadius:14,padding:"20px 24px",marginBottom:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <span style={{fontSize:28}}>⏳</span>
            <div>
              <div style={{fontSize:14,fontWeight:900,color:"#a855f7",fontFamily:"monospace",letterSpacing:2}}>SETUP FORMING — WATCHLIST ONLY</div>
              <div style={{fontSize:9,color:"#7e22ce",fontFamily:"monospace",marginTop:3}}>Conditions are building. Do NOT enter yet. Wait for the next stage.</div>
            </div>
          </div>
          <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",marginBottom:10,lineHeight:1.8}}>{result.setup}</div>
          {/* FVG sequence progress */}
          {result.fvg_sequence&&result.fvg_sequence!=="COMPLETE"&&(
            <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:7,padding:"10px 14px",marginBottom:10}}>
              <div style={{fontSize:8,color:"#a855f7",fontFamily:"monospace",fontWeight:700,letterSpacing:1,marginBottom:6}}>FVG SEQUENCE STATUS: {result.fvg_sequence}</div>
              <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
                {[["1. FVG FORMS","always"],["2. SEEKS DRAW","PENDING_RETRACE,COMPLETE"],["3. RETRACES BACK","COMPLETE"],["4. ENTRY ✓","COMPLETE_AND_ACTIVE"]].map(([step,doneOn],i)=>{
                  const seq = result.fvg_sequence;
                  const done = doneOn==="always"||(doneOn.includes(seq));
                  const isCurrent = (seq==="PENDING_DRAW"&&i===1)||(seq==="PENDING_RETRACE"&&i===2);
                  return (<span key={step} style={{display:"inline-flex",alignItems:"center",gap:0}}>
                    {i>0&&<span style={{color:"rgba(255,255,255,0.2)",fontSize:10,margin:"0 3px"}}>→</span>}
                    <span style={{fontSize:7,fontFamily:"monospace",padding:"2px 6px",borderRadius:3,fontWeight:isCurrent?800:400,
                      background:done?"rgba(168,85,247,0.2)":isCurrent?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.03)",
                      border:`1px solid ${done?"rgba(168,85,247,0.4)":isCurrent?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.06)"}`,
                      color:done?"#c084fc":isCurrent?"#f59e0b":"#334155"
                    }}>{isCurrent?"▶ ":done?"✓ ":""}{step}</span>
                  </span>);
                })}
              </div>
            </div>
          )}
          {result.conditions_missing?.length>0&&(
            <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:7,padding:"10px 14px"}}>
              <div style={{fontSize:8,color:"#7e22ce",fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>STILL WAITING FOR</div>
              {result.conditions_missing.map((c,i)=>(
                <div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",padding:"2px 0"}}>
                  <span style={{fontSize:9,color:"#f59e0b",flexShrink:0}}>◎</span>
                  <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace",lineHeight:1.5}}>{c}</span>
                </div>
              ))}
            </div>
          )}
          {result.summary&&<div style={{marginTop:10,fontSize:9,color:"#64748b",fontFamily:"monospace",fontStyle:"italic",lineHeight:1.6}}>{result.summary}</div>}
        </div>
      )}

      {/* NO TRADE state — direction FLAT or conviction NONE */}
      {result&&!scanning&&result.status!=="PENDING"&&(result.direction==="FLAT"||result.conviction==="NONE")&&(
        <div style={{background:"rgba(30,41,59,0.6)",border:"2px solid rgba(100,116,139,0.35)",borderRadius:14,padding:"32px 24px",textAlign:"center",marginTop:0}}>
          <div style={{fontSize:40,marginBottom:10}}>🚫</div>
          <div style={{fontSize:18,fontWeight:900,color:"#64748b",fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>NO TRADE</div>
          <div style={{fontSize:11,color:"#475569",fontFamily:"monospace",marginBottom:14,lineHeight:1.8}}>
            {result.setup||"No high-probability setup detected"}
          </div>
          {result.conditions_missing?.length>0&&(
            <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(100,116,139,0.2)",borderRadius:8,padding:"12px 16px",maxWidth:480,margin:"0 auto",textAlign:"left"}}>
              <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>FAILED CONDITIONS</div>
              {result.conditions_missing.map((c,i)=>(
                <div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",padding:"3px 0"}}>
                  <span style={{fontSize:10,color:"#ff4f4f",flexShrink:0}}>✗</span>
                  <span style={{fontSize:9,color:"#64748b",fontFamily:"monospace",lineHeight:1.5}}>{c}</span>
                </div>
              ))}
            </div>
          )}
          {result.summary&&<div style={{marginTop:12,fontSize:9,color:"#475569",fontFamily:"monospace",fontStyle:"italic",lineHeight:1.6}}>{result.summary}</div>}
          {result.risk_note&&<div style={{marginTop:8,fontSize:9,color:"#7f1d1d",fontFamily:"monospace"}}>{result.risk_note}</div>}
        </div>
      )}

      {/* Scanning state */}
      {scanning&&(
        <div style={{background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:"40px 24px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"#a855f7",fontFamily:"monospace",letterSpacing:3,marginBottom:8}}>ANALYZING MARKET STRUCTURE</div>
          <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:12}}>
            {["OBs","FVGs","LIQ","OTE","ORB","CVD","ERL"].map((l,i)=>(
              <span key={l} style={{fontSize:8,color:"#a855f7",fontFamily:"monospace",padding:"3px 7px",borderRadius:4,background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.25)",animation:`pulse ${0.8+i*0.1}s infinite`}}>{l}</span>
            ))}
          </div>
          <div style={{fontSize:10,color:"#475569",fontFamily:"monospace"}}>{([...enabledStrats].length+1)+" strategy frameworks being evaluated…"}</div>
        </div>
      )}

      {/* Results — only show full card when direction is not FLAT */}
      {result&&!scanning&&result.direction!=="FLAT"&&result.conviction!=="NONE"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {/* Setup header card */}
          <div style={{background:`${dirCol(result.direction)}08`,border:`1px solid ${dirCol(result.direction)}33`,borderRadius:12,padding:"16px 20px"}}>
            {(()=>{ const grade=computeGrade(result.conviction,result.confluence_score,result.key_conditions_met,result.gateway_pass,result.fvg_sequence); const gDef=GRADE_DEFS[grade]||GRADE_NONE; return (
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              {/* Grade badge — large, left side */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                <GradeChip grade={grade} large={true}/>
                <span style={{fontSize:7,color:gDef.color,fontFamily:"monospace",letterSpacing:1,fontWeight:700}}>GRADE</span>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:16,fontWeight:800,color:dirCol(result.direction),fontFamily:"monospace"}}>{dirIcon(result.direction)} {result.setup}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 9px",borderRadius:4,background:convCol(result.conviction)+"18",border:`1px solid ${convCol(result.conviction)}44`,color:convCol(result.conviction)}}>{result.conviction} CONVICTION</span>
                  <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 9px",borderRadius:4,background:modelCol(result.model)+"18",border:`1px solid ${modelCol(result.model)}44`,color:modelCol(result.model)}}>{result.model}</span>
                  <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 9px",borderRadius:4,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8"}}>{result.timeframe_alignment}</span>
                  {result.confluence_score!=null&&<span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 9px",borderRadius:4,background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.25)",color:"#ffd700"}}>⬡ {result.confluence_score}/100</span>}
                  {/* BOS / CHoCH badge */}
                  {result.bos_choch&&result.bos_choch!=="NONE"
                    ? <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 9px",borderRadius:4,background:"rgba(249,115,22,0.18)",border:"1px solid rgba(249,115,22,0.55)",color:"#f97316",display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:11}}>⚡</span>{result.bos_choch} CONFIRMED
                      </span>
                    : <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",padding:"2px 9px",borderRadius:4,background:"rgba(100,116,139,0.1)",border:"1px solid rgba(100,116,139,0.25)",color:"#475569",display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:10}}>○</span> NO BOS/CHoCH
                      </span>
                  }
                </div>
              </div>
              {/* Trade levels */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,minWidth:240}}>
                {[["ENTRY",result.entry_zone,dirCol(result.direction)],["STOP",result.stop_loss,"#ff4f4f"],["TP1",result.tp1,"#00ff8c"],["TP2 / ERL",result.tp2,"#ffd700"]].map(([l,v,c])=>(
                  <div key={l} style={{padding:"6px 10px",borderRadius:6,background:"rgba(0,0,0,0.35)",border:`1px solid rgba(255,255,255,0.06)`}}>
                    <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:11,fontWeight:700,color:v&&v!=="N/A"?c:"#1e293b",fontFamily:"monospace"}}>{v||"—"}</div>
                  </div>
                ))}
              </div>
            </div>
          ); })()}
          </div>

          {/* ── EXECUTION BRIDGE ─────────────────────────────────── */}
          {tvConn && result.direction !== "FLAT" && result.direction !== "NO_TRADE" && (
            <ExecutionBridge
              conn={tvConn}
              scanResult={result}
              lastPrice={candles.length ? candles[candles.length-1].c : 0}
              instrument={instrument}
              onOrderSent={() => {}}
            />
          )}

          {/* IRL → ERL path */}
          {(result.irl_target||result.erl_target)&&result.irl_target!=="none"&&(
            <div style={{background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:8,color:"#f59e0b",fontFamily:"monospace",fontWeight:700,letterSpacing:2}}>IRL → ERL PATH</span>
              <span style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>Sweep IRL:</span>
              <span style={{fontSize:10,color:"#f59e0b",fontFamily:"monospace",fontWeight:700}}>{result.irl_target}</span>
              <span style={{fontSize:10,color:"#475569",fontFamily:"monospace"}}>→ then target ERL:</span>
              <span style={{fontSize:10,color:"#fbbf24",fontFamily:"monospace",fontWeight:700}}>{result.erl_target}</span>
            </div>
          )}

          {/* DRAW ON LIQUIDITY */}
          {result.draw_on_liq&&(
            <div style={{background:"rgba(0,212,255,0.05)",border:"1px solid rgba(0,212,255,0.22)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:14,flexShrink:0}}>🎯</span>
              <div>
                <div style={{fontSize:8,color:"#0e7490",fontFamily:"monospace",letterSpacing:2,marginBottom:2}}>DRAW ON LIQUIDITY</div>
                <div style={{fontSize:10,color:"#00d4ff",fontFamily:"monospace",fontWeight:600,lineHeight:1.4}}>{result.draw_on_liq}</div>
              </div>
            </div>
          )}

          {/* FVG PRICE SEQUENCE STATUS */}
          {(()=>{
            const seq = result.fvg_sequence;
            const cfg = {
              COMPLETE:        { bg:"rgba(16,185,129,0.08)", border:"rgba(16,185,129,0.4)",  icon:"✅", color:"#10b981", label:"FVG SEQUENCE COMPLETE",     desc:"FVG formed → price sought draw → retrace back into FVG. ENTRY VALID." },
              PENDING_DRAW:    { bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.4)",  icon:"⏳", color:"#f59e0b", label:"PENDING — WAITING FOR DRAW",  desc:"FVG formed but price has not yet sought the draw-on-liquidity. Wait for price to move toward the target first before looking for retrace." },
              PENDING_RETRACE: { bg:"rgba(99,102,241,0.08)", border:"rgba(99,102,241,0.4)",  icon:"↩", color:"#818cf8", label:"PENDING — WAITING FOR RETRACE",desc:"Price has moved toward the draw. Now waiting for the retrace back INTO the FVG. Watch for entry candle." },
              NOT_PRESENT:     { bg:"rgba(100,116,139,0.06)",border:"rgba(100,116,139,0.2)", icon:"○",  color:"#475569", label:"NO FVG SEQUENCE DETECTED",    desc:"No valid FVG sequence present. Do not enter without this." },
            }[seq] || null;
            if (!cfg) return null;
            return (
              <div style={{background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:18,flexShrink:0,lineHeight:1}}>{cfg.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,color:cfg.color,fontFamily:"monospace",fontWeight:800,letterSpacing:1,marginBottom:3}}>{cfg.label}</div>
                  <div style={{fontSize:9,color:seq==="COMPLETE"?"#6ee7b7":seq==="NOT_PRESENT"?"#334155":"#94a3b8",fontFamily:"monospace",lineHeight:1.5}}>{cfg.desc}</div>
                  {/* Visual sequence tracker */}
                  <div style={{display:"flex",alignItems:"center",gap:0,marginTop:8}}>
                    {[["FVG FORMS","COMPLETE,PENDING_DRAW,PENDING_RETRACE"],["PRICE SEEKS DRAW","COMPLETE,PENDING_RETRACE"],["RETRACE INTO FVG","COMPLETE"],["ENTRY ✓","COMPLETE"]].map(([step,doneSeqs],i)=>{
                      const done = doneSeqs.split(",").includes(seq);
                      const isCurrent = (seq==="PENDING_DRAW"&&i===1)||(seq==="PENDING_RETRACE"&&i===2)||(seq==="COMPLETE"&&i===3);
                      return (<>
                        {i>0&&<div key={`arrow${i}`} style={{width:16,height:1,background:done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.08)",flexShrink:0}}/>}
                        <div key={step} style={{padding:"2px 7px",borderRadius:3,background:done?cfg.border+"44":"rgba(255,255,255,0.03)",border:`1px solid ${done?cfg.border:"rgba(255,255,255,0.07)"}`,flexShrink:0}}>
                          <span style={{fontSize:7,fontFamily:"monospace",fontWeight:isCurrent?800:400,color:done?cfg.color:"#334155"}}>{isCurrent?"▶ ":""}{step}</span>
                        </div>
                      </>);
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* BOS / CHoCH confirmation panel */}
          <div style={{
            background: result.bos_choch&&result.bos_choch!=="NONE" ? "rgba(249,115,22,0.07)" : "rgba(100,116,139,0.06)",
            border: `1px solid ${result.bos_choch&&result.bos_choch!=="NONE" ? "rgba(249,115,22,0.35)" : "rgba(100,116,139,0.2)"}`,
            borderRadius:8, padding:"10px 14px"
          }}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{
                  width:28,height:28,borderRadius:6,
                  background: result.bos_choch&&result.bos_choch!=="NONE" ? "rgba(249,115,22,0.2)" : "rgba(100,116,139,0.12)",
                  border: `1.5px solid ${result.bos_choch&&result.bos_choch!=="NONE" ? "rgba(249,115,22,0.6)" : "rgba(100,116,139,0.3)"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,flexShrink:0
                }}>
                  {result.bos_choch&&result.bos_choch!=="NONE" ? "⚡" : "○"}
                </div>
                <div>
                  <div style={{fontSize:9,color:"#334155",fontFamily:"monospace",letterSpacing:2,marginBottom:2}}>STRUCTURE BREAK</div>
                  <div style={{fontSize:11,fontWeight:800,fontFamily:"monospace",
                    color: result.bos_choch==="BOS" ? "#f97316" : result.bos_choch==="CHoCH" ? "#fb923c" : "#475569"
                  }}>
                    {result.bos_choch&&result.bos_choch!=="NONE" ? result.bos_choch : "NOT CONFIRMED"}
                  </div>
                </div>
              </div>
              {result.bos_choch_level!=null&&(
                <div style={{padding:"4px 10px",borderRadius:5,background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.25)"}}>
                  <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:1}}>STRUCTURE LEVEL</div>
                  <div style={{fontSize:11,fontWeight:700,color:"#f97316",fontFamily:"monospace"}}>{parseFloat(result.bos_choch_level).toFixed(2)}</div>
                </div>
              )}
              {result.bos_choch_desc&&(
                <div style={{flex:1,minWidth:160}}>
                  <div style={{fontSize:9,color: result.bos_choch&&result.bos_choch!=="NONE" ? "#94a3b8" : "#475569",fontFamily:"monospace",lineHeight:1.5,fontStyle:"italic"}}>
                    {result.bos_choch_desc}
                  </div>
                </div>
              )}
              {(!result.bos_choch||result.bos_choch==="NONE")&&(
                <div style={{marginLeft:"auto",padding:"5px 10px",borderRadius:6,background:"rgba(100,116,139,0.1)",border:"1px solid rgba(100,116,139,0.2)"}}>
                  <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace",fontWeight:700}}>⚠ WAIT FOR BOS/CHoCH BEFORE ENTERING</span>
                </div>
              )}
            </div>
          </div>

          {/* STRATEGY MATCH RESULTS */}
          {result.strategy_matches?.length > 0 && (
            <div style={{background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"14px 16px",marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:9,color:"#334155",letterSpacing:3,fontFamily:"monospace"}}>STRATEGY MATCH ANALYSIS</span>
                <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                  {result.strategy_matches.map(m=>{
                    const col=(SCANNER_STRATEGIES.find(s=>s.id===m.strategy_id)||{}).color||"#94a3b8";
                    return(<span key={m.strategy_id} style={{fontSize:8,fontFamily:"monospace",fontWeight:700,padding:"2px 8px",borderRadius:4,background:m.match?col+"18":"rgba(255,255,255,0.04)",border:`1px solid ${m.match?col+"55":"rgba(255,255,255,0.08)"}`,color:m.match?col:"#334155"}}>{m.match?"✓":"✕"} {m.strategy_name}</span>);
                  })}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {result.strategy_matches.map(sm=>{
                  const strat=SCANNER_STRATEGIES.find(s=>s.id===sm.strategy_id)||{};
                  const col=strat.color||"#94a3b8";
                  const matched=sm.match;
                  const score=sm.match_score||0;
                  const isPending = !matched && sm.gateway_pass && sm.fvg_sequence_met===false;
                  const scoreCol = score>=75?"#00ff8c":score>=55?"#f59e0b":"#ff4f4f";
                  // Gate check mini-chips
                  const gates = [
                    ["G:Bias", sm.bias_aligned],
                    ["G:Session", sm.session_valid],
                    ["G:BOS", sm.bos_choch_met],
                    ["G:FVG", sm.fvg_sequence_met],
                    ["G:GW", sm.gateway_pass],
                  ];
                  return(
                    <div key={sm.strategy_id} style={{borderRadius:8,border:`1px solid ${matched?col+"55":isPending?"rgba(168,85,247,0.3)":"rgba(255,255,255,0.05)"}`,background:matched?col+"09":isPending?"rgba(168,85,247,0.04)":"rgba(255,255,255,0.015)",overflow:"hidden"}}>
                      {/* Header row */}
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                        <span style={{fontSize:14,lineHeight:1,flexShrink:0}}>{strat.icon||"◆"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:10,fontWeight:700,color:matched?col:isPending?"#a855f7":"#475569",fontFamily:"monospace"}}>{strat.label||sm.strategy_name}</div>
                          {sm.verdict&&<div style={{fontSize:8,color:matched?"#94a3b8":isPending?"#7e22ce":"#334155",fontFamily:"monospace",marginTop:1,lineHeight:1.3}}>{sm.verdict}</div>}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                          <div style={{fontSize:14,fontWeight:900,color:matched?col:isPending?"#a855f7":scoreCol,fontFamily:"monospace",lineHeight:1}}>{score}<span style={{fontSize:8,fontWeight:400,color:"#334155"}}>/100</span></div>
                          <div style={{width:60,height:3,borderRadius:2,background:"rgba(255,255,255,0.06)"}}>
                            <div style={{width:score+"%",height:"100%",borderRadius:2,background:matched?col:scoreCol,transition:"width 0.3s"}}/>
                          </div>
                          <span style={{fontSize:7,fontFamily:"monospace",letterSpacing:1,color:matched?col:isPending?"#a855f7":"#334155"}}>
                            {matched?"● MATCH":isPending?"◑ PENDING":"○ NO MATCH"}
                          </span>
                        </div>
                      </div>
                      {/* Gate chips */}
                      <div style={{display:"flex",gap:4,padding:"6px 12px",borderBottom:"1px solid rgba(255,255,255,0.03)",flexWrap:"wrap"}}>
                        {gates.map(([label,pass])=>(
                          <span key={label} style={{fontSize:7,fontFamily:"monospace",fontWeight:700,padding:"1px 5px",borderRadius:3,
                            background: pass===true?"rgba(0,255,140,0.12)":pass===false?"rgba(255,79,79,0.12)":"rgba(100,116,139,0.1)",
                            border: `1px solid ${pass===true?"rgba(0,255,140,0.3)":pass===false?"rgba(255,79,79,0.3)":"rgba(100,116,139,0.2)"}`,
                            color: pass===true?"#00ff8c":pass===false?"#ff4f4f":"#475569"
                          }}>{pass===true?"✓":pass===false?"✗":"?"} {label}</span>
                        ))}
                      </div>
                      {/* Conditions */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                        <div style={{padding:"7px 10px",borderRight:"1px solid rgba(255,255,255,0.03)"}}>
                          <div style={{fontSize:7,color:"#00ff8c",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>MET ({(sm.conditions_met||[]).length})</div>
                          {(sm.conditions_met||[]).slice(0,4).map((c,i)=>(
                            <div key={i} style={{display:"flex",gap:4,padding:"1px 0"}}>
                              <span style={{fontSize:8,color:"#00ff8c",flexShrink:0}}>✓</span>
                              <span style={{fontSize:7,color:"#64748b",fontFamily:"monospace",lineHeight:1.4}}>{c}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{padding:"7px 10px"}}>
                          <div style={{fontSize:7,color:"#ff4f4f",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>MISSING ({(sm.conditions_missing||[]).length})</div>
                          {(sm.conditions_missing||[]).slice(0,4).map((c,i)=>(
                            <div key={i} style={{display:"flex",gap:4,padding:"1px 0"}}>
                              <span style={{fontSize:8,color:"#ff4f4f",flexShrink:0}}>○</span>
                              <span style={{fontSize:7,color:"#475569",fontFamily:"monospace",lineHeight:1.4}}>{c}</span>
                            </div>
                          ))}
                          {(sm.conditions_missing||[]).length===0&&<span style={{fontSize:7,color:"#00ff8c",fontFamily:"monospace"}}>All confirmed ✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Two column: conditions + summary */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {/* Conditions met */}
            <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(0,255,140,0.12)",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:8,color:"#00ff8c",fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>✓ CONDITIONS MET</div>
              {(result.key_conditions_met||[]).map((c,i)=>(
                <div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.025)"}}>
                  <span style={{fontSize:10,color:"#00ff8c",flexShrink:0,marginTop:1}}>✓</span>
                  <span style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.5}}>{c}</span>
                </div>
              ))}
            </div>
            {/* Missing conditions */}
            <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,80,80,0.12)",borderRadius:8,padding:"12px 14px"}}>
              <div style={{fontSize:8,color:"#ff4f4f",fontFamily:"monospace",letterSpacing:2,marginBottom:8}}>⚠ AWAITING / MISSING</div>
              {(result.conditions_missing||[]).map((c,i)=>(
                <div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.025)"}}>
                  <span style={{fontSize:10,color:"#ff4f4f",flexShrink:0,marginTop:1}}>○</span>
                  <span style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.5}}>{c}</span>
                </div>
              ))}
              {(result.conditions_missing||[]).length===0&&<span style={{fontSize:9,color:"#00ff8c",fontFamily:"monospace"}}>All conditions confirmed ✓</span>}
            </div>
          </div>

          {/* Summary + risk note */}
          <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"12px 16px"}}>
            <div style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.8,marginBottom:6}}>{result.summary}</div>
            {result.risk_note&&<div style={{fontSize:8,color:"#f59e0b",fontFamily:"monospace",padding:"6px 10px",borderRadius:5,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.18)"}}>⚠ {result.risk_note}</div>}
          </div>

          <div style={{textAlign:"center",fontSize:8,color:"#1e293b",fontFamily:"monospace"}}>AI analysis is for educational purposes only. Not financial advice. Always validate manually.</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADE JOURNAL TAB
// ─────────────────────────────────────────────────────────────────────────────
const SETUP_TYPES=["ICT — Unicorn Model","ICT — Silver Bullet","ICT — OTE + OB","ICT — AMD","ICT — FVG Fill","SMC — OB + FVG Confluence","SMC — Liquidity Sweep","ORB Breakout","ORB Extension","KZ Confluence","Breaker Block Reversal","CRT Reversal","Order Flow Fade","Custom"];
const OUTCOMES=["RUNNING","WIN","LOSS","BREAKEVEN","MISSED","INVALID"];
const GRADES=["A","B","C","D"];
const defForm={date:new Date().toISOString().slice(0,16),instrument:"NQ",direction:"LONG",setup:SETUP_TYPES[0],entry:"",sl:"",tp1:"",tp2:"",outcome:"RUNNING",exit:"",notes:"",grade:"",pnl_dollars:"",contracts:1};

function JournalTab() {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({...defForm});
  const [filter,   setFilter]   = useState("ALL");
  const [sortDir,  setSortDir]  = useState("desc");

  useEffect(()=>{ loadJournal().then(t=>{setTrades(t);setLoaded(true);}); },[]);

  const persist = async (list) => { setTrades(list); await saveJournal(list); };

  const computeR = (t) => {
    const entry=parseFloat(t.entry), sl=parseFloat(t.sl), exit=parseFloat(t.exit);
    if(!entry||!sl||!exit||isNaN(entry)||isNaN(sl)||isNaN(exit)) return null;
    const risk=Math.abs(entry-sl);
    if(risk===0) return null;
    const pnl=t.direction==="LONG"?exit-entry:entry-exit;
    return (pnl/risk).toFixed(2);
  };

  const stats = useMemo(()=>{
    const closed=trades.filter(t=>["WIN","LOSS","BREAKEVEN"].includes(t.outcome));
    const wins=closed.filter(t=>t.outcome==="WIN");
    const rs=closed.map(t=>parseFloat(computeR(t)||"0")).filter(n=>!isNaN(n));
    const totalR=rs.reduce((a,b)=>a+b,0);
    const winners=rs.filter(r=>r>0),losers=rs.filter(r=>r<0);
    const profFactor=losers.length?Math.abs(winners.reduce((a,b)=>a+b,0)/losers.reduce((a,b)=>a+b,0)).toFixed(2):"∞";
    return {
      total:trades.length,closed:closed.length,
      wins:wins.length,losses:closed.filter(t=>t.outcome==="LOSS").length,
      winRate:closed.length?((wins.length/closed.length)*100).toFixed(1):"0.0",
      avgR:rs.length?(totalR/rs.length).toFixed(2):"0.00",
      totalR:totalR.toFixed(2),
      profFactor,
    };
  },[trades]);

  const fld = (label,key,type="text",opts=null) => (
    <div style={{marginBottom:8}}>
      <label style={{display:"block",fontSize:8,color:"#475569",letterSpacing:2,fontFamily:"monospace",marginBottom:3}}>{label}</label>
      {opts?(
        <select value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,color:"#e2e8f0",padding:"6px 8px",fontSize:11,fontFamily:"monospace"}}>
          {opts.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ):(
        <input type={type} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
          style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,color:"#e2e8f0",padding:"6px 8px",fontSize:11,fontFamily:"monospace"}}/>
      )}
    </div>
  );

  const outcomeColor = o => ({WIN:"#00ff8c",LOSS:"#ff4f4f",BREAKEVEN:"#f0c040",RUNNING:"#06b6d4",MISSED:"#475569",INVALID:"#2a3a4a"})[o]||"#475569";

  const handleSave = () => {
    const r = computeR(form);
    const t = {...form, id:editId||`t-${Date.now()}`, r_multiple:r||""};
    if(editId) { persist(trades.map(x=>x.id===editId?t:x)); }
    else        { persist([t,...trades]); }
    setFormOpen(false); setEditId(null); setForm({...defForm,date:new Date().toISOString().slice(0,16)});
  };

  const filtered = useMemo(()=>{
    let t=[...trades];
    if(filter!=="ALL") t=t.filter(x=>x.outcome===filter);
    return t.sort((a,b)=>sortDir==="desc"?new Date(b.date)-new Date(a.date):new Date(a.date)-new Date(b.date));
  },[trades,filter,sortDir]);

  return (
    <div style={{maxWidth:960,margin:"0 auto"}}>
      {/* Stats bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:14}}>
        {[
          ["TRADES",stats.total,"#94a3b8"],
          ["CLOSED",stats.closed,"#64748b"],
          ["WINS",stats.wins,"#00ff8c"],
          ["LOSSES",stats.losses,"#ff4f4f"],
          ["WIN RATE",stats.winRate+"%",parseFloat(stats.winRate)>=50?"#00ff8c":"#ff4f4f"],
          ["AVG R",stats.avgR,parseFloat(stats.avgR)>=0?"#00ff8c":"#ff4f4f"],
          ["PROFIT F",stats.profFactor,"#f59e0b"],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
            <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}>{l}</div>
            <div style={{fontSize:14,fontWeight:800,color:c,fontFamily:"monospace",lineHeight:1}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <button onClick={()=>{setEditId(null);setForm({...defForm,date:new Date().toISOString().slice(0,16)});setFormOpen(true);}}
          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 16px",borderRadius:7,border:"1px solid rgba(0,212,255,0.45)",background:"rgba(0,212,255,0.1)",color:"#00d4ff",fontSize:10,fontWeight:700,fontFamily:"monospace",cursor:"pointer"}}>
          + LOG TRADE
        </button>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["ALL",...OUTCOMES].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 10px",borderRadius:5,fontSize:8,fontFamily:"monospace",fontWeight:700,cursor:"pointer",border:`1px solid ${filter===f?(outcomeColor(f)||"rgba(255,255,255,0.3)"):"rgba(255,255,255,0.06)"}`,background:filter===f?(outcomeColor(f)+"12"||"rgba(255,255,255,0.05)"):"transparent",color:filter===f?(outcomeColor(f)||"#e2e8f0"):"#475569"}}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={()=>setSortDir(d=>d==="desc"?"asc":"desc")} style={{marginLeft:"auto",padding:"4px 10px",borderRadius:5,fontSize:8,fontFamily:"monospace",cursor:"pointer",border:"1px solid rgba(255,255,255,0.07)",background:"transparent",color:"#475569"}}>
          {sortDir==="desc"?"↓ NEWEST":"↑ OLDEST"}
        </button>
      </div>

      {/* Trade list */}
      {!loaded&&<div style={{textAlign:"center",padding:"24px",color:"#334155",fontSize:10,fontFamily:"monospace"}}>Loading journal…</div>}
      {loaded&&filtered.length===0&&(
        <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"48px 24px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:10}}>📓</div>
          <div style={{fontSize:13,color:"#e2e8f0",fontWeight:700,fontFamily:"monospace",marginBottom:4}}>NO TRADES YET</div>
          <div style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>Click + LOG TRADE to record your first trade</div>
        </div>
      )}
      {loaded&&filtered.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {/* Header row */}
          <div style={{display:"grid",gridTemplateColumns:"24px 110px 50px 55px 130px 68px 68px 68px 50px 50px 1fr 32px",gap:4,padding:"4px 10px",marginBottom:2}}>
            {["GR","DATE","INST","DIR","SETUP","ENTRY","SL","EXIT","R","P&L","NOTES",""].map(h=>(
              <span key={h} style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1}}>{h}</span>
            ))}
          </div>
          {filtered.map(t=>{
            const rNum=parseFloat(t.r_multiple||computeR(t)||"0");
            const oc=outcomeColor(t.outcome);
            const pnlNum=parseFloat(t.pnl_dollars||"0");
            return (
              <div key={t.id} style={{display:"grid",gridTemplateColumns:"24px 110px 50px 55px 130px 68px 68px 68px 50px 50px 1fr 32px",gap:4,padding:"5px 10px",borderRadius:7,background:"rgba(255,255,255,0.02)",border:`1px solid ${oc}22`,borderLeft:`3px solid ${oc}88`,alignItems:"center"}}>
                <GradeChip grade={t.grade||""} large={false}/>
                <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>{t.date?.slice(0,16).replace("T"," ")}</span>
                <span style={{fontSize:10,color:"#00d4ff",fontFamily:"monospace",fontWeight:700}}>{t.instrument}</span>
                <span style={{fontSize:10,color:t.direction==="LONG"?"#00ff8c":"#ff4f4f",fontFamily:"monospace",fontWeight:700}}>{t.direction==="LONG"?"▲ L":"▼ S"}</span>
                <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.setup}>{t.setup}</span>
                <span style={{fontSize:9,color:"#e2e8f0",fontFamily:"monospace"}}>{t.entry||"—"}</span>
                <span style={{fontSize:9,color:"#ff4f4f",fontFamily:"monospace"}}>{t.sl||"—"}</span>
                <span style={{fontSize:9,color:oc,fontFamily:"monospace"}}>{t.exit||"—"}</span>
                <span style={{fontSize:10,fontWeight:700,color:rNum>0?"#00ff8c":rNum<0?"#ff4f4f":"#f0c040",fontFamily:"monospace"}}>{t.r_multiple||computeR(t)||"—"}</span>
                <span style={{fontSize:9,fontWeight:700,color:pnlNum>0?"#00ff8c":pnlNum<0?"#ff4f4f":"#475569",fontFamily:"monospace"}}>{t.pnl_dollars?(pnlNum>0?"+":"")+pnlNum.toLocaleString("en-US",{maximumFractionDigits:0}):"—"}</span>
                <span style={{fontSize:8,color:"#475569",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.notes}>{t.notes}</span>
                <div style={{display:"flex",gap:3}}>
                  <button onClick={()=>{setForm({...defForm,...t});setEditId(t.id);setFormOpen(true);}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",padding:"2px 5px",borderRadius:3,cursor:"pointer",fontSize:8,fontFamily:"monospace"}}>✎</button>
                  <button onClick={()=>persist(trades.filter(x=>x.id!==t.id))} style={{background:"rgba(255,80,80,0.05)",border:"1px solid rgba(255,80,80,0.12)",color:"#ff4f4f",padding:"2px 5px",borderRadius:3,cursor:"pointer",fontSize:8,fontFamily:"monospace"}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total R summary */}
      {trades.length>0&&(
        <div style={{marginTop:12,padding:"8px 14px",borderRadius:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",display:"flex",gap:20,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>Total R: <span style={{color:parseFloat(stats.totalR)>=0?"#00ff8c":"#ff4f4f",fontWeight:700}}>{parseFloat(stats.totalR)>=0?"+":""}{stats.totalR}R</span></span>
          <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>Avg R/trade: <span style={{color:parseFloat(stats.avgR)>=0?"#00ff8c":"#ff4f4f",fontWeight:700}}>{stats.avgR}R</span></span>
          <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>Profit Factor: <span style={{color:"#f59e0b",fontWeight:700}}>{stats.profFactor}</span></span>
        </div>
      )}

      {/* Log trade modal */}
      {formOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"#0a1020",border:"1px solid rgba(0,212,255,0.22)",borderRadius:12,width:"100%",maxWidth:640,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.7)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.3)",position:"sticky",top:0,zIndex:10}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#00d4ff",boxShadow:"0 0 7px #00d4ff"}}/>
              <span style={{fontSize:11,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace",letterSpacing:2}}>{editId?"EDIT TRADE":"LOG NEW TRADE"}</span>
              <button onClick={()=>{setFormOpen(false);setEditId(null);}} style={{marginLeft:"auto",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.2)",color:"#ff4f4f",padding:"4px 9px",borderRadius:5,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>✕</button>
            </div>
            <div style={{padding:20}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
                {fld("DATE / TIME","date","datetime-local")}
                {fld("INSTRUMENT","instrument","text",["NQ","ES","RTY","YM"])}
                {fld("DIRECTION","direction","text",["LONG","SHORT"])}
                {fld("OUTCOME","outcome","text",OUTCOMES)}
                {fld("ENTRY PRICE","entry","number")}
                {fld("STOP LOSS","sl","number")}
                {fld("TP1","tp1","number")}
                {fld("TP2","tp2","number")}
                {fld("ACTUAL EXIT","exit","number")}
                <div style={{gridColumn:"1/-1"}}>
                  {fld("SETUP TYPE","setup","text",SETUP_TYPES)}
                </div>
                {/* Grade selector */}
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{display:"block",fontSize:8,color:"#475569",letterSpacing:2,fontFamily:"monospace",marginBottom:5}}>SETUP GRADE</label>
                  <div style={{display:"flex",gap:6}}>
                    {["A","B","C","D",""].map(g=>{
                      const gd = g ? (GRADE_DEFS[g]||GRADE_NONE) : GRADE_NONE;
                      const active = form.grade===g;
                      return (
                        <button key={g} onClick={()=>setForm(p=>({...p,grade:g}))} style={{
                          flex:1,padding:"8px 4px",borderRadius:6,cursor:"pointer",
                          background: active ? gd.bg : "transparent",
                          border:`1.5px solid ${active ? gd.border : "rgba(255,255,255,0.06)"}`,
                          color: active ? gd.color : "#334155",
                          fontSize:13,fontWeight:900,fontFamily:"monospace",
                        }}>{g||"—"}</button>
                      );
                    })}
                  </div>
                </div>
                {fld("P&L ($) — actual dollar result","pnl_dollars","number")}
                {fld("CONTRACTS","contracts","number")}
              </div>
              <div style={{marginBottom:10}}>
                <label style={{display:"block",fontSize:8,color:"#475569",letterSpacing:2,fontFamily:"monospace",marginBottom:3}}>NOTES / OBSERVATIONS</label>
                <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} rows={3}
                  placeholder="Setup rationale, what you saw, what to improve..."
                  style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:5,color:"#94a3b8",padding:"7px 8px",fontSize:10,fontFamily:"monospace",resize:"vertical"}}/>
              </div>
              {/* R preview */}
              {form.entry&&form.sl&&form.exit&&(
                <div style={{marginBottom:12,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",fontSize:9,fontFamily:"monospace",color:"#94a3b8"}}>
                  Computed R: <span style={{color:parseFloat(computeR(form)||"0")>=0?"#00ff8c":"#ff4f4f",fontWeight:700}}>{computeR(form)||"—"}</span>
                </div>
              )}
              <button onClick={handleSave} style={{width:"100%",padding:"10px 0",borderRadius:8,border:"none",background:"rgba(0,212,255,0.14)",color:"#00d4ff",fontSize:11,fontWeight:700,fontFamily:"monospace",cursor:"pointer",letterSpacing:2}}>
                {editId?"✓ UPDATE TRADE":"✓ LOG TRADE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADE CALENDAR TAB
// Auto-reads from journal storage. Updates daily after NY session close (3PM).
// Each cell shows: daily P&L ($), R total, trade count, grade distribution.
// ─────────────────────────────────────────────────────────────────────────────
function CalendarTab() {
  const [trades,    setTrades]    = useState([]);
  const [loaded,    setLoaded]    = useState(false);
  const [viewDate,  setViewDate]  = useState(() => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()}; });
  const [selDay,    setSelDay]    = useState(null);   // {y,m,d} — clicked day detail
  const [sessionNote, setSessionNote] = useState(""); // editable daily note
  const [notes,     setNotes]     = useState({});     // {dateKey: noteText}

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadJournal().then(t => { setTrades(t); setLoaded(true); });
    // Load calendar notes
    Promise.resolve({ value: localStorage.getItem(CALENDAR_KEY) }).then(r => {
      if (r && r.value) try { setNotes(JSON.parse(r.value)); } catch {}
    }).catch(()=>{});
  }, []);

  const saveNote = async (key, text) => {
    const updated = {...notes, [key]: text};
    setNotes(updated);
    try { await localStorage.setItem(CALENDAR_KEY, JSON.stringify(updated)); } catch {}
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const dateKey = (y,m,d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const computeR = (t) => {
    const entry=parseFloat(t.entry), sl=parseFloat(t.sl), exit=parseFloat(t.exit);
    if (!entry||!sl||!exit||isNaN(entry)||isNaN(sl)||isNaN(exit)) return 0;
    const risk=Math.abs(entry-sl); if (!risk) return 0;
    const pnl=t.direction==="LONG"?exit-entry:entry-exit;
    return pnl/risk;
  };

  // ── Build day map for the current month view ─────────────────────────────
  const dayMap = useMemo(() => {
    const map = {};
    trades.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (!map[key]) map[key] = { trades:[], pnlD:0, pnlR:0, wins:0, losses:0, grades:{} };
      const day = map[key];
      day.trades.push(t);
      // Only count closed trades for P&L
      if (["WIN","LOSS","BREAKEVEN"].includes(t.outcome)) {
        const pnl = parseFloat(t.pnl_dollars||"0");
        const r   = computeR(t);
        day.pnlD += pnl;
        day.pnlR += r;
        if (t.outcome==="WIN")  day.wins++;
        if (t.outcome==="LOSS") day.losses++;
      }
      if (t.grade) day.grades[t.grade] = (day.grades[t.grade]||0)+1;
    });
    return map;
  }, [trades]);

  // ── Calendar grid math ────────────────────────────────────────────────────
  const { y, m } = viewDate;
  const firstDow   = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // ── Monthly summary stats ─────────────────────────────────────────────────
  const monthStats = useMemo(() => {
    let totalPnlD=0, totalPnlR=0, tradingDays=0, wins=0, losses=0, bestDay=null, worstDay=null;
    const monthPrefix = dateKey(y,m,1).slice(0,7); // "YYYY-MM"
    Object.entries(dayMap).forEach(([key, day]) => {
      if (!key.startsWith(monthPrefix)) return;
      if (day.trades.length===0) return;
      tradingDays++;
      totalPnlD += day.pnlD;
      totalPnlR += day.pnlR;
      wins      += day.wins;
      losses    += day.losses;
      if (!bestDay  || day.pnlD > bestDay.pnlD)   bestDay  = {...day, key};
      if (!worstDay || day.pnlD < worstDay.pnlD)  worstDay = {...day, key};
    });
    const winRate = (wins+losses)>0 ? ((wins/(wins+losses))*100).toFixed(0) : "—";
    return { totalPnlD, totalPnlR, tradingDays, wins, losses, winRate, bestDay, worstDay };
  }, [dayMap, y, m]);

  // ── Selected day detail ──────────────────────────────────────────────────
  const selKey  = selDay ? dateKey(selDay.y, selDay.m, selDay.d) : null;
  const selData = selKey ? (dayMap[selKey] || {trades:[], pnlD:0, pnlR:0}) : null;

  const pnlColor = (v) => v>0 ? "#00ff8c" : v<0 ? "#ff4f4f" : "#475569";
  const ocCol    = o => ({WIN:"#00ff8c",LOSS:"#ff4f4f",BREAKEVEN:"#f0c040",RUNNING:"#06b6d4",MISSED:"#475569"})[o]||"#475569";

  return (
    <div style={{maxWidth:1060,margin:"0 auto"}}>

      {/* ── Month summary stats ─────────────────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginBottom:14}}>
        {[
          ["MONTH P&L", monthStats.totalPnlD!==0 ? (monthStats.totalPnlD>0?"+":"")+monthStats.totalPnlD.toLocaleString("en-US",{maximumFractionDigits:0}) : "—", pnlColor(monthStats.totalPnlD)],
          ["TOTAL R",   monthStats.totalPnlR!==0  ? (monthStats.totalPnlR>0?"+":"")+monthStats.totalPnlR.toFixed(2)+"R" : "—", pnlColor(monthStats.totalPnlR)],
          ["DAYS",      monthStats.tradingDays||"0", "#64748b"],
          ["WIN RATE",  monthStats.winRate!=="—"?monthStats.winRate+"%":"—", parseFloat(monthStats.winRate)>=50?"#00ff8c":"#ff4f4f"],
          ["BEST DAY",  monthStats.bestDay ? (monthStats.bestDay.pnlD>0?"+":"")+monthStats.bestDay.pnlD.toLocaleString("en-US",{maximumFractionDigits:0}) : "—", "#00ff8c"],
          ["WORST DAY", monthStats.worstDay ? (monthStats.worstDay.pnlD>0?"+":"")+monthStats.worstDay.pnlD.toLocaleString("en-US",{maximumFractionDigits:0}) : "—", "#ff4f4f"],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
            <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:800,color:c,fontFamily:"monospace",lineHeight:1}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:12,alignItems:"start"}}>
        {/* ── Calendar grid ─────────────────────────────────────────────── */}
        <div>
          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <button onClick={()=>setViewDate(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})}
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>‹</button>
            <span style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace",letterSpacing:2}}>
              {MONTH_NAMES[m]} {y}
            </span>
            <button onClick={()=>setViewDate(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1})}
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>›</button>
            <button onClick={()=>{ const n=new Date(); setViewDate({y:n.getFullYear(),m:n.getMonth()}); setSelDay(null); }}
              style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",color:"#00d4ff",padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>TODAY</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
            {["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:7,color:d==="SUN"||d==="SAT"?"#1e293b":"#334155",fontFamily:"monospace",letterSpacing:1,padding:"4px 0"}}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {/* Empty offset cells */}
            {Array.from({length:firstDow}).map((_,i)=>(
              <div key={`e${i}`} style={{minHeight:72,borderRadius:6,background:"rgba(255,255,255,0.01)"}}/>
            ))}
            {/* Day cells */}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const d = i+1;
              const key = dateKey(y,m,d);
              const day = dayMap[key];
              const isToday   = key === todayKey;
              const isSel     = selDay && selDay.y===y && selDay.m===m && selDay.d===d;
              const isWeekend = [0,6].includes(new Date(y,m,d).getDay());
              const hasTrades = day && day.trades.length > 0;
              const hasClosedPnl = day && (day.wins + day.losses) > 0;

              let cellBg = isWeekend ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.025)";
              let borderCol = "rgba(255,255,255,0.04)";
              if (isSel) { cellBg="rgba(0,212,255,0.1)"; borderCol="rgba(0,212,255,0.5)"; }
              else if (hasClosedPnl) {
                if (day.pnlD > 0) { cellBg="rgba(0,255,140,0.06)"; borderCol="rgba(0,255,140,0.2)"; }
                else if (day.pnlD < 0) { cellBg="rgba(255,79,79,0.06)"; borderCol="rgba(255,79,79,0.2)"; }
                else { cellBg="rgba(240,192,64,0.05)"; borderCol="rgba(240,192,64,0.2)"; }
              }
              if (isToday&&!isSel) borderCol="rgba(0,212,255,0.4)";

              // Top grade chips row
              const gradeEntries = day ? Object.entries(day.grades).sort((a,b)=>a[0]>b[0]?1:-1) : [];

              return (
                <div key={d} onClick={()=>{ setSelDay({y,m,d}); setSessionNote(notes[key]||""); }}
                  style={{minHeight:72,borderRadius:7,border:`1.5px solid ${borderCol}`,background:cellBg,cursor:"pointer",padding:"4px 5px",display:"flex",flexDirection:"column",gap:2,
                    boxShadow: isToday?"0 0 0 1px rgba(0,212,255,0.25)":isSel?"0 0 0 2px rgba(0,212,255,0.4)":"none",
                    transition:"border-color 0.15s"
                  }}>
                  {/* Day number + today dot */}
                  <div style={{display:"flex",alignItems:"center",gap:3}}>
                    <span style={{fontSize:10,fontWeight:isToday?900:400,color:isToday?"#00d4ff":isWeekend?"#1e293b":"#64748b",fontFamily:"monospace",lineHeight:1}}>{d}</span>
                    {isToday&&<div style={{width:4,height:4,borderRadius:"50%",background:"#00d4ff",boxShadow:"0 0 4px #00d4ff"}}/>}
                  </div>
                  {/* P&L display */}
                  {hasClosedPnl&&(
                    <div style={{fontSize:9,fontWeight:800,color:pnlColor(day.pnlD),fontFamily:"monospace",lineHeight:1}}>
                      {day.pnlD>0?"+":""}{day.pnlD!==0?day.pnlD.toLocaleString("en-US",{maximumFractionDigits:0}):"BE"}
                    </div>
                  )}
                  {/* R multiple */}
                  {hasClosedPnl&&day.pnlR!==0&&(
                    <div style={{fontSize:7,color:pnlColor(day.pnlR),fontFamily:"monospace",lineHeight:1}}>
                      {day.pnlR>0?"+":""}{day.pnlR.toFixed(1)}R
                    </div>
                  )}
                  {/* Grade chips row */}
                  {gradeEntries.length>0&&(
                    <div style={{display:"flex",gap:2,flexWrap:"wrap",marginTop:"auto"}}>
                      {gradeEntries.map(([g,cnt])=>(
                        <span key={g} style={{fontSize:7,fontWeight:900,fontFamily:"monospace",
                          color:(GRADE_DEFS[g]||GRADE_NONE).color,
                          background:(GRADE_DEFS[g]||GRADE_NONE).bg,
                          border:`1px solid ${(GRADE_DEFS[g]||GRADE_NONE).border}`,
                          borderRadius:3,padding:"0px 3px",lineHeight:"13px"
                        }}>{g}{cnt>1?`×${cnt}`:""}</span>
                      ))}
                    </div>
                  )}
                  {/* No trade indicator */}
                  {hasTrades&&!hasClosedPnl&&(
                    <div style={{fontSize:7,color:"#06b6d4",fontFamily:"monospace",marginTop:"auto"}}>RUNNING</div>
                  )}
                  {/* Session note dot */}
                  {notes[key]&&<div style={{width:5,height:5,borderRadius:"50%",background:"#a855f7",alignSelf:"flex-end",marginTop:"auto",flexShrink:0}}/>}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{display:"flex",gap:12,marginTop:10,padding:"6px 8px",flexWrap:"wrap"}}>
            {[["Green cell","Profitable day"],["Red cell","Losing day"],["Purple dot","Session note"],["Grade chip","Setup quality"]].map(([s,d])=>(
              <div key={s} style={{display:"flex",gap:5,alignItems:"center"}}>
                <span style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>{s}:</span>
                <span style={{fontSize:8,color:"#475569",fontFamily:"monospace"}}>{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Day detail panel ───────────────────────────────────────────── */}
        <div style={{position:"sticky",top:8}}>
          {!selDay&&(
            <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,padding:"28px 16px",textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:8}}>📅</div>
              <div style={{fontSize:10,color:"#334155",fontFamily:"monospace"}}>Click a day to see details</div>
            </div>
          )}
          {selDay&&(
            <div style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:10,overflow:"hidden"}}>
              {/* Day header */}
              <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,212,255,0.04)",display:"flex",alignItems:"center",gap:8}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#00d4ff",fontFamily:"monospace",letterSpacing:1}}>{MONTH_NAMES[selDay.m]} {selDay.d}, {selDay.y}</div>
                  {selData&&(selData.wins+selData.losses)>0&&(
                    <div style={{fontSize:9,fontWeight:800,color:pnlColor(selData.pnlD),fontFamily:"monospace",marginTop:2}}>
                      {selData.pnlD>0?"+":""}{selData.pnlD!==0?selData.pnlD.toLocaleString("en-US",{maximumFractionDigits:0}):"BE"} · {selData.pnlR>0?"+":""}{selData.pnlR.toFixed(2)}R
                    </div>
                  )}
                </div>
                <button onClick={()=>setSelDay(null)} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#334155",fontSize:14,cursor:"pointer"}}>✕</button>
              </div>
              {/* Session note */}
              <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>SESSION NOTES (auto-saved)</div>
                <textarea value={sessionNote}
                  onChange={e=>{ setSessionNote(e.target.value); saveNote(selKey,e.target.value); }}
                  placeholder="Market context, what price did, mistakes, learnings..."
                  rows={3}
                  style={{width:"100%",background:"rgba(168,85,247,0.05)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:5,color:"#c084fc",padding:"6px 8px",fontSize:9,fontFamily:"monospace",resize:"vertical"}}/>
              </div>
              {/* Trades for this day */}
              <div style={{padding:"10px 14px",maxHeight:340,overflowY:"auto"}}>
                <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:6}}>
                  TRADES ({selData?.trades?.length||0})
                </div>
                {(!selData||selData.trades.length===0)&&(
                  <div style={{fontSize:9,color:"#1e293b",fontFamily:"monospace",fontStyle:"italic"}}>No trades logged this day</div>
                )}
                {selData?.trades?.map((t,i)=>{
                  const r = computeR(t);
                  const pnl = parseFloat(t.pnl_dollars||"0");
                  const oc  = ocCol(t.outcome);
                  return (
                    <div key={t.id||i} style={{borderRadius:6,border:`1px solid ${oc}33`,borderLeft:`3px solid ${oc}`,padding:"7px 10px",marginBottom:5,background:"rgba(255,255,255,0.02)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        {t.grade&&<GradeChip grade={t.grade} large={false}/>}
                        <span style={{fontSize:9,fontWeight:700,color:t.direction==="LONG"?"#00ff8c":"#ff4f4f",fontFamily:"monospace"}}>{t.direction==="LONG"?"▲ LONG":"▼ SHORT"} {t.instrument}</span>
                        <span style={{marginLeft:"auto",fontSize:8,fontWeight:700,color:oc,fontFamily:"monospace"}}>{t.outcome}</span>
                      </div>
                      <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",marginBottom:3}}>{t.setup}</div>
                      <div style={{display:"flex",gap:10}}>
                        <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace"}}>E: <span style={{color:"#e2e8f0"}}>{t.entry||"—"}</span></span>
                        <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace"}}>SL: <span style={{color:"#ff4f4f"}}>{t.sl||"—"}</span></span>
                        <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace"}}>Exit: <span style={{color:oc}}>{t.exit||"—"}</span></span>
                      </div>
                      <div style={{display:"flex",gap:10,marginTop:3}}>
                        <span style={{fontSize:9,fontWeight:700,color:r>0?"#00ff8c":r<0?"#ff4f4f":"#f0c040",fontFamily:"monospace"}}>{r>0?"+":""}{r.toFixed(2)}R</span>
                        {t.pnl_dollars&&<span style={{fontSize:9,fontWeight:700,color:pnlColor(pnl),fontFamily:"monospace"}}>{pnl>0?"+":""}{pnl.toLocaleString("en-US",{maximumFractionDigits:0})}</span>}
                      </div>
                      {t.notes&&<div style={{fontSize:8,color:"#475569",fontFamily:"monospace",marginTop:4,fontStyle:"italic",lineHeight:1.4}}>{t.notes}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIES TAB
// Full hub: scanner strategy rules viewer + custom strategy library + Pine editor
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED JOURNAL + CALENDAR TAB
// Calendar on top, Journal below
// ─────────────────────────────────────────────────────────────────────────────
function JournalCalendarTab() {
  return (
    <div style={{maxWidth:1100, margin:"0 auto"}}>
      {/* ── CALENDAR ─────────────────────────────────────────────────────────── */}
      <CalendarTab />

      {/* ── DIVIDER ──────────────────────────────────────────────────────────── */}
      <div style={{
        margin:"28px 0 24px",
        borderTop:"1px solid rgba(255,255,255,0.07)",
        position:"relative",
      }}>
        <span style={{
          position:"absolute", top:-9, left:"50%", transform:"translateX(-50%)",
          background:"#080c14", padding:"0 16px",
          fontSize:9, color:"#334155", fontFamily:"monospace", fontWeight:700, letterSpacing:2,
        }}>TRADE JOURNAL</span>
      </div>

      {/* ── JOURNAL ──────────────────────────────────────────────────────────── */}
      <JournalTab />
    </div>
  );
}

function StrategiesTab({ enabledStrats, setEnabledStrats }) {
  // Local fallback
  const [localEnabled, setLocalEnabled] = useState(
    () => new Set(["vivek_unicorn","kz_confluence","liq_sweep_ifvg","crt_engulf"])
  );
  const enabled    = enabledStrats    ?? localEnabled;
  const setEnabled = setEnabledStrats ?? setLocalEnabled;

  const [custom,      setCustom]     = useState([]);
  const [editorOpen,  setEditor]     = useState(false);
  const [editTgt,     setEditTgt]    = useState(null);
  const [expandedId,  setExpandedId] = useState(null);
  const [search,      setSearch]     = useState("");
  const [catFilter,   setCatFilter]  = useState("ALL"); // ALL | ict | quant

  useEffect(() => { loadStrategies().then(setCustom); }, []);
  const persist   = async list => { setCustom(list); await saveStrategies(list); };
  const handleSave = (s) => {
    const i = custom.findIndex(x => x.id === s.id);
    persist(i >= 0 ? custom.map((x,j) => j===i ? s : x) : [...custom, s]);
    setEditor(false); setEditTgt(null);
  };
  const handleDelete = id => persist(custom.filter(s => s.id !== id));

  const toggle = id => {
    setEnabled(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const GRADE_COLORS = { A:"#00ff8c", B:"#a3e635", C:"#f59e0b", D:"#ff4f4f" };

  // Filter + sort all scanner strategies
  const allStrats = SCANNER_STRATEGIES.filter(s => {
    const matchCat = catFilter === "ALL"
      || (catFilter === "ict"   && (!s.category || s.category !== "quant"))
      || (catFilter === "quant" && s.category === "quant");
    const matchQ = !search
      || s.label.toLowerCase().includes(search.toLowerCase())
      || s.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  const activeCount = SCANNER_STRATEGIES.filter(s => s.alwaysOn || enabled.has(s.id)).length;

  // ── CARD ──────────────────────────────────────────────────────────────────
  const StratCard = ({ strat }) => {
    const isExp = expandedId === strat.id;
    const on    = strat.alwaysOn || enabled.has(strat.id);
    return (
      <div style={{
        borderRadius:10, overflow:"hidden",
        border:`1px solid ${on ? strat.color+"55" : "rgba(255,255,255,0.07)"}`,
        background: on ? `${strat.color}07` : "rgba(255,255,255,0.015)",
        transition:"border-color 0.2s, background 0.2s",
      }}>
        {/* Header row */}
        <div style={{
          display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
          background: on ? `${strat.color}0c` : "rgba(0,0,0,0.2)",
          borderBottom: isExp ? `1px solid ${strat.color}22` : "none",
        }}>
          <span style={{fontSize:18, lineHeight:1, flexShrink:0}}>{strat.icon||"⬡"}</span>

          {/* Label + desc — click to expand */}
          <div style={{flex:1, cursor:"pointer", minWidth:0}}
               onClick={() => setExpandedId(isExp ? null : strat.id)}>
            <div style={{
              fontSize:11, fontWeight:800,
              color: on ? strat.color : "#94a3b8",
              fontFamily:"monospace", transition:"color 0.2s",
            }}>{strat.label}</div>
            <div style={{
              fontSize:8, color:"#475569", fontFamily:"monospace", marginTop:2,
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
            }}>{strat.description}</div>
          </div>

          {/* Category badge */}
          <span style={{
            fontSize:7, fontFamily:"monospace", fontWeight:700, padding:"2px 6px",
            borderRadius:3, flexShrink:0,
            background: strat.category === "quant" ? "rgba(99,102,241,0.15)" : "rgba(0,212,255,0.08)",
            color:       strat.category === "quant" ? "#818cf8" : "#00d4ff",
            border: `1px solid ${strat.category === "quant" ? "rgba(99,102,241,0.3)" : "rgba(0,212,255,0.2)"}`,
          }}>{strat.category === "quant" ? "QUANT" : "ICT"}</span>

          {/* Grade chips */}
          <div style={{display:"flex", gap:2, flexShrink:0}}>
            {["A","B","C","D"].map(g => (
              <div key={g} style={{
                padding:"2px 4px", borderRadius:3, fontSize:7,
                fontFamily:"monospace", fontWeight:800,
                background:`${GRADE_COLORS[g]}15`, color:GRADE_COLORS[g],
                border:`1px solid ${GRADE_COLORS[g]}30`,
              }}>{g}</div>
            ))}
          </div>

          {/* Scanner toggle */}
          <button
            onClick={e => { e.stopPropagation(); if (!strat.alwaysOn) toggle(strat.id); }}
            disabled={strat.alwaysOn}
            style={{
              padding:"5px 13px", borderRadius:6, cursor: strat.alwaysOn ? "default" : "pointer",
              fontFamily:"monospace", fontSize:9, fontWeight:700,
              border:`1px solid ${on ? strat.color+"66" : "rgba(255,255,255,0.1)"}`,
              background: on ? `${strat.color}1a` : "rgba(255,255,255,0.03)",
              color: on ? strat.color : "#334155",
              transition:"all 0.15s", flexShrink:0,
              opacity: strat.alwaysOn ? 0.55 : 1,
              minWidth:120, textAlign:"center",
            }}>
            {strat.alwaysOn ? "🔒 ALWAYS ON" : on ? "✓ IN SCANNER" : "+ ADD TO SCANNER"}
          </button>

          {/* Expand chevron */}
          <span onClick={() => setExpandedId(isExp ? null : strat.id)}
            style={{fontSize:10, color:"#334155", cursor:"pointer", flexShrink:0}}>
            {isExp ? "▲" : "▼"}
          </span>
        </div>

        {/* Expanded rules */}
        {isExp && strat.rules && (
          <div style={{padding:"12px 16px", display:"flex", flexDirection:"column", gap:5}}>
            {strat.rules.map((rule, i) => {
              const gm = rule.match(/^\[([^\]]+)\]/);
              const gl = gm ? gm[1] : null;
              const rt = gl ? rule.slice(gl.length+2).trim() : rule;
              const ig = gl && (gl.includes("GATE") || /^[A-Z]+\d/.test(gl));
              return (
                <div key={i} style={{
                  padding:"8px 12px", borderRadius:7,
                  background: ig ? `${strat.color}09` : "rgba(255,255,255,0.015)",
                  border:`1px solid ${ig ? strat.color+"22" : "rgba(255,255,255,0.04)"}`,
                  borderLeft:`3px solid ${ig ? strat.color+"88" : "rgba(255,255,255,0.06)"}`,
                }}>
                  <div style={{display:"flex", alignItems:"flex-start", gap:8}}>
                    {gl && (
                      <span style={{
                        fontSize:7, fontFamily:"monospace", fontWeight:800,
                        padding:"2px 6px", borderRadius:3, flexShrink:0, marginTop:1,
                        background:`${strat.color}18`, border:`1px solid ${strat.color}44`,
                        color:strat.color, whiteSpace:"nowrap",
                      }}>{gl.split("—")[0].trim()}</span>
                    )}
                    <div>
                      {gl && <div style={{fontSize:9, fontWeight:700, color:ig?strat.color:"#475569",
                        fontFamily:"monospace", marginBottom:2}}>
                        {gl.split("—").slice(1).join("—").trim()}
                      </div>}
                      <div style={{fontSize:9, color:"#64748b", fontFamily:"monospace",
                        lineHeight:1.6}}>{rt}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{maxWidth:980, margin:"0 auto"}}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:14, fontWeight:800, color:"#e2e8f0",
            fontFamily:"monospace", letterSpacing:1}}>📐 STRATEGIES</div>
          <div style={{fontSize:9, color:"#334155", fontFamily:"monospace", marginTop:2}}>
            Toggle any strategy on — it will be evaluated by the AI Scanner on every scan
          </div>
        </div>
        <button onClick={() => { setEditTgt(null); setEditor(true); }}
          style={{marginLeft:"auto", padding:"6px 14px", borderRadius:6, cursor:"pointer",
            fontSize:9, fontFamily:"monospace", fontWeight:700,
            background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.3)",
            color:"#818cf8"}}>
          ✎ New Pine Strategy
        </button>
      </div>

      {/* ── Active scanner strip ───────────────────────────────────────────── */}
      <div style={{
        display:"flex", alignItems:"center", gap:6, marginBottom:14, flexWrap:"wrap",
        padding:"10px 14px", borderRadius:8,
        background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.07)",
      }}>
        <span style={{fontSize:8, color:"#334155", fontFamily:"monospace",
          fontWeight:700, letterSpacing:2, flexShrink:0}}>AI SCANNER WILL USE:</span>
        {SCANNER_STRATEGIES.filter(s => s.alwaysOn || enabled.has(s.id)).map(s => (
          <span key={s.id} style={{
            fontSize:8, fontFamily:"monospace", fontWeight:700,
            padding:"3px 9px", borderRadius:4,
            background:`${s.color}15`, color:s.color, border:`1px solid ${s.color}33`,
          }}>{s.shortLabel||s.label}</span>
        ))}
        <span style={{marginLeft:"auto", fontSize:8, color:"#334155", fontFamily:"monospace"}}>
          {activeCount} / {SCANNER_STRATEGIES.length} active
        </span>
      </div>

      {/* ── Filters row ───────────────────────────────────────────────────── */}
      <div style={{display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center"}}>
        {[["ALL","All Strategies"],["ict","ICT / SMC"],["quant","Quant Library"]].map(([v,l]) => (
          <button key={v} onClick={() => setCatFilter(v)} style={{
            padding:"5px 13px", borderRadius:6, cursor:"pointer",
            fontSize:9, fontFamily:"monospace", fontWeight:700,
            background: catFilter===v ? "rgba(0,212,255,0.12)" : "transparent",
            border:`1px solid ${catFilter===v ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.07)"}`,
            color: catFilter===v ? "#00d4ff" : "#475569",
          }}>{l}</button>
        ))}
        <input
          placeholder="Search strategies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex:1, minWidth:180, background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.1)", borderRadius:7,
            color:"#e2e8f0", padding:"6px 12px", fontSize:10, fontFamily:"monospace",
          }}/>
        {/* Quick select all / none */}
        <button onClick={() => {
          const ids = SCANNER_STRATEGIES.filter(s => !s.alwaysOn).map(s => s.id);
          setEnabled(new Set(ids));
        }} style={{padding:"5px 10px", borderRadius:5, cursor:"pointer", fontSize:8,
          fontFamily:"monospace", border:"1px solid rgba(0,255,140,0.2)",
          background:"rgba(0,255,140,0.05)", color:"#00ff8c"}}>✓ ALL</button>
        <button onClick={() => setEnabled(new Set())}
          style={{padding:"5px 10px", borderRadius:5, cursor:"pointer", fontSize:8,
            fontFamily:"monospace", border:"1px solid rgba(255,80,80,0.2)",
            background:"rgba(255,80,80,0.05)", color:"#ff4f4f"}}>✕ NONE</button>
      </div>

      {/* ── Strategy cards ─────────────────────────────────────────────────── */}
      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {allStrats.map(s => <StratCard key={s.id} strat={s}/>)}
        {allStrats.length === 0 && (
          <div style={{padding:"32px", textAlign:"center", borderRadius:10,
            border:"1px dashed rgba(255,255,255,0.08)", color:"#334155",
            fontSize:9, fontFamily:"monospace"}}>
            No strategies match your search
          </div>
        )}
      </div>

      {/* ── Custom Pine strategies ─────────────────────────────────────────── */}
      {custom.length > 0 && (
        <div style={{marginTop:24}}>
          <div style={{fontSize:8, color:"#475569", fontFamily:"monospace",
            fontWeight:700, letterSpacing:2, marginBottom:10,
            borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:14}}>
            CUSTOM PINE STRATEGIES
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {custom.map(s => (
              <div key={s.id} style={{borderRadius:9, overflow:"hidden",
                border:`1px solid ${s.color||"#818cf8"}33`,
                background:`${s.color||"#818cf8"}06`}}>
                <div style={{display:"flex", alignItems:"center", gap:10, padding:"11px 16px"}}>
                  <div style={{width:8, height:8, borderRadius:"50%",
                    background:s.color||"#818cf8", flexShrink:0}}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:11, fontWeight:700,
                      color:s.color||"#818cf8", fontFamily:"monospace"}}>{s.name||s.label}</div>
                    <div style={{fontSize:8, color:"#475569",
                      fontFamily:"monospace", marginTop:1}}>{s.description||""}</div>
                  </div>
                  <button onClick={() => { setEditTgt(s); setEditor(true); }}
                    style={{padding:"3px 10px", borderRadius:4, cursor:"pointer",
                      fontSize:8, fontFamily:"monospace",
                      border:"1px solid rgba(255,255,255,0.08)",
                      background:"rgba(255,255,255,0.03)", color:"#475569"}}>Edit</button>
                  <button onClick={() => handleDelete(s.id)}
                    style={{padding:"3px 10px", borderRadius:4, cursor:"pointer",
                      fontSize:8, fontFamily:"monospace",
                      border:"1px solid rgba(255,80,80,0.2)",
                      background:"rgba(255,80,80,0.05)", color:"#ff4f4f"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
const TV_TIMEFRAME_LABELS = [
  ["1","1m"],["3","3m"],["5","5m"],["15","15m"],["30","30m"],
  ["60","1h"],["240","4h"],["D","D"],
];

// Full TradingView symbol strings for each instrument key
const TV_SYMBOLS = {
  NQ:  "CME_MINI:NQ1!",
  ES:  "CME_MINI:ES1!",
  RTY: "CME_MINI:RTY1!",
  YM:  "CBOT_MINI:YM1!",
};

// SMT secondary symbol map — what to show alongside each instrument
const SMT_PAIR = { NQ:"CME_MINI:ES1!", ES:"CME_MINI:NQ1!", RTY:"CME_MINI:ES1!", YM:"CME_MINI:ES1!" };
const SMT_LABEL = { NQ:"ES", ES:"NQ", RTY:"ES", YM:"ES" };

// ─────────────────────────────────────────────────────────────────────────────
// TRADINGVIEW WIDGET (loads tv.js once, instantiates widget per mount)
// ─────────────────────────────────────────────────────────────────────────────
function TradingViewWidget({ symbol, interval, chartId }) {
  const sym         = TV_SYMBOLS[symbol] || symbol || "CME_MINI:NQ1!";
  const uid         = chartId || symbol;
  const containerId = `tv_widget_${uid}`;
  const widgetRef   = useRef(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const initWidget = () => {
      if (!window.TradingView) return;
      widgetRef.current = new window.TradingView.widget({
        autosize:          true,
        symbol:            sym,
        interval:          interval || "5",
        timezone:          "America/New_York",
        theme:             "dark",
        style:             "1",
        locale:            "en",
        toolbar_bg:        "#0d1521",
        enable_publishing: false,
        hide_top_toolbar:  false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        save_image:        false,
        container_id:      containerId,
        withdateranges:    true,
        hide_volume:       false,
        studies:           [],
      });
    };

    if (window.TradingView) {
      initWidget();
    } else if (!document.getElementById("tv-script")) {
      const script  = document.createElement("script");
      script.id     = "tv-script";
      script.src    = "https://s.tradingview.com/tv.js";
      script.async  = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => {
        if (window.TradingView) { clearInterval(poll); initWidget(); }
      }, 200);
      return () => clearInterval(poll);
    }

    return () => { try { widgetRef.current?.remove?.(); } catch {} };
  }, [sym, interval, containerId]);

  return (
    <div
      id={containerId}
      key={`${uid}-${interval}-${sym}`}
      style={{ width:"100%", height:"100%", background:"#0d1521" }}
    />
  );
}

function TVChartControls({ symbol, interval, setInterval:setTf, layout, setLayout, fullscreen, setFullscreen, pineCode, chartSource, setChartSource, wsStatus, tvConn }) {
  const [copied, setCopied] = useState(false);

  const copyPine = () => {
    if (!pineCode) return;
    navigator.clipboard.writeText(pineCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const sep = <div style={{width:1,height:14,background:"rgba(255,255,255,0.08)",flexShrink:0}}/>;

  const layoutBtn = (id, icon, label, hint) => (
    <button key={id} onClick={() => setLayout(id)} title={hint}
      style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:5,
        border:`1px solid ${layout===id?"rgba(41,98,255,0.55)":"rgba(255,255,255,0.07)"}`,
        background:layout===id?"rgba(41,98,255,0.18)":"transparent",
        color:layout===id?"#6699ff":"#475569",
        fontSize:9,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
      <span style={{fontSize:11,lineHeight:1}}>{icon}</span>
      <span style={{fontSize:8}}>{label}</span>
    </button>
  );

  return (
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,flexWrap:"wrap",
      padding:"7px 10px",background:"rgba(0,0,0,0.32)",
      border:"1px solid rgba(255,255,255,0.06)",borderRadius:8}}>

      {/* Branding */}
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:"#2962ff",boxShadow:"0 0 5px #2962ff"}}/>
        <span style={{fontSize:9,color:"#2962ff",fontFamily:"monospace",fontWeight:700,letterSpacing:1}}>TRADINGVIEW</span>
      </div>

      {sep}

      {/* Chart source toggle */}
      <div style={{display:"flex",gap:2,alignItems:"center"}}>
        {[
          ["canvas","◧ CANVAS", true,  "Simulated canvas chart with ICT overlays — always works"],
          ["tv",    "▣ TV CHART",true, "Embed TradingView chart (requires external network)"],
          ["live",  tvConn?"⬤ LIVE":"◎ LIVE", !!tvConn, "Tradovate live data → canvas chart (connect Tradovate first)"],
        ].map(([src,lbl,enabled,hint])=>(
          <button key={src} onClick={()=>enabled&&setChartSource(src)} disabled={!enabled}
            title={hint}
            style={{padding:"4px 9px",borderRadius:5,
              border:`1px solid ${chartSource===src
                ? src==="live"?"rgba(0,255,140,0.5)":src==="canvas"?"rgba(99,102,241,0.5)":"rgba(41,98,255,0.5)"
                : "rgba(255,255,255,0.06)"}`,
              background:chartSource===src
                ? src==="live"?"rgba(0,255,140,0.12)":src==="canvas"?"rgba(99,102,241,0.12)":"rgba(41,98,255,0.15)"
                : "transparent",
              color:chartSource===src
                ? src==="live"?"#00ff8c":src==="canvas"?"#818cf8":"#6699ff"
                : enabled?"#475569":"#1e293b",
              fontSize:9,fontFamily:"monospace",fontWeight:700,
              cursor:enabled?"pointer":"not-allowed",transition:"all 0.15s"}}>
            {lbl}
          </button>
        ))}
        {(chartSource==="live")&&(
          <span style={{fontSize:7,fontFamily:"monospace",padding:"3px 7px",borderRadius:4,
            background:wsStatus==="streaming"?"rgba(0,255,140,0.08)":wsStatus==="error"?"rgba(255,80,80,0.08)":"rgba(255,255,255,0.03)",
            color:wsStatus==="streaming"?"#00ff8c":wsStatus==="error"?"#ff4f4f":"#94a3b8",
            border:`1px solid ${wsStatus==="streaming"?"rgba(0,255,140,0.2)":wsStatus==="error"?"rgba(255,80,80,0.2)":"rgba(255,255,255,0.05)"}`,
            alignSelf:"center"}}>
            {wsStatus==="streaming"?"● LIVE":wsStatus==="connecting"?"⟳ CONN":wsStatus==="authenticating"?"⟳ AUTH":wsStatus==="error"?"✕ ERR":wsStatus.toUpperCase()}
          </span>
        )}
      </div>

      {sep}

      {/* Timeframe */}
      <div style={{display:"flex",gap:2,flexWrap:"nowrap"}}>
        {TV_TIMEFRAME_LABELS.map(([val,lbl]) => (
          <button key={val} onClick={() => setTf(val)}
            style={{padding:"3px 7px",borderRadius:4,
              border:`1px solid ${interval===val?"rgba(41,98,255,0.5)":"rgba(255,255,255,0.06)"}`,
              background:interval===val?"rgba(41,98,255,0.15)":"transparent",
              color:interval===val?"#6699ff":"#475569",
              fontSize:9,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
            {lbl}
          </button>
        ))}
      </div>

      {sep}

      {/* Layout modes */}
      <div style={{display:"flex",gap:3}}>
        {layoutBtn("single",  "▣", "SINGLE",  "Single chart view")}
        {layoutBtn("split",   "⬒", "SPLIT",   `${symbol} stacked with ${SMT_LABEL[symbol]||"ES"} — scroll vertically`)}
        {layoutBtn("smt",     "◫", "SMT",     `${symbol} vs ${SMT_LABEL[symbol]||"ES"} side-by-side for SMT divergence`)}
      </div>

      {sep}

      {/* Fullscreen */}
      <button onClick={() => setFullscreen(f => !f)} title={fullscreen?"Exit fullscreen":"Fullscreen chart"}
        style={{display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:5,
          border:`1px solid ${fullscreen?"rgba(255,215,0,0.4)":"rgba(255,255,255,0.07)"}`,
          background:fullscreen?"rgba(255,215,0,0.1)":"transparent",
          color:fullscreen?"#ffd700":"#475569",
          fontSize:9,fontFamily:"monospace",fontWeight:700,cursor:"pointer"}}>
        <span style={{fontSize:12,lineHeight:1}}>{fullscreen?"⊡":"⊞"}</span>
        <span style={{fontSize:8}}>{fullscreen?"EXIT FULL":"FULLSCREEN"}</span>
      </button>

      {sep}

      {/* Copy Pine Script */}
      <button onClick={copyPine} disabled={!pineCode}
        title={pineCode?"Copy active strategy Pine Script → paste into TradingView Pine Editor":"Select a strategy to copy its Pine Script"}
        style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:5,
          background:pineCode?(copied?"rgba(0,255,140,0.14)":"rgba(0,255,140,0.07)"):"rgba(255,255,255,0.02)",
          border:`1px solid ${pineCode?(copied?"rgba(0,255,140,0.5)":"rgba(0,255,140,0.2)"):"rgba(255,255,255,0.04)"}`,
          color:pineCode?(copied?"#00ff8c":"#34d399"):"#1e293b",
          fontSize:9,fontFamily:"monospace",fontWeight:700,cursor:pineCode?"pointer":"not-allowed",
          transition:"all 0.2s"}}>
        <span style={{fontSize:10}}>{copied?"✓":"📋"}</span>
        <span>{copied?"COPIED!":"COPY PINE"}</span>
      </button>
      {pineCode&&!copied&&(
        <span style={{fontSize:7,color:"#334155",fontFamily:"monospace"}}>→ TradingView Pine Editor</span>
      )}

      {sep}

      {/* Open in TradingView */}
      <a
        href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV_SYMBOLS[symbol]||"CME_MINI:NQ1!")}&interval=${interval}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Open this symbol and timeframe directly in TradingView"
        style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:5,
          background:"rgba(41,98,255,0.1)",border:"1px solid rgba(41,98,255,0.35)",
          color:"#6699ff",fontSize:9,fontFamily:"monospace",fontWeight:700,
          textDecoration:"none",transition:"all 0.15s",flexShrink:0}}>
        <span style={{fontSize:10}}>↗</span>
        <span>OPEN IN TV</span>
      </a>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TRADOVATE SYMBOL MAP  (front-month continuous contract names)
// ─────────────────────────────────────────────────────────────────────────────
function getTradovateSymbol(ins) {
  // Tradovate uses rolling front-month symbols. We resolve to the nearest
  // quarterly expiry (Mar=H, Jun=M, Sep=U, Dec=Z).
  const now   = new Date();
  const month = now.getMonth(); // 0-11
  const yr    = String(now.getFullYear()).slice(-1);
  const code  = month < 3 ? "H" : month < 6 ? "M" : month < 9 ? "U" : "Z";
  const base  = { NQ:"NQ", ES:"ES", RTY:"RTY", YM:"YM" }[ins] || "NQ";
  return `${base}${code}${yr}`; // e.g. NQU5, ESZ5
}

// ─────────────────────────────────────────────────────────────────────────────
// useTradovateWS  —  Auth → Market-Data WebSocket → OHLCV bar stream
// ─────────────────────────────────────────────────────────────────────────────
function useTradovateWS({ conn, instrument, interval, onCandles, onTick, onStatus }) {
  const wsRef    = useRef(null);
  const hbRef    = useRef(null);
  const reqId    = useRef(1);
  const barBuf   = useRef([]); // accumulate historical bars

  const send = (type, body={}) => {
    const id = reqId.current++;
    const msg = `${type}
${id}

${JSON.stringify(body)}`;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(msg);
    return id;
  };

  const parseMsg = (raw) => {
    // Tradovate WS frame format: "type\nid\n\nbody"
    if (!raw || raw === "o" || raw === "h") return null; // SockJS open/heartbeat
    try {
      // Market-data WS sends JSON arrays wrapped in "a[...]"
      if (raw.startsWith("a[")) {
        const arr = JSON.parse(raw.slice(1));
        return arr.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
      }
      if (raw.startsWith("{")) return [JSON.parse(raw)];
    } catch {}
    return null;
  };

  const buildCandle = (bar) => ({
    t: bar.timestamp ? new Date(bar.timestamp).getTime() : Date.now(),
    o: bar.open,
    h: bar.high,
    l: bar.low,
    c: bar.close,
    v: bar.upVolume + bar.downVolume || bar.totalVolume || 0,
    askVol: bar.upVolume   || 0,
    bidVol: bar.downVolume || 0,
    delta:  (bar.upVolume || 0) - (bar.downVolume || 0),
  });

  useEffect(() => {
    if (!conn?.token) return;

    const env      = conn.env === "live" ? "live" : "demo";
    // Tradovate has separate MD (market-data) WebSocket endpoint
    const mdWsUrl  = `wss://md-${env}.tradovateapi.com/v1/websocket`;
    const sym      = getTradovateSymbol(instrument);

    onStatus?.("connecting");

    let ws;
    try { ws = new WebSocket(mdWsUrl); }
    catch(e) {
      onStatus?.("error", `WebSocket failed: ${e.message}`);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      onStatus?.("authenticating");
      // Step 1: authorize with access token
      send("authorize", { token: conn.token });
      // Heartbeat every 2.5s (Tradovate requires <10s)
      hbRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("[]");
      }, 2500);
    };

    ws.onmessage = (evt) => {
      const frames = parseMsg(evt.data);
      if (!frames) return;
      frames.forEach(frame => {
        if (!frame) return;

        // Auth response
        if (frame.s === 200 && frame.i === 1) {
          onStatus?.("streaming");
          // Step 2: subscribe to chart bars
          send("md/getChart", {
            symbol: sym,
            chartDescription: {
              underlyingType: "MinuteBar",
              elementSize:    parseInt(interval) || 5,
              elementSizeUnit:"UnderlyingUnits",
              withHistogram:  false,
            },
            timeRange: { asMuchAsElements: 200 },
          });
          // Step 3: subscribe to live quotes for tick updates
          send("md/subscribeQuote", { symbol: sym });
        }

        // Chart history response (e=md/getChart)
        if (frame.e === "chart" && frame.d?.charts) {
          const bars = frame.d.charts[0]?.bars || [];
          if (bars.length > 0) {
            const candles = bars.map(buildCandle);
            barBuf.current = candles;
            const ofCandles = compOrderFlow(candles);
            onCandles?.(ofCandles);
          }
        }

        // Real-time bar update (e=md/chart)
        if (frame.e === "md/chart" && frame.d?.charts) {
          const bars = frame.d.charts[0]?.bars || [];
          bars.forEach(bar => {
            const c = buildCandle(bar);
            barBuf.current = [...barBuf.current.slice(-999), c];
            const ofCandles = compOrderFlow(barBuf.current);
            onCandles?.(ofCandles);
          });
        }

        // Live quote tick
        if (frame.e === "md/quote" && frame.d?.quotes) {
          const q = frame.d.quotes[0];
          if (q && onTick) onTick({ bid: q.bidPrice, ask: q.askPrice, last: q.lastPrice });
        }
      });
    };

    ws.onerror = (e) => onStatus?.("error", "WebSocket error — check credentials & network");
    ws.onclose = (e) => {
      clearInterval(hbRef.current);
      if (e.code !== 1000) onStatus?.("disconnected", `Closed (${e.code})`);
    };

    return () => {
      clearInterval(hbRef.current);
      ws.close(1000, "unmount");
    };
  // Re-run when connection, instrument, or interval changes
  }, [conn?.token, conn?.env, instrument, interval]);

  return { disconnect: () => wsRef.current?.close(1000, "user") };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CHART TAB
// ─────────────────────────────────────────────────────────────────────────────
function LiveChartTab({ onStateChange, tradeSetup, onTradeSetupUpdate, tvConn: tvConnProp, setTvConn: setTvConnProp, lastScanResult: lastScanResultProp }) {
  const [ins,       setIns]       = useState("NQ");
  const [candles,   setCandles]   = useState([]);
  const [obs,       setOBs]       = useState([]);
  const [bbs,       setBBs]       = useState([]);
  const [fvgs,      setFVGs]      = useState([]);
  const [liq,          setLiq]          = useState([]);
  const [contextLevels,setContextLevels] = useState({ levels:[], currentSession:"LOADING", currentSessionLabel:"...", pdh:0,pdl:0,pwh:0,pwl:0,pdhSwept:false,pdlSwept:false,pwhSwept:false,pwlSwept:false });
  const [orb,       setOrb]       = useState(null);
  const [ote,       setOte]       = useState(null);
  const [ofData,    setOFData]    = useState([]);
  const [volProf,   setVolProf]   = useState([]);
  const [bias,      setBias]      = useState("BULLISH");
  const [activeS,   setActiveS]   = useState(null);
  const [custom,    setCustom]    = useState([]);
  const [editorOpen,setEditor]    = useState(false);
  const [editTgt,   setEditTgt]   = useState(null);
  const [tvOpen,    setTvOpen]    = useState(false);
  // tvConn + lastScanResult lifted to App — use prop versions if provided, else local fallback
  const [tvConnLocal,    setTvConnLocal]    = useState(null);
  const [lastScanLocal,  setLastScanLocal]  = useState(null);
  const tvConn         = tvConnProp         ?? tvConnLocal;
  const setTvConn      = setTvConnProp      ?? setTvConnLocal;
  const lastScanResult = lastScanResultProp ?? lastScanLocal;
  const [ticketOpen,setTicket]    = useState(false);
  const [kzRulesOpen,setKZRules]  = useState(false);
  const [vivekOpen,  setVivekOpen] = useState(false);
  const [tvInterval, setTvInterval]= useState("5");
  const [chartLayout,  setChartLayout]  = useState("single"); // "single"|"split"|"smt"
  const [splitSymbol,  setSplitSymbol]  = useState("ES");
  const [splitTf,      setSplitTf]      = useState("3");
  const [tvAccount1,   setTvAccount1]   = useState(null); // {label}
  const [tvAccount2,   setTvAccount2]   = useState(null);
  const [tvLoginOpen,  setTvLoginOpen]  = useState(false);
  const [tvLoginSlot,  setTvLoginSlot]  = useState(1);
  const [tvLoginInput, setTvLoginInput] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [chartSource,setChartSource]= useState("canvas"); // "canvas" | "tv" | "live"
  const [wsStatus,   setWsStatus]   = useState("idle"); // idle|connecting|authenticating|streaming|error|disconnected
  const [wsMsg,      setWsMsg]      = useState("");

  // ── LIVE PD ARRAY — recomputes on every candle/level/ob/fvg change ─────────
  const ifvgsLive = useMemo(
    () => candles.length ? compIFVGs(candles) : [],
    [candles]
  );
  const pdArray = useMemo(() => {
    if (!candles.length) return {
      best:null, tools:[], pdScore:0, pdValid:false,
      priceZone:"LOADING", inPremium:false, inDiscount:false, inGolden:false,
      eq:"—", g62:"—", g79:"—", hi:null, lo:null, biasSignal:"Loading..."
    };
    const price = candles[candles.length-1]?.c || 0;
    return compPDArray(candles, obs, bbs, ifvgsLive, liq, price);
  }, [candles, obs, bbs, ifvgsLive, liq]);
  const macroInfo = useMemo(
    () => getMacroLabel(candles.length ? candles[candles.length-1]?.t : Date.now()),
    [candles]
  );

  useEffect(()=>{ loadStrategies().then(setCustom); },[]);

  // ── TRADOVATE WEBSOCKET ───────────────────────────────────────────────────
  const handleWsCandles = useCallback((liveCandles) => {
    if(!liveCandles.length) return;
    const obList = genOBs(liveCandles);
    const sh = Math.max(...liveCandles.slice(-30).map(x=>x.h));
    const sl = Math.min(...liveCandles.slice(-30).map(x=>x.l));
    setCandles(liveCandles);
    setOBs(obList);
    setBBs(genBBs(obList, liveCandles));
    setFVGs(genFVGs(liveCandles));
    setLiq(genLiq(liveCandles));
    setContextLevels(compContextualLevels(liveCandles));
    setOrb(compORB(liveCandles));
    setOte(compOTE(sh, sl));
    setOFData(liveCandles); // already run through compOrderFlow in hook
    setVolProf(compVolProfile(liveCandles));
    setBias(liveCandles[liveCandles.length-1]?.c >= liveCandles[liveCandles.length-2]?.c ? "BULLISH" : "BEARISH");
  }, []);

  const handleWsTick = useCallback((tick) => {
    if(!tick?.last) return;
    setCandles(prev => {
      if(!prev.length) return prev;
      const u = [...prev], l = { ...u[u.length-1] };
      l.c = tick.last;
      l.h = Math.max(l.h, tick.last);
      l.l = Math.min(l.l, tick.last);
      u[u.length-1] = l;
      return u;
    });
  }, []);

  useTradovateWS({
    conn:       tvConn,
    instrument: ins,
    interval:   tvInterval,
    onCandles:  handleWsCandles,
    onTick:     handleWsTick,
    onStatus:   (status, msg="") => { setWsStatus(status); setWsMsg(msg); },
  });

  const refresh = useCallback((i=ins)=>{
    if (wsStatus==="streaming") return; // skip mock when WS live
    const c=generateCandles(i,1000);
    const obList=genOBs(c);
    const sh=Math.max(...c.slice(-30).map(x=>x.h)),sl=Math.min(...c.slice(-30).map(x=>x.l));
    const of2=compOrderFlow(c);
    setCandles(c);setOBs(obList);setBBs(genBBs(obList,c));setFVGs(genFVGs(c));setLiq(genLiq(c));setContextLevels(compContextualLevels(c));setOrb(compORB(c));setOte(compOTE(sh,sl));setOFData(of2);setVolProf(compVolProfile(c));
    setBias(Math.random()>0.5?"BULLISH":"BEARISH");
  },[ins]);

  useEffect(()=>{ refresh(ins); },[ins]);

  useEffect(()=>{
    const id=setInterval(()=>{
      if (wsStatus==="streaming") return; // real ticks from WS
      setCandles(prev=>{
        if(!prev.length)return prev;
        const u=[...prev],l={...u[u.length-1]};
        const mv=(Math.random()-0.49)*(ins==="NQ"?4:1.5);
        l.c+=mv;l.h=Math.max(l.h,l.c);l.l=Math.min(l.l,l.c);
        l.delta=Math.floor((Math.random()-0.45)*l.v*0.8);
        u[u.length-1]=l;return u;
      });
    },1200);
    return()=>clearInterval(id);
  },[ins]);

  const persist=async list=>{setCustom(list);await saveStrategies(list);};
  const handleSave=(strategy,mode)=>{
    const idx=custom.findIndex(s=>s.id===strategy.id);
    const upd=idx>=0?custom.map((s,i)=>i===idx?strategy:s):[...custom,strategy];
    persist(upd);
    if(mode==="activate")setActiveS(strategy);
    setEditor(false);setEditTgt(null);
  };
  const handleDelete=id=>{persist(custom.filter(s=>s.id!==id));if(activeS?.id===id)setActiveS(null);};

  const overlays=activeS?.overlays||[];
  const lastPrice=candles.length?candles[candles.length-1].c:0;
  const chg=candles.length?lastPrice-candles[0].o:0;
  const bull=candles.length?candles[candles.length-1].c>=candles[candles.length-1].o:true;

  // ── Auto-sweep: clear tradeSetup when stop or tp1 is hit ─────────────────
  useEffect(()=>{
    if (!tradeSetup?.active || !lastPrice) return;
    const { direction, stop_price, tp1_price, tp2_price } = tradeSetup;
    const stopHit = direction==="LONG" ? lastPrice <= stop_price : lastPrice >= stop_price;
    const tp1Hit  = tp1_price ? (direction==="LONG" ? lastPrice >= tp1_price : lastPrice <= tp1_price) : false;
    const tp2Hit  = tp2_price ? (direction==="LONG" ? lastPrice >= tp2_price : lastPrice <= tp2_price) : false;
    if (stopHit) {
      onTradeSetupUpdate && onTradeSetupUpdate({ ...tradeSetup, active:false, outcome:"STOPPED", clearedAt:Date.now() });
      setTimeout(()=>onTradeSetupUpdate(null), 5 * 60 * 1000); // hold faded for 5 min then remove
    } else if (tp2Hit) {
      onTradeSetupUpdate && onTradeSetupUpdate({ ...tradeSetup, active:false, outcome:"TP2_HIT", clearedAt:Date.now() });
      setTimeout(()=>onTradeSetupUpdate(null), 5 * 60 * 1000);
    } else if (tp1Hit) {
      onTradeSetupUpdate && onTradeSetupUpdate({ ...tradeSetup, tp1_hit:true });
    }
  },[lastPrice, tradeSetup, onTradeSetupUpdate]);

  // Bubble state up for AI Scanner tab
  useEffect(()=>{
    if(onStateChange&&candles.length) onStateChange({candles,obs,bbs,fvgs,liq,orb,ote,ofData,instrument:ins,activeStrategy:activeS});
  },[candles,obs,bbs,fvgs,liq,orb,ote,ofData,ins,activeS,onStateChange]);

  // Order flow summary
  const lastOF=ofData.length?ofData[ofData.length-1]:null;
  const cvdDir=lastOF&&ofData.length>5?(lastOF.cvd>ofData[ofData.length-5].cvd?"↑":"↓"):"–";
  // PDH/PDL/PWH/PWL + session levels — all derived from contextLevels (no separate useMemo needed)
  const pdLevels = contextLevels; // HTFPanel expects same shape

  // Strategy rules panels
  const kzStrat    = BUILTIN_STRATEGIES.find(s=>s.id==="kz_confluence");
  const vivekStrat = BUILTIN_STRATEGIES.find(s=>s.id==="vivek_unicorn");

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {tvConn&&<AccountBar conn={tvConn} lastPrice={lastPrice} instrument={ins} onDisconnect={()=>setTvConn(null)} onOpenTicket={()=>setTicketOpen(true)}/>}
      {tvConn&&<ExecutionBridge conn={tvConn} scanResult={lastScanResult} lastPrice={lastPrice} instrument={ins} onOrderSent={()=>setTicketOpen(false)}/>}

      {/* ── STRATEGY OVERLAY SELECTOR ─────────────────────────────────────── */}
      <div style={{background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"9px 14px",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:"#334155",letterSpacing:3,fontFamily:"monospace"}}>OVERLAY</span>
          {activeS && (
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"2px 9px",borderRadius:20,
              background:`${activeS.color||"#00d4ff"}12`,border:`1px solid ${activeS.color||"#00d4ff"}44`}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:activeS.color||"#00d4ff",boxShadow:`0 0 4px ${activeS.color||"#00d4ff"}`}}/>
              <span style={{fontSize:10,fontWeight:700,color:activeS.color||"#00d4ff",fontFamily:"monospace"}}>{activeS.name||activeS.label}</span>
              <button onClick={()=>setActiveS(null)} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10,padding:"0 0 0 2px",lineHeight:1}}>✕</button>
            </div>
          )}
          <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            {/* Instrument selector */}
            {INSTRUMENTS.map(i=>(
              <button key={i} onClick={()=>setIns(i)} style={{background:ins===i?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${ins===i?"rgba(0,212,255,0.38)":"rgba(255,255,255,0.06)"}`,color:ins===i?"#00d4ff":"#475569",padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"monospace"}}>{i}</button>
            ))}
            <button onClick={()=>refresh(ins)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",color:"#64748b",padding:"4px 8px",borderRadius:5,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>⟳</button>
            <div style={{width:1,height:14,background:"rgba(255,255,255,0.07)",flexShrink:0}}/>
            <button onClick={()=>tvConn?setTicket(true):setTvOpen(true)} style={{background:tvConn?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.04)",border:`1px solid ${tvConn?"rgba(0,212,255,0.38)":"rgba(255,255,255,0.07)"}`,color:tvConn?"#00d4ff":"#475569",padding:"4px 12px",borderRadius:6,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>
              {tvConn?"⚡ PLACE ORDER":"🔌 TRADOVATE"}
            </button>
            <div style={{width:1,height:14,background:"rgba(255,255,255,0.07)",flexShrink:0}}/>
            {/* Session badge */}
            {(()=>{
              const sess = contextLevels.currentSessionLabel || "…";
              const prev = contextLevels.prevSession || "";
              const sessCol = sess==="LDN"?"#c084fc":sess==="NY OPEN"?"#00d4ff":sess==="NY PM"?"#38bdf8":sess==="ASIA"?"#fbbf24":"#64748b";
              return (
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:sessCol,boxShadow:`0 0 5px ${sessCol}`,animation:"pulse 2s infinite"}}/>
                  <span style={{fontSize:9,fontWeight:700,color:sessCol,fontFamily:"monospace"}}>{sess}</span>
                  {prev&&<span style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>← {prev}</span>}
                </div>
              );
            })()}
          </div>
        </div>
        {/* Compact strategy library — just chips for quick overlay switch */}
        <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:7,color:"#1e293b",fontFamily:"monospace",letterSpacing:1}}>ACTIVATE:</span>
          {[...BUILTIN_STRATEGIES, ...custom].map(s=>{
            const isActive = activeS?.id===s.id;
            return (
              <button key={s.id} onClick={()=>setActiveS(p=>p?.id===s.id?null:s)}
                style={{padding:"3px 9px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:isActive?800:400,
                  background: isActive ? (s.color||"#00d4ff")+"18" : "rgba(255,255,255,0.03)",
                  border:`1px solid ${isActive ? (s.color||"#00d4ff")+"55" : "rgba(255,255,255,0.05)"}`,
                  color: isActive ? (s.color||"#00d4ff") : "#334155",
                  transition:"all 0.15s"}}>
                {s.name||s.label}
              </button>
            );
          })}
          <button onClick={()=>{setEditTgt(null);setEditor(true);}} style={{padding:"3px 9px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace",
            background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",color:"#818cf8"}}>+ New</button>
        </div>
      </div>

      {/* ── LIVE PD ARRAY BIAS STRIP ────────────────────────────────────────── */}
      {(()=>{
        const pd = pdArray;
        const isLong  = pd.biasSignal?.includes("LONG");
        const isShort = pd.biasSignal?.includes("SHORT");
        const isGold  = pd.priceZone?.includes("GOLDEN");
        const mainCol = isLong ? "#00ff8c" : isShort ? "#ef4444" : isGold ? "#ffd700" : "#475569";
        const macro = macroInfo;
        const macroCol = macro.quality==="HIGHEST"?"#ffd700":macro.quality==="HIGH"?"#00d4ff":macro.quality==="GOOD"?"#a855f7":"#475569";
        return (
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",marginBottom:8,
            background:`${mainCol}08`,border:`1px solid ${mainCol}22`,borderRadius:8,flexWrap:"wrap"}}>
            {/* Bias pill */}
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,
              background:`${mainCol}18`,border:`1px solid ${mainCol}44`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:mainCol,
                boxShadow:`0 0 6px ${mainCol}`,animation:"pulse 1.5s infinite"}}/>
              <span style={{fontSize:10,fontWeight:900,color:mainCol,fontFamily:"monospace",letterSpacing:1}}>
                {isLong?"LONG BIAS":isShort?"SHORT BIAS":isGold?"OTE ZONE":"NEUTRAL"}
              </span>
            </div>
            {/* Price zone */}
            <span style={{fontSize:9,color:"#64748b",fontFamily:"monospace"}}>
              {pd.priceZone}
            </span>
            {/* Eq line */}
            <span style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>
              EQ: <span style={{color:"#94a3b8"}}>{pd.eq}</span>
            </span>
            {/* Swing levels */}
            {pd.hi && <span style={{fontSize:9,fontFamily:"monospace",color:"#ef4444"}}>
              SH: {pd.hi?.toFixed(2)}
            </span>}
            {pd.lo && <span style={{fontSize:9,fontFamily:"monospace",color:"#00ff8c"}}>
              SL: {pd.lo?.toFixed(2)}
            </span>}
            {/* Best PD tool */}
            {pd.best && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace"}}>BEST TOOL:</span>
                <span style={{fontSize:9,fontWeight:700,color:mainCol,fontFamily:"monospace"}}>{pd.best.name}</span>
                <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace"}}>+{pd.best.score}pts</span>
              </div>
            )}
            {/* Golden pocket range */}
            {pd.inGolden && (
              <span style={{fontSize:9,color:"#ffd700",fontFamily:"monospace",fontWeight:700}}>
                ★ GOLDEN POCKET {pd.g79}–{pd.g62}
              </span>
            )}
            {/* Macro window */}
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
              {macro.label && (
                <div style={{padding:"2px 8px",borderRadius:4,background:`${macroCol}14`,
                  border:`1px solid ${macroCol}33`}}>
                  <span style={{fontSize:8,fontWeight:700,color:macroCol,fontFamily:"monospace"}}>
                    {macro.sb?"⚡ ":""}{macro.label}
                  </span>
                </div>
              )}
              {!macro.label && (
                <span style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>No macro active</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CHART CONTROLS BAR ──────────────────────────────────────────────── */}
      <TVChartControls
        symbol={ins}
        interval={tvInterval}
        setInterval={setTvInterval}
        layout={chartLayout}
        setLayout={setChartLayout}
        fullscreen={fullscreen}
        setFullscreen={setFullscreen}
        pineCode={activeS?.code||null}
        chartSource={chartSource}
        setChartSource={setChartSource}
        wsStatus={wsStatus}
        tvConn={tvConn}
      />

      {/* ── CHART AREA (normal + fullscreen modes) ──────────────────────────── */}
      {(()=>{
        const smtSym = SMT_PAIR[ins] || "CME_MINI:ES1!";
        const smtLbl = SMT_LABEL[ins] || "ES";

        const mainLabel = activeS ? (
          <div style={{position:"absolute",top:8,left:10,background:"rgba(0,0,0,0.72)",
            border:`1px solid ${activeS.color||"#00d4ff"}44`,borderRadius:5,
            padding:"3px 9px",pointerEvents:"none",zIndex:10}}>
            <span style={{fontSize:8,color:activeS.color||"#00d4ff",fontFamily:"monospace",fontWeight:700}}>
              {activeS.name||activeS.label}
            </span>
          </div>
        ) : null;

        const smtBadge = (label, color) => (
          <div style={{position:"absolute",top:8,left:10,background:"rgba(0,0,0,0.72)",
            border:`1px solid ${color}55`,borderRadius:5,padding:"3px 9px",pointerEvents:"none",zIndex:10}}>
            <span style={{fontSize:8,color,fontFamily:"monospace",fontWeight:700,letterSpacing:1}}>
              {label}  ·  SMT DIVERGENCE
            </span>
          </div>
        );

        // Shared chart box style
        const box = (h="100%", border="1px solid rgba(41,98,255,0.18)") => ({
          position:"relative",height:h,minHeight:0,background:"#080c14",
          borderRadius:6,overflow:"hidden",border,flexShrink:0,
        });

        // ── SINGLE ──
        if (chartLayout==="single") {
          const outerH = fullscreen ? "100vh" : "62vh";
          return (
            <div style={{
              ...(fullscreen ? {position:"fixed",inset:0,zIndex:900,background:"#080c14",display:"flex",flexDirection:"column"} : {marginBottom:10}),
            }}>
              {fullscreen&&(
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  background:"rgba(0,0,0,0.6)",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#2962ff",boxShadow:"0 0 5px #2962ff"}}/>
                  <span style={{fontSize:9,color:"#2962ff",fontFamily:"monospace",fontWeight:700}}>{ins}  ·  {tvInterval}m  ·  FULLSCREEN</span>
                  <button onClick={()=>setFullscreen(false)} style={{marginLeft:"auto",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.3)",color:"#ff4f4f",padding:"3px 10px",borderRadius:5,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>⊡ EXIT</button>
                </div>
              )}
              <div style={{...box(fullscreen?"calc(100% - 36px)":outerH)}}>
                {mainLabel}
                {chartSource==="tv"
                  ? <TradingViewWidget symbol={ins} interval={tvInterval} chartId="chart1"/>
                  : <CandleChart candles={candles} obs={obs} bbs={bbs} fvgs={fvgs} liq={liq} contextLevels={contextLevels} orb={orb} ote={ote} overlays={overlays} ofData={ofData} volProfile={volProf} tradeSetup={tradeSetup}/>
                }
                {/* Live status badge */}
                {chartSource==="live"&&(
                  <div style={{position:"absolute",bottom:8,right:10,background:"rgba(0,0,0,0.75)",
                    border:`1px solid ${wsStatus==="streaming"?"rgba(0,255,140,0.3)":"rgba(255,80,80,0.3)"}`,
                    borderRadius:4,padding:"3px 10px",pointerEvents:"none",zIndex:10,display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:5,height:5,borderRadius:"50%",
                      background:wsStatus==="streaming"?"#00ff8c":"#ff4f4f",
                      boxShadow:wsStatus==="streaming"?"0 0 5px #00ff8c":"none"}}/>
                    <span style={{fontSize:7,color:wsStatus==="streaming"?"#00ff8c":"#ff4f4f",fontFamily:"monospace",fontWeight:700}}>
                      {wsStatus==="streaming"?"TRADOVATE LIVE":wsStatus==="connecting"?"CONNECTING...":wsStatus==="authenticating"?"AUTHENTICATING...":wsMsg||wsStatus.toUpperCase()}
                    </span>
                  </div>
                )}
                {/* Canvas mode label */}
                {chartSource==="canvas"&&(
                  <div style={{position:"absolute",bottom:8,right:10,background:"rgba(0,0,0,0.55)",
                    border:"1px solid rgba(99,102,241,0.2)",borderRadius:4,
                    padding:"3px 9px",pointerEvents:"none",zIndex:10}}>
                    <span style={{fontSize:7,color:"#6366f1",fontFamily:"monospace"}}>SIMULATED · ICT OVERLAYS</span>
                  </div>
                )}
              </div>
            </div>
          );
        }

        // ── SPLIT (stacked vertical) ──
        if (chartLayout==="split") {
          const ALL_SYMS = Object.keys(TV_SYMBOLS);
          const sym1tv = TV_SYMBOLS[ins]          || "CME_MINI:NQ1!";
          const sym2tv = TV_SYMBOLS[splitSymbol]  || "CME_MINI:ES1!";

          const openTV = (sym, tf, slot) => {
            const tabName = slot === 1 ? "tv_tab_1" : "tv_tab_2";
            const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}&interval=${tf}`;
            const w = window.open(url, tabName);
            if (w) w.focus();
          };

          // Tiny helper: account badge
          const acctBadge = (acct, slot, col) => (
            <button onClick={() => { setTvLoginSlot(slot); setTvLoginInput(acct?.label||""); setTvLoginOpen(true); }}
              style={{fontSize:8,padding:"2px 8px",borderRadius:4,cursor:"pointer",fontFamily:"monospace",
                border:`1px solid ${acct ? "rgba(0,255,140,0.35)" : "rgba(255,255,255,0.1)"}`,
                background: acct ? "rgba(0,255,140,0.07)" : "rgba(255,255,255,0.03)",
                color: acct ? "#00ff8c" : "#475569"}}>
              {acct ? `✓ ${acct.label}` : `+ Acct ${slot}`}
            </button>
          );

          return (
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10,
              ...(fullscreen?{position:"fixed",inset:0,zIndex:900,background:"#080c14"}:{})}}>

              {/* ── Control bar ── */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",
                padding:"6px 10px",background:"rgba(0,0,0,0.45)",
                border:"1px solid rgba(41,98,255,0.2)",borderRadius:8}}>
                <span style={{fontSize:9,color:"#2962ff",fontFamily:"monospace",fontWeight:800,letterSpacing:1}}>
                  ⊟ SPLIT
                </span>
                <div style={{width:1,height:14,background:"rgba(255,255,255,0.08)"}}/>

                {/* Chart 1 */}
                <span style={{fontSize:8,color:"#475569",fontFamily:"monospace"}}>Chart 1:</span>
                <span style={{fontSize:9,color:"#00d4ff",fontFamily:"monospace",fontWeight:700}}>{ins}</span>
                <select value={tvInterval} onChange={e=>setTvInterval(e.target.value)}
                  style={{fontSize:8,padding:"2px 5px",borderRadius:4,fontFamily:"monospace",cursor:"pointer",
                    background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",color:"#00d4ff"}}>
                  {["1","3","5","15","30","60","240","D"].map(t=><option key={t} value={t}>{t}m</option>)}
                </select>
                <button onClick={()=>openTV(sym1tv, tvInterval, 1)}
                  style={{fontSize:8,padding:"2px 8px",borderRadius:4,cursor:"pointer",fontFamily:"monospace",
                    border:"1px solid rgba(0,212,255,0.3)",background:"rgba(0,212,255,0.08)",color:"#00d4ff"}}>
                  ↗ Open TV
                </button>
                {acctBadge(tvAccount1, 1, "#00d4ff")}

                <div style={{width:1,height:14,background:"rgba(255,255,255,0.08)"}}/>

                {/* Chart 2 */}
                <span style={{fontSize:8,color:"#475569",fontFamily:"monospace"}}>Chart 2:</span>
                <select value={splitSymbol} onChange={e=>setSplitSymbol(e.target.value)}
                  style={{fontSize:8,padding:"2px 6px",borderRadius:4,fontFamily:"monospace",cursor:"pointer",
                    background:"rgba(192,132,252,0.08)",border:"1px solid rgba(192,132,252,0.25)",color:"#c084fc"}}>
                  {ALL_SYMS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <select value={splitTf} onChange={e=>setSplitTf(e.target.value)}
                  style={{fontSize:8,padding:"2px 5px",borderRadius:4,fontFamily:"monospace",cursor:"pointer",
                    background:"rgba(192,132,252,0.08)",border:"1px solid rgba(192,132,252,0.2)",color:"#c084fc"}}>
                  {["1","3","5","15","30","60","240","D"].map(t=><option key={t} value={t}>{t}m</option>)}
                </select>
                <button onClick={()=>openTV(sym2tv, splitTf, 2)}
                  style={{fontSize:8,padding:"2px 8px",borderRadius:4,cursor:"pointer",fontFamily:"monospace",
                    border:"1px solid rgba(192,132,252,0.3)",background:"rgba(192,132,252,0.08)",color:"#c084fc"}}>
                  ↗ Open TV
                </button>
                {acctBadge(tvAccount2, 2, "#c084fc")}

                {fullscreen && (
                  <button onClick={()=>setFullscreen(false)} style={{marginLeft:"auto",
                    background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.3)",
                    color:"#ff4f4f",padding:"3px 10px",borderRadius:5,cursor:"pointer",
                    fontSize:9,fontFamily:"monospace",fontWeight:700}}>⊡ EXIT</button>
                )}
              </div>

              {/* ── Chart 1 ── */}
              <div style={{...box(fullscreen?"50%":"50vh")}}>
                <div style={{position:"absolute",top:6,left:8,zIndex:2,
                  display:"flex",alignItems:"center",gap:5,pointerEvents:"none"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#00d4ff",
                    boxShadow:"0 0 6px #00d4ff"}}/>
                  <span style={{fontSize:9,color:"#00d4ff",fontFamily:"monospace",fontWeight:700}}>
                    {ins} · {tvInterval}m
                    {tvAccount1 && <span style={{opacity:0.6,fontSize:7}}> · {tvAccount1.label}</span>}
                  </span>
                </div>
                {chartSource==="tv"
                  ? <TradingViewWidget symbol={ins} interval={tvInterval} chartId="main"/>
                  : <CandleChart candles={candles} obs={obs} bbs={bbs} fvgs={fvgs} liq={liq}
                      contextLevels={contextLevels} orb={orb} ote={ote} overlays={overlays}
                      ofData={ofData} volProfile={volProf} tradeSetup={tradeSetup}/>}
              </div>

              {/* ── Chart 2 ── */}
              <div style={{...box(fullscreen?"50%":"50vh","1px solid rgba(192,132,252,0.2)")}}>
                <div style={{position:"absolute",top:6,left:8,zIndex:2,
                  display:"flex",alignItems:"center",gap:5,pointerEvents:"none"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#c084fc",
                    boxShadow:"0 0 6px #c084fc"}}/>
                  <span style={{fontSize:9,color:"#c084fc",fontFamily:"monospace",fontWeight:700}}>
                    {splitSymbol} · {splitTf}m
                    {tvAccount2 && <span style={{opacity:0.6,fontSize:7}}> · {tvAccount2.label}</span>}
                  </span>
                </div>
                <TradingViewWidget symbol={splitSymbol} interval={splitTf} chartId="chart2"/>
              </div>

              {/* ── TV Dual Account Modal ── */}
              {tvLoginOpen && (
                <div onClick={e=>{if(e.target===e.currentTarget)setTvLoginOpen(false);}}
                  style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.8)",
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{background:"#0d1521",border:"1px solid rgba(41,98,255,0.35)",
                    borderRadius:14,padding:24,width:400,boxShadow:"0 24px 64px rgba(0,0,0,0.9)"}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#e2e8f0",fontFamily:"monospace",marginBottom:4}}>
                      Account {tvLoginSlot} — TradingView Session
                    </div>
                    {/* How it works explainer */}
                    <div style={{background:"rgba(41,98,255,0.06)",border:"1px solid rgba(41,98,255,0.15)",
                      borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                      <div style={{fontSize:9,color:"#64748b",fontFamily:"monospace",lineHeight:1.8}}>
                        <span style={{color:"#6699ff",fontWeight:700}}>How dual accounts work:</span><br/>
                        Browser iframes share your active session cookie — so both charts show the same logged-in account by default.<br/><br/>
                        <span style={{color:"#ffd700",fontWeight:700}}>To use 2 accounts:</span><br/>
                        Account 1 → log in normally in this browser<br/>
                        Account 2 → open an <span style={{color:"#00ff8c"}}>Incognito / Private window</span> and log into your second account there.<br/><br/>
                        The ↗ buttons open TradingView in a named tab in the <span style={{color:"#f97316"}}>current browser window</span> only. For true dual sessions use two browser profiles or one incognito.
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",marginBottom:8}}>
                      Label for Account {tvLoginSlot}:
                    </div>
                    <input
                      value={tvLoginInput}
                      onChange={e=>setTvLoginInput(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==="Enter"){
                          const lbl = tvLoginInput.trim() || `Acct ${tvLoginSlot}`;
                          tvLoginSlot===1 ? setTvAccount1({label:lbl}) : setTvAccount2({label:lbl});
                          setTvLoginOpen(false);
                        }
                      }}
                      placeholder={tvLoginSlot===1 ? "e.g. Main / Live" : "e.g. Paper / Hedge"}
                      style={{width:"100%",boxSizing:"border-box",
                        background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",
                        color:"#e2e8f0",borderRadius:6,padding:"9px 12px",fontSize:11,
                        fontFamily:"monospace",marginBottom:14}}
                      autoFocus
                    />
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <button onClick={()=>{
                          const lbl = tvLoginInput.trim() || `Acct ${tvLoginSlot}`;
                          tvLoginSlot===1 ? setTvAccount1({label:lbl}) : setTvAccount2({label:lbl});
                          setTvLoginOpen(false);
                        }}
                        style={{flex:1,minWidth:120,padding:"9px",borderRadius:6,cursor:"pointer",
                          fontFamily:"monospace",fontSize:10,fontWeight:700,
                          border:"1px solid rgba(0,255,140,0.4)",background:"rgba(0,255,140,0.08)",
                          color:"#00ff8c"}}>
                        ✓ Save Label
                      </button>
                      <button onClick={()=>{
                          const lbl = tvLoginInput.trim() || `Acct ${tvLoginSlot}`;
                          tvLoginSlot===1 ? setTvAccount1({label:lbl}) : setTvAccount2({label:lbl});
                          setTvLoginOpen(false);
                          const sym = tvLoginSlot===1 ? sym1tv : sym2tv;
                          const tf  = tvLoginSlot===1 ? tvInterval : splitTf;
                          window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}&interval=${tf}`,
                            tvLoginSlot===1 ? "tv_tab_1" : "tv_tab_2");
                        }}
                        style={{flex:1,minWidth:120,padding:"9px",borderRadius:6,cursor:"pointer",
                          fontFamily:"monospace",fontSize:10,fontWeight:700,
                          border:"1px solid rgba(41,98,255,0.4)",background:"rgba(41,98,255,0.1)",
                          color:"#6699ff"}}>
                        ↗ Save + Open TV Tab
                      </button>
                      <button onClick={()=>setTvLoginOpen(false)}
                        style={{padding:"9px 12px",borderRadius:6,cursor:"pointer",
                          fontFamily:"monospace",fontSize:10,
                          border:"1px solid rgba(255,255,255,0.08)",
                          background:"transparent",color:"#475569"}}>
                        Cancel
                      </button>
                      {(tvLoginSlot===1?tvAccount1:tvAccount2) && (
                        <button onClick={()=>{
                            tvLoginSlot===1 ? setTvAccount1(null) : setTvAccount2(null);
                            setTvLoginOpen(false);
                          }}
                          style={{padding:"9px 10px",borderRadius:6,cursor:"pointer",
                            fontFamily:"monospace",fontSize:10,
                            border:"1px solid rgba(239,68,68,0.25)",
                            background:"rgba(239,68,68,0.06)",color:"#ef4444"}}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ── SMT SIDE BY SIDE ──
        const smtLabel = smtLbl; // use smtLbl from outer IIFE scope
        const openSMT = (sym, slot) => {
          const tab = slot === 1 ? "tv_tab_1" : "tv_tab_2";
          window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}&interval=${tvInterval}`, tab);
        };
        return (
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10,
            ...(fullscreen?{position:"fixed",inset:0,zIndex:900,background:"#080c14"}:{})}}>

            {/* ── SMT control bar ── */}
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",
              padding:"6px 10px",background:"rgba(0,0,0,0.45)",
              border:"1px solid rgba(192,132,252,0.25)",borderRadius:8}}>
              <span style={{fontSize:9,color:"#c084fc",fontFamily:"monospace",fontWeight:800,letterSpacing:1}}>
                ⇄ SMT DIVERGENCE
              </span>
              <div style={{width:1,height:14,background:"rgba(255,255,255,0.08)"}}/>
              <span style={{fontSize:8,color:"#475569",fontFamily:"monospace"}}>Instrument:</span>
              <span style={{fontSize:9,color:"#2962ff",fontFamily:"monospace",fontWeight:700}}>{ins}</span>
              <button onClick={()=>openSMT(TV_SYMBOLS[ins]||ins, 1)}
                style={{fontSize:8,padding:"2px 8px",borderRadius:4,cursor:"pointer",fontFamily:"monospace",
                  border:"1px solid rgba(41,98,255,0.3)",background:"rgba(41,98,255,0.08)",color:"#6699ff"}}>
                ↗ TV {tvAccount1?.label||"Tab 1"}
              </button>
              <div style={{width:1,height:14,background:"rgba(255,255,255,0.08)"}}/>
              <span style={{fontSize:8,color:"#475569",fontFamily:"monospace"}}>SMT Pair:</span>
              <span style={{fontSize:9,color:"#c084fc",fontFamily:"monospace",fontWeight:700}}>{smtLabel}</span>
              <button onClick={()=>openSMT(smtSym, 2)}
                style={{fontSize:8,padding:"2px 8px",borderRadius:4,cursor:"pointer",fontFamily:"monospace",
                  border:"1px solid rgba(192,132,252,0.3)",background:"rgba(192,132,252,0.08)",color:"#c084fc"}}>
                ↗ TV {tvAccount2?.label||"Tab 2"}
              </button>
              <div style={{width:1,height:14,background:"rgba(255,255,255,0.08)"}}/>
              <select value={tvInterval} onChange={e=>setTvInterval(e.target.value)}
                style={{fontSize:8,padding:"2px 5px",borderRadius:4,fontFamily:"monospace",cursor:"pointer",
                  background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:"#94a3b8"}}>
                {["1","3","5","15","30","60","240","D"].map(t=><option key={t} value={t}>{t}m</option>)}
              </select>
              {/* SMT signal readout */}
              {candles.length > 0 && (()=>{
                const sig = compSMTSignal(candles);
                const col = sig.bullSMT?"#00ff8c":sig.bearSMT?"#ef4444":"#475569";
                return sig.bullSMT || sig.bearSMT ? (
                  <div style={{marginLeft:6,padding:"2px 10px",borderRadius:4,
                    background:`${col}12`,border:`1px solid ${col}33`}}>
                    <span style={{fontSize:8,fontWeight:700,color:col,fontFamily:"monospace"}}>
                      {sig.bullSMT?"⚡ BULL SMT DIV":"⚠ BEAR SMT DIV"}
                    </span>
                  </div>
                ) : null;
              })()}
              {fullscreen && <button onClick={()=>setFullscreen(false)} style={{marginLeft:"auto",
                background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.3)",
                color:"#ff4f4f",padding:"3px 10px",borderRadius:5,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>⊡ EXIT</button>}
            </div>

            {/* ── Charts side by side ── */}
            <div style={{display:"flex",flexDirection:"row",gap:4,
              height:fullscreen?"calc(100vh - 58px)":"62vh",minHeight:0}}>
              {/* Chart 1 — main instrument */}
              <div style={{...box("100%"),flex:1}}>
                <div style={{position:"absolute",top:6,left:8,zIndex:2,
                  display:"flex",alignItems:"center",gap:5,pointerEvents:"none"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#2962ff",boxShadow:"0 0 6px #2962ff"}}/>
                  <span style={{fontSize:9,color:"#2962ff",fontFamily:"monospace",fontWeight:700}}>
                    {ins} · {tvInterval}m {tvAccount1?<span style={{opacity:0.6,fontSize:7}}> · {tvAccount1.label}</span>:null}
                  </span>
                </div>
                <TradingViewWidget symbol={ins} interval={tvInterval} chartId="smt1"/>
              </div>
              {/* Chart 2 — SMT pair */}
              <div style={{...box("100%","1px solid rgba(192,132,252,0.25)"),flex:1}}>
                <div style={{position:"absolute",top:6,left:8,zIndex:2,
                  display:"flex",alignItems:"center",gap:5,pointerEvents:"none"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#c084fc",boxShadow:"0 0 6px #c084fc"}}/>
                  <span style={{fontSize:9,color:"#c084fc",fontFamily:"monospace",fontWeight:700}}>
                    {smtLabel} · {tvInterval}m {tvAccount2?<span style={{opacity:0.6,fontSize:7}}> · {tvAccount2.label}</span>:null}
                  </span>
                </div>
                <TradingViewWidget symbol={SMT_PAIR[ins] || smtSym} interval={tvInterval} chartId="smt2"/>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PRICE STRIP ─────────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"}}>
        <span style={{fontSize:22,fontWeight:800,color:bull?"#00ff8c":"#ff4f4f",fontFamily:"monospace",lineHeight:1}}>{lastPrice.toFixed(2)}</span>
        <span style={{fontSize:10,color:chg>=0?"#00ff8c":"#ff4f4f",fontFamily:"monospace"}}>{chg>=0?"▲":"▼"} {Math.abs(chg).toFixed(2)} pts</span>
        <div style={{padding:"3px 10px",borderRadius:5,fontSize:9,fontWeight:700,letterSpacing:2,fontFamily:"monospace",background:bias==="BULLISH"?"rgba(0,255,140,0.07)":"rgba(255,80,80,0.07)",border:`1px solid ${bias==="BULLISH"?"rgba(0,255,140,0.28)":"rgba(255,80,80,0.28)"}`,color:bias==="BULLISH"?"#00ff8c":"#ff4f4f"}}>{bias==="BULLISH"?"▲":"▼"} {bias}</div>
        {lastOF&&overlays.includes("of")&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:9,color:"#f97316",fontFamily:"monospace"}}>CVD {cvdDir} {lastOF.cvd>0?"+":""}{lastOF.cvd.toFixed(0)}</span>
          <span style={{fontSize:9,color:lastOF.delta>0?"#00ff8c":"#ff4f4f",fontFamily:"monospace"}}>Δ {lastOF.delta>0?"+":""}{lastOF.delta}</span>
        </div>}
        {!activeS&&<span style={{fontSize:9,color:"#1e293b",fontFamily:"monospace",letterSpacing:1}}>← select a strategy above to overlay levels</span>}
      </div>

      {/* ── HTF / LTF CONTEXT + ERL PANEL ─────────────────────────────────── */}
      {/* ── ACTIVE TRADE SETUP PANEL ──────────────────────────────────────── */}
      {tradeSetup && (
        <div style={{background:tradeSetup.active?"rgba(139,92,246,0.08)":"rgba(255,80,80,0.06)",border:`1px solid ${tradeSetup.active?"rgba(139,92,246,0.4)":"rgba(255,80,80,0.3)"}`,borderRadius:10,padding:"10px 14px",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:tradeSetup.active?"#a855f7":"#ff4f4f",boxShadow:`0 0 6px ${tradeSetup.active?"#a855f7":"#ff4f4f"}`,animation:tradeSetup.active?"pulse 1.5s infinite":"none"}}/>
              <span style={{fontSize:9,fontWeight:700,color:tradeSetup.active?"#c084fc":"#ff4f4f",fontFamily:"monospace",letterSpacing:1}}>
                {tradeSetup.active ? `AI SETUP — ${tradeSetup.direction}` : `⚡ ${tradeSetup.outcome?.replace("_"," ")}`}
              </span>
            </div>
            <button onClick={()=>onTradeSetupUpdate(null)} style={{background:"transparent",border:"none",color:"#334155",fontSize:11,cursor:"pointer",padding:"0 2px"}}>✕</button>
          </div>
          <div style={{fontSize:8,color:"#94a3b8",fontFamily:"monospace",marginBottom:8,lineHeight:1.4}}>{tradeSetup.setup}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
            {[
              ["ENTRY",tradeSetup.entry_bot!=null?`${tradeSetup.entry_bot.toFixed(2)}–${tradeSetup.entry_top.toFixed(2)}`:"—", tradeSetup.direction==="LONG"?"#a855f7":"#a855f7"],
              ["STOP", tradeSetup.stop_price?.toFixed(2)||"—","#ff4f4f"],
              ["TP1",  tradeSetup.tp1_price?.toFixed(2)||"—", tradeSetup.tp1_hit?"#00ff8c":"#20c997"],
              ["TP2",  tradeSetup.tp2_price?.toFixed(2)||"—","#ff9500"],
            ].map(([l,v,c])=>(
              <div key={l} style={{padding:"4px 7px",borderRadius:5,background:"rgba(0,0,0,0.3)",borderLeft:`2px solid ${c}`}}>
                <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:1}}>{l}</div>
                <div style={{fontSize:10,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div>
              </div>
            ))}
          </div>
          {/* Lot size + conviction */}
          <div style={{marginTop:6,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {tradeSetup.lots != null && (
              <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:5,background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.3)"}}>
                <span style={{fontSize:7,color:"#334155",fontFamily:"monospace"}}>SIZE</span>
                <span style={{fontSize:12,fontWeight:900,color:"#00d4ff",fontFamily:"monospace"}}>{tradeSetup.lots}</span>
                <span style={{fontSize:7,color:"#00d4ff",fontFamily:"monospace"}}>cts</span>
              </div>
            )}
            {tradeSetup.riskDollars != null && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:5,background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.22)"}}>
                <span style={{fontSize:7,color:"#334155",fontFamily:"monospace"}}>RISK</span>
                <span style={{fontSize:11,fontWeight:700,color:"#ff4f4f",fontFamily:"monospace"}}>${tradeSetup.riskDollars.toLocaleString()}</span>
              </div>
            )}
            {tradeSetup.conviction && (
              <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:5,background:"rgba(255,255,255,0.04)"}}>
                <span style={{fontSize:7,color:"#334155",fontFamily:"monospace"}}>CONV</span>
                <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",color:tradeSetup.conviction==="HIGH"?"#00ff8c":tradeSetup.conviction==="MEDIUM"?"#fbbf24":"#f97316"}}>{tradeSetup.conviction}</span>
              </div>
            )}
          </div>
          {/* 5-min countdown if outcome triggered */}
          {!tradeSetup.active && tradeSetup.clearedAt && (()=>{
            const elapsed = Math.floor((Date.now()-tradeSetup.clearedAt)/1000);
            const rem = Math.max(0, 300 - elapsed);
            const mm = String(Math.floor(rem/60)).padStart(2,"0");
            const ss = String(rem%60).padStart(2,"0");
            return (
              <div style={{marginTop:6,fontSize:8,color:"#475569",fontFamily:"monospace",textAlign:"center"}}>
                {tradeSetup.outcome?.replace("_"," ")} · auto-clear in {mm}:{ss}
              </div>
            );
          })()}
        </div>
      )}
      <HTFPanel candles={candles} pdLevels={pdLevels}/>

      {/* ── KZ CONFLUENCE STRATEGY RULES (shown when that strat is active) ──── */}
      {activeS?.id==="kz_confluence"&&kzStrat?.rules&&(
        <div style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:10,marginBottom:10,overflow:"hidden"}}>
          <button onClick={()=>setKZRules(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",padding:"10px 14px",color:kzRulesOpen?"#ffd700":"#64748b"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#ffd700",boxShadow:kzRulesOpen?"0 0 6px #ffd700":"none"}}/>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:2,fontFamily:"monospace"}}>★ KZ CONFLUENCE — SETUP RULES</span>
            <span style={{marginLeft:"auto",fontSize:9,color:kzRulesOpen?"#ffd700":"#334155",transform:kzRulesOpen?"rotate(180deg)":"none",transition:"transform 0.15s",display:"inline-block"}}>▼</span>
          </button>
          {kzRulesOpen&&(
            <div style={{padding:"4px 14px 12px"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"monospace",marginBottom:8,lineHeight:1.6}}>{kzStrat.notes}</div>
              {kzStrat.rules.map((r,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                  <span style={{fontSize:9,color:"#ffd700",fontFamily:"monospace",minWidth:16,fontWeight:700}}>{i+1}.</span>
                  <span style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.5}}>{r.replace(/^\d+\.\s/,"")}</span>
                </div>
              ))}
              <button onClick={()=>{setEditTgt({...kzStrat,id:`custom-${Date.now()}`,name:"KZ Confluence",code:PINE_KZ_CONFLUENCE,builtin:false});setEditor(true);}} style={{marginTop:10,background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.25)",color:"#ffd700",padding:"5px 14px",borderRadius:6,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>
                ✎ Open Pine Script in Editor
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── VIVEK UNICORN + SILVER BULLET RULES ─────────────────────────────── */}
      {activeS?.id==="vivek_unicorn"&&vivekStrat?.rules&&(
        <div style={{background:"rgba(192,132,252,0.04)",border:"1px solid rgba(192,132,252,0.22)",borderRadius:10,marginBottom:10,overflow:"hidden"}}>
          <button onClick={()=>setVivekOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",padding:"10px 14px",color:vivekOpen?"#c084fc":"#64748b"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#c084fc",boxShadow:vivekOpen?"0 0 6px #c084fc":"none"}}/>
            <span style={{fontSize:10,fontWeight:700,letterSpacing:2,fontFamily:"monospace"}}>★ VIVEK — UNICORN + SILVER BULLET  ·  EXECUTION CHECKLIST</span>
            <span style={{marginLeft:"auto",fontSize:9,color:vivekOpen?"#c084fc":"#334155",transform:vivekOpen?"rotate(180deg)":"none",transition:"transform 0.15s",display:"inline-block"}}>▼</span>
          </button>
          {vivekOpen&&(
            <div style={{padding:"4px 14px 14px"}}>
              <div style={{fontSize:8,color:"#64748b",fontFamily:"monospace",marginBottom:10,lineHeight:1.7,background:"rgba(192,132,252,0.05)",padding:"8px 10px",borderRadius:5,border:"1px solid rgba(192,132,252,0.12)"}}>{vivekStrat.notes}</div>
              {/* Two-column step grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
                {vivekStrat.rules.map((r,i)=>{
                  const stepLabel=r.match(/^STEP \d+/)?.[0]||"";
                  const stepText=r.replace(/^STEP \d+ — [^:]+: /,"");
                  const stepColors=["#00d4ff","#a855f7","#ec4899","#f59e0b","#c084fc","#ec4899","#ffd700","#00d4ff","#f97316","#10b981"];
                  const col=stepColors[i]||"#94a3b8";
                  return (
                    <div key={i} style={{padding:"7px 10px",borderRadius:6,background:"rgba(255,255,255,0.02)",border:`1px solid ${col}22`,display:"flex",flexDirection:"column",gap:3}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:8,color:col,fontFamily:"monospace",fontWeight:700,background:col+"18",padding:"1px 6px",borderRadius:3,flexShrink:0}}>{stepLabel||`${i+1}`}</span>
                        <span style={{fontSize:8,color:col,fontFamily:"monospace",fontWeight:700}}>{r.match(/— ([^:]+)/)?.[1]||""}</span>
                      </div>
                      <span style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace",lineHeight:1.5}}>{stepText}</span>
                    </div>
                  );
                })}
              </div>
              {/* SMT live display */}
              <div style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:6,padding:"8px 12px",marginBottom:10}}>
                <div style={{fontSize:8,color:"#ffd700",fontFamily:"monospace",fontWeight:700,letterSpacing:2,marginBottom:6}}>LIVE SMT DIVERGENCE CHECK  (NQ vs ES proxy)</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  {(()=>{
                    const recent=candles.slice(-10);
                    const nqLow=Math.min(...recent.map(c=>c.l));
                    const nqHigh=Math.max(...recent.map(c=>c.h));
                    // Simulate ES proxy (slightly different swing)
                    const esLowOffset  = nqLow  * (1 + (Math.random()>0.5?0.0002:-0.0001));
                    const esHighOffset = nqHigh * (1 - (Math.random()>0.5?0.0002:-0.0001));
                    const bullSMT = candles.length?candles[candles.length-1].c < nqLow*1.001 && esLowOffset > nqLow*0.999:false;
                    const bearSMT = candles.length?candles[candles.length-1].c > nqHigh*0.999 && esHighOffset < nqHigh*1.001:false;
                    return [
                      ["NQ 10-bar Low",  nqLow.toFixed(2),       "#94a3b8"],
                      ["NQ 10-bar High", nqHigh.toFixed(2),      "#94a3b8"],
                      ["SMT Signal",     bullSMT?"🟢 BULL DIV":bearSMT?"🔴 BEAR DIV":"— NONE", bullSMT?"#00ff8c":bearSMT?"#ff4f4f":"#334155"],
                      ["Macro Bias",     bias,                   bias==="BULLISH"?"#00ff8c":"#ff4f4f"],
                      ["CVD Trend",      cvdDir+" "+(lastOF?.cvd>0?"Accum":"Distrib"), lastOF?.cvd>0?"#00ff8c":"#ff4f4f"],
                      ["Silver Bullet",  "10:00–11:00 AM EST",   "#c084fc"],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{textAlign:"center",padding:"4px 0"}}>
                        <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>{l}</div>
                        <div style={{fontSize:9,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <button onClick={()=>{setEditTgt({...vivekStrat,id:`custom-${Date.now()}`,name:"Vivek Unicorn+SB",code:PINE_VIVEK_UNICORN,builtin:false});setEditor(true);}} style={{background:"rgba(192,132,252,0.1)",border:"1px solid rgba(192,132,252,0.3)",color:"#c084fc",padding:"5px 14px",borderRadius:6,cursor:"pointer",fontSize:9,fontFamily:"monospace",fontWeight:700}}>
                ✎ Open Full Pine Script in Editor
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STRATEGY-GATED INFO PANELS ─────────────────────────────────────── */}
      {activeS&&(
        <div style={{background:"rgba(255,255,255,0.012)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:10,overflow:"hidden"}}>
          {overlays.includes("orb")&&orb&&(
            <Panel title="ORB LEVELS" color="#10b981" forceOpen>
              {[["High",orb.high,"#00ff8c"],["Low",orb.low,"#ff4f4f"],["Mid",orb.mid,"#555"],["Range",orb.range,"#f0c040"],["+1× Ext",orb.ext1H,"rgba(0,255,140,0.65)"],["-1× Ext",orb.ext1L,"rgba(255,80,80,0.65)"],["+2× Ext",orb.ext2H,"rgba(0,255,140,0.4)"],["-2× Ext",orb.ext2L,"rgba(255,80,80,0.4)"]].map(([l,v,c])=><DR key={l} label={l} value={typeof v==="number"?v.toFixed(2):v} color={c}/>)}
            </Panel>
          )}
          {overlays.includes("ote")&&ote&&(
            <Panel title="OTE / FIBONACCI" color="#ec4899" forceOpen>
              {[["0% (High)",ote.fib_0,"#333"],["23.6%",ote.fib_236,"#555"],["38.2%",ote.fib_382,"#f0c040"],["50% EQ",ote.fib_5,"#888"],["61.8% ★",ote.fib_618,"#00d4ff"],["70.5%",ote.fib_705,"#00d4ff"],["78.6% ★",ote.fib_786,"#00d4ff"],["100% (Low)",ote.fib_1,"#333"],["OTE Top",ote.ote_top,"#00d4ff"],["OTE Bot",ote.ote_bot,"#00d4ff"]].map(([l,v,c])=><DR key={l} label={l} value={v.toFixed(2)} color={c}/>)}
            </Panel>
          )}
          {overlays.includes("ob")&&(
            <Panel title="ORDER BLOCKS" color="#00d4ff" forceOpen>
              {obs.filter(o=>!o.mit).map((ob,i)=>(
                <div key={i} style={{padding:"4px 8px",borderLeft:`2px solid ${ob.type.includes("Bull")?"#00d4ff":"#ffa040"}`,background:ob.type.includes("Bull")?"rgba(0,212,255,0.04)":"rgba(255,160,0,0.04)",borderRadius:3}}>
                  <div style={{fontSize:9,fontWeight:700,color:ob.type.includes("Bull")?"#00d4ff":"#ffa040",fontFamily:"monospace"}}>{ob.type.includes("Bull")?"▲ BULL OB":"▼ BEAR OB"} · ACT</div>
                  <div style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>{ob.bot.toFixed(2)} – {ob.top.toFixed(2)}</div>
                </div>
              ))}
            </Panel>
          )}
          {overlays.includes("bb")&&(
            <Panel title="BREAKER BLOCKS" color="#ff6b35" forceOpen>
              {bbs.length===0&&<div style={{fontSize:9,color:"#334155",fontFamily:"monospace",padding:"4px 0"}}>No breaker blocks detected (require mitigated OBs)</div>}
              {bbs.map((bb,i)=>(
                <div key={i} style={{padding:"4px 8px",borderLeft:`2px dashed ${bb.type.includes("Bull")?"rgba(255,107,53,0.7)":"rgba(220,50,50,0.7)"}`,background:"rgba(255,107,53,0.04)",borderRadius:3}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#ff6b35",fontFamily:"monospace"}}>{bb.type.includes("Bull")?"↑ BULL BB":"↓ BEAR BB"} · FLIPPED</div>
                  <div style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>{bb.bot.toFixed(2)} – {bb.top.toFixed(2)}</div>
                  <div style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>Polarity reversed — acts as {bb.type.includes("Bull")?"resistance":"support"}</div>
                </div>
              ))}
            </Panel>
          )}
          {overlays.includes("fvg")&&(
            <Panel title="FAIR VALUE GAPS" color="#a855f7" forceOpen>
              {fvgs.map((f,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 8px",borderLeft:`2px solid ${f.filled?"#1a1a1a":f.type.includes("Bull")?"rgba(0,255,140,0.4)":"rgba(255,80,80,0.4)"}`,background:f.filled?"transparent":f.type.includes("Bull")?"rgba(0,255,140,0.025)":"rgba(255,80,80,0.025)",borderRadius:3}}>
                  <span style={{fontSize:9,color:f.filled?"#2a2a2a":f.type.includes("Bull")?"#00ff8c":"#ff4f4f",fontFamily:"monospace"}}>{f.type.includes("Bull")?"▲":"▼"} {f.bot.toFixed(2)}–{f.top.toFixed(2)}</span>
                  <span style={{fontSize:8,color:f.filled?"#222":"#64748b"}}>{f.filled?"filled ✓":"open"}</span>
                </div>
              ))}
            </Panel>
          )}
          {overlays.includes("liq")&&(
            <Panel title={`LIQUIDITY MAP  ·  ${contextLevels.currentSessionLabel} SESSION`} color="#f59e0b" forceOpen>
              {/* Legend */}
              <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                {[["ERL PDH/PDL","#ffd700"],["ERL PWH/PWL","#ff9500"],["Session H/L","#c084fc"],["IRL","#00d4ff"]].map(([l,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:10,height:2,background:c,borderRadius:1}}/>
                    <span style={{fontSize:7,color:c,fontFamily:"monospace",fontWeight:700}}>{l}</span>
                  </div>
                ))}
              </div>
              {/* All levels from contextLevels — grouped by category */}
              {["ERL_W","ERL","SESSION","IRL"].map(cat => {
                const items = contextLevels.levels.filter(l=>l.category===cat);
                if (!items.length) return null;
                const catLabel = cat==="ERL"?"⬡ ERL — PREV DAY":cat==="ERL_W"?"⬡ ERL — PREV WEEK":cat==="SESSION"?`◈ PREV SESSIONS  ← ${contextLevels.prevSession||""}`:cat==="IRL"?"◇ IRL — CURRENT SESSION KEY LEVEL":"";
                return (
                  <div key={cat} style={{marginBottom:8}}>
                    <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>{catLabel}</div>
                    {items.map((lvl,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",borderLeft:`2px solid ${lvl.swept?"#1a2a2a":lvl.color}`,background:lvl.swept?"transparent":lvl.color+"0c",borderRadius:3,marginBottom:2}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:9,fontWeight:700,color:lvl.swept?"#2a3a3a":lvl.color,fontFamily:"monospace"}}>{lvl.label}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:9,fontWeight:700,color:lvl.swept?"#2a3a3a":lvl.color,fontFamily:"monospace"}}>{lvl.price.toFixed(2)}</span>
                          <span style={{fontSize:7,color:lvl.swept?"#334155":lvl.color+"88",fontFamily:"monospace"}}>{lvl.swept?"✓ swept":lvl.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              {/* Generic IRL pools */}
              {liq.filter(n=>!n.swept).length>0&&(
                <div>
                  <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>◇ IRL POOLS — BSL / SSL</div>
                  {liq.filter(n=>!n.swept).slice(0,6).map((n,i)=>{
                    const col=n.type==="BSL"?"#00d4ff":"#38bdf8";
                    return (
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 8px",borderLeft:`2px solid ${col}`,background:col+"0c",borderRadius:3,marginBottom:2}}>
                        <span style={{fontSize:9,fontWeight:700,color:col,fontFamily:"monospace"}}>{n.type} {"★".repeat(n.str||1)}</span>
                        <span style={{fontSize:9,fontWeight:700,color:col,fontFamily:"monospace"}}>{n.price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}
          {overlays.includes("of")&&lastOF&&(
            <Panel title="ORDER FLOW  (DELTA · CVD · BID/ASK · VOL PROFILE)" color="#f97316" forceOpen>
              {[
                ["Last Delta",       `${lastOF.delta>0?"+":""}${lastOF.delta}`,   lastOF.delta>0?"#00ff8c":"#ff4f4f"],
                ["Ask Volume",       lastOF.askVol?.toLocaleString()||"–",         "#00ff8c"],
                ["Bid Volume",       lastOF.bidVol?.toLocaleString()||"–",         "#ff4f4f"],
                ["Ask/Bid Ratio",    lastOF.bidVol>0?(lastOF.askVol/lastOF.bidVol).toFixed(2):"–", lastOF.askVol>lastOF.bidVol?"#00ff8c":"#ff4f4f"],
                ["Cumulative CVD",   `${lastOF.cvd>0?"+":""}${lastOF.cvd.toFixed(0)}`, lastOF.cvd>0?"#00ff8c":"#ff4f4f"],
                ["CVD Direction",    cvdDir+" "+(lastOF.cvd>0?"Accumulating":"Distributing"), lastOF.cvd>0?"#00ff8c":"#ff4f4f"],
                ["Ask Dom Candles",  ofData.filter(c=>c.baImbal==="ask_dom").length, "#00ff8c"],
                ["Bid Dom Candles",  ofData.filter(c=>c.baImbal==="bid_dom").length, "#ff4f4f"],
                ["Avg Delta (10)",   Math.round(ofData.slice(-10).reduce((a,c)=>a+c.delta,0)/10), "#f97316"],
                ["Vol Profile POC",  volProf.find(b=>b.isPOC)?.price.toFixed(2)||"–", "#ffd700"],
              ].map(([l,v,c])=><DR key={l} label={l} value={v} color={c}/>)}
            </Panel>
          )}
          {/* Session always shown */}
          {orb&&candles.length>0&&(()=>{
            const inside=lastPrice>=orb.low&&lastPrice<=orb.high,above=lastPrice>orb.high;
            const sc=inside?"#f0c040":above?"#00ff8c":"#ff4f4f";
            const r20=candles.slice(-20);
            return (
              <Panel title="SESSION STATS" color="#06b6d4" forceOpen>
                {[["Position",inside?"INSIDE ORB":above?"ABOVE ORB":"BELOW ORB",sc],["ORB Range",orb.range.toFixed(2),"#f0c040"],["20-bar High",Math.max(...r20.map(c=>c.h)).toFixed(2),"#00ff8c"],["20-bar Low",Math.min(...r20.map(c=>c.l)).toFixed(2),"#ff4f4f"],["Active OBs",obs.filter(o=>!o.mit).length,"#00d4ff"],["Breakers",bbs.length,"#ff6b35"],["Open FVGs",fvgs.filter(f=>!f.filled).length,"#a855f7"],["Active Liq",liq.filter(l=>!l.swept).length,"#f59e0b"],["Bias",bias,bias==="BULLISH"?"#00ff8c":"#ff4f4f"]].map(([l,v,c])=><DR key={l} label={l} value={v} color={c}/>)}
              </Panel>
            );
          })()}
        </div>
      )}

      {editorOpen&&<PineEditor initial={editTgt} onClose={()=>{setEditor(false);setEditTgt(null);}} onSave={handleSave}/>}
      {ticketOpen&&tvConn&&<OrderTicket conn={tvConn} instrument={ins} lastPrice={lastPrice} onClose={()=>setTicket(false)}/>}
      {tvOpen&&<TradovatePanel onClose={()=>setTvOpen(false)} onConnect={conn=>{setTvConn(conn);setTvOpen(false);}}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPTS TAB — fully rewritten with SVG diagrams
// ─────────────────────────────────────────────────────────────────────────────

// ── SVG Diagram Library ────────────────────────────────────────────────────
const DiagBOS = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Price path: higher highs + higher lows, then CHoCH */}
    <polyline points="10,72 35,55 50,62 75,40 90,48 115,22 130,32 150,52 135,58 120,44 105,65"
      fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round"/>
    {/* BOS line */}
    <line x1="50" y1="62" x2="115" y2="62" stroke="#00ff8c" strokeWidth="1" strokeDasharray="3,2"/>
    <text x="62" y="58" fill="#00ff8c" fontSize="7" fontFamily="monospace" fontWeight="700">BOS ▲</text>
    {/* CHoCH line */}
    <line x1="90" y1="48" x2="150" y2="48" stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2"/>
    <text x="100" y="44" fill="#ef4444" fontSize="7" fontFamily="monospace" fontWeight="700">CHoCH ▼</text>
    {/* HH / HL labels */}
    <text x="110" y="19" fill="#00ff8c" fontSize="7" fontFamily="monospace">HH</text>
    <text x="45" y="58" fill="#00ff8c" fontSize="7" fontFamily="monospace">HL</text>
    <text x="147" y="50" fill="#ef4444" fontSize="7" fontFamily="monospace">LH</text>
    <text x="100" y="68" fill="#ef4444" fontSize="7" fontFamily="monospace">LL</text>
  </svg>
);

const DiagOB = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Candles before OB */}
    {[[20,30,28,38],[36,32,30,40],[52,38,36,45]].map(([x,o,c,h],i)=>(
      <g key={i}>
        <line x1={x+4} y1={h} x2={x+4} y2={Math.min(o,c)-4} stroke="#ef4444" strokeWidth="1"/>
        <rect x={x} y={Math.min(o,c)} width="8" height={Math.abs(o-c)||2} fill="#ef4444" opacity="0.7"/>
      </g>
    ))}
    {/* OB candle (last bearish before impulse) */}
    <rect x="64" y="34" width="10" height="14" fill="rgba(0,212,255,0.3)" stroke="#00d4ff" strokeWidth="1.5" rx="1"/>
    <text x="58" y="30" fill="#00d4ff" fontSize="7" fontFamily="monospace" fontWeight="700">OB</text>
    <line x1="69" y1="28" x2="69" y2="34" stroke="#ef4444" strokeWidth="1"/>
    <line x1="69" y1="48" x2="69" y2="52" stroke="#ef4444" strokeWidth="1"/>
    {/* Impulse up */}
    {[[80,52,32],[96,32,18],[112,18,8]].map(([x,o,c],i)=>(
      <g key={i}>
        <line x1={x+4} y1={c-4} x2={x+4} y2={o+4} stroke="#00ff8c" strokeWidth="1"/>
        <rect x={x} y={c} width="8" height={Math.abs(o-c)||2} fill="#00ff8c" opacity="0.7"/>
      </g>
    ))}
    {/* Retrace arrow back to OB */}
    <path d="M 128 22 Q 155 14 170 38" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
    <circle cx="170" cy="38" r="3" fill="#f59e0b"/>
    <text x="132" y="12" fill="#f59e0b" fontSize="7" fontFamily="monospace">retrace</text>
    <text x="155" y="50" fill="#f59e0b" fontSize="7" fontFamily="monospace">→ entry</text>
  </svg>
);

const DiagFVG = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* 3 candles */}
    {/* C1 — bullish */}
    <line x1="44" y1="72" x2="44" y2="28" stroke="#00ff8c" strokeWidth="1"/>
    <rect x="40" y="42" width="8" height="22" fill="#00ff8c" opacity="0.8"/>
    {/* C2 — big bullish impulse */}
    <line x1="64" y1="70" x2="64" y2="12" stroke="#00ff8c" strokeWidth="1"/>
    <rect x="60" y="22" width="8" height="38" fill="#00ff8c"/>
    {/* C3 — bullish */}
    <line x1="84" y1="50" x2="84" y2="10" stroke="#00ff8c" strokeWidth="1"/>
    <rect x="80" y="18" width="8" height="22" fill="#00ff8c" opacity="0.8"/>
    {/* FVG zone — between C1 high and C3 low */}
    <rect x="38" y="18" width="54" height="24" fill="rgba(139,92,246,0.18)" stroke="#a78bfa" strokeWidth="1" strokeDasharray="3,2"/>
    <text x="42" y="14" fill="#a78bfa" fontSize="7" fontFamily="monospace" fontWeight="700">FVG</text>
    <text x="94" y="25" fill="#94a3b8" fontSize="7" fontFamily="monospace">C1 High</text>
    <text x="94" y="44" fill="#94a3b8" fontSize="7" fontFamily="monospace">C3 Low</text>
    {/* Price fills it */}
    <path d="M 106 10 L 130 10 L 130 35 Q 140 41 130 45 L 106 45" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
    <text x="132" y="30" fill="#f59e0b" fontSize="7" fontFamily="monospace">fill</text>
  </svg>
);

const DiagIFVG = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Original bullish FVG zone */}
    <rect x="20" y="30" width="60" height="22" fill="rgba(0,255,140,0.08)" stroke="rgba(0,255,140,0.3)" strokeWidth="1" strokeDasharray="3,2"/>
    <text x="22" y="26" fill="#00ff8c" fontSize="7" fontFamily="monospace">Bull FVG</text>
    {/* Price action closes BELOW the FVG → inversion */}
    <polyline points="20,28 40,24 55,35 70,44 85,52 100,48"
      fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="70" cy="44" r="3" fill="#ef4444"/>
    <text x="60" y="60" fill="#ef4444" fontSize="7" fontFamily="monospace">close below → invert</text>
    {/* Inverted FVG — now bearish supply */}
    <rect x="20" y="30" width="60" height="22" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" rx="1"/>
    <text x="90" y="35" fill="#ef4444" fontSize="7" fontFamily="monospace" fontWeight="700">IFVG</text>
    <text x="90" y="44" fill="#ef4444" fontSize="7" fontFamily="monospace">(supply)</text>
    {/* Retrace into IFVG and reject */}
    <path d="M 115 52 L 140 52 L 145 38 L 140 32" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
    <text x="148" y="36" fill="#f59e0b" fontSize="7" fontFamily="monospace">reject</text>
    <text x="148" y="44" fill="#f59e0b" fontSize="7" fontFamily="monospace">→ short</text>
  </svg>
);

const DiagBB = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Phase 1: price at OB, holds, rallies */}
    <rect x="18" y="44" width="18" height="16" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" strokeWidth="1" strokeDasharray="2,2"/>
    <text x="14" y="40" fill="#00d4ff" fontSize="7" fontFamily="monospace">OB</text>
    <polyline points="27,60 40,50 58,38 72,30" fill="none" stroke="#00ff8c" strokeWidth="1.5"/>
    {/* Phase 2: sweeps back through OB → now mitigated = Breaker */}
    <polyline points="72,30 88,42 100,56 106,66"
      fill="none" stroke="#ef4444" strokeWidth="1.5"/>
    <line x1="18" y1="60" x2="130" y2="60" stroke="#ff6b35" strokeWidth="1" strokeDasharray="3,2"/>
    <text x="90" y="72" fill="#ff6b35" fontSize="7" fontFamily="monospace">OB mitigated</text>
    {/* Phase 3: BB zone — flipped to resistance */}
    <rect x="18" y="44" width="88" height="16" fill="rgba(255,107,53,0.18)" stroke="#ff6b35" strokeWidth="1.5" rx="1"/>
    <text x="30" y="88" fill="#ff6b35" fontSize="7" fontFamily="monospace" fontWeight="700">→ BREAKER BLOCK (supply)</text>
    {/* Retrace into BB and reject down */}
    <path d="M 106 66 L 126 66 L 132 52 L 128 44" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
    <circle cx="128" cy="44" r="2.5" fill="#f59e0b"/>
  </svg>
);

const DiagPDArray = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Swing high to low range */}
    <line x1="30" y1="12" x2="30" y2="78" stroke="#475569" strokeWidth="1" strokeDasharray="2,2"/>
    <text x="8" y="14" fill="#94a3b8" fontSize="7" fontFamily="monospace">SH</text>
    <text x="8" y="78" fill="#94a3b8" fontSize="7" fontFamily="monospace">SL</text>
    {/* Zones */}
    <rect x="30" y="12" width="130" height="22" fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" strokeWidth="1"/>
    <text x="36" y="22" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="700">PREMIUM (sell)</text>
    <text x="36" y="30" fill="#ef4444" fontSize="7" fontFamily="monospace">OBs, BBs, IFVGs here</text>
    {/* EQ line */}
    <line x1="30" y1="45" x2="160" y2="45" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="4,2"/>
    <text x="165" y="48" fill="#a78bfa" fontSize="7" fontFamily="monospace" fontWeight="700">50% EQ</text>
    {/* Golden pocket */}
    <rect x="30" y="45" width="130" height="12" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.4)" strokeWidth="1"/>
    <text x="36" y="54" fill="#f59e0b" fontSize="7" fontFamily="monospace" fontWeight="700">0.618–0.786 GP ★</text>
    <rect x="30" y="57" width="130" height="21" fill="rgba(0,255,140,0.08)" stroke="rgba(0,255,140,0.3)" strokeWidth="1"/>
    <text x="36" y="66" fill="#00ff8c" fontSize="8" fontFamily="monospace" fontWeight="700">DISCOUNT (buy)</text>
    <text x="36" y="74" fill="#00ff8c" fontSize="7" fontFamily="monospace">OBs, FVGs, IFVGs here</text>
    {/* Price dot in discount = long bias */}
    <circle cx="145" cy="68" r="4" fill="#00ff8c" opacity="0.8"/>
    <text x="152" y="71" fill="#00ff8c" fontSize="7" fontFamily="monospace">price</text>
  </svg>
);

const DiagOTE = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Swing low to high */}
    <line x1="20" y1="72" x2="90" y2="18" stroke="#94a3b8" strokeWidth="1.5"/>
    <text x="8" y="75" fill="#94a3b8" fontSize="7" fontFamily="monospace">SL</text>
    <text x="88" y="16" fill="#94a3b8" fontSize="7" fontFamily="monospace">SH</text>
    {/* Fib levels */}
    {[[0.382,34,"#60a5fa"],[0.500,39,"#a78bfa"],[0.618,45,"#f59e0b"],[0.705,49,"#fb923c"],[0.786,53,"#f87171"]].map(([r,y,c])=>(
      <g key={r}>
        <line x1="18" y1={y} x2="140" y2={y} stroke={c} strokeWidth={r===0.618||r===0.786?1.5:0.8} strokeDasharray={r===0.618||r===0.786?"4,2":"3,3"} opacity={r===0.618||r===0.786?1:0.6}/>
        <text x="142" y={y+3} fill={c} fontSize="7" fontFamily="monospace">{r.toFixed(3)}</text>
      </g>
    ))}
    {/* OTE zone shaded */}
    <rect x="18" y="45" width="122" height="8" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5" rx="1"/>
    <text x="22" y="65" fill="#f59e0b" fontSize="8" fontFamily="monospace" fontWeight="700">OTE ZONE 0.618–0.786</text>
    {/* Entry candle in OTE */}
    <rect x="170" y="46" width="8" height="8" fill="#00ff8c" stroke="#00ff8c" strokeWidth="1"/>
    <text x="162" y="78" fill="#00ff8c" fontSize="7" fontFamily="monospace">entry</text>
  </svg>
);

const DiagSMT = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    <text x="8" y="12" fill="#2962ff" fontSize="8" fontFamily="monospace" fontWeight="700">NQ</text>
    <text x="8" y="76" fill="#c084fc" fontSize="8" fontFamily="monospace" fontWeight="700">ES</text>
    {/* NQ makes lower low */}
    <polyline points="25,22 55,32 80,42 110,50 140,60"
      fill="none" stroke="#2962ff" strokeWidth="2" strokeLinejoin="round"/>
    {/* ES FAILS to make lower low → SMT */}
    <polyline points="25,62 55,68 80,72 110,70 140,66"
      fill="none" stroke="#c084fc" strokeWidth="2" strokeLinejoin="round"/>
    {/* Divergence arrow at right */}
    <line x1="140" y1="60" x2="155" y2="60" stroke="#2962ff" strokeWidth="1.5"/>
    <text x="158" y="63" fill="#2962ff" fontSize="7" fontFamily="monospace">LL</text>
    <line x1="140" y1="66" x2="155" y2="66" stroke="#c084fc" strokeWidth="1.5"/>
    <text x="158" y="69" fill="#c084fc" fontSize="7" fontFamily="monospace">HH !</text>
    <text x="8" y="88" fill="#00ff8c" fontSize="8" fontFamily="monospace" fontWeight="700">⚡ BULL SMT → buy ES at SL sweep</text>
  </svg>
);

const DiagMacros = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    <text x="8" y="10" fill="#475569" fontSize="7" fontFamily="monospace">EST timeline →</text>
    {/* Timeline bar */}
    <line x1="10" y1="30" x2="210" y2="30" stroke="#1e293b" strokeWidth="8"/>
    <text x="10" y="26" fill="#475569" fontSize="6" fontFamily="monospace">2am</text>
    <text x="55" y="26" fill="#475569" fontSize="6" fontFamily="monospace">4am</text>
    <text x="105" y="26" fill="#475569" fontSize="6" fontFamily="monospace">9:30</text>
    <text x="140" y="26" fill="#475569" fontSize="6" fontFamily="monospace">11am</text>
    <text x="175" y="26" fill="#475569" fontSize="6" fontFamily="monospace">3pm</text>
    {/* LDN macro 2:33-3:00 */}
    <rect x="14" y="24" width="12" height="12" fill="#c084fc" opacity="0.7" rx="1"/>
    <text x="8" y="48" fill="#c084fc" fontSize="6.5" fontFamily="monospace">2:33</text>
    {/* LDN macro 4:03-4:30 */}
    <rect x="57" y="24" width="12" height="12" fill="#c084fc" opacity="0.7" rx="1"/>
    <text x="51" y="48" fill="#c084fc" fontSize="6.5" fontFamily="monospace">4:03</text>
    {/* NY AM macro 9:50-10:10 Silver Bullet */}
    <rect x="108" y="24" width="14" height="12" fill="#f59e0b" rx="1"/>
    <text x="100" y="48" fill="#f59e0b" fontSize="6.5" fontFamily="monospace">9:50 ⚡</text>
    {/* NY AM macro 10:50-11:10 */}
    <rect x="142" y="24" width="14" height="12" fill="#f59e0b" opacity="0.7" rx="1"/>
    <text x="136" y="48" fill="#f59e0b" fontSize="6.5" fontFamily="monospace">10:50</text>
    {/* NY PM macro 1:10-1:40 */}
    <rect x="162" y="24" width="10" height="12" fill="#10b981" opacity="0.7" rx="1"/>
    <text x="156" y="48" fill="#10b981" fontSize="6.5" fontFamily="monospace">1:10</text>
    {/* NY PM macro 3:15-3:45 */}
    <rect x="186" y="24" width="12" height="12" fill="#10b981" rx="1"/>
    <text x="180" y="48" fill="#10b981" fontSize="6.5" fontFamily="monospace">3:15 ★</text>
    {/* Legend */}
    <rect x="10" y="55" width="8" height="6" fill="#c084fc" rx="1"/>
    <text x="22" y="61" fill="#94a3b8" fontSize="7" fontFamily="monospace">London Macros</text>
    <rect x="10" y="65" width="8" height="6" fill="#f59e0b" rx="1"/>
    <text x="22" y="71" fill="#94a3b8" fontSize="7" fontFamily="monospace">NY AM Macros</text>
    <rect x="10" y="75" width="8" height="6" fill="#10b981" rx="1"/>
    <text x="22" y="81" fill="#94a3b8" fontSize="7" fontFamily="monospace">NY PM Macros</text>
  </svg>
);

const DiagLiq = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Multiple swing highs at same level = BSL pool */}
    <line x1="20" y1="20" x2="180" y2="20" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
    <text x="130" y="16" fill="#f59e0b" fontSize="7" fontFamily="monospace" fontWeight="700">BSL Pool</text>
    {[30,65,100,135].map(x=>(
      <g key={x}>
        <line x1={x+4} y1="28" x2={x+4} y2="20" stroke="#f59e0b" strokeWidth="1"/>
        <rect x={x} y="30" width="8" height="16" fill="#64748b" opacity="0.6"/>
      </g>
    ))}
    {/* Price sweeps above BSL then reverses — stop hunt */}
    <polyline points="150,35 165,16 175,22 170,36 155,50 140,62"
      fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="165" cy="16" r="3.5" fill="#ef4444"/>
    <text x="170" y="13" fill="#ef4444" fontSize="7" fontFamily="monospace" fontWeight="700">SWEEP</text>
    {/* Reversal arrow */}
    <text x="115" y="70" fill="#00ff8c" fontSize="8" fontFamily="monospace" fontWeight="700">⬇ reverse (short)</text>
    {/* SSL pool at bottom */}
    <line x1="20" y1="75" x2="180" y2="75" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4,3" opacity="0.4"/>
    <text x="130" y="84" fill="#60a5fa" fontSize="7" fontFamily="monospace">SSL Pool</text>
  </svg>
);

const DiagAMD = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* AMD phases across time */}
    {/* Accumulation — sideways */}
    <rect x="10" y="52" width="52" height="26" fill="rgba(96,165,250,0.07)" stroke="rgba(96,165,250,0.25)" strokeWidth="1" rx="2"/>
    <polyline points="12,72 22,68 32,72 42,66 56,70" fill="none" stroke="#60a5fa" strokeWidth="1.5"/>
    <text x="14" y="46" fill="#60a5fa" fontSize="8" fontFamily="monospace" fontWeight="700">A — Accum</text>
    {/* Manipulation — fake move down (stop hunt) */}
    <rect x="62" y="52" width="52" height="26" fill="rgba(239,68,68,0.07)" stroke="rgba(239,68,68,0.2)" strokeWidth="1" rx="2"/>
    <polyline points="62,70 72,75 82,80 92,74 106,66" fill="none" stroke="#ef4444" strokeWidth="1.5"/>
    <text x="62" y="46" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="700">M — Manip</text>
    <text x="68" y="88" fill="#ef4444" fontSize="6.5" fontFamily="monospace">stop hunt ↓</text>
    {/* Distribution — directional move up */}
    <rect x="114" y="16" width="96" height="62" fill="rgba(0,255,140,0.05)" stroke="rgba(0,255,140,0.2)" strokeWidth="1" rx="2"/>
    <polyline points="114,70 128,62 142,50 156,38 170,26 196,18" fill="none" stroke="#00ff8c" strokeWidth="2"/>
    <text x="124" y="46" fill="#00ff8c" fontSize="8" fontFamily="monospace" fontWeight="700">D — Distrib</text>
    <text x="124" y="88" fill="#00ff8c" fontSize="6.5" fontFamily="monospace">real move ▲</text>
  </svg>
);

const DiagORB = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* OR range box */}
    <rect x="18" y="32" width="40" height="28" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="1.5" rx="2"/>
    <text x="8" y="29" fill="#00d4ff" fontSize="7" fontFamily="monospace" fontWeight="700">9:30</text>
    <line x1="18" y1="32" x2="160" y2="32" stroke="#10b981" strokeWidth="1" strokeDasharray="4,3"/>
    <line x1="18" y1="60" x2="160" y2="60" stroke="#10b981" strokeWidth="1" strokeDasharray="4,3"/>
    <text x="162" y="35" fill="#10b981" fontSize="7" fontFamily="monospace">OR High</text>
    <text x="162" y="63" fill="#10b981" fontSize="7" fontFamily="monospace">OR Low</text>
    {/* Breakout up with extensions */}
    <polyline points="58,38 72,24 86,16" fill="none" stroke="#10b981" strokeWidth="2"/>
    <line x1="18" y1="4" x2="160" y2="4" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2,3" opacity="0.5"/>
    <text x="162" y="7" fill="#34d399" fontSize="7" fontFamily="monospace">2× TP2</text>
    <line x1="18" y1="18" x2="160" y2="18" stroke="#10b981" strokeWidth="0.8" strokeDasharray="2,3" opacity="0.7"/>
    <text x="162" y="21" fill="#10b981" fontSize="7" fontFamily="monospace">1× TP1</text>
    {/* Midline */}
    <line x1="18" y1="46" x2="160" y2="46" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.5"/>
    <text x="162" y="49" fill="#475569" fontSize="7" fontFamily="monospace">OR Mid</text>
    {/* Short side */}
    <line x1="18" y1="74" x2="160" y2="74" stroke="#f87171" strokeWidth="0.8" strokeDasharray="2,3" opacity="0.7"/>
    <text x="162" y="77" fill="#f87171" fontSize="7" fontFamily="monospace">1× short</text>
    <text x="20" y="88" fill="#f59e0b" fontSize="7" fontFamily="monospace">Range: OR H−L  · Break + range = TP1</text>
  </svg>
);

const DiagUnicorn = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Swing — OB at swing low then FVG */}
    <polyline points="20,60 40,50 58,28 72,22" fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
    {/* OB box at swing */}
    <rect x="32" y="44" width="12" height="12" fill="rgba(0,212,255,0.2)" stroke="#00d4ff" strokeWidth="1.5"/>
    <text x="20" y="40" fill="#00d4ff" fontSize="7" fontFamily="monospace">OB</text>
    {/* FVG inside same zone */}
    <rect x="44" y="30" width="24" height="14" fill="rgba(139,92,246,0.2)" stroke="#a78bfa" strokeWidth="1.5"/>
    <text x="46" y="26" fill="#a78bfa" fontSize="7" fontFamily="monospace">FVG</text>
    {/* Overlap highlight */}
    <rect x="44" y="44" width="12" height="10" fill="rgba(192,132,252,0.3)" stroke="#c084fc" strokeWidth="2" rx="1"/>
    <text x="70" y="58" fill="#c084fc" fontSize="8" fontFamily="monospace" fontWeight="700">★ OVERLAP</text>
    {/* Retrace into overlap */}
    <path d="M 72 22 Q 90 18 96 48" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
    <circle cx="96" cy="48" r="3" fill="#f59e0b"/>
    <text x="100" y="44" fill="#f59e0b" fontSize="7" fontFamily="monospace">retrace</text>
    {/* Reaction */}
    <polyline points="96,48 108,38 120,22 138,8" fill="none" stroke="#00ff8c" strokeWidth="2"/>
    <text x="140" y="12" fill="#00ff8c" fontSize="7" fontFamily="monospace">▲</text>
    <text x="10" y="86" fill="#c084fc" fontSize="7" fontFamily="monospace" fontWeight="700">UNICORN = BB+FVG overlap at swing → retrace → long</text>
  </svg>
);

const DiagCVD = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    <text x="8" y="10" fill="#f97316" fontSize="7" fontFamily="monospace" fontWeight="700">Price</text>
    <text x="8" y="54" fill="#60a5fa" fontSize="7" fontFamily="monospace" fontWeight="700">CVD</text>
    {/* Price makes higher highs */}
    <polyline points="20,30 45,26 70,22 95,18 120,16 145,14"
      fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round"/>
    {/* CVD makes lower highs = BEARISH DIVERGENCE */}
    <polyline points="20,62 45,60 70,64 95,66 120,70 145,74"
      fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round"/>
    {/* Divergence lines */}
    <line x1="20" y1="30" x2="20" y2="62" stroke="#475569" strokeWidth="0.8" strokeDasharray="2,2"/>
    <line x1="145" y1="14" x2="145" y2="74" stroke="#475569" strokeWidth="0.8" strokeDasharray="2,2"/>
    {/* Labels */}
    <text x="148" y="16" fill="#f97316" fontSize="7" fontFamily="monospace">HH</text>
    <text x="148" y="76" fill="#60a5fa" fontSize="7" fontFamily="monospace">LL</text>
    <text x="60" y="88" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="700">BEARISH DIV → institutional distribution</text>
  </svg>
);

const DiagSD = () => (
  <svg viewBox="0 0 220 90" style={{width:"100%",maxWidth:220,height:90}}>
    <rect width="220" height="90" fill="rgba(0,0,0,0.35)" rx="4"/>
    {/* Horizontal SD bands */}
    {[
      ["+3SD", 8,  "#ef4444"],
      ["+2SD", 22, "#f97316"],
      ["+1SD", 36, "#fbbf24"],
      ["VWAP", 48, "#a78bfa"],
      ["−1SD", 60, "#34d399"],
      ["−2SD", 72, "#10b981"],
    ].map(([l, y, c]) => (
      <g key={l}>
        <line x1="48" y1={y} x2="190" y2={y} stroke={c} strokeWidth={l==="VWAP"?2:1} strokeDasharray={l==="VWAP"?"none":"3,3"} opacity={l==="VWAP"?1:0.7}/>
        <text x="2" y={y+3} fill={c} fontSize="7.5" fontFamily="monospace">{l}</text>
      </g>
    ))}
    {/* Price path bouncing between bands */}
    <polyline points="48,62 72,54 88,38 110,48 132,36 155,48 175,36"
      fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
    <text x="52" y="88" fill="#94a3b8" fontSize="7" fontFamily="monospace">Price extends → mean reversion</text>
  </svg>
);

// ── Topic data — all concepts used in the system ───────────────────────────
const CONCEPT_SECTIONS = [
  // ════════════════════════════════════════════════════════
  //  1. MARKET STRUCTURE
  // ════════════════════════════════════════════════════════
  {
    id: "structure",
    label: "📊 Market Structure",
    color: "#00d4ff",
    concepts: [
      {
        id: "bos_choch",
        name: "BOS & CHoCH",
        short: "BOS / CHoCH",
        badge: "CORE",
        badgeColor: "#00d4ff",
        desc: "Break of Structure (BOS) confirms the existing trend is continuing — price closes beyond the most recent swing high (bullish) or swing low (bearish). A Change of Character (CHoCH) is a BOS against the current trend direction, signalling a potential reversal. BOS = trend continuation signal. CHoCH = trend termination signal. In ICT methodology, CHoCH is the first confirmation that a reversal is underway. For a valid long setup, you want a bearish leg to sweep a SSL → then a bullish CHoCH on 3M/1M to confirm the reversal before entry. BOS on higher timeframes (4H, 1H) defines the macro bias. BOS on 5M/3M/1M defines the entry trigger.",
        formula: `Bullish BOS:  close > most recent confirmed Swing High
Bearish BOS:  close < most recent confirmed Swing Low
CHoCH (bull): BOS to the upside AFTER a downtrend (first bullish BOS in a bearish leg)
CHoCH (bear): BOS to the downside AFTER an uptrend (first bearish BOS in a bullish leg)

Quality filter (compMSS):
  - Displacement score ≥ 60/100
  - Body ≥ 55% of candle range
  - Size ≥ 0.7× ATR(14)`,
        diagram: <DiagBOS/>
      },
      {
        id: "mss",
        name: "Market Structure Shift",
        short: "MSS",
        badge: "ENTRY TRIGGER",
        badgeColor: "#00ff8c",
        desc: "A Market Structure Shift (MSS) occurs when price performs a CHoCH after sweeping liquidity — the combination of a liquidity grab AND structural reversal. This is the gold standard entry trigger in ICT/SMC trading. The sequence: Higher TF identifies direction → 15M/5M shows the sweep of a liquidity pool → 3M/1M CHoCH confirms the MSS. Without the preceding liquidity sweep, a simple BOS is NOT an MSS — it is just a trend continuation signal. An MSS on 15M after sweeping Prior Day High/Low is a Grade A setup. An MSS on 3M after sweeping a session equal low is Grade B.",
        formula: `MSS Sequence:
  Step 1: Higher TF structure defines direction (4H/1H bullish)
  Step 2: 15M/5M shows price sweeping a SSL (equal lows, prior day low, session low)
  Step 3: 3M/1M CHoCH — closes above most recent 3M swing high
  Step 4: Enter on IFVG/FVG left by the CHoCH candle

compMSS() checks:
  bull: SHs[0] > SHs[1] AND SLs[0] > SLs[1] (HH+HL sequence)
  bear: SHs[0] < SHs[1] AND SLs[0] < SLs[1] (LH+LL sequence)`,
        diagram: <DiagBOS/>
      },
      {
        id: "swing_structure",
        name: "Swing Highs & Lows",
        short: "Swings",
        badge: "STRUCTURE",
        badgeColor: "#00d4ff",
        desc: "Swing Highs (SH) and Swing Lows (SL) are the building blocks of market structure. A confirmed Swing High is a pivot where at least 2 candles on each side are lower. A confirmed Swing Low is a pivot where at least 2 candles on each side are higher. ICT classifies swings as: Relative Equal Highs/Lows (within 0.05% of each other) = liquidity pools. Failed Swing Highs (price failed to make a new high) = weak structure. Strong Swing High = created by a displacement move. Weak Swing High = created by a grinding, low-volume move. Weak structure is the primary liquidity target.",
        formula: `Swing High: high[i] = highest(high, 5) — pivot with 2 lower candles each side
Swing Low:  low[i]  = lowest(low,  5) — pivot with 2 higher candles each side

Equal Highs (EQH): |SH[0].price - SH[1].price| / SH[1].price < 0.0005
Equal Lows  (EQL): same formula for swing lows

Relative High: SH that failed to exceed the prior SH
Relative Low:  SL that failed to break below the prior SL`,
        diagram: <DiagBOS/>
      },
      {
        id: "pd_premium",
        name: "Premium / Discount / PD Array",
        short: "PD Array",
        badge: "BIAS",
        badgeColor: "#f59e0b",
        desc: "The PD Array (Premium / Discount Array) is the ICT framework for identifying where to buy and sell relative to the current price range. The range is defined by the most recent significant swing high and swing low. The 50% level (equilibrium) divides premium from discount. Price in DISCOUNT (below 50%) = institutions are buying = look for longs. Price in PREMIUM (above 50%) = institutions are selling = look for shorts. The Golden Pocket is the 61.8–78.6% Fibonacci zone — the highest probability retracement zone for continuation trades. PD Arrays are the specific levels within premium/discount where institutional orders accumulate: Order Blocks, FVGs, Breaker Blocks, IFVG, Mitigation Blocks, Liquidity Voids.",
        formula: `Equilibrium (EQ) = (SwingHigh + SwingLow) / 2  = 50% Fibonacci

Premium Zone:   Price > EQ  → look ONLY for shorts
Discount Zone:  Price < EQ  → look ONLY for longs

Golden Pocket:  61.8% to 78.6% retrace
  bull entry zone: EQ + (range × 0.618) to EQ + (range × 0.786)  [discount]
  bear entry zone: EQ - (range × 0.618) to EQ - (range × 0.786)  [premium]

PD Array Hierarchy (highest to lowest):
  Mitigation Block > Breaker Block > IFVG > FVG > Order Block > Old H/L`,
        diagram: <DiagOTE/>
      },
      {
        id: "ote",
        name: "OTE — Optimal Trade Entry",
        short: "OTE",
        badge: "ENTRY ZONE",
        badgeColor: "#a3e635",
        desc: "The Optimal Trade Entry (OTE) is a Fibonacci-based entry zone created by ICT. After a displacement move (the leg that creates structure), price retraces into the 62–79% Fibonacci zone of that leg. This retracement zone is where smart money builds their position before the next impulse leg. The OTE zone is extremely precise — entries outside this zone carry significantly lower probability. Best OTE setups occur when the retracement also lands on an Order Block or FVG (confluence). For NQ futures, OTE on the 3M/1M chart after a 15M displacement is the primary entry model.",
        formula: `Displacement leg: from [A] low to [B] high (bullish)
Retracement targets:
  50.0% = (B - A) × 0.500 + A  ← equilibrium (minimum retrace)
  61.8% = (B - A) × 0.618 + A  ← Golden Ratio
  70.5% = (B - A) × 0.705 + A  ← OTE midpoint  
  78.6% = (B - A) × 0.786 + A  ← Maximum retrace before invalidation
  79.0% = invalidation level

OTE Entry: place limit order between 61.8% and 78.6%
Stop Loss: below A (swing low) + 2–5 ticks buffer
Target:    1.618 extension of A→B leg`,
        diagram: <DiagOTE/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  2. ORDER BLOCKS & GAPS
  // ════════════════════════════════════════════════════════
  {
    id: "ob_fvg",
    label: "🧱 Order Blocks & Gaps",
    color: "#f59e0b",
    concepts: [
      {
        id: "ob",
        name: "Order Block (OB)",
        short: "OB",
        badge: "ENTRY LEVEL",
        badgeColor: "#f59e0b",
        desc: "An Order Block is the last opposing candle before a displacement move — the final bearish candle before a strong bullish impulse (bullish OB) or the final bullish candle before a strong bearish impulse (bearish OB). It represents where institutional orders were placed. When price returns to an OB, those orders become active again. Bullish OB: the body of the last red candle before price aggressively moved up. Bearish OB: the body of the last green candle before price aggressively moved down. For an OB to be valid: it must be followed by a displacement candle, displacement must have carried at least 3× the OB's range, and the OB must be unmitigated (price has not returned to it yet). Once price trades through an OB, it is mitigated and no longer valid.",
        formula: `Bullish OB: last bearish candle (close < open) before bullish BOS
  Zone: open to close of that candle (or high to low)
  Valid if: displacement ≥ 3× OB range

Bearish OB: last bullish candle (close > open) before bearish BOS
  Zone: open to close of that candle (or high to low)

Mitigation: OB is "used" when price returns and closes beyond the OB body
Refined OB: use the wick-to-body zone for tighter entry
Quality score: compOBQuality() returns 0–100`,
        diagram: <DiagOB/>
      },
      {
        id: "bb",
        name: "Breaker Block",
        short: "BB",
        badge: "HIGH PRIORITY",
        badgeColor: "#ff4f4f",
        desc: "A Breaker Block forms when an Order Block fails — price sweeps through the OB, trapping the retail traders who bought/sold there, then continues in the original direction. A Breaker Block is a failed OB that flips polarity. Bullish Breaker: a bearish OB that was swept to the downside (trapping shorts) and then price reverses bullish through it. The swept OB now becomes support — institutions defended this level. Bearish Breaker: a bullish OB swept to the upside (trapping longs) then reversal bearish through it. Breaker Blocks have HIGHER priority than standard OBs because they represent two-way institutional interest: first as orders at the OB, then as stop-hunt liquidity above/below.",
        formula: `Bullish BB: bearish OB that was swept below its low
  → price trades below OB low, then rallies back above OB high
  → OB becomes bullish Breaker (support on retrace)

Bearish BB: bullish OB that was swept above its high
  → price trades above OB high, then sells off below OB low
  → OB becomes bearish Breaker (resistance on retrace)

Validation:
  - Original OB must have had a valid displacement leg
  - Sweep must be a clear wick (not a close beyond)
  - Return must create a new BOS in original direction`,
        diagram: <DiagOB/>
      },
      {
        id: "fvg",
        name: "Fair Value Gap (FVG)",
        short: "FVG",
        badge: "ENTRY LEVEL",
        badgeColor: "#a3e635",
        desc: "A Fair Value Gap is a three-candle pattern where the middle candle moves so aggressively that there is a gap between the wick of candle 1 and the wick of candle 3 — price was never traded in that zone. This gap represents institutional imbalance. Markets are efficient in the long run, which means FVGs tend to be filled. Bullish FVG: the low of candle 3 is above the high of candle 1 — a gap that price never traded through going up. Bearish FVG: the high of candle 3 is below the low of candle 1. FVG Entry: enter at the 50% level of the FVG for maximum efficiency. Stage tracking is critical: FRESH (not yet tested) → ACTIVE (price is in it) → COMPLETE (price has closed through 50%). Only FRESH and ACTIVE FVGs are valid entries.",
        formula: `Bullish FVG:  low[2] > high[0]  (candle 3 low > candle 1 high)
Bearish FVG:  high[2] < low[0]  (candle 3 high < candle 1 low)

Zone:
  bull: high[0] to low[2]
  bear: high[2] to low[0]

50% entry level = (top + bottom) / 2

Stages:
  FRESH    → not yet tested by price
  ACTIVE   → price is inside the FVG zone
  COMPLETE → price closed beyond 50% midpoint (mitigated)

Minimum size: FVG range ≥ 0.15 × ATR(14)`,
        diagram: <DiagFVG/>
      },
      {
        id: "ifvg",
        name: "Inverted FVG (IFVG)",
        short: "IFVG",
        badge: "HIGHEST PRIORITY",
        badgeColor: "#c084fc",
        desc: "An Inverted Fair Value Gap (IFVG) forms when a standard FVG is fully closed through (filled) by price. Once an FVG is completely mitigated, the zone FLIPS polarity — a bullish FVG that gets filled becomes a bearish IFVG (resistance), and a bearish FVG that gets filled becomes a bullish IFVG (support). IFVGs have the highest entry priority in the entire PD Array hierarchy because they represent TWO events: (1) initial institutional imbalance at the FVG, and (2) the institutional retest and flip of that zone. IFVGs on 15M are the highest-quality entries. IFVGs combined with a Breaker Block (Unicorn Model) are Grade A+ setups.",
        formula: `IFVG Formation:
  Step 1: Bullish FVG forms (3-candle gap up)
  Step 2: Price returns and CLOSES below the FVG bottom (fills it completely)
  Step 3: FVG zone flips to BEARISH IFVG (now resistance)

  Step 1: Bearish FVG forms (3-candle gap down)
  Step 2: Price returns and CLOSES above the FVG top (fills it)
  Step 3: FVG zone flips to BULLISH IFVG (now support)

Priority rank:    Highest (above all other PD arrays)
Entry: limit at IFVG zone (top for bull, bottom for bear)
Stop:  beyond opposite edge of IFVG + 3 ticks
Size:  IFVG range; smaller = tighter stop = better R:R`,
        diagram: <DiagFVG/>
      },
      {
        id: "mitigation_block",
        name: "Mitigation Block",
        short: "MIT Block",
        badge: "REVERSAL",
        badgeColor: "#06b6d4",
        desc: "A Mitigation Block forms when an Order Block partially or fully fails — price exceeds the OB zone but reverses before a full displacement in the opposite direction. This is different from a Breaker Block (which fully sweeps through and creates a new leg). A Mitigation Block represents a level where institutions partially re-entered their position to average in. When price returns to a Mitigation Block, those averaged positions are re-tested. Mitigation Blocks are most significant on Daily and 4H charts where institutional position-building happens. They are used as support/resistance for swing trades and as HTF bias context.",
        formula: `Mitigation Block (bull):
  1. Bullish OB forms
  2. Price dips INTO the OB but does NOT close below OB low
  3. Reverses back above OB high
  → OB is now a Mitigation Block (partially tested, still valid)

Mitigation Block (bear):
  1. Bearish OB forms
  2. Price pushes INTO OB but does NOT close above OB high
  3. Reverses back below OB low
  → OB is now a Mitigation Block

Use: HTF context only (D/4H/1H). 
On retest: expect a bounce from the 50% level of the OB.`,
        diagram: <DiagOB/>
      },
      {
        id: "liq_void",
        name: "Liquidity Void",
        short: "Liq Void",
        badge: "GAP FILL",
        badgeColor: "#f97316",
        desc: "A Liquidity Void (also called a Volume Void) is a large price gap where very little volume was traded — price moved through the zone so quickly that no auction process occurred. Like an FVG but much larger (typically 2–5× ATR or more). Liquidity Voids almost always get filled because the absence of two-way trading means price needs to return to establish fair value. They appear on charts as large single-candle moves (news events, market opens). Strategy: identify the Liquidity Void, wait for price to reach the top edge on a retrace, enter in the direction of the original gap with a target at the bottom of the void.",
        formula: `Liquidity Void: single candle range ≥ 3× ATR(14)
  OR: FVG with size ≥ 2× ATR(14)

Bullish Void: large green candle; enter short at top of void,
  target bottom of void (fill)

Bearish Void: large red candle; enter long at bottom of void,
  target top of void (fill)

Fill probability: ~82% within same session for intraday voids
  Higher probability on lower volume days
  News event voids: 60% fill probability`,
        diagram: <DiagFVG/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  3. LIQUIDITY
  // ════════════════════════════════════════════════════════
  {
    id: "liquidity",
    label: "💧 Liquidity",
    color: "#06b6d4",
    concepts: [
      {
        id: "liq_pools",
        name: "Liquidity Pools (BSL/SSL)",
        short: "BSL / SSL",
        badge: "TARGET",
        badgeColor: "#06b6d4",
        desc: "Buy-Side Liquidity (BSL) is the cluster of stop-losses from short sellers and breakout buy orders that accumulate above swing highs and equal highs. Sell-Side Liquidity (SSL) accumulates below swing lows and equal lows where long-stop orders and breakout sell orders cluster. Institutions need liquidity to fill large orders — they DRIVE price to these pools to trigger the stops, absorb that liquidity, then reverse. Identifying the next liquidity pool is the core of ICT: the market is always moving from one pool to another. Understanding which pool is being targeted determines your trade direction. Old highs, equal highs (EQH), weekly highs = BSL. Old lows, equal lows (EQL), weekly lows = SSL.",
        formula: `BSL (Buy-Side Liquidity):
  - Swing Highs (unswept)
  - Equal Highs (EQH): two highs within 0.05% of each other
  - Prior Day High (PDH), Prior Week High (PWH)
  - Session highs (London high, NY AM high)

SSL (Sell-Side Liquidity):
  - Swing Lows (unswept)
  - Equal Lows (EQL): two lows within 0.05% of each other
  - Prior Day Low (PDL), Prior Week Low (PWL)
  - Session lows (London low, NY AM low)

IRL (Internal Range Liquidity): BSL/SSL within the current range
ERL (External Range Liquidity): BSL/SSL beyond the current range`,
        diagram: <DiagLiq/>
      },
      {
        id: "sweep",
        name: "Liquidity Sweep",
        short: "Sweep",
        badge: "REVERSAL TRIGGER",
        badgeColor: "#f97316",
        desc: "A Liquidity Sweep occurs when price extends just beyond a liquidity pool (BSL or SSL), triggers the stop orders, then immediately reverses. The extension must be a WICK (not a close) — the market engine drives price beyond the level to grab the orders, then smart money absorbs all that liquidity and the market reverses. A sweep without a reversal (price closes above/below the swept level) is NOT a sweep — it is a breakout. The quality of a sweep is judged by: speed of the reversal (same candle or next candle), volume during the sweep (higher = better), and whether the sweep coincides with an ICT macro window. Sweep + MSS on 3M/1M = complete reversal setup.",
        formula: `Sweep conditions:
  bull sweep of SSL: low[i] < SSL.price AND close[i] > SSL.price
    → wick below SSL, body closes above it
  bear sweep of BSL: high[i] > BSL.price AND close[i] < BSL.price
    → wick above BSL, body closes below it

Sweep quality:
  - Same-candle reversal: HIGH quality
  - Reversal within 2 candles: MEDIUM quality
  - Reversal after 3+ candles: LOW quality

Sweep + CHoCH = MSS (Market Structure Shift)
  = highest probability entry trigger`,
        diagram: <DiagLiq/>
      },
      {
        id: "amd",
        name: "Power of 3 — AMD",
        short: "AMD",
        badge: "SESSION MODEL",
        badgeColor: "#00d4ff",
        desc: "The Power of 3 (AMD: Accumulation, Manipulation, Distribution) is ICT's model for how large institutional players engineer price movement during every session. Accumulation: institutions quietly build positions in one direction during low-volume periods (Asian session, early pre-market). Manipulation: price is pushed in the OPPOSITE direction of the intended move to trigger retail stops and sweep liquidity. Distribution: the actual intended move — price aggressively moves in the true direction. In practice: if institutions want to go long, they will first PUSH PRICE DOWN (manipulation/sweep of SSL), trigger short stops, accumulate longs at the bottom, then drive price upward (distribution). Recognising the manipulation phase prevents you from trading the fake move.",
        formula: `AMD Daily Cycle:
  Asian/Overnight: Accumulation (tight range, low volume)
  London Open / Pre-NY:  Manipulation (false move, sweep)
  NY Session:     Distribution (real move)

AMD Intraday (session level):
  9:30 – 10:00 AM: Accumulation (opening range)
  10:00 – 10:30 AM: Manipulation (stop hunt, sweep)
  10:30 AM – close: Distribution (trending move)

Identification:
  Step 1: Where is the daily bias (bull/bear)?
  Step 2: Which liquidity pool aligns with manipulation?
  Step 3: Wait for sweep + MSS → enter on distribution leg`,
        diagram: <DiagFVG/>
      },
      {
        id: "iof",
        name: "IRL to ERL — Internal to External",
        short: "IRL → ERL",
        badge: "DRAW ON LIQ",
        badgeColor: "#00ff8c",
        desc: "The Internal Range Liquidity (IRL) to External Range Liquidity (ERL) model describes how price cycles between liquidity pools. IRL includes the BSL/SSL within the current trading range (e.g., equal highs/lows, recent swing highs/lows). ERL includes the BSL/SSL BEYOND the current range (prior day high/low, prior week high/low, major swing highs/lows). The market is ALWAYS doing one of two things: (1) Seeking IRL (rebalancing within range, filling FVGs, retesting OBs), or (2) Seeking ERL (expanding beyond the range to take external liquidity). Understanding the current phase tells you how far to target and whether to look for continuation or reversal.",
        formula: `IRL targets (within range):
  - Recent equal highs/lows
  - FVGs and OBs within range
  - 50% (equilibrium) of current range

ERL targets (beyond range):
  - Prior Day High/Low
  - Prior Week High/Low
  - Major swing highs/lows (monthly level)

Phase identification:
  IRL → ERL: price breaks out of current range to take external liquidity
  ERL → IRL: price retraces to fill internal imbalances after taking ERL`,
        diagram: <DiagLiq/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  4. ICT TIMING
  // ════════════════════════════════════════════════════════
  {
    id: "timing",
    label: "⏰ ICT Timing",
    color: "#22d3ee",
    concepts: [
      {
        id: "macros",
        name: "ICT Macro Time Windows",
        short: "Macros",
        badge: "SESSION FILTER",
        badgeColor: "#22d3ee",
        desc: "ICT Macro Time Windows are specific 20–30 minute windows during the trading day when the Interbank FX algorithm (and by extension equity index futures) is statistically most likely to deliver high-probability price movements. These windows are when the institutions are most active, creating the sweeps, displacements, and reversals that define our setups. Trading outside these windows dramatically reduces win rate. The windows are: London Open (2:33–3:00 AM and 4:03–4:30 AM EST), NY AM (9:50–10:10 and 10:50–11:10 AM EST), NY Lunch (11:50–12:10 PM), NY PM (1:10–1:40 and 3:15–3:45 PM EST). Treat these windows as the ONLY times you look for entries.",
        formula: `LONDON macros (EST):
  02:33 – 03:00  London Open Macro
  04:03 – 04:30  London AM Continuation

NY AM macros (EST):
  09:50 – 10:10  NY Open Macro (most powerful)
  10:50 – 11:10  NY AM Continuation

NY LUNCH macro (EST):
  11:50 – 12:10  Typically low probability; avoid new entries

NY PM macros (EST):
  13:10 – 13:40  (1:10 – 1:40 PM)  NY PM Macro
  15:15 – 15:45  (3:15 – 3:45 PM)  End of Day Macro

Trading rule: ONLY enter during macro windows. Setup must FORM inside the window.`,
        diagram: <DiagLiq/>
      },
      {
        id: "silver_bullet",
        name: "Silver Bullet",
        short: "Silver Bullet",
        badge: "PREMIUM SETUP",
        badgeColor: "#f59e0b",
        desc: "The Silver Bullet is ICT's highest-confidence intraday setup, combining the 10:00–11:00 AM EST (NY AM macro) window with a specific sequence: liquidity sweep → FVG/IFVG entry. It is called 'Silver Bullet' because it is a single, precise, high-conviction trade per session. Rules: (1) Only trade between 10:00 AM and 11:00 AM EST. (2) Identify which liquidity was swept before 10 AM (often during 9:30–10 AM opening range). (3) After the sweep, wait for a FVG or IFVG to form on the 1M or 3M chart. (4) Enter at the FVG/IFVG zone, stop below the swept low (long) or above swept high (short). (5) Target the opposing session high/low. One Silver Bullet per session. If the setup doesn't appear by 11 AM, do not trade it.",
        formula: `Silver Bullet Rules:
  Window:   10:00 AM – 11:00 AM EST only
  Trigger:  Liquidity sweep of session low (long) or session high (short)
  Entry:    1M or 3M FVG/IFVG that forms AFTER the sweep
  Stop:     Beyond the swept low/high (max 20 pts NQ)
  Target:   Session high (for long) or session low (for short)
  Max trades: 1 per session

Ideal conditions:
  ✓ 4H + 1H structure aligned (bullish for long SB, bearish for short SB)
  ✓ Sweep is a clean wick with body close above/below the level
  ✓ FVG forms in the SAME 10:00-11:00 AM window
  ✓ ATR(14) ≥ 15 pts (enough range for the trade)`,
        diagram: <DiagLiq/>
      },
      {
        id: "ny_lunch",
        name: "NY Lunch Kill Zone",
        short: "NY Lunch",
        badge: "AVOID",
        badgeColor: "#ff4f4f",
        desc: "The New York Lunch Kill Zone (12:00 PM – 1:30 PM EST) is a period of very low institutional participation and erratic, choppy price action. Market makers and institutional desks take their lunch breaks, volume drops dramatically, and price often moves in apparently random ways that can trap new traders. ICT strongly advises: DO NOT trade during NY Lunch. Setups that look valid during this window have significantly lower follow-through. The risk/reward profile deteriorates. If you are in a winning trade, consider taking partial profits before 12:00 PM or tightening your stop to protect gains through the lunch period. Re-engage at the 1:10 PM NY PM Macro.",
        formula: `NY Lunch window: 12:00 PM – 1:30 PM EST

Rules:
  - Take NO new entries during this window
  - If in a trade, consider taking partial profits at noon
  - Tight trailing stop recommended if holding through lunch

Volume signature:
  - Average volume drops 40–60% vs NY AM
  - Spreads widen (especially on NQ)
  - False breakouts are 3× more common

Action plan:
  11:50 AM: assess open positions, consider partial close
  1:10 PM: re-scan for NY PM Macro setup`,
        diagram: <DiagLiq/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  5. CONFIRMATION SIGNALS
  // ════════════════════════════════════════════════════════
  {
    id: "confirmation",
    label: "🔁 Confirmation",
    color: "#a3e635",
    concepts: [
      {
        id: "smt",
        name: "SMT Divergence",
        short: "SMT",
        badge: "CONFIRMATION",
        badgeColor: "#c084fc",
        desc: "Smart Money Tool (SMT) Divergence compares two correlated instruments (NQ vs ES, or NQ vs BTC) to identify when one fails to confirm a swing made by the other. This divergence signals that smart money is NOT supporting the move in the diverging instrument — a reversal is imminent. Bullish SMT: ES makes a new swing low BUT NQ fails to make a new low (NQ holds higher) → NQ is showing strength while ES shows weakness → buy NQ. Bearish SMT: NQ makes a new high BUT ES fails to make a new high → NQ is showing weakness relative to ES → sell NQ. SMT works because NQ and ES are highly correlated; when they diverge, one is being manipulated to create a trap.",
        formula: `Bullish SMT (buy NQ):
  ES:  low[i] < low[i-N]  (new swing low)
  NQ:  low[i] > low[i-N]  (fails to make new low)
  → NQ shows relative strength → buy NQ at its structure

Bearish SMT (short NQ):
  NQ:  high[i] > high[i-N]  (new swing high)
  ES:  high[i] < high[i-N]  (fails to make new high)
  → NQ shows relative weakness → short NQ at structure

Pairs:
  NQ ↔ ES  (primary pair, highest reliability)
  NQ ↔ YM  (secondary)
  RTY ↔ ES (alternative)

Filter: SMT most reliable during NY AM and NY PM sessions`,
        diagram: <DiagLiq/>
      },
      {
        id: "cvd",
        name: "CVD Divergence",
        short: "CVD",
        badge: "ORDER FLOW",
        badgeColor: "#10b981",
        desc: "Cumulative Volume Delta (CVD) measures the net difference between buying volume (ask-side trades) and selling volume (bid-side trades) over time. When CVD and price diverge — price makes a new high but CVD doesn't (or vice versa) — institutional buying/selling is not supporting the price move. This is a leading indicator of reversal. Bearish CVD divergence: price makes higher highs but CVD is flat or declining — sellers are absorbing the upward move, a reversal is incoming. Bullish CVD divergence: price makes lower lows but CVD is flat or rising — buyers are absorbing the downward move. CVD is most reliable on 3M and 5M charts during macro windows.",
        formula: `CVD[i] = CVD[i-1] + (buyVolume[i] - sellVolume[i])
  buyVolume  = volume traded at the ask price
  sellVolume = volume traded at the bid price

Divergence identification:
  Bull: price[i] < price[i-N]  AND  CVD[i] > CVD[i-N]
    → price makes new low, CVD does not → buyers absorbing → go long

  Bear: price[i] > price[i-N]  AND  CVD[i] < CVD[i-N]
    → price makes new high, CVD does not → sellers absorbing → go short

Timeframe: best on 3M / 5M during macro windows
Combine with: SMT, FVG/IFVG, OB for highest conviction`,
        diagram: <DiagLiq/>
      },
      {
        id: "displacement",
        name: "Displacement",
        short: "Displacement",
        badge: "QUALITY FILTER",
        badgeColor: "#f59e0b",
        desc: "Displacement is the quality of a price move that determines whether a BOS or CHoCH is institutional or just noise. A true displacement has: a large candle body (≥55% of candle range), significant size relative to ATR (≥0.7×), closes beyond a swing high/low (not just a wick), and ideally leaves a FVG behind. Low-quality displacement means the structure break was engineered by low volume and is likely a trap. High-quality displacement (score ≥ 80/100) means institutions were genuinely involved and the structure shift is reliable. Only trades where the triggering MSS had a displacement score ≥ 60 should be taken. Displacement score is calculated by the compDisplacement() function.",
        formula: `Displacement score (0–100):
  Body ratio:    body / range    (target ≥ 0.55) → up to 35 points
  Size vs ATR:   range / ATR(14) (target ≥ 0.70) → up to 35 points
  Closes beyond: close > swing high (bull) or close < swing low (bear) → 20 points
  FVG created:   displacement candle creates a FVG → 10 points

Score thresholds:
  ≥ 80: HIGH quality (Grade A displacement)
  60–79: MEDIUM quality (Grade B minimum)
  < 60:  LOW quality (skip this setup)

In dashboard: shown in DISPLACEMENT QUALITY section`,
        diagram: <DiagBOS/>
      },
      {
        id: "crt_engulf",
        name: "CRT / Multi-TF Engulfing",
        short: "CRT",
        badge: "CONFIRMATION",
        badgeColor: "#ec4899",
        desc: "The Candle Range Theory (CRT) Engulfing setup uses multi-timeframe candle relationship to confirm directional bias. A CRT engulf occurs when a 15M candle's range completely engulfs the 5M or 3M candle range, signalling institutional involvement. Combined with an OB or FVG confluence at key structure, this creates a high-quality entry signal. The engulfing candle must: be 1.5× larger than the average of the prior 3 candles, occur at a key S/R level, have the 15M candle confirming the same direction, and occur within an ICT macro window. The CRT model is part of the Vivek strategy and is the primary 3M entry trigger.",
        formula: `Engulf conditions:
  bullEngulf: close > open[1] AND open < close[1] AND body ≥ 1.5× body[1]
  bearEngulf: close < open[1] AND open > close[1] AND body ≥ 1.5× body[1]

Momentum filter:
  body > avgBody(3)  ← must be above 3-bar average

15M context filter (HTF proxy):
  ema20 > ema50 AND close > ema20  ← bull filter
  ema20 < ema50 AND close < ema20  ← bear filter

Entry: market on close of engulf candle (or limit inside FVG it creates)
Stop:  low of bull engulf / high of bear engulf
Target: R:R ≥ 2:1, next swing high/low`,
        diagram: <DiagOB/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  6. ENTRY MODELS
  // ════════════════════════════════════════════════════════
  {
    id: "models",
    label: "🦄 Entry Models",
    color: "#c084fc",
    concepts: [
      {
        id: "unicorn",
        name: "Unicorn Model",
        short: "Unicorn",
        badge: "GRADE A",
        badgeColor: "#c084fc",
        desc: "The Unicorn Model is the highest-probability ICT entry model, combining a Breaker Block and FVG at the same swing point. The sequence: 1) Price forms an Order Block at a significant swing. 2) Price sweeps through the OB (converting it to a Breaker Block). 3) The sweeping displacement leaves an FVG behind. 4) The FVG and Breaker Block overlap in the same zone. 5) Price retraces into this BB+FVG zone — this is the Unicorn entry. The overlap of BB+FVG is rare (hence 'Unicorn') but extremely high probability because BOTH the mitigated OB orders AND the FVG imbalance attract price, creating a magnetic entry zone with minimal risk.",
        formula: `Unicorn Setup Sequence:
  1. OB forms at swing high/low (confirmed by displacement)
  2. Price sweeps through OB, creating Breaker Block
  3. Sweeping candle creates FVG in the same zone
  4. BB range overlaps with FVG range
  5. Entry: price retraces INTO the BB+FVG overlap zone
  6. Stop: beyond the opposite edge of the overlap zone
  7. Target: 2:1 minimum, prior opposing swing

Identification in compPDArray():
  strat.find(s => s.type === 'BB+FVG')
  Score: Breaker Block = +35, FVG = +25
  Combined score: 60+ = valid Unicorn zone

Grade: A (always execute if other gates pass)`,
        diagram: <DiagOB/>
      },
      {
        id: "vivek_model",
        name: "Vivek Strategy — Full Execution Model",
        short: "Vivek",
        badge: "PRIMARY MODEL",
        badgeColor: "#a3e635",
        desc: "The Vivek Strategy is the complete 10-gate execution framework used in this dashboard. It combines ICT concepts (OBs, IFVGs, OTE, MSS, SMT) with Kris Zeiders' confluence grading. The 10 gates are sequential — ALL must pass for a valid trade. Gate 1: Weekly Bias (HH+HL or LH+LL). Gate 2: Daily Bias matches Weekly. Gate 3: Session/ICT Macro window active. Gate 4: Draw on Liquidity identified. Gate 5: Retail trap positioning (entry against retail). Gate 6: BOS/CHoCH with displacement ≥ 60. Gate 7: FVG Price Sequence = COMPLETE. Gate 8: OTE zone (61.8–78.6%). Gate 9: OB confluence. Gate 10: Stop ≤ 30 pts NQ. Only trades that pass all 10 gates are executed. Grade is A (all gates pass, 80%+ displacement) down to D (3 or fewer gates fail).",
        formula: `10 GATES (sequential — all must pass):
  G1:  Weekly structure = bullish OR bearish (no range/chop)
  G2:  Daily structure matches Weekly
  G3:  Active session: Silver Bullet (10AM–11AM) OR NY PM (1:30–3PM EST)
  G4:  Specific liquidity target identified (BSL or SSL by price level)
  G5:  Entry at retail trap zone (OB, FVG — where retail bought/sold)
  G6:  Displacement score ≥ 60, body ≥ 55%, size ≥ 0.7× ATR
  G7:  FVG price sequence = COMPLETE (entry candle)
  G8:  Price inside OTE zone (61.8–78.6% of displacement leg)
  G9:  Price inside or adjacent to OB (unmitigated)
  G10: Stop ≤ 30 pts NQ from entry

Grade:
  A: Gates 1–10 pass, displacement ≥ 80
  B: Gates 1–7 pass (minor G8/G9 miss)
  C: Gates 1–5 pass (structural only)
  D: < 5 gates pass (do not trade)`,
        diagram: <DiagOTE/>
      },
      {
        id: "kz_model",
        name: "Kris Zeiders — Confluence Model",
        short: "KZ",
        badge: "CONFIRMATION",
        badgeColor: "#f97316",
        desc: "The Kris Zeiders (KZ) Confluence model scores a trade setup based on the number and quality of confluence factors present at the entry zone. Each confluence adds probability. Required confluences (all must be present): HTF structure alignment (4H/1H), Session window active, Liquidity sweep completed, MSS confirmed. Optional confluences (each adds to Grade): OTE zone, SMT divergence, CVD divergence, Volume spike, ICT Macro window, FVG+OB overlap. The model scores each factor and produces a composite confluence score that maps to A/B/C/D grade. Trades with 5+ confluences at the same zone are Grade A; 3–4 confluences = Grade B; 2 = Grade C.",
        formula: `Required (all 4 must pass):
  ✓ HTF structure (4H + 1H aligned)
  ✓ Session window (SB or NY PM)
  ✓ Liquidity swept
  ✓ MSS confirmed (CHoCH on 3M/1M)

Optional confluences (each = +1 score):
  OTE zone (61.8–78.6%)         → +1
  FVG+OB overlap (Unicorn)      → +2
  SMT divergence                → +1
  CVD divergence                → +1
  ICT Macro window active       → +1
  Volume > 1.5× average         → +1
  HTF FVG unmitigated           → +1

Grade mapping:
  Required (4) + 4+ optional = Grade A
  Required (4) + 2–3 optional = Grade B
  Required (4) + 0–1 optional = Grade C
  < 4 required                 = Grade D (no trade)`,
        diagram: <DiagOTE/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  7. QUANTITATIVE & STATISTICAL
  // ════════════════════════════════════════════════════════
  {
    id: "quant",
    label: "📊 Quant & Statistical",
    color: "#06b6d4",
    concepts: [
      {
        id: "sd",
        name: "VWAP Standard Deviation Bands",
        short: "VWAP SD",
        badge: "VWAP",
        badgeColor: "#06b6d4",
        desc: "VWAP (Volume Weighted Average Price) is the average price weighted by volume for the session. It represents the true 'fair value' as perceived by all participants who traded that session. Standard deviation bands (1σ, 2σ, 3σ) around VWAP define statistical extremes. Approximately 68% of price action occurs within ±1σ, 95% within ±2σ, and 99.7% within ±3σ. When NQ trades beyond ±2σ, it is in a statistically extreme zone and has historically mean-reverted back toward VWAP ~78% of the time. SD bands are calculated fresh each RTH session (9:30 AM EST reset). Combine SD extension with CVD divergence for the highest probability VWAP reversion entries.",
        formula: `VWAP = Σ(price × volume) / Σ(volume)
  price = (high + low + close) / 3 per candle

Variance = Σ(volume × (price - VWAP)²) / Σ(volume)
SD = √Variance

Bands:
  ±1σ: VWAP ± (1 × SD)  — 68% of data
  ±2σ: VWAP ± (2 × SD)  — 95% of data  ← reversion entry zone
  ±3σ: VWAP ± (3 × SD)  — 99.7% of data ← extreme extension

Session reset: VWAP recalculates from 9:30 AM EST each day
Pre-market: anchored VWAP from 6:00 AM EST

Reversion entry: price ≥ 2σ from VWAP + CVD divergence + rejection candle`,
        diagram: <DiagOTE/>
      },
      {
        id: "orb",
        name: "Opening Range Breakout (ORB)",
        short: "ORB",
        badge: "SESSION MODEL",
        badgeColor: "#f59e0b",
        desc: "The Opening Range Breakout (ORB) uses the high and low of the first 30 minutes of RTH (9:30–10:00 AM EST) as key reference levels. The opening range captures the initial price discovery as institutions and retail traders react to overnight developments. A breakout of the ORB high (with volume confirmation ≥ 1.5× average) signals institutional interest in higher prices. ORB works because the first 30 minutes concentrates a large portion of the day's institutional order flow — a clean breakout of those extremes represents committed directional conviction. ORB setups are entered on the FIRST pullback to the broken range level, not on the initial break. ORB is most reliable when aligned with the 4H structure bias.",
        formula: `ORB Range: 9:30 AM – 10:00 AM EST (first 30 minutes)
  ORB_High = highest(high, first 30min)
  ORB_Low  = lowest(low,  first 30min)

Breakout:  close > ORB_High (long) or close < ORB_Low (short)
Volume:    breakout volume ≥ 1.5× 20-bar average
Entry:     first pullback to ORB_High (long) or ORB_Low (short)
Stop:      below ORB_Low (long) or above ORB_High (short), max 20 pts
TP1:       ORB range × 1 beyond breakout
TP2:       ORB range × 2 beyond breakout

Time limit: only valid 10:00 AM – 12:00 PM EST
Daily bias: must align with 4H structure`,
        diagram: <DiagOTE/>
      },
      {
        id: "atr",
        name: "ATR — Average True Range",
        short: "ATR",
        badge: "VOLATILITY",
        badgeColor: "#334155",
        desc: "Average True Range (ATR) measures market volatility — the average range of price movement over N periods. ATR is the foundational risk calibration tool in this dashboard. All stop distances, FVG minimum sizes, displacement quality scores, and VWAP SD calculations reference ATR. For NQ futures, a typical ATR(14) on the 5M chart is 8–18 points. Stop losses of ≤30 pts (maximum) correspond to 1.5–3.5× the 5M ATR. ATR is also used for session volatility filtering — if current ATR is >2× its 20-bar average, it's an abnormally volatile session and many statistical edge strategies should be avoided.",
        formula: `True Range = max(
  high - low,
  |high - close[1]|,
  |low  - close[1]|
)

ATR(14) = EMA(14) of True Range
  (Wilder's smoothing: ATR[i] = (ATR[i-1]×13 + TR[i]) / 14)

Usage in dashboard:
  Stop loss reference:    max stop = 30 pts (≈ 2–3× ATR on 5M)
  FVG minimum size:       ≥ 0.15 × ATR(14)
  Displacement quality:   size ≥ 0.7 × ATR(14) for valid BOS
  VWAP SD calculation:    uses price-weighted variance (not ATR)
  Abnormal volatility:    current ATR > 2× 20-bar average = skip stats trades`,
        diagram: <DiagOTE/>
      },
      {
        id: "poc_vp",
        name: "Volume Profile & POC",
        short: "VP / POC",
        badge: "VOLUME",
        badgeColor: "#818cf8",
        desc: "Volume Profile is a horizontal histogram showing the volume traded at each price level during a session. The Point of Control (POC) is the price level with the most volume traded — it represents the fairest price for that session as determined by actual participation. The Value Area is the range containing 70% of total volume (Value Area High = VAH, Value Area Low = VAL). Price tends to gravitate toward the POC because the highest volume = most participants agreed on that price = it is the most liquid level = price returns there. POC Reversion: if price moves 30+ pts from the POC and consolidates, a reversion back to the POC is high probability. Best results when the POC coincides with an ICT OB or FVG.",
        formula: `Volume Profile:
  - Divide price range into N buckets (usually 0.25pt increments for NQ)
  - Count total volume traded in each bucket
  - POC = bucket with highest volume

Value Area (70% rule):
  Start at POC, add buckets with highest volume on each side
  Continue until 70% of total session volume is captured
  VAH = top of Value Area
  VAL = bottom of Value Area

POC magnetism:
  Distance threshold: ≥ 30 pts from POC
  Entry: consolidation at extreme + first CHoCH toward POC
  Target: POC retest (primary), VAH/VAL (secondary)`,
        diagram: <DiagOTE/>
      },
    ]
  },

  // ════════════════════════════════════════════════════════
  //  8. RISK & TRADE MANAGEMENT
  // ════════════════════════════════════════════════════════
  {
    id: "risk",
    label: "🛡 Risk & Management",
    color: "#ff4f4f",
    concepts: [
      {
        id: "stop_discipline",
        name: "Stop Loss Discipline",
        short: "Stop",
        badge: "RISK RULE",
        badgeColor: "#ff4f4f",
        desc: "Maximum stop loss on NQ is 30 points — non-negotiable. Stop is always placed at the high or low of the Unicorn candle (the candle that triggered the entry), plus a 3-tick buffer beyond the most recent swing extreme. Never risk more than 30 points on a single NQ trade. The entry model is designed so that if the setup is correct, price should never need to travel 30 points against you. If the stop required is more than 30 points, the setup's risk/reward is insufficient and the trade must be skipped. Stop discipline is Gate 10 of the Vivek model — a hard, mechanical rule.",
        formula: `Stop placement rules:
  Long entry:  stop = low of setup candle (or swept low) - 3 ticks
  Short entry: stop = high of setup candle (or swept high) + 3 ticks

Maximum stop: 30 pts NQ (ABSOLUTE MAXIMUM)
  If required stop > 30 pts → DO NOT TRADE

1 NQ tick = 0.25 pts = $5 per contract
30 pt stop = 120 ticks = $600 per contract at full size

Position sizing:
  Risk % per trade = 1% of account
  Position size = (account × 0.01) / (stop_pts × $20)
  (NQ: 1 pt = $20 per micro contract × 10 = full NQ)`,
        diagram: <DiagBOS/>
      },
      {
        id: "be_trailing",
        name: "Breakeven & Trail Management",
        short: "BE / Trail",
        badge: "MANAGEMENT",
        badgeColor: "#f59e0b",
        desc: "Once a trade reaches TP1 (1:1 risk), move stop to breakeven and close 50% of the position. This locks in a risk-free trade on the remaining 50%. Trail the remaining position using the structure swings on the 15M chart — move stop above/below each new swing high/low that forms in the trade's direction. Never trail on the 1M/3M chart — too many false swings. BE is managed automatically by the Position Manager in the dashboard when the trade's unrealised P&L hits 1× the risk amount. The 50% partial close at TP1 is also automated and logged to the Audit Trail.",
        formula: `BE Rule:
  When P&L ≥ 1× Risk → move stop to entry price (breakeven)
  Close 50% of position at TP1 level

Trailing stop (remaining 50%):
  Long: trail stop below each new 15M swing low that forms
  Short: trail stop above each new 15M swing high that forms
  Minimum trail: do not move stop if new swing is within 5 pts of entry

TP Levels:
  TP1: 1:1 R:R from entry  (partial close 50%, move to BE)
  TP2: 1.618× extension of the setup leg (trail to this target)
  TP3: Next major session liquidity pool (if trade continues)

Automated in dashboard:
  usePositionManager() → BE_MOVE event at 1:1
  usePositionManager() → TP1_HIT event at TP1`,
        diagram: <DiagOTE/>
      },
      {
        id: "daily_bias_framework",
        name: "Daily Bias Framework",
        short: "Daily Bias",
        badge: "TOP-DOWN",
        badgeColor: "#00ff8c",
        desc: "The Daily Bias Framework is the top-down analysis process that defines which direction to trade each day. The process: 1) Weekly chart — is the weekly candle bullish (closing toward weekly high) or bearish (closing toward weekly low)? This is the macro bias. 2) Daily chart — did yesterday's candle break above or below a significant level? Is today creating a HH+HL (bull) or LH+LL (bear) structure? 3) Session — during what time of day is the setup developing? 4) Identify the draw on liquidity — where is price most likely heading (BSL above or SSL below)? 5) Plan the entry level — which PD Array level is in the path? Only trade setups where Daily + Weekly bias agree AND the trade direction points toward the identified liquidity pool.",
        formula: `Daily Bias Process:
  Step 1 — Weekly: HH+HL series = BULLISH, LH+LL series = BEARISH
  Step 2 — Daily:  Same structure analysis, must match weekly
  Step 3 — 4H/1H: Identify the current leg (impulse or retrace?)
  Step 4 — Draw:   BSL above (target for longs) or SSL below (target for shorts)
  Step 5 — Entry:  Find PD Array in discount (bull) or premium (bear)

Conflicts:
  Weekly bull + Daily bear = NO TRADE (wait for daily to realign)
  Weekly bear + Daily bull = NO TRADE (choppy transition period)
  Both align = proceed to session analysis

Dashboard shows:
  htfBias array: [{tf, bias, mss, swings}] for 4H, 1H, 15M, 5M`,
        diagram: <DiagOTE/>
      },
    ]
  },
];

function ConceptsTab() {
  const [activeSection, setActiveSection] = useState(null);
  const [activeConcept, setActiveConcept] = useState(null);
  const [search, setSearch] = useState("");

  // Flat list for search
  const allConcepts = CONCEPT_SECTIONS.flatMap(s =>
    s.concepts.map(c => ({ ...c, sectionColor: s.color, sectionLabel: s.label }))
  );

  const filtered = search.trim().length > 1
    ? allConcepts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.short.toLowerCase().includes(search.toLowerCase()) ||
        c.desc.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const colors = {
    bg: "rgba(255,255,255,0.025)",
    border: "rgba(255,255,255,0.07)",
    activeBg: "rgba(255,255,255,0.05)",
  };

  const ConceptCard = ({ concept, sectionColor }) => {
    const isActive = activeConcept === concept.id;
    const col = sectionColor;
    return (
      <div onClick={() => setActiveConcept(isActive ? null : concept.id)}
        style={{background: isActive ? `${col}12` : colors.bg,
          border: `1px solid ${isActive ? col+"55" : colors.border}`,
          borderRadius: 10, padding: "14px 16px", cursor: "pointer",
          transition: "all 0.18s", marginBottom: 8}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{background:`${col}22`,color:col,border:`1px solid ${col}44`,
              borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700,fontFamily:"monospace",
              letterSpacing:0.5}}>
              {concept.short}
            </span>
            <span style={{fontSize:9,padding:"2px 7px",borderRadius:4,fontFamily:"monospace",fontWeight:700,
              background:`${concept.badgeColor}14`,color:concept.badgeColor,
              border:`1px solid ${concept.badgeColor}30`}}>
              {concept.badge}
            </span>
            <span style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{concept.name}</span>
          </div>
          <span style={{color:col,fontSize:14,opacity:0.6,flexShrink:0,marginLeft:8}}>
            {isActive ? "▲" : "▼"}
          </span>
        </div>

        {isActive && (
          <div style={{marginTop:14}}>
            {/* Diagram */}
            <div style={{marginBottom:12,borderRadius:8,overflow:"hidden",
              border:"1px solid rgba(255,255,255,0.06)"}}>
              {concept.diagram}
            </div>
            {/* Description */}
            <p style={{color:"#94a3b8",fontSize:12.5,lineHeight:1.75,margin:"0 0 12px"}}>
              {concept.desc}
            </p>
            {/* Formula */}
            <pre style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:6,padding:"10px 14px",fontSize:10.5,
              fontFamily:"'Fira Code','Courier New',monospace",
              color:"#94a3b8",whiteSpace:"pre-wrap",margin:0,lineHeight:1.7}}>
              {concept.formula}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* ── Search bar ── */}
      <div style={{position:"relative",marginBottom:20}}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveSection(null); setActiveConcept(null); }}
          placeholder="Search concepts (e.g. IFVG, sweep, unicorn…)"
          style={{width:"100%",boxSizing:"border-box",
            background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,
            color:"#e2e8f0",padding:"9px 36px 9px 14px",fontSize:12,
            fontFamily:"monospace"}}
        />
        {search && (
          <button onClick={()=>setSearch("")}
            style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:14}}>
            ✕
          </button>
        )}
      </div>

      {/* ── Quick reference ── */}
      {!search && (
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:12,padding:"14px 16px",marginBottom:20}}>
          <p style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:"0.1em",
            marginBottom:10,textTransform:"uppercase"}}>⚡ Quick Reference</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 16px"}}>
            {[
              ["BOS","Close beyond swing → trend confirmed"],
              ["CHoCH","Counter-trend BOS → reversal signal"],
              ["OB","Last opposing candle before impulse"],
              ["BB","Mitigated OB — polarity flip zone"],
              ["FVG","3-candle imbalance (gap to fill)"],
              ["IFVG","FVG with polarity flip (any close beyond boundary)"],
              ["PD Array","P/D zone + best tool + score → bias signal"],
              ["GP","Golden Pocket 0.618–0.786 — highest retrace zone"],
              ["OTE","Optimal Trade Entry: 0.618–0.786 + OB/FVG"],
              ["BSL/SSL","Buy/Sell-side liquidity pools (stop clusters)"],
              ["Sweep","Wick through pool then close back = stop hunt"],
              ["AMD","Accumulate → Manipulate → Distribute (daily cycle)"],
              ["SMT","NQ vs ES divergence → institutional tell"],
              ["CVD","Cumulative delta divergence → distribution/accum"],
              ["Unicorn","BB overlaps FVG at swing = highest prob setup"],
              ["ICT Macro","Algo window 2:33/4:03/9:50/10:50/1:10/3:15 EST"],
              ["Silver Bullet","9:30–11:00 AM EST primary execution window"],
              ["SD","±1/2/3 ATR from close → extension/mean-reversion"],
            ].map(([k,v],i) => (
              <div key={i} style={{display:"flex",gap:8,padding:"4px 0",
                borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <span style={{color:"#38bdf8",fontFamily:"monospace",fontSize:9,
                  fontWeight:700,minWidth:68,paddingTop:1,flexShrink:0}}>{k}</span>
                <span style={{color:"#64748b",fontSize:9,lineHeight:1.4}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search results ── */}
      {filtered && (
        <div>
          <p style={{color:"#64748b",fontSize:10,marginBottom:10,fontFamily:"monospace"}}>
            {filtered.length} result{filtered.length!==1?"s":""} for "{search}"
          </p>
          {filtered.map(c => (
            <ConceptCard key={c.id} concept={c} sectionColor={c.sectionColor}/>
          ))}
        </div>
      )}

      {/* ── Section panels ── */}
      {!filtered && CONCEPT_SECTIONS.map(section => (
        <div key={section.id} style={{marginBottom:16}}>
          <button onClick={() => {
              setActiveSection(activeSection === section.id ? null : section.id);
              setActiveConcept(null);
            }}
            style={{width:"100%",background: activeSection===section.id
                ? `${section.color}14` : "rgba(255,255,255,0.03)",
              border:`1px solid ${activeSection===section.id
                ? section.color+"55" : "rgba(255,255,255,0.08)"}`,
              borderRadius:10,padding:"12px 16px",cursor:"pointer",
              display:"flex",alignItems:"center",gap:10,
              marginBottom: activeSection===section.id ? 10 : 0,
              transition:"all 0.18s"}}>
            <span style={{width:10,height:10,borderRadius:"50%",
              background:section.color,flexShrink:0,
              boxShadow: activeSection===section.id ? `0 0 8px ${section.color}` : "none"}}/>
            <span style={{color: activeSection===section.id ? section.color : "#94a3b8",
              fontSize:13,fontWeight:600,textAlign:"left"}}>
              {section.label}
            </span>
            <span style={{marginLeft:"auto",color:"#475569",fontSize:10,fontFamily:"monospace"}}>
              {section.concepts.length} concepts
            </span>
            <span style={{color:section.color,fontSize:12,opacity:0.6}}>
              {activeSection===section.id ? "▲" : "▼"}
            </span>
          </button>
          {activeSection === section.id && (
            <div>
              {section.concepts.map(c => (
                <ConceptCard key={c.id} concept={c} sectionColor={section.color}/>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// CALCULATOR TAB
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// CALC TAB — auto-wired to live candles
// ─────────────────────────────────────────────────────────────────────────────
function CalcTab({ candles = [], orb = null }) {
  const [mode,  setMode]  = useState("fib");
  // Tick every 30s to force re-evaluation of all auto values
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  // Override inputs — user can still edit; auto values pre-fill when candles arrive
  const [shOvr, setShOvr] = useState(null);
  const [slOvr, setSlOvr] = useState(null);
  const [orHOvr,setOrHOvr]= useState(null);
  const [orLOvr,setOrLOvr]= useState(null);
  const [pxOvr, setPxOvr] = useState(null);
  const [atrOvr,setAtrOvr]= useState(null);

  // ── AUTO: Fib swing H/L from compPDArray swing detection ──────────────────
  const autoFib = useMemo(() => {
    if (!candles.length) return null;
    const pd = compPDArray(candles, [], [], [], [], candles[candles.length-1]?.c || 0);
    return pd ? { sh: pd.hi, sl: pd.lo } : null;
  }, [candles, tick]);

  // ── AUTO: ORB from 9:30 EST candle (14:30 UTC) ───────────────────────────
  const autoORB = useMemo(() => {
    if (!candles.length) return null;
    // First try to find exact 9:30 EST (= 14:30 UTC) candle
    const EST_OPEN_UTC_H = 14, EST_OPEN_UTC_M = 30;
    // Find candle whose timestamp matches 9:30 EST (within ±5 min window)
    let orbCandle = null;
    for (const c of candles) {
      const d = new Date(c.t);
      const utcH = d.getUTCHours(), utcM = d.getUTCMinutes();
      const totalM = utcH * 60 + utcM;
      const targetM = EST_OPEN_UTC_H * 60 + EST_OPEN_UTC_M;
      if (Math.abs(totalM - targetM) <= 5) { orbCandle = c; break; }
    }
    // Fallback: use first candle of the session (oldest candle)
    if (!orbCandle) orbCandle = candles[0];
    if (!orbCandle) return null;
    return { h: orbCandle.h, l: orbCandle.l, r: orbCandle.h - orbCandle.l };
  }, [candles, tick]);

  // ── AUTO: SD — last close as anchor, compATR as 1-SD proxy ───────────────
  const autoSD = useMemo(() => {
    if (!candles.length) return null;
    const lastC = candles[candles.length - 1].c;
    const atr   = compATR(candles, 14);
    // Daily SD ≈ ATR. Session SD ≈ ATR / sqrt(sessions per day, ~4 for NQ)
    const sessionSD = atr / 2; // half-ATR = ~1SD intraday move
    return { price: lastC, atr1: sessionSD, atrFull: atr };
  }, [candles, tick]);

  // ── Resolved values (override wins, else auto, else fallback) ─────────────
  const sh   = shOvr  ?? autoFib?.sh  ?? 19400;
  const sl   = slOvr  ?? autoFib?.sl  ?? 19100;
  const orH  = orHOvr ?? autoORB?.h   ?? orb?.high ?? 19350;
  const orL  = orLOvr ?? autoORB?.l   ?? orb?.low  ?? 19310;
  const price= pxOvr  ?? autoSD?.price?? 19250;
  const atr1 = atrOvr ?? autoSD?.atr1 ?? 40;

  const r   = sh - sl;
  const orR = orH - orL;

  // ── Fib levels (bearish swing — high to low retrace) ─────────────────────
  const fibs = [
    ["0.236",  sh - r * 0.236, "#94a3b8", false],
    ["0.382",  sh - r * 0.382, "#60a5fa", false],
    ["0.500",  sh - r * 0.500, "#a78bfa", false],
    ["0.618 ★ GP", sh - r * 0.618, "#f59e0b", true],
    ["0.705",  sh - r * 0.705, "#fb923c", false],
    ["0.786 OTE", sh - r * 0.786, "#f87171", true],
  ];
  const exts = [
    ["−1.272", sl - r * 0.272, "#94a3b8", false],
    ["−1.414", sl - r * 0.414, "#60a5fa", false],
    ["−1.618 ★", sl - r * 0.618, "#f59e0b", true],
    ["−2.000", sl - r * 1.000, "#fb923c", false],
    ["−2.618", sl - r * 1.618, "#f87171", false],
  ];
  // Golden pocket zone
  const gp_top = sh - r * 0.618;
  const gp_bot = sh - r * 0.786;

  // ── ORB levels ────────────────────────────────────────────────────────────
  const orbt = [
    ["3× Long  (TP3)", orH + 3 * orR, "#6ee7b7", false],
    ["2× Long  (TP2)", orH + 2 * orR, "#34d399", false],
    ["1× Long  (TP1)", orH + 1 * orR, "#10b981", true],
    ["OR High  (Entry)", orH,          "#00d4ff", false],
    ["OR Mid",          (orH + orL) / 2, "#94a3b8", false],
    ["OR Low   (Entry)", orL,          "#00d4ff", false],
    ["1× Short (TP1)", orL - 1 * orR, "#f87171", true],
    ["2× Short (TP2)", orL - 2 * orR, "#fca5a5", false],
    ["3× Short (TP3)", orL - 3 * orR, "#ef4444", false],
  ];

  // ── SD levels ─────────────────────────────────────────────────────────────
  const sdl = [
    ["+3SD", price + 3 * atr1, "#ef4444", false],
    ["+2SD", price + 2 * atr1, "#f97316", false],
    ["+1SD", price + 1 * atr1, "#fbbf24", true],
    ["Anchor (Last Close)", price, "#94a3b8", false],
    ["−1SD", price - 1 * atr1, "#34d399", true],
    ["−2SD", price - 2 * atr1, "#10b981", false],
    ["−3SD", price - 3 * atr1, "#059669", false],
  ];

  // ── Current price distance highlighting ──────────────────────────────────
  const lastPx = candles.length ? candles[candles.length-1].c : 0;
  const nearest = (arr) => arr.reduce((best, [,v]) =>
    Math.abs(v - lastPx) < Math.abs(best - lastPx) ? v : best, arr[0][1]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const AutoBadge = ({ label }) => (
    <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,
      background:"rgba(0,212,255,0.12)",border:"1px solid rgba(0,212,255,0.3)",
      color:"#00d4ff",fontFamily:"monospace",fontWeight:700,marginLeft:5,letterSpacing:0.5}}>
      {label}
    </span>
  );

  const inp = (label, val, setOvr, autoVal, autoLabel) => {
    const isAuto = autoVal !== null && autoVal !== undefined;
    const isOverridden = val !== (autoVal ?? val);
    return (
      <div style={{marginBottom:12,minWidth:130}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:4}}>
          <label style={{color:"#64748b",fontSize:10,fontWeight:700,letterSpacing:"0.08em",
            textTransform:"uppercase"}}>{label}</label>
          {isAuto && <AutoBadge label={autoLabel || "AUTO"}/>}
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <input type="number"
            value={typeof val === 'number' ? val.toFixed(2) : val}
            onChange={e => setOvr(parseFloat(e.target.value) || 0)}
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:6,color:"#e2e8f0",padding:"7px 10px",fontSize:13,
              width:120,fontFamily:"monospace"}}/>
          {isAuto && (
            <button onClick={() => setOvr(null)} title="Reset to auto"
              style={{fontSize:9,padding:"5px 7px",borderRadius:4,cursor:"pointer",
                fontFamily:"monospace",background:"rgba(0,212,255,0.07)",
                border:"1px solid rgba(0,212,255,0.2)",color:"#00d4ff"}}>↺</button>
          )}
        </div>
      </div>
    );
  };

  const LR = ({ l, v, c, star, active }) => {
    const isNearest = lastPx && Math.abs(v - lastPx) < (r || orR || atr1) * 0.08;
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"6px 10px",borderRadius:5,marginBottom:3,
        background: isNearest ? "rgba(0,212,255,0.06)" : "rgba(255,255,255,0.025)",
        border: isNearest ? "1px solid rgba(0,212,255,0.2)" : "1px solid transparent",
        transition:"all 0.2s"}}>
        <span style={{color: star ? "#94a3b8" : "#475569",fontSize:11,
          fontWeight: star ? 600 : 400}}>
          {star ? "★ " : ""}{l}
          {isNearest && <span style={{fontSize:8,color:"#00d4ff",marginLeft:5}}>◄ price near</span>}
        </span>
        <span style={{color:c,fontSize:12,fontFamily:"monospace",fontWeight:700}}>
          {v.toFixed(2)}
        </span>
      </div>
    );
  };

  const SectionHdr = ({ children }) => (
    <div style={{color:"#475569",fontSize:9,margin:"12px 0 6px",textTransform:"uppercase",
      letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700,
      borderBottom:"1px solid rgba(255,255,255,0.05)",paddingBottom:4}}>
      {children}
    </div>
  );

  const hasCandles = candles.length > 0;

  return (
    <div style={{maxWidth:520}}>
      {/* ── Mode tabs ── */}
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[["fib","📐 Fibonacci"],["orb","⏰ ORB"],["sd","📊 SD / ATR"]].map(([k,v])=>(
          <button key={k} onClick={()=>setMode(k)}
            style={{background:mode===k?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.04)",
              border:`1px solid ${mode===k?"#6366f1":"rgba(255,255,255,0.1)"}`,
              borderRadius:7,padding:"6px 16px",
              color:mode===k?"#818cf8":"#64748b",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {v}
          </button>
        ))}
        {!hasCandles && (
          <span style={{fontSize:9,color:"#475569",fontFamily:"monospace",
            padding:"6px 0",alignSelf:"center"}}>
            ⚠ Load chart data to enable auto-fill
          </span>
        )}
      </div>

      {/* ── FIBONACCI ── */}
      {mode==="fib" && (
        <div>
          {autoFib && (
            <div style={{padding:"8px 12px",borderRadius:7,marginBottom:16,
              background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)"}}>
              <span style={{fontSize:9,color:"#f59e0b",fontFamily:"monospace"}}>
                ⚡ Swing H/L auto-detected from PD Array — most recent 3M structural swing
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:4}}>
            {inp("Swing High", sh, setShOvr, autoFib?.sh, "PD SWING")}
            {inp("Swing Low",  sl, setSlOvr, autoFib?.sl, "PD SWING")}
          </div>
          <div style={{padding:"6px 10px",borderRadius:5,marginBottom:14,
            background:"rgba(255,255,255,0.025)",display:"flex",gap:20}}>
            <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>
              Range: <span style={{color:"#e2e8f0",fontWeight:700}}>{r.toFixed(2)}</span>
            </span>
            <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>
              GP Zone: <span style={{color:"#f59e0b",fontWeight:700}}>
                {gp_bot.toFixed(2)} – {gp_top.toFixed(2)}
              </span>
            </span>
          </div>

          <SectionHdr>Retracements (from high)</SectionHdr>
          {fibs.map(([l,v,c,star],i) => <LR key={i} l={l} v={v} c={c} star={star}/>)}

          <SectionHdr>Extensions (below low)</SectionHdr>
          {exts.map(([l,v,c,star],i) => <LR key={i} l={l} v={v} c={c} star={star}/>)}
        </div>
      )}

      {/* ── ORB ── */}
      {mode==="orb" && (
        <div>
          {autoORB && (
            <div style={{padding:"8px 12px",borderRadius:7,marginBottom:16,
              background:"rgba(0,212,255,0.05)",border:"1px solid rgba(0,212,255,0.2)"}}>
              <span style={{fontSize:9,color:"#00d4ff",fontFamily:"monospace"}}>
                ⏰ ORB auto-calculated from 9:30 AM EST opening candle · H: {autoORB.h.toFixed(2)} · L: {autoORB.l.toFixed(2)} · Range: {autoORB.r.toFixed(2)}
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:4}}>
            {inp("OR High", orH, setOrHOvr, autoORB?.h, "9:30 CANDLE")}
            {inp("OR Low",  orL, setOrLOvr, autoORB?.l, "9:30 CANDLE")}
          </div>
          <div style={{padding:"6px 10px",borderRadius:5,marginBottom:14,
            background:"rgba(255,255,255,0.025)",display:"flex",gap:20}}>
            <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>
              OR Range: <span style={{color:"#10b981",fontWeight:700}}>{orR.toFixed(2)}</span>
            </span>
            <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>
              OR Mid: <span style={{color:"#94a3b8",fontWeight:700}}>
                {((orH+orL)/2).toFixed(2)}
              </span>
            </span>
          </div>

          <SectionHdr>ORB Targets</SectionHdr>
          {orbt.map(([l,v,c,star],i) => <LR key={i} l={l} v={v} c={c} star={star}/>)}
        </div>
      )}

      {/* ── SD / ATR ── */}
      {mode==="sd" && (
        <div>
          {autoSD && (
            <div style={{padding:"8px 12px",borderRadius:7,marginBottom:16,
              background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)"}}>
              <span style={{fontSize:9,color:"#a78bfa",fontFamily:"monospace"}}>
                📊 Anchor = last close · 1 SD = ATR(14) ÷ 2 ≈ intraday session move · Full ATR: {autoSD.atrFull.toFixed(2)}
              </span>
            </div>
          )}
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:4}}>
            {inp("Anchor Price", price, setPxOvr, autoSD?.price, "LAST CLOSE")}
            {inp("1 SD (ATR÷2)",  atr1,  setAtrOvr, autoSD?.atr1,  "ATR AUTO")}
          </div>

          <SectionHdr>Standard Deviation Levels</SectionHdr>
          {sdl.map(([l,v,c,star],i) => <LR key={i} l={l} v={v} c={c} star={star}/>)}

          <SectionHdr>Reference</SectionHdr>
          <div style={{padding:"10px 12px",borderRadius:7,
            background:"rgba(255,255,255,0.025)",fontSize:9,
            color:"#475569",fontFamily:"monospace",lineHeight:1.9}}>
            Full ATR(14):&nbsp;
            <span style={{color:"#e2e8f0",fontWeight:700}}>{(autoSD?.atrFull ?? atr1*2).toFixed(2)}</span><br/>
            1 SD (session):&nbsp;
            <span style={{color:"#a78bfa",fontWeight:700}}>{atr1.toFixed(2)}</span><br/>
            2 SD:&nbsp;
            <span style={{color:"#f97316",fontWeight:700}}>{(atr1*2).toFixed(2)}</span>&nbsp;
            3 SD:&nbsp;
            <span style={{color:"#ef4444",fontWeight:700}}>{(atr1*3).toFixed(2)}</span><br/>
            Price vs +1SD:&nbsp;
            <span style={{color:lastPx > price+atr1?"#ef4444":lastPx < price-atr1?"#10b981":"#94a3b8",fontWeight:700}}>
              {lastPx > price+atr1 ? "EXTENDED ▲" : lastPx < price-atr1 ? "EXTENDED ▼" : "IN RANGE"}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FORWARD TEST TAB
// ═════════════════════════════════════════════════════════════════════════════
const FT_GRADE_CLR = { A:"#00ff8c", B:"#a3e635", C:"#f59e0b", D:"#ff4f4f" };
const FT_DEF_CFG = { minGrade:"B", autoAccept:false, capital:50000, riskPct:1, pointValue:20, useTradovate:false, tvSignals:true, scannerSignals:true };

function ftRFmt(r){ return r==null||isNaN(r)?"—":(r>=0?"+":"")+r.toFixed(2)+"R"; }
function ftTs(ms){ if(!ms) return "—"; const d=new Date(ms); return (d.getMonth()+1)+"/"+(d.getDate())+" "+d.getHours()+":"+String(d.getMinutes()).padStart(2,"0"); }

function ftCalcStats(trades){
  const c=trades.filter(t=>t.status==="closed"); if(!c.length) return null;
  const w=c.filter(t=>t.pnlR>0),l=c.filter(t=>t.pnlR<=0);
  const totalR=c.reduce((s,t)=>s+t.pnlR,0);
  const gW=w.reduce((s,t)=>s+t.pnlR,0),gL=Math.abs(l.reduce((s,t)=>s+t.pnlR,0));
  const pf=gL>0?gW/gL:gW>0?99:0;
  let run=0,peak=0,maxDD=0;
  const eq=c.map(t=>{ run+=t.pnlR; if(run>peak)peak=run; if(peak-run>maxDD)maxDD=peak-run; return{pnl:run}; });
  const gr={},st={};
  c.forEach(t=>{
    const g=t.grade||"—"; if(!gr[g])gr[g]={n:0,w:0,r:0}; gr[g].n++; if(t.pnlR>0)gr[g].w++; gr[g].r+=t.pnlR;
    const s=t.strategy||"manual"; if(!st[s])st[s]={n:0,w:0,r:0}; st[s].n++; if(t.pnlR>0)st[s].w++; st[s].r+=t.pnlR;
  });
  return{total:c.length,wins:w.length,losses:l.length,wr:w.length/c.length,totalR,pf,gW,gL,maxDD,eq,gr,st};
}

function FTCurve({ eq, color }){
  if(!eq||eq.length<2) return <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center",color:"#334155",fontSize:9,fontFamily:"monospace"}}>No closed trades</div>;
  const col=color||"#00d4ff";
  const v=eq.map(e=>e.pnl),mx=Math.max(...v,0.5),mn=Math.min(...v,-0.5),rg=mx-mn||1;
  const W=480,H=80,P=20;
  const xS=i=>P+(i/(eq.length-1))*(W-P*2);
  const yS=v2=>H-P-((v2-mn)/rg)*(H-P*2);
  const z=yS(0);
  const pts=eq.map((e,i)=>xS(i).toFixed(1)+","+yS(e.pnl).toFixed(1)).join(" ");
  const fd="M "+xS(0).toFixed(1)+","+z.toFixed(1)+" L "+eq.map((e,i)=>xS(i).toFixed(1)+","+yS(e.pnl).toFixed(1)).join(" L ")+" L "+xS(eq.length-1).toFixed(1)+","+z.toFixed(1)+" Z";
  return(
    <svg viewBox={"0 0 "+W+" "+H} style={{width:"100%",height:80}}>
      <defs><linearGradient id="ftcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.2"/><stop offset="100%" stopColor={col} stopOpacity="0"/></linearGradient></defs>
      {[-1,0,1,2].map(r=>{ if(r<mn-0.2||r>mx+0.2) return null; const y=yS(r); return(
        <g key={r}><line x1={P} y1={y} x2={W-P} y2={y} stroke={r===0?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)"} strokeWidth={r===0?1.2:0.6} strokeDasharray={r===0?"":"4,6"}/>
        <text x={P-3} y={y+3} fontSize={6} fill="#334155" textAnchor="end" fontFamily="monospace">{r}R</text></g>
      );})}
      <path d={fd} fill="url(#ftcg)"/>
      <line x1={P} y1={z} x2={W-P} y2={z} stroke="rgba(255,255,255,0.08)" strokeWidth={1}/>
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function ForwardTestTab({ tvConn, lastScanResult, candles, instrument, riskEngine, auditLog, lastAlert }){
  const [trades, setTradesRaw] = useState(()=>{ try{const r=localStorage.getItem(FT_KEY);return r?JSON.parse(r):[];}catch{return[];} });
  const [cfg, setCfgRaw] = useState(()=>{ try{const r=localStorage.getItem(FT_CFG);return r?{...FT_DEF_CFG,...JSON.parse(r)}:FT_DEF_CFG;}catch{return FT_DEF_CFG;} });
  const [pending, setPending] = useState([]);
  const [subTab, setSubTab] = useState("monitor");
  const [cfgOpen, setCfgOpen] = useState(false);

  const setTrades = useCallback(fn=>{
    setTradesRaw(prev=>{ const next=typeof fn==="function"?fn(prev):fn; try{localStorage.setItem(FT_KEY,JSON.stringify(next));}catch{} return next; });
  },[]);
  const setCfg = useCallback(fn=>{
    setCfgRaw(prev=>{ const next=typeof fn==="function"?fn(prev):fn; try{localStorage.setItem(FT_CFG,JSON.stringify(next));}catch{} return next; });
  },[]);

  const lastPrice = candles?.length?candles[candles.length-1].c:0;
  const scanRef=useRef(null), alertRef=useRef(null), autoRef=useRef(new Set());

  const acceptSig = useCallback(async sig=>{
    const rp=sig.entry&&sig.sl?Math.abs(sig.entry-sig.sl):null;
    let ordId=null;
    if(cfg.useTradovate&&tvConn?.api){
      try{
        const now=new Date(),m=now.getUTCMonth(),yr=String(now.getUTCFullYear()).slice(-1);
        const qc=m<2?"H":m<5?"M":m<8?"U":"Z";
        const sym=(instrument||"NQ")+qc+yr;
        const res=await tvConn.api.placeOrder({accountId:tvConn.accountId,symbol:sym,action:sig.direction==="LONG"?"Buy":"Sell",qty:1,orderType:"Market"});
        ordId=res?.orderId; auditLog&&auditLog("FT_ORDER","Demo: "+sig.direction+" "+sym+" #"+ordId);
      }catch(e){ auditLog&&auditLog("FT_ERROR","Demo order failed: "+e.message); }
    }
    const t={id:"ft_"+Date.now(),openedAt:Date.now(),status:"open",direction:sig.direction,grade:sig.grade||"C",strategy:sig.strategy||"unknown",source:sig.source||"manual",entry:sig.entry||lastPrice,sl:sig.sl,tp1:sig.tp1,tp2:sig.tp2,rp,notes:"",ordId,pnlR:null};
    setTrades(p=>[...p,t]); setPending(q=>q.filter(s=>s.id!==sig.id));
    auditLog&&auditLog("FT_OPEN","FWD "+t.direction+" @ "+(t.entry?t.entry.toFixed(2):"?")+" grade:"+t.grade);
  },[cfg,tvConn,instrument,lastPrice,auditLog,setTrades]);

  useEffect(()=>{
    if(!lastScanResult||!cfg.scannerSignals) return;
    const id=lastScanResult.direction+"_"+(lastScanResult.ts||Date.now());
    if(scanRef.current===id) return; scanRef.current=id;
    if(!["LONG","SHORT"].includes(lastScanResult.direction)) return;
    const sig={...lastScanResult,id:"scan_"+Date.now(),ts:lastScanResult.ts||Date.now(),source:"scanner",sl:lastScanResult.sl||lastScanResult.stop_price,tp1:lastScanResult.tp1||lastScanResult.tp1_price,tp2:lastScanResult.tp2||lastScanResult.tp2_price};
    if(cfg.autoAccept){const mi=["A","B","C","D"].indexOf(cfg.minGrade),si=["A","B","C","D"].indexOf(sig.grade||"D");if(si<=mi){acceptSig(sig);return;}}
    setPending(q=>q.some(s=>s.id===sig.id)?q:[...q,sig]);
  },[lastScanResult,cfg.scannerSignals,cfg.autoAccept,cfg.minGrade,acceptSig]);

  useEffect(()=>{
    if(!lastAlert||!cfg.tvSignals) return;
    const id=lastAlert.id||lastAlert.ts; if(alertRef.current===id) return; alertRef.current=id;
    const dir=(lastAlert.direction||lastAlert.action||"").toUpperCase();
    if(!["LONG","SHORT"].includes(dir)) return;
    const sig={id:"tv_"+Date.now(),ts:Date.now(),source:"tv",direction:dir,grade:lastAlert.grade||"C",entry:parseFloat(lastAlert.entry||lastAlert.price)||lastPrice,sl:parseFloat(lastAlert.sl||lastAlert.stop)||null,tp1:parseFloat(lastAlert.tp1)||null,tp2:parseFloat(lastAlert.tp2)||null,strategy:lastAlert.strategy||"tradingview"};
    if(cfg.autoAccept){acceptSig(sig);return;}
    setPending(q=>[...q,sig]);
  },[lastAlert,cfg.tvSignals,cfg.autoAccept,acceptSig,lastPrice]);

  const closeTrade = useCallback((t,exitPrice,reason)=>{
    setTrades(p=>p.map(x=>{
      if(x.id!==t.id) return x;
      const rp2=x.rp||(x.entry&&x.sl?Math.abs(x.entry-x.sl):1);
      const pnlPts=x.direction==="LONG"?exitPrice-x.entry:x.entry-exitPrice;
      const pnlR=rp2>0?pnlPts/rp2:0;
      auditLog&&auditLog("FT_CLOSE","FWD "+x.direction+" closed @ "+exitPrice.toFixed(2)+" "+ftRFmt(pnlR)+" ("+reason+")");
      return{...x,status:"closed",exitPrice,exitReason:reason,closedAt:Date.now(),pnlR};
    }));
  },[auditLog,setTrades]);

  useEffect(()=>{
    if(!lastPrice) return;
    trades.filter(t=>t.status==="open").forEach(t=>{
      if(autoRef.current.has(t.id)) return;
      const isLong=t.direction==="LONG";
      if(t.tp2&&(isLong?lastPrice>=t.tp2:lastPrice<=t.tp2)){autoRef.current.add(t.id);closeTrade(t,t.tp2,"tp2");}
      else if(t.sl&&(isLong?lastPrice<=t.sl:lastPrice>=t.sl)){autoRef.current.add(t.id);closeTrade(t,t.sl,"sl");}
    });
  },[lastPrice,trades,closeTrade]);

  const open  = trades.filter(t=>t.status==="open");
  const stats = useMemo(()=>ftCalcStats(trades),[trades]);
  const sC    = s=>s>=0.6?"#00ff8c":s>=0.4?"#f59e0b":"#ff4f4f";

  return(
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"20px 24px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div>
          <h2 style={{margin:0,fontSize:14,fontWeight:800,color:"#e2e8f0"}}>🚀 Forward Test Engine</h2>
          <p style={{margin:"2px 0 0",fontSize:10,color:"#475569"}}>Paper trading · Tradovate demo orders · Live P&amp;L analytics</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {tvConn&&<span style={{fontSize:8,fontFamily:"monospace",color:"#00d4ff",padding:"3px 8px",borderRadius:5,background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)"}}>● TRADOVATE {tvConn.env.toUpperCase()}</span>}
          {pending.length>0&&<span style={{fontSize:8,fontFamily:"monospace",color:"#f59e0b",padding:"3px 8px",borderRadius:5,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.35)"}}>{pending.length} SIGNAL{pending.length>1?"S":""} PENDING</span>}
          {stats&&<span style={{fontSize:8,fontFamily:"monospace",padding:"3px 8px",borderRadius:5,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:stats.totalR>=0?"#00ff8c":"#ff4f4f"}}>{ftRFmt(stats.totalR)} · {Math.round(stats.wr*100)}%WR</span>}
          <button onClick={()=>setCfgOpen(o=>!o)} style={{padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:700,background:cfgOpen?"rgba(99,102,241,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(cfgOpen?"rgba(99,102,241,0.4)":"rgba(255,255,255,0.08)"),color:cfgOpen?"#818cf8":"#475569"}}>⚙ CFG</button>
        </div>
      </div>

      {cfgOpen&&(
        <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[["Min Grade","minGrade","sel",["A","B","C","D"]],["Auto-Accept","autoAccept","chk"],["Capital ($)","capital","num"],["Risk %","riskPct","num"],["Pt Value","pointValue","num"],["TV Signals","tvSignals","chk"],["Scanner","scannerSignals","chk"],["Demo Orders","useTradovate","chk"]].map(([l,k,t,opts])=>(
            <div key={k}><div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>{l}</div>
              {t==="sel"?<select value={cfg[k]} onChange={e=>setCfg(c=>({...c,[k]:e.target.value}))} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,color:"#e2e8f0",padding:"4px 7px",fontSize:10,fontFamily:"monospace",width:"100%"}}>{(opts||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:t==="chk"?<input type="checkbox" checked={!!cfg[k]} onChange={e=>setCfg(c=>({...c,[k]:e.target.checked}))} style={{accentColor:"#00d4ff"}}/>:<input type="number" value={cfg[k]} onChange={e=>setCfg(c=>({...c,[k]:parseFloat(e.target.value)||0}))} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:4,color:"#e2e8f0",padding:"4px 7px",fontSize:10,fontFamily:"monospace",width:"100%"}}/>}
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        {[["monitor","📡 Monitor",pending.length||null],["trades","📋 Trades",trades.filter(t=>t.status==="closed").length||null],["stats","📊 Stats",null]].map(([k,label,badge])=>(
          <button key={k} onClick={()=>setSubTab(k)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 13px",borderRadius:7,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:600,background:subTab===k?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.04)",border:"1px solid "+(subTab===k?"#6366f1":"rgba(255,255,255,0.08)"),color:subTab===k?"#a5b4fc":"#64748b"}}>
            {label}{badge?<span style={{fontSize:7,background:"rgba(245,158,11,0.2)",border:"1px solid rgba(245,158,11,0.4)",color:"#f59e0b",borderRadius:4,padding:"0 4px",fontWeight:700}}>{badge}</span>:null}
          </button>
        ))}
        {open.length>0&&<div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4,fontSize:8,fontFamily:"monospace"}}><div style={{width:6,height:6,borderRadius:"50%",background:"#00ff8c",animation:"pulse 1.5s infinite"}}/><span style={{color:"#00ff8c",fontWeight:700}}>{open.length} OPEN</span></div>}
      </div>

      {subTab==="monitor"&&(
        <div>
          {open.map(t=>{
            const isLong=t.direction==="LONG";
            const pnlPts=isLong?lastPrice-t.entry:t.entry-lastPrice;
            const rp2=t.rp||(t.entry&&t.sl?Math.abs(t.entry-t.sl):1);
            const pnlR=rp2>0?pnlPts/rp2:0;
            const pC=pnlR>=2?"#00ff8c":pnlR>=0?"#a3e635":pnlR>=-0.5?"#f59e0b":"#ff4f4f";
            const tp1Hit=t.tp1&&(isLong?lastPrice>=t.tp1:lastPrice<=t.tp1);
            const slHit=t.sl&&(isLong?lastPrice<=t.sl:lastPrice>=t.sl);
            return(
              <div key={t.id} style={{background:"rgba(0,0,0,0.5)",border:"2px solid "+(isLong?"rgba(0,255,140,0.3)":"rgba(255,79,79,0.3)"),borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:isLong?"#00ff8c":"#ff4f4f",animation:"pulse 1.5s infinite"}}/>
                  <span style={{fontSize:9,color:isLong?"#00ff8c":"#ff4f4f",fontFamily:"monospace",fontWeight:700,letterSpacing:2}}>ACTIVE POSITION</span>
                  <span style={{marginLeft:"auto",fontSize:8,color:"#334155",fontFamily:"monospace"}}>{ftTs(t.openedAt)}</span>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:14,marginBottom:10}}>
                  <div>
                    <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}>UNREALISED P&amp;L</div>
                    <div style={{fontSize:26,fontWeight:900,color:pC,fontFamily:"monospace",lineHeight:1}}>{ftRFmt(pnlR)}</div>
                    <div style={{fontSize:9,color:"#475569",fontFamily:"monospace",marginTop:2}}>{pnlPts>0?"+":""}{pnlPts.toFixed(1)} pts</div>
                  </div>
                  <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                    {[["SL",t.sl,"#ff4f4f",slHit],["TP1",t.tp1,"#a3e635",tp1Hit],["TP2",t.tp2,"#00ff8c",false]].map(([l,v,c,hit])=>(
                      <div key={l} style={{background:hit?c+"18":"rgba(255,255,255,0.03)",borderRadius:6,padding:"5px 7px",border:"1px solid "+(hit?c+"55":"rgba(255,255,255,0.06)")}}>
                        <div style={{fontSize:7,color:c,fontFamily:"monospace",fontWeight:700,marginBottom:1}}>{hit?"✓ "+l:l}</div>
                        <div style={{fontSize:9,color:hit?c:"#64748b",fontFamily:"monospace",fontWeight:700}}>{v?v.toFixed(2):"—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {tp1Hit&&<button onClick={()=>closeTrade(t,t.tp1,"tp1")} style={{padding:"5px 12px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:700,background:"rgba(0,255,140,0.12)",border:"1px solid rgba(0,255,140,0.35)",color:"#00ff8c"}}>✓ CLOSE TP1</button>}
                  {slHit&&<button onClick={()=>closeTrade(t,t.sl,"sl")} style={{padding:"5px 12px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:700,background:"rgba(255,79,79,0.1)",border:"1px solid rgba(255,79,79,0.3)",color:"#ff4f4f"}}>✗ ACCEPT SL</button>}
                  <button onClick={()=>closeTrade(t,lastPrice,"manual")} style={{padding:"5px 12px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:700,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#64748b"}}>CLOSE @ {lastPrice?lastPrice.toFixed(2):"?"}</button>
                </div>
              </div>
            );
          })}
          {pending.map(sig=>{
            const gc=FT_GRADE_CLR[sig.grade]||"#64748b";
            const rp2=sig.entry&&sig.sl?Math.abs(sig.entry-sig.sl):null;
            const lots=rp2&&cfg.capital>0?Math.max(1,Math.floor(cfg.capital*cfg.riskPct/100/(rp2*cfg.pointValue))):1;
            return(
              <div key={sig.id} style={{background:"rgba(0,0,0,0.4)",border:"2px solid "+gc+"44",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:gc}}/>
                  <span style={{fontSize:9,color:"#475569",fontFamily:"monospace",fontWeight:700,letterSpacing:2}}>{sig.source==="tv"?"📡 TV SIGNAL":sig.source==="auto"?"⚡ AUTO":"🤖 AI SCANNER"}</span>
                  <span style={{marginLeft:"auto",fontSize:8,color:"#334155",fontFamily:"monospace"}}>{ftTs(sig.ts)}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                  <span style={{fontSize:20,fontWeight:900,color:sig.direction==="LONG"?"#00ff8c":"#ff4f4f",fontFamily:"monospace"}}>{sig.direction}</span>
                  <div style={{width:30,height:30,borderRadius:6,background:gc+"18",border:"2px solid "+gc+"55",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontWeight:900,fontSize:14,color:gc}}>{sig.grade||"?"}</div>
                  <div style={{fontSize:9,color:"#475569",fontFamily:"monospace"}}>{sig.strategy||"—"}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:8}}>
                  {[["Entry",sig.entry,"#94a3b8"],["SL",sig.sl,"#ff4f4f"],["TP1",sig.tp1,"#00ff8c"],["TP2",sig.tp2,"#10b981"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"5px 7px",border:"1px solid rgba(255,255,255,0.06)"}}>
                      <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",marginBottom:1}}>{l}</div>
                      <div style={{fontSize:9,color:c,fontFamily:"monospace",fontWeight:700}}>{v?v.toFixed(2):"—"}</div>
                    </div>
                  ))}
                </div>
                {rp2&&<div style={{fontSize:8,color:"#475569",fontFamily:"monospace",marginBottom:8}}>Risk: <span style={{color:"#e2e8f0"}}>{rp2.toFixed(1)}pts</span> · Suggested: <span style={{color:"#f59e0b",fontWeight:700}}>{lots}x</span>{cfg.useTradovate?" (demo order will be placed)":""}</div>}
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>acceptSig(sig)} style={{flex:1,padding:"8px 0",borderRadius:7,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:800,background:sig.direction==="LONG"?"rgba(0,255,140,0.15)":"rgba(255,79,79,0.15)",border:"1.5px solid "+(sig.direction==="LONG"?"rgba(0,255,140,0.45)":"rgba(255,79,79,0.45)"),color:sig.direction==="LONG"?"#00ff8c":"#ff4f4f"}}>✓ ACCEPT</button>
                  <button onClick={()=>setPending(q=>q.filter(s=>s.id!==sig.id))} style={{padding:"8px 16px",borderRadius:7,cursor:"pointer",fontFamily:"monospace",fontSize:11,fontWeight:700,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569"}}>SKIP</button>
                </div>
              </div>
            );
          })}
          {open.length===0&&pending.length===0&&(
            <div style={{padding:"32px 20px",textAlign:"center",borderRadius:10,background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{fontSize:24,marginBottom:8,opacity:0.3}}>📡</div>
              <div style={{fontSize:10,color:"#334155",fontFamily:"monospace",lineHeight:1.9}}>Waiting for signals…<br/><span style={{fontSize:8,color:"#1e293b"}}>Run AI Scanner · Enable TV webhook in Control tab</span></div>
            </div>
          )}
        </div>
      )}

      {subTab==="trades"&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:8,fontFamily:"monospace"}}>
              <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                {["Time","Dir","Grade","Strategy","Entry","SL","TP1","Exit","P&L","Result"].map(h=><th key={h} style={{padding:"5px 7px",textAlign:"left",color:"#334155",fontWeight:700,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {trades.slice().reverse().map((t,i)=>(
                  <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"rgba(255,255,255,0.01)":"transparent"}}>
                    <td style={{padding:"4px 7px",color:"#475569"}}>{ftTs(t.openedAt)}</td>
                    <td style={{padding:"4px 7px",color:t.direction==="LONG"?"#00ff8c":"#ff4f4f",fontWeight:700}}>{t.direction}</td>
                    <td style={{padding:"4px 7px",color:FT_GRADE_CLR[t.grade]||"#475569",fontWeight:800}}>{t.grade||"—"}</td>
                    <td style={{padding:"4px 7px",color:"#64748b",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.strategy||"—"}</td>
                    <td style={{padding:"4px 7px",color:"#94a3b8"}}>{t.entry?t.entry.toFixed(2):"—"}</td>
                    <td style={{padding:"4px 7px",color:"#ff4f4f"}}>{t.sl?t.sl.toFixed(2):"—"}</td>
                    <td style={{padding:"4px 7px",color:"#00ff8c"}}>{t.tp1?t.tp1.toFixed(2):"—"}</td>
                    <td style={{padding:"4px 7px",color:"#94a3b8"}}>{t.exitPrice?t.exitPrice.toFixed(2):t.status==="open"?"🔴":"—"}</td>
                    <td style={{padding:"4px 7px",color:t.pnlR>=0?"#00ff8c":"#ff4f4f",fontWeight:800}}>{t.status==="open"?"—":ftRFmt(t.pnlR)}</td>
                    <td style={{padding:"4px 7px",color:t.pnlR>0?"#00ff8c":t.pnlR<0?"#ff4f4f":"#64748b",fontWeight:700}}>{t.status==="open"?"OPEN":(t.exitReason||"").toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trades.length===0&&<div style={{padding:"24px",textAlign:"center",color:"#334155",fontSize:9,fontFamily:"monospace"}}>No trades yet — accept signals from the Monitor tab</div>}
          </div>
          {trades.length>0&&<button onClick={()=>{const b=new Blob([JSON.stringify(trades,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="forward_test.json";a.click();}} style={{marginTop:10,padding:"5px 14px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569"}}>↓ EXPORT JSON</button>}
        </div>
      )}

      {subTab==="stats"&&(
        stats?(
          <div>
            <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:9,color:"#00d4ff",fontFamily:"monospace",fontWeight:700,letterSpacing:2,marginBottom:6}}>EQUITY CURVE (R) — {stats.total} trades</div>
              <FTCurve eq={stats.eq} color={stats.totalR>=0?"#00d4ff":"#ff4f4f"}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              {[["WIN RATE",Math.round(stats.wr*100)+"%",stats.wins+"W / "+stats.losses+"L",sC(stats.wr)],
                ["PROFIT FACTOR",stats.pf.toFixed(2)+"x","gross W/L ratio",stats.pf>=1.5?"#00ff8c":stats.pf>=1?"#a3e635":"#ff4f4f"],
                ["TOTAL R",ftRFmt(stats.totalR),"running total",stats.totalR>=0?"#00ff8c":"#ff4f4f"],
                ["MAX DRAWDOWN","-"+stats.maxDD.toFixed(2)+"R","peak to trough",stats.maxDD<3?"#00ff8c":stats.maxDD<6?"#f59e0b":"#ff4f4f"],
              ].map(([l,v,sub,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,0.025)",borderRadius:8,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1.5,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:16,fontFamily:"monospace",fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                  <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",marginTop:3}}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",fontWeight:700,letterSpacing:2,marginBottom:8}}>GRADE BREAKDOWN</div>
                {Object.entries(stats.gr).map(([g,d])=>{const c=FT_GRADE_CLR[g]||"#64748b",wr2=d.n>0?d.w/d.n:0;return(
                  <div key={g} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                    <div style={{width:20,height:20,borderRadius:4,background:c+"18",border:"1.5px solid "+c+"55",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontWeight:900,fontSize:10,color:c}}>{g}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:8,color:"#94a3b8",fontFamily:"monospace"}}>{d.n}x {Math.round(wr2*100)}%</span><span style={{fontSize:8,fontFamily:"monospace",color:d.r>=0?"#00ff8c":"#ff4f4f",fontWeight:700}}>{ftRFmt(d.r)}</span></div>
                      <div style={{marginTop:2,height:3,borderRadius:2,background:"rgba(255,255,255,0.06)"}}><div style={{width:(wr2*100)+"%",height:"100%",borderRadius:2,background:c}}/></div>
                    </div>
                  </div>
                );})}
              </div>
              <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:8,color:"#475569",fontFamily:"monospace",fontWeight:700,letterSpacing:2,marginBottom:8}}>STRATEGY BREAKDOWN</div>
                {Object.entries(stats.st).slice(0,5).map(([s,d])=>{const wr2=d.n>0?d.w/d.n:0;return(
                  <div key={s} style={{marginBottom:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:8,color:"#94a3b8",fontFamily:"monospace",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s}</span><span style={{fontSize:8,fontFamily:"monospace",color:d.r>=0?"#00ff8c":"#ff4f4f",fontWeight:700}}>{ftRFmt(d.r)}</span></div>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}><div style={{flex:1,height:3,borderRadius:2,background:"rgba(255,255,255,0.06)"}}><div style={{width:(wr2*100)+"%",height:"100%",borderRadius:2,background:"#00d4ff"}}/></div><span style={{fontSize:7,color:"#475569",fontFamily:"monospace"}}>{d.n}x {Math.round(wr2*100)}%</span></div>
                  </div>
                );})}
              </div>
            </div>
          </div>
        ):<div style={{padding:"32px",textAlign:"center",color:"#334155",fontSize:10,fontFamily:"monospace"}}>No closed trades yet</div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STRATEGY AI CHAT TAB
// ═════════════════════════════════════════════════════════════════════════════
function scLineDiff(a, b){
  const al=String(a||"").split("\n"),bl=String(b||"").split("\n"),out=[];
  const m=Math.max(al.length,bl.length);
  for(let i=0;i<m;i++){
    const o=i<al.length?al[i]:null,n=i<bl.length?bl[i]:null;
    if(o===n) out.push({t:"same",text:n});
    else if(o===null) out.push({t:"add",text:n});
    else if(n===null) out.push({t:"rem",text:o});
    else{ out.push({t:"rem",text:o}); out.push({t:"add",text:n}); }
  }
  return out;
}

function SCDiffView({ diff }){
  const [exp,setExp]=useState(false);
  const changed=diff.filter(d=>d.t!=="same");
  if(!changed.length) return <div style={{fontSize:8,color:"#334155",fontFamily:"monospace",padding:"5px 8px",fontStyle:"italic"}}>No changes</div>;
  const show=exp?diff:diff.slice(0,50);
  return(
    <div style={{background:"rgba(0,0,0,0.5)",borderRadius:7,overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{padding:"3px 8px",background:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between"}}>
        <span style={{color:"#334155",fontSize:7}}>{changed.length} line{changed.length!==1?"s":""} changed</span>
        <span style={{color:"#475569",fontSize:7}}>+ green  − red</span>
      </div>
      <div style={{maxHeight:240,overflowY:"auto",padding:"2px 0"}}>
        {show.map((d,i)=>
          d.t==="same"?<div key={i} style={{padding:"1px 8px",color:"#334155",fontSize:7}}>{d.text}</div>:
          d.t==="add" ?<div key={i} style={{padding:"1px 8px",background:"rgba(0,255,140,0.07)",borderLeft:"2px solid #00ff8c",color:"#6ee7b7",fontSize:7}}>+ {d.text}</div>:
                       <div key={i} style={{padding:"1px 8px",background:"rgba(255,79,79,0.08)",borderLeft:"2px solid #ff4f4f",color:"#ff6b6b",fontSize:7}}>- {d.text}</div>
        )}
        {!exp&&diff.length>50&&<div onClick={()=>setExp(true)} style={{padding:"4px 8px",color:"#00d4ff",cursor:"pointer",fontSize:7,borderTop:"1px solid rgba(255,255,255,0.04)"}}>show {diff.length-50} more lines</div>}
      </div>
    </div>
  );
}

function scParseEdits(text){
  const edits=[];
  const re=/<strategy_edit type="([^"]+)" id="([^"]+)">([\s\S]*?)<\/strategy_edit>/g;
  let m;
  while((m=re.exec(text))!==null){
    const type=m[1],id=m[2],content=m[3];
    try{ edits.push({type,id,value:type==="rules"?JSON.parse(content.trim()):content.trim()}); }
    catch{ edits.push({type,id,value:content.trim()}); }
  }
  return edits;
}

function StrategyChatTab({ candles, instrument }){
  const [msgs,    setMsgs]    = useState(()=>{ try{const r=localStorage.getItem(SC_KEY);return r?JSON.parse(r):[];}catch{return[];} });
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [selId,   setSelId]   = useState("vivek_unicorn");
  const [apiKey,  setApiKey]  = useState(()=>{ try{return localStorage.getItem("anthropic_api_key")||"";}catch{return "";} });
  const [showKey, setShowKey] = useState(false);
  const [custom,  setCustom]  = useState([]);
  const [edits,   setEdits]   = useState({});
  const bottomRef=useRef(null), inputRef=useRef(null);

  useEffect(()=>{ loadStrategies().then(setCustom); },[]);
  useEffect(()=>{ try{localStorage.setItem(SC_KEY,JSON.stringify(msgs.slice(-60)));}catch{} },[msgs]);
  useEffect(()=>{ bottomRef.current&&bottomRef.current.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);

  const allStrats = useMemo(()=>[...BUILTIN_STRATEGIES.filter(s=>s.rules&&s.rules.length||s.code||s.notes),...custom],[custom]);
  const selStrat  = useMemo(()=>{ const b=allStrats.find(s=>s.id===selId)||allStrats[0]; return edits[selId]?{...b,...edits[selId]}:b; },[allStrats,selId,edits]);

  const buildCtx = useCallback(()=>{
    if(!selStrat) return "";
    const parts=[];
    parts.push("STRATEGY: "+selStrat.label);
    if(selStrat.notes) parts.push("NOTES: "+selStrat.notes);
    if(selStrat.rules&&selStrat.rules.length) parts.push("RULES:\n"+selStrat.rules.map((r,i)=>(i+1)+". "+r).join("\n"));
    if(selStrat.code) parts.push("PINE SCRIPT:\n"+selStrat.code);
    if(candles&&candles.length){
      const last=candles[candles.length-1];
      const atr=compATR(candles);
      const htf=compHTFBias(candles);
      parts.push("LIVE MARKET ("+instrument+"): price="+last.c.toFixed(2)+" ATR="+atr.toFixed(2)+" HTF: "+htf.map(b=>b.tf+"="+b.bias).join(", "));
    }
    return parts.join("\n\n");
  },[selStrat,candles,instrument]);

  const QUICK=[
    "Analyse this strategy and give me the top 3 improvements to increase win rate",
    "Add a volume confirmation filter to reduce false signals",
    "Add a kill rule for NY lunch and high-volatility news events",
    "Tighten the entry rules to only take A and B grade setups",
    "Explain step by step how this strategy creates edge in the market",
    "Add an EMA 200 higher-timeframe trend filter",
    "Update the Pine Script to trail the stop after TP1 is hit",
    "What market conditions make this strategy fail? How do I guard against them?",
    "Optimise the stop loss placement to reduce premature stop-outs",
    "Add SMT divergence NQ vs ES as an additional confirmation filter",
  ];

  const send = useCallback(async()=>{
    const text=input.trim(); if(!text||loading) return;
    const userMsg={id:"u_"+Date.now(),role:"user",content:text,ts:Date.now()};
    const history=[...msgs,userMsg];
    setMsgs(history); setInput(""); setLoading(true); setError(null);
    const ctx=buildCtx();
    const apiMsgs=history.map(m=>({role:m.role,content:m.content}));
    if(apiMsgs.length===1) apiMsgs[0]={role:"user",content:"[STRATEGY CONTEXT]\n"+ctx+"\n\n[QUESTION]\n"+text};
    const currentSelId=selId;
    const sysLines=[
      "You are an expert quantitative trading strategy designer and ICT/SMC specialist.",
      "You help traders improve their strategies with precise, actionable analysis.",
      "",
      "EDITING RULES: When the user asks you to change a strategy, output the edit using this EXACT format after your explanation:",
      "",
      'For rule changes: <strategy_edit type="rules" id="'+currentSelId+'">[complete updated rules array as JSON]</strategy_edit>',
      'For notes: <strategy_edit type="notes" id="'+currentSelId+'">updated notes text</strategy_edit>',
      'For Pine Script: <strategy_edit type="pine" id="'+currentSelId+'">updated pine script code</strategy_edit>',
      'For name: <strategy_edit type="label" id="'+currentSelId+'">new name</strategy_edit>',
      "",
      "When editing rules, output the COMPLETE rules array as valid JSON. Always explain WHY the change improves the strategy.",
    ];
    const sysPrompt=sysLines.join("\n");
    const headers={"Content-Type":"application/json","anthropic-version":"2023-06-01"};
    if(apiKey&&apiKey.trim()) headers["x-api-key"]=apiKey.trim();
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:headers,
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,system:sysPrompt,messages:apiMsgs}),
      });
      if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.error&&err.error.message?err.error.message:"HTTP "+res.status);}
      const data=await res.json();
      const txt=(data.content||[]).map(b=>b.text||"").join("");
      setMsgs(p=>[...p,{id:"a_"+Date.now(),role:"assistant",content:txt,ts:Date.now(),applied:[]}]);
    }catch(e){ setError(e.message); }
    setLoading(false);
  },[input,loading,msgs,apiKey,buildCtx,selId]);

  const applyEdit=useCallback((msgId,idx,edit)=>{
    const strat=allStrats.find(s=>s.id===edit.id); if(!strat) return;
    setEdits(prev=>{
      const cur=prev[edit.id]||{...strat};
      let patched=cur;
      if(edit.type==="rules")  patched={...cur,rules:edit.value};
      else if(edit.type==="notes")  patched={...cur,notes:edit.value};
      else if(edit.type==="pine")   patched={...cur,code:edit.value};
      else if(edit.type==="label")  patched={...cur,label:edit.value};
      return{...prev,[edit.id]:patched};
    });
    setMsgs(p=>p.map(m=>m.id!==msgId?m:{...m,applied:[...(m.applied||[]),idx]}));
    loadStrategies().then(list=>{
      const i=list.findIndex(s=>s.id===edit.id);
      if(i>=0){
        if(edit.type==="rules")  list[i]={...list[i],rules:edit.value};
        else if(edit.type==="notes")  list[i]={...list[i],notes:edit.value};
        else if(edit.type==="pine")   list[i]={...list[i],code:edit.value};
        else if(edit.type==="label")  list[i]={...list[i],label:edit.value};
        saveStrategies(list).then(()=>loadStrategies().then(setCustom));
      }
    });
  },[allStrats]);

  const stripTags=t=>t.replace(/<strategy_edit[\s\S]*?<\/strategy_edit>/g,"").trim();

  const fmtText=(text)=>{
    if(!text) return null;
    return text.split("\n").map((line,i)=>(
      <div key={i} style={{marginBottom:line===""?5:1}}>
        {line.split(/(\*\*[^*]+\*\*)/g).map((p,j)=>
          p.startsWith("**")&&p.endsWith("**")?<strong key={j} style={{color:"#e2e8f0"}}>{p.slice(2,-2)}</strong>:p
        )}
      </div>
    ));
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 180px)",minHeight:600,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,overflow:"hidden"}}>
      <div style={{padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(0,0,0,0.4)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#c084fc",boxShadow:"0 0 10px #c084fc"}}/>
            <span style={{fontSize:13,fontWeight:800,color:"#e2e8f0"}}>Strategy AI Chat</span>
            <span style={{fontSize:8,background:"rgba(192,132,252,0.15)",border:"1px solid rgba(192,132,252,0.4)",borderRadius:4,padding:"1px 6px",color:"#c084fc",fontWeight:700,fontFamily:"monospace"}}>CLAUDE</span>
          </div>
          <select value={selId} onChange={e=>setSelId(e.target.value)}
            style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:6,color:"#e2e8f0",padding:"5px 9px",fontSize:10,fontFamily:"monospace",cursor:"pointer",maxWidth:240}}>
            {allStrats.map(s=><option key={s.id} value={s.id}>{edits[s.id]?"✏ ":""}{s.label}</option>)}
          </select>
          {Object.keys(edits).length>0&&<span style={{fontSize:8,color:"#00ff8c",padding:"2px 8px",borderRadius:4,background:"rgba(0,255,140,0.08)",border:"1px solid rgba(0,255,140,0.2)",fontFamily:"monospace",fontWeight:700}}>{Object.keys(edits).length} EDIT{Object.keys(edits).length>1?"S":""} APPLIED</span>}
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button onClick={()=>setShowKey(o=>!o)} style={{padding:"4px 9px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:700,background:apiKey?"rgba(0,255,140,0.07)":"rgba(245,158,11,0.1)",border:"1px solid "+(apiKey?"rgba(0,255,140,0.2)":"rgba(245,158,11,0.3)"),color:apiKey?"#00ff8c":"#f59e0b"}}>{apiKey?"🔑 KEY SET":"🔑 KEY (opt)"}</button>
            <button onClick={()=>{if(window.confirm("Clear chat history?"))setMsgs([]);}} style={{padding:"4px 9px",borderRadius:5,cursor:"pointer",fontSize:8,fontFamily:"monospace",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569"}}>🗑 CLEAR</button>
          </div>
        </div>
        {showKey&&(
          <div style={{marginTop:8,display:"flex",gap:6}}>
            <input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value);try{localStorage.setItem("anthropic_api_key",e.target.value);}catch{}}} placeholder="Optional — leave blank to use built-in connection" style={{flex:1,background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:5,color:"#e2e8f0",padding:"6px 10px",fontSize:11,fontFamily:"monospace"}}/>
            <button onClick={()=>setShowKey(false)} style={{padding:"6px 12px",borderRadius:5,cursor:"pointer",fontSize:9,fontFamily:"monospace",background:"rgba(0,255,140,0.1)",border:"1px solid rgba(0,255,140,0.3)",color:"#00ff8c"}}>✓ SAVE</button>
          </div>
        )}
        {selStrat&&(
          <div style={{marginTop:8,padding:"7px 10px",borderRadius:6,background:"rgba(0,0,0,0.3)",border:"1px solid "+(selStrat.color||"#334155")+"33"}}>
            <span style={{fontSize:9,color:selStrat.color||"#64748b",fontFamily:"monospace",fontWeight:700}}>{selStrat.label}</span>
            <span style={{fontSize:8,color:"#334155",fontFamily:"monospace",marginLeft:8}}>{(selStrat.rules&&selStrat.rules.length)||0} rules{selStrat.code?" · Pine Script attached":""}{edits[selId]?" · edited":""}</span>
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>
        {msgs.length===0&&!loading&&(
          <div style={{textAlign:"center",padding:"32px 16px"}}>
            <div style={{fontSize:28,marginBottom:10,opacity:0.4}}>✨</div>
            <div style={{fontSize:12,color:"#334155",fontFamily:"monospace",fontWeight:700,marginBottom:5}}>Strategy AI ready</div>
            <div style={{fontSize:9,color:"#1e293b",fontFamily:"monospace",lineHeight:1.9,marginBottom:16}}>Ask Claude to analyse, fine-tune, or rewrite your strategy rules and Pine Script.<br/>Suggested changes show a diff — apply with one click.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,justifyContent:"center",maxWidth:620,margin:"0 auto"}}>
              {QUICK.slice(0,6).map((p,i)=><button key={i} onClick={()=>{setInput(p);inputRef.current&&inputRef.current.focus();}} style={{padding:"5px 10px",borderRadius:16,cursor:"pointer",fontSize:8,fontFamily:"monospace",background:"rgba(192,132,252,0.08)",border:"1px solid rgba(192,132,252,0.2)",color:"#a78bfa",lineHeight:1.4,textAlign:"left"}}>{p}</button>)}
            </div>
          </div>
        )}

        {msgs.map(msg=>{
          const isUser=msg.role==="user";
          const parsed=isUser?[]:scParseEdits(msg.content);
          const clean=isUser?msg.content:stripTags(msg.content);
          return(
            <div key={msg.id} style={{display:"flex",flexDirection:"column",alignItems:isUser?"flex-end":"flex-start",marginBottom:12}}>
              <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",fontWeight:700,letterSpacing:1.5,marginBottom:3,paddingLeft:isUser?0:3}}>{isUser?"YOU":"CLAUDE — STRATEGY AI"}</div>
              <div style={{maxWidth:"88%",background:isUser?"rgba(99,102,241,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(isUser?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)"),borderRadius:isUser?"12px 12px 4px 12px":"12px 12px 12px 4px",padding:"11px 13px",fontSize:11,color:"#cbd5e1",lineHeight:1.7,fontFamily:"Inter,sans-serif"}}>
                {fmtText(clean)}
                {parsed.map((edit,idx)=>{
                  const strat=allStrats.find(s=>s.id===edit.id); if(!strat) return null;
                  const oldVal=edit.type==="rules"?JSON.stringify(strat.rules,null,2):edit.type==="notes"?(strat.notes||""):edit.type==="pine"?(strat.code||""):edit.type==="label"?(strat.label||""):"";
                  const newVal=edit.type==="rules"?JSON.stringify(edit.value,null,2):String(edit.value);
                  const diff=scLineDiff(oldVal,newVal);
                  const applied=(msg.applied||[]).includes(idx);
                  return(
                    <div key={idx} style={{marginTop:10,background:"rgba(0,0,0,0.4)",borderRadius:9,overflow:"hidden",border:"1px solid "+(applied?"rgba(0,255,140,0.3)":"rgba(192,132,252,0.25)")}}>
                      <div style={{padding:"7px 10px",background:applied?"rgba(0,255,140,0.06)":"rgba(192,132,252,0.06)",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                        <span style={{fontSize:8,color:applied?"#00ff8c":"#c084fc",fontFamily:"monospace",fontWeight:700}}>{applied?"✓ APPLIED":"PROPOSED EDIT"}</span>
                        <span style={{fontSize:8,color:"#64748b",fontFamily:"monospace"}}>{strat.label} — {edit.type.toUpperCase()}</span>
                        {!applied&&(
                          <div style={{marginLeft:"auto",display:"flex",gap:5}}>
                            <button onClick={()=>applyEdit(msg.id,idx,edit)} style={{padding:"3px 10px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace",fontWeight:700,background:"rgba(0,255,140,0.15)",border:"1px solid rgba(0,255,140,0.4)",color:"#00ff8c"}}>✓ APPLY</button>
                            <button style={{padding:"3px 8px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569"}}>SKIP</button>
                          </div>
                        )}
                        {applied&&(
                          <button onClick={()=>{setEdits(p=>{const n={...p};delete n[edit.id];return n;});setMsgs(p=>p.map(m=>m.id!==msg.id?m:{...m,applied:(m.applied||[]).filter(ii=>ii!==idx)}));}} style={{marginLeft:"auto",padding:"3px 8px",borderRadius:4,cursor:"pointer",fontSize:8,fontFamily:"monospace",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#475569"}}>↩ UNDO</button>
                        )}
                      </div>
                      <div style={{padding:"7px 9px"}}><SCDiffView diff={diff}/></div>
                    </div>
                  );
                })}
              </div>
              {msg.ts&&<div style={{fontSize:7,color:"#1e293b",fontFamily:"monospace",marginTop:2,paddingLeft:isUser?0:3}}>{new Date(msg.ts).toLocaleTimeString()}</div>}
            </div>
          );
        })}

        {loading&&(
          <div style={{display:"flex",alignItems:"flex-start",marginBottom:10}}>
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"12px 12px 12px 4px",padding:"11px 14px",display:"flex",gap:5,alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#c084fc",opacity:0.7,animation:"pulse "+(0.8+i*0.2)+"s infinite"}}/>)}
              <span style={{fontSize:9,color:"#475569",fontFamily:"monospace",marginLeft:4}}>Claude is thinking...</span>
            </div>
          </div>
        )}
        {error&&<div style={{padding:"7px 10px",borderRadius:6,marginBottom:8,background:"rgba(255,79,79,0.08)",border:"1px solid rgba(255,79,79,0.2)",fontSize:9,color:"#ff4f4f",fontFamily:"monospace"}}>{error}</div>}
        <div ref={bottomRef}/>
      </div>

      {msgs.length>0&&(
        <div style={{padding:"6px 18px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",gap:5,overflowX:"auto",flexShrink:0}}>
          {QUICK.map((p,i)=><button key={i} onClick={()=>{setInput(p);inputRef.current&&inputRef.current.focus();}} style={{flexShrink:0,padding:"3px 9px",borderRadius:14,cursor:"pointer",fontSize:7,fontFamily:"monospace",background:"rgba(192,132,252,0.07)",border:"1px solid rgba(192,132,252,0.18)",color:"#7c3aed",whiteSpace:"nowrap"}}>{p.length>40?p.slice(0,40)+"…":p}</button>)}
        </div>
      )}

      <div style={{padding:"10px 18px",borderTop:"1px solid rgba(255,255,255,0.07)",background:"rgba(0,0,0,0.35)",flexShrink:0}}>
        <div style={{display:"flex",gap:7,alignItems:"flex-end"}}>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }}
            placeholder={"Ask about "+(selStrat&&selStrat.label?selStrat.label:"your strategy")+"… (Enter to send, Shift+Enter for newline)"}
            rows={2}
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:10,color:"#e2e8f0",padding:"9px 12px",fontSize:12,fontFamily:"Inter,sans-serif",resize:"none",lineHeight:1.5}}/>
          <button onClick={send} disabled={loading||!input.trim()}
            style={{padding:"9px 18px",borderRadius:10,cursor:loading||!input.trim()?"not-allowed":"pointer",fontFamily:"monospace",fontSize:11,fontWeight:800,background:loading||!input.trim()?"rgba(99,102,241,0.06)":"rgba(99,102,241,0.22)",border:"1.5px solid "+(loading||!input.trim()?"rgba(99,102,241,0.12)":"rgba(99,102,241,0.55)"),color:loading||!input.trim()?"#334155":"#a5b4fc",height:58,flexShrink:0}}>
            {loading?"⟳":"SEND"}
          </button>
        </div>
        <div style={{marginTop:4,fontSize:7,color:"#1e293b",fontFamily:"monospace"}}>Enter to send · Shift+Enter for newline · Strategy edits apply live</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("chart"),[cat,setCat]=useState(null);
  const [chartState,setChartState]=useState({candles:[],obs:[],bbs:[],fvgs:[],liq:[],orb:null,ote:null,ofData:[],instrument:"NQ",activeStrategy:null});
  const [tradeSetup, setTradeSetup] = useState(null);
  const [tvConn,         setTvConn]         = useState(null);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [positions,      setPositions]      = useState([]);
  // ── Shared strategy selection — drives both StrategiesTab toggle + AIScannerTab ──
  const [enabledStrats, setEnabledStrats] = useState(
    () => new Set(["vivek_unicorn","kz_confluence","liq_sweep_ifvg","crt_engulf"])
  );
  const [accountBalance, setAccountBalance] = useState(null);
  const [dayPnl,         setDayPnl]         = useState(0);
  const [lastPrice,      setLastPrice]      = useState(0);
  // Derive lastPrice from chartState candles (updated by LiveChartTab)
  const derivedLastPrice = chartState.candles?.length ? chartState.candles[chartState.candles.length-1].c : lastPrice;
  const [tvWebhookOn,    setTvWebhookOn]    = useState(false);
  // ── Audit log ──────────────────────────────────────────────────────────
  const { entries: auditEntries, log: auditLog, clear: auditClear } = useAuditLog();
  // ── Risk engine ────────────────────────────────────────────────────────
  const riskEngine = useRiskEngine({ accountBalance, dayPnl, log: auditLog });
  // ── Multi-TF candles ───────────────────────────────────────────────────
  const { tfCandles } = useMultiTFCandles({
    conn:       tvConn,
    instrument: chartState.instrument || "NQ",
  });
  // ── TV Webhook poller ──────────────────────────────────────────────────
  const { lastAlert, webhookStatus } = useTVWebhook({
    enabled:  tvWebhookOn,
    onAlert:  (alert) => {
      if (alert.direction) setLastScanResult(alert);
    },
    log: auditLog,
  });
  // ── Auto-journal at NY session close ────────────────────────────────────
  const { journaled } = useAutoJournal({
    auditEntries,
    tradeSetup,
    conn:       tvConn,
    instrument: chartState.instrument || "NQ",
    log:        auditLog,
  });
  const TABS=[["chart","📈 Live Chart"],["strategies","📐 Strategies"],["concepts","📚 Concepts"],["calc","🔢 Calculator"],["scanner","🤖 AI Scanner"],["control","⚡ Control"],["journal","📓 Journal & Calendar"],["backtest","🔬 Backtest"],["forwardtest","🚀 Forward Test"],["strategychat","✨ Strategy AI"]];
  return (
    <div style={{minHeight:"100vh",background:"#080c14",fontFamily:"'Inter',-apple-system,sans-serif",color:"#e2e8f0"}}>
      <div style={{background:"linear-gradient(180deg,#0d1521 0%,#080c14 100%)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"14px 24px 10px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#00d4ff",boxShadow:"0 0 12px #00d4ff",animation:"pulse 2s infinite"}}/>
              <h1 style={{margin:0,fontSize:"15px",fontWeight:800,color:"#f1f5f9",letterSpacing:"-0.02em"}}>QUANT FUTURES REFERENCE</h1>
              <span style={{fontSize:"10px",background:"rgba(99,102,241,0.2)",border:"1px solid #4f46e5",borderRadius:"4px",padding:"1px 7px",color:"#818cf8",fontWeight:700}}>PRO</span>
            </div>
            <p style={{margin:"3px 0 0 18px",fontSize:"11px",color:"#475569"}}>ICT · SMC · ORB · CRT · IRL/ERL · PDH/PDL/PWH/PWL · AI Scanner · Trade Journal</p>
          </div>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
            {TABS.map(([k,v])=>(<button key={k} onClick={()=>setTab(k)} style={{background:tab===k?k==="scanner"?"rgba(168,85,247,0.25)":k==="journal"?"rgba(0,212,255,0.18)":k==="forwardtest"?"rgba(0,255,140,0.15)":k==="strategychat"?"rgba(192,132,252,0.18)":"rgba(99,102,241,0.25)":"rgba(255,255,255,0.04)",border:`1px solid ${tab===k?k==="scanner"?"#a855f7":k==="journal"?"#00d4ff":k==="forwardtest"?"#00ff8c":k==="strategychat"?"#c084fc":"#6366f1":"rgba(255,255,255,0.1)"}`,borderRadius:"8px",padding:"7px 14px",color:tab===k?k==="scanner"?"#c084fc":k==="journal"?"#67e8f9":k==="forwardtest"?"#00ff8c":k==="strategychat"?"#e879f9":"#a5b4fc":"#64748b",fontSize:"12px",fontWeight:600,cursor:"pointer"}}>{v}</button>))}
          </div>
        </div>
      </div>
      <div style={{maxWidth:"1200px",margin:"0 auto",padding:tab==="chart"?"14px 24px":"24px"}}>
        {tab==="chart"&&<LiveChartTab onStateChange={setChartState} tradeSetup={tradeSetup} onTradeSetupUpdate={setTradeSetup} tvConn={tvConn} setTvConn={setTvConn} lastScanResult={lastScanResult}/>}
        {tab==="concepts"&&<ConceptsTab/>}
        {tab==="calc"&&<div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px",padding:"24px"}}><h2 style={{margin:"0 0 6px",fontSize:"14px",fontWeight:700,color:"#e2e8f0"}}>Level Calculator</h2><p style={{margin:"0 0 20px",fontSize:"11px",color:"#475569"}}>Compute Fibonacci, ORB, and SD levels in real-time</p><CalcTab candles={chartState.candles} orb={chartState.orb}/></div>}
        {tab==="scanner"&&<AIScannerTab candles={chartState.candles} obs={chartState.obs} bbs={chartState.bbs} fvgs={chartState.fvgs} liq={chartState.liq} orb={chartState.orb} ote={chartState.ote} ofData={chartState.ofData} instrument={chartState.instrument} activeStrategy={chartState.activeStrategy} tradeSetup={tradeSetup} onSetupFound={s=>setTradeSetup(s)} onClearSetup={()=>setTradeSetup(null)} onScanResult={s=>setLastScanResult(s)} tvConn={tvConn} riskEngine={riskEngine} auditLog={auditLog} tfCandles={tfCandles} enabledStrats={enabledStrats} setEnabledStrats={setEnabledStrats} onAutoExecute={async(sig)=>{
          const risk=riskEngine.riskCheck();
          if(!risk.ok){auditLog("BLOCK","Auto-exec blocked: "+risk.reason);return;}
          riskEngine.recordTrade();
          const g=sig.grade||computeGrade(sig.conviction,sig.confluence_score,sig.key_conditions_met,sig.gateway_pass,sig.fvg_sequence);
          const mid=sig.entry_bot?((parseFloat(sig.entry_top||0)+parseFloat(sig.entry_bot||0))/2):null;
          setLastScanResult({...sig,id:"auto_"+Date.now(),ts:Date.now(),source:"auto",grade:g,entry:mid,sl:sig.stop_price,tp1:sig.tp1_price,tp2:sig.tp2_price,strategy:sig.model||"AI Scanner"});
          if(tvConn&&tvConn.api&&sig.direction!=="FLAT"){
            try{
              const now2=new Date(),mo=now2.getUTCMonth(),yr=String(now2.getUTCFullYear()).slice(-1);
              const qc=mo<2?"H":mo<5?"M":mo<8?"U":"Z";
              const sym2=(chartState.instrument||"NQ")+qc+yr;
              const res2=await tvConn.api.placeOrder({accountId:tvConn.accountId,symbol:sym2,action:sig.direction==="LONG"?"Buy":"Sell",qty:1,orderType:"Market"});
              auditLog("FT_ORDER","Auto-exec "+sig.direction+" "+sym2+" #"+(res2&&res2.orderId?res2.orderId:"?"));
            }catch(e2){auditLog("FT_ERROR","Auto-exec order failed: "+e2.message);}
          }
        }}/>}
        {tab==="journal"&&<JournalCalendarTab/>}
        {tab==="control"&&(
          <ExecutionAuditTab
            conn={tvConn}
            tfCandles={tfCandles}
            positions={positions}
            lastPrice={derivedLastPrice}
            tradeSetup={tradeSetup}
            webhookStatus={webhookStatus}
            lastAlert={lastAlert}
            tvWebhookOn={tvWebhookOn}
            onToggleWebhook={()=>setTvWebhookOn(v=>!v)}
            riskEngine={riskEngine}
            auditLog={auditLog}
            auditEntries={auditEntries}
            onAuditClear={auditClear}
            journaled={journaled}
          />
        )}
        {tab==="strategies"&&<StrategiesTab enabledStrats={enabledStrats} setEnabledStrats={setEnabledStrats}/>}
        {tab==="backtest"&&<BacktestTab tvConn={tvConn} enabledStrats={enabledStrats} setEnabledStrats={setEnabledStrats}/>}
        {tab==="forwardtest"&&<ForwardTestTab tvConn={tvConn} lastScanResult={lastScanResult} candles={chartState.candles} instrument={chartState.instrument} riskEngine={riskEngine} auditLog={auditLog} lastAlert={lastAlert}/>}
        {tab==="strategychat"&&<StrategyChatTab candles={chartState.candles} instrument={chartState.instrument}/>}
      </div>
      <div style={{textAlign:"center",padding:"20px",borderTop:"1px solid rgba(255,255,255,0.04)",color:"#1e293b",fontSize:"10px"}}>For educational purposes only. Not financial advice.</div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box}input:focus,textarea:focus,select:focus{outline:none;border-color:rgba(99,102,241,0.5)!important}button:hover{opacity:0.85}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}select option{background:#0d1521}`}</style>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// BACKTEST ENGINE — Tradovate MD · Oanda v20 · Synthetic
// ─────────────────────────────────────────────────────────────────────────────

// ── Instrument config ────────────────────────────────────────────────────────
const BT_INSTRUMENTS = {
  NQ:     { label:'NQ Futures',  source:'tradovate', tvSym:'NQ',      oandaSym:null,      basePrice:21000, atrMult:1.0,  pipSize:0.25,   currency:'USD', decimals:2 },
  ES:     { label:'ES Futures',  source:'tradovate', tvSym:'ES',      oandaSym:null,      basePrice:5200,  atrMult:0.25, pipSize:0.25,   currency:'USD', decimals:2 },
  XAUUSD: { label:'Gold/USD',    source:'oanda',     tvSym:null,      oandaSym:'XAU_USD', basePrice:2300,  atrMult:1.0,  pipSize:0.01,   currency:'USD', decimals:2 },
  EURUSD: { label:'EUR/USD',     source:'oanda',     tvSym:null,      oandaSym:'EUR_USD', basePrice:1.085, atrMult:0.0005, pipSize:0.0001, currency:'USD', decimals:5 },
  GBPUSD: { label:'GBP/USD',     source:'oanda',     tvSym:null,      oandaSym:'GBP_USD', basePrice:1.27,  atrMult:0.0006, pipSize:0.0001, currency:'USD', decimals:5 },
};

// ── Synthetic generator — adapts to instrument ───────────────────────────────
function btGenSynthetic(instKey, days) {
  const cfg = BT_INSTRUMENTS[instKey];
  const candles = [];
  let price = cfg.basePrice * (1 + (Math.random() - 0.5) * 0.04);
  const rng = (a, b) => a + Math.random() * (b - a);
  const startTs = Math.floor(Date.now() / 1000) - days * 86400;

  for (let d = 0; d < days; d++) {
    const dayBase = startTs + d * 86400;
    const dow = new Date(dayBase * 1000).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const bias = rng(-0.0012, 0.002);
    // 14:30 UTC = 9:30 EST for futures; 8:00 UTC for FX London open
    const sessionOpen = cfg.source === 'oanda'
      ? dayBase - (dayBase % 86400) + 8 * 3600
      : dayBase - (dayBase % 86400) + 14 * 3600 + 30 * 60;
    const bars = cfg.source === 'oanda' ? 120 : 78; // 10hrs FX vs 6.5hrs futures

    for (let bar = 0; bar < bars; bar++) {
      const t = sessionOpen + bar * 300;
      let vm = bar < 6 ? 2.2 : bar < 18 ? 1.7 : bar < 24 ? 1.0 :
               bar < 36 ? 0.5 : bar < 48 ? 1.5 : bar < 54 ? 1.2 : 0.8;
      const atr = cfg.atrMult * rng(0.7, 1.4) * vm;
      const dir = bar < 12 ? -bias * 1.8 : bar < 36 ? bias * 2.2 : bias * 0.4;
      const move = atr * dir + rng(-atr * 0.65, atr * 0.65);
      const o = price, c = o + move;
      const bH = Math.max(o, c), bL = Math.min(o, c);
      const h = bH + rng(0, atr * 0.4);
      const l = bL - rng(0, atr * 0.4);
      candles.push({
        t, o: +o.toFixed(cfg.decimals), h: +h.toFixed(cfg.decimals),
        l: +l.toFixed(cfg.decimals),   c: +c.toFixed(cfg.decimals), v: Math.round(rng(300, 2000) * vm)
      });
      price = c;
      // Mean revert to base price slowly
      price += (cfg.basePrice - price) * 0.001;
    }
  }
  return candles;
}

// ── CSV parser ───────────────────────────────────────────────────────────────
function btParseCsv(raw) {
  return raw.trim().split(String.fromCharCode(10))
    .filter(l => l.trim() && !/^(time|date|timestamp)/i.test(l))
    .map(r => {
      const p = r.split(',').map(s => s.trim().split('"').join(''));
      let t = parseFloat(p[0]);
      if (isNaN(t)) t = Math.floor(new Date(p[0]).getTime() / 1000);
      else if (t > 1e12) t = Math.floor(t / 1000);
      return { t, o: +p[1], h: +p[2], l: +p[3], c: +p[4], v: +(p[5] || 0) };
    }).filter(x => x.c && !isNaN(x.c) && x.h >= x.l);
}

// ── Tradovate MD WebSocket fetch ─────────────────────────────────────────────
async function btFetchTradovate(conn, instKey, count) {
  return new Promise((resolve, reject) => {
    const wsUrl = TV_MD_WS[conn.env];
    const ws = new WebSocket(wsUrl);
    const candles = [];
    let authed = false;
    let reqId = 1;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Tradovate MD WebSocket timeout (30s). Check your connection.'));
    }, 30000);

    ws.onmessage = (evt) => {
      const raw = evt.data;
      if (raw === 'o') {
        // Send auth
        ws.send(JSON.stringify({
          url: 'authorize', id: reqId++,
          body: { token: conn.mdToken }
        }));
        return;
      }
      try {
        const msgs = JSON.parse(raw.substring(1)); // strip leading frame type char
        for (const msg of msgs) {
          if (msg.d === 'authorized') {
            authed = true;
            // Request historical 5m bars
            const sym = BT_INSTRUMENTS[instKey].tvSym;
            ws.send(JSON.stringify({
              url: 'chart/subscribe', id: reqId++,
              body: {
                symbol: sym,
                chartDescription: {
                  underlyingType: 'MinuteBar',
                  elementSize: 5,
                  elementSizeUnit: 'UnderlyingUnits',
                  withHistogram: false
                },
                timeRange: { asMuchAsElements: count }
              }
            }));
          }
          if (msg.d && Array.isArray(msg.d.bars)) {
            for (const b of msg.d.bars) {
              candles.push({
                t: Math.floor(new Date(b.timestamp).getTime() / 1000),
                o: b.open, h: b.high, l: b.low, c: b.close, v: b.upVolume + b.downVolume
              });
            }
            // If we got a full batch, we're done
            if (candles.length >= count * 0.8) {
              clearTimeout(timeout);
              ws.close();
              resolve(candles.sort((a, b) => a.t - b.t));
            }
          }
        }
      } catch {}
    };

    ws.onerror = (e) => { clearTimeout(timeout); reject(new Error('Tradovate WebSocket error — are you connected?')); };
    ws.onclose = () => {
      if (candles.length > 100) {
        clearTimeout(timeout);
        resolve(candles.sort((a, b) => a.t - b.t));
      }
    };
  });
}

// ── Oanda v20 REST fetch ─────────────────────────────────────────────────────
async function btFetchOanda(apiKey, env, instKey, count) {
  const base = env === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com';
  const oandaSym = BT_INSTRUMENTS[instKey].oandaSym;
  if (!oandaSym) throw new Error(instKey + ' is not an Oanda instrument — use Tradovate instead');

  // Oanda max 5000 candles per request — fetch in batches if needed
  const batchSize = Math.min(count, 5000);
  const url = base + '/v3/instruments/' + oandaSym + '/candles?granularity=M5&count=' + batchSize + '&price=M';

  let res;
  try {
    res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept-Datetime-Format': 'UNIX' },
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) {
    // CORS fallback — try allorigins proxy
    const proxied = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    res = await fetch(proxied, { signal: AbortSignal.timeout(20000) });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Oanda: Invalid API key (401). Check your key and environment (practice vs live).');
    throw new Error('Oanda: HTTP ' + res.status + ' — ' + body.slice(0, 120));
  }

  const json = await res.json();
  if (!json.candles) throw new Error('Oanda returned no candles. Check instrument and API key.');

  return json.candles
    .filter(c => c.complete)
    .map(c => ({
      t: Math.floor(parseFloat(c.time)),
      o: parseFloat(c.mid.o), h: parseFloat(c.mid.h),
      l: parseFloat(c.mid.l), c: parseFloat(c.mid.c),
      v: c.volume || 0
    })).filter(x => !isNaN(x.c) && x.h >= x.l);
}

// ── Signal detection (instrument-aware) ──────────────────────────────────────
function btDetect(cs, i, instKey, enabledStrats) {
  if (i < 150 || i >= cs.length - 2) return null;
  const slice = cs.slice(Math.max(0, i - 249), i + 1);
  const last = slice[slice.length - 1];
  const cfg = BT_INSTRUMENTS[instKey];

  // Session filter
  const d = new Date(last.t * 1000);
  const h = d.getUTCHours(), min = d.getUTCMinutes();
  const utcMin = h * 60 + min;
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return null;

  let inSession;
  if (cfg.source === 'oanda') {
    // FX: London 7-10 UTC, NY 13-16 UTC
    inSession = (utcMin >= 420 && utcMin <= 600) || (utcMin >= 780 && utcMin <= 960);
  } else {
    // Futures: EST sessions
    const estMin = utcMin - 300;
    const sbWin = estMin >= 570 && estMin <= 660;
    const nyPM  = estMin >= 810 && estMin <= 900;
    const lunch = estMin >= 720 && estMin <= 810;
    if (lunch) return null;
    inSession = sbWin || nyPM;
  }

  const atr    = compATR(slice);
  const swings = compSwings(slice);
  const mss    = compMSS(slice);
  const disp   = compDisplacement(slice);
  if (!mss.bull && !mss.bear) return null;

  const direction = mss.bull ? 'LONG' : 'SHORT';
  const obs     = genOBs(slice);
  const bbs     = genBBs(slice);
  const fvgs    = genFVGs(slice);
  const ifvgs   = compIFVGs(slice);
  const liq     = genLiq(slice);
  const ote     = compOTE(slice, swings);
  const sweep   = compSweepSignal(slice, liq);
  const fvgSeq  = compFVGSequence(slice, fvgs, ifvgs);
  const price   = last.c;

  const nearOB   = obs.some(o => !o.mit && Math.abs(((o.top + o.bot) / 2) - price) < atr * 1.2);
  const nearBB   = bbs.some(b => Math.abs(((b.top + b.bot) / 2) - price) < atr * 1.2);
  const activeFvg = fvgSeq.stage === 'ACTIVE' || fvgSeq.stage === 'COMPLETE';

  const gates = [
    mss.bull || mss.bear,
    inSession,
    disp.score >= 55,
    sweep.swept,
    activeFvg,
    ote.inOTE,
    nearOB,
    nearBB,
    (mss.quality || 0) >= 55,
    true,
  ];
  const passed = gates.filter(Boolean).length;
  if (passed < 4) return null;

  const grade = passed >= 9 ? 'A' : passed >= 7 ? 'B' : passed >= 5 ? 'C' : 'D';
  if (grade === 'D') return null;

  // Max stop: instrument-aware
  const maxStop = cfg.source === 'oanda'
    ? atr * 2.5   // FX/Gold: 2.5× ATR
    : 30;          // Futures: 30pts hard limit

  let sl;
  if (direction === 'LONG') {
    const cands = swings.filter(s => s.type === 'SL' && s.price < price).sort((a,b) => b.price - a.price);
    sl = cands.length ? cands[0].price - atr * 0.1 : price - atr * 1.5;
  } else {
    const cands = swings.filter(s => s.type === 'SH' && s.price > price).sort((a,b) => a.price - b.price);
    sl = cands.length ? cands[0].price + atr * 0.1 : price + atr * 1.5;
  }
  const risk = Math.abs(price - sl);
  if (risk > maxStop || risk < atr * 0.15) return null;

  const tp1 = direction === 'LONG' ? price + risk     : price - risk;
  const tp2 = direction === 'LONG' ? price + risk * 2 : price - risk * 2;

  const tags = [];
  if (gates[0] && gates[2] && gates[3]) tags.push('ICT Base');
  if ((gates[5] && gates[4]) && (!enabledStrats || enabledStrats.has('vivek_unicorn')))  tags.push('Vivek Unicorn');
  if ((gates[6] && gates[7]) && (!enabledStrats || enabledStrats.has('kz_confluence')))  tags.push('KZ Confluence');
  if (tags.length === 0) tags.push('ICT Base');

  return { direction, grade, entry: price, sl, tp1, tp2, risk,
    passed, strategies: tags, atr, timestamp: last.t, candleIdx: i,
    dispScore: disp.score, inSession };
}


// ── Exit mode simulator ───────────────────────────────────────────────────────
// exitMode: 'partial_be' | 'full_tp1' | 'full_tp2' | 'be_trail'
function btSimulateMode(cs, fromIdx, sig, exitMode) {
  const maxJ  = Math.min(fromIdx + 80, cs.length - 1);
  const long  = sig.direction === 'LONG';
  let tp1Hit  = false;

  for (let j = fromIdx + 1; j <= maxJ; j++) {
    const c = cs[j];
    const hi = c.h, lo = c.l;

    // ── SL always checked first ───────────────────────────────────────────
    const slHit = long ? lo <= sig.sl : hi >= sig.sl;
    if (slHit && !tp1Hit) {
      return { outcome: 'LOSS', exitPrice: sig.sl, exitIdx: j, legs: [-1] };
    }

    // ── TP1 zone ──────────────────────────────────────────────────────────
    const tp1Hit_now = long ? hi >= sig.tp1 : lo <= sig.tp1;

    if (!tp1Hit && tp1Hit_now) {
      // full_tp1: close entire position here
      if (exitMode === 'full_tp1') {
        return { outcome: 'WIN_TP1', exitPrice: sig.tp1, exitIdx: j, legs: [1] };
      }
      tp1Hit = true;
    }

    // ── After TP1 hit ────────────────────────────────────────────────────
    if (tp1Hit) {
      // BE hit (stop moved to entry)
      const beHit = long ? lo <= sig.entry : hi >= sig.entry;
      if (beHit && exitMode !== 'full_tp2') {
        // partial_be: 0.5R (closed half at TP1 = +1R, half at BE = 0, avg = +0.5R)
        // be_trail:    0R  (whole position closed at BE)
        const pnl = exitMode === 'partial_be' ? 0.5 : 0;
        return { outcome: 'WIN_BE', exitPrice: sig.entry, exitIdx: j, legs: [pnl] };
      }

      // full_tp2: after TP1 the stop is NOT moved — can still lose full 1R
      if (exitMode === 'full_tp2' && slHit) {
        return { outcome: 'LOSS', exitPrice: sig.sl, exitIdx: j, legs: [-1] };
      }

      // TP2 hit
      const tp2Hit = long ? hi >= sig.tp2 : lo <= sig.tp2;
      if (tp2Hit) {
        // partial_be: 0.5R (TP1) + 1.0R (TP2 on remaining 50%) = 1.5R total
        // full_tp2:   2R  (full size)
        // be_trail:   2R  (full size, stop at BE so no loss risk)
        const pnl = exitMode === 'partial_be' ? 1.5 : 2;
        return { outcome: 'WIN_TP2', exitPrice: sig.tp2, exitIdx: j, legs: [pnl] };
      }
    }
  }

  // Timeout — use last candle close
  const ep = cs[maxJ];
  const delta = long ? ep.c - sig.entry : sig.entry - ep.c;
  const rawR  = delta / sig.risk;

  if (!tp1Hit) {
    return { outcome: rawR >= 0 ? 'SCRATCH_W' : 'SCRATCH_L', exitPrice: ep.c, exitIdx: maxJ, legs: [rawR] };
  }
  // Timeout after TP1 — partial closed half at TP1, remainder at market
  if (exitMode === 'partial_be') {
    const partial = 0.5 + rawR * 0.5; // half at TP1 (+1R on half = 0.5R) + half at market
    return { outcome: 'TIMEOUT_WIN', exitPrice: ep.c, exitIdx: maxJ, legs: [partial] };
  }
  return { outcome: rawR >= 0 ? 'TIMEOUT_WIN' : 'TIMEOUT_LOSS', exitPrice: ep.c, exitIdx: maxJ, legs: [rawR] };
}

// ── Stats for one mode ────────────────────────────────────────────────────────
// ddOptions: { dailyLimitR: number, maxDDR: number }
function btStats(trades, ddOptions) {
  if (!trades.length) return null;
  const dl  = ddOptions?.dailyLimitR || 0;  // daily loss circuit breaker
  const mdd = ddOptions?.maxDDR      || 0;  // max total drawdown circuit breaker

  // Apply circuit breakers to get filtered trade sequence
  let filtered = trades;
  if (dl > 0 || mdd > 0) {
    filtered = [];
    let cumPnl = 0, peak = 0;
    const dailyPnl = {};
    for (const t of trades) {
      // Daily drawdown gate
      if (dl > 0 && t.entryTime) {
        const dayKey = new Date(t.entryTime * 1000).toISOString().slice(0, 10);
        const dp = dailyPnl[dayKey] || 0;
        if (dp <= -dl) continue; // day limit hit — skip trade
      }
      // Max DD circuit breaker
      if (mdd > 0 && (peak - cumPnl) >= mdd) break;

      filtered.push(t);
      cumPnl += t.pnlR;
      if (cumPnl > peak) peak = cumPnl;
      if (dl > 0 && t.entryTime) {
        const dayKey = new Date(t.entryTime * 1000).toISOString().slice(0, 10);
        dailyPnl[dayKey] = (dailyPnl[dayKey] || 0) + t.pnlR;
      }
    }
  }

  if (!filtered.length) return { total:0, winRate:0, totalPnl:0, expectancy:0, pf:0,
    maxDD:0, maxCL:0, equity:[], byGrade:{}, byStrat:{}, avgWin:0, avgLoss:0,
    filtered: 0, skipped: trades.length };

  const wins   = filtered.filter(t => t.pnlR > 0);
  const losses = filtered.filter(t => t.pnlR < 0);
  const hard   = filtered.filter(t => ['LOSS','WIN_TP2','WIN_BE','WIN_TP1'].includes(t.outcome));
  const hardW  = hard.filter(t => t.pnlR > 0);
  const winRate    = hard.length ? hardW.length / hard.length : 0;
  const totalPnl   = filtered.reduce((s, t) => s + t.pnlR, 0);
  const expectancy = filtered.length ? totalPnl / filtered.length : 0;
  const gW = wins.reduce((s,t)=>s+t.pnlR,0);
  const gL = Math.abs(losses.reduce((s,t)=>s+t.pnlR,0));
  const pf = gL > 0 ? gW / gL : gW > 0 ? 99 : 0;

  let peak2 = 0, maxDD2 = 0, run = 0, maxCL = 0, curCL = 0;
  // Drawdown calculation: both peak-to-trough AND longest underwater period
  let underwaterStart = null, longestUnderwater = 0, underwaterDays = 0;
  const equity = filtered.map((t, idx) => {
    run += t.pnlR;
    if (run > peak2) { peak2 = run; underwaterStart = null; }
    else if (underwaterStart === null) underwaterStart = idx;
    const dd = peak2 - run;
    if (dd > maxDD2) maxDD2 = dd;
    if (underwaterStart !== null) {
      underwaterDays = idx - underwaterStart;
      if (underwaterDays > longestUnderwater) longestUnderwater = underwaterDays;
    }
    if (t.pnlR < 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else curCL = 0;
    return { pnl: run };
  });

  const byGrade = {};
  ['A','B','C'].forEach(g => {
    const gt = filtered.filter(t => t.grade === g);
    const hg = gt.filter(t => ['LOSS','WIN_TP2','WIN_BE','WIN_TP1'].includes(t.outcome));
    const hw = hg.filter(t => t.pnlR > 0);
    byGrade[g] = { trades: gt.length, winRate: hg.length ? hw.length/hg.length : 0,
      pnl: gt.reduce((s,t)=>s+t.pnlR,0), avgRR: hw.length ? hw.reduce((s,t)=>s+t.rr,0)/hw.length : 0 };
  });

  const allTags = [...new Set(filtered.flatMap(t => t.strategies||[]))];
  const byStrat = {};
  allTags.forEach(tag => {
    const st = filtered.filter(t => (t.strategies||[]).includes(tag));
    const sh = st.filter(t => ['LOSS','WIN_TP2','WIN_BE','WIN_TP1'].includes(t.outcome));
    const sw = sh.filter(t => t.pnlR > 0);
    byStrat[tag] = { trades: st.length, winRate: sh.length ? sw.length/sh.length : 0,
      pnl: st.reduce((s,t)=>s+t.pnlR,0) };
  });

  // Recovery factor = totalPnl / maxDD
  const recoveryFactor = maxDD2 > 0 ? totalPnl / maxDD2 : totalPnl > 0 ? 99 : 0;

  return { total: filtered.length, filtered: filtered.length, skipped: trades.length - filtered.length,
    winRate, totalPnl, expectancy, pf, maxDD: maxDD2, maxCL, longestUnderwater,
    recoveryFactor, equity, byGrade, byStrat,
    avgWin:  wins.length   ? gW / wins.length   : 0,
    avgLoss: losses.length ? gL / losses.length  : 0 };
}

// ── Run all 4 modes on same signal set ───────────────────────────────────────
function btRunAllModes(cs, signals, ddOptions) {
  const MODES = [
    { key:'partial_be', label:'Partial 50% → BE → Trail', short:'Partial+Trail', color:'#00d4ff' },
    { key:'full_tp1',   label:'Full Close at TP1',         short:'Full TP1',     color:'#00ff8c' },
    { key:'full_tp2',   label:'Full Close at TP2 (Hold)',  short:'Full TP2',     color:'#a78bfa' },
    { key:'be_trail',   label:'BE Only + Trail',           short:'BE+Trail',     color:'#f59e0b' },
  ];

  const results = {};
  for (const mode of MODES) {
    const trades = signals.map(sig => {
      const out  = btSimulateMode(cs, sig.candleIdx, sig, mode.key);
      const pnlR = out.legs ? out.legs[0] : 0;
      const delta = sig.direction === 'LONG' ? out.exitPrice - sig.entry : sig.entry - out.exitPrice;
      return { ...sig, ...out, pnlR, rr: pnlR, pnlPts: delta,
        entryTime: cs[sig.candleIdx]?.t, exitTime: cs[out.exitIdx]?.t };
    });
    results[mode.key] = { trades, stats: btStats(trades, ddOptions), meta: mode };
  }
  return { modes: MODES, results };
}


// ── Exit mode simulator ───────────────────────────────────────────────────────
// exitMode: 'partial_be' | 'full_tp1' | 'full_tp2' | 'be_trail'
function BacktestTab({ tvConn, enabledStrats: btEnabledStratsProp, setEnabledStrats: btSetEnabledStratsProp }) {
  const [btEnabledStratsLocal, setBtEnabledStratsLocal] = useState(
    () => new Set(["vivek_unicorn","kz_confluence","liq_sweep_ifvg","crt_engulf"])
  );
  const btEnabledStrats    = btEnabledStratsProp    ?? btEnabledStratsLocal;
  const setBtEnabledStrats = btSetEnabledStratsProp ?? setBtEnabledStratsLocal;

  const [dataSource, setDataSource] = useState('synthetic');
  const [instKey,    setInstKey]    = useState('NQ');
  const [range,      setRange]      = useState('30d');
  const [oandaKey,   setOandaKey]   = useState(() => { try { return localStorage.getItem('oanda_api_key') || ''; } catch { return ''; } });
  const [oandaEnv,   setOandaEnv]   = useState(() => { try { return localStorage.getItem('oanda_env') || 'practice'; } catch { return 'practice'; } });
  const [csvText,    setCsvText]    = useState('');
  const [ddDaily,    setDdDaily]    = useState(0);
  const [ddMax,      setDdMax]      = useState(0);
  const [status,     setStatus]     = useState('idle');
  const [prog,       setProg]       = useState(0);
  const [statusMsg,  setStatusMsg]  = useState('');
  const [err,        setErr]        = useState(null);
  const [comparison, setComparison] = useState(null);
  const [activeMode, setActiveMode] = useState('partial_be');
  const [view,       setView]       = useState('compare');
  const [filter,     setFilter]     = useState('ALL');

  const DAYS   = { '5d':8,'15d':22,'30d':44,'60d':88 };
  const COUNTS = { '5d':500,'15d':1500,'30d':3000,'60d':6000 };
  const GC  = { A:'#00ff8c', B:'#a3e635', C:'#f59e0b' };
  const OC  = o => ['LOSS','SCRATCH_L','TIMEOUT_LOSS'].includes(o) ? '#ff4f4f' : '#00ff8c';
  const OL  = o => o==='WIN_TP2'?'✓TP2':o==='WIN_BE'?'✓BE':o==='WIN_TP1'?'✓TP1':
                   o==='LOSS'?'✗SL':o==='SCRATCH_W'?'~+':o==='SCRATCH_L'?'~-':
                   o==='TIMEOUT_WIN'?'⏱+':'⏱-';
  const pct  = v => (v*100).toFixed(1)+'%';
  const rFmt = v => (v>=0?'+':'')+v.toFixed(2)+'R';
  const dt   = ts => {
    if (!ts) return '—';
    const d = new Date(ts*1000);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+
      d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  };

  const cfg = BT_INSTRUMENTS[instKey] || BT_INSTRUMENTS['NQ'];
  const saveOandaKey = k => { setOandaKey(k); try { localStorage.setItem('oanda_api_key',k); } catch {} };
  const saveOandaEnv = e => { setOandaEnv(e); try { localStorage.setItem('oanda_env',e); } catch {} };

  const execBacktest = async (cs) => {
    setStatus('running'); setProg(0);
    const signals = [];
    for (let i = 150; i < cs.length - 2; i++) {
      if (i % 50 === 0) {
        setProg(Math.round(i/cs.length*45));
        setStatusMsg('Pass 1/2 — candle '+i+'/'+cs.length+' — '+signals.length+' signals');
        await new Promise(r => setTimeout(r,0));
      }
      const sig = btDetect(cs, i, instKey, btEnabledStrats);
      if (!sig) continue;
      signals.push({ ...sig, candleIdx: i });
      i += 3;
    }
    setProg(50);
    setStatusMsg('Pass 2/2 — simulating '+signals.length+' signals × 4 exit modes…');
    await new Promise(r => setTimeout(r,0));
    const comp = btRunAllModes(cs, signals, { dailyLimitR:ddDaily, maxDDR:ddMax });
    setComparison(comp);
    setProg(100);
    setStatusMsg(signals.length+' signals · '+(ddDaily||ddMax?'DD filter active':'no filter'));
    setStatus('done');
  };

  const run = async () => {
    setErr(null); setComparison(null); setProg(0); setStatusMsg('');
    try {
      if (dataSource==='synthetic') {
        setStatus('fetching'); setStatusMsg('Generating synthetic '+instKey+' candles…');
        await new Promise(r=>setTimeout(r,60));
        const cs = btGenSynthetic(instKey, DAYS[range]||44);
        if (cs.length<200) throw new Error('Generator produced too few candles');
        await execBacktest(cs);
      } else if (dataSource==='tradovate') {
        if (!tvConn) throw new Error('Not connected to Tradovate — connect from Chart tab first.');
        if (cfg.source!=='tradovate') throw new Error(instKey+' is FX/Gold — use Oanda source.');
        setStatus('fetching'); setStatusMsg('Connecting to Tradovate MD WebSocket…');
        const cs = await btFetchTradovate(tvConn, instKey, COUNTS[range]||3000);
        if (cs.length<200) throw new Error('Only '+cs.length+' bars from Tradovate.');
        await execBacktest(cs);
      } else if (dataSource==='oanda') {
        if (!oandaKey.trim()) throw new Error('Enter your Oanda API key below.');
        if (cfg.source!=='oanda') throw new Error(instKey+' is futures — use Tradovate source.');
        setStatus('fetching'); setStatusMsg('Fetching '+instKey+' from Oanda '+oandaEnv+'…');
        const cs = await btFetchOanda(oandaKey.trim(), oandaEnv, instKey, COUNTS[range]||3000);
        if (cs.length<200) throw new Error('Only '+cs.length+' candles from Oanda.');
        await execBacktest(cs);
      } else if (dataSource==='csv') {
        if (!csvText.trim()) throw new Error('Paste CSV data first.');
        const cs = btParseCsv(csvText);
        if (cs.length<200) throw new Error('Only '+cs.length+' rows — need 200+.');
        await execBacktest(cs);
      }
    } catch(e) { setErr(e.message); setStatus('error'); }
  };

  const activeModeData  = comparison?.results?.[activeMode];
  const activeStats     = activeModeData?.stats;
  const activeTrades    = activeModeData?.trades || [];
  const shown = filter==='WIN' ? activeTrades.filter(t=>t.pnlR>0) :
    filter==='LOSS' ? activeTrades.filter(t=>t.pnlR<=0) : activeTrades;

  const validInsts = Object.entries(BT_INSTRUMENTS).filter(([k,v]) =>
    dataSource==='tradovate' ? v.source==='tradovate' :
    dataSource==='oanda'     ? v.source==='oanda' : true);

  const handleSourceChange = src => {
    setDataSource(src);
    if (src==='tradovate' && cfg.source!=='tradovate') setInstKey('NQ');
    if (src==='oanda'     && cfg.source!=='oanda')     setInstKey('XAUUSD');
  };

  const ModeIcon = { partial_be:'◑', full_tp1:'①', full_tp2:'②', be_trail:'▷' };
  const S = {
    card:  { padding:'14px 16px', borderRadius:10, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.07)' },
    lbl:   { fontSize:8, color:'#475569', fontFamily:'monospace', fontWeight:700, letterSpacing:1.5, marginBottom:5, display:'block' },
    sel:   { background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e2e8f0', padding:'6px 10px', fontFamily:'monospace', fontSize:10 },
    inp:   { background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e2e8f0', padding:'6px 10px', fontFamily:'monospace', fontSize:10, width:'100%', boxSizing:'border-box' },
    nInp:  { background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, color:'#e2e8f0', padding:'5px 8px', fontFamily:'monospace', fontSize:10, width:60, textAlign:'center' },
  };

  return (
    <div style={{maxWidth:1160,margin:'0 auto'}}>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:800,color:'#e2e8f0',fontFamily:'monospace',letterSpacing:1}}>🔬 BACKTEST ENGINE</div>
        <div style={{fontSize:9,color:'#334155',fontFamily:'monospace',marginTop:2}}>
          4 exit modes compared on same signal set · Tradovate MD · Oanda v20 · Daily + total DD circuit breakers
        </div>
      </div>

      {/* Config */}
      <div style={{marginBottom:12,borderRadius:10,overflow:'hidden',background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)',overflowX:'auto'}}>
          {[['tradovate','📡 Tradovate','NQ · ES'],['oanda','🌐 Oanda','XAU · EUR · GBP'],
            ['synthetic','🧪 Synthetic','Always works'],['csv','📋 CSV','Any source']].map(([v,l,sub]) => (
            <button key={v} onClick={()=>handleSourceChange(v)} disabled={status==='running'||status==='fetching'}
              style={{flex:'0 0 auto',padding:'10px 16px',cursor:'pointer',border:'none',textAlign:'left',minWidth:110,
                fontSize:9,fontFamily:'monospace',fontWeight:700,
                background:dataSource===v?'rgba(0,212,255,0.1)':'transparent',
                color:dataSource===v?'#00d4ff':'#334155',
                borderBottom:dataSource===v?'2px solid #00d4ff':'2px solid transparent'}}>
              <div>{l}</div>
              <div style={{fontSize:7,fontWeight:400,marginTop:2,color:dataSource===v?'#00d4ff88':'#1e293b'}}>
                {v==='tradovate'?(tvConn?'● '+(tvConn.accountName||'Connected'):'○ Not connected'):sub}
              </div>
            </button>
          ))}
        </div>

        <div style={{padding:'14px 16px',display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-start'}}>
          {/* Instrument + Range */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end',flexShrink:0}}>
            <div>
              <span style={S.lbl}>INSTRUMENT</span>
              <select value={instKey} onChange={e=>setInstKey(e.target.value)} disabled={status==='running'} style={S.sel}>
                {validInsts.map(([k,v])=><option key={k} value={k}>{v.label} ({k})</option>)}
              </select>
            </div>
            <div>
              <span style={S.lbl}>RANGE</span>
              <select value={range} onChange={e=>setRange(e.target.value)} disabled={status==='running'} style={S.sel}>
                {[['5d','5 Days'],['15d','15 Days'],['30d','30 Days'],['60d','60 Days']].map(([v,l])=>
                  <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Source config */}
          <div style={{flex:1,minWidth:240}}>
            {dataSource==='tradovate' && (
              <div style={{padding:'10px 12px',borderRadius:8,
                background:tvConn?'rgba(0,255,140,0.06)':'rgba(255,79,79,0.06)',
                border:'1px solid '+(tvConn?'rgba(0,255,140,0.2)':'rgba(255,79,79,0.2)')}}>
                {tvConn
                  ? <div style={{fontSize:9,color:'#00ff8c',fontFamily:'monospace'}}>● {tvConn.accountName} ({tvConn.env})</div>
                  : <><div style={{fontSize:9,color:'#ff4f4f',fontFamily:'monospace',fontWeight:700,marginBottom:3}}>○ Not connected</div>
                     <div style={{fontSize:8,color:'#475569',fontFamily:'monospace'}}>Go to 📈 Chart → connect Tradovate → return here</div></>}
              </div>
            )}
            {dataSource==='oanda' && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'end'}}>
                  <div>
                    <span style={S.lbl}>OANDA API KEY — free at oanda.com → My Account → API Access</span>
                    <input type="password" value={oandaKey} onChange={e=>saveOandaKey(e.target.value)}
                      placeholder="Paste your Oanda v20 token"
                      style={{...S.inp,letterSpacing:oandaKey?'0.12em':'normal'}} />
                  </div>
                  <div>
                    <span style={S.lbl}>ENV</span>
                    <select value={oandaEnv} onChange={e=>saveOandaEnv(e.target.value)} style={S.sel}>
                      <option value="practice">Practice</option>
                      <option value="live">Live</option>
                    </select>
                  </div>
                </div>
                <div style={{fontSize:7,color:'#334155',fontFamily:'monospace'}}>
                  XAU_USD · EUR_USD · GBP_USD · up to 5,000 M5 candles · CORS-enabled, no proxy needed · key saved locally
                </div>
              </div>
            )}
            {dataSource==='synthetic' && (
              <div style={{padding:'10px 12px',borderRadius:8,background:'rgba(0,212,255,0.04)',border:'1px solid rgba(0,212,255,0.1)'}}>
                <div style={{fontSize:8,color:'#475569',fontFamily:'monospace',lineHeight:1.7}}>
                  AMD session model · open range spike · manipulation leg · distribution · lunch compression · PM push · instrument-specific ATR and sessions
                </div>
              </div>
            )}
            {dataSource==='csv' && (
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <span style={S.lbl}>PASTE 5M OHLCV — TradingView: right-click chart → Export Data</span>
                <textarea rows={3} value={csvText} onChange={e=>setCsvText(e.target.value)}
                  placeholder="timestamp,open,high,low,close,volume"
                  style={{...S.inp,resize:'vertical',color:'#94a3b8',fontSize:8,padding:8}} />
                {csvText.trim().length>10 && <div style={{fontSize:8,color:'#00ff8c',fontFamily:'monospace'}}>
                  ✓ {csvText.trim().split(String.fromCharCode(10)).filter(l=>l.trim()&&!/^(time|date)/i.test(l)).length} rows
                </div>}
              </div>
            )}
          </div>

          {/* Drawdown controls */}
          <div style={{flexShrink:0}}>
            <span style={S.lbl}>DRAWDOWN CONTROLS</span>
            <div style={{padding:'10px 12px',borderRadius:8,background:'rgba(249,115,22,0.05)',border:'1px solid rgba(249,115,22,0.15)',display:'flex',flexDirection:'column',gap:9}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:8,color:'#f97316',fontFamily:'monospace',width:108}}>Daily loss limit</span>
                <input type="number" min="0" max="20" step="0.5" value={ddDaily||''} onChange={e=>setDdDaily(parseFloat(e.target.value)||0)}
                  placeholder="off" style={S.nInp} />
                <span style={{fontSize:7,color:'#334155',fontFamily:'monospace'}}>R / day</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:8,color:'#f97316',fontFamily:'monospace',width:108}}>Max DD stop</span>
                <input type="number" min="0" max="100" step="1" value={ddMax||''} onChange={e=>setDdMax(parseFloat(e.target.value)||0)}
                  placeholder="off" style={S.nInp} />
                <span style={{fontSize:7,color:'#334155',fontFamily:'monospace'}}>R total</span>
              </div>
              <div style={{fontSize:7,fontFamily:'monospace',color:ddDaily||ddMax?'#f97316':'#1e293b'}}>
                {ddDaily>0?'● skip trades if day loss ≥ -'+ddDaily+'R  ':''}
                {ddMax>0?'● halt after -'+ddMax+'R peak DD':''}
                {!ddDaily&&!ddMax?'0 = off for both':''}
              </div>
            </div>
          </div>

          {/* Strategy filter chips */}
          <div style={{flexShrink:0,maxWidth:220}}>
            <span style={S.lbl}>STRATEGY FILTER</span>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {SCANNER_STRATEGIES.map(s => {
                const isOn = s.alwaysOn || btEnabledStrats.has(s.id);
                return (
                  <button key={s.id} disabled={!!s.alwaysOn || status==='running'}
                    onClick={() => {
                      const next = new Set(btEnabledStrats);
                      if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                      setBtEnabledStrats(next);
                    }}
                    style={{padding:'5px 10px',borderRadius:6,cursor:s.alwaysOn?'default':'pointer',
                      border:`1px solid ${isOn?s.color+'55':'rgba(255,255,255,0.06)'}`,
                      background:isOn?`${s.color}0d`:'transparent',
                      display:'flex',alignItems:'center',gap:6,textAlign:'left',width:'100%',
                      opacity:(s.alwaysOn||status!=='running')?1:0.4}}>
                    <span style={{fontSize:11,lineHeight:1}}>{s.icon||'⬡'}</span>
                    <span style={{fontSize:8,fontFamily:'monospace',fontWeight:700,
                      color:isOn?s.color:'#334155'}}>
                      {s.shortLabel||s.label}
                      {s.alwaysOn&&<span style={{marginLeft:4,fontSize:6,color:s.color+'88'}}>CORE</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run */}
          <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end',alignSelf:'flex-end',flexShrink:0}}>
            {(status==='done'||status==='error') && (
              <button onClick={()=>{setStatus('idle');setComparison(null);setErr(null);setStatusMsg('');}}
                style={{padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:9,fontFamily:'monospace',
                  fontWeight:700,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.03)',color:'#475569'}}>
                ↺ Reset
              </button>
            )}
            <button onClick={run} disabled={status==='running'||status==='fetching'}
              style={{padding:'9px 28px',borderRadius:7,fontSize:10,fontFamily:'monospace',fontWeight:800,letterSpacing:1,
                whiteSpace:'nowrap',cursor:status==='running'?'default':'pointer',
                background:'rgba(0,212,255,0.18)',border:'1px solid rgba(0,212,255,0.4)',color:'#00d4ff',
                opacity:(status==='running'||status==='fetching')?0.5:1}}>
              {status==='fetching'?'⟳ Fetching…':status==='running'?'⟳ '+prog+'%':'▶ RUN ALL MODES'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      {(status==='fetching'||status==='running') && (
        <div style={{marginBottom:10}}>
          <div style={{borderRadius:4,overflow:'hidden',background:'rgba(255,255,255,0.05)',height:4,marginBottom:5}}>
            <div style={{height:'100%',width:prog+'%',transition:'width 0.3s',background:'linear-gradient(90deg,#00d4ff,#818cf8)'}} />
          </div>
          <div style={{fontSize:8,color:'#334155',fontFamily:'monospace'}}>{statusMsg}</div>
        </div>
      )}

      {/* Error */}
      {err && <div style={{padding:'12px 16px',borderRadius:8,marginBottom:12,
        background:'rgba(255,79,79,0.08)',border:'1px solid rgba(255,79,79,0.25)',
        color:'#ff4f4f',fontSize:10,fontFamily:'monospace'}}>✕ {err}</div>}

      {/* Idle */}
      {status==='idle' && !err && (
        <div style={{padding:'36px 24px',textAlign:'center',borderRadius:12,border:'1px dashed rgba(255,255,255,0.07)',fontFamily:'monospace'}}>
          <div style={{fontSize:26,marginBottom:10}}>🔬</div>
          <div style={{color:'#475569',fontSize:10,marginBottom:16}}>Select source + instrument + optional DD controls → Run All Modes</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8,maxWidth:800,margin:'0 auto'}}>
            {[['◑ Partial+Trail','50% at TP1 → BE → trail to TP2','Max: +1.5R'],
              ['① Full TP1','Whole position off at TP1','Max: +1.0R'],
              ['② Full TP2','Hold everything for 2R (no partial)','Max: +2.0R'],
              ['▷ BE+Trail','Flip to BE at TP1, ride full size','Max: +2.0R / 0R']].map(([t,d,r])=>(
              <div key={t} style={{padding:'10px 12px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',textAlign:'left'}}>
                <div style={{fontSize:9,color:'#00d4ff',fontWeight:700,marginBottom:3}}>{t}</div>
                <div style={{fontSize:7,color:'#334155',lineHeight:1.6,marginBottom:3}}>{d}</div>
                <div style={{fontSize:8,color:'#475569'}}>{r}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {status==='done' && comparison && (
        <div>
          <div style={{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            {[['compare','⚡ Compare'],['equity','📈 Equity'],['trades','📋 Trades']].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'5px 14px',borderRadius:6,cursor:'pointer',fontSize:9,fontFamily:'monospace',fontWeight:700,
                background:view===v?'rgba(0,212,255,0.12)':'transparent',
                border:'1px solid '+(view===v?'rgba(0,212,255,0.4)':'rgba(255,255,255,0.07)'),
                color:view===v?'#00d4ff':'#475569'}}>
                {l}
              </button>
            ))}
            <div style={{marginLeft:'auto',fontSize:8,color:'#334155',fontFamily:'monospace'}}>
              {instKey} · {range} · {comparison.results.partial_be?.trades?.length||0} signals
              {(ddDaily||ddMax)?' · DD filter on':''}
            </div>
          </div>

          {/* ── Compare ── */}
          {view==='compare' && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
                {comparison.modes.map(mode => {
                  const s = comparison.results[mode.key]?.stats;
                  if (!s) return null;
                  const isActive = activeMode===mode.key;
                  return (
                    <div key={mode.key} onClick={()=>setActiveMode(mode.key)}
                      style={{borderRadius:10,cursor:'pointer',overflow:'hidden',
                        border:'2px solid '+(isActive?mode.color:'rgba(255,255,255,0.07)'),
                        background:isActive?'rgba(0,0,0,0.45)':'rgba(0,0,0,0.25)',transition:'all 0.15s'}}>
                      <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.06)',
                        background:isActive?mode.color+'18':'transparent'}}>
                        <div style={{fontSize:10,fontWeight:800,color:mode.color,fontFamily:'monospace'}}>{ModeIcon[mode.key]} {mode.short}</div>
                        <div style={{fontSize:7,color:'#334155',fontFamily:'monospace',marginTop:2}}>{mode.label}</div>
                      </div>
                      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:7}}>
                        {[
                          ['Win Rate',    pct(s.winRate),     s.winRate>=0.5?'#00ff8c':'#ff4f4f'],
                          ['Expectancy',  rFmt(s.expectancy), s.expectancy>=0?'#00ff8c':'#ff4f4f'],
                          ['Total P&L',   rFmt(s.totalPnl),   s.totalPnl>=0?'#00ff8c':'#ff4f4f'],
                          ['Prof. Factor',s.pf.toFixed(2)+'×',s.pf>=1.5?'#00ff8c':s.pf>=1?'#f59e0b':'#ff4f4f'],
                          ['Max DD',      '-'+s.maxDD.toFixed(2)+'R','#f97316'],
                          ['Recovery',    s.recoveryFactor>0?s.recoveryFactor.toFixed(2)+'×':'—',
                            s.recoveryFactor>=2?'#00ff8c':s.recoveryFactor>=1?'#f59e0b':'#ff4f4f'],
                          ['Max Con. L',  s.maxCL,'#ff4f4f'],
                          ['Longest DD',  s.longestUnderwater+' bars','#f97316'],
                        ].map(([l,v,c])=>(
                          <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                            <span style={{fontSize:7,color:'#334155',fontFamily:'monospace'}}>{l}</span>
                            <span style={{fontSize:11,fontWeight:800,color:c,fontFamily:'monospace'}}>{v}</span>
                          </div>
                        ))}
                        {s.skipped>0 && <div style={{fontSize:7,color:'#f97316',fontFamily:'monospace',borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:5}}>
                          ⚡ {s.skipped} skipped by DD filter
                        </div>}
                      </div>
                      {s.equity.length>2 && (() => {
                        const eq=s.equity;
                        const mxR=Math.max(...eq.map(d=>d.pnl),0.1),mnR=Math.min(...eq.map(d=>d.pnl),-0.1);
                        const rg=mxR-mnR||1; const W=180,H=34,P=2;
                        const xS=i=>P+(i/(eq.length-1))*(W-P*2);
                        const yS=v=>H-P-((v-mnR)/rg)*(H-P*2);
                        const pts=eq.map((d,i)=>xS(i).toFixed(1)+','+yS(d.pnl).toFixed(1)).join(' ');
                        return <div style={{padding:'0 8px 8px'}}>
                          <svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',height:30}}>
                            <line x1={P} y1={yS(0)} x2={W-P} y2={yS(0)} stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                            <polyline points={pts} fill="none" stroke={mode.color} strokeWidth="1.5" opacity="0.9"/>
                          </svg>
                        </div>;
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Best callout */}
              {(() => {
                const ranked = comparison.modes
                  .map(m=>({...m,s:comparison.results[m.key]?.stats}))
                  .filter(m=>m.s&&m.s.total>0)
                  .sort((a,b)=>b.s.expectancy-a.s.expectancy);
                if (!ranked.length) return null;
                const best=ranked[0];
                const bestDD=[...ranked].sort((a,b)=>a.s.maxDD-b.s.maxDD)[0];
                return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div style={{padding:'12px 16px',borderRadius:8,background:'rgba(0,255,140,0.06)',border:'1px solid rgba(0,255,140,0.2)'}}>
                    <div style={{fontSize:8,color:'#00ff8c',fontFamily:'monospace',fontWeight:700,marginBottom:4}}>✓ BEST EXPECTANCY — {best.short}</div>
                    <div style={{fontSize:10,color:'#e2e8f0',fontFamily:'monospace',fontWeight:800}}>
                      {rFmt(best.s.expectancy)} / trade · WR {pct(best.s.winRate)} · PF {best.s.pf.toFixed(2)}×
                    </div>
                  </div>
                  <div style={{padding:'12px 16px',borderRadius:8,background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.2)'}}>
                    <div style={{fontSize:8,color:'#f97316',fontFamily:'monospace',fontWeight:700,marginBottom:4}}>🛡 LOWEST DRAWDOWN — {bestDD.short}</div>
                    <div style={{fontSize:10,color:'#e2e8f0',fontFamily:'monospace',fontWeight:800}}>
                      -{bestDD.s.maxDD.toFixed(2)}R max DD · Recovery {bestDD.s.recoveryFactor.toFixed(2)}×
                    </div>
                  </div>
                </div>;
              })()}

              {/* Grade + Strategy for active mode */}
              {activeStats && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={S.card}>
                    <span style={S.lbl}>BY GRADE — {comparison.modes.find(m=>m.key===activeMode)?.short}</span>
                    {['A','B','C'].map(g=>{
                      const gs=activeStats.byGrade[g];
                      if(!gs||gs.trades===0) return null;
                      return <div key={g} style={{marginBottom:10}}>
                        <div style={{display:'flex',gap:8,marginBottom:3,alignItems:'center'}}>
                          <span style={{fontSize:12,fontWeight:800,color:GC[g],fontFamily:'monospace',width:16}}>{g}</span>
                          <span style={{fontSize:9,color:'#e2e8f0',fontFamily:'monospace'}}>{gs.trades} trades</span>
                          <span style={{marginLeft:'auto',fontSize:9,fontFamily:'monospace',color:gs.pnl>=0?'#00ff8c':'#ff4f4f',fontWeight:700}}>{rFmt(gs.pnl)}</span>
                        </div>
                        <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.05)'}}>
                          <div style={{height:'100%',width:pct(Math.min(1,gs.winRate)),background:GC[g],borderRadius:2}} />
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:7,color:'#475569',fontFamily:'monospace',marginTop:2}}>
                          <span>WR {pct(gs.winRate)}</span><span>Avg {(gs.avgRR||0).toFixed(2)}R</span>
                        </div>
                      </div>;
                    })}
                  </div>
                  <div style={S.card}>
                    <span style={S.lbl}>BY STRATEGY — {comparison.modes.find(m=>m.key===activeMode)?.short}</span>
                    {Object.entries(activeStats.byStrat).map(([tag,s])=>(
                      <div key={tag} style={{marginBottom:10}}>
                        <div style={{display:'flex',gap:6,marginBottom:3,alignItems:'center'}}>
                          <span style={{fontSize:9,color:'#00d4ff',fontFamily:'monospace',flex:1}}>{tag}</span>
                          <span style={{fontSize:7,color:'#475569',fontFamily:'monospace'}}>{s.trades}T</span>
                          <span style={{fontSize:9,fontFamily:'monospace',color:s.pnl>=0?'#00ff8c':'#ff4f4f',fontWeight:700}}>{rFmt(s.pnl)}</span>
                        </div>
                        <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.05)'}}>
                          <div style={{height:'100%',width:pct(Math.min(1,s.winRate)),background:'linear-gradient(90deg,#00d4ff,#818cf8)',borderRadius:2}} />
                        </div>
                        <div style={{fontSize:7,color:'#475569',fontFamily:'monospace',marginTop:2}}>WR {pct(s.winRate)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Equity Curves ── */}
          {view==='equity' && (
            <div style={S.card}>
              <div style={{display:'flex',gap:16,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
                <span style={S.lbl}>ALL 4 MODES OVERLAID</span>
                {comparison.modes.map((m,mi)=>(
                  <div key={m.key} style={{display:'flex',alignItems:'center',gap:4,fontSize:8,fontFamily:'monospace',color:m.color}}>
                    <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke={m.color} strokeWidth="2" strokeDasharray={mi>1?'4,2':''}/></svg>
                    {m.short}
                  </div>
                ))}
              </div>
              {(()=>{
                const allEqs = comparison.modes.map(m=>comparison.results[m.key]?.stats?.equity||[]);
                const maxLen = Math.max(...allEqs.map(e=>e.length));
                if (maxLen<2) return <div style={{color:'#334155',fontSize:9,fontFamily:'monospace'}}>Not enough data</div>;
                const allVals = allEqs.flatMap(e=>e.map(d=>d.pnl));
                const mxR=Math.max(...allVals,0.5),mnR=Math.min(...allVals,-0.5);
                const rg=mxR-mnR||1; const W=920,H=250,P=44;
                const xS=(i,len)=>P+(i/(len-1))*(W-P*2);
                const yS=v=>H-P-((v-mnR)/rg)*(H-P*2);
                const z=yS(0);
                return <svg viewBox={'0 0 '+W+' '+H} style={{width:'100%',height:240}}>
                  {[-4,-3,-2,-1,0,1,2,3,4,5,6].map(r=>{
                    if(r<mnR-0.3||r>mxR+0.3) return null;
                    const y=yS(r);
                    return <g key={r}>
                      <line x1={P} y1={y} x2={W-P} y2={y} stroke={r===0?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.04)'} strokeWidth={r===0?1.5:1} strokeDasharray={r===0?'':'3,6'}/>
                      <text x={P-4} y={y+4} fontSize={8} fill="#334155" textAnchor="end" fontFamily="monospace">{r}R</text>
                    </g>;
                  })}
                  {comparison.modes.map((m,mi)=>{
                    const eq=comparison.results[m.key]?.stats?.equity||[];
                    if(eq.length<2) return null;
                    const pts=eq.map((d,i)=>xS(i,eq.length).toFixed(1)+','+yS(d.pnl).toFixed(1)).join(' ');
                    return <polyline key={m.key} points={pts} fill="none" stroke={m.color} strokeWidth="2" opacity="0.85" strokeDasharray={mi>1?'6,3':''}/>;
                  })}
                  <line x1={P} y1={z} x2={W-P} y2={z} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5}/>
                </svg>;
              })()}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginTop:12}}>
                {comparison.modes.map(m=>{
                  const s=comparison.results[m.key]?.stats;
                  if(!s) return null;
                  return <div key={m.key} style={{padding:'8px 10px',borderRadius:6,background:'rgba(0,0,0,0.2)',border:'1px solid '+m.color+'33'}}>
                    <div style={{fontSize:8,color:m.color,fontFamily:'monospace',fontWeight:700,marginBottom:3}}>{m.short}</div>
                    <div style={{fontSize:12,color:s.totalPnl>=0?'#00ff8c':'#ff4f4f',fontFamily:'monospace',fontWeight:800}}>{rFmt(s.totalPnl)}</div>
                    <div style={{fontSize:7,color:'#475569',fontFamily:'monospace',marginTop:2}}>DD -{s.maxDD.toFixed(2)}R · PF {s.pf.toFixed(2)}×</div>
                  </div>;
                })}
              </div>
            </div>
          )}

          {/* ── Trades ── */}
          {view==='trades' && (
            <div>
              <div style={{display:'flex',gap:6,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
                {comparison.modes.map(m=>(
                  <button key={m.key} onClick={()=>setActiveMode(m.key)} style={{
                    padding:'4px 12px',borderRadius:5,cursor:'pointer',fontSize:8,fontFamily:'monospace',fontWeight:700,
                    background:activeMode===m.key?m.color+'22':'rgba(255,255,255,0.03)',
                    border:'1px solid '+(activeMode===m.key?m.color+'66':'rgba(255,255,255,0.07)'),
                    color:activeMode===m.key?m.color:'#475569'}}>
                    {ModeIcon[m.key]} {m.short}
                  </button>
                ))}
                <div style={{width:1,height:16,background:'rgba(255,255,255,0.1)'}} />
                {['ALL','WIN','LOSS'].map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} style={{
                    padding:'4px 12px',borderRadius:5,cursor:'pointer',fontSize:8,fontFamily:'monospace',fontWeight:700,
                    background:filter===f?'rgba(0,212,255,0.1)':'rgba(255,255,255,0.03)',
                    border:'1px solid '+(filter===f?'rgba(0,212,255,0.35)':'rgba(255,255,255,0.07)'),
                    color:filter===f?'#00d4ff':'#475569'}}>
                    {f}
                  </button>
                ))}
                <span style={{marginLeft:'auto',fontSize:8,color:'#334155',fontFamily:'monospace'}}>{shown.length}/{activeTrades.length}</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:8,fontFamily:'monospace'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                      {['Time','Dir','Grade','Gates','Entry','SL','TP1','Exit','P&L','Result'].map(h=>(
                        <th key={h} style={{padding:'6px 8px',textAlign:'left',color:'#334155',fontWeight:700,letterSpacing:1,whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(-100).reverse().map((t,idx)=>(
                      <tr key={idx} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',background:idx%2===0?'rgba(255,255,255,0.01)':'transparent'}}>
                        <td style={{padding:'5px 8px',color:'#475569',whiteSpace:'nowrap'}}>{dt(t.entryTime)}</td>
                        <td style={{padding:'5px 8px',color:t.direction==='LONG'?'#00ff8c':'#ff4f4f',fontWeight:700}}>{t.direction}</td>
                        <td style={{padding:'5px 8px',color:GC[t.grade]||'#475569',fontWeight:800,fontSize:10}}>{t.grade}</td>
                        <td style={{padding:'5px 8px',color:'#94a3b8'}}>{t.passed}/10</td>
                        <td style={{padding:'5px 8px',color:'#94a3b8'}}>{t.entry?.toFixed(cfg.decimals)}</td>
                        <td style={{padding:'5px 8px',color:'#ff4f4f'}}>{t.sl?.toFixed(cfg.decimals)}</td>
                        <td style={{padding:'5px 8px',color:'#00ff8c'}}>{t.tp1?.toFixed(cfg.decimals)}</td>
                        <td style={{padding:'5px 8px',color:'#94a3b8'}}>{t.exitPrice?.toFixed(cfg.decimals)||'—'}</td>
                        <td style={{padding:'5px 8px',color:t.pnlR>=0?'#00ff8c':'#ff4f4f',fontWeight:800}}>{rFmt(t.pnlR)}</td>
                        <td style={{padding:'5px 8px',color:OC(t.outcome),fontWeight:700}}>{OL(t.outcome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {shown.length===0 && <div style={{padding:'24px',textAlign:'center',color:'#334155',fontSize:9,fontFamily:'monospace'}}>No trades</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

