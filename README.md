# Larry Williams Analyzer

เครื่องมือวิเคราะห์การลงทุนตามกรอบแนวคิด Larry Williams ("เงื่อนไขสำคัญกว่ากราฟ") รองรับ 3 กลุ่มสินทรัพย์:

| กลุ่ม (asset class key) | ครอบคลุม | แหล่งข้อมูล |
|---|---|---|
| `equity` | หุ้น & ออปชั่น (AAPL, SPY, ...) | Yahoo Finance — ราคา + ข้อมูลพื้นฐาน |
| `crypto` | คริปโต (BTC, ETH, ...) | Yahoo Finance + CoinGecko + Fear & Greed |
| `macro` | ฟิวเจอร์ส & ฟอเร็กซ์ (Gold, EUR/USD, ...) | Yahoo Finance |

## สถาปัตยกรรม

- **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4**
- `app/page.tsx` — UI ทั้งหมด (client component): ค้นหาสัญลักษณ์แบบ autocomplete, ชาร์ต TradingView, แสดงผลวิเคราะห์, ประวัติการวิเคราะห์ (localStorage)
- `app/api/analyze/route.ts` — API หลังบ้าน:
  1. แปลงสัญลักษณ์เป็น Yahoo symbol (`toYahooSymbol`)
  2. ดึงราคาจริง 1 ปี + คำนวณ SMA5/10/20, RSI14, ATR10, Pivot Points, Volume Ratio, **เทรนด์รายสัปดาห์** (cache ในหน่วยความจำ 5 นาที)
  3. ดึงข้อมูลประกอบ: Fundamental (หุ้น — Yahoo v7 quote + crumb), Crypto โดยรวม (CoinGecko + Fear & Greed), **COT Report จริงจาก CFTC** (ฟิวเจอร์ส/ฟอเร็กซ์, cache 24 ชม.)
  4. ตรวจคุณภาพข้อมูล (`assessDataQuality`) — ธงเตือนเมื่อราคาขยับผิดปกติ/ข้อมูลไม่สอดคล้อง
  5. สร้าง prompt + เรียก AI แบบมี fallback **เฉพาะโมเดลฟรี** (Groq → Gemini)
  6. Self-check คำตอบ AI กับตัวเลขจริง + ตรวจ Action Plan (รูปทรง Entry/SL/TP, คำนวณ Risk:Reward) แล้วคืน JSON
- `lib/analysis.ts` — logic คำนวณ pure ทั้งหมด (symbol mapping, indicators, data quality, COT mapping, action plan validation) — **unit test ด้วย Vitest**: `npm test`

## การติดตั้ง

```bash
npm install
cp .env.example .env.local   # ใส่ API key อย่างน้อย 1 ตัว
npm run dev                  # http://localhost:3000
```

## API Keys

ใช้เฉพาะโมเดลฟรี — ระบบลองตามลำดับ Groq (แนะนำ ฟรี+เร็ว) → Gemini (free tier, gemini-2.5-flash) — ดูรายละเอียดใน `.env.example`

## Deploy (Vercel)

ตั้งค่า environment variables ให้ครบใน Vercel dashboard (อย่างน้อย `GROQ_API_KEY`) แล้ว deploy ตามปกติ โปรเจคตั้ง `maxDuration = 60` ไว้ที่ route เพราะต้องดึงข้อมูลตลาดแล้วเรียก AI

## ข้อจำกัด

- ข้อมูล Yahoo Finance อาจล่าช้า 15–20 นาที และ endpoint ข้อมูลพื้นฐาน (quoteSummary) อาจถูกจำกัดโดยไม่มี crumb — ระบบจะทำงานต่อแบบไม่มีข้อมูลพื้นฐานอัตโนมัติ
- ใช้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
