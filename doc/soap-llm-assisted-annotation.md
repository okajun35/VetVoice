# SOAP LLM-Assisted Annotation Guide

## Goal

Use LLM as an annotation assistant for SOAP evaluation while keeping final judgment by human reviewers.

The assistant should only do:

1. Difference extraction (`gold_human_note` vs `soap_text`)
2. Checklist-style issue detection
3. Suggested sub-scores (for reviewer reference)

Final `score_*` values are decided by human.

## Inputs

The script reads `soap-scoring.template.csv` and uses these fields per row:

- `gold_human_note`
- `transcript_expanded` (reference context only)
- `soap_text`

## Command

```bash
npm run eval:soap:assist -- \
  tmp/soap-model-compare/soap-scoring.template.csv \
  tmp/soap-model-compare \
  --model us.anthropic.claude-sonnet-4-6
```

Recommended model: `us.anthropic.claude-sonnet-4-6` (quality-first annotation).

## Retry Options

Use retries for transient network issues or invalid JSON output:

```bash
npm run eval:soap:assist -- \
  tmp/soap-model-compare/soap-scoring.template.csv \
  tmp/soap-model-compare \
  --model us.anthropic.claude-sonnet-4-6 \
  --max-retries 2 \
  --retry-delay-ms 1200
```

## Output

The script writes:

- `soap-scoring.llm-assisted.csv`
- `soap-scoring.llm-assisted.latest.json`

Added columns include:

- `llm_factual_issues`
- `llm_missing_info`
- `llm_over_inference`
- `llm_safety_risk`
- `llm_structure_note`
- `llm_suggested_factuality_1to5`
- `llm_suggested_completeness_1to5`
- `llm_suggested_readability_1to5`
- `llm_suggested_safety_1to5`
- `llm_suggested_over_inference_1to5`
- `llm_model_requested`
- `llm_model_resolved`
- `llm_error`
- `error_type_primary` (single primary class)
- `error_tags` (`|` separated multi-label tags)

`llm_error` should be empty when the row was successfully annotated.

Error taxonomy:
- `PROMPT_LEAK`
- `PLAN_HALLUCINATION`
- `DX_ASSERTION`
- `TERMINOLOGY_ERROR`
- `FACTUAL_ISSUE`
- `CLEAN`

See `doc/soap-error-taxonomy.md` for definitions and primary-priority rules.

Classification implementation policy:

- `error_tags` are determined primarily from `soap_text` (S/O/A/P sections) plus `gold_human_note`.
- `llm_*` helper texts are not used as direct tag triggers to avoid keyword-based false positives.
- `PLAN_HALLUCINATION` is computed by set-diff between normalized `P` entities and allowed entities from `gold_human_note` + `extracted_json.p`.
- `FACTUAL_ISSUE` is triggered by specific transformation mismatches (e.g. ambiguous unit/score conversion), not by generic words like `単位` / `スコア`.
- `TERMINOLOGY_ERROR` does not trigger on `CIDR` token alone.

## Metrics and Gate

Use the metrics script to calculate error rates and optional baseline diffs:

```bash
npm run eval:soap:metrics -- \
  tmp/soap-model-compare/soap-scoring.llm-assisted.csv \
  --baseline tmp/soap-model-compare-20260304/soap-scoring.codex-ready-eval.csv \
  --phase 1 \
  --json-out tmp/soap-model-compare/soap-quality.metrics.latest.json
```

Gate check (non-zero exit on failure):

```bash
npm run eval:soap:gate -- tmp/soap-model-compare/soap-scoring.llm-assisted.csv
```

Default thresholds:

- Hard gate:
  - `PROMPT_LEAK_rate <= 0`
  - `DX_ASSERTION_rate <= 0.05`
  - `empty_soap_rate <= 0`
  - `CLEAN_rate >= 0.80`
- Soft gate (`phase 1`):
  - `PLAN_HALLUCINATION_rate <= 0.35`
  - `TERMINOLOGY_ERROR_rate <= 0.10`
  - `FACTUAL_ISSUE_rate <= 0.20`

Optional:

- `--phase 2`: stricter soft thresholds
- `--enforce-score-floors`: enforce score mean floors for `safety/factuality/overall`

## Human Review Workflow

1. Check `llm_*` columns as reviewer aid.
2. Validate suggested findings against original case context.
3. Decide final scores in `score_*` columns manually.
4. Record rationale in `review_comment`.

## Notes

- LLM suggestions are assistive, not authoritative.
- Keep reviewer consistency by using one rubric across all cases.
- `over_inference` is explicitly separated to catch unsupported A/P conclusions.
