"use client";

import { useState, useRef, useEffect } from "react";
import { TrendingUp, Layers, LineChart, Bitcoin, Globe2, Search, Loader2, AlertTriangle, ExternalLink, TrendingDown, Clock, Database } from "lucide-react";

// ===== TradingView Symbol Mapping =====
function toTradingViewSymbol(assetClass: string, raw: string) {
  const s = (raw || "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes(":")) return s;
  const noSlash = s.replace("/", "");
  switch (assetClass) {
    case "crypto":
      return `BINANCE:${noSlash}${noSlash.endsWith("USDT") || noSlash.endsWith("USD") ? "" : "USDT"}`;
    case "forex":
      return `FX:${noSlash}`;
    case "futures": {
      const futuresMap: Record<string, string> = {
        "GOLD": "COMEX:GC1!", "SILVER": "COMEX:SI1!", "CRUDE OIL": "NYMEX:CL1!",
        "CL=F": "NYMEX:CL1!", "GC=F": "COMEX:GC1!", "SI=F": "COMEX:SI1!",
        "NG=F": "NYMEX:NG1!", "ZC=F": "CBOT:ZC1!", "ZW=F": "CBOT:ZW1!",
        "ES=F": "CME_MINI:ES1!", "NQ=F": "CME_MINI:NQ1!",
      };
      return futuresMap[s] || s;
    }
    default:
      return s;
  }
}

// ===== Symbol Suggestion Database =====
const SYMBOL_DB: Record<string, { symbol: string; name: string }[]> = {
  stock: [
    { symbol: "AAPL", name: "Apple Inc." },
    { symbol: "MSFT", name: "Microsoft Corporation" },
    { symbol: "NVDA", name: "NVIDIA Corporation" },
    { symbol: "TSLA", name: "Tesla Inc." },
    { symbol: "AMZN", name: "Amazon.com Inc." },
    { symbol: "GOOGL", name: "Alphabet Inc." },
    { symbol: "META", name: "Meta Platforms Inc." },
    { symbol: "SPY", name: "S&P 500 ETF (SPDR)" },
    { symbol: "QQQ", name: "Nasdaq 100 ETF (Invesco)" },
    { symbol: "JEPI", name: "JPMorgan Equity Premium Income ETF" },
    { symbol: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income ETF" },
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
    { symbol: "RIVN", name: "Rivian Automotive Inc." },
    { symbol: "LCID", name: "Lucid Group Inc." },
    { symbol: "F", name: "Ford Motor Company" },
    { symbol: "GM", name: "General Motors Company" },
    { symbol: "XOM", name: "Exxon Mobil Corporation" },
    { symbol: "CVX", name: "Chevron Corporation" },
    { symbol: "WMT", name: "Walmart Inc." },
    { symbol: "COST", name: "Costco Wholesale Corporation" },
    { symbol: "V", name: "Visa Inc." },
    { symbol: "MA", name: "Mastercard Inc." },
    { symbol: "UNH", name: "UnitedHealth Group Inc." },
    { symbol: "PFE", name: "Pfizer Inc." },
    { symbol: "VZ", name: "Verizon Communications Inc." },
    { symbol: "T", name: "AT&T Inc." },
  ],
  options: [
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
  ],
  futures: [
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
  ],
  crypto: [
    { symbol: "BTC", name: "Bitcoin" },
    { symbol: "ETH", name: "Ethereum" },
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
  ],
  forex: [
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
  ],
};

// ===== Helper Functions =====
function formatPrice(price: number, currency: string) {
  if (!price) return "N/A";
  const decimals = price < 10 ? 4 : 2;
  return `${price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
}

function formatTime(isoString: string) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

function formatVolume(vol: number) {
  if (!vol) return "N/A";
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toString();
}

// ===== Asset Class Config =====
const ASSET_CLASSES = [
  { key: "stock",   label: "หุ้น",      icon: TrendingUp, placeholder: "เช่น AAPL, NVDA, SPY" },
  { key: "options", label: "ออปชั่น",   icon: Layers,     placeholder: "เช่น SPY, QQQ, AAPL (Wheel/CSP)" },
  { key: "futures", label: "ฟิวเจอร์ส", icon: LineChart,  placeholder: "เช่น Gold, Crude Oil, Corn" },
  { key: "crypto",  label: "คริปโต",   icon: Bitcoin,    placeholder: "เช่น BTC, ETH, SOL" },
  { key: "forex",   label: "ฟอเร็กซ์", icon: Globe2,     placeholder: "เช่น EUR/USD, USD/JPY" },
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
}

// ===== Main App =====
export default function App() {
  const [activeClass, setActiveClass] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [tvOverride, setTvOverride] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

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
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.trim(), activeClass }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาดในการวิเคราะห์");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  const snap: MarketSnapshot | null = result?.market_snapshot || null;
  const isUp = snap && snap.change_percent >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0F1419", color: "#E8E3D8", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .ledger-row { border-bottom: 1px solid #2A323C; }
        .ledger-row:last-child { border-bottom: none; }
        .stamp {
          border: 3px double currentColor; transform: rotate(-4deg);
          display: inline-block; padding: 6px 18px;
          font-family: 'JetBrains Mono', monospace; font-weight: 600; letter-spacing: 0.15em;
        }
        .tab-btn { transition: all 0.15s ease; }
        input:focus { outline: none; border-color: #C9A45C !important; }
        .conf-bar-fill { transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
        .price-ticker { font-variant-numeric: tabular-nums; }
        .suggest-item:hover { background: #1E2A38 !important; }
        .suggest-item:active { background: #243040 !important; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#8B93A0", marginBottom: 8 }}>
            FRAMEWORK ANALYZER — EST. 1987
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 700, margin: 0, color: "#F0EBDD" }}>
            บันทึกวิเคราะห์แบบปู่ Larry
          </h1>
          <p style={{ color: "#8B93A0", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            วิเคราะห์ตามกรอบแนวคิด "เงื่อนไขสำคัญกว่ากราฟ" — ข้อมูลราคาจาก Yahoo Finance แบบ Real-time
          </p>
        </div>

        {/* Asset Class Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {ASSET_CLASSES.map((c) => {
            const Icon = c.icon;
            const active = c.key === activeClass;
            return (
              <button key={c.key} className="tab-btn"
                onClick={() => { setActiveClass(c.key); setResult(null); setError(null); setSymbol(""); setShowSuggestions(false); }}
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
          {showSuggestions && suggestions.length > 0 && (
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
              {symbol.trim().length > 0 && suggestions.length === 0 && (
                <div style={{ padding: "12px 14px", fontSize: 12, color: "#5C6470" }}>
                  ไม่พบในรายการ — พิมพ์ต่อได้เลยครับ
                </div>
              )}
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
            <div>กำลังดึงข้อมูลราคาจาก Yahoo Finance...</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#5C6470" }}>และประมวลผลตามเกณฑ์ {currentClass.label}</div>
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
          <div>
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

            {/* Summary + Stamp */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8B93A0", marginBottom: 6 }}>
                  {result.symbol?.toUpperCase()} · {currentClass.label}
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

            {/* Criteria Table */}
            <div style={{ background: "#171D24", border: "1px solid #2A323C", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
              {(result.criteria || []).map((item: any, idx: number) => {
                const style = SIGNAL_STYLES[item.signal] || SIGNAL_STYLES.neutral;
                return (
                  <div key={idx} className="ledger-row" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#E8E3D8" }}>{item.label}</span>
                      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, padding: "3px 10px", borderRadius: 4, background: style.bg, color: style.text, border: `1px solid ${style.border}`, flexShrink: 0 }}>
                        {style.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#9098A3", lineHeight: 1.65 }}>{item.detail}</p>
                  </div>
                );
              })}
            </div>

            {/* Risk Note */}
            {result.risk_note && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "14px 16px", background: "#1E2215", border: "1px solid #4A3C1A", borderRadius: 6, fontSize: 13, color: "#C9A45C", marginBottom: 20 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: "#C9A45C" }} />
                <span>{result.risk_note}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid #2A323C" }}>
          <div style={{ fontSize: 11, color: "#5C6470", lineHeight: 1.7, marginBottom: 12 }}>
            เครื่องมือนี้ใช้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน ข้อมูลราคาจาก Yahoo Finance อาจมีความล่าช้า 15-20 นาที
            ผลวิเคราะห์จาก AI อาจคลาดเคลื่อน ควรตรวจสอบข้อมูลเพิ่มเติมก่อนตัดสินใจลงทุนจริงเสมอ
          </div>
          <div style={{ fontSize: 12, color: "#8B93A0", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
            By NJ
          </div>
        </div>

      </div>
    </div>
  );
}
