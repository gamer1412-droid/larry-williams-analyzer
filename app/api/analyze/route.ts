import { NextResponse } from 'next/server';

// ===== Asset Class Definitions =====
const ASSET_CLASSES = [
  {
    key: "stock",
    label: "หุ้น",
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
      if (cleaned.endsWith("USD") || cleaned.endsWith("USDT")) {
        return cleaned.replace("USDT", "USD").replace(/USD$/, "") + "-USD";
      }
      return cleaned + "-USD";
    }
    case "forex": {
      const cleaned = s.toUpperCase().replace("/", "");
      return cleaned + "=X";
    }
    case "futures": {
      const match = FUTURES_MAP[sLower];
      if (match) return match.yahoo;
      // If user types a symbol like GC=F directly
      if (s.includes("=F")) return s.toUpperCase();
      // Try appending =F
      return s.toUpperCase() + "=F";
    }
    default:
      return s.toUpperCase();
  }
}

// ===== Fetch Real Market Data from Yahoo Finance =====
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
  recentVolumes: number[];
  fetchedAt: string;
}

async function fetchMarketData(yahooSymbol: string): Promise<MarketData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1mo`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    const closes = (quotes?.close || []).filter((c: number | null) => c !== null) as number[];
    const volumes = (quotes?.volume || []).filter((v: number | null) => v !== null) as number[];

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.chartPreviousClose || closes[closes.length - 2] || currentPrice;

    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      currentPrice,
      previousClose,
      change: +(currentPrice - previousClose).toFixed(4),
      changePercent: +(((currentPrice - previousClose) / previousClose) * 100).toFixed(2),
      dayHigh: meta.regularMarketDayHigh || currentPrice,
      dayLow: meta.regularMarketDayLow || currentPrice,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
      volume: meta.regularMarketVolume || 0,
      currency: meta.currency || "USD",
      recentCloses: closes.slice(-10).map((c: number) => +c.toFixed(4)),
      recentVolumes: volumes.slice(-10),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch market data:", err);
    return null;
  }
}

// ===== Build Enhanced Prompt with Real Data =====
function buildPrompt(assetClass: string, symbol: string, marketData: MarketData | null) {
  const cls = ASSET_CLASSES.find((c) => c.key === assetClass) || ASSET_CLASSES[0];

  let marketContext = "";
  if (marketData) {
    const priceDirection = marketData.change >= 0 ? "▲" : "▼";
    const recentPrices = marketData.recentCloses
      .map((c, i) => `วันที่ ${i + 1}: ${c}`)
      .join(", ");

    marketContext = `
===== ข้อมูลตลาดจริง ณ เวลานี้ (จาก Yahoo Finance) =====
• สัญลักษณ์: ${marketData.symbol} (${marketData.name})
• ราคาปัจจุบัน: ${marketData.currentPrice} ${marketData.currency} ${priceDirection} ${Math.abs(marketData.change)} (${marketData.changePercent >= 0 ? "+" : ""}${marketData.changePercent}%)
• ราคาปิดก่อนหน้า: ${marketData.previousClose}
• ราคาสูงสุดวันนี้: ${marketData.dayHigh}
• ราคาต่ำสุดวันนี้: ${marketData.dayLow}
• 52-Week High: ${marketData.fiftyTwoWeekHigh}
• 52-Week Low: ${marketData.fiftyTwoWeekLow}
• Volume วันนี้: ${marketData.volume.toLocaleString()}
• ราคาปิด 10 วันล่าสุด: [${recentPrices}]
• สกุลเงิน: ${marketData.currency}
• เวลาที่ดึงข้อมูล: ${marketData.fetchedAt}
========================================================
`;
  }

  return `คุณคือนักวิเคราะห์การลงทุนมืออาชีพที่ใช้กรอบแนวคิดของ Larry Williams (ปรับให้เหมาะกับสินทรัพย์ประเภท "${cls.label}") ในการวิเคราะห์ "${symbol}"

${marketContext}

