#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
VOCAB_NAME="${TRANSCRIBE_VOCABULARY_NAME:-vetvoice-ja-vocab-v1}"
LANG_CODE="${TRANSCRIBE_LANGUAGE_CODE:-ja-JP}"
LOCAL_FILE="${TRANSCRIBE_VOCAB_FILE:-assets/transcribe-vocabulary-vetvoice-ja-v1.txt}"
S3_BUCKET="${TRANSCRIBE_VOCAB_BUCKET:-}"
S3_KEY="${TRANSCRIBE_VOCAB_S3_KEY:-transcribe/transcribe-vocabulary-vetvoice-ja-v1.txt}"

if [[ -z "${S3_BUCKET}" ]]; then
  echo "ERROR: TRANSCRIBE_VOCAB_BUCKET is required."
  echo "example: TRANSCRIBE_VOCAB_BUCKET=my-bucket npm run transcribe:vocab:update"
  exit 1
fi

if [[ ! -f "${LOCAL_FILE}" ]]; then
  echo "ERROR: vocabulary file not found: ${LOCAL_FILE}"
  exit 1
fi

S3_URI="s3://${S3_BUCKET}/${S3_KEY}"

echo "Uploading vocabulary file to ${S3_URI} ..."
aws s3 cp "${LOCAL_FILE}" "${S3_URI}" --region "${REGION}"

if aws transcribe get-vocabulary \
  --region "${REGION}" \
  --vocabulary-name "${VOCAB_NAME}" \
  >/dev/null 2>&1; then
  echo "Updating existing vocabulary: ${VOCAB_NAME}"
  aws transcribe update-vocabulary \
    --region "${REGION}" \
    --vocabulary-name "${VOCAB_NAME}" \
    --language-code "${LANG_CODE}" \
    --vocabulary-file-uri "${S3_URI}" \
    --query '{Name:VocabularyName,State:VocabularyState}'
else
  echo "Vocabulary not found. Creating new vocabulary: ${VOCAB_NAME}"
  aws transcribe create-vocabulary \
    --region "${REGION}" \
    --vocabulary-name "${VOCAB_NAME}" \
    --language-code "${LANG_CODE}" \
    --vocabulary-file-uri "${S3_URI}" \
    --query '{Name:VocabularyName,State:VocabularyState}'
fi

echo "Done. Check status with: npm run transcribe:vocab:status"
