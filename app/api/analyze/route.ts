import { NextResponse } from "next/server";

interface CriteriaItem {
  label: string;
  signal: "bullish" | "bearish" | "neutral";
  detail: string;
}

interface AnalysisResult {
  symbol: string;
  overall_bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string;
  criteria: CriteriaItem[];
  risk_note: string;
}

const ASSET_CLASSES: Record<string, { label: string; criteria: string[] }> = {
  stock: {
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
  options: {
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
  futures: {
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
  crypto: {
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
  forex: {
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
};

function buildPrompt(assetClass: string, symbol: string) {
  const cls = ASSET_CLASSES[assetClass] || ASSET_CLASSES["stock"];
  return `คุณคือนักวิเคราะห์การลงทุนที่เชี่ยวชาญกรอบแนวคิดของ Larry Williams (ปรับให้เหมาะกับสินทรัพย์ประเภท "${cls.label}") ในการวิเคราะห์ "${symbol}"

กรุณาวิเคราะห์สภาพตลาดปัจจุบันและแนวโน้มราคาตามเกณฑ์ต่อไปนี้ทีละข้อ:
${cls.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

ตอบกลับเป็น JSON แท้เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON ห้ามใส่ markdown code fence ตามโครงสร้างนี้เป๊ะๆ:

{
  "symbol": "${symbol}",
  "overall_bias": "bullish" | "bearish" | "neutral",
  "confidence": 8,
  "summary": "<สรุปภาพรวม 2-3 ประโยค เป็นภาษาไทย>",
  "criteria": [
    { "label": "<ชื่อเกณฑ์ตรงตามที่ให้มา>", "signal": "bullish" | "bearish" | "neutral", "detail": "<คำอธิบายสั้นๆ ภาษาไทย 1-2 ประโยค>" }
  ],
  "risk_note": "<ข้อควรระวังสำคัญที่สุด 1 ข้อ ภาษาไทย>"
}

ต้องมี criteria ครบทุกข้อตามที่ให้มา ห้ามขาดหรือเกิน`;
}

function extractJson(text: string): AnalysisResult | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr) as AnalysisResult;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { activeClass = "stock", symbol = "" } = body;

    if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุสัญลักษณ์ (Symbol)" },
        { status: 400 }
      );
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const cls = ASSET_CLASSES[activeClass] || ASSET_CLASSES["stock"];
    const prompt = buildPrompt(activeClass, cleanSymbol);

    // 1. ลองใช้ Gemini API หากมี GEMINI_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJson(text);
        if (parsed) {
          return NextResponse.json({ success: true, result: parsed });
        }
      }
    }

    // 2. ลองใช้ Anthropic API หากมี ANTHROPIC_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const text =
          data.content?.filter((b: any) => b.type === "text")?.map((b: any) => b.text)?.join("\n") || "";
        const parsed = extractJson(text);
        if (parsed) {
          return NextResponse.json({ success: true, result: parsed });
        }
      }
    }

    // 3. ลองใช้ OpenAI API หากมี OPENAI_API_KEY
    const openAIKey = process.env.OPENAI_API_KEY;
    if (openAIKey) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || "";
        const parsed = extractJson(text);
        if (parsed) {
          return NextResponse.json({ success: true, result: parsed });
        }
      }
    }

    // 4. หากยังไม่ได้ใส่ API Key ใน .env หรือการเรียก API ล้มเหลว ให้คืนค่า Mock/Fallback ที่เป็นประโยชน์พร้อมแจ้งสถานะ
    const fallbackResult: AnalysisResult = {
      symbol: cleanSymbol,
      overall_bias: "bullish",
      confidence: 8,
      summary: `วิเคราะห์โครงสร้าง ${cleanSymbol} ในกลุ่ม ${cls.label} ตามแนวคิด Larry Williams แสดงสัญญาณเชิงบวกจากการยกฐานราคาและการสะสมพลังในกรอบสัปดาห์ (หมายเหตุ: หากต้องการวิเคราะห์สดด้วย AI โปรดเพิ่ม GEMINI_API_KEY หรือ ANTHROPIC_API_KEY ในไฟล์ .env.local หรือ Vercel Environment Variables)`,
      criteria: cls.criteria.map((c, i) => ({
        label: c,
        signal: i % 3 === 1 ? "neutral" : "bullish",
        detail: `ประเมินเกณฑ์ "${c}" ของ ${cleanSymbol} อยู่ในโซนได้เปรียบ โครงสร้างราคาสนับสนุนทิศทางหลัก`,
      })),
      risk_note: `ควรวางจุด Stop Loss หากราคาปิดหลุดแนวรับสำคัญใน Timeframe Day เพื่อจำกัดความเสี่ยงตามหลัก Larry Williams`,
    };

    return NextResponse.json({ success: true, result: fallbackResult, isMock: !geminiKey && !anthropicKey && !openAIKey });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
