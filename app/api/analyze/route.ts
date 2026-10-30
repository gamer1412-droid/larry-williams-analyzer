import { NextResponse } from 'next/server';
import {
  ASSET_CLASSES, toYahooSymbol, calcSMA, calcRSI, calcATR, calcPivotPoints,
  qualityClassFor, assessDataQuality, calcWeeklyTrend, cotCodeFor, validateActionPlan,
  type MarketData, type FundamentalData, type CryptoMarketData, type CotData, type DataQuality,
} from "@/lib/analysis";

// ฟังก์ชันคำนวณและ logic วิเคราะห์ pure ทั้งหมดอยู่ที่ lib/analysis.ts (unit test ได้)

// ===== Fetch Real Market Data =====

const COT_TTL = 24 * 60 * 60 * 1000; // รายงานออกรายสัปดาห์ — cache วันละครั้งพอ
const cotCache = new Map<string, CacheEntry<CotData | null>>();

async function fetchCotData(code: string): Promise<CotData | null> {
  const cached = cotCache.get(code);
  if (cached && Date.now() < cached.expiry) return cached.data;
  let data: CotData | null = null;
  try {
    const select = "report_date_as_yyyy_mm_dd,market_and_exchange_names,open_interest_all,noncomm_positions_long_all,noncomm_positions_short_all,comm_positions_long_all,comm_positions_short_all";
    const url = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?$select=${select}&$where=cftc_contract_market_code='${code}'&$order=report_date_as_yyyy_mm_dd DESC&$limit=30`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length < 2) return null;

    const num = (v: string | undefined) => (v != null && v !== "" ? Number(v) : 0);
    const latest = rows[0];
    const nets = rows.map((r) => num(r.noncomm_positions_long_all) - num(r.noncomm_positions_short_all));
    const net = nets[0];
    const min = Math.min(...nets);
    const max = Math.max(...nets);
    data = {
      market: latest.market_and_exchange_names,
      reportDate: latest.report_date_as_yyyy_mm_dd.slice(0, 10),
      noncommLong: num(latest.noncomm_positions_long_all),
      noncommShort: num(latest.noncomm_positions_short_all),
      noncommNet: net,
      commNet: num(latest.comm_positions_long_all) - num(latest.comm_positions_short_all),
      openInterest: num(latest.open_interest_all),
      netChangeWeek: net - nets[1],
      percentile30w: max > min ? +(((net - min) / (max - min)) * 100).toFixed(0) : null,
    };
  } catch {
    data = null;
  }
  // cache เฉพาะผลสำเร็จ — error ชั่วคราวควรลองใหม่รอบหน้า
  if (data) cotCache.set(code, { data, expiry: Date.now() + COT_TTL });
  return data;
}


// ===== Fetch Real Market Data =====
async function fetchMarketData(yahooSymbol: string): Promise<MarketData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1y`;
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
    const rawTimestamps = (result.timestamp || []) as number[];

    // Filter null values but keep aligned
    const aligned: { c: number; h: number; l: number; v: number; t: number }[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] != null && rawHighs[i] != null && rawLows[i] != null) {
        aligned.push({
          c: rawCloses[i] as number,
          h: rawHighs[i] as number,
          l: rawLows[i] as number,
          v: (rawVolumes[i] ?? 0) as number,
          t: rawTimestamps[i] ?? 0,
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
      weekly: calcWeeklyTrend(aligned),
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

// ===== Fetch Fundamental Data (Yahoo v7 quote — ต้องใช้ cookie + crumb) =====
// Yahoo ปิด endpoint quoteSummary (v11) แล้ว (404) — endpoint ที่ยังมีชีวิตคือ v7 quote
// โดยต้องขอ cookie จาก yahoo ก่อน แล้วแลกเป็น crumb (cache ไว้ 1 ชั่วโมง)
let crumbCache: { crumb: string; cookie: string; expiry: number } | null = null;

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && Date.now() < crumbCache.expiry) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": "Mozilla/5.0" },
      // fc.yahoo.com ตอบ 404 แต่ set-cookie กลับมาให้ปกติ — ไม่ throw เพราะ fetch ไม่ reject 4xx
    });
    const cookie = (cookieRes.headers.getSetCookie?.() || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!cookie) return null;

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
      signal: AbortSignal.timeout(8000),
    });
    const crumb = (await crumbRes.text()).trim();
    // crumb จริงสั้นๆ; ถ้าได้ JSON error กลับมาแปลว่า cookie ไม่ผ่าน
    if (!crumb || crumb.startsWith("{") || crumb.length > 40) return null;

    crumbCache = { crumb, cookie, expiry: Date.now() + 60 * 60 * 1000 };
    return { crumb, cookie };
  } catch {
    return null;
  }
}

