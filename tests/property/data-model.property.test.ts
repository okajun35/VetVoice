/**
 * データモデルのプロパティベーステスト
 * Feature: vet-voice-medical-record
 * Task 2.2
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { completeVisitArb, cowIdArb, visitIdArb, isoDatetimeArb, extractedJsonArb } from "../helpers/generators";

/**
 * モックAmplify Dataクライアント
 * 実際のDynamoDB操作をシミュレート
 */
interface Visit {
  visitId: string;
  cowId: string;
  datetime: string;
  status: "IN_PROGRESS" | "COMPLETED";
  transcriptRaw?: string;
  transcriptExpanded?: string;
  extractedJson?: any;
  soapText?: string;
  kyosaiText?: string;
  templateType?: string;
  updatedAt?: string;
}

class MockDataStore {
  private visits: Map<string, Visit> = new Map();

  async createVisit(visit: Visit): Promise<Visit> {
    if (!visit.visitId || !visit.cowId || !visit.datetime || !visit.status) {
      throw new Error("Missing required fields: visitId, cowId, datetime, status");
    }
    if (!visit.transcriptRaw || !visit.extractedJson) {
      throw new Error("Missing required fields: transcriptRaw, extractedJson");
    }
    this.visits.set(visit.visitId, { ...visit });
    return { ...visit };
  }

  async getVisit(visitId: string): Promise<Visit | null> {
    const visit = this.visits.get(visitId);
    return visit ? { ...visit } : null;
  }

  async updateVisit(visitId: string, updates: Partial<Visit>): Promise<Visit> {
    const existing = this.visits.get(visitId);
    if (!existing) {
      throw new Error(`Visit not found: ${visitId}`);
    }

    // Property 11: transcript_raw と extracted_json の削除を防止
    // updatesに含まれている場合のみチェック
    if ("transcriptRaw" in updates && (updates.transcriptRaw === null || updates.transcriptRaw === undefined || updates.transcriptRaw === "")) {
      throw new Error("Cannot delete or clear transcriptRaw");
    }
    if ("extractedJson" in updates && (updates.extractedJson === null || updates.extractedJson === undefined)) {
      throw new Error("Cannot delete or clear extractedJson");
    }

    const updated = { ...existing, ...updates };
    this.visits.set(visitId, updated);
    return { ...updated };
  }

  async listVisitsByCow(cowId: string): Promise<Visit[]> {
    const visits = Array.from(this.visits.values())
      .filter((v) => v.cowId === cowId)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    return visits.map((v) => ({ ...v }));
  }

  clear() {
    this.visits.clear();
  }
}

