# 要件定義書

## はじめに

VetVoiceシステムに牛の管理機能を追加する。現在はQRスキャンからのみ牛にアクセスできるが、本機能により牛の一覧表示、新規登録（QRスキャン不要）、情報編集、QRコード生成・印刷が可能になる。これにより、初回登録からQRコード印刷、日常の牛管理までの運用フローを完結させる。

## 用語集

- **Cow_List_Screen**: 登録済みの牛を一覧表示し、検索フィルタで絞り込みが可能な画面
- **Cow_Registration_Form**: 個体識別番号（10桁数字）を入力して牛を新規登録するフォームコンポーネント（既存の `CowRegistrationForm` を再利用）
- **Cow_Edit_Form**: 登録済み牛の情報を編集するフォームコンポーネント
- **QR_Code_Generator**: 個体識別番号からQRコードを生成し、画面表示・印刷を行うコンポーネント
- **Cow_Model**: Amplify Dataスキーマで定義された牛データモデル（cowId, earTagNo, sex, breed, birthDate, parity, lastCalvingDate, name, farm）
- **Search_Filter**: 牛一覧画面でテキスト入力により牛を絞り込むフィルタ機能
- **Individual_ID**: 牛の個体識別番号（10桁の数字、先頭0あり）

## 要件

### 要件1: 牛一覧画面の表示

**ユーザーストーリー:** 獣医師として、登録済みの牛を一覧で確認したい。目的の牛を素早く見つけて情報にアクセスするためである。

#### 受入基準

1. WHEN 認証済みユーザーが牛一覧画面に遷移した場合、THE Cow_List_Screen SHALL Cow_Modelから全登録牛を取得し一覧表示する
2. THE Cow_List_Screen SHALL 各牛について Individual_ID、名前（登録済みの場合）、品種、農場名を表示する
3. WHEN 牛が1頭も登録されていない場合、THE Cow_List_Screen SHALL 「登録済みの牛がありません」というメッセージを表示する
4. WHEN データ取得中にエラーが発生した場合、THE Cow_List_Screen SHALL エラーメッセージを表示し再取得ボタンを提供する
5. WHEN データ取得中の場合、THE Cow_List_Screen SHALL ローディング状態を表示する

### 要件2: 牛一覧の検索フィルタ

**ユーザーストーリー:** 獣医師として、多数の牛の中から目的の牛を素早く見つけたい。テキスト入力で絞り込みを行うためである。

#### 受入基準

1. THE Search_Filter SHALL テキスト入力フィールドを提供する
2. WHEN ユーザーがSearch_Filterにテキストを入力した場合、THE Cow_List_Screen SHALL Individual_ID、名前、品種、農場名のいずれかに部分一致する牛のみを表示する
3. WHEN Search_Filterの入力が空の場合、THE Cow_List_Screen SHALL 全登録牛を表示する
4. WHEN フィルタ結果が0件の場合、THE Cow_List_Screen SHALL 「該当する牛が見つかりません」というメッセージを表示する

### 要件3: 牛の新規登録

**ユーザーストーリー:** 獣医師として、QRスキャンなしで牛を新規登録したい。初めて診療する牛の情報を事前に登録するためである。

#### 受入基準

1. WHEN ユーザーが牛一覧画面から「新規登録」ボタンを押した場合、THE Cow_List_Screen SHALL Cow_Registration_Formを表示する
2. THE Cow_Registration_Form SHALL 既存の CowRegistrationForm コンポーネントを再利用する
3. WHEN 登録が成功した場合、THE Cow_Registration_Form SHALL 牛一覧画面に戻り、新規登録した牛を一覧に含めて表示する
4. WHEN 登録がキャンセルされた場合、THE Cow_Registration_Form SHALL 牛一覧画面に戻る

### 要件4: 牛情報の編集

**ユーザーストーリー:** 獣医師として、登録済みの牛の情報を編集したい。誤入力の修正や情報の更新を行うためである。

#### 受入基準

1. WHEN ユーザーが牛一覧画面で牛を選択した場合、THE Cow_List_Screen SHALL 牛の詳細画面を表示する
2. WHEN ユーザーが詳細画面で「編集」ボタンを押した場合、THE Cow_Edit_Form SHALL 現在の牛情報をフォームに事前入力した状態で表示する
3. THE Cow_Edit_Form SHALL Individual_IDを編集不可（読み取り専用）として表示する
4. WHEN 編集内容の保存が成功した場合、THE Cow_Edit_Form SHALL 更新後の牛情報を詳細画面に反映する
5. WHEN 編集内容の保存中にエラーが発生した場合、THE Cow_Edit_Form SHALL エラーメッセージを表示し入力内容を保持する
6. WHEN 編集がキャンセルされた場合、THE Cow_Edit_Form SHALL 変更を破棄し詳細画面に戻る

### 要件5: QRコード生成

**ユーザーストーリー:** 獣医師として、牛の個体識別番号からQRコードを生成したい。印刷して耳標に貼付し、日常の診療でスキャンするためである。

#### 受入基準

1. WHEN ユーザーが牛の詳細画面で「QRコード生成」ボタンを押した場合、THE QR_Code_Generator SHALL 該当牛のIndividual_IDをエンコードしたQRコードを画面に表示する
2. THE QR_Code_Generator SHALL QRコードの下にIndividual_IDをテキストで表示する
3. THE QR_Code_Generator SHALL フロントエンドのみでQRコードを生成する（サーバーサイド処理を行わない）
4. WHEN ユーザーが「印刷」ボタンを押した場合、THE QR_Code_Generator SHALL ブラウザの印刷ダイアログを表示し、QRコードとIndividual_IDを印刷可能にする
5. THE QR_Code_Generator SHALL 既存のQRScannerコンポーネントで読み取り可能なQRコードを生成する

### 要件6: 画面遷移とナビゲーション

**ユーザーストーリー:** 獣医師として、牛管理画面とQRスキャン画面を簡単に切り替えたい。状況に応じて適切な操作方法を選択するためである。

#### 受入基準

1. THE App SHALL メインナビゲーションに牛一覧画面へのアクセス手段を提供する
2. WHEN ユーザーが牛一覧画面から牛を選択し詳細画面に遷移した場合、THE Cow_List_Screen SHALL 「戻る」ボタンで牛一覧画面に戻れるようにする
3. WHEN ユーザーが牛詳細画面から「診療開始」を選択した場合、THE App SHALL 既存のVisitManager画面に遷移する
4. WHEN ユーザーが牛詳細画面から牛一覧に戻った場合、THE Cow_List_Screen SHALL 最新の牛データを表示する
