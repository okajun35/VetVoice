/**
 * Parserコンポーネントのユニットテスト
 * Feature: vet-voice-medical-record
 * Task 3.2
 * 
 * 要件: 6.1, 6.2, 6.3
 */

import { describe, it, expect } from "vitest";
import { parse, stringify } from "../../amplify/data/handlers/parser";

describe("Parser: parse() function", () => {
  it("有効なExtracted_JSON文字列を正しくパースする", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 39.5 },
      s: "食欲不振",
      o: "第一胃蠕動音減弱",
      a: [{ name: "第四胃変位" }],
      p: [{ name: "ブドウ糖静注", type: "drug" }],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.vital.temp_c).toBe(39.5);
    expect(result.data?.s).toBe("食欲不振");
    expect(result.data?.o).toBe("第一胃蠕動音減弱");
    expect(result.data?.a).toHaveLength(1);
    expect(result.data?.a[0].name).toBe("第四胃変位");
    expect(result.data?.p).toHaveLength(1);
    expect(result.data?.p[0].name).toBe("ブドウ糖静注");
    expect(result.data?.p[0].type).toBe("drug");
  });

  it("nullフィールドを含む有効なJSONをパースする", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.vital.temp_c).toBeNull();
    expect(result.data?.s).toBeNull();
    expect(result.data?.o).toBeNull();
    expect(result.data?.a).toEqual([]);
    expect(result.data?.p).toEqual([]);
  });

  it("オプションフィールドを含む完全なJSONをパースする", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: "稟告内容",
      o: "所見内容",
      a: [
        {
          name: "乳房炎",
          canonical_name: "急性乳房炎",
          confidence: 0.95,
          master_code: "07-01",
          status: "confirmed",
        },
      ],
      p: [
        {
          name: "アンピシリン",
          canonical_name: "アンピシリン注射液",
          type: "drug",
          dosage: "500mg",
          confidence: 0.9,
          master_code: "S05-123",
          status: "confirmed",
        },
      ],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.a[0].confidence).toBe(0.95);
    expect(result.data?.a[0].canonical_name).toBe("急性乳房炎");
    expect(result.data?.a[0].master_code).toBe("07-01");
    expect(result.data?.a[0].status).toBe("confirmed");
    expect(result.data?.p[0].dosage).toBe("500mg");
    expect(result.data?.p[0].canonical_name).toBe("アンピシリン注射液");
    expect(result.data?.p[0].confidence).toBe(0.9);
    expect(result.data?.p[0].master_code).toBe("S05-123");
    expect(result.data?.p[0].status).toBe("confirmed");
  });

  it("無効なJSON文字列を拒否する", () => {
    const invalidJson = "{ invalid json }";

    const result = parse(invalidJson);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("必須フィールド(vital)が欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      s: "稟告",
      o: "所見",
      a: [],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("vital"))).toBe(true);
  });

  it("必須フィールド(s)が欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      o: "所見",
      a: [],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("s"))).toBe(true);
  });

  it("必須フィールド(o)が欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: "稟告",
      a: [],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("o"))).toBe(true);
  });

  it("必須フィールド(a)が欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: "稟告",
      o: "所見",
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("a"))).toBe(true);
  });

  it("必須フィールド(p)が欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: "稟告",
      o: "所見",
      a: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("p"))).toBe(true);
  });

  it("vital.temp_cが数値でもnullでもない場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: "invalid" },
      s: null,
      o: null,
      a: [],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("temp_c"))).toBe(true);
  });

  it("aの要素にnameが欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: null,
      o: null,
      a: [{ confidence: 0.9 }],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("name"))).toBe(true);
  });

  it("pの要素にnameが欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: null,
      o: null,
      a: [],
      p: [{ type: "drug" }],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("name"))).toBe(true);
  });

  it("pの要素にtypeが欠落している場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: null,
      o: null,
      a: [],
      p: [{ name: "処置名" }],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("type"))).toBe(true);
  });

  it("pのtypeが'procedure'または'drug'以外の場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: null,
      o: null,
      a: [],
      p: [{ name: "処置名", type: "invalid" }],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("type"))).toBe(true);
  });

  it("statusが'confirmed'または'unconfirmed'以外の場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: null,
      o: null,
      a: [{ name: "病名", status: "invalid" }],
      p: [],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("status"))).toBe(true);
  });

  it("canonical_nameが文字列以外の場合にエラーを返す", () => {
    const jsonString = JSON.stringify({
      vital: { temp_c: 38.5 },
      s: null,
      o: null,
      a: [{ name: "病名", canonical_name: 123 }],
      p: [{ name: "薬剤", type: "drug", canonical_name: { bad: true } }],
    });

    const result = parse(jsonString);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes("a[0].canonical_name"))).toBe(true);
    expect(result.errors!.some((e) => e.includes("p[0].canonical_name"))).toBe(true);
  });
});

describe("Parser: stringify() function", () => {
  it("Extracted_JSONオブジェクトを整形されたJSON文字列に変換する", () => {
    const data = {
      vital: { temp_c: 39.5 },
      s: "食欲不振",
      o: "第一胃蠕動音減弱",
      a: [{ name: "第四胃変位" }],
      p: [{ name: "ブドウ糖静注", type: "drug" as const }],
    };

    const result = stringify(data);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    
    // 再パースして元のデータと一致することを確認
    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
  });

  it("nullフィールドを含むオブジェクトを正しく文字列化する", () => {
    const data = {
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [],
      p: [],
    };

    const result = stringify(data);

    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
  });

  it("オプションフィールドを含む完全なオブジェクトを正しく文字列化する", () => {
    const data = {
      vital: { temp_c: 38.5 },
      s: "稟告内容",
      o: "所見内容",
      a: [
        {
          name: "乳房炎",
          confidence: 0.95,
          master_code: "07-01",
          status: "confirmed" as const,
        },
      ],
      p: [
        {
          name: "アンピシリン",
          type: "drug" as const,
          dosage: "500mg",
          confidence: 0.9,
          master_code: "S05-123",
          status: "confirmed" as const,
        },
      ],
    };

    const result = stringify(data);

    const parsed = JSON.parse(result);
    expect(parsed).toEqual(data);
  });
});

describe("Parser: ラウンドトリップ特性", () => {
  it("parse(stringify(obj)) は元のオブジェクトと等価", () => {
    const original = {
      vital: { temp_c: 39.5 },
      s: "食欲不振",
      o: "第一胃蠕動音減弱",
      a: [
        {
          name: "第四胃変位",
          confidence: 0.85,
          master_code: "04-30",
          status: "confirmed" as const,
        },
      ],
      p: [
        {
          name: "ブドウ糖静注",
          type: "drug" as const,
          dosage: "500ml",
          confidence: 0.9,
          master_code: "S05-100",
          status: "confirmed" as const,
        },
      ],
    };

    const stringified = stringify(original);
    const result = parse(stringified);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(original);
  });

  it("nullフィールドを含むオブジェクトでラウンドトリップが成立する", () => {
    const original = {
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [],
      p: [],
    };

    const stringified = stringify(original);
    const result = parse(stringified);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(original);
  });
});
