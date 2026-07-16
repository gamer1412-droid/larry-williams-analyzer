"use client";

import { useState } from "react";
import { TrendingUp, Layers, LineChart, Bitcoin, Globe2, Search, Loader2, AlertTriangle, ExternalLink } from "lucide-react";

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
    default:
      return s;
  }
}

const ASSET_CLASSES = [
  { key: "stock", label: "หุ้น", icon: TrendingUp, placeholder: "เช่น AAPL, JEPQ" },
  { key: "options", label: "ออปชั่น", icon: Layers, placeholder: "เช่น EOSE, JEPQ (สำหรับ CSP/Wheel)" },
  { key: "futures", label: "ฟิวเจอร์ส", icon: LineChart, placeholder: "เช่น Gold, Crude Oil, Corn" },
  { key: "crypto", label: "คริปโต", icon: Bitcoin, placeholder: "เช่น BTC, ETH, BNB" },
  { key: "forex", label: "ฟอเร็กซ์", icon: Globe2, placeholder: "เช่น EUR/USD, USD/JPY" },
];

const SIGNAL_STYLES: Record<string, { bg: string, border: string, text: string, label: string }> = {
  bullish: { bg: "#1F3A32", border: "#4A9B7F", text: "#7FD4B3", label: "BULLISH" },
  bearish: { bg: "#3A2321", border: "#C1554B", text: "#E8988F", label: "BEARISH" },
  neutral: { bg: "#2A2A22", border: "#9B8F5A", text: "#D4C88F", label: "NEUTRAL" },
};

export default function App() {
  const [activeClass, setActiveClass] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [tvOverride, setTvOverride] = useState("");

  const currentClass = ASSET_CLASSES.find((c) => c.key === activeClass) || ASSET_CLASSES[0];
  const tvSymbol = tvOverride.trim() || toTradingViewSymbol(activeClass, symbol);

  async function handleAnalyze() {
    if (!symbol.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim(),
          activeClass: activeClass,
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการวิเคราะห์");
      }

      setResult(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง หรือเปลี่ยนสัญลักษณ์ที่ค้นหา");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F1419",
        color: "#E8E3D8",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .ledger-row { border-bottom: 1px solid #2A323C; }
        .ledger-row:last-child { border-bottom: none; }
        .stamp {
          border: 3px double currentColor;
          transform: rotate(-4deg);
          display: inline-block;
          padding: 6px 18px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          letter-spacing: 0.15em;
        }
        .tab-btn { transition: all 0.15s ease; }
        input:focus { outline: none; }
      `}</style>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 20px 80px" }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.2em", color: "#8B93A0", marginBottom: 8 }}>
            FRAMEWORK ANALYZER — EST. 1987
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 700, margin: 0, color: "#F0EBDD" }}>
            บันทึกวิเคราะห์แบบปู่ Larry
          </h1>
          <p style={{ color: "#8B93A0", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            วิเคราะห์ตามกรอบแนวคิด "เงื่อนไขสำคัญกว่ากราฟ" — ปรับใช้กับหุ้น ออปชั่น ฟิวเจอร์ส คริปโต และฟอเร็กซ์
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {ASSET_CLASSES.map((c) => {
            const Icon = c.icon;
            const active = c.key === activeClass;
            return (
              <button
                key={c.key}
                className="tab-btn"
                onClick={() => {
                  setActiveClass(c.key);
                  setResult(null);
                  setError(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 6,
                  border: `1px solid ${active ? "#C9A45C" : "#2A323C"}`,
                  background: active ? "#C9A45C" : "#171D24",
                  color: active ? "#0F1419" : "#B8BFC9",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Icon size={15} />
                {c.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder={currentClass.placeholder}
            style={{
              flex: 1,
              background: "#171D24",
              border: "1px solid #2A323C",
              borderRadius: 6,
              padding: "12px 14px",
              color: "#E8E3D8",
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !symbol.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#C9A45C",
              color: "#0F1419",
              border: "none",
              borderRadius: 6,
              padding: "0 20px",
              fontWeight: 600,
              fontSize: 14,
              cursor: loading || !symbol.trim() ? "default" : "pointer",
              opacity: loading || !symbol.trim() ? 0.6 : 1,
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            วิเคราะห์
          </button>
        </div>

        {tvSymbol && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8B93A0", letterSpacing: "0.1em" }}>
                CHART · {tvSymbol}
              </span>
              <a
                href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#C9A45C", textDecoration: "none" }}
              >
                เปิดใน TradingView <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ border: "1px solid #2A323C", borderRadius: 8, overflow: "hidden" }}>
              <iframe
                key={tvSymbol}
                title="tradingview-chart"
                src={`https://s.tradingview.com/embed-widget/advanced-chart/?symbol=${encodeURIComponent(
                  tvSymbol
                )}&interval=D&theme=dark&style=1&locale=th_TH&hide_side_toolbar=0&toolbar_bg=%230F1419`}
                style={{ width: "100%", height: 420, border: "none", display: "block" }}
              />
            </div>
            <input
              value={tvOverride}
              onChange={(e) => setTvOverride(e.target.value)}
              placeholder="ชาร์ตไม่ขึ้น หรือไม่ตรง? ลองระบุรหัสเต็ม เช่น NASDAQ:AAPL, BINANCE:BTCUSDT, FX:EURUSD, COMEX:GC1!"
              style={{
                width: "100%",
                marginTop: 8,
                background: "transparent",
                border: "1px dashed #2A323C",
                borderRadius: 6,
                padding: "8px 12px",
                color: "#8B93A0",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8B93A0", fontSize: 14 }}>
            <Loader2 size={22} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            กำลังค้นข้อมูลและประมวลผล...
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: "#3A2321",
              border: "1px solid #C1554B",
              borderRadius: 6,
              padding: 16,
              color: "#E8988F",
              fontSize: 13,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            {error}
          </div>
        )}

        {result && !loading && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8B93A0", marginBottom: 4 }}>
                  {result.symbol?.toUpperCase()} · ความมั่นใจ {result.confidence}/10
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#D8D2C4", maxWidth: 480 }}>{result.summary}</p>
              </div>
              <div className="stamp" style={{ color: SIGNAL_STYLES[result.overall_bias]?.border || "#9B8F5A" }}>
                {SIGNAL_STYLES[result.overall_bias]?.label || result.overall_bias?.toUpperCase()}
              </div>
            </div>

            <div style={{ background: "#171D24", border: "1px solid #2A323C", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
              {(result.criteria || []).map((item: any, idx: number) => {
                const style = SIGNAL_STYLES[item.signal] || SIGNAL_STYLES.neutral;
                return (
                  <div key={idx} className="ledger-row" style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#E8E3D8" }}>{item.label}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 500,
                          padding: "2px 9px",
                          borderRadius: 4,
                          background: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#9098A3", lineHeight: 1.6 }}>{item.detail}</p>
                  </div>
                );
              })}
            </div>

            {result.risk_note && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 14, background: "#20242A", borderRadius: 6, fontSize: 13, color: "#B8BFC9" }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: "#C9A45C" }} />
                <span>{result.risk_note}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "1px solid #2A323C", fontSize: 11, color: "#5C6470", lineHeight: 1.7 }}>
          เครื่องมือนี้ใช้เพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน ผลวิเคราะห์อิงจากข้อมูลที่ค้นเจอ ณ เวลานั้นและอาจคลาดเคลื่อน
          ควรตรวจสอบข้อมูลเพิ่มเติมก่อนตัดสินใจลงทุนจริงเสมอ
        </div>
      </div>
    </div>
  );
}
