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

`llm_error` should be empty when the row was successfully annotated.

## Human Review Workflow

1. Check `llm_*` columns as reviewer aid.
2. Validate suggested findings against original case context.
3. Decide final scores in `score_*` columns manually.
4. Record rationale in `review_comment`.

## Notes

- LLM suggestions are assistive, not authoritative.
- Keep reviewer consistency by using one rubric across all cases.
- `over_inference` is explicitly separated to catch unsupported A/P conclusions.
