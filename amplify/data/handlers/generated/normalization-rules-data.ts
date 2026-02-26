// AUTO-GENERATED — do not edit manually.
// Source: assets/ directory
// Regenerate: npm run generate-assets

export const NORMALIZATION_RULES_JSON = `{
  "preExtractionTextNormalizationRules": [
    {
      "pattern": "(?:分|糞|ふん)は?(?:南べ|なんべん|軟便)",
      "replacement": "糞は軟便",
      "flags": "gu"
    },
    {
      "pattern": "(左右)\\\\s*[mMＭ][sSＳ]\\\\s*-?\\\\s*マイナス",
      "replacement": "$1乳房炎スコア陰性",
      "flags": "gu"
    },
    {
      "pattern": "25\\\\s*セ?ブドウ糖",
      "replacement": "25%ブドウ糖",
      "flags": "gu"
    }
  ],
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
      "triggerPattern": "25%ブドウ糖",
      "canonicalName": "25%ブドウ糖液",
      "masterCode": "DRUG:ブドウ糖注射液",
      "ifCanonicalIn": ["ブドウ糖", "ブドウ糖注射液"],
      "ifMasterCodeIn": ["DRUG:ブドウ糖", "DRUG:ブドウ糖注射液"]
    },
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
