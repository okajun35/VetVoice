export const REPRO_SCREENING_KEYWORDS = [
  "外子宮口",
  "子宮口",
  "膣内",
  "膣検査",
  "cidr",
  "cl",
  "黄体",
  "卵巣",
  "人工授精",
  "妊娠鑑定",
  "ai",
  "et",
  "pg",
] as const;

export const PROCEDURE_UTTERANCE_STRONG_KEYWORDS = [
  "処置",
  "投与",
  "注射",
  "点滴",
  "実施",
  "施行",
  "挿入",
  "手術",
  "胚移植",
  "再検査",
  "再鑑定",
  "中止",
  "様子見",
] as const;

export const PROCEDURE_UTTERANCE_CONTEXT_TERMS = [
  "人工授精",
  "妊娠鑑定",
  "cidr",
  "ai",
  "et",
  "pg",
] as const;

export const PROCEDURE_ACTION_VERBS = [
  "する",
  "した",
  "します",
  "して",
  "にして",
  "実施",
  "施行",
  "投与",
  "挿入",
  "行う",
  "予定",
] as const;

export const CLINICAL_DISEASE_KEYWORDS = [
  "ケトーシス",
  "ケトン臭",
  "乳房炎",
  "肺炎",
  "下痢",
  "軟便",
  "発熱",
  "食欲不振",
] as const;

export const NON_DISEASE_STATE_NAMES = new Set(["妊娠"]);
