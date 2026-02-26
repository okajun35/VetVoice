# 略語レキシコン運用（abbrev_lexicon.json）

最終更新: 2026-02-27

## 目的

`assets/abbrev_lexicon.json` は、略語・専門語の候補を一元管理するための
「正本（source of truth）」です。

対象:
- 繁殖ショートハンド（CL, CIDR, V=0, UV+）
- バイタル略語（HR, RR, T）
- 代謝/乳房炎で頻出する短縮語

## 位置づけ

このファイルは **既存の辞書運用に追加** するもので、既存資産を置き換えません。

- 継続利用: `assets/dictionary.csv`
- 継続利用: `assets/normalization_rules.json`
- 継続利用: `assets/transcribe-vocabulary-vetvoice-ja-v1.txt`

## JSONフィールド

- `canonical`: 正規表記
- `meaning_ja`: 日本語意味
- `category`: `repro | vital | mastitis | metabolic` など
- `synonyms_audio`: 音声入力での言い方候補
- `synonyms_text`: テキスト上の揺れ候補
- `notes`: 運用メモ

## 運用ルール

1. 先に `abbrev_lexicon.json` を更新する
2. 実運用反映は既存3ファイルへ必要分を追記する
3. 暫定語（例: `MS`, `UV+`）は意味確定まで強い自動変換を避ける

## 反映時の注意

- `synonyms_text` をそのまま機械変換すると誤置換が起きる場合があります
  - 例: `心拍数 -> HR` のような可読性低下
- まずは「誤認識が多い語」だけを選び、局所的な正規化ルールで反映してください
- 追加後は必ず同一症例で前後比較を行ってください

