/**
 * Master_Matcher component
 * Feature: vet-voice-medical-record
 * Task 5.1
 *
 * Fuzzy string matching against byoumei.csv, shinryo_tensu_master_flat.csv,
 * and reference_compact.csv (drug reference).
 * LLM: Not used (deterministic fuzzy matching)
 * Dependencies: None (pure function, CSV loaded at cold start)
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 15.5
 */

import { BYOUMEI_CSV } from "./generated/byoumei-data";
import { SHINRYO_TENSU_CSV } from "./generated/shinryo-tensu-data";
import { REFERENCE_COMPACT_CSV } from "./generated/reference-compact-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  name: string;
  code: string;
  confidence: number; // 0.0 - 1.0
  master_source: "byoumei" | "shinryo_tensu" | "drug_reference";
  details: Record<string, string | number>;
}

export interface MatchResult {
  query: string;
  candidates: MatchCandidate[]; // top 3
  top_confirmed: boolean; // true if top candidate >= CONFIDENCE_THRESHOLD
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Candidates below this threshold are considered "unconfirmed" */
export const CONFIDENCE_THRESHOLD = 0.6;

/** Maximum number of candidates to return */
const MAX_CANDIDATES = 3;

// ---------------------------------------------------------------------------
// Internal master data types
// ---------------------------------------------------------------------------

interface DiseaseEntry {
  name: string;
  code: string;
  majorCode: string;
  majorName: string;
  middleCode: string;
  middleName: string;
  minorCode?: string;
  minorName?: string;
  note?: string;
}

interface ProcedureEntry {
  name: string;
  code: string;
  sectionId: string;
  sectionTitle: string;
  itemNo: number;
  pointsB: number;
  pointsA: number;
}

interface DrugEntry {
  genericName: string;
  code: string;
  aliases: string[];
}

// ---------------------------------------------------------------------------
// Module-level cache (cold start optimization)
// ---------------------------------------------------------------------------

let diseaseCache: DiseaseEntry[] | null = null;
let procedureCache: ProcedureEntry[] | null = null;
let drugCache: DrugEntry[] | null = null;

// ---------------------------------------------------------------------------
// CSV loading helpers
// ---------------------------------------------------------------------------

function loadDiseases(): DiseaseEntry[] {
  if (diseaseCache) return diseaseCache;

  const lines = BYOUMEI_CSV.split("\n").slice(1); // skip header
  const entries: DiseaseEntry[] = [];
  const seenMiddleCodes = new Set<string>();

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = splitCsvLine(line);
    if (parts.length < 2) continue;

    const [majorRaw, middleRaw, minorRaw, noteRaw] = parts;

    // Parse major: "01\u3000循環器病" (full-width space)
    const majorMatch = majorRaw.trim().match(/^(\d+)[\u3000\s]+(.+)$/);
    if (!majorMatch) continue;
    const majorCode = majorMatch[1];
    const majorName = majorMatch[2].trim();

    // Parse middle: "01 心のう炎"
    const middleMatch = middleRaw.trim().match(/^(\d+)\s+(.+)$/);
    if (!middleMatch) continue;
    const middleCode = middleMatch[1];
    const middleName = middleMatch[2].trim();

    // Parse minor (optional)
    let minorCode: string | undefined;
    let minorName: string | undefined;
    if (minorRaw && minorRaw.trim()) {
      const minorMatch = minorRaw.trim().match(/^(\d+)\s+(.+)$/);
      if (minorMatch) {
        minorCode = minorMatch[1];
        minorName = minorMatch[2].trim();
      }
    }

    const middleMasterCode = `${majorCode}-${middleCode}`;

    // Always include middle-level disease entry once so broad queries like "肺炎"
    // can match deterministically even when many minor rows exist.
    if (!seenMiddleCodes.has(middleMasterCode)) {
      entries.push({
        name: middleName,
        code: middleMasterCode,
        majorCode,
        majorName,
        middleCode,
        middleName,
        note: noteRaw?.trim() || undefined,
      });
      seenMiddleCodes.add(middleMasterCode);
    }

    // Include minor-level entries when available.
    if (!minorCode || !minorName) continue;

    entries.push({
      name: `${middleName}${minorName}`,
      code: `${middleMasterCode}-${minorCode}`,
      majorCode,
      majorName,
      middleCode,
      middleName,
      minorCode,
      minorName,
      note: noteRaw?.trim() || undefined,
    });
  }

  diseaseCache = entries;
  return diseaseCache;
}

/**
 * Parse shinryo_tensu_master_flat.csv into ProcedureEntry[].
 * CSV format: section_id,section_title,item_no,item_name,points_B,points_A,...
 * Multiple rows per item_no (notes) — deduplicate by section_id + item_no.
 */
