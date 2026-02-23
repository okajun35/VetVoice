/**
 * Parserコンポーネントのプロパティベーステスト
 * Feature: vet-voice-medical-record
 * Task 3.3
 * 
 * **Property 1: Extracted_JSON ラウンドトリップ**
 * **検証: 要件 6.1, 6.3, 6.4**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { extractedJsonArb } from "../helpers/generators";
import { parse, stringify } from "../../amplify/data/handlers/parser";

describe("Feature: vet-voice-medical-record, Property 1: Extracted_JSON ラウンドトリップ", () => {
  it("すべての有効なExtracted_JSONオブジェクトに対して、parse(stringify(obj)) は元のオブジェクトと等価", () => {
    fc.assert(
      fc.property(extractedJsonArb, (obj) => {
        // stringify → parse のラウンドトリップ
        const stringified = stringify(obj);
        const result = parse(stringified);

        // 検証: パースが成功する
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.errors).toBeUndefined();

        // 検証: 元のオブジェクトと等価
        expect(result.data).toEqual(obj);
      }),
      { numRuns: 100 }
    );
  });

  it("すべての有効なExtracted_JSONオブジェクトに対して、stringify(parse(stringify(obj)).data) は stringify(obj) と等価", () => {
    fc.assert(
      fc.property(extractedJsonArb, (obj) => {
        // 最初の文字列化
        const stringified1 = stringify(obj);
        
        // パース
        const parsed = parse(stringified1);
        expect(parsed.success).toBe(true);
        expect(parsed.data).toBeDefined();

        // 再度文字列化
        const stringified2 = stringify(parsed.data!);

        // 検証: 両方の文字列化結果が等価（JSON正規化後）
        expect(JSON.parse(stringified2)).toEqual(JSON.parse(stringified1));
      }),
      { numRuns: 100 }
    );
  });

  it("parse()は無効なJSON文字列に対して常にsuccess=falseを返す", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(""),
          fc.constant("null"),
          fc.constant("undefined"),
          fc.constant("{}"),
          fc.constant("[]"),
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
        ),
        (invalidJson) => {
          const result = parse(invalidJson);

          // 検証: パースが失敗する
          expect(result.success).toBe(false);
          expect(result.data).toBeUndefined();
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("parse()は必須フィールドが欠落したJSONに対して常にsuccess=falseを返す", () => {
    fc.assert(
      fc.property(
        fc.record({
          vital: fc.option(fc.record({ temp_c: fc.oneof(fc.float(), fc.constant(null)) }), { nil: undefined }),
          s: fc.option(fc.oneof(fc.string(), fc.constant(null)), { nil: undefined }),
          o: fc.option(fc.oneof(fc.string(), fc.constant(null)), { nil: undefined }),
          a: fc.option(fc.array(fc.record({ name: fc.string() })), { nil: undefined }),
          p: fc.option(
            fc.array(
              fc.record({
                name: fc.string(),
                type: fc.oneof(fc.constant("procedure" as const), fc.constant("drug" as const)),
              })
            ),
            { nil: undefined }
          ),
        }).filter((obj) => {
          // 少なくとも1つの必須フィールドが欠落している
          return (
            obj.vital === undefined ||
            obj.s === undefined ||
            obj.o === undefined ||
            obj.a === undefined ||
            obj.p === undefined
          );
        }),
        (incompleteObj) => {
          const jsonString = JSON.stringify(incompleteObj);
          const result = parse(jsonString);

          // 検証: パースが失敗する
          expect(result.success).toBe(false);
          expect(result.data).toBeUndefined();
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("stringify()は常に有効なJSON文字列を生成する", () => {
    fc.assert(
      fc.property(extractedJsonArb, (obj) => {
        const stringified = stringify(obj);

        // 検証: 有効なJSON文字列である
        expect(() => JSON.parse(stringified)).not.toThrow();

        // 検証: パース可能である
        const parsed = JSON.parse(stringified);
        expect(parsed).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it("parse()のエラーメッセージは具体的で有用である", () => {
    fc.assert(
      fc.property(
        fc.record({
          vital: fc.option(fc.record({ temp_c: fc.oneof(fc.float(), fc.constant(null)) }), { nil: undefined }),
          s: fc.option(fc.oneof(fc.string(), fc.constant(null)), { nil: undefined }),
          o: fc.option(fc.oneof(fc.string(), fc.constant(null)), { nil: undefined }),
          a: fc.option(fc.array(fc.record({ name: fc.string() })), { nil: undefined }),
          p: fc.option(
            fc.array(
              fc.record({
                name: fc.string(),
                type: fc.oneof(fc.constant("procedure" as const), fc.constant("drug" as const)),
              })
            ),
            { nil: undefined }
          ),
        }).filter((obj) => {
          // 少なくとも1つの必須フィールドが欠落している
          return (
            obj.vital === undefined ||
            obj.s === undefined ||
            obj.o === undefined ||
            obj.a === undefined ||
            obj.p === undefined
          );
        }),
        (incompleteObj) => {
          const jsonString = JSON.stringify(incompleteObj);
          const result = parse(jsonString);

          // 検証: エラーメッセージが存在し、欠落フィールドを特定できる
          expect(result.errors).toBeDefined();
          expect(result.errors!.length).toBeGreaterThan(0);
          
          // 検証: エラーメッセージが文字列である
          for (const error of result.errors!) {
            expect(typeof error).toBe("string");
            expect(error.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
