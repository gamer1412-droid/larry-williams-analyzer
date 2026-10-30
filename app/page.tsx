"use client";

import React, { useState, useRef, useEffect, useCallback, ErrorInfo } from "react";
import { TrendingUp, Bitcoin, Globe2, Search, Loader2, AlertTriangle, ExternalLink, TrendingDown, Clock, Database, Copy, Check, History, Trash2, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

// ===== TradingView Symbol Mapping =====
const TV_FUTURES_MAP: Record<string, string> = {
  "GOLD": "COMEX:GC1!", "SILVER": "COMEX:SI1!", "CRUDE OIL": "NYMEX:CL1!",
  "WTI": "NYMEX:CL1!", "BRENT": "NYMEX:BZ1!",
  "NATURAL GAS": "NYMEX:NG1!", "CORN": "CBOT:ZC1!", "WHEAT": "CBOT:ZW1!",
  "SOYBEAN": "CBOT:ZS1!", "COPPER": "COMEX:HG1!", "PLATINUM": "NYMEX:PL1!",
  "S&P 500": "CME_MINI:ES1!", "NASDAQ": "CME_MINI:NQ1!", "DOW": "CBOT:YM1!",
  "CL=F": "NYMEX:CL1!", "GC=F": "COMEX:GC1!", "SI=F": "COMEX:SI1!",
  "NG=F": "NYMEX:NG1!", "ZC=F": "CBOT:ZC1!", "ZW=F": "CBOT:ZW1!",
  "ES=F": "CME_MINI:ES1!", "NQ=F": "CME_MINI:NQ1!", "YM=F": "CBOT:YM1!",
  "HG=F": "COMEX:HG1!", "PL=F": "NYMEX:PL1!", "ZS=F": "CBOT:ZS1!",
};

// assetClass ตรงกับ ASSET_CLASSES (equity / crypto / macro) — key ที่ frontend ส่งให้ API ก็คือค่าเดียวกัน
function toTradingViewSymbol(assetClass: string, raw: string) {
  const s = (raw || "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes(":")) return s;
  const noSlash = s.replace("/", "");
  switch (assetClass) {
    case "crypto": {
      if (s.endsWith(".BK")) return `SET:${s}`;
      const base = s.replace(/-?(USDT|USD)$/, "");
      return `BINANCE:${base}USDT`;
    }
    case "macro": {
      if (s.includes("/")) return `FX:${noSlash}`;
      return TV_FUTURES_MAP[s] || s;
    }
    default:
      return s;
  }
}

// ===== Symbol Suggestion Database =====
// key ตรงกับ ASSET_CLASSES: equity (หุ้น+ออปชั่น), crypto, macro (ฟิวเจอร์ส+ฟอเร็กซ์)
const EQUITY_SYMBOLS: { symbol: string; name: string }[] = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "SPY", name: "S&P 500 ETF (SPDR)" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF (Invesco)" },
  { symbol: "AMD", name: "Advanced Micro Devices Inc." },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "BAC", name: "Bank of America Corporation" },
  { symbol: "DIS", name: "The Walt Disney Company" },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "PLTR", name: "Palantir Technologies Inc." },
  { symbol: "ARM", name: "Arm Holdings plc" },
  { symbol: "SOFI", name: "SoFi Technologies Inc." },
  { symbol: "MSTR", name: "MicroStrategy Inc." },
  { symbol: "COIN", name: "Coinbase Global Inc." },
  { symbol: "HOOD", name: "Robinhood Markets Inc." },
  { symbol: "F", name: "Ford Motor Company" },
  { symbol: "GM", name: "General Motors Company" },
  { symbol: "XOM", name: "Exxon Mobil Corporation" },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "PFE", name: "Pfizer Inc." },
];