function loadProcedures(): ProcedureEntry[] {
  if (procedureCache) return procedureCache;

  const lines = SHINRYO_TENSU_CSV.split("\n").slice(1); // skip header
  const seen = new Set<string>();
  const entries: ProcedureEntry[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = splitCsvLine(line);
    if (parts.length < 6) continue;

    const [sectionId, sectionTitle, itemNoStr, itemName, pointsBStr, pointsAStr] = parts;

    const sectionIdTrimmed = sectionId.trim();
    const itemNoTrimmed = itemNoStr.trim();
    const dedupeKey = `${sectionIdTrimmed}-${itemNoTrimmed}`;

    // Skip duplicate item_no rows (note rows)
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const itemNo = parseInt(itemNoTrimmed, 10);
    if (isNaN(itemNo)) continue;

    // Normalize item name: remove internal spaces e.g. "初 診" -> "初診"
    const name = itemName.trim().replace(/\s+/g, "");
    const code = `${sectionIdTrimmed}-${itemNo}`;
    const pointsB = parseFloat(pointsBStr.trim()) || 0;
    const pointsA = parseFloat(pointsAStr.trim()) || 0;

    entries.push({
      name,
      code,
      sectionId: sectionIdTrimmed,
      sectionTitle: sectionTitle.trim(),
      itemNo,
      pointsB,
      pointsA,
    });
  }

  procedureCache = entries;
  return procedureCache;
}

/**
 * Parse reference_compact.csv into DrugEntry[].
 * CSV format:
 *   display_name,generic_name,product_name,manufacturer,spec_unit,price_yen,notes,...
 *
 * Dedupe by generic_name and merge aliases (display_name/product_name/notes).
 */
function loadDrugs(): DrugEntry[] {
  if (drugCache) return drugCache;

  const lines = REFERENCE_COMPACT_CSV.split("\n").slice(1); // skip header
  const entries = new Map<string, { genericName: string; aliases: Set<string> }>();

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = splitCsvLine(line);
    if (parts.length < 2) continue;

    const displayName = (parts[0] ?? "").trim();
    const genericName = (parts[1] ?? "").trim() || displayName;
    const productName = (parts[2] ?? "").trim();
    const notes = (parts[6] ?? "").trim();

    if (!genericName) continue;

    const key = normalizeMatchText(genericName);
    if (!key) continue;

    const row = entries.get(key) ?? {
      genericName,
      aliases: new Set<string>(),
    };

    row.aliases.add(genericName);
    if (displayName) row.aliases.add(displayName);
    if (productName) row.aliases.add(productName);
    for (const alias of splitAliasesFromNotes(notes)) {
      row.aliases.add(alias);
    }

    entries.set(key, row);
  }

  drugCache = Array.from(entries.values()).map((entry) => ({
    genericName: entry.genericName,
    code: `DRUG:${entry.genericName}`,
    aliases: Array.from(entry.aliases),
  }));

  return drugCache;
}

function splitAliasesFromNotes(notes: string): string[] {
  if (!notes) return [];
  return notes
    .split(/[、，,/]/u)
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
}

/**
 * Simple CSV line splitter that handles double-quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Fuzzy matching algorithm
// ---------------------------------------------------------------------------

function normalizeMatchText(text: string): string {
  return text
    .normalize("NFKC")
    .trim()
    .replace(/[\u3000\s]+/g, "")
    .replace(/[()（）\u005b\u005d［］「」『』、。・,:;'"`]/g, "")
    .replace(/[?？]+$/g, "");
}

function normalizeDiseaseQuery(text: string): string {
  const normalized = stripSpeculationSuffix(normalizeMatchText(text));
  return normalized
    .replace(/(?:の)?疑いあり$/u, "")
    .replace(/(?:の)?疑い$/u, "")
    .replace(/疑$/u, "")
    .replace(/未確認$/u, "");
}

function normalizeProcedureQuery(text: string): string {
  return stripSpeculationSuffix(normalizeMatchText(text));
}

function normalizeDrugQuery(text: string): string {
  return stripSpeculationSuffix(normalizeMatchText(text))
    .replace(/(?:を)?投与(?:した)?$/u, "")
    .replace(/(?:を)?注射(?:した)?$/u, "");
}

function stripSpeculationSuffix(text: string): string {
  return text
    .replace(/(?:か)?と思います$/u, "")
    .replace(/(?:か)?と考えます$/u, "")
    .replace(/(?:と思われます|と考えられます)$/u, "")
    .replace(/(?:と推定されます|と推定)$/u, "")
    .replace(/(?:の)?可能性(?:があります)?$/u, "")
    .replace(/(?:かもしれません|かも)$/u, "")
    .replace(/(?:でしょう)$/u, "");
}

/**
 * Compute Levenshtein edit distance between two strings.
 */
function computeEditDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Normalized edit distance score: 1 - editDistance(a,b) / max(len_a, len_b)
 */
function normalizedEditScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  return 1 - computeEditDistance(a, b) / maxLen;
}

/**
 * Character bi-gram overlap (Jaccard) score: |intersection| / |union|
 * Works better than whitespace tokenization for Japanese.
 */
function tokenOverlapScore(a: string, b: string): number {
  const toBigrams = (s: string): Set<string> => {
    if (!s) return new Set<string>();
    const chars = [...s];
    if (chars.length === 1) return new Set(chars);
    const grams: string[] = [];
    for (let i = 0; i < chars.length - 1; i++) {
      grams.push(chars[i] + chars[i + 1]);
    }
    return new Set(grams);
  };

  const tokensA = toBigrams(a);
  const tokensB = toBigrams(b);
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;

  let common = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) common++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : common / union;
}

