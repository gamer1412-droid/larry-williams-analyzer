import { describe, it, expect } from "vitest";
import {
  toYahooSymbol,
  calcSMA,
  calcRSI,
  calcATR,
  calcPivotPoints,
  calcWeeklyTrend,
  qualityClassFor,
  cotCodeFor,
  assessDataQuality,
  parseActionPlan,
  validateActionPlan,
  type MarketData,
} from "./analysis";

describe("toYahooSymbol", () => {
  it("crypto: รองรับทุกรูปแบบที่พิมพ์ได้", () => {
    expect(toYahooSymbol("crypto", "BTC")).toBe("BTC-USD");
    expect(toYahooSymbol("crypto", "BTC-USD")).toBe("BTC-USD");
    expect(toYahooSymbol("crypto", "BTCUSD")).toBe("BTC-USD");
    expect(toYahooSymbol("crypto", "BTCUSDT")).toBe("BTC-USD");
    expect(toYahooSymbol("crypto", "eth")).toBe("ETH-USD");
    expect(toYahooSymbol("crypto", "BTC.BK")).toBe("BTC.BK"); // ETF ไทย
  });

  it("equity: แปลงเป็นตัวพิมพ์ใหญ่", () => {
    expect(toYahooSymbol("equity", "aapl")).toBe("AAPL");
  });

  it("macro: ชื่อฟิวเจอร์ส → Yahoo symbol", () => {
    expect(toYahooSymbol("macro", "Gold")).toBe("GC=F");
    expect(toYahooSymbol("macro", "gold")).toBe("GC=F");
    expect(toYahooSymbol("macro", "S&P 500")).toBe("ES=F");
    expect(toYahooSymbol("macro", "EUR/USD")).toBe("EURUSD=X");
    expect(toYahooSymbol("macro", "CL=F")).toBe("CL=F"); // พิมพ์ตรงผ่านไปเลย
    expect(toYahooSymbol("macro", "อะไรก็ได้")).toBe("อะไรก็ได้=F"); // ไม่รู้จัก → เดาเป็นฟิวเจอร์ส
  });
});

