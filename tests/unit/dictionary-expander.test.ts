/**
 * Dictionary_Expander component unit tests
 * Feature: vet-voice-medical-record
 * Task 4.3
 * 
 * Requirements: 4.2, 4.4
 */

import { describe, it, expect, beforeEach } from "vitest";
import { expand, resetDictionaryCache } from "../../amplify/data/handlers/dictionary-expander";

describe("Dictionary_Expander: expand() function", () => {
  beforeEach(() => {
    // Reset cache before each test to ensure fresh dictionary load
    resetDictionaryCache();
  });

  it("expands '静注' to '静脈注射'", () => {
    const text = "体温39.5度、静注を実施";

    const result = expand(text);

    expect(result.expanded_text).toContain("静脈注射");
    expect(result.expanded_text).not.toContain("静注");
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe("静注");
    expect(result.expansions[0].expanded).toBe("静脈注射");
  });

  it("expands 'アンピ' to 'アンピシリン'", () => {
    const text = "アンピ500mgを投与";

    const result = expand(text);

    expect(result.expanded_text).toContain("アンピシリン");
    // Note: "アンピシリン" contains "アンピ" as substring, so we check the full result
    expect(result.expanded_text).toBe("アンピシリン500mgを投与");
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe("アンピ");
    expect(result.expansions[0].expanded).toBe("アンピシリン");
  });

  it("expands '筋注' to '筋肉注射'", () => {
    const text = "筋注で投与しました";

    const result = expand(text);

    expect(result.expanded_text).toContain("筋肉注射");
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe("筋注");
    expect(result.expansions[0].expanded).toBe("筋肉注射");
  });

  it("expands 'IV' to '静脈注射' (English abbreviation)", () => {
    const text = "IVで投与";

    const result = expand(text);

    expect(result.expanded_text).toContain("静脈注射");
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe("IV");
    expect(result.expansions[0].expanded).toBe("静脈注射");
  });

  it("expands multiple abbreviations simultaneously", () => {
    const text = "静注でアンピを投与、筋注も実施";

    const result = expand(text);

    expect(result.expanded_text).toContain("静脈注射");
    expect(result.expanded_text).toContain("アンピシリン");
    expect(result.expanded_text).toContain("筋肉注射");
    expect(result.expansions.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves words not in dictionary", () => {
    const text = "未知の用語を含むテキスト";

    const result = expand(text);

    expect(result.expanded_text).toBe(text);
    expect(result.expansions).toHaveLength(0);
  });

  it("correctly processes text with mixed abbreviations and normal words", () => {
    const text = "体温39.5度、食欲不振あり。静注でアンピを投与しました。";

    const result = expand(text);

    expect(result.expanded_text).toContain("体温39.5度");
    expect(result.expanded_text).toContain("食欲不振あり");
    expect(result.expanded_text).toContain("静脈注射");
    expect(result.expanded_text).toContain("アンピシリン");
    expect(result.expanded_text).toContain("投与しました");
  });

  it("returns empty string for empty input", () => {
    const text = "";

    const result = expand(text);

    expect(result.expanded_text).toBe("");
    expect(result.expansions).toHaveLength(0);
  });

  it("correctly expands text containing only abbreviation", () => {
    const text = "静注";

    const result = expand(text);

    expect(result.expanded_text).toBe("静脈注射");
    expect(result.expansions).toHaveLength(1);
  });

  it("expands all occurrences when same abbreviation appears multiple times", () => {
    const text = "静注を実施、再度 静注を実施";

    const result = expand(text);

    expect(result.expanded_text).toBe("静脈注射を実施、再度 静脈注射を実施");
    expect(result.expansions.length).toBeGreaterThanOrEqual(2);
  });

  it("matches whole words only, not partial matches", () => {
    const text = "静注射という用語";

    const result = expand(text);

    // Should not expand '静注' when it's part of '静注射'
    expect(result.expanded_text).toBe(text);
    expect(result.expansions).toHaveLength(0);
  });

  it("position field indicates correct location in original text", () => {
    const text = "体温39.5度、静注を実施";

    const result = expand(text);

    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].position).toBeGreaterThan(0);
    // Verify position matches the location of '静注' in original text
    expect(text.indexOf("静注")).toBe(result.expansions[0].position);
  });

  it("expands 'BT' to '体温'", () => {
    const text = "BT 39.5度";

    const result = expand(text);

    expect(result.expanded_text).toContain("体温");
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe("BT");
    expect(result.expansions[0].expanded).toBe("体温");
  });

  it("expands 'AI' to '人工授精'", () => {
    const text = "AIを実施しました";

    const result = expand(text);

    expect(result.expanded_text).toContain("人工授精");
    expect(result.expansions).toHaveLength(1);
    expect(result.expansions[0].original).toBe("AI");
    expect(result.expansions[0].expanded).toBe("人工授精");
  });
});

