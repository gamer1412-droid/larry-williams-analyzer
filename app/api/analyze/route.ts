import { NextResponse } from 'next/server';

// ===== Asset Class Definitions =====
const ASSET_CLASSES = [
  {
    key: "equity", label: "หุ้น & ออปชั่น",
    criteria: [
      "เทรนด์ภาพใหญ่ (Weekly Trend)",
      "เงื่อนไขพื้นฐาน / ข่าวที่กำลังมีผล",
      "แรงซื้อสถาบัน vs รายย่อย (Institutional Flow)",
      "รูปแบบแท่งปิดตลาด (Close Pattern)",
      "Valuation เทียบกับ Sector",
      "แนวรับ-แนวต้านใน Timeframe Day",
      "IV Rank / Implied Volatility (Options)"
    ],
  },
  {
    key: "crypto", label: "คริปโต",
    criteria: [
      "เทรนด์ภาพใหญ่ (Higher Timeframe)",
      "Funding Rate / Sentiment (proxy COT)",
      "Exchange Netflow (proxy สถาบัน vs รายย่อย)",
      "เงื่อนไขข่าว / กฎระเบียบ",
      "โครงสร้างราคา แนวรับ-แนวต้าน",
      "BTC Dominance / Market Correlation",
    ],
  },
  {
    key: "macro", label: "ฟิวเจอร์ส & ฟอเร็กซ์",
    criteria: [
      "COT: Commercials / Non-Commercial Positioning",
      "นโยบายธนาคารกลาง / อัตราดอกเบี้ย (Forex)",
      "เทรนด์ภาพใหญ่ (Weekly)",
      "ฤดูกาล (Seasonality)",
      "จุดปิดตลาด (Bullish/Bearish Close)",
      "Open Interest Trend / วัฏจักรราคา",
      "Correlation กับ DXY / สินทรัพย์อื่น"
    ],
  },
];

// ===== Yahoo Finance Symbol Mapping =====
const FUTURES_MAP: Record<string, { yahoo: string; name: string }> = {
  "gold": { yahoo: "GC=F", name: "Gold Futures" },
  "silver": { yahoo: "SI=F", name: "Silver Futures" },
  "crude oil": { yahoo: "CL=F", name: "Crude Oil Futures" },
  "wti": { yahoo: "CL=F", name: "WTI Crude Oil Futures" },
  "brent": { yahoo: "BZ=F", name: "Brent Crude Oil Futures" },
  "natural gas": { yahoo: "NG=F", name: "Natural Gas Futures" },
  "corn": { yahoo: "ZC=F", name: "Corn Futures" },
  "wheat": { yahoo: "ZW=F", name: "Wheat Futures" },
  "soybean": { yahoo: "ZS=F", name: "Soybean Futures" },
  "copper": { yahoo: "HG=F", name: "Copper Futures" },
  "platinum": { yahoo: "PL=F", name: "Platinum Futures" },
  "s&p 500": { yahoo: "ES=F", name: "S&P 500 E-mini Futures" },
  "nasdaq": { yahoo: "NQ=F", name: "Nasdaq 100 E-mini Futures" },
  "dow": { yahoo: "YM=F", name: "Dow E-mini Futures" },
};

function toYahooSymbol(assetClass: string, raw: string): string {
  const s = raw.trim();
  const sLower = s.toLowerCase();
  switch (assetClass) {
    case "crypto": {
      const cleaned = s.toUpperCase().replace("/", "");
      if (cleaned.endsWith(".BK")) {
        const base = cleaned.replace(".BK", "");
        return base.replace("BTC", "BTC.BK");
      }
      if (cleaned.endsWith("USD") || cleaned.endsWith("USDT")) {
        return cleaned.replace("USDT", "USD").replace(/USD$/, "") + "-USD";
      }
      return cleaned + "-USD";
    }
    case "equity": {
      return s.toUpperCase();
    }
    case "macro": {
      const match = FUTURES_MAP[sLower];
      if (match) return match.yahoo;
      if (s.includes("=F") || s.includes("=X")) return s.toUpperCase();
      // ถ้าเป็นชื่อสกุลเงินใน forex (มี /) → =X
      if (s.includes("/")) return s.toUpperCase().replace("/", "") + "=X";
      return s.toUpperCase() + "=F";
    }
    default:
      return s.toUpperCase();
  }
}

// ===== Technical Indicator Calculations =====
function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(4);
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 10): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(4);
}

function calcPivotPoints(high: number, low: number, close: number) {
  const pp = +(( high + low + close) / 3).toFixed(4);
  return {
    pp,
    r1: +(2 * pp - low).toFixed(4),
    r2: +(pp + (high - low)).toFixed(4),
    s1: +(2 * pp - high).toFixed(4),
    s2: +(pp - (high - low)).toFixed(4),
  };
}

