#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
VOCAB_NAME="${TRANSCRIBE_VOCABULARY_NAME:-vetvoice-ja-vocab-v1}"

aws transcribe get-vocabulary \
  --region "${REGION}" \
  --vocabulary-name "${VOCAB_NAME}" \
  --query '{Name:VocabularyName,State:VocabularyState,Failure:FailureReason,LanguageCode:LanguageCode,LastModifiedTime:LastModifiedTime}'