describe("indicators", () => {
  it("calcSMA", () => {
    expect(calcSMA([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(calcSMA([1, 2], 5)).toBeNull(); // ข้อมูลไม่พอ
  });

  it("calcRSI: ขาขึ้นล้วน → 100, ขาลงล้วน → 0", () => {
    expect(calcRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(100);
    expect(calcRSI([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])).toBe(0);
    expect(calcRSI([1, 2])).toBeNull();
  });

  it("calcATR: TR สูงสุดจาก high-low / gap", () => {
    // 3 แท่ง: high [11,12], low [9,10], close [10,11] → TR แต่ละแท่ง = 2 → ATR2 = 2
    expect(calcATR([11, 12], [9, 10], [10, 11], 1)).toBe(2);
    expect(calcATR([11], [9], [10], 1)).toBeNull();
  });

  it("calcPivotPoints", () => {
    const p = calcPivotPoints(110, 100, 105);
    expect(p.pp).toBe(105);
    expect(p.r1).toBe(110);
    expect(p.s1).toBe(100);
  });

  it("calcWeeklyTrend: รวมรายวันเป็นรายสัปดาห์ ใช้ปิดท้ายสัปดาห์", () => {
    // วันจันทร์-ศุกร์ของ 2 สัปดาห์ (epoch วันจันทร์ 2026-10-19 00:00 UTC = 1792368000)
    const monday = 1792368000;
    const day = 86400;
    const bars = [
      { c: 100, t: monday + 0 * day },
      { c: 102, t: monday + 1 * day },
      { c: 105, t: monday + 4 * day }, // ปิดสัปดาห์ 1 = 105
      { c: 110, t: monday + 7 * day },
      { c: 115, t: monday + 11 * day }, // ปิดสัปดาห์ 2 = 115
    ];
    const wk = calcWeeklyTrend(bars);
    expect(wk.closes).toEqual([105, 115]);
    expect(wk.changePct).toBe(9.52); // (115-105)/105
    expect(wk.sma10).toBeNull(); // น้อยกว่า 10 สัปดาห์
    expect(wk.aboveSma10).toBeNull();
  });

  it("calcWeeklyTrend: sma10 เมื่อข้อมูลพอ", () => {
    const monday = 1792368000;
    const week = 7 * 86400;
    const bars: { c: number; t: number }[] = [];
    for (let i = 0; i < 10; i++) bars.push({ c: 100 + i, t: monday + i * week });
    const wk = calcWeeklyTrend(bars);
    expect(wk.sma10).toBe(104.5); // เฉลี่ย 100..109
    expect(wk.aboveSma10).toBe(true); // ปิดล่าสุด 109 > 104.5
  });
});

describe("qualityClassFor", () => {
  it("macro แยก forex/futures ตามสัญลักษณ์ Yahoo", () => {
    expect(qualityClassFor("macro", "EURUSD=X")).toBe("forex");
    expect(qualityClassFor("macro", "GC=F")).toBe("futures");
    expect(qualityClassFor("equity", "AAPL")).toBe("equity");
  });
});

describe("cotCodeFor", () => {
  it("ฟิวเจอร์สหลักมีรหัส COT", () => {
    expect(cotCodeFor("macro", "Gold")).toBe("088691");
    expect(cotCodeFor("macro", "S&P 500")).toBe("13874A");
    expect(cotCodeFor("macro", "Brent")).toBeNull(); // ไม่มีรายงาน
  });

  it("ฟอเร็กซ์ ใช้สกุลที่มี futures (USD ใช้ตัวหลัง)", () => {
    expect(cotCodeFor("macro", "EUR/USD")).toBe("099741");
    expect(cotCodeFor("macro", "USD/JPY")).toBe("097741");
    expect(cotCodeFor("macro", "USD/THB")).toBeNull();
  });

  it("asset class อื่นไม่มี COT", () => {
    expect(cotCodeFor("crypto", "BTC")).toBeNull();
    expect(cotCodeFor("equity", "AAPL")).toBeNull();
  });
});

function makeMarketData(overrides: Partial<MarketData>): MarketData {
  return {
    symbol: "TEST", name: "Test", currentPrice: 100, previousClose: 100,
    change: 0, changePercent: 0, dayHigh: 101, dayLow: 99,
    fiftyTwoWeekHigh: 120, fiftyTwoWeekLow: 80, volume: 1000, currency: "USD",
    recentCloses: [100, 100], recentHighs: [101, 101], recentLows: [99, 99],
    recentVolumes: [1000, 1000],
    weekly: { changePct: null, sma10: null, aboveSma10: null, closes: [] },
    fetchedAt: "2026-10-31T00:00:00Z",
    sma5: null, sma10: null, sma20: null, rsi14: null, atr10: null,
    pivotPoints: null, volumeRatio: null, pctFrom52wHigh: 0, pctFrom52wLow: 0,
    ...overrides,
  };
}

describe("assessDataQuality", () => {
  it("ขยับเกินเกณฑ์ของสินทรัพย์ → flag", () => {
    // ฟอเร็กซ์ เกณฑ์ 3% — ขยับ 4% ต้อง flag / หุ้นเกณฑ์ 15% ต้องไม่ flag
    const fx = makeMarketData({ changePercent: 4 });
    expect(assessDataQuality(fx, "forex").isAbnormal).toBe(true);
    expect(assessDataQuality(fx, "equity").isAbnormal).toBe(false);
  });

  it("ราคาอยู่นอกกรอบ High/Low ของวัน → flag", () => {
    const md = makeMarketData({ currentPrice: 110, dayHigh: 101, dayLow: 99 });
    const q = assessDataQuality(md, "equity");
    expect(q.isAbnormal).toBe(true);
    expect(q.flags[0]).toContain("นอกกรอบ High/Low");
  });

  it("ขยับเกิน 4× ATR10 → flag", () => {
    const md = makeMarketData({ change: 8, atr10: 1.5 });
    const q = assessDataQuality(md, "equity");
    expect(q.flags.some((f) => f.includes("ATR10"))).toBe(true);
  });

  it("ข้อมูลปกติ → ไม่มี flag", () => {
    const md = makeMarketData({ changePercent: 1, change: 1, atr10: 2 });
    expect(assessDataQuality(md, "equity").isAbnormal).toBe(false);
  });
});

describe("parseActionPlan / validateActionPlan", () => {
  it("parse ช่วงราคา + ข้ามตัวเลข %", () => {
    const p = parseActionPlan({
      recommendation: "BUY",
      entry_zone: "205-208 USD",
      stop_loss: "198 USD (-4.5%)",
      take_profit_1: "220 USD (+6.3%)",
    });
    expect(p.entryLow).toBe(205);
    expect(p.entryHigh).toBe(208);
    expect(p.entry).toBe(206.5);
    expect(p.stop).toBe(198);
    expect(p.tp1).toBe(220);
  });

  it("parse เลขมี comma", () => {
    const p = parseActionPlan({ recommendation: "SELL", entry_zone: "76,500 - 77,000 USD", stop_loss: "79,500" });
    expect(p.entry).toBe(76750);
    expect(p.stop).toBe(79500);
  });

  it("BUY ที่ SL อยู่เหนือ entry → warning + ไม่คำนวณ R:R", () => {
    const v = validateActionPlan({ recommendation: "BUY", entry_zone: "100", stop_loss: "105", take_profit_1: "110" });
    expect(v.warnings.length).toBeGreaterThan(0);
    expect(v.warnings[0]).toContain("Stop Loss");
    expect(v.rr).toBeNull();
  });

  it("BUY ปกติ → R:R ถูกต้อง", () => {
    const v = validateActionPlan({ recommendation: "BUY", entry_zone: "100", stop_loss: "95", take_profit_1: "115" });
    expect(v.warnings).toHaveLength(0);
    expect(v.rr).toBe(3); // reward 15 / risk 5
  });

  it("SELL ปกติ → R:R ถูกต้อง (SL สูงกว่า entry, TP ต่ำกว่า)", () => {
    const v = validateActionPlan({ recommendation: "SELL", entry_zone: "100", stop_loss: "105", take_profit_1: "90" });
    expect(v.warnings).toHaveLength(0);
    expect(v.rr).toBe(2); // reward 10 / risk 5
  });

  it("SELL ที่ TP สูงกว่า entry → warning", () => {
    const v = validateActionPlan({ recommendation: "SELL", entry_zone: "100", stop_loss: "105", take_profit_1: "110" });
    expect(v.warnings.some((w) => w.includes("Take Profit"))).toBe(true);
  });

  it("HOLD/WAIT ไม่ตรวจรูปทรง (ไม่มี SL ก็ไม่เตือน)", () => {
    const v = validateActionPlan({ recommendation: "WAIT" });
    expect(v.warnings).toHaveLength(0);
    expect(v.rr).toBeNull();
  });
});