// ===== Market Data Interface =====
interface MarketData {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  currency: string;
  recentCloses: number[];
  recentHighs: number[];
  recentLows: number[];
  recentVolumes: number[];
  fetchedAt: string;
  // Calculated indicators
  sma5: number | null;
  sma10: number | null;
  sma20: number | null;
  rsi14: number | null;
  atr10: number | null;
  pivotPoints: { pp: number; r1: number; r2: number; s1: number; s2: number } | null;
  volumeRatio: number | null;
  pctFrom52wHigh: number;
  pctFrom52wLow: number;
  // ผลตรวจคุณภาพข้อมูล (เช็กความเพี้ยนของ Yahoo ก่อนโชว์)
  dataQuality?: DataQuality;
}

interface FundamentalData {
  trailingPE?: number;
  forwardPE?: number;
  marketCap?: number;
  eps?: number;
  dividendYield?: number;
  sector?: string;
  industry?: string;
  earningsDate?: string;
  impliedVolatility?: number;
  beta?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
}

interface CryptoMarketData {
  btcDominance?: number;
  fearGreedIndex?: number;
  fearGreedLabel?: string;
  totalMarketCap?: number;
}

// ===== Data Quality / Anomaly Detection =====
// กันเคส Yahoo ส่งเลขเพี้ยน (เช่น BTC +21% วันเดียว) แล้วแอปโชว์ผ่านๆ
interface DataQuality {
  isAbnormal: boolean;
  flags: string[];
}

// เกณฑ์ "ขยับแรงผิดปกติภายในวันเดียว" แยกตามสินทรัพย์
const ABNORMAL_MOVE_PCT: Record<string, number> = {
  stock: 15,
  options: 15,
  crypto: 20,
  forex: 3,
  futures: 8,
};

function assessDataQuality(md: MarketData, assetClass: string): DataQuality {
  const flags: string[] = [];

  // 1. ขยับวันเดียวเกินเกณฑ์ของสินทรัพย์นั้น
  const move = Math.abs(md.changePercent);
  const limit = ABNORMAL_MOVE_PCT[assetClass] ?? 15;
  if (move >= limit) {
    flags.push(
      `ราคาขยับ ${md.changePercent}% ภายในวันเดียว (เกินเกณฑ์ปกติ ${limit}% ของ${assetClass}) — ตรวจสอบข่าว/ความถูกต้องของข้อมูลก่อนตัดสินใจ`
    );
  }

  // 2. ราคาปัจจุบันอยู่นอกกรอบ High/Low ของวัน → ข้อมูลดีเลย์หรือไม่ตรงกัน
  if (md.currentPrice > md.dayHigh || md.currentPrice < md.dayLow) {
    flags.push(
      `ราคาปัจจุบัน (${md.currentPrice}) อยู่นอกกรอบ High/Low ของวัน (${md.dayLow}–${md.dayHigh}) — ข้อมูลอาจดีเลย์หรือไม่ตรงกัน`
    );
  }

  // 3. ขยับเกิน 4× ATR10 → แรงผิดปกติ (ข่าวใหญ่หรือข้อมูลเพี้ยน)
  if (md.atr10 && md.atr10 > 0) {
    const atrMult = Math.abs(md.change) / md.atr10;
    if (atrMult >= 4) {
      flags.push(
        `ความขยับวันนี้ ≈ ${atrMult.toFixed(1)}× ของ ATR10 — ผิดปกติมาก ระวังข่าวแรงหรือข้อมูลเพี้ยน`
      );
    }
  }

  // 4. previousClose ไม่ตรงกับราคาปิดวันก่อน → %เปลี่ยนแปลงอาจเพี้ยน
  const prevDailyClose = md.recentCloses[md.recentCloses.length - 2];
  if (prevDailyClose && md.previousClose) {
    const diff = Math.abs(md.previousClose - prevDailyClose) / prevDailyClose;
    if (diff > 0.05) {
      flags.push(
        `previousClose (${md.previousClose}) ไม่ตรงกับราคาปิดวันก่อน (${prevDailyClose}) ต่าง ${(diff * 100).toFixed(1)}% — ค่า %เปลี่ยนแปลงอาจเพี้ยน`
      );
    }
  }

  return { isAbnormal: flags.length > 0, flags };
}

