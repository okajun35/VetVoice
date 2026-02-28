/**
 * Normalization rules loader and applier.
 *
 * Rules are managed in assets/normalization_rules.json and bundled as
 * generated/normalization-rules-data.ts.
 */

import { NORMALIZATION_RULES_JSON } from "./generated/normalization-rules-data";

interface RegexReplaceRule {
  pattern: string;
  replacement: string;
  flags?: string;
}

interface DrugCanonicalOverrideRule {
  triggerPattern: string;
  canonicalName: string;
  masterCode: string;
  ifCanonicalIn?: string[];
  ifMasterCodeIn?: string[];
}

interface NormalizationRulesSchema {
  preExtractionTextNormalizationRules?: RegexReplaceRule[];
  drugQueryNormalizationRules?: RegexReplaceRule[];
  planTextNormalizationRules?: RegexReplaceRule[];
  drugCanonicalOverrideRules?: DrugCanonicalOverrideRule[];
}

interface CompiledRegexRule {
  regex: RegExp;
  replacement: string;
}

interface CompiledNormalizationRules {
  preExtractionTextNormalizationRules: CompiledRegexRule[];
  drugQueryNormalizationRules: CompiledRegexRule[];
  planTextNormalizationRules: CompiledRegexRule[];
  drugCanonicalOverrideRules: DrugCanonicalOverrideRule[];
}

let cache: CompiledNormalizationRules | null = null;

function compileRegexRules(rules: RegexReplaceRule[] | undefined): CompiledRegexRule[] {
  if (!rules || rules.length === 0) return [];

  const compiled: CompiledRegexRule[] = [];
  for (const rule of rules) {
    if (!rule?.pattern) continue;

    try {
      compiled.push({
        regex: new RegExp(rule.pattern, rule.flags ?? "g"),
        replacement: rule.replacement ?? "",
      });
    } catch (err) {
      console.warn("Invalid normalization regex rule skipped:", rule, err);
    }
  }

  return compiled;
}

function loadRules(): CompiledNormalizationRules {
  if (cache) return cache;

  let parsed: NormalizationRulesSchema = {};
  try {
    parsed = JSON.parse(NORMALIZATION_RULES_JSON) as NormalizationRulesSchema;
  } catch (err) {
    console.error("Failed to parse NORMALIZATION_RULES_JSON; using empty rules", err);
  }

  cache = {
    preExtractionTextNormalizationRules: compileRegexRules(
      parsed.preExtractionTextNormalizationRules
    ),
    drugQueryNormalizationRules: compileRegexRules(parsed.drugQueryNormalizationRules),
    planTextNormalizationRules: compileRegexRules(parsed.planTextNormalizationRules),
    drugCanonicalOverrideRules: parsed.drugCanonicalOverrideRules ?? [],
  };

  return cache;
}

function applyRegexRules(text: string, rules: CompiledRegexRule[]): string {
  let value = text;
  for (const rule of rules) {
    value = value.replace(rule.regex, rule.replacement);
  }
  return value;
}

export function normalizeDrugQueryByRules(text: string): string {
  if (!text) return text;
  const rules = loadRules();
  return applyRegexRules(text, rules.drugQueryNormalizationRules);
}

export function normalizePreExtractionTextByRules(text: string): string {
  if (!text) return text;
  const rules = loadRules();
  return applyRegexRules(text, rules.preExtractionTextNormalizationRules);
}

export function normalizePlanTextByRules(text: string): string {
  if (!text) return text;
  const rules = loadRules();
  return applyRegexRules(text, rules.planTextNormalizationRules);
}

function shouldApplyDrugOverride(
  item: { canonical_name?: string; master_code?: string },
  rule: DrugCanonicalOverrideRule
): boolean {
  const hasCanonicalFilter = (rule.ifCanonicalIn?.length ?? 0) > 0;
  const hasMasterFilter = (rule.ifMasterCodeIn?.length ?? 0) > 0;

  if (!hasCanonicalFilter && !hasMasterFilter) return true;

  const canonicalMatched =
    hasCanonicalFilter &&
    item.canonical_name != null &&
    rule.ifCanonicalIn!.includes(item.canonical_name);

  const masterMatched =
    hasMasterFilter &&
    item.master_code != null &&
    rule.ifMasterCodeIn!.includes(item.master_code);

  // OR semantics: either canonical or master filter match is sufficient.
  return canonicalMatched || masterMatched;
}

export function applyDrugCanonicalOverrides<
  T extends { type: string; canonical_name?: string; master_code?: string }
>(item: T, sourceText: string): T {
  if (!sourceText || item.type !== "drug") return item;

  const rules = loadRules();
  for (const rule of rules.drugCanonicalOverrideRules) {
    if (!rule.triggerPattern || !sourceText.includes(rule.triggerPattern)) {
      continue;
    }

    if (!shouldApplyDrugOverride(item, rule)) {
      continue;
    }

    return {
      ...item,
      canonical_name: rule.canonicalName,
      master_code: rule.masterCode,
    };
  }

  return item;
}

export function resetNormalizationRulesCache(): void {
  cache = null;
}