describe("Feature: vet-voice-medical-record, Property 11: Visitデータ保全の不変条件", () => {
  it("すべての保存済みVisitレコードに対して、visit_id、cow_id、datetime、status、transcript_raw、extracted_jsonが常に存在する", () => {
    fc.assert(
      fc.asyncProperty(completeVisitArb, async (visit) => {
        // 各イテレーションで新しいdataStoreを作成
        const dataStore = new MockDataStore();
        
        // 保存
        const saved = await dataStore.createVisit(visit);

        // 検証: 必須フィールドが存在する
        expect(saved.visitId).toBeDefined();
        expect(saved.visitId).toBe(visit.visitId);
        expect(saved.cowId).toBeDefined();
        expect(saved.cowId).toBe(visit.cowId);
        expect(saved.datetime).toBeDefined();
        expect(saved.datetime).toBe(visit.datetime);
        expect(saved.status).toBeDefined();
        expect(saved.status).toBe(visit.status);
        expect(saved.transcriptRaw).toBeDefined();
        expect(saved.transcriptRaw).toBe(visit.transcriptRaw);
        expect(saved.extractedJson).toBeDefined();
        expect(saved.extractedJson).toEqual(visit.extractedJson);

        // 取得して再検証
        const retrieved = await dataStore.getVisit(visit.visitId);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.visitId).toBe(visit.visitId);
        expect(retrieved!.cowId).toBe(visit.cowId);
        expect(retrieved!.datetime).toBe(visit.datetime);
        expect(retrieved!.status).toBe(visit.status);
        expect(retrieved!.transcriptRaw).toBe(visit.transcriptRaw);
        expect(retrieved!.extractedJson).toEqual(visit.extractedJson);
      }),
      { numRuns: 100 }
    );
  });

  it("いかなる更新操作の後もtranscript_rawとextracted_jsonが削除されない", () => {
    fc.assert(
      fc.asyncProperty(
        completeVisitArb,
        fc.record({
          soapText: fc.option(fc.string(), { nil: undefined }),
          kyosaiText: fc.option(fc.string(), { nil: undefined }),
          templateType: fc.option(fc.string(), { nil: undefined }),
          status: fc.oneof(
            fc.constant("IN_PROGRESS" as const),
            fc.constant("COMPLETED" as const)
          ),
        }),
        async (visit, updates) => {
          // 各イテレーションで新しいdataStoreを作成
          const dataStore = new MockDataStore();
          
          // 保存
          await dataStore.createVisit(visit);

          // 更新（transcript_raw と extracted_json は含まない）
          const updated = await dataStore.updateVisit(visit.visitId, updates);

          // 検証: transcript_raw と extracted_json が保持されている
          expect(updated.transcriptRaw).toBe(visit.transcriptRaw);
          expect(updated.extractedJson).toEqual(visit.extractedJson);

          // 取得して再検証
          const retrieved = await dataStore.getVisit(visit.visitId);
          expect(retrieved!.transcriptRaw).toBe(visit.transcriptRaw);
          expect(retrieved!.extractedJson).toEqual(visit.extractedJson);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("transcript_rawまたはextracted_jsonを削除しようとする更新操作は拒否される", () => {
    fc.assert(
      fc.asyncProperty(completeVisitArb, async (visit) => {
        // 各イテレーションで新しいdataStoreを作成
        const dataStore = new MockDataStore();
        
        // 保存
        await dataStore.createVisit(visit);

        // transcript_raw を削除しようとする（空文字列）
        await expect(
          dataStore.updateVisit(visit.visitId, { transcriptRaw: "" })
        ).rejects.toThrow("Cannot delete or clear transcriptRaw");

        // transcript_raw を削除しようとする（null）
        await expect(
          dataStore.updateVisit(visit.visitId, { transcriptRaw: null as any })
        ).rejects.toThrow("Cannot delete or clear transcriptRaw");

        // extracted_json を削除しようとする（null）
        await expect(
          dataStore.updateVisit(visit.visitId, { extractedJson: null as any })
        ).rejects.toThrow("Cannot delete or clear extractedJson");

        // extracted_json を削除しようとする（undefined）
        await expect(
          dataStore.updateVisit(visit.visitId, { extractedJson: undefined as any })
        ).rejects.toThrow("Cannot delete or clear extractedJson");

        // 元のデータが保持されていることを確認
        const retrieved = await dataStore.getVisit(visit.visitId);
        expect(retrieved!.transcriptRaw).toBe(visit.transcriptRaw);
        expect(retrieved!.extractedJson).toEqual(visit.extractedJson);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: vet-voice-medical-record, Property 12: Cow-Visit関連の整合性", () => {
  it("すべてのcow_idに対して、そのcow_idに紐づく複数のVisitを作成した場合、cow_idによる検索ですべてのVisitが取得できる", () => {
    fc.assert(
      fc.asyncProperty(
        cowIdArb,
        fc.array(
          fc.record({
            datetime: isoDatetimeArb,
            status: fc.oneof(
              fc.constant("IN_PROGRESS" as const),
              fc.constant("COMPLETED" as const)
            ),
            transcriptRaw: fc.string({ minLength: 1 }),
            extractedJson: extractedJsonArb,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (cowId, visitData) => {
          // 各イテレーションで新しいdataStoreを作成
          const dataStore = new MockDataStore();
          
          // 同じcow_idで複数のVisitを作成（一意のvisitIdを生成）
          const visits: Visit[] = visitData.map((data, index) => ({
            ...data,
            visitId: `visit-${cowId}-${index}-${Date.now()}`,
            cowId,
            transcriptExpanded: undefined,
            soapText: undefined,
            kyosaiText: undefined,
            templateType: undefined,
            updatedAt: undefined,
          }));

          // すべてのVisitを保存
          for (const visit of visits) {
            await dataStore.createVisit(visit);
          }

          // cow_idで検索
          const retrieved = await dataStore.listVisitsByCow(cowId);

          // 検証: すべてのVisitが取得できる
          expect(retrieved).toHaveLength(visits.length);

          // 検証: 各Visitのcow_idが一致する
          for (const visit of retrieved) {
            expect(visit.cowId).toBe(cowId);
          }

          // 検証: すべてのvisitIdが含まれている
          const retrievedIds = new Set(retrieved.map((v) => v.visitId));
          for (const visit of visits) {
            expect(retrievedIds.has(visit.visitId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("listVisitsByCowで取得されたVisitは、datetimeで昇順にソートされている", () => {
    fc.assert(
      fc.asyncProperty(
        cowIdArb,
        fc.array(
          fc.record({
            datetime: isoDatetimeArb,
            status: fc.oneof(
              fc.constant("IN_PROGRESS" as const),
              fc.constant("COMPLETED" as const)
            ),
            transcriptRaw: fc.string({ minLength: 1 }),
            extractedJson: extractedJsonArb,
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (cowId, visitData) => {
          // 各イテレーションで新しいdataStoreを作成
          const dataStore = new MockDataStore();
          
          // 同じcow_idで複数のVisitを作成（一意のvisitIdを生成）
          const visits: Visit[] = visitData.map((data, index) => ({
            ...data,
            visitId: `visit-${cowId}-${index}-${Date.now()}`,
            cowId,
          }));

          // すべてのVisitを保存
          for (const visit of visits) {
            await dataStore.createVisit(visit);
          }

          // cow_idで検索
          const retrieved = await dataStore.listVisitsByCow(cowId);

          // 検証: datetimeで昇順にソートされている
          for (let i = 1; i < retrieved.length; i++) {
            const prevTime = new Date(retrieved[i - 1].datetime).getTime();
            const currTime = new Date(retrieved[i].datetime).getTime();
            expect(prevTime).toBeLessThanOrEqual(currTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("異なるcow_idのVisitは互いに独立している", () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            cowId: cowIdArb,
            visitCount: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (cowGroups) => {
          // 各イテレーションで新しいdataStoreを作成
          const dataStore = new MockDataStore();
          
          // 各牛グループに対してVisitを生成
          const allVisits: Array<{ cowId: string; visits: Visit[] }> = [];
          
          for (const group of cowGroups) {
            const visits: Visit[] = [];
            for (let i = 0; i < group.visitCount; i++) {
              visits.push({
                visitId: `visit-${group.cowId}-${i}-${Date.now()}-${Math.random()}`,
                cowId: group.cowId,
                datetime: new Date(Date.now() + i * 1000).toISOString(),
                status: i % 2 === 0 ? "IN_PROGRESS" : "COMPLETED",
                transcriptRaw: `transcript-${i}`,
                extractedJson: {
                  vital: { temp_c: 38.5 },
                  s: null,
                  o: null,
                  a: [],
                  p: [],
                },
              });
            }
            allVisits.push({ cowId: group.cowId, visits });
          }

          // すべてのVisitを保存
          for (const group of allVisits) {
            for (const visit of group.visits) {
              await dataStore.createVisit(visit);
            }
          }

          // 各牛のVisitを検索して検証
          for (const group of allVisits) {
            const retrieved = await dataStore.listVisitsByCow(group.cowId);

            // 検証: 取得されたVisitの数が一致
            expect(retrieved).toHaveLength(group.visits.length);

            // 検証: すべてのVisitが正しいcow_idを持つ
            for (const visit of retrieved) {
              expect(visit.cowId).toBe(group.cowId);
            }

            // 検証: 他の牛のVisitが含まれていない
            const expectedIds = new Set(group.visits.map((v) => v.visitId));
            for (const visit of retrieved) {
              expect(expectedIds.has(visit.visitId)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