async function fetchFundamentalData(yahooSymbol: string): Promise<FundamentalData | null> {
  try {
    const auth = await getYahooCrumb();
    if (!auth) return null;

    const fields = "trailingPE,forwardPE,marketCap,epsTrailingTwelveMonths,dividendYield,beta,fiftyDayAverage,twoHundredDayAverage,sector,industry";
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}&fields=${fields}&crumb=${encodeURIComponent(auth.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Cookie: auth.cookie },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const q = data?.quoteResponse?.result?.[0];
    if (!q) return null;

    return {
      trailingPE: q.trailingPE,
      forwardPE: q.forwardPE,
      marketCap: q.marketCap,
      eps: q.epsTrailingTwelveMonths,
      // v7 quote ให้ dividendYield เป็นหน่วย % มาแล้ว (ต่างจาก quoteSummary เก่าที่เป็นตัวเศษ)
      dividendYield: typeof q.dividendYield === "number" ? +q.dividendYield.toFixed(2) : undefined,
      beta: q.beta,
      fiftyDayAverage: q.fiftyDayAverage,
      twoHundredDayAverage: q.twoHundredDayAverage,
      sector: q.sector,
      industry: q.industry,
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
  cotData: CotData | null
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

    const wk = marketData.weekly;
    const weeklySignal = wk.sma10 != null
      ? `ราคาอยู่${wk.aboveSma10 ? "เหนือ" : "ต่ำกว่า"}เฉลี่ย 10 สัปดาห์ (${wk.aboveSma10 ? "เทรนด์ภาพใหญ่ขาขึ้น" : "เทรนด์ภาพใหญ่ขาลง"})`
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

--- เทรนด์ภาพใหญ่รายสัปดาห์ (จากข้อมูล 1 ปี) ---
• สัปดาห์นี้ (ยังไม่ปิด) เทียบสัปดาห์ก่อน: ${wk.changePct != null ? (wk.changePct >= 0 ? "+" : "") + wk.changePct + "%" : "N/A"} → ${weeklySignal}
• SMA 10 สัปดาห์: ${wk.sma10 ?? "N/A"}
• ราคาปิดรายสัปดาห์ล่าสุด (เก่า→ใหม่): ${wk.closes.join(", ")}

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
  if (fundamental && assetClass === "equity") {
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
• Sector / Industry: ${[fundamental.sector, fundamental.industry].filter(Boolean).join(" / ") || "N/A"}
• 50-Day MA (Yahoo): ${fundamental.fiftyDayAverage?.toFixed(2) ?? "N/A"}
• 200-Day MA (Yahoo): ${fundamental.twoHundredDayAverage?.toFixed(2) ?? "N/A"}`;
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

  let cotContext = "";
  if (assetClass === "macro" && cotData) {
    const pct = cotData.percentile30w;
    const pctNote = pct != null
      ? pct >= 80 ? "extreme ฝั่งเก็งกำไรยาวมาก — momentum แข็งแรงแต่ระวังภาวะซื้อหมด (crowded long)"
        : pct >= 60 ? "เอียงฝั่งเก็งกำไรยาวมากกว่าปกติ"
        : pct <= 20 ? "extreme ฝั่งเก็งกำไรสั้นมาก — แรงขายชัดเจนแต่ระวัง short squeeze"
        : pct <= 40 ? "เอียงฝั่งเก็งกำไรสั้นมากกว่าปกติ"
        : "ระดับกลาง ไม่ extreme"
      : "";
    cotContext = `
--- COT Report (CFTC) — ${cotData.market} ---
• รายงานล่าสุด: ${cotData.reportDate} (ข้อมูลจริงรายสัปดาห์ ไม่ใช่ประมาณการ)
• Non-Commercial (นักเก็งกำไร): Long ${cotData.noncommLong.toLocaleString()} / Short ${cotData.noncommShort.toLocaleString()} → Net ${cotData.noncommNet >= 0 ? "+" : ""}${cotData.noncommNet.toLocaleString()} (${cotData.netChangeWeek >= 0 ? "+" : ""}${cotData.netChangeWeek.toLocaleString()} เทียบสัปดาห์ก่อน)
• Net positioning อยู่ percentile ${pct ?? "N/A"} ของกรอบ 30 สัปดาห์ → ${pctNote}
• Commercial (hedger): Net ${cotData.commNet >= 0 ? "+" : ""}${cotData.commNet.toLocaleString()}
• Open Interest: ${cotData.openInterest.toLocaleString()}`;
  }

  return `คุณคือนักวิเคราะห์การลงทุนมืออาชีพที่เชี่ยวชาญกรอบแนวคิด Larry Williams ในการวิเคราะห์ "${symbol}" (${cls.label})

${marketContext}
${fundamentalContext}
${cryptoContext}
${cotContext}

**กฎสำคัญ:**
1. ใช้ข้อมูลทั้งหมดด้านบนในการวิเคราะห์ โดยเฉพาะ Technical Indicators และ Pivot Points
${marketData
  ? `2. ทุก detail ต้องอ้างอิงตัวเลขจริงจากข้อมูลด้านบน เช่น "SMA20 ที่ ${marketData.sma20 ?? 'N/A'}" หรือ "RSI14 ที่ ${marketData.rsi14 ?? 'N/A'}"`
  : `2. หากไม่มีข้อมูล Real-time ให้ระบุภาพรวมและระดับสำคัญตามกรอบแนวคิด Larry Williams อย่างสมเหตุสมผล`}
3. action_plan ต้องมี Entry/Stop Loss/Take Profit เป็นตัวเลขจริง (คำนวณจาก ATR หรือ Pivot Points)
4. Stop Loss = ใช้ ATR × 1.5 หรือ S1/S2 แล้วแต่ว่าอันไหนสมเหตุสมผลกว่า
5. ถ้าเกณฑ์ใดไม่มีข้อมูลเพียงพอ (เช่น Funding Rate / Seasonality / Institutional Flow ไม่มีข้อมูลจริงจากแหล่งข้อมูลด้านบน) ให้ตอบใน detail ว่า "ไม่มีข้อมูลเพียงพอ — ไม่สามารถประเมินได้จากข้อมูลที่มี" แทนการเดา และลด confidence ลงตามสัดส่วนเกณฑ์ที่ขาด — สำหรับ macro ที่มี COT Report ให้ใช้ตัวเลขจริงในการประเมินเกณฑ์ COT เสมอ
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

// ตรวจสอบกับ GET /openai/v1/models ของ Groq (ต.ค. 2026) — llama-3.3-70b ถูกถอนแล้ว
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
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
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    model: "gemini-2.5-flash",
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
];

const SYSTEM_PROMPT = 'คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพที่ใช้กรอบแนวคิด Larry Williams ร่วมกับ Technical Analysis คุณต้องอ้างอิงตัวเลขจริงจาก SMA, RSI, ATR, Pivot Points ที่ให้มาเสมอ วิเคราะห์อย่างตรงไปตรงมา ตอบเป็นภาษาไทยเท่านั้น ห้ามมีตัวอักษรจีน ญี่ปุ่น เกาหลี';

const AI_TOTAL_BUDGET_MS = 45_000; // งบเวลารวมของทุก provider (route มี maxDuration 60s)
const AI_PROVIDER_TIMEOUT_MS = 30_000;

async function callAI(promptText: string): Promise<{ content: string; provider: string }> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: promptText },
  ];
  const deadline = Date.now() + AI_TOTAL_BUDGET_MS;
  const errors: string[] = [];

  for (const provider of AI_PROVIDERS) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;

    const remaining = deadline - Date.now();
    if (remaining < 8_000) {
      errors.push(`${provider.name}: ข้าม (เวลาไม่พอภายในงบ ${AI_TOTAL_BUDGET_MS / 1000}s)`);
      continue;
    }
    const timeoutMs = Math.min(AI_PROVIDER_TIMEOUT_MS, remaining);

    try {
      const url = provider.name === "Gemini"
        ? `${provider.url}?key=${apiKey}`
        : provider.url;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
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
      if (err instanceof Error && err.name === "AbortError") {
        errors.push(`${provider.name}: timeout (${Math.round(timeoutMs / 1000)}s)`);
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

// ===== Simple In-Memory Rate Limit (10 ครั้ง/นาที ต่อ IP — กันยิง API จนหมดโควตา AI) =====
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    rateBuckets.set(ip, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  // ล้าง bucket ที่หมดอายุ กันหน่วยความจำโต
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return true;
}

const VALID_ASSET_CLASSES = new Set(["equity", "crypto", "macro"]);

// ===== API Route Handler =====
// ใช้เวลารวม (ดึงข้อมูล + เรียก AI) นาน จำกัดไว้ให้ Vercel ไม่ตัดกลางทาง
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "คุณเรียก API ถี่เกินไป (จำกัด 10 ครั้ง/นาที) — รอสักครู่แล้วลองใหม่" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const rawSymbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
    const activeClass = typeof body?.activeClass === "string" ? body.activeClass.trim() : "";
    if (!rawSymbol || !activeClass) {
      return NextResponse.json({ error: 'กรุณาระบุสัญลักษณ์และประเภทสินทรัพย์' }, { status: 400 });
    }
    if (!VALID_ASSET_CLASSES.has(activeClass)) {
      return NextResponse.json({ error: `ประเภทสินทรัพย์ไม่ถูกต้อง — ต้องเป็น equity, crypto หรือ macro` }, { status: 400 });
    }
    // กัน input แปลกๆ เข้าไปใน URL และ prompt (สัญลักษณ์จริงมีแค่ตัวอักษร/ตัวเลข/จุด/ขีด/ = / : & เว้นวรรค)
    if (rawSymbol.length > 20 || !/^[A-Za-z0-9&\s./=\-:]+$/.test(rawSymbol)) {
      return NextResponse.json({ error: "รูปแบบสัญลักษณ์ไม่ถูกต้อง" }, { status: 400 });
    }
    const symbol = rawSymbol;

    // Step 1: Fetch market data (parallel, with cache)
    const yahooSymbol = toYahooSymbol(activeClass, symbol);
    const cotCode = cotCodeFor(activeClass, symbol);

    const [marketData, fundamental, cryptoData, cotData] = await Promise.all([
      fetchMarketDataCached(yahooSymbol),
      (activeClass === "equity") ? fetchFundamentalDataCached(yahooSymbol) : Promise.resolve(null),
      activeClass === "crypto" ? fetchCryptoMarketData() : Promise.resolve(null),
      cotCode ? fetchCotData(cotCode) : Promise.resolve(null),
    ]);

    if (marketData) {
      // ตรวจคุณภาพข้อมูลก่อนส่งต่อ (ข้อ 1: ธงเตือนเลขเพี้ยน)
      marketData.dataQuality = assessDataQuality(marketData, qualityClassFor(activeClass, yahooSymbol));
      if (marketData.dataQuality.isAbnormal) {
        console.warn(`Data quality flags for ${yahooSymbol}:`, marketData.dataQuality.flags);
      }
    } else {
      console.warn(`Warning: Could not fetch market data for ${yahooSymbol}`);
    }

    // Step 2: Build prompt
    const promptText = buildPrompt(activeClass, symbol, marketData, fundamental, cryptoData, cotData);

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
          weekly_change_pct: marketData.weekly.changePct,
          weekly_sma10: marketData.weekly.sma10,
          weekly_above_sma10: marketData.weekly.aboveSma10,
          data_quality: marketData.dataQuality || { isAbnormal: false, flags: [] },
        };
        parsedData.data_source = `Yahoo Finance (real-time) + ${aiProvider}`;
      } else {
        parsedData.data_source = `${aiProvider} (ไม่สามารถดึงข้อมูลราคาจริงได้)`;
      }

      // Attach fundamental & crypto data
      if (fundamental) parsedData.fundamental = fundamental;
      if (cryptoData) parsedData.crypto_market = cryptoData;
      if (cotData) parsedData.cot = cotData;

      // ===== ข้อ 4: ตรวจคำตอบตัวเอง (Self-check AI output) =====
      const selfCheckFlags: string[] = [];
      const aiSummary: string = parsedData.summary || "";
      const aiCriteria: Array<{label?: string; detail?: string; signal?: string}> = parsedData.criteria || [];

      // เช็ก 1: AI อ้าง SMA20 ไม่ตรงข้อมูลจริง (เทียบแบบสัดส่วน 10% — ใช้ได้ทั้งสินทรัพย์ราคาต่ำ/สูง)
      // ข้ามเลขที่ตามด้วย % (เป็นการพูดถึงระยะห่าง ไม่ใช่ราคา)
      const snapshot = parsedData.market_snapshot || null;
      if (snapshot && (snapshot as { sma20?: number }).sma20 && aiSummary) {
        const snapSma = (snapshot as { sma20?: number }).sma20!;
        const smaInText = /SMA\s*20[^.。]{0,40}?(\d[\d,]*\.?\d+)(?!\s*%)/i.exec(aiSummary);
        if (smaInText) {
          const claimed = parseFloat(smaInText[1].replace(/,/g, ""));
          if (Number.isFinite(claimed) && snapSma > 0 && Math.abs(claimed - snapSma) / snapSma > 0.1) {
            selfCheckFlags.push(`AI อ้าง SMA20 ไม่ตรงข้อมูลจริง (Yahoo: ${snapSma}, AI claim: ~${smaInText[1]})`);
          }
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

      // ===== ตรวจ Action Plan — parse ตัวเลข Entry/SL/TP, คำนวณ Risk:Reward ให้ UI =====
      if (parsedData.action_plan) {
        parsedData.action_plan_validation = validateActionPlan(parsedData.action_plan);
        const apWarns: string[] = parsedData.action_plan_validation.warnings;
        if (apWarns.length > 0) {
          // รูปทรงผิด (เช่น BUY แต่ SL อยู่เหนือ entry) — ให้ผู้ใช้เห็นใน self-check/risk_note ด้วย
          parsedData.self_check_flags = [...(parsedData.self_check_flags || []), ...apWarns];
          parsedData.self_check_passed = false;
        }
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

