/**
 * SOAP_Generator component unit tests
 * Feature: vet-voice-medical-record
 * Task 12.2
 *
 * Requirements: 8.1, 8.3
 */

import { describe, it, expect, vi } from "vitest";
import { generateSOAP } from "../../amplify/data/handlers/soap-generator";
import type { SOAPInput } from "../../amplify/data/handlers/soap-generator";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockBedrock(responseText: string) {
  return {
    send: vi.fn().mockResolvedValue({
      output: {
        message: {
          content: [{ text: responseText }],
        },
      },
    }),
  } as unknown as BedrockRuntimeClient;
}

function makeMockBedrockSequence(responseTexts: string[]) {
  const send = vi.fn();
  for (const text of responseTexts) {
    send.mockResolvedValueOnce({
      output: {
        message: {
          content: [{ text }],
        },
      },
    });
  }
  return { send } as unknown as BedrockRuntimeClient;
}

function makeFailingBedrock(error: Error = new Error("Bedrock error")) {
  return {
    send: vi.fn().mockRejectedValue(error),
  } as unknown as BedrockRuntimeClient;
}

function makeJson(overrides: Partial<ExtractedJSON> = {}): ExtractedJSON {
  return {
    vital: { temp_c: 39.5 },
    s: "食欲不振",
    o: "体温39.5℃、第一胃蠕動音減弱",
    a: [{ name: "第四胃変位", status: "confirmed" as const }],
    p: [{ name: "ブドウ糖静注500ml", type: "drug" as const }],
    ...overrides,
  };
}

