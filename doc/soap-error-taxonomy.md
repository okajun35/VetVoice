# SOAP Error Taxonomy (v2)

最終更新: 2026-03-05

## 目的

SOAP評価時の失敗パターンを、改善アクションに直結する5カテゴリで統一する。
旧 `MISSING_FOLLOWUP` のような広すぎるラベルを分解し、再発防止の対象を明確化する。

## 5カテゴリ定義

### 1. `PROMPT_LEAK`

- 定義: 指示文・注釈・メタ説明（例: 「SOAP形式の診療記録は以下の通り」）がSOAP本文に混入。
- 修正方針: **「指示文・注釈を出さない。SOAP本文のみ」**

### 2. `PLAN_HALLUCINATION`

- 定義: Gold / ExtractedJSON にない検査・処置・フォローアップをPlanへ追加、または必須Plan欠落。
- 修正方針: **「Goldにない検査/処置の提案をPlanに追加しない。処置なしなら処置なし」**

### 3. `DX_ASSERTION`

- 定義: 疑い・未確認の所見を断定診断へ強化。
- 修正方針: **「疑い/未確認を維持し断定しない」**

### 4. `TERMINOLOGY_ERROR`

- 定義: 用語や部位の誤った言い換え（例: CIDRを子宮内デバイス扱い）。
- 修正方針: **「CIDRは膣内挿入など用語・部位を正確に」**

### 5. `FACTUAL_ISSUE`

- 定義: 単位・スコア・略語の恣意的変換（例: `clの5` -> `5mm` 補完）。
- 修正方針: **「略語・スコア・単位を勝手にmm等へ変換しない」**

## 運用ルール

- `error_type_primary`: 主な失敗カテゴリ（単一）
- `error_tags`: 該当カテゴリの複数タグ（`|` 区切り）
- 判定対象は原則 `soap_text`（S/O/A/P）と `gold_human_note`。`llm_*` コメント本文は直接トリガーに使わない。
- `PLAN_HALLUCINATION` は語句ヒットではなく、`P` セクション項目集合と `Gold/ExtractedJSON` の許可集合の差分で判定する。
- `CIDR` 文字列のみでは `TERMINOLOGY_ERROR` にしない（用語誤用の文脈がある場合のみ）。
- `FACTUAL_ISSUE` は「単位」「スコア」等の一般語ヒットではなく、変換ミスマッチ（例: `500ミリ` -> `500mg`, `clの5` -> `5mm`）で判定する。
- 優先順位（primary決定）:
  1. `PROMPT_LEAK`
  2. `PLAN_HALLUCINATION`
  3. `DX_ASSERTION`
  4. `TERMINOLOGY_ERROR`
  5. `FACTUAL_ISSUE`
- どれにも該当しない場合は `CLEAN`

## 推奨ゲート

- `PROMPT_LEAK = 0` を必須
- `DX_ASSERTION` はゼロに近づける（最低でも前回以下）
- `PLAN_HALLUCINATION` を継続的に削減（前回比で改善）
- `CLEAN_rate >= 0.80` を維持（低下した場合は再評価）