// ===== Fetch Real Market Data =====
async function fetchMarketData(yahooSymbol: string): Promise<MarketData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=3mo`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`Yahoo Finance rate limited for ${yahooSymbol}`);
      }
      return null;
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    const rawCloses = (quotes?.close || []) as (number | null)[];
    const rawHighs = (quotes?.high || []) as (number | null)[];
    const rawLows = (quotes?.low || []) as (number | null)[];
    const rawVolumes = (quotes?.volume || []) as (number | null)[];

    // Filter null values but keep aligned
    const aligned: { c: number; h: number; l: number; v: number }[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] != null && rawHighs[i] != null && rawLows[i] != null) {
        aligned.push({
          c: rawCloses[i] as number,
          h: rawHighs[i] as number,
          l: rawLows[i] as number,
          v: (rawVolumes[i] ?? 0) as number,
        });
      }
    }

    const closes = aligned.map(x => x.c);
    const highs = aligned.map(x => x.h);
    const lows = aligned.map(x => x.l);
    const volumes = aligned.map(x => x.v);

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.chartPreviousClose || closes[closes.length - 2] || currentPrice;

    // Calculate indicators
    const sma5 = calcSMA(closes, 5);
    const sma10 = calcSMA(closes, 10);
    const sma20 = calcSMA(closes, 20);
    const rsi14 = calcRSI(closes, 14);
    const atr10 = calcATR(highs, lows, closes, 10);

    // Pivot from last complete session (yesterday)
    const lastIdx = aligned.length - 2; // yesterday
    const pivotPoints = lastIdx >= 0
      ? calcPivotPoints(highs[lastIdx], lows[lastIdx], closes[lastIdx])
      : null;

    // Volume ratio: today vs 10-day avg
    const avgVol10 = volumes.length >= 11
      ? volumes.slice(-11, -1).reduce((a, b) => a + b, 0) / 10
      : null;
    const volumeRatio = avgVol10 && meta.regularMarketVolume
      ? +(meta.regularMarketVolume / avgVol10).toFixed(2)
      : null;

    const high52w = meta.fiftyTwoWeekHigh || 0;
    const low52w = meta.fiftyTwoWeekLow || 0;

    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      currentPrice,
      previousClose,
      change: +(currentPrice - previousClose).toFixed(4),
      changePercent: +(((currentPrice - previousClose) / previousClose) * 100).toFixed(2),
      dayHigh: meta.regularMarketDayHigh || currentPrice,
      dayLow: meta.regularMarketDayLow || currentPrice,
      fiftyTwoWeekHigh: high52w,
      fiftyTwoWeekLow: low52w,
      volume: meta.regularMarketVolume || 0,
      currency: meta.currency || "USD",
      recentCloses: closes.slice(-20).map(c => +c.toFixed(4)),
      recentHighs: highs.slice(-20).map(h => +h.toFixed(4)),
      recentLows: lows.slice(-20).map(l => +l.toFixed(4)),
      recentVolumes: volumes.slice(-20),
      fetchedAt: new Date().toISOString(),
      sma5, sma10, sma20, rsi14, atr10, pivotPoints, volumeRatio,
      pctFrom52wHigh: high52w > 0 ? +(((currentPrice - high52w) / high52w) * 100).toFixed(2) : 0,
      pctFrom52wLow: low52w > 0 ? +(((currentPrice - low52w) / low52w) * 100).toFixed(2) : 0,
    };
  } catch (err) {
    console.error("Failed to fetch market data:", err);
    return null;
  }
}

// ===== Fetch Fundamental Data (Yahoo quoteSummary) =====
async function fetchFundamentalData(yahooSymbol: string): Promise<FundamentalData | null> {
  try {
    const modules = "summaryDetail,financialData,defaultKeyStatistics,calendarEvents";
    const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=${modules}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { 
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return null;

    const sd = result.summaryDetail || {};
    const fd = result.financialData || {};
    const ks = result.defaultKeyStatistics || {};
    const ce = result.calendarEvents || {};

    const earningsArr = ce.earnings?.earningsDate || [];
    const nextEarnings = earningsArr[0]?.fmt || null;

    return {
      trailingPE: sd.trailingPE?.raw,
      forwardPE: sd.forwardPE?.raw,
      marketCap: sd.marketCap?.raw,
      eps: ks.trailingEps?.raw,
      dividendYield: sd.dividendYield?.raw ? +(sd.dividendYield.raw * 100).toFixed(2) : undefined,
      impliedVolatility: fd.currentPrice ? undefined : undefined, // from options chain if needed
      beta: sd.beta?.raw,
      fiftyDayAverage: sd.fiftyDayAverage?.raw,
      twoHundredDayAverage: sd.twoHundredDayAverage?.raw,
      earningsDate: nextEarnings,
      sector: ks.sector,
      industry: ks.industry,
    };
  } catch {
    return null;
  }
}

// ===== Fetch Crypto Market Data (CoinGecko - free, no key) =====
async function fetchCryptoMarketData(): Promise<CryptoMarketData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const [globalRes, fngRes] = await Promise.allSettled([
      fetch("https://api.coingecko.com/api/v3/global", { 
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      }),
      fetch("https://api.alternative.me/fng/?limit=1", { 
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeoutId);

    let btcDominance: number | undefined;
    let totalMarketCap: number | undefined;
    if (globalRes.status === "fulfilled" && globalRes.value.ok) {
      const g = await globalRes.value.json();
      btcDominance = +(g?.data?.market_cap_percentage?.btc || 0).toFixed(1);
      totalMarketCap = g?.data?.total_market_cap?.usd;
    }

    let fearGreedIndex: number | undefined;
    let fearGreedLabel: string | undefined;
    if (fngRes.status === "fulfilled" && fngRes.value.ok) {
      const f = await fngRes.value.json();
      fearGreedIndex = +f?.data?.[0]?.value;
      fearGreedLabel = f?.data?.[0]?.value_classification;
    }

    return { btcDominance, fearGreedIndex, fearGreedLabel, totalMarketCap };
  } catch {
    return null;
  }
}

// ===== Build Enhanced Prompt =====
function buildPrompt(
  assetClass: string,
  symbol: string,
  marketData: MarketData | null,
  fundamental: FundamentalData | null,
  cryptoData: CryptoMarketData | null,
  dataQuality?: DataQuality
) {
  const cls = ASSET_CLASSES.find((c) => c.key === assetClass) || ASSET_CLASSES[0];

  let marketContext = "";
  if (marketData) {
    const pp = marketData.pivotPoints;
    const rsiInterpret = marketData.rsi14
      ? marketData.rsi14 >= 70 ? "Overbought (ซื้อมากเกิน)"
        : marketData.rsi14 <= 30 ? "Oversold (ขายมากเกิน)"
        : "ปกติ"
      : "N/A";

    const smaSignal = marketData.sma20
      ? marketData.currentPrice > marketData.sma20 ? "ราคาอยู่เหนือ SMA20 (bullish)" : "ราคาอยู่ต่ำกว่า SMA20 (bearish)"
      : "N/A";

    const volSignal = marketData.volumeRatio
      ? marketData.volumeRatio > 1.5 ? `สูงกว่าเฉลี่ย ${marketData.volumeRatio}x (unusual volume)`
        : marketData.volumeRatio < 0.7 ? `ต่ำกว่าเฉลี่ย (volume ซบเซา)`
        : `ปกติ (${marketData.volumeRatio}x เฉลี่ย)`
      : "N/A";

    marketContext = `