const BASE_INPUT: SOAPInput = {
  extracted_json: makeJson(),
  template_type: "general_soap",
};

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe("SOAP_Generator: generateSOAP", () => {
  it("returns normalized SOAP text when response is valid", async () => {
    const soapText = [
      "S（稟告）: 食欲不振",
      "O（所見）: 体温39.5℃",
      "A（評価・診断）: 第四胃変位",
      "P（計画・処置）: ブドウ糖静注500ml",
    ].join("\n");
    const client = makeMockBedrock(soapText);

    const result = await generateSOAP(BASE_INPUT, client);

    expect(result.soap_text).toBe(soapText);
  });

  it("has_unconfirmed is false when all items are confirmed", async () => {
    const client = makeMockBedrock(
      [
        "S（稟告）: 食欲不振",
        "O（所見）: 体温39.5℃",
        "A（評価・診断）: 第四胃変位",
        "P（計画・処置）: ブドウ糖静注500ml",
      ].join("\n"),
    );
    const input: SOAPInput = {
      extracted_json: makeJson({
        a: [{ name: "第四胃変位", status: "confirmed" }],
        p: [{ name: "ブドウ糖静注500ml", type: "drug", status: "confirmed" }],
      }),
      template_type: "general_soap",
    };

    const result = await generateSOAP(input, client);

    expect(result.has_unconfirmed).toBe(false);
  });

  it("has_unconfirmed is true when a[] has unconfirmed item", async () => {
    const client = makeMockBedrock(
      [
        "S（稟告）: 食欲不振",
        "O（所見）: 体温39.5℃",
        "A（評価・診断）: 第四胃変位（未確認）",
        "P（計画・処置）: ブドウ糖静注500ml",
      ].join("\n"),
    );
    const input: SOAPInput = {
      extracted_json: makeJson({
        a: [{ name: "第四胃変位疑い", status: "unconfirmed" }],
        p: [{ name: "ブドウ糖静注500ml", type: "drug", status: "confirmed" }],
      }),
      template_type: "general_soap",
    };

    const result = await generateSOAP(input, client);

    expect(result.has_unconfirmed).toBe(true);
  });

  it("has_unconfirmed is true when p[] has unconfirmed item", async () => {
    const client = makeMockBedrock(
      [
        "S（稟告）: 食欲不振",
        "O（所見）: 体温39.5℃",
        "A（評価・診断）: 第四胃変位",
        "P（計画・処置）: 未知の処置（未確認）",
      ].join("\n"),
    );
    const input: SOAPInput = {
      extracted_json: makeJson({
        a: [{ name: "第四胃変位", status: "confirmed" }],
        p: [{ name: "未知の処置", type: "procedure", status: "unconfirmed" }],
      }),
      template_type: "general_soap",
    };

    const result = await generateSOAP(input, client);

    expect(result.has_unconfirmed).toBe(true);
  });

  it("removes preamble/footer meta text and keeps SOAP body only", async () => {
    const client = makeMockBedrock(
      [
        "SOAP形式の診療記録は以下の通りです：",
        "",
        "S（稟告）: 食欲不振",
        "O（所見）: 体温39.5℃",
        "A（評価・診断）: 第四胃変位",
        "P（計画・処置）: ブドウ糖静注500ml",
        "",
        "この診療記録は、提供された構造化データに基づいて生成されています。",
      ].join("\n"),
    );

    const result = await generateSOAP(BASE_INPUT, client);

    expect(result.soap_text).not.toContain("SOAP形式の診療記録は以下の通り");
    expect(result.soap_text).not.toContain("提供された構造化データに基づいて");
    expect(result.soap_text).toContain("S（稟告）:");
    expect(result.soap_text).toContain("P（計画・処置）:");
  });

  it("retries once and falls back safely when plan hallucination persists", async () => {
    const client = makeMockBedrockSequence([
      [
        "S（稟告）: 特記事項なし",
        "O（所見）: 外子宮口正常",
        "A（評価・診断）: 異常なし",
        "P（計画・処置）: 超音波検査を提案",
      ].join("\n"),
      [
        "S（稟告）: 特記事項なし",
        "O（所見）: 外子宮口正常",
        "A（評価・診断）: 異常なし",
        "P（計画・処置）: ホルモン検査を提案",
      ].join("\n"),
    ]);
    const input: SOAPInput = {
      extracted_json: makeJson({
        s: null,
        o: "外子宮口正常",
        a: [],
        p: [],
      }),
      template_type: "reproduction_soap",
    };

    const result = await generateSOAP(input, client);

    expect((client.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect(result.soap_text).toContain("P（計画・処置）: 処置なし");
  });

  it("Bedrock send() is called exactly once for valid output", async () => {
    const client = makeMockBedrock(
      [
        "S（稟告）: 食欲不振",
        "O（所見）: 体温39.5℃",
        "A（評価・診断）: 第四胃変位",
        "P（計画・処置）: ブドウ糖静注500ml",
      ].join("\n"),
    );

    await generateSOAP(BASE_INPUT, client);

    expect((client.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("falls back to deterministic SOAP when Bedrock returns empty content twice", async () => {
    const client = makeMockBedrockSequence(["", ""]);

    const result = await generateSOAP(BASE_INPUT, client);

    expect(result.soap_text).toContain("S（稟告）: 食欲不振");
    expect(result.soap_text).toContain("O（所見）: 体温39.5℃、第一胃蠕動音減弱");
    expect(result.soap_text).toContain("P（計画・処置）: ブドウ糖静注500ml");
  });

  it("calls Bedrock with reproduction-specific prompt content and system instruction", async () => {
    const client = makeMockBedrock(
      [
        "S（稟告）: 妊娠鑑定実施",
        "O（所見）: 異常なし",
        "A（評価・診断）: 妊娠（疑い）",
        "P（計画・処置）: 処置なし",
      ].join("\n"),
    );
    const input: SOAPInput = {
      extracted_json: makeJson({
        s: "妊娠鑑定実施",
        a: [{ name: "妊娠", status: "unconfirmed" }],
        p: [],
      }),
      template_type: "reproduction_soap",
    };

    await generateSOAP(input, client);

    const callArg = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const promptText: string = callArg.input.messages[0].content[0].text;
    const systemText: string = callArg.input.system[0].text;
    expect(promptText).toContain("妊娠鑑定実施");
    expect(promptText).toContain("厳守ルール");
    expect(systemText).toContain("出力は必ずSOAP本文のみ");
  });

  it("throws when Bedrock throws", async () => {
    const client = makeFailingBedrock(new Error("ServiceUnavailableException"));

    await expect(generateSOAP(BASE_INPUT, client)).rejects.toThrow(
      "ServiceUnavailableException",
    );
  });
});