// ตัวที่นิยมเทรดออปชั่น — ชื่อมีโน้ตกลยุทธ์, ซ้ำกับรายการบนตัวรายชื่อออปชั่น
const OPTIONS_NOTES: { symbol: string; name: string }[] = [
  { symbol: "SPY", name: "S&P 500 ETF — สภาพคล่องสูงที่สุด" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF — Covered Call / CSP นิยม" },
  { symbol: "AAPL", name: "Apple Inc. — นิยมทำ Wheel Strategy" },
  { symbol: "NVDA", name: "NVIDIA — IV สูง เหมาะ Sell Premium" },
  { symbol: "TSLA", name: "Tesla — IV สูง ระวัง Gamma Risk" },
  { symbol: "AMZN", name: "Amazon — CSP / Bull Put Spread" },
  { symbol: "META", name: "Meta Platforms — Covered Call นิยม" },
  { symbol: "MSFT", name: "Microsoft — Wheel Strategy เสถียร" },
  { symbol: "AMD", name: "Advanced Micro Devices — IV Rank มักสูง" },
  { symbol: "PLTR", name: "Palantir — CSP / Wheel สาย Tech" },
  { symbol: "SOFI", name: "SoFi Technologies — ราคาต่ำ เหมาะ CSP" },
  { symbol: "HOOD", name: "Robinhood Markets — Covered Call" },
  { symbol: "XLE", name: "Energy Select Sector ETF — Covered Call" },
  { symbol: "GLD", name: "SPDR Gold Shares — Options บน Gold" },
  { symbol: "COIN", name: "Coinbase Global — IV สูงมาก" },
  { symbol: "JEPI", name: "JPMorgan Equity Premium Income ETF" },
  { symbol: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income ETF" },
  { symbol: "UNH", name: "UnitedHealth Group Inc." },
  { symbol: "VZ", name: "Verizon Communications Inc." },
  { symbol: "T", name: "AT&T Inc." },
];

const FUTURES_SYMBOLS: { symbol: string; name: string }[] = [
  { symbol: "Gold", name: "Gold Futures (GC=F) — ทองคำ" },
  { symbol: "Silver", name: "Silver Futures (SI=F) — เงิน" },
  { symbol: "Crude Oil", name: "WTI Crude Oil Futures (CL=F) — น้ำมันดิบ" },
  { symbol: "Natural Gas", name: "Natural Gas Futures (NG=F) — ก๊าซธรรมชาติ" },
  { symbol: "Corn", name: "Corn Futures (ZC=F) — ข้าวโพด" },
  { symbol: "Wheat", name: "Wheat Futures (ZW=F) — ข้าวสาลี" },
  { symbol: "Soybean", name: "Soybean Futures (ZS=F) — ถั่วเหลือง" },
  { symbol: "Copper", name: "Copper Futures (HG=F) — ทองแดง" },
  { symbol: "Platinum", name: "Platinum Futures (PL=F) — แพลตตินัม" },
  { symbol: "S&P 500", name: "S&P 500 E-mini Futures (ES=F)" },
  { symbol: "Nasdaq", name: "Nasdaq 100 E-mini Futures (NQ=F)" },
];

const FOREX_SYMBOLS: { symbol: string; name: string }[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar — คู่หลักที่นิยมสุด" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar" },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc" },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar" },
  { symbol: "EUR/JPY", name: "Euro / Japanese Yen" },
  { symbol: "GBP/JPY", name: "British Pound / Japanese Yen" },
  { symbol: "EUR/GBP", name: "Euro / British Pound" },
  { symbol: "USD/SGD", name: "US Dollar / Singapore Dollar" },
  { symbol: "USD/THB", name: "US Dollar / Thai Baht" },
];