===== ข้อมูลตลาดจริง ณ วันนี้ (Yahoo Finance + คำนวณ) =====
• สัญลักษณ์: ${marketData.symbol} (${marketData.name})
• ราคาปัจจุบัน: ${marketData.currentPrice} ${marketData.currency}
• เปลี่ยนแปลง: ${marketData.change >= 0 ? "+" : ""}${marketData.change} (${marketData.changePercent >= 0 ? "+" : ""}${marketData.changePercent}%)
• ราคาสูง/ต่ำวันนี้: ${marketData.dayHigh} / ${marketData.dayLow}
• 52-Week High: ${marketData.fiftyTwoWeekHigh} (ห่าง ${marketData.pctFrom52wHigh}%)
• 52-Week Low: ${marketData.fiftyTwoWeekLow} (ห่าง +${marketData.pctFrom52wLow}%)
• Volume วันนี้: ${marketData.volume.toLocaleString()} → ${volSignal}

--- Technical Indicators (คำนวณจากราคาจริง) ---
• SMA 5: ${marketData.sma5 ?? "N/A"}
• SMA 10: ${marketData.sma10 ?? "N/A"}
• SMA 20: ${marketData.sma20 ?? "N/A"} → ${smaSignal}
• RSI 14: ${marketData.rsi14 ?? "N/A"} → ${rsiInterpret}
• ATR 10: ${marketData.atr10 ?? "N/A"} ${marketData.currency} (ความผันผวนเฉลี่ยต่อวัน)

--- Pivot Points (คำนวณจากเมื่อวาน) ---
${pp ? `• R2: ${pp.r2}  R1: ${pp.r1}  PP: ${pp.pp}  S1: ${pp.s1}  S2: ${pp.s2}` : "• ไม่มีข้อมูล"}

--- ราคาปิด 20 วันล่าสุด ---
${marketData.recentCloses.join(", ")}
======================================================`;

    // ⚠️ ธงเตือนคุณภาพข้อมูล — บังคับให้ AI พูดถึง ห้ามเพิกเฉย
    if (marketData.dataQuality?.isAbnormal) {
      marketContext += `

