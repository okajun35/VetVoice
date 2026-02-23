/**
 * Extractor component unit tests
 * Feature: vet-voice-medical-record
 * Task 10.2
 *
 * Requirements: 5.1, 5.2
 */

import { describe, it, expect, vi } from "vitest";
import { extract } from "../../amplify/data/handlers/extractor";
import type { ExtractorInput } from "../../amplify/data/handlers/extractor";
import type { ExtractedJSON } from "../../amplify/data/handlers/parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBedrockClient(responseText: string) {
  return {
    send: vi.fn().mockResolvedValue({
      output: {
        message: {
          content: [{ text: responseText }],
        },
      },
    }),
  };
}

function makeFailingBedrockClient(error: Error = new Error("Bedrock error")) {
  return {
    send: vi.fn().mockRejectedValue(error),
  };
}

const EMPTY_EXTRACTED_JSON: ExtractedJSON = {
  vital: { temp_c: null },
  s: null,
  o: null,
  a: [],
  p: [],
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("Extractor: happy path", () => {
  it("returns correct ExtractedJSON from a valid Bedrock response", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: 39.5 },
      s: "昨日から食欲がない",
      o: "体温39.5度、第一胃蠕動音減弱",
      a: [{ name: "第四胃変位" }],
      p: [
        { name: "ブドウ糖静注", type: "drug", dosage: "500ml" },
        { name: "右方変位整復術", type: "procedure" },
      ],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    const result = await extract(
      { expanded_text: "体温39.5度、食欲不振、第四胃変位疑い" },
      client as any,
    );

    expect(result.vital.temp_c).toBe(39.5);
    expect(result.s).toBe("昨日から食欲がない");
    expect(result.o).toBe("体温39.5度、第一胃蠕動音減弱");
    expect(result.a).toHaveLength(1);
    expect(result.a[0].name).toBe("第四胃変位");
    expect(result.p).toHaveLength(2);
  });

  it("extracts temperature correctly", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: 40.2 },
      s: null,
      o: null,
      a: [],
      p: [],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    const result = await extract({ expanded_text: "体温40.2度" }, client as any);

    expect(result.vital.temp_c).toBe(40.2);
  });

  it("extracts subjective (s) and objective (o) fields correctly", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: null },
      s: "3日前から乳量が減少",
      o: "乳房硬結あり、発熱なし",
      a: [],
      p: [],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    const result = await extract({ expanded_text: "乳房炎の疑い" }, client as any);

    expect(result.s).toBe("3日前から乳量が減少");
    expect(result.o).toBe("乳房硬結あり、発熱なし");
  });

  it("extracts disease names (a field) correctly", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [{ name: "乳房炎" }, { name: "ケトーシス疑い" }],
      p: [],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    const result = await extract({ expanded_text: "乳房炎、ケトーシス疑い" }, client as any);

    expect(result.a).toHaveLength(2);
    expect(result.a[0].name).toBe("乳房炎");
    expect(result.a[1].name).toBe("ケトーシス疑い");
  });

  it("extracts procedures and drugs (p field) correctly", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [],
      p: [
        { name: "アンピシリン", type: "drug", dosage: "1g 筋肉注射" },
        { name: "直腸検査", type: "procedure" },
      ],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    const result = await extract(
      { expanded_text: "アンピシリン投与、直腸検査実施" },
      client as any,
    );

    expect(result.p).toHaveLength(2);
    expect(result.p[0].name).toBe("アンピシリン");
    expect(result.p[0].type).toBe("drug");
    expect(result.p[0].dosage).toBe("1g 筋肉注射");
    expect(result.p[1].name).toBe("直腸検査");
    expect(result.p[1].type).toBe("procedure");
  });

  it("strips markdown code fences from Bedrock response", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: 38.9 },
      s: null,
      o: null,
      a: [],
      p: [],
    };

    const wrapped = "```json\n" + JSON.stringify(mockJson) + "\n```";
    const client = makeBedrockClient(wrapped);
    const result = await extract({ expanded_text: "体温38.9度" }, client as any);

    expect(result.vital.temp_c).toBe(38.9);
  });

  it("includes template_type hint in the prompt when provided", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [],
      p: [],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    const input: ExtractorInput = {
      expanded_text: "妊娠鑑定実施",
      template_type: "reproduction_soap",
    };

    await extract(input, client as any);

    const callArg = client.send.mock.calls[0][0];
    const promptText: string = callArg.input.messages[0].content[0].text;
    expect(promptText).toContain("reproduction_soap");
  });

  it("calls ConverseCommand with correct modelId and user message", async () => {
    const mockJson: ExtractedJSON = {
      vital: { temp_c: null },
      s: null,
      o: null,
      a: [],
      p: [],
    };

    const client = makeBedrockClient(JSON.stringify(mockJson));
    await extract({ expanded_text: "test" }, client as any);

    expect(client.send).toHaveBeenCalledTimes(1);
    const callArg = client.send.mock.calls[0][0];
    expect(callArg.input.modelId).toBe("amazon.nova-pro-v1:0");
    expect(callArg.input.messages[0].role).toBe("user");
    expect(callArg.input.messages[0].content[0].text).toContain("獣医診療テキスト");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("Extractor: error handling", () => {
  it("returns empty ExtractedJSON when Bedrock throws an error", async () => {
    const client = makeFailingBedrockClient(new Error("ThrottlingException"));
    const result = await extract({ expanded_text: "test" }, client as any);

    expect(result).toEqual(EMPTY_EXTRACTED_JSON);
  });

  it("returns empty ExtractedJSON when Bedrock response is invalid JSON", async () => {
    const client = makeBedrockClient("This is not JSON at all");
    const result = await extract({ expanded_text: "test" }, client as any);

    expect(result).toEqual(EMPTY_EXTRACTED_JSON);
  });

  it("returns empty ExtractedJSON when response fails schema validation", async () => {
    // Missing required fields (s, o, a, p)
    const client = makeBedrockClient(JSON.stringify({ vital: { temp_c: 39.0 } }));
    const result = await extract({ expanded_text: "test" }, client as any);

    expect(result).toEqual(EMPTY_EXTRACTED_JSON);
  });

  it("returns empty ExtractedJSON when response content array is empty", async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        output: { message: { content: [] } },
      }),
    };
    const result = await extract({ expanded_text: "test" }, client as any);

    expect(result).toEqual(EMPTY_EXTRACTED_JSON);
  });

  it("never throws — always resolves with a valid ExtractedJSON shape", async () => {
    const client = makeFailingBedrockClient(new Error("ServiceUnavailableException"));

    await expect(extract({ expanded_text: "test" }, client as any)).resolves.toMatchObject({
      vital: expect.objectContaining({ temp_c: null }),
      a: expect.any(Array),
      p: expect.any(Array),
    });
  });
});