const CRYPTO_SYMBOLS: { symbol: string; name: string }[] = [
  { symbol: "BTC", name: "Bitcoin (BTC-USD / Binance:BTCUSDT)" },
  { symbol: "ETH", name: "Ethereum (ETH-USD / Binance:ETHUSDT)" },
  { symbol: "BTC.BK", name: "Bitcoin ETF (ไทย — BTC.BK)" },
  { symbol: "BNB", name: "BNB (Binance Coin)" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP (Ripple)" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "MATIC", name: "Polygon (POL)" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "ATOM", name: "Cosmos" },
  { symbol: "SUI", name: "Sui Network" },
  { symbol: "ARB", name: "Arbitrum" },
  { symbol: "OP", name: "Optimism" },
  { symbol: "PEPE", name: "Pepe (Meme Coin)" },
  { symbol: "WIF", name: "dogwifhat (Meme Coin)" },
];

function buildEquityDB() {
  const db = new Map(EQUITY_SYMBOLS.map((s) => [s.symbol, { ...s }]));
  for (const o of OPTIONS_NOTES) db.set(o.symbol, { ...o });
  return [...db.values()];
}

const SYMBOL_DB: Record<string, { symbol: string; name: string }[]> = {
  equity: buildEquityDB(),
  macro: [...FUTURES_SYMBOLS, ...FOREX_SYMBOLS],
  crypto: CRYPTO_SYMBOLS,
};

// ===== Helper Functions =====
function formatPrice(price: number | null | undefined, currency: string) {
  if (price == null) return "N/A";
  const decimals = Math.abs(price) < 10 ? 4 : 2;
  return `${price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
}

function formatTime(isoString: string) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

function formatVolume(vol: number | null | undefined) {
  if (vol == null) return "N/A";
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

function formatMarketCap(v: number | undefined) {
  if (!v) return "N/A";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

// ===== Asset Class Config =====
const ASSET_CLASSES = [
  { key: "equity",  label: "หุ้น & ออปชั่น", icon: TrendingUp, placeholder: "เช่น AAPL, NVDA, SPY / SPY, QQQ" },
  { key: "crypto",  label: "คริปโต",        icon: Bitcoin,    placeholder: "เช่น BTC-USD, ETH-USD, SOL-USD" },
  { key: "macro",   label: "ฟิวเจอร์ส & ฟอเร็กซ์", icon: Globe2, placeholder: "เช่น Gold, EUR/USD, USD/JPY" },
];

const SIGNAL_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  bullish: { bg: "#1F3A32", border: "#4A9B7F", text: "#7FD4B3", label: "BULLISH" },
  bearish: { bg: "#3A2321", border: "#C1554B", text: "#E8988F", label: "BEARISH" },
  neutral: { bg: "#2A2A22", border: "#9B8F5A", text: "#D4C88F", label: "NEUTRAL" },
};

const CONFIDENCE_COLORS = ["", "#C1554B", "#C1554B", "#C1554B", "#C9A45C", "#C9A45C", "#C9A45C", "#C9A45C", "#4A9B7F", "#4A9B7F", "#4A9B7F"];

interface MarketSnapshot {
  price: number; change: number; change_percent: number;
  high_52w: number; low_52w: number; day_high: number; day_low: number;
  volume: number; currency: string; name: string;
  sma5?: number | null; sma10?: number | null; sma20?: number | null;
  rsi14?: number | null; atr10?: number | null;
  pivot_points?: { pp: number; r1: number; r2: number; s1: number; s2: number } | null;
  volume_ratio?: number | null;
  pct_from_52w_high?: number; pct_from_52w_low?: number;
  weekly_change_pct?: number | null;
  weekly_sma10?: number | null;
  weekly_above_sma10?: boolean | null;
  data_quality?: { isAbnormal: boolean; flags: string[] };
}

interface CotData {
  market: string;
  reportDate: string;
  noncommLong: number;
  noncommShort: number;
  noncommNet: number;
  commNet: number;
  openInterest: number;
  netChangeWeek: number;
  percentile30w: number | null;
}

interface FundamentalData {
  trailingPE?: number;
  forwardPE?: number;
  marketCap?: number;
  eps?: number;
  dividendYield?: number;
  beta?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  earningsDate?: string;
  sector?: string;
  industry?: string;
}

interface CriterionItem {
  label: string;
  signal: "bullish" | "bearish" | "neutral";
  detail: string;
}

interface ActionPlan {
  recommendation: string;
  entry_zone?: string;
  stop_loss?: string;
  take_profit_1?: string;
  take_profit_2?: string;
  position_size?: string;
  timeframe?: string;
  rationale?: string;
}

interface AnalysisResult {
  symbol: string;
  overall_bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  criteria: CriterionItem[];
  action_plan?: ActionPlan;
  risk_note?: string;
  market_snapshot?: MarketSnapshot;
  fundamental?: FundamentalData;
  cot?: CotData;
  crypto_market?: { btcDominance?: number; fearGreedIndex?: number; fearGreedLabel?: string; totalMarketCap?: number };
  data_source?: string;
  analyzed_at?: string;
  // ข้อ 4: Self-check ผลตรวจคำตอบ AI
  self_check_flags?: string[];
  self_check_passed?: boolean;
}

interface HistoryEntry {
  id: string;
  symbol: string;
  assetClass: string;
  bias: string;
  confidence: number;
  summary: string;
  timestamp: string;
  result: AnalysisResult;
}

// ===== History Helpers =====
const HISTORY_KEY = "lw-analysis-history";
const MAX_HISTORY = 50;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch { /* quota exceeded — ignore */ }
}

// ===== Error Boundary =====
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#E8988F" }}>
          <AlertTriangle size={32} style={{ margin: "0 auto 12px", display: "block" }} />
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>เกิดข้อผิดพลาดที่ไม่คาดคิด</h2>
          <p style={{ fontSize: 13, color: "#8B93A0", marginBottom: 16 }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: "8px 20px", background: "#C9A45C", color: "#0F1419", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >ลองใหม่อีกครั้ง</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== Main App =====
function AppContent() {
  const [activeClass, setActiveClass] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tvOverride, setTvOverride] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFundamental, setShowFundamental] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setHistory(loadHistory());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const currentClass = ASSET_CLASSES.find((c) => c.key === activeClass) || ASSET_CLASSES[0];
  const tvSymbol = tvOverride.trim() || toTradingViewSymbol(activeClass, symbol);

  // Filter suggestions
  const suggestions = symbol.trim().length > 0
    ? (SYMBOL_DB[activeClass] || []).filter((s) =>
        s.symbol.toLowerCase().includes(symbol.toLowerCase()) ||
        s.name.toLowerCase().includes(symbol.toLowerCase())
      ).slice(0, 8)
    : (SYMBOL_DB[activeClass] || []).slice(0, 6);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectSuggestion(sym: string) {
    setSymbol(sym);
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleAnalyze() {
    if (!symbol.trim()) return;
    setShowSuggestions(false);
    setTvOverride("");
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.trim(), activeClass }),
      });

      // Handle non-JSON error responses safely
      if (!response.ok) {
        let errMsg = `เกิดข้อผิดพลาด (${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch { /* response wasn't JSON */ }
        throw new Error(errMsg);
      }

      const data: AnalysisResult = await response.json();
      setResult(data);

      // Save to history
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        symbol: symbol.trim().toUpperCase(),
        assetClass: activeClass,
        bias: data.overall_bias,
        confidence: data.confidence,
        summary: data.summary,
        timestamp: new Date().toISOString(),
        result: data,
      };
      setHistory((prev) => {
        const updated = [entry, ...prev].slice(0, MAX_HISTORY);
        saveHistory(updated);
        return updated;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Copy analysis to clipboard
  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ap = result.action_plan;
    const text = [
      `📊 ${result.symbol} — ${SIGNAL_STYLES[result.overall_bias]?.label || result.overall_bias}`,
      `Confidence: ${result.confidence}/10`,
      ``,
      result.summary,
      ``,
      ...(result.criteria || []).map((c: CriterionItem) => `• ${c.label}: ${c.signal.toUpperCase()} — ${c.detail}`),
      ``,
      ap ? `Action: ${ap.recommendation}` : "",
      ap?.entry_zone ? `Entry: ${ap.entry_zone}` : "",
      ap?.stop_loss ? `Stop Loss: ${ap.stop_loss}` : "",
      ap?.take_profit_1 ? `TP1: ${ap.take_profit_1}` : "",
      ap?.take_profit_2 ? `TP2: ${ap.take_profit_2}` : "",
      ``,
      result.risk_note ? `⚠️ ${result.risk_note}` : "",
      ``,
      `— Larry Williams Analyzer`,
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  function deleteHistoryEntry(id: string) {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      saveHistory(updated);
      return updated;
    });
  }

  function restoreHistoryEntry(entry: HistoryEntry) {
    setActiveClass(entry.assetClass);
    setSymbol(entry.symbol);
    setTvOverride("");
    setResult(entry.result);
    setError(null);
    setShowHistory(false);
  }

  const snap: MarketSnapshot | null = result?.market_snapshot || null;
  const isUp = snap && snap.change_percent >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1419", color: "#E8E3D8", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .conf-bar-fill { transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
        .price-ticker { font-variant-numeric: tabular-nums; }
        .suggest-item:hover { background: #1E2A38 !important; }
        .suggest-item:active { background: #243040 !important; }
        .history-item { transition: background 0.15s ease; }
        .history-item:hover { background: #1E2530 !important; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .ledger-row { border-bottom: 1px solid #2A323C; }
        .ledger-row:last-child { border-bottom: none; }
        .stamp {
          border: 3px double currentColor; transform: rotate(-4deg);
          display: inline-block; padding: 6px 18px;
          font-family: 'JetBrains Mono', monospace; font-weight: 600; letter-spacing: 0.15em;
        }
        .tab-btn { transition: all 0.15s ease; }
        input:focus { outline: none; border-color: #C9A45C !important; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#8B93A0", marginBottom: 8 }}>
            LARRY WILLIAMS FRAMEWORK — EST. 1987
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 700, margin: 0, color: "#F0EBDD" }}>
            Larry Williams Analyzer
          </h1>
          <p style={{ color: "#8B93A0", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            วิเคราะห์ตามกรอบแนวคิด &quot;เงื่อนไขสำคัญกว่ากราฟ&quot; — ข้อมูลราคาจาก Yahoo Finance แบบ Real-time
          </p>
        </div>

        {/* Asset Class Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {ASSET_CLASSES.map((c) => {
            const Icon = c.icon;
            const active = c.key === activeClass;
            return (
              <button key={c.key} className="tab-btn"
                onClick={() => { setActiveClass(c.key); setResult(null); setError(null); setSymbol(""); setTvOverride(""); setShowSuggestions(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 6,
                  border: `1px solid ${active ? "#C9A45C" : "#2A323C"}`,
                  background: active ? "#C9A45C" : "#171D24",
                  color: active ? "#0F1419" : "#B8BFC9",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                <Icon size={15} />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar + Autocomplete */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              ref={inputRef}
              value={symbol}
              onChange={(e) => { setSymbol(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAnalyze();
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder={currentClass.placeholder}
              autoComplete="off"
              style={{
                flex: 1, background: "#171D24", border: "1px solid #2A323C",
                borderRadius: 6, padding: "12px 14px", color: "#E8E3D8",
                fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !symbol.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#C9A45C", color: "#0F1419", border: "none",
                borderRadius: 6, padding: "0 22px", fontWeight: 600, fontSize: 14,
                cursor: loading || !symbol.trim() ? "default" : "pointer",
                opacity: loading || !symbol.trim() ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              วิเคราะห์
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && (
            <div
              ref={suggestRef}
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0,
                right: 60, zIndex: 100,
                background: "#141A22", border: "1px solid #2A323C",
                borderRadius: 8, overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              {suggestions.length > 0 ? (
                <>
                  {symbol.trim().length === 0 && (
                    <div style={{ padding: "8px 14px 4px", fontSize: 10, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
                      ยอดนิยม
                    </div>
                  )}
                  {suggestions.map((s) => (
                    <div
                      key={s.symbol}
                      className="suggest-item"
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.symbol); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px", cursor: "pointer",
                        borderBottom: "1px solid #1E2530",
                        transition: "background 0.1s",
                      }}
                    >
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600,
                        color: "#C9A45C", minWidth: 72,
                      }}>
                        {s.symbol}
                      </span>
                      <span style={{ fontSize: 12, color: "#8B93A0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name}
                      </span>
                    </div>
                  ))}
                </>
              ) : symbol.trim().length > 0 ? (
                <div style={{ padding: "12px 14px", fontSize: 12, color: "#5C6470" }}>
                  ไม่พบในรายการ — พิมพ์ต่อได้เลยครับ
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* TradingView Chart */}
        {tvSymbol && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8B93A0", letterSpacing: "0.1em" }}>
                CHART · {tvSymbol}
              </span>
              <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#C9A45C", textDecoration: "none" }}
              >
                เปิดใน TradingView <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ border: "1px solid #2A323C", borderRadius: 8, overflow: "hidden" }}>
              <iframe key={tvSymbol} title="tradingview-chart"
                src={`https://s.tradingview.com/embed-widget/advanced-chart/?symbol=${encodeURIComponent(tvSymbol)}&interval=D&theme=dark&style=1&locale=th_TH&hide_side_toolbar=0&toolbar_bg=%230F1419`}
                style={{ width: "100%", height: 420, border: "none", display: "block" }}
              />
            </div>
            <input
              value={tvOverride}
              onChange={(e) => setTvOverride(e.target.value)}
              placeholder="ชาร์ตไม่ขึ้น หรือไม่ตรง? ระบุรหัสเต็ม เช่น NASDAQ:AAPL, BINANCE:BTCUSDT, COMEX:GC1!"
              style={{
                width: "100%", marginTop: 8, background: "transparent",
                border: "1px dashed #2A323C", borderRadius: 6, padding: "8px 12px",
                color: "#8B93A0", fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#8B93A0", fontSize: 14 }}>
            <Loader2 size={26} className="animate-spin" style={{ margin: "0 auto 14px", display: "block" }} />
            <div>กำลังดึงข้อมูลราคา + คำนวณ SMA / RSI / ATR...</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#5C6470" }}>วิเคราะห์ตามเกณฑ์ {currentClass.label} ด้วย AI</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#3A2321", border: "1px solid #C1554B", borderRadius: 6, padding: 16, color: "#E8988F", fontSize: 13 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="fade-in">
            {/* Market Snapshot */}
            {snap && (
              <div style={{ background: "#141A22", border: "1px solid #2A323C", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5C6470", letterSpacing: "0.1em", marginBottom: 4 }}>
                      LIVE MARKET DATA · Yahoo Finance
                    </div>
                    <div style={{ fontSize: 12, color: "#8B93A0", marginBottom: 6 }}>{snap.name}</div>
                    <div className="price-ticker" style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, color: "#F0EBDD", letterSpacing: "-0.02em" }}>
                        {formatPrice(snap.price, snap.currency)}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 13, fontWeight: 600, color: isUp ? "#7FD4B3" : "#E8988F", fontFamily: "'JetBrains Mono', monospace" }}>
                        {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {isUp ? "+" : ""}{snap.change_percent?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                    {[
                      { label: "Day High", value: formatPrice(snap.day_high, snap.currency) },
                      { label: "Day Low", value: formatPrice(snap.day_low, snap.currency) },
                      { label: "52W High", value: formatPrice(snap.high_52w, snap.currency) },
                      { label: "52W Low", value: formatPrice(snap.low_52w, snap.currency) },
                      { label: "Volume", value: formatVolume(snap.volume) },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div style={{ fontSize: 10, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>{stat.label}</div>
                        <div className="price-ticker" style={{ fontSize: 13, color: "#B8BFC9", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {snap.high_52w > 0 && snap.low_52w > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", marginBottom: 5 }}>
                      <span>52W LOW {formatPrice(snap.low_52w, snap.currency)}</span>
                      <span>52W HIGH {formatPrice(snap.high_52w, snap.currency)}</span>
                    </div>
                    <div style={{ background: "#1E2530", borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div className="conf-bar-fill" style={{
                        height: "100%", borderRadius: 4,
                        background: `linear-gradient(90deg, #C1554B, #C9A45C, #4A9B7F)`,
                        width: `${Math.min(100, Math.max(0, ((snap.price - snap.low_52w) / (snap.high_52w - snap.low_52w)) * 100)).toFixed(1)}%`,
                      }} />
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4A9B7F", fontFamily: "'JetBrains Mono', monospace" }}>
                    <Database size={10} />
                    {result.data_source}
                  </div>
                  {result.analyzed_at && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace" }}>
                      <Clock size={10} />
                      วิเคราะห์เมื่อ {formatTime(result.analyzed_at)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ⚠️ Data Quality Warning — ธงเตือนข้อมูลเพี้ยน */}
            {snap?.data_quality?.isAbnormal && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#3A1F1F", border: "1px solid #C1554B", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: "#E8988F" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#E8988F", marginBottom: 6 }}>
                    ⚠️ ข้อมูลราคาผิดปกติ — ตรวจสอบก่อนตัดสินใจ
                  </div>
                  {(snap.data_quality.flags || []).map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#D8A9A3", lineHeight: 1.7 }}>• {f}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary + Stamp + Actions */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8B93A0" }}>
                    {result.symbol?.toUpperCase()} · {currentClass.label}
                  </span>
                  <button onClick={handleCopy}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", background: copied ? "#1F3A32" : "#1E2530", border: `1px solid ${copied ? "#4A9B7F" : "#2A323C"}`, borderRadius: 4, color: copied ? "#7FD4B3" : "#8B93A0", fontSize: 11, cursor: "pointer", transition: "all 0.2s" }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#D8D2C4" }}>{result.summary}</p>
              </div>
              <div className="stamp" style={{ color: SIGNAL_STYLES[result.overall_bias]?.border || "#9B8F5A", flexShrink: 0 }}>
                {SIGNAL_STYLES[result.overall_bias]?.label || result.overall_bias?.toUpperCase()}
              </div>
            </div>

            {/* Confidence Bar */}
            <div style={{ marginBottom: 20, background: "#141A22", border: "1px solid #2A323C", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#8B93A0", letterSpacing: "0.08em" }}>CONFIDENCE</span>
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: CONFIDENCE_COLORS[result.confidence] || "#9B8F5A" }}>
                  {result.confidence}/10
                </span>
              </div>
              <div style={{ background: "#1E2530", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div className="conf-bar-fill" style={{
                  height: "100%", borderRadius: 4,
                  background: CONFIDENCE_COLORS[result.confidence] || "#9B8F5A",
                  width: `${(result.confidence / 10) * 100}%`,
                  boxShadow: `0 0 8px ${CONFIDENCE_COLORS[result.confidence]}66`,
                }} />
              </div>
            </div>

            {/* ── Technical Indicators Panel ── */}
            {snap && (snap.sma20 || snap.rsi14 || snap.pivot_points) && (
              <div style={{ background: "#0D1319", border: "1px solid #2A323C", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5C6470", letterSpacing: "0.12em", marginBottom: 10 }}>TECHNICAL INDICATORS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px 16px", marginBottom: snap.pivot_points ? 12 : 0 }}>
                  {[
                    { label: "SMA 5", value: snap.sma5, note: snap.sma5 && snap.price > snap.sma5 ? "▲" : "▼" },
                    { label: "SMA 10", value: snap.sma10, note: snap.sma10 && snap.price > snap.sma10 ? "▲" : "▼" },
                    { label: "SMA 20", value: snap.sma20, note: snap.sma20 && snap.price > snap.sma20 ? "▲" : "▼" },
                    { label: "RSI 14", value: snap.rsi14, note: (snap.rsi14 ?? 0) >= 70 ? "OB" : (snap.rsi14 ?? 0) <= 30 ? "OS" : "" },
                    { label: "ATR 10", value: snap.atr10, note: "" },
                    { label: "Vol Ratio", value: snap.volume_ratio, note: (snap.volume_ratio ?? 0) > 1.5 ? "HIGH" : (snap.volume_ratio ?? 1) < 0.7 ? "LOW" : "" },
                  ].filter(x => x.value != null).map(ind => {
                    const rsiColor = ind.label === "RSI 14"
                      ? (ind.value ?? 0) >= 70 ? "#E8988F" : (ind.value ?? 0) <= 30 ? "#7FD4B3" : "#B8BFC9"
                      : "#B8BFC9";
                    return (
                      <div key={ind.label}>
                        <div style={{ fontSize: 9, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>{ind.label}</div>
                        <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: rsiColor, marginTop: 2 }}>
                          {ind.value}
                          {ind.note && <span style={{ fontSize: 9, marginLeft: 4, color: ind.note === "OB" ? "#E8988F" : ind.note === "OS" ? "#7FD4B3" : ind.note === "HIGH" ? "#C9A45C" : "#8B93A0" }}>{ind.note}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {snap.weekly_change_pct != null && (
                  <div style={{ borderTop: "1px solid #1E2530", paddingTop: 10, marginBottom: snap.pivot_points ? 10 : 0 }}>
                    <div style={{ fontSize: 9, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 4 }}>WEEKLY TREND (ภาพใหญ่)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: snap.weekly_change_pct >= 0 ? "#7FD4B3" : "#E8988F", fontWeight: 600 }}>
                        {snap.weekly_change_pct >= 0 ? "▲" : "▼"} {snap.weekly_change_pct >= 0 ? "+" : ""}{snap.weekly_change_pct}% (สัปดาห์นี้)
                      </span>
                      {snap.weekly_sma10 != null && (
                        <span style={{ color: snap.weekly_above_sma10 ? "#7FD4B3" : "#E8988F" }}>
                          {snap.weekly_above_sma10 ? "เหนือ" : "ต่ำกว่า"} SMA 10W · {snap.weekly_sma10.toLocaleString("en-US")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {snap.pivot_points && (
                  <div style={{ borderTop: "1px solid #1E2530", paddingTop: 10 }}>
                    <div style={{ fontSize: 9, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 6 }}>PIVOT POINTS (Classic)</div>
                    <div style={{ display: "flex", gap: "10px 20px", flexWrap: "wrap" }}>
                      {[
                        { label: "R2", value: snap.pivot_points.r2, color: "#E8988F" },
                        { label: "R1", value: snap.pivot_points.r1, color: "#E8988F" },
                        { label: "PP", value: snap.pivot_points.pp, color: "#C9A45C" },
                        { label: "S1", value: snap.pivot_points.s1, color: "#7FD4B3" },
                        { label: "S2", value: snap.pivot_points.s2, color: "#7FD4B3" },
                      ].map(p => (
                        <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: "#5C6470" }}>{p.label}</span>
                          <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: p.color, fontWeight: p.label === "PP" ? 700 : 400 }}>{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COT Report Panel (เฉพาะฟิวเจอร์ส/ฟอเร็กซ์) ── */}
            {result.cot && (
              <div style={{ background: "#0D1319", border: "1px solid #2A323C", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5C6470", letterSpacing: "0.12em" }}>
                    COT REPORT · CFTC (รายสัปดาห์)
                  </div>
                  <div style={{ fontSize: 10, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace" }}>
                    {result.cot.market} · รายงาน {result.cot.reportDate}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px 20px" }}>
                  {[
                    {
                      label: "Net Non-Comm (เก็งกำไร)",
                      value: `${result.cot.noncommNet >= 0 ? "+" : ""}${result.cot.noncommNet.toLocaleString("en-US")}`,
                      note: `${result.cot.netChangeWeek >= 0 ? "+" : ""}${result.cot.netChangeWeek.toLocaleString("en-US")} สัปดาห์ก่อน`,
                      color: result.cot.noncommNet >= 0 ? "#7FD4B3" : "#E8988F",
                    },
                    {
                      label: "Percentile 30W",
                      value: result.cot.percentile30w != null ? `${result.cot.percentile30w}%` : "N/A",
                      note: result.cot.percentile30w != null ? (result.cot.percentile30w >= 80 ? "EXTREME LONG" : result.cot.percentile30w <= 20 ? "EXTREME SHORT" : "") : "",
                      color: result.cot.percentile30w != null ? (result.cot.percentile30w >= 80 ? "#C9A45C" : result.cot.percentile30w <= 20 ? "#C9A45C" : "#B8BFC9") : "#B8BFC9",
                    },
                    { label: "Non-Comm Long", value: result.cot.noncommLong.toLocaleString("en-US"), note: "", color: "#B8BFC9" },
                    { label: "Non-Comm Short", value: result.cot.noncommShort.toLocaleString("en-US"), note: "", color: "#B8BFC9" },
                    { label: "Net Comm (hedger)", value: `${result.cot.commNet >= 0 ? "+" : ""}${result.cot.commNet.toLocaleString("en-US")}`, note: "", color: "#B8BFC9" },
                    { label: "Open Interest", value: result.cot.openInterest.toLocaleString("en-US"), note: "", color: "#B8BFC9" },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 9, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: item.color, marginTop: 2 }}>
                        {item.value}
                        {item.note && <span style={{ fontSize: 9, marginLeft: 5, color: "#8B93A0" }}>{item.note}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Fundamental Data Panel ── */}
            {result.fundamental && activeClass === "equity" && (
              <div style={{ background: "#0D1319", border: "1px solid #2A323C", borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
                <button onClick={() => setShowFundamental(!showFundamental)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", color: "#E8E3D8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <BarChart3 size={14} style={{ color: "#C9A45C" }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5C6470", letterSpacing: "0.12em" }}>FUNDAMENTAL DATA</span>
                  </div>
                  {showFundamental ? <ChevronUp size={14} style={{ color: "#5C6470" }} /> : <ChevronDown size={14} style={{ color: "#5C6470" }} />}
                </button>
                {showFundamental && (
                  <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px 20px" }}>
                    {[
                      { label: "P/E (TTM)", value: result.fundamental.trailingPE?.toFixed(2) },
                      { label: "P/E (Forward)", value: result.fundamental.forwardPE?.toFixed(2) },
                      { label: "Market Cap", value: formatMarketCap(result.fundamental.marketCap) },
                      { label: "EPS (TTM)", value: result.fundamental.eps ? `$${result.fundamental.eps.toFixed(2)}` : undefined },
                      { label: "Dividend Yield", value: result.fundamental.dividendYield ? `${result.fundamental.dividendYield}%` : undefined },
                      { label: "Beta", value: result.fundamental.beta?.toFixed(2) },
                      { label: "50-Day MA", value: result.fundamental.fiftyDayAverage?.toFixed(2) },
                      { label: "200-Day MA", value: result.fundamental.twoHundredDayAverage?.toFixed(2) },
                      { label: "Earnings Date", value: result.fundamental.earningsDate },
                    ].filter(x => x.value && x.value !== "N/A").map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 9, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#B8BFC9", marginTop: 2 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Action Plan ── */}
            {result.action_plan && (() => {
              const ap = result.action_plan;
              const recColors: Record<string, { bg: string; border: string; text: string }> = {
                BUY:  { bg: "#1A3A2C", border: "#4A9B7F", text: "#7FD4B3" },
                SELL: { bg: "#3A1F1F", border: "#C1554B", text: "#E8988F" },
                HOLD: { bg: "#2A2A22", border: "#9B8F5A", text: "#D4C88F" },
                WAIT: { bg: "#1E2530", border: "#5C7A9B", text: "#8BB8D4" },
              };
              const rc = recColors[ap.recommendation?.toUpperCase()] || recColors.HOLD;
              return (
                <div style={{ background: "#141A22", border: `1px solid ${rc.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5C6470", letterSpacing: "0.12em" }}>ACTION PLAN</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700,
                      padding: "5px 18px", borderRadius: 6,
                      background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`,
                      letterSpacing: "0.12em",
                    }}>
                      {ap.recommendation}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px 20px", marginBottom: 12 }}>
                    {[
                      { label: "📍 Entry Zone", value: ap.entry_zone },
                      { label: "🛑 Stop Loss", value: ap.stop_loss },
                      { label: "🎯 Take Profit 1", value: ap.take_profit_1 },
                      { label: "🎯 Take Profit 2", value: ap.take_profit_2 },
                      { label: "📦 Position Size", value: ap.position_size },
                      { label: "⏱ Timeframe", value: ap.timeframe },
                    ].filter(x => x.value && x.value !== "N/A").map(field => (
                      <div key={field.label}>
                        <div style={{ fontSize: 10, color: "#5C6470", marginBottom: 3 }}>{field.label}</div>
                        <div style={{ fontSize: 13, color: "#E8E3D8", fontWeight: 500 }}>{field.value}</div>
                      </div>
                    ))}
                  </div>
                  {ap.rationale && (
                    <div style={{ fontSize: 12, color: "#8B93A0", lineHeight: 1.6, borderTop: "1px solid #1E2530", paddingTop: 10 }}>
                      {ap.rationale}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Criteria Table */}
            <div style={{ background: "#171D24", border: "1px solid #2A323C", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
              {(result.criteria || []).map((item: CriterionItem, idx: number) => {
                const style = SIGNAL_STYLES[item.signal] || SIGNAL_STYLES.neutral;
                // ข้อ 2: ถ้าหัวข้อไม่มีข้อมูลพอ แสดงสีทอง + italic + ⚠️ แทนซ่อน
                const isNoData = item.signal === "neutral" && /ไม่มีข้อมูล|ไม่สามารถประเมิน|ไม่มีข้อมูลเพียงพอ/i.test(item.detail);
                const neutralNote = isNoData ? " — ไม่มีข้อมูลเพียงพอ (ไม่สามารถประเมินได้จากข้อมูลที่มี)" : "";
                return (
                  <div key={idx} className="ledger-row" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isNoData ? "#C9A45C" : "#E8E3D8" }}>{item.label}{isNoData ? " ⚠️" : ""}</span>
                      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, padding: "3px 10px", borderRadius: 4, background: style.bg, color: style.text, border: `1px solid ${style.border}`, flexShrink: 0 }}>
                        {style.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: isNoData ? "#C9A45C" : "#9098A3", lineHeight: 1.65, fontStyle: isNoData ? "italic" : "normal" }}>{item.detail}{neutralNote}</p>
                  </div>
                );
              })}
            </div>

            {/* Self-Check — ข้อ 4 */}
            {result.self_check_flags && result.self_check_flags.length > 0 && (
              <div style={{ background: "#2A1A1F", border: "1px solid #C1554B", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: result.self_check_passed === false ? "#E8988F" : "#C9A45C", marginBottom: 8 }}>
                  🔍 ตรวจสอบคำตอบ AI (Self-check) — {result.self_check_passed === false ? "พบข้อผิดพลาด" : "ผ่าน"}
                </div>
                {(result.self_check_flags || []).map((f: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: "#E8988F", lineHeight: 1.7, marginBottom: 4 }}>• {f}</div>
                ))}
              </div>
            )}

            {/* Risk Note */}
            {result.risk_note && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "14px 16px", background: "#1E2215", border: "1px solid #4A3C1A", borderRadius: 6, fontSize: 13, color: "#C9A45C", marginBottom: 20 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: "#C9A45C" }} />
                <span>{result.risk_note}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Analysis History ── */}
        {history.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <button onClick={() => setShowHistory(!showHistory)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "1px solid #2A323C", borderRadius: 8, padding: "10px 16px", color: "#8B93A0", cursor: "pointer", width: "100%", justifyContent: "space-between", fontSize: 13, transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <History size={15} />
                <span>ประวัติการวิเคราะห์ ({history.length})</span>
              </div>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <div style={{ marginTop: 8, background: "#141A22", border: "1px solid #2A323C", borderRadius: 8, overflow: "hidden" }}>
                {history.map((entry) => {
                  const biasStyle = SIGNAL_STYLES[entry.bias] || SIGNAL_STYLES.neutral;
                  return (
                    <div key={entry.id} className="history-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #1E2530", cursor: "pointer" }}
                      onClick={() => restoreHistoryEntry(entry)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, overflow: "hidden" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: "#C9A45C", minWidth: 60 }}>{entry.symbol}</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, background: biasStyle.bg, color: biasStyle.text, border: `1px solid ${biasStyle.border}`, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {biasStyle.label}
                        </span>
                        <span style={{ fontSize: 11, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace" }}>
                          {entry.confidence}/10
                        </span>
                        <span style={{ fontSize: 11, color: "#5C6470", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {new Date(entry.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id); }}
                        style={{ background: "transparent", border: "none", color: "#5C6470", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
                        title="ลบ"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid #2A323C", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#F0EBDD", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                <span style={{ color: "#C9A45C" }}>⚡</span> Engineered & Designed by NJ
              </div>
              <div style={{ fontSize: 11, color: "#8B93A0", marginTop: 4, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.02em" }}>
                Empowering Smart Trade Decisions with Larry Williams Framework
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#5C6470", fontFamily: "'JetBrains Mono', monospace" }}>
              © {new Date().getFullYear()} Larry Williams Analyzer
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#5C6470", lineHeight: 1.7, borderTop: "1px dashed #1E2530", paddingTop: 14 }}>
            เครื่องมือนี้ใช้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน ข้อมูลราคาจาก Yahoo Finance อาจมีความล่าช้า 15-20 นาที ผลวิเคราะห์จาก AI อาจคลาดเคลื่อน ควรตรวจสอบข้อมูลเพิ่มเติมก่อนตัดสินใจลงทุนจริงเสมอ
          </div>
        </div>

      </div>
    </div>
  );
}

// ===== Wrapped App with Error Boundary =====
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
