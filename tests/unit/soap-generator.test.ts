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
  it("returns soap_text from Bedrock response", async () => {
    const soapText =
      "S（稟告）: 食欲不振\nO（所見）: 体温39.5℃\nA（評価）: 第四胃変位\nP（計画）: ブドウ糖静注";
    const client = makeMockBedrock(soapText);

    const result = await generateSOAP(BASE_INPUT, client);

    expect(result.soap_text).toBe(soapText);
  });

  it("has_unconfirmed is false when all items are confirmed", async () => {
    const client = makeMockBedrock("SOAP text");
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
    const client = makeMockBedrock("SOAP text");
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
    const client = makeMockBedrock("SOAP text");
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

  it("Bedrock send() is called exactly once", async () => {
    const client = makeMockBedrock("SOAP text");

    await generateSOAP(BASE_INPUT, client);

    expect((client.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("soap_text is empty string when Bedrock returns no content", async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        output: { message: { content: [] } },
      }),
    } as unknown as BedrockRuntimeClient;

    const result = await generateSOAP(BASE_INPUT, client);

    expect(result.soap_text).toBe("");
  });

  it("calls Bedrock with reproduction-specific prompt content for reproduction_soap template", async () => {
    const client = makeMockBedrock("SOAP text");
    const input: SOAPInput = {
      extracted_json: makeJson({
        s: "妊娠鑑定実施",
        a: [{ name: "妊娠", status: "confirmed" }],
      }),
      template_type: "reproduction_soap",
    };

    await generateSOAP(input, client);

    const callArg = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const promptText: string = callArg.input.messages[0].content[0].text;
    // The extracted JSON should be embedded in the prompt
    expect(promptText).toContain("妊娠鑑定実施");
  });

  it("throws when Bedrock throws", async () => {
    const client = makeFailingBedrock(new Error("ServiceUnavailableException"));

    await expect(generateSOAP(BASE_INPUT, client)).rejects.toThrow(
      "ServiceUnavailableException",
    );
  });
});
