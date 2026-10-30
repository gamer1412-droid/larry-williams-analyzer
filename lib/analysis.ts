// ===== Pure analysis logic — ไม่มี I/O ทั้งหมด เขียน unit test ได้ =====
// ย้ายมาจาก app/api/analyze/route.ts เพื่อให้ test แยกจาก Next.js runtime

// ===== Asset Class Definitions =====
export const ASSET_CLASSES = [
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
// cot = รหัสตลาดในรายงาน COT ของ CFTC (publicreporting.cftc.gov) — undefined = ไม่มีรายงาน
export const FUTURES_MAP: Record<string, { yahoo: string; name: string; cot?: string }> = {
  "gold": { yahoo: "GC=F", name: "Gold Futures", cot: "088691" },
  "silver": { yahoo: "SI=F", name: "Silver Futures", cot: "084691" },
  "crude oil": { yahoo: "CL=F", name: "Crude Oil Futures", cot: "067651" },
  "wti": { yahoo: "CL=F", name: "WTI Crude Oil Futures", cot: "067651" },
  "brent": { yahoo: "BZ=F", name: "Brent Crude Oil Futures" },
  "natural gas": { yahoo: "NG=F", name: "Natural Gas Futures", cot: "023651" },
  "corn": { yahoo: "ZC=F", name: "Corn Futures", cot: "002071" },
  "wheat": { yahoo: "ZW=F", name: "Wheat Futures", cot: "001071" },
  "soybean": { yahoo: "ZS=F", name: "Soybean Futures", cot: "005071" },
  "copper": { yahoo: "HG=F", name: "Copper Futures", cot: "085692" },
  "platinum": { yahoo: "PL=F", name: "Platinum Futures", cot: "075651" },
  "s&p 500": { yahoo: "ES=F", name: "S&P 500 E-mini Futures", cot: "13874A" },
  "nasdaq": { yahoo: "NQ=F", name: "Nasdaq 100 E-mini Futures", cot: "209742" },
  "dow": { yahoo: "YM=F", name: "Dow E-mini Futures", cot: "124603" },
};

// ฟอเร็กซ์ — ใช้ตำแหน่ง currency futures ของ CME (key = รหัสสกุลเงิน)
export const FOREX_COT_CODES: Record<string, string> = {
  "EUR": "099741", "JPY": "097741", "GBP": "096742", "CHF": "092741",
  "CAD": "090741", "AUD": "032741", "NZD": "112741",
};

export function toYahooSymbol(assetClass: string, raw: string): string {
  const s = raw.trim();
  const sLower = s.toLowerCase();
  switch (assetClass) {
    case "crypto": {
      const cleaned = s.toUpperCase().replace("/", "");
      // ETF คริปโตไทย เช่น BTC.BK — ใช้ตามที่พิมพ์
      if (cleaned.endsWith(".BK")) return cleaned;
      // ตัด suffix รูปแบบต่างๆ (BTC-USD / BTCUSDT / BTCUSD) แล้วรวมเป็น XXX-USD
      const base = cleaned.replace(/-?(USDT|USD)$/, "");
      return base + "-USD";
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
export function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(4);
}

export function calcRSI(closes: number[], period = 14): number | null {
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

export function calcATR(highs: number[], lows: number[], closes: number[], period = 10): number | null {
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

export function calcPivotPoints(high: number, low: number, close: number) {
  const pp = +(( high + low + close) / 3).toFixed(4);
  return {
    pp,
    r1: +(2 * pp - low).toFixed(4),
    r2: +(pp + (high - low)).toFixed(4),
    s1: +(2 * pp - high).toFixed(4),
    s2: +(pp - (high - low)).toFixed(4),
  };
}

// ===== Market Data Interfaces =====
export interface MarketData {
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
  // เทรนด์ภาพใหญ่รายสัปดาห์ (จากข้อมูล 1 ปี)
  weekly: {
    changePct: number | null;      // สัปดาห์นี้เทียบสัปดาห์ก่อน
    sma10: number | null;          // เฉลี่ย 10 สัปดาห์
    aboveSma10: boolean | null;    // ราคาอยู่เหนือ/ต่ำกว่าเฉลี่ย 10 สัปดาห์
    closes: number[];              // ราคาปิดรายสัปดาห์ล่าสุด (เก่า→ใหม่)
  };
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

export interface FundamentalData {
  trailingPE?: number;
  forwardPE?: number;
  marketCap?: number;
  eps?: number;
  dividendYield?: number;
  sector?: string;
  industry?: string;
  beta?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
}

export interface CryptoMarketData {
  btcDominance?: number;
  fearGreedIndex?: number;
  fearGreedLabel?: string;
  totalMarketCap?: number;
}

// ===== COT Report (CFTC — หัวใจของกรอบ Larry Williams สำหรับฟิวเจอร์ส/ฟอเร็กซ์) =====
export interface CotData {
  market: string;
  reportDate: string;
  noncommLong: number;
  noncommShort: number;
  noncommNet: number;      // Net Non-Commercial (นักเก็งกำไร)
  commNet: number;         // Net Commercial (hedger)
  openInterest: number;
  netChangeWeek: number;   // Net เทียบสัปดาห์ก่อน
  percentile30w: number | null; // Net อยู่ตำแหน่งไหนของกรอบ 30 สัปดาห์ (0-100)
}

// หารหัสตลาด COT จาก symbol ที่ผู้ใช้พิมพ์ (เฉพาะ macro) — null = ไม่มีรายงานให้ดู
export function cotCodeFor(activeClass: string, rawSymbol: string): string | null {
  if (activeClass !== "macro") return null;
  const s = rawSymbol.trim();
  if (s.includes("/")) {
    // คู่ฟอเร็กซ์ — ใช้สกุลเงินที่มี futures ให้ดู (ถ้าตัวหน้าเป็น USD ใช้ตัวหลัง)
    const [base, quote] = s.toUpperCase().split("/");
    return FOREX_COT_CODES[base] || FOREX_COT_CODES[quote] || null;
  }
  return FUTURES_MAP[s.toLowerCase()]?.cot ?? null;
}

// ===== Weekly Trend (รวมราคาปิดรายวันเป็นรายสัปดาห์จากข้อมูล 1 ปี) =====
export function calcWeeklyTrend(aligned: { c: number; t: number }[]): MarketData["weekly"] {
  const weeklyCloses: number[] = [];
  let lastWeekIdx = -1;
  for (const bar of aligned) {
    // epoch เริ่มวันพฤหัสบดี — เลื่อน 4 วันให้สัปดาห์แบ่งที่วันจันทร์
    const weekIdx = Math.floor((bar.t + 4 * 86400) / (7 * 86400));
    if (weekIdx !== lastWeekIdx) {
      weeklyCloses.push(bar.c);
      lastWeekIdx = weekIdx;
    } else {
      weeklyCloses[weeklyCloses.length - 1] = bar.c; // เก็บปิดของวันท้ายสัปดาห์
    }
  }
  if (weeklyCloses.length < 2) {
    return { changePct: null, sma10: null, aboveSma10: null, closes: weeklyCloses };
  }
  const last = weeklyCloses[weeklyCloses.length - 1];
  const prev = weeklyCloses[weeklyCloses.length - 2];
  const changePct = +(((last - prev) / prev) * 100).toFixed(2);
  const window = weeklyCloses.slice(-10);
  const sma10 = window.length >= 10 ? +(window.reduce((a, b) => a + b, 0) / 10).toFixed(4) : null;
  const aboveSma10 = sma10 != null ? last > sma10 : null;
  return { changePct, sma10, aboveSma10, closes: weeklyCloses.slice(-26) };
}

// ===== Data Quality / Anomaly Detection =====
// กันเคส Yahoo ส่งเลขเพี้ยน (เช่น BTC +21% วันเดียว) แล้วแอปโชว์ผ่านๆ
export interface DataQuality {
  isAbnormal: boolean;
  flags: string[];
}

// เกณฑ์ "ขยับแรงผิดปกติภายในวันเดียว" แยกตามสินทรัพย์
// key ตรงกับ quality class: equity / crypto / forex / futures (frontend ส่ง equity|crypto|macro)
const ABNORMAL_MOVE_PCT: Record<string, number> = {
  equity: 15,
  crypto: 20,
  forex: 3,
  futures: 8,
};

const QUALITY_LABEL_TH: Record<string, string> = {
  equity: "หุ้น",
  crypto: "คริปโต",
  forex: "ฟอเร็กซ์",
  futures: "ฟิวเจอร์ส",
};

// macro ครอบคลุมทั้งฟิวเจอร์ส (=F) และฟอเร็กซ์ (=X) — แยกเกณฑ์ตามสัญลักษณ์ Yahoo
export function qualityClassFor(activeClass: string, yahooSymbol: string): string {
  if (activeClass === "macro") return yahooSymbol.includes("=X") ? "forex" : "futures";
  return activeClass;
}

export function assessDataQuality(md: MarketData, qualityClass: string): DataQuality {
  const flags: string[] = [];

  // 1. ขยับวันเดียวเกินเกณฑ์ของสินทรัพย์นั้น
  const move = Math.abs(md.changePercent);
  const limit = ABNORMAL_MOVE_PCT[qualityClass] ?? 15;
  if (move >= limit) {
    flags.push(
      `ราคาขยับ ${md.changePercent}% ภายในวันเดียว (เกินเกณฑ์ปกติ ${limit}% ของ${QUALITY_LABEL_TH[qualityClass] || qualityClass}) — ตรวจสอบข่าว/ความถูกต้องของข้อมูลก่อนตัดสินใจ`
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

// ===== Action Plan Validation =====
// AI สร้าง entry/stop/TP เป็นข้อความอิสระ — parse ตัวเลขออกมาตรวจความสมเหตุสมผล
// และคำนวณ Risk:Reward ให้ผู้ใช้เห็นทันที
export interface ActionPlanInput {
  recommendation?: string;
  entry_zone?: string;
  stop_loss?: string;
  take_profit_1?: string;
  take_profit_2?: string;
}

export interface ParsedActionPlan {
  entry?: number;      // จุดกึ่งกลางถ้าเป็นช่วง
  entryLow?: number;
  entryHigh?: number;
  stop?: number;
  tp1?: number;
  tp2?: number;
}

export interface ActionPlanValidation {
  parsed: ParsedActionPlan;
  rr: number | null;          // Risk:Reward โดยใช้ TP1 (เช่น 2.5 = 1:2.5)
  warnings: string[];
}

// ดึงตัวเลขแรกจากข้อความ — ข้ามตัวเลขที่ตามด้วย % (เป็นระยะ ไม่ใช่ราคา)
function firstPriceNumber(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /(\d[\d,]*(?:\.\d+)?)(?!\s*%)/.exec(text.replace(/[–—]/g, "-"));
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parseActionPlan(ap: ActionPlanInput): ParsedActionPlan {
  const entryText = (ap.entry_zone || "").replace(/[–—]/g, "-");
  const nums: number[] = [];
  for (const m of entryText.matchAll(/(\d[\d,]*(?:\.\d+)?)(?!\s*%)/g)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) nums.push(n);
  }
  const parsed: ParsedActionPlan = {};
  if (nums.length >= 2) {
    parsed.entryLow = Math.min(nums[0], nums[1]);
    parsed.entryHigh = Math.max(nums[0], nums[1]);
    parsed.entry = +((parsed.entryLow + parsed.entryHigh) / 2).toFixed(6);
  } else if (nums.length === 1) {
    parsed.entry = nums[0];
  }
  parsed.stop = firstPriceNumber(ap.stop_loss);
  parsed.tp1 = firstPriceNumber(ap.take_profit_1);
  parsed.tp2 = firstPriceNumber(ap.take_profit_2);
  return parsed;
}

export function validateActionPlan(ap: ActionPlanInput): ActionPlanValidation {
  const parsed = parseActionPlan(ap);
  const warnings: string[] = [];
  let rr: number | null = null;

  const rec = (ap.recommendation || "").toUpperCase();
  const { entry, stop, tp1 } = parsed;

  if ((rec === "BUY" || rec === "SELL") && entry != null && stop != null) {
    if (rec === "BUY" && stop >= entry) {
      warnings.push(`Action Plan ไม่สมเหตุสมผล: BUY แต่ Stop Loss (${stop}) ไม่ได้อยู่ต่ำกว่า Entry (~${entry}) — ตรวจสอบก่อนใช้งาน`);
    }
    if (rec === "SELL" && stop <= entry) {
      warnings.push(`Action Plan ไม่สมเหตุสมผล: SELL แต่ Stop Loss (${stop}) ไม่ได้อยู่สูงกว่า Entry (~${entry}) — ตรวจสอบก่อนใช้งาน`);
    }
    if (tp1 != null) {
      if (rec === "BUY" && tp1 <= entry) {
        warnings.push(`Action Plan น่าสงสัย: BUY แต่ Take Profit 1 (${tp1}) ไม่ได้อยู่สูงกว่า Entry (~${entry})`);
      }
      if (rec === "SELL" && tp1 >= entry) {
        warnings.push(`Action Plan น่าสงสัย: SELL แต่ Take Profit 1 (${tp1}) ไม่ได้อยู่ต่ำกว่า Entry (~${entry})`);
      }
    }
  }

  // Risk:Reward — คำนวณได้เมื่อรูปทรงถูกต้อง (risk > 0)
  if (entry != null && stop != null && tp1 != null && warnings.length === 0) {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(tp1 - entry);
    if (risk > 0) rr = +(reward / risk).toFixed(2);
  }

  return { parsed, rr, warnings };
}
