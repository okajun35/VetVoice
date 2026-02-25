/**
 * Parser コンポーネント
 * Feature: vet-voice-medical-record
 * Task 3.1
 * 
 * Extracted_JSONの解析・検証・整形を行う純粋関数コンポーネント
 * 
 * 要件: 6.1, 6.2, 6.3, 6.4
 * - 6.1: Extracted_JSONを解析し、有効なExtracted_JSONオブジェクトに変換する
 * - 6.2: 無効なExtracted_JSONが入力された場合、具体的なエラー内容を返す
 * - 6.3: Extracted_JSONオブジェクトを有効なJSON文字列に整形する
 * - 6.4: ラウンドトリップ特性: parse(stringify(obj)) ≡ obj
 */

/**
 * Extracted_JSON型定義
 */
export interface ExtractedJSON {
  vital: {
    temp_c: number | null;
  };
  s: string | null;
  o: string | null;
  a: Array<{
    name: string;
    canonical_name?: string;
    confidence?: number;
    master_code?: string;
    status?: "confirmed" | "unconfirmed";
  }>;
  p: Array<{
    name: string;
    canonical_name?: string;
    type: "procedure" | "drug";
    dosage?: string;
    confidence?: number;
    master_code?: string;
    status?: "confirmed" | "unconfirmed";
  }>;
}

/**
 * パース結果型
 */
export interface ParseResult {
  success: boolean;
  data?: ExtractedJSON;
  errors?: string[];
}

/**
 * JSON文字列をExtracted_JSONオブジェクトに変換する
 * 
 * @param jsonString - パース対象のJSON文字列
 * @returns パース結果（成功時はdata、失敗時はerrors）
 */
export function parse(jsonString: string): ParseResult {
  const errors: string[] = [];

  // Step 1: JSON文字列のパース
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Runtime shape is validated field-by-field below.
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    return {
      success: false,
      errors: [`Invalid JSON string: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  // Step 2: トップレベルの型チェック
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      errors: ["Root must be an object"],
    };
  }

  // Step 3: 必須フィールドの存在チェック
  const requiredFields = ["vital", "s", "o", "a", "p"];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Step 4: vital フィールドの検証
  if (typeof parsed.vital !== "object" || parsed.vital === null || Array.isArray(parsed.vital)) {
    errors.push("Field 'vital' must be an object");
  } else {
    if (!("temp_c" in parsed.vital)) {
      errors.push("Field 'vital.temp_c' is required");
    } else {
      const tempC = parsed.vital.temp_c;
      if (tempC !== null && typeof tempC !== "number") {
        errors.push("Field 'vital.temp_c' must be a number or null");
      }
    }
  }

  // Step 5: s フィールドの検証
  if (parsed.s !== null && typeof parsed.s !== "string") {
    errors.push("Field 's' must be a string or null");
  }

  // Step 6: o フィールドの検証
  if (parsed.o !== null && typeof parsed.o !== "string") {
    errors.push("Field 'o' must be a string or null");
  }

  // Step 7: a フィールドの検証
  if (!Array.isArray(parsed.a)) {
    errors.push("Field 'a' must be an array");
  } else {
    for (let i = 0; i < parsed.a.length; i++) {
      const item = parsed.a[i];
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        errors.push(`Field 'a[${i}]' must be an object`);
        continue;
      }

      if (!("name" in item)) {
        errors.push(`Field 'a[${i}].name' is required`);
      } else if (typeof item.name !== "string") {
        errors.push(`Field 'a[${i}].name' must be a string`);
      }

      if ("confidence" in item && item.confidence !== undefined) {
        if (typeof item.confidence !== "number") {
          errors.push(`Field 'a[${i}].confidence' must be a number`);
        } else if (item.confidence < 0 || item.confidence > 1) {
          errors.push(`Field 'a[${i}].confidence' must be between 0 and 1`);
        }
      }

      if (
        "canonical_name" in item &&
        item.canonical_name !== undefined &&
        typeof item.canonical_name !== "string"
      ) {
        errors.push(`Field 'a[${i}].canonical_name' must be a string`);
      }

      if ("master_code" in item && item.master_code !== undefined && typeof item.master_code !== "string") {
        errors.push(`Field 'a[${i}].master_code' must be a string`);
      }

      if ("status" in item && item.status !== undefined) {
        if (item.status !== "confirmed" && item.status !== "unconfirmed") {
          errors.push(`Field 'a[${i}].status' must be 'confirmed' or 'unconfirmed'`);
        }
      }
    }
  }

  // Step 8: p フィールドの検証
  if (!Array.isArray(parsed.p)) {
    errors.push("Field 'p' must be an array");
  } else {
    for (let i = 0; i < parsed.p.length; i++) {
      const item = parsed.p[i];
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        errors.push(`Field 'p[${i}]' must be an object`);
        continue;
      }

      if (!("name" in item)) {
        errors.push(`Field 'p[${i}].name' is required`);
      } else if (typeof item.name !== "string") {
        errors.push(`Field 'p[${i}].name' must be a string`);
      }

      if (!("type" in item)) {
        errors.push(`Field 'p[${i}].type' is required`);
      } else if (item.type !== "procedure" && item.type !== "drug") {
        errors.push(`Field 'p[${i}].type' must be 'procedure' or 'drug'`);
      }

      if ("dosage" in item && item.dosage !== undefined && item.dosage !== null && typeof item.dosage !== "string") {
        errors.push(`Field 'p[${i}].dosage' must be a string`);
      }

      if (
        "canonical_name" in item &&
        item.canonical_name !== undefined &&
        typeof item.canonical_name !== "string"
      ) {
        errors.push(`Field 'p[${i}].canonical_name' must be a string`);
      }

      if ("confidence" in item && item.confidence !== undefined) {
        if (typeof item.confidence !== "number") {
          errors.push(`Field 'p[${i}].confidence' must be a number`);
        } else if (item.confidence < 0 || item.confidence > 1) {
          errors.push(`Field 'p[${i}].confidence' must be between 0 and 1`);
        }
      }

      if ("master_code" in item && item.master_code !== undefined && typeof item.master_code !== "string") {
        errors.push(`Field 'p[${i}].master_code' must be a string`);
      }

      if ("status" in item && item.status !== undefined) {
        if (item.status !== "confirmed" && item.status !== "unconfirmed") {
          errors.push(`Field 'p[${i}].status' must be 'confirmed' or 'unconfirmed'`);
        }
      }
    }
  }

  // Step 9: エラーがあれば失敗を返す
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Step 10: 成功時は型安全なオブジェクトを返す
  return {
    success: true,
    data: parsed as ExtractedJSON,
  };
}

/**
 * Extracted_JSONオブジェクトをJSON文字列に整形する
 * 
 * @param data - 整形対象のExtracted_JSONオブジェクト
 * @returns 整形されたJSON文字列
 */
export function stringify(data: ExtractedJSON): string {
  return JSON.stringify(data);
}