--- ⚠️ คุณภาพข้อมูล (DATA QUALITY WARNING — ต้องพูดถึงใน summary และ risk_note) ---
${marketData.dataQuality.flags.map((f) => `• ${f}`).join("\n")}
→ ลด confidence ลง และเตือนผู้ใช้ให้ตรวจสอบข่าว/ข้อมูลก่อนตัดสินใจ`;
    }
  }

  let fundamentalContext = "";
  if (fundamental && (assetClass === "stock" || assetClass === "options")) {
    const formatMktCap = (v?: number) => {
      if (!v) return "N/A";
      if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T USD`;
      if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B USD`;
      return `${(v / 1e6).toFixed(2)}M USD`;
    };
    fundamentalContext = `
--- ข้อมูลพื้นฐาน (Fundamental) ---
• P/E Ratio (Trailing): ${fundamental.trailingPE?.toFixed(2) ?? "N/A"}
• P/E Ratio (Forward): ${fundamental.forwardPE?.toFixed(2) ?? "N/A"}
• Market Cap: ${formatMktCap(fundamental.marketCap)}
• EPS (Trailing): ${fundamental.eps?.toFixed(2) ?? "N/A"} USD
• Dividend Yield: ${fundamental.dividendYield ? fundamental.dividendYield + "%" : "N/A"}
• Beta: ${fundamental.beta?.toFixed(2) ?? "N/A"}
• 50-Day MA (Yahoo): ${fundamental.fiftyDayAverage?.toFixed(2) ?? "N/A"}
• 200-Day MA (Yahoo): ${fundamental.twoHundredDayAverage?.toFixed(2) ?? "N/A"}
${fundamental.earningsDate ? `• Earnings วันถัดไป: ${fundamental.earningsDate}` : "• Earnings: ไม่ระบุในข้อมูล"}`;
  }

  let cryptoContext = "";
  if (assetClass === "crypto" && cryptoData) {
    const fgColor = cryptoData.fearGreedIndex
      ? cryptoData.fearGreedIndex >= 75 ? "(โลภมาก ระวัง!)"
        : cryptoData.fearGreedIndex >= 55 ? "(โลภ)"
        : cryptoData.fearGreedIndex >= 45 ? "(เป็นกลาง)"
        : cryptoData.fearGreedIndex >= 25 ? "(กลัว)"
        : "(กลัวมาก ซื้อได้?)"
      : "";
    cryptoContext = `
--- ข้อมูลตลาด Crypto โดยรวม ---
• BTC Dominance: ${cryptoData.btcDominance ?? "N/A"}%
• Fear & Greed Index: ${cryptoData.fearGreedIndex ?? "N/A"}/100 — ${cryptoData.fearGreedLabel ?? ""} ${fgColor}
• Total Market Cap: ${cryptoData.totalMarketCap ? "$" + (cryptoData.totalMarketCap / 1e12).toFixed(2) + "T" : "N/A"}`;
  }

  return `คุณคือนักวิเคราะห์การลงทุนมืออาชีพที่เชี่ยวชาญกรอบแนวคิด Larry Williams ในการวิเคราะห์ "${symbol}" (${cls.label})

${marketContext}
${fundamentalContext}
${cryptoContext}

**กฎสำคัญ:**
1. ใช้ข้อมูลทั้งหมดด้านบนในการวิเคราะห์ โดยเฉพาะ Technical Indicators และ Pivot Points
${marketData
  ? `2. ทุก detail ต้องอ้างอิงตัวเลขจริงจากข้อมูลด้านบน เช่น "SMA20 ที่ ${marketData.sma20 ?? 'N/A'}" หรือ "RSI14 ที่ ${marketData.rsi14 ?? 'N/A'}"`
  : `2. หากไม่มีข้อมูล Real-time ให้ระบุภาพรวมและระดับสำคัญตามกรอบแนวคิด Larry Williams อย่างสมเหตุสมผล`}
3. action_plan ต้องมี Entry/Stop Loss/Take Profit เป็นตัวเลขจริง (คำนวณจาก ATR หรือ Pivot Points)
4. Stop Loss = ใช้ ATR × 1.5 หรือ S1/S2 แล้วแต่ว่าอันไหนสมเหตุสมผลกว่า
5. ถ้าเกณฑ์ใดไม่มีข้อมูลเพียงพอ (เช่น COT / Funding Rate / Seasonality / Institutional Flow ไม่มีข้อมูลจริงจาก Yahoo Finance) ให้ตอบใน detail ว่า "ไม่มีข้อมูลเพียงพอ — ไม่สามารถประเมินได้จากข้อมูลที่มี" แทนการเดา และลด confidence ลงตามสัดส่วนเกณฑ์ที่ขาด
6. ถ้ามีธงเตือนคุณภาพข้อมูล (Data Quality Warning) ต้อง mention ใน summary และ risk_note พร้อมลด confidence โดยต้องเขียนคำว่า "ข้อมูลผิดปกติ" และ "ตรวจสอบข้อมูล" ไว้ใน summary ด้วย
7. ตอบเป็นภาษาไทยเท่านั้น ห้ามมีตัวอักษรจีน/ญี่ปุ่น/เกาหลี

