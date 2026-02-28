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
      "pattern": "(?<!外子宮口)室内(?=\\\\s*(?:(?:は|も)?\\\\s*)?(?:右|左|異常なし|問題なし|正常|清除|清))",
      "replacement": "膣内",
      "flags": "gu"
    },
    {
      "pattern": "外資急行|外資休校",
      "replacement": "外子宮口",
      "flags": "gu"
    },
    {
      "pattern": "外資球構成|外子球行|外子球孔|外資球孔|外子球",
      "replacement": "外子宮口",
      "flags": "gu"
    },
    {
      "pattern": "外資球根|外子球根",
      "replacement": "外子宮口",
      "flags": "gu"
    },
    {
      "pattern": "外資急構成所",
      "replacement": "外子宮口正常",
      "flags": "gu"
    },
    {
      "pattern": "外子宮こう",
      "replacement": "外子宮口",
      "flags": "gu"
    },
    {
      "pattern": "外子宮口(?:を|は)?成",
      "replacement": "外子宮口正常",
      "flags": "gu"
    },
    {
      "pattern": "外子宮口上",
      "replacement": "外子宮口正常",
      "flags": "gu"
    },
    {
      "pattern": "外光(?=\\\\s*見え(?:ず|ない))",
      "replacement": "外口",
      "flags": "gu"
    },
    {
      "pattern": "外交(?=\\\\s*(?:ノーマル|正常|室内|膣内))",
      "replacement": "外口",
      "flags": "gu"
    },
    {
      "pattern": "室内性以上",
      "replacement": "膣内正常",
      "flags": "gu"
    },
    {
      "pattern": "[ぞゾ]?質検査",
      "replacement": "膣検査",
      "flags": "gu"
    },
    {
      "pattern": "外子宮口(?:を|は)?清除",
      "replacement": "外子宮口正常",
      "flags": "gu"
    },
    {
      "pattern": "膣内(?:を|は)?清除",
      "replacement": "膣内正常",
      "flags": "gu"
    },
    {
      "pattern": "頭検査",
      "replacement": "膣検査",
      "flags": "gu"
    },
    {
      "pattern": "景観",
      "replacement": "経観",
      "flags": "gu"
    },
    {
      "pattern": "\\\\bai\\\\b",
      "replacement": "AI",
      "flags": "giu"
    },
    {
      "pattern": "\\\\bet\\\\b(?=\\\\s*(?:実施へ|中止|でも|予定))",
      "replacement": "ET",
      "flags": "giu"
    },
    {
      "pattern": "\\\\bpg\\\\b",
      "replacement": "PG",
      "flags": "giu"
    },
    {
      "pattern": "\\\\bvds\\\\b",
      "replacement": "VDS",
      "flags": "giu"
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
