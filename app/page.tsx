"use client";

import { useState } from "react";
import {
  TrendingUp,
  Layers,
  LineChart,
  Bitcoin,
  Globe2,
  Search,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";

function toTradingViewSymbol(assetClass: string, raw: string) {
  const s = (raw || "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes(":")) return s;
  const noSlash = s.replace("/", "");
  switch (assetClass) {
    case "crypto":
      return `BINANCE:${noSlash}${
        noSlash.endsWith("USDT") || noSlash.endsWith("USD") ? "" : "USDT"
      }`;
    case "forex":
      return `FX:${noSlash}`;
    default:
      return s;
  }
}

const ASSET_CLASSES = [
  {
    key: "stock",
    label: "หุ้น",
    icon: TrendingUp,
    placeholder: "เช่น AAPL, JEPQ, NVDA",
    criteria: [
      "เทรนด์ภาพใหญ่ (Weekly Trend)",
      "เงื่อนไขพื้นฐาน / ข่าวที่กำลังมีผล",
      "แรงซื้อสถาบัน vs รายย่อย (Institutional Flow)",
      "รูปแบบแท่งปิดตลาด (Close Pattern)",
      "Valuation เทียบกับ Sector",
      "แนวรับ-แนวต้านใน Timeframe Day",
    ],
  },
  {
    key: "options",
    label: "ออปชั่น",
    icon: Layers,
    placeholder: "เช่น EOSE, JEPQ (สำหรับ CSP/Wheel)",
    criteria: [
      "IV Rank",
      "เหตุการณ์ข่าว / Earnings ในช่วง DTE",
      "แนวรับเทคนิคตรงกับ Strike หรือไม่",
      "สภาพคล่อง (OI / Volume ของ Option Chain)",
      "Delta ที่เหมาะสม (0.15-0.25 หรือ 0.30-0.40)",
      "ขนาดโพซิชั่นเทียบพอร์ต",
    ],
  },
  {
    key: "futures",
    label: "ฟิวเจอร์ส",
    icon: LineChart,
    placeholder: "เช่น Gold (GC1!), Crude Oil (CL1!)",
    criteria: [
      "COT: Commercials Net Position",
      "Open Interest Trend (ใครเป็นคนขับเคลื่อน)",
      "ฤดูกาล (Seasonality)",
      "เทรนด์ภาพใหญ่ (Weekly)",
      "จุดปิดตลาด (Bullish/Bearish Close)",
      "วัฏจักรราคา / Valuation",
    ],
  },
  {
    key: "crypto",
    label: "คริปโต",
    icon: Bitcoin,
    placeholder: "เช่น BTC, ETH, SOL, BNB",
    criteria: [
      "เทรนด์ภาพใหญ่ (Higher Timeframe)",
      "Funding Rate (proxy แทน COT Sentiment)",
      "Exchange Netflow (proxy แทนสถาบัน vs รายย่อย)",
      "เงื่อนไขข่าว / กฎระเบียบ",
      "โครงสร้างราคา แนวรับ-แนวต้าน",
      "BTC Dominance / Correlation",
    ],
  },
  {
    key: "forex",
    label: "ฟอเร็กซ์",
    icon: Globe2,
    placeholder: "เช่น EUR/USD, USD/JPY, GBP/USD",
    criteria: [
      "COT: Non-Commercial (Speculator) Positioning",
      "นโยบายธนาคารกลาง / อัตราดอกเบี้ย",
      "เทรนด์ภาพใหญ่ (Weekly)",
      "จุดปิดตลาด",
      "ฤดูกาล (Seasonality)",
      "Correlation กับ DXY / สินทรัพย์อื่น",
    ],
  },
];

const SIGNAL_STYLES: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  bullish: {
    bg: "#1F3A32",
    border: "#4A9B7F",
    text: "#7FD4B3",
    label: "BULLISH",
  },
  bearish: {
    bg: "#3A2321",
    border: "#C1554B",
    text: "#E8988F",
    label: "BEARISH",
  },
  neutral: {
    bg: "#2A2A22",
    border: "#9B8F5A",
    text: "#D4C88F",
    label: "NEUTRAL",
  },
};

interface AnalysisResult {
  symbol: string;
  overall_bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  criteria: {
    label: string;
    signal: "bullish" | "bearish" | "neutral";
    detail: string;
  }[];
  risk_note?: string;
}

export default function App() {
  const [activeClass, setActiveClass] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isMockResult, setIsMockResult] = useState(false);
  const [tvOverride, setTvOverride] = useState("");

  const currentClass =
    ASSET_CLASSES.find((c) => c.key === activeClass) || ASSET_CLASSES[0];
  const tvSymbol = tvOverride.trim() || toTradingViewSymbol(activeClass, symbol);

  async function handleAnalyze() {
    if (!symbol.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setIsMockResult(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeClass,
          symbol: symbol.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "วิเคราะห์ไม่สำเร็จ");
      }

      setResult(data.result);
      if (data.isMock) {
        setIsMockResult(true);
      }
    } catch (e: any) {
      setError(
        e.message ||
          "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง หรือเปลี่ยนสัญลักษณ์ที่ค้นหา"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0F1419] text-[#E8E3D8] font-sans">
      <div className="max-w-3xl mx-auto px-5 pt-12 pb-20">
        {/* Header Section */}
        <header className="mb-9">
          <div className="font-mono text-xs tracking-[0.2em] text-[#8B93A0] mb-2">
            FRAMEWORK ANALYZER — EST. 1987
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold text-[#F0EBDD] tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            บันทึกวิเคราะห์แบบปู่ Larry
          </h1>
          <p className="text-[#8B93A0] text-sm sm:text-base mt-2 leading-relaxed">
            วิเคราะห์ตามกรอบแนวคิด &quot;เงื่อนไขสำคัญกว่ากราฟ&quot; — ปรับใช้กับหุ้น ออปชั่น ฟิวเจอร์ส คริปโต และฟอเร็กซ์
          </p>
        </header>

        {/* Asset Class Selector Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ASSET_CLASSES.map((c) => {
            const Icon = c.icon;
            const active = c.key === activeClass;
            return (
              <button
                key={c.key}
                type="button"
                className="tab-btn flex items-center gap-2 px-4 py-2.5 rounded-md text-xs sm:text-sm font-medium border"
                onClick={() => {
                  setActiveClass(c.key);
                  setResult(null);
                  setError(null);
                }}
                style={{
                  border: `1px solid ${active ? "#C9A45C" : "#2A323C"}`,
                  background: active ? "#C9A45C" : "#171D24",
                  color: active ? "#0F1419" : "#B8BFC9",
                }}
              >
                <Icon size={16} />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Input & Action Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-8">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            placeholder={currentClass.placeholder}
            className="flex-1 bg-[#171D24] border border-[#2A323C] rounded-md px-4 py-3 text-[#E8E3D8] text-sm font-mono placeholder:text-[#5C6470]"
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || !symbol.trim()}
            className="flex items-center justify-center gap-2 bg-[#C9A45C] hover:bg-[#D4B26C] disabled:opacity-50 text-[#0F1419] font-semibold px-6 py-3 rounded-md text-sm transition-all"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
            วิเคราะห์
          </button>
        </div>

        {/* TradingView Chart */}
        {tvSymbol && (
          <section className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[11px] text-[#8B93A0] tracking-widest uppercase">
                CHART · {tvSymbol}
              </span>
              <a
                href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
                  tvSymbol
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-[#C9A45C] hover:underline"
              >
                เปิดใน TradingView <ExternalLink size={12} />
              </a>
            </div>
            <div className="border border-[#2A323C] rounded-lg overflow-hidden bg-[#171D24]">
              <iframe
                key={tvSymbol}
                title="tradingview-chart"
                src={`https://s.tradingview.com/embed-widget/advanced-chart/?symbol=${encodeURIComponent(
                  tvSymbol
                )}&interval=D&theme=dark&style=1&locale=th_TH&hide_side_toolbar=0&toolbar_bg=%230F1419`}
                className="w-full h-[420px] sm:h-[460px] border-none block"
              />
            </div>
            <input
              type="text"
              value={tvOverride}
              onChange={(e) => setTvOverride(e.target.value)}
              placeholder="ชาร์ตไม่ขึ้น หรือไม่ตรง? ระบุสัญลักษณ์เต็ม เช่น NASDAQ:AAPL, BINANCE:BTCUSDT, FX:EURUSD"
              className="w-full mt-2 bg-transparent border border-dashed border-[#2A323C] rounded-md px-3 py-2 text-[#8B93A0] text-xs font-mono"
            />
          </section>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="text-center py-12 text-[#8B93A0] text-sm flex flex-col items-center">
            <Loader2
              size={26}
              className="animate-spin text-[#C9A45C] mb-3"
            />
            <span>กำลังค้นข้อมูลและประมวลผลตามเกณฑ์ {currentClass.label}...</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex gap-3 items-start bg-[#3A2321] border border-[#C1554B] rounded-md p-4 text-[#E8988F] text-sm mb-6">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Analysis Results Display */}
        {result && !loading && (
          <section className="space-y-6">
            {isMockResult && (
              <div className="flex gap-2.5 items-center bg-[#171D24] border border-[#C9A45C]/30 rounded-md px-3.5 py-2.5 text-xs text-[#C9A45C]">
                <Info size={15} className="shrink-0" />
                <span>
                  โหมดทดสอบ (Fallback Mode): เพื่อเปิดใช้งาน AI สด สามารถเพิ่ม{" "}
                  <code className="bg-[#2A323C] px-1.5 py-0.5 rounded font-mono">
                    GEMINI_API_KEY
                  </code>{" "}
                  หรือ{" "}
                  <code className="bg-[#2A323C] px-1.5 py-0.5 rounded font-mono">
                    ANTHROPIC_API_KEY
                  </code>{" "}
                  ในไฟล์ <code className="font-mono">.env.local</code>
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-[#8B93A0] mb-1">
                  {result.symbol?.toUpperCase()} · ความมั่นใจ {result.confidence}/10
                </div>
                <p className="text-sm sm:text-base leading-relaxed text-[#D8D2C4] max-w-lg">
                  {result.summary}
                </p>
              </div>
              <div
                className="stamp self-start sm:self-center"
                style={{
                  color:
                    SIGNAL_STYLES[result.overall_bias]?.border || "#9B8F5A",
                }}
              >
                {SIGNAL_STYLES[result.overall_bias]?.label ||
                  result.overall_bias?.toUpperCase()}
              </div>
            </div>

            <div className="bg-[#171D24] border border-[#2A323C] rounded-lg overflow-hidden">
              {(result.criteria || []).map((item, idx) => {
                const style =
                  SIGNAL_STYLES[item.signal] || SIGNAL_STYLES.neutral;
                return (
                  <div key={idx} className="ledger-row p-4 sm:px-5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium text-[#E8E3D8]">
                        {item.label}
                      </span>
                      <span
                        className="text-[11px] font-mono font-medium px-2 py-0.5 rounded border"
                        style={{
                          background: style.bg,
                          color: style.text,
                          borderColor: style.border,
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p className="m-0 text-xs sm:text-sm text-[#9098A3] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>

            {result.risk_note && (
              <div className="flex gap-3 items-start p-4 bg-[#20242A] border border-[#2A323C] rounded-md text-xs sm:text-sm text-[#B8BFC9]">
                <AlertTriangle
                  size={17}
                  className="shrink-0 mt-0.5 text-[#C9A45C]"
                />
                <span>{result.risk_note}</span>
              </div>
            )}
          </section>
        )}

        {/* Footer Disclaimer */}
        <footer className="mt-14 pt-5 border-t border-[#2A323C] text-[11px] text-[#5C6470] leading-relaxed">
          เครื่องมือนี้สร้างเพื่อการศึกษาและวิเคราะห์โครงสร้างตลาดตามแนวคิด Larry Williams เท่านั้น ไม่ใช่คำแนะนำการลงทุน
          ผลวิเคราะห์อิงจากข้อมูลที่ค้นเจอ ณ เวลานั้น ควรตรวจสอบข้อมูลเพิ่มเติมก่อนตัดสินใจลงทุนจริงเสมอ
        </footer>
      </div>
    </main>
  );
}
