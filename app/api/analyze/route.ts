import { NextResponse } from 'next/server';

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

function buildPrompt(assetClass: string, symbol: string) {
  const cls = ASSET_CLASSES.find((c) => c.key === assetClass) || ASSET_CLASSES[0];
  return `คุณคือนักวิเคราะห์การลงทุนที่ใช้กรอบแนวคิดของ Larry Williams (ปรับให้เหมาะกับสินทรัพย์ประเภท "${cls.label}") ในการวิเคราะห์ "${symbol}"

ให้ค้นหาข้อมูลปัจจุบัน (ราคาล่าสุด, ข่าว, เทรนด์) ด้วยเครื่องมือ Google Search แล้ววิเคราะห์ตามเกณฑ์ต่อไปนี้ทีละข้อ:
${cls.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

ตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON ห้ามใส่ markdown code fence ตามโครงสร้างนี้เป๊ะๆ:

{
  "symbol": "${symbol}",
  "overall_bias": "bullish" | "bearish" | "neutral",
  "confidence": <number 1-10>,
  "summary": "<สรุปภาพรวม 2-3 ประโยค เป็นภาษาไทย>",
  "criteria": [
    { "label": "<ชื่อเกณฑ์ตรงตามที่ให้มา>", "signal": "bullish" | "bearish" | "neutral", "detail": "<คำอธิบายสั้นๆ ภาษาไทย 1-2 ประโยค>" }
  ],
  "risk_note": "<ข้อควรระวังสำคัญที่สุด 1 ข้อ ภาษาไทย>"
}

ต้องมี criteria ครบทุกข้อตามที่ให้มา ห้ามขาดหรือเกิน`;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is missing from environment variables' }, { status: 500 });
    }

    const { symbol, activeClass } = await request.json();

    if (!symbol || !activeClass) {
      return NextResponse.json({ error: 'Missing symbol or activeClass' }, { status: 400 });
    }

    const promptText = buildPrompt(activeClass, symbol);

    const payload = {
      contents: [
        {
          parts: [
            { text: promptText }
          ]
        }
      ],
      tools: [
        { googleSearch: {} }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Parse the JSON string from Gemini's response
    try {
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleaned);
      return NextResponse.json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON", data);
      return NextResponse.json({ error: 'Failed to parse JSON response from Gemini' }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Error in analyze API route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