เกณฑ์ที่ต้องวิเคราะห์:
${cls.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

ตอบกลับเป็น JSON เท่านั้น ห้ามใส่ markdown code fence:

{
  "symbol": "${symbol}",
  "overall_bias": "bullish" | "bearish" | "neutral",
  "confidence": <number 1-10>,
  "summary": "<สรุป 2-3 ประโยค พร้อมตัวเลข SMA/RSI/ราคาจริง>",
  "criteria": [
    { "label": "<ชื่อเกณฑ์>", "signal": "bullish"|"bearish"|"neutral", "detail": "<2-3 ประโยค พร้อมตัวเลขจริง>" }
  ],
  "action_plan": {
    "recommendation": "BUY" | "SELL" | "HOLD" | "WAIT",
    "entry_zone": "<ราคาช่วงเข้า เช่น 205-208 USD>",
    "stop_loss": "<ราคา Stop Loss พร้อม % เช่น 198 USD (-4.5%)>",
    "take_profit_1": "<TP1 พร้อม % เช่น 220 USD (+6.3%)>",
    "take_profit_2": "<TP2 พร้อม % หรือ N/A>",
    "position_size": "<แนะนำขนาด เช่น ไม่เกิน 5% ของพอร์ต>",
    "timeframe": "<ระยะเวลาถือ เช่น 1-2 สัปดาห์>",
    "rationale": "<เหตุผลสั้นๆ ว่าทำไมถึงแนะนำแบบนี้>"
  },
  "risk_note": "<ข้อควรระวังสำคัญ พร้อมระดับราคาที่ต้องระวัง>",
  "analyzed_at": "${new Date().toISOString()}"
}

ต้องมี criteria ครบตามที่ให้มา และ action_plan ครบทุกฟิลด์`;
}

// ===== In-Memory Cache (5 min TTL) =====
interface CacheEntry<T> { data: T; expiry: number; }
const marketCache = new Map<string, CacheEntry<MarketData>>();
const fundamentalCache = new Map<string, CacheEntry<FundamentalData | null>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return undefined;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function fetchMarketDataCached(yahooSymbol: string): Promise<MarketData | null> {
  const cached = getCached(marketCache, yahooSymbol);
  if (cached) return cached;
  const data = await fetchMarketData(yahooSymbol);
  if (data) setCache(marketCache, yahooSymbol, data);
  return data;
}

async function fetchFundamentalDataCached(yahooSymbol: string): Promise<FundamentalData | null> {
  const cached = getCached(fundamentalCache, yahooSymbol);
  if (cached !== undefined) return cached;
  const data = await fetchFundamentalData(yahooSymbol);
  setCache(fundamentalCache, yahooSymbol, data);
  return data;
}

// ===== Multi-Provider AI Config =====
interface AIProvider {
  name: string;
  envKey: string;
  url: string;
  model: string;
  buildHeaders: (key: string) => Record<string, string>;
  buildBody: (messages: { role: string; content: string }[]) => Record<string, unknown>;
  extractContent: (data: Record<string, unknown>) => string;
}

const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
];

const AI_PROVIDERS: AIProvider[] = [
  ...GROQ_MODELS.map((m) => ({
    name: `Groq (${m.split("/").pop()})`,
    envKey: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: m,
    buildHeaders: (key: string) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${key}` }),
    buildBody: (messages: { role: string; content: string }[]) => ({
      model: m,
      messages,
      temperature: 0.15,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
    extractContent: (data: Record<string, unknown>) => {
      const choices = data.choices as { message: { content: string } }[] | undefined;
      return choices?.[0]?.message?.content || "{}";
    },
  })),
  {
    name: "Gemini",
    envKey: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
    buildHeaders: () => ({ "Content-Type": "application/json" }),
    buildBody: (messages) => {
      const systemMsg = messages.find((m) => m.role === "system");
      const userMsgs = messages.filter((m) => m.role !== "system");
      return {
        system_instruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        contents: userMsgs.map((m) => ({
          role: "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
        },
      };
    },
    extractContent: (data) => {
      const candidates = data.candidates as { content: { parts: { text: string }[] } }[] | undefined;
      return candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    },
  },
  {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    buildHeaders: (key) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${key}` }),
    buildBody: (messages) => ({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.15,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
    extractContent: (data) => {
      const choices = data.choices as { message: { content: string } }[] | undefined;
      return choices?.[0]?.message?.content || "{}";
    },
  },
];

const SYSTEM_PROMPT = 'คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพที่ใช้กรอบแนวคิด Larry Williams ร่วมกับ Technical Analysis คุณต้องอ้างอิงตัวเลขจริงจาก SMA, RSI, ATR, Pivot Points ที่ให้มาเสมอ วิเคราะห์อย่างตรงไปตรงมา ตอบเป็นภาษาไทยเท่านั้น ห้ามมีตัวอักษรจีน ญี่ปุ่น เกาหลี';

async function callAI(promptText: string): Promise<{ content: string; provider: string }> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: promptText },
  ];

  const errors: string[] = [];

  for (const provider of AI_PROVIDERS) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    try {
      const url = provider.name === "Gemini"
        ? `${provider.url}?key=${apiKey}`
        : provider.url;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      const response = await fetch(url, {
        method: "POST",
        headers: provider.buildHeaders(apiKey),
        body: JSON.stringify(provider.buildBody(messages)),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        errors.push(`${provider.name}: ${response.status} ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const content = provider.extractContent(data);
      return { content, provider: provider.name };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AbortError") || msg.includes("timeout")) {
        errors.push(`${provider.name}: timeout (45s)`);
      } else {
        errors.push(`${provider.name}: ${msg}`);
      }
    }
  }

  // No provider worked
  const hasAnyKey = AI_PROVIDERS.some((p) => !!process.env[p.envKey]);
  if (!hasAnyKey) {
    throw new Error("ไม่พบ API Key ใดเลย — กรุณาตั้งค่า GROQ_API_KEY, GEMINI_API_KEY, หรือ OPENAI_API_KEY ใน .env.local");
  }
  throw new Error(`AI providers ทั้งหมดล้มเหลว:\n${errors.join("\n")}`);
}