/**
 * Combined fuzzy score: 0.6 * editScore + 0.4 * tokenScore
 */
function computeFuzzyScore(query: string, candidate: string): number {
  const q = normalizeMatchText(query);
  const c = normalizeMatchText(candidate);

  if (!q || !c) return 0;
  if (q === c) return 1.0;

  const base = 0.6 * normalizedEditScore(q, c) + 0.4 * tokenOverlapScore(q, c);

  // Substring inclusion is common in medical terms (e.g. "肺炎" vs "肺炎細菌性")
  if (c.includes(q) || q.includes(c)) {
    return Math.max(base, 0.8);
  }

  return base;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Match a disease name against byoumei.csv master data.
 *
 * @param name Disease name to match (e.g. "心のう炎")
 * @returns MatchResult with top 3 candidates and confirmation status
 */
export function matchDisease(name: string): MatchResult {
  const diseases = loadDiseases();
  const queryForMatch = normalizeDiseaseQuery(name);

  if (!queryForMatch) {
    return { query: name, candidates: [], top_confirmed: false };
  }

  const scored = diseases.map((entry) => ({
    entry,
    score: computeFuzzyScore(queryForMatch, entry.name),
  }));

  scored.sort((a, b) => b.score - a.score);

  const candidates: MatchCandidate[] = scored
    .slice(0, MAX_CANDIDATES)
    .map(({ entry, score }) => ({
      name: entry.name,
      code: entry.code,
      confidence: Math.round(score * 1000) / 1000,
      master_source: "byoumei" as const,
      details: {
        majorCode: entry.majorCode,
        majorName: entry.majorName,
        middleCode: entry.middleCode,
        middleName: entry.middleName,
        ...(entry.minorCode ? { minorCode: entry.minorCode } : {}),
        ...(entry.minorName ? { minorName: entry.minorName } : {}),
        ...(entry.note ? { note: entry.note } : {}),
      },
    }));

  const top_confirmed =
    candidates.length > 0 && candidates[0].confidence >= CONFIDENCE_THRESHOLD;

  return { query: name, candidates, top_confirmed };
}

/**
 * Match a procedure/drug name against shinryo_tensu_master_flat.csv.
 *
 * @param name Procedure name to match (e.g. "初診")
 * @returns MatchResult with top 3 candidates and confirmation status
 */
export function matchProcedure(name: string): MatchResult {
  const procedures = loadProcedures();
  const queryForMatch = normalizeProcedureQuery(name);

  if (!queryForMatch) {
    return { query: name, candidates: [], top_confirmed: false };
  }

  const scored = procedures.map((entry) => ({
    entry,
    score: computeFuzzyScore(queryForMatch, entry.name),
  }));

  scored.sort((a, b) => b.score - a.score);

  const candidates: MatchCandidate[] = scored
    .slice(0, MAX_CANDIDATES)
    .map(({ entry, score }) => ({
      name: entry.name,
      code: entry.code,
      confidence: Math.round(score * 1000) / 1000,
      master_source: "shinryo_tensu" as const,
      details: {
        sectionId: entry.sectionId,
        sectionTitle: entry.sectionTitle,
        itemNo: entry.itemNo,
        pointsB: entry.pointsB,
        pointsA: entry.pointsA,
      },
    }));

  const top_confirmed =
    candidates.length > 0 && candidates[0].confidence >= CONFIDENCE_THRESHOLD;

  return { query: name, candidates, top_confirmed };
}

/**
 * Match a drug name against reference_compact.csv generic_name master.
 *
 * @param name Drug name to match (e.g. "アンピシリン", "アモキシシリンLA注")
 * @returns MatchResult with top 3 candidates and confirmation status
 */
export function matchDrug(name: string): MatchResult {
  const drugs = loadDrugs();
  const queryForMatch = normalizeDrugQuery(name);

  if (!queryForMatch) {
    return { query: name, candidates: [], top_confirmed: false };
  }

  const scored = drugs.map((entry) => ({
    entry,
    score: entry.aliases.reduce((best, alias) => {
      const aliasScore = computeFuzzyScore(queryForMatch, alias);
      return aliasScore > best ? aliasScore : best;
    }, 0),
  }));

  scored.sort((a, b) => b.score - a.score);

  const candidates: MatchCandidate[] = scored
    .slice(0, MAX_CANDIDATES)
    .map(({ entry, score }) => ({
      name: entry.genericName,
      code: entry.code,
      confidence: Math.round(score * 1000) / 1000,
      master_source: "drug_reference" as const,
      details: {
        genericName: entry.genericName,
        aliasCount: entry.aliases.length,
      },
    }));

  const top_confirmed =
    candidates.length > 0 && candidates[0].confidence >= CONFIDENCE_THRESHOLD;

  return { query: name, candidates, top_confirmed };
}

/**
 * Reset master data caches (for test isolation).
 * @internal
 */
export function resetMasterMatcherCache(): void {
  diseaseCache = null;
  procedureCache = null;
  drugCache = null;
}
