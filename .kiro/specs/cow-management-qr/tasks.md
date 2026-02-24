# 実装計画: 牛管理・QRコード生成機能

## 概要

既存のVetVoiceアプリケーションに牛一覧管理画面とQRコード生成・印刷機能を追加する。フロントエンドのみの変更で、バックエンドスキーマの変更は不要。既存のAmplify Data（Cowモデル）とCowRegistrationFormコンポーネントを最大限再利用する。

実装言語: TypeScript
フレームワーク: React 18 + Amplify Gen 2
テスト: Vitest + fast-check

## タスク

- [x] 1. 検索フィルタユーティリティの実装
  - [x] 1.1 `filterCows` 関数を実装
    - `src/lib/cow-filter.ts` を作成
    - cowId、name、breed、farm の4フィールドで部分一致検索（大文字小文字無視）
    - 空クエリ時は全件返却
    - _要件: 2.1, 2.2, 2.3_

  - [x] 1.2 `filterCows` のプロパティテストを作成
    - `tests/property/cow-filter.property.test.ts` を作成
    - **Property 1: フィルタは一致する牛のみを返す**
    - **Property 2: 空クエリはフィルタなし（恒等性）**
    - **Property 3: フィルタ結果は元リストの部分集合**
    - **検証: 要件 2.2, 2.3**

  - [x] 1.3 `filterCows` のユニットテストを作成
    - `tests/unit/cow-filter.test.ts` を作成
    - 具体的な検索例、空リスト、空クエリ、大文字小文字、フィルタ結果0件
    - _要件: 2.2, 2.3, 2.4_

- [x] 2. fast-check ジェネレータの追加
  - `tests/helpers/generators.ts` に `cowIdArb` と `cowDataArb` ジェネレータを追加
  - cowIdArb: 10桁数字文字列（先頭0あり）
  - cowDataArb: cowId, name, breed, farm 等のフィールドを持つレコード
  - _要件: 2.2, 5.1_

- [x] 3. チェックポイント - フィルタロジックの動作確認
  - すべてのテストが成功することを確認、質問があればユーザーに確認

- [x] 4. `qrcode` パッケージのインストールとQRコード表示コンポーネントの実装
  - [x] 4.1 `qrcode` npm パッケージと型定義をインストール
    - `npm install qrcode` と `npm install -D @types/qrcode` を実行
    - _要件: 5.3_

  - [x] 4.2 QRCodeDisplay コンポーネントを実装
    - `src/components/QRCodeDisplay.tsx` を作成
    - `qrcode` ライブラリで cowId をCanvas にエンコード（errorCorrectionLevel: 'M', width: 256）
    - QRコードの下に cowId テキストを表示
    - 「印刷」ボタンで `window.print()` を呼び出し
    - 「閉じる」ボタンで `onClose` コールバック
    - CSS `@media print` でQRコード部分のみ印刷
    - _要件: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.3 QRコードのプロパティテストを作成
    - `tests/property/qr-code.property.test.ts` を作成
    - **Property 4: QRコードラウンドトリップ**
    - **検証: 要件 5.1, 5.5**

- [x] 5. CowRegistrationForm の編集モード拡張
  - [x] 5.1 CowRegistrationForm に `mode` と `initialData` props を追加
    - `src/components/CowRegistrationForm.tsx` を修正
    - `mode` prop（'create' | 'edit'、デフォルト: 'create'）を追加
    - `initialData` prop（Partial<FormState>）を追加
    - 編集モード時: cowId を読み取り専用、`Cow.update()` を使用、ボタンテキストを「更新する」に変更
    - 既存の create モード動作は後方互換性を維持
    - _要件: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 編集モードのユニットテストを作成
    - `tests/unit/cow-registration-form.test.ts` を作成
    - 編集モード時の初期値設定、cowId読み取り専用、update API呼び出し確認
    - **Property 5 の具体例検証: 編集フォーム初期値の一致**
    - _要件: 4.2, 4.3_

- [x] 6. CowDetailView コンポーネントの実装
  - `src/components/CowDetailView.tsx` を作成
  - `Cow.get({ cowId })` で牛データを取得・表示
  - 全フィールド表示（個体識別番号、耳標番号、性別、品種、生年月日、産次、最終分娩日、名前、農場名）
  - 「編集」「QRコード生成」「診療開始」「戻る」ボタンを配置
  - ローディング状態とエラー状態のハンドリング
  - _要件: 4.1, 4.2, 5.1, 6.2, 6.3_

- [x] 7. CowListScreen コンポーネントの実装
  - [x] 7.1 CowListScreen メインコンテナを実装
    - `src/components/CowListScreen.tsx` を作成
    - 内部サブビュー管理（list, detail, edit, register）
    - `Cow.list()` で全牛取得、`filterCows` で検索フィルタ適用
    - 牛一覧表示（cowId、name、breed、farm）
    - 「新規登録」ボタンで CowRegistrationForm へ遷移
    - 牛選択で CowDetailView へ遷移
    - ローディング状態、エラー状態（再取得ボタン付き）、空リストメッセージの表示
    - フィルタ結果0件時の「該当する牛が見つかりません」メッセージ
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 CowListScreen 内のサブビュー統合
    - detail サブビュー: CowDetailView を表示
    - edit サブビュー: CowRegistrationForm（mode='edit'）を表示
    - register サブビュー: CowRegistrationForm（mode='create'）を表示
    - QRCodeDisplay をモーダル/オーバーレイで表示
    - 各サブビューからの戻り遷移で牛データを再取得
    - CowDetailView から「診療開始」で `onNavigateToVisit` コールバック
    - _要件: 3.3, 3.4, 4.4, 4.6, 5.1, 6.2, 6.4_

- [x] 8. App.tsx のナビゲーション拡張
  - `AppView` 型に `'cow_list'` を追加
  - ナビゲーションバーに「牛一覧」ボタンを追加
  - `cow_list` ビュー時に `CowListScreen` をレンダリング
  - CowListScreen から VisitManager への遷移を接続
  - _要件: 6.1, 6.2, 6.3, 6.4_

- [x] 9. チェックポイント - 全機能の統合確認
  - すべてのテストが成功することを確認（既存267テスト含む）
  - 質問があればユーザーに確認

## 注記

- `*` マークの付いたサブタスクはオプションであり、MVP実装時にスキップ可能
- 各タスクは要件番号を参照し、トレーサビリティを確保
- プロパティテストは設計書の正当性プロパティに対応
- バックエンド（GraphQLスキーマ、Lambda関数等）の変更は不要
- 既存の267テストが引き続きパスすることを各チェックポイントで確認
