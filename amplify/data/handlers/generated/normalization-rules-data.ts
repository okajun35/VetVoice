// AUTO-GENERATED — do not edit manually.
// Source: assets/ directory
// Regenerate: npm run generate-assets

export const NORMALIZATION_RULES_JSON = `{
  "drugQueryNormalizationRules": [
    {
      "pattern": "([0-9０-９]+[%％])?ブドウ糖液",
      "replacement": "$1ブドウ糖注射液",
      "flags": "gu"
    }
  ],
  "planTextNormalizationRules": [
    {
      "pattern": "静脈内投与|静脈投与|静注",
      "replacement": "静脈内注射",
      "flags": "gu"
    },
    {
      "pattern": "筋肉内投与|筋注",
      "replacement": "筋肉注射",
      "flags": "gu"
    },
    {
      "pattern": "皮下投与|皮下注",
      "replacement": "皮下注射",
      "flags": "gu"
    }
  ],
  "drugCanonicalOverrideRules": [
    {
      "triggerPattern": "ブドウ糖液",
      "canonicalName": "ブドウ糖注射液",
      "masterCode": "DRUG:ブドウ糖注射液",
      "ifCanonicalIn": ["ブドウ糖"],
      "ifMasterCodeIn": ["DRUG:ブドウ糖"]
    }
  ]
}
`;