// ===== API Route Handler =====
export async function POST(request: Request) {
  try {
    const { symbol, activeClass } = await request.json();
    if (!symbol || !activeClass) {
      return NextResponse.json({ error: 'กรุณาระบุสัญลักษณ์และประเภทสินทรัพย์' }, { status: 400 });
    }

    // Step 1: Fetch market data (parallel, with cache)
    const yahooSymbol = toYahooSymbol(activeClass, symbol);

    const [marketData, fundamental, cryptoData] = await Promise.all([
      fetchMarketDataCached(yahooSymbol),
      (activeClass === "stock" || activeClass === "options") ? fetchFundamentalDataCached(yahooSymbol) : Promise.resolve(null),
      activeClass === "crypto" ? fetchCryptoMarketData() : Promise.resolve(null),
    ]);

    if (marketData) {
      console.log(`Market data: ${marketData.symbol} @ ${marketData.currentPrice} | SMA20: ${marketData.sma20} | RSI14: ${marketData.rsi14}`);
      // ตรวจคุณภาพข้อมูลก่อนส่งต่อ (ข้อ 1: ธงเตือนเลขเพี้ยน)
      marketData.dataQuality = assessDataQuality(marketData, activeClass);
      if (marketData.dataQuality.isAbnormal) {
        console.warn(`Data quality flags for ${yahooSymbol}:`, marketData.dataQuality.flags);
      }
    } else {
      console.warn(`Warning: Could not fetch market data for ${yahooSymbol}`);
    }

    // Step 2: Build prompt
    const promptText = buildPrompt(activeClass, symbol, marketData, fundamental, cryptoData);

    // Step 3: Call AI (with multi-provider fallback)
    const { content: rawContent, provider: aiProvider } = await callAI(promptText);

    try {
      const cleaned = rawContent.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleaned);

      // Always override market_snapshot with real fetched data
      if (marketData) {
        parsedData.market_snapshot = {
          price: marketData.currentPrice,
          change: marketData.change,
          change_percent: marketData.changePercent,
          high_52w: marketData.fiftyTwoWeekHigh,
          low_52w: marketData.fiftyTwoWeekLow,
          day_high: marketData.dayHigh,
          day_low: marketData.dayLow,
          volume: marketData.volume,
          currency: marketData.currency,
          name: marketData.name,
          sma5: marketData.sma5,
          sma10: marketData.sma10,
          sma20: marketData.sma20,
          rsi14: marketData.rsi14,
          atr10: marketData.atr10,
          pivot_points: marketData.pivotPoints,
          volume_ratio: marketData.volumeRatio,
          pct_from_52w_high: marketData.pctFrom52wHigh,
          pct_from_52w_low: marketData.pctFrom52wLow,
          data_quality: marketData.dataQuality || { isAbnormal: false, flags: [] },
        };
        parsedData.data_source = `Yahoo Finance (real-time) + ${aiProvider}`;
      } else {
        parsedData.data_source = `${aiProvider} (ไม่สามารถดึงข้อมูลราคาจริงได้)`;
      }

      // Attach fundamental & crypto data
      if (fundamental) parsedData.fundamental = fundamental;
      if (cryptoData) parsedData.crypto_market = cryptoData;

      // ===== ข้อ 4: ตรวจคำตอบตัวเอง (Self-check AI output) =====
      const selfCheckFlags: string[] = [];
      const aiSummary: string = parsedData.summary || "";
      const aiCriteria: Array<{label?: string; detail?: string; signal?: string}> = parsedData.criteria || [];

      // เช็ก 1: AI อ้าง SMA20 ไม่ตรงข้อมูลจริง
      const snapshot = parsedData.market_snapshot || null;
      if (snapshot && (snapshot as { sma20?: number }).sma20 && aiSummary) {
        const snapSma = (snapshot as { sma20?: number }).sma20!;
        const smaInText = /SMA20.*?(\d+[,.]\d*)/i.exec(aiSummary);
        if (smaInText && Math.abs(parseFloat(smaInText[1].replace(",","")) - snapSma) > 500) {
          selfCheckFlags.push(`AI อ้าง SMA20 ไม่ตรงข้อมูลจริง (Yahoo: ${snapSma}, AI claim: ~${smaInText[1]})`);
        }
      }
      // เช็ก 2: เกณฑ์ไม่มีข้อมูลพอแต่ AI ตอบ bullish/bearish
      aiCriteria.forEach((c) => {
        const detailLow = (c.detail || "").toLowerCase();
        const labelLow = (c.label || "").toLowerCase();
        const noDataIndicators = ["ไม่สามารถประเมิน", "ไม่มีข้อมูล", "data not available", "ไม่มีข้อมูลเพียงพอ", "ไม่ระบุ"];
        const hasNoData = noDataIndicators.some(k => detailLow.includes(k)) || noDataIndicators.some(k => labelLow.includes(k));
        if (hasNoData && c.signal !== "neutral" && c.signal !== undefined) {
          selfCheckFlags.push(`เกณฑ์ "${c.label}" ไม่มีข้อมูลพอ แต่ AI ตอบ ${c.signal?.toUpperCase()} แทน "ไม่สามารถประเมินได้"`);
        }
      });
      // เช็ก 3: มี data quality warning แต่ AI ไม่พูดใน summary
      const qualityFlagsStr = (snapshot as { data_quality?: { flags?: string[] } })?.data_quality?.flags?.join(", ") || "";
      if ((snapshot as { data_quality?: { isAbnormal?: boolean } })?.data_quality?.isAbnormal && qualityFlagsStr.length > 0 && !aiSummary.toLowerCase().includes("ข้อมูลผิดปกติ") && !aiSummary.toLowerCase().includes("ตรวจสอบ")) {
        selfCheckFlags.push("AI ไม่พูดถึงคำเตือนคุณภาพข้อมูล (Data Quality Warning) ใน summary ทั้งที่มีธงเตือน");
      }
      // ใส่ self-check ผล + แก้ไข summary ให้แสดงข้อมูล quality โดยอัตโนมัติ
      if (selfCheckFlags.length > 0) {
        parsedData.self_check_flags = selfCheckFlags;
        parsedData.self_check_passed = false;
        const warnPrefix = "⚠️ [ระบบเตือนคุณภาพข้อมูล] ";
        const qualityWarningText = (snapshot as { data_quality?: { flags?: string[] } })?.data_quality?.flags?.map(f => f.split("—")[0].trim()).join("; ") || "ข้อมูลราคาผิดปกติ";
        // แทรกคำเตือนต่อท้าย summary เพื่อให้ผู้ใช้เห็นแน่นอน
        if (!aiSummary.includes(qualityWarningText.split(";")[0]?.slice(0, 20) || "")) {
          parsedData.summary = aiSummary + (aiSummary.endsWith(".") ? "" : ".") + ` ตรวจสอบข้อมูล: ${qualityWarningText}.`;
        }
        parsedData.risk_note = (parsedData.risk_note ? parsedData.risk_note + "\n\n--- ตรวจสอบคำตอบ AI (Self-check) ---\n" : "--- ตรวจสอบคำตอบ AI (Self-check) ---\n") + selfCheckFlags.map((f) => "• " + f).join("\n");
      } else {
        parsedData.self_check_flags = [];
        parsedData.self_check_passed = true;
      }

      parsedData.analyzed_at = new Date().toISOString();

      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError, rawContent.slice(0, 500));
      return NextResponse.json({ error: `ไม่สามารถ parse ผลวิเคราะห์จาก ${aiProvider} ได้ — ลองใหม่อีกครั้ง` }, { status: 500 });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in analyze API route:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