**กฎสำคัญ:**
1. ใช้ข้อมูลตลาดจริงด้านบนเป็นหลักในการวิเคราะห์ ห้ามใช้ข้อมูลเก่าหรือสมมติตัวเลขขึ้นมาเอง
2. ทุก detail ต้องมีตัวเลขเฉพาะเจาะจง (ราคา, เปอร์เซ็นต์, ระดับแนวรับ/แนวต้าน)
3. ถ้าไม่มีข้อมูลเพียงพอสำหรับเกณฑ์ใด ให้ระบุว่า "ไม่สามารถประเมินได้จากข้อมูลที่มี" แทนการเดา
4. วิเคราะห์อย่างตรงไปตรงมา อย่า bias ไปทาง bullish โดยไม่มีเหตุผล
5. ตอบเป็นภาษาไทยเท่านั้น ห้ามมีตัวอักษรจีน/ญี่ปุ่น/เกาหลี ปนในคำตอบ

วิเคราะห์ตามเกณฑ์ต่อไปนี้ทีละข้อ:
${cls.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON ห้ามใส่ markdown code fence ตามโครงสร้างนี้เป๊ะๆ:

{
  "symbol": "${symbol}",
  "overall_bias": "bullish" | "bearish" | "neutral",
  "confidence": <number 1-10>,
  "summary": "<สรุปภาพรวม 2-3 ประโยค ต้องมีตัวเลขราคาจริงประกอบ เป็นภาษาไทย>",
  "criteria": [
    { "label": "<ชื่อเกณฑ์ตรงตามที่ให้มา>", "signal": "bullish" | "bearish" | "neutral", "detail": "<คำอธิบาย 2-3 ประโยค พร้อมตัวเลขเฉพาะเจาะจง ภาษาไทย>" }
  ],
  "risk_note": "<ข้อควรระวังสำคัญที่สุด 1 ข้อ พร้อมระบุระดับราคาที่ต้องระวัง ภาษาไทย>",
  "market_snapshot": {
    "price": ${marketData?.currentPrice || 0},
    "change_percent": ${marketData?.changePercent || 0},
    "high_52w": ${marketData?.fiftyTwoWeekHigh || 0},
    "low_52w": ${marketData?.fiftyTwoWeekLow || 0},
    "currency": "${marketData?.currency || "USD"}"
  },
  "analyzed_at": "${new Date().toISOString()}"
}

ต้องมี criteria ครบทุกข้อตามที่ให้มา ห้ามขาดหรือเกิน`;
}

// ===== API Route Handler =====
export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is missing from environment variables' }, { status: 500 });
    }

    const { symbol, activeClass } = await request.json();

    if (!symbol || !activeClass) {
      return NextResponse.json({ error: 'Missing symbol or activeClass' }, { status: 400 });
    }

    // Step 1: Fetch real market data from Yahoo Finance
    const yahooSymbol = toYahooSymbol(activeClass, symbol);
    const marketData = await fetchMarketData(yahooSymbol);

    if (marketData) {
      console.log(`Market data fetched: ${marketData.symbol} @ ${marketData.currentPrice} ${marketData.currency}`);
    } else {
      console.warn(`Could not fetch market data for ${yahooSymbol}, proceeding without real-time data`);
    }

    // Step 2: Build enhanced prompt with real data
    const promptText = buildPrompt(activeClass, symbol, marketData);

    // Step 3: Call Groq API with system message
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'คุณเป็นนักวิเคราะห์การลงทุนมืออาชีพที่ใช้กรอบแนวคิด Larry Williams คุณต้องอ้างอิงตัวเลขจริงเสมอ วิเคราะห์อย่างตรงไปตรงมา ไม่ bias ไปทาง bullish หรือ bearish โดยไม่มีเหตุผล ตอบเป็นภาษาไทยเท่านั้น ห้ามมีตัวอักษรภาษาจีน ญี่ปุ่น หรือเกาหลีในคำตอบ',
          },
          {
            role: 'user',
            content: promptText,
          },
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      return NextResponse.json(
        { error: `Groq API error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    try {
      const rawText = data.choices?.[0]?.message?.content || '{}';
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(cleaned);

      // Ensure market_snapshot is always populated from real data
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
        };
        parsedData.data_source = "Yahoo Finance (real-time)";
      } else {
        parsedData.data_source = "AI knowledge base (ไม่สามารถดึงข้อมูลราคาจริงได้)";
      }
      parsedData.analyzed_at = new Date().toISOString();

      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error('Failed to parse Groq response as JSON', data);
      return NextResponse.json({ error: 'Failed to parse JSON response from Groq' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in analyze API route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
