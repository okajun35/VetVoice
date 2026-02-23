# 要件定義書

## はじめに

大動物（牛）を診療する日本の獣医師が、スマートフォンを使って牛舎・農場で音声入力により診療記録を作成できるPoCシステム。QRコードで牛を特定し、音声で診療内容を入力すると、構造化JSONデータへ変換し、SOAPサマリーおよび家畜共済記録ドラフトを自動生成する。AWS上に構築し、AWS 10000 AI Ideasコンペティション（2026年2月11日セミファイナリスト発表）を目標とする。

設計原則：「JSONを正にして、SOAP/共済は派生」— 生の音声テキストと構造化JSONを正（Source of Truth）として保存し、SOAP/共済ビューは派生出力として生成する。

## 用語集

- **System**: 音声診療記録システム全体
- **Scanner**: QRコードを読み取り牛を特定するコンポーネント
- **Transcriber**: 音声をテキストに変換するコンポーネント
- **Dictionary_Expander**: 略語・同義語辞書を用いて用語を正式名称に展開するコンポーネント
- **Extractor**: テキストから構造化JSONフィールドを抽出するAIコンポーネント
- **Master_Matcher**: 抽出された病名・処置・薬剤を病名マスタ（byoumei.csv）および診療点数マスタ（shinryo_tensu_master_flat.csv）と照合し候補を提示するコンポーネント
- **SOAP_Generator**: 構造化JSONからSOAP形式のサマリーを生成するコンポーネント
- **Kyosai_Generator**: 構造化JSONから家畜共済記録ドラフトを生成するコンポーネント
- **Parser**: 構造化JSONの解析・整形を行うコンポーネント
- **Visit**: 特定の牛に対する1回の診療イベント（タイムスタンプ付き）
- **Cow**: QRコード（ID）で識別される牛エンティティ
- **Extracted_JSON**: 音声テキストから抽出された構造化データ（vital, s, o, a, pフィールドを含む）
- **Confidence**: マスタ照合時の一致度を示す数値スコア
- **Unconfirmed**: Confidenceが閾値未満のため手動確認が必要な状態
- **LLM**: 大規模言語モデル。Amazon Bedrock経由でClaude等のモデルを利用
- **Bedrock**: Amazon Bedrock。LLMへのアクセスを提供するAWSマネージドサービス
- **Entry_Point**: 開発時にシステムパイプラインの異なる段階から処理を開始するための入口

## 要件

### 要件1: QRコードによる牛の特定

**ユーザーストーリー:** 獣医師として、スマートフォンでQRコードをスキャンして牛を特定したい。それにより、正しい牛の診療記録にすばやくアクセスできる。

#### 受入基準

1. WHEN 獣医師がQRコードをスキャンする, THE Scanner SHALL QRコードからcow_idを読み取り、該当する牛の基本情報画面を表示する
2. IF QRコードが読み取れない場合, THEN THE Scanner SHALL エラーメッセージを表示し、再スキャンを促す
3. IF 読み取ったcow_idがシステムに存在しない場合, THEN THE System SHALL 新規牛登録画面を表示し、cow_id（個体識別番号）を自動入力した状態で登録フォームを提供する

### 要件2: 診療セッション（Visit）の管理

**ユーザーストーリー:** 獣医師として、牛を特定した後に新規診療を開始したい、または既存の診療記録にメモを追記したい。それにより、診療内容を正確に記録できる。

#### 受入基準

1. WHEN 牛の基本情報画面が表示される, THE System SHALL 「新規診療」と「既存診療」の選択肢を表示する
2. WHEN 獣医師が「新規診療」を選択する, THE System SHALL 新しいVisitレコードを現在のタイムスタンプで作成し、音声入力画面を表示する
3. WHEN 獣医師が「既存診療」を選択する, THE System SHALL 直近のVisitを表示し、追記可能な状態にする
4. THE System SHALL 各Visitにvisit_id、cow_id、datetime、status（進行中/完了）を記録する

### 要件3: 音声入力と文字起こし

**ユーザーストーリー:** 獣医師として、牛舎で手がふさがっている状態でも音声で診療内容を入力したい。それにより、ハンズフリーで効率的に記録できる。

#### 受入基準

1. WHEN 獣医師が音声入力を開始する, THE Transcriber SHALL 日本語音声をリアルタイムでテキストに変換する
2. WHILE 音声入力が進行中, THE System SHALL 変換中のテキストを画面に表示する
3. THE Transcriber SHALL 畜産・獣医学の専門用語（体温、症状名、薬剤名など）を正確に認識する
4. IF 音声入力中にネットワーク接続が不安定になった場合, THEN THE System SHALL 音声データをローカルに一時保存し、接続回復後に文字起こしを再試行する
5. WHEN 獣医師が音声入力を終了する, THE System SHALL 生のテキスト（transcript_raw）をVisitレコードに保存する
6. WHEN ネットワーク接続が利用できない状態でVisitデータ（transcript_raw、extracted_json等）を保存しようとする場合, THE System SHALL Visitデータ全体をローカルに一時保存し、接続回復後に自動的にアップロードを再試行する

### 要件4: 略語・同義語辞書による用語展開

**ユーザーストーリー:** 獣医師として、日常的に使う略語（例：静注、アンピ）で話しても正しく認識されたい。それにより、自然な話し方で記録できる。

#### 受入基準

1. WHEN 文字起こしテキストが生成される, THE Dictionary_Expander SHALL カスタマイズ可能な辞書を参照し、略語・同義語を正式名称に展開する。1つの正式名称に対して複数の略語・同義語を登録可能とする
2. THE Dictionary_Expander SHALL 「静注」を「静脈注射」、「アンピ」を「アンピシリン」のような一般的な獣医学略語の展開に対応する
3. THE System SHALL 辞書エントリの追加・編集・削除機能を提供する
4. WHEN 辞書に該当する略語が存在しない場合, THE Dictionary_Expander SHALL 元のテキストをそのまま保持する
5. THE System SHALL 辞書をCSV形式（`assets/dictionary.csv`）で管理し、1行につき1つの正式名称と複数の略語・同義語をカンマ区切りで記述可能とする（例: "静脈注射,静注,IV,静脈内注射"）

### 要件5: 構造化JSONへの抽出

**ユーザーストーリー:** 獣医師として、音声で話した診療内容が自動的に構造化データに変換されてほしい。それにより、手動でフォームに入力する手間が省ける。

#### 受入基準

1. WHEN 辞書展開済みテキストが生成される, THE Extractor SHALL テキストからvital（体温など）、s（主観：稟告）、o（客観：所見）、a（評価：病名候補）、p（計画：処置・薬剤候補）のフィールドを抽出し、Extracted_JSONとして構造化する
2. THE Extractor SHALL 体温値を数値（摂氏）として抽出する
3. IF テキストから特定のフィールドが抽出できない場合, THEN THE Extractor SHALL 該当フィールドをnullとし、欠落フィールドをユーザーに通知する
4. THE System SHALL Extracted_JSONをVisitレコードに保存する

### 要件6: 構造化JSONの解析と整形（ラウンドトリップ）

**ユーザーストーリー:** 開発者として、構造化JSONの解析・整形が正確であることを保証したい。それにより、データの整合性を維持できる。

#### 受入基準

1. THE Parser SHALL Extracted_JSONを解析し、有効なExtracted_JSONオブジェクトに変換する
2. IF 無効なExtracted_JSONが入力された場合, THEN THE Parser SHALL 具体的なエラー内容を返す
3. THE Parser SHALL Extracted_JSONオブジェクトを有効なJSON文字列に整形する
4. すべての有効なExtracted_JSONオブジェクトに対して、解析→整形→再解析の結果が元のオブジェクトと等価であること（ラウンドトリップ特性）

### 要件7: マスタデータによる候補照合

**ユーザーストーリー:** 獣医師として、入力した病名・処置・薬剤が公式マスタデータと照合され、正確な候補が提示されてほしい。それにより、家畜共済の記録に正しいコードを使用できる。

#### 受入基準

1. WHEN Extracted_JSONのaフィールド（病名候補）が生成される, THE Master_Matcher SHALL byoumei.csvの病名マスタと照合し、上位3件の候補をConfidenceスコア付きで提示する
2. WHEN Extracted_JSONのpフィールド（処置・薬剤候補）が生成される, THE Master_Matcher SHALL shinryo_tensu_master_flat.csvの診療点数マスタと照合し、上位3件の候補をConfidenceスコア付きで提示する
3. IF Confidenceスコアが閾値未満の場合, THEN THE Master_Matcher SHALL 該当候補をUnconfirmedとしてマークし、自動確定を行わない
4. THE Master_Matcher SHALL 各候補にマスタデータ上のコード（大分類・中分類・小分類またはsection_id・item_no）を付与する

### 要件8: SOAPサマリーの生成

**ユーザーストーリー:** 獣医師として、診療内容がSOAP形式で自動的にまとめられてほしい。それにより、標準的な形式で診療記録を確認・共有できる。

#### 受入基準

1. WHEN Extracted_JSONが確定する, THE SOAP_Generator SHALL Extracted_JSONからSOAP形式（Subjective, Objective, Assessment, Plan）のサマリーテキストを生成する
2. THE SOAP_Generator SHALL 生成したSOAPテキストをVisitレコードのsoap_textフィールドに保存する
3. THE SOAP_Generator SHALL Extracted_JSONの各フィールド（s, o, a, p）を対応するSOAPセクションにマッピングする
4. WHEN Extracted_JSONにUnconfirmedの候補が含まれる場合, THE SOAP_Generator SHALL SOAPテキスト内で該当箇所を「未確認」と明示する

### 要件9: 家畜共済記録ドラフトの生成

**ユーザーストーリー:** 獣医師として、診療内容から家畜共済の記録ドラフトが自動生成されてほしい。それにより、事務作業の負担を軽減できる。

#### 受入基準

1. WHEN Extracted_JSONが確定する, THE Kyosai_Generator SHALL Extracted_JSONから家畜共済記録ドラフトを生成する
2. THE Kyosai_Generator SHALL 最低限必要なフィールド（牛ID、診療日、病名、処置内容、使用薬剤、診療点数）を含む
3. THE Kyosai_Generator SHALL マスタ照合で確定した病名コード・処置コードを家畜共済記録に反映する
4. WHEN Unconfirmedの候補が含まれる場合, THE Kyosai_Generator SHALL 該当フィールドを空欄とし、手動入力を促す注記を付与する
5. THE Kyosai_Generator SHALL 生成したドラフトをVisitレコードのkyosai_textフィールドに保存する

### 要件10: ユーザーによる確認・編集と保存

**ユーザーストーリー:** 獣医師として、自動生成された記録を確認・編集してから保存したい。それにより、最終的な記録の正確性を担保できる。

#### 受入基準

1. WHEN SOAPサマリーと家畜共済ドラフトが生成される, THE System SHALL 確認・編集画面を表示する
2. THE System SHALL Unconfirmedの候補をハイライト表示し、獣医師に確認を促す
3. WHEN 獣医師がUnconfirmed候補を手動で選択・確定する, THE System SHALL Extracted_JSONのConfidenceを更新し、Unconfirmedマークを解除する
4. WHEN 獣医師が「保存」を実行する, THE System SHALL Visitレコード（transcript_raw、extracted_json、soap_text、kyosai_text、status）を永続化する
5. THE System SHALL 保存済みのVisitレコードにおいて、transcript_rawとextracted_jsonを常に保持する（削除不可）

### 要件11: 処理性能

**ユーザーストーリー:** 獣医師として、音声入力からSOAPドラフト表示までの待ち時間を短くしたい。それにより、診療の流れを妨げずに記録できる。

#### 受入基準

1. WHEN 音声入力が完了する, THE System SHALL 文字起こし、辞書展開、構造化抽出、マスタ照合、SOAPドラフト生成までの一連の処理を30秒以内に完了する（一般的なケース）
2. WHILE 処理が進行中, THE System SHALL 処理の進捗状況をユーザーに表示する

### 要件12: データ保全とセキュリティ

**ユーザーストーリー:** 獣医師として、診療記録が安全に保存され、追跡可能であってほしい。それにより、記録の信頼性を確保できる。

#### 受入基準

1. THE System SHALL 保存データを暗号化して保管する（at rest encryption）
2. THE System SHALL PoC用の最小限の認証機能（テストユーザー）を提供する
3. THE System SHALL 各Visitレコードにおいて、生のテキスト（transcript_raw）を監査証跡として保持する
4. THE System SHALL Extracted_JSONを正（Source of Truth）として保存し、SOAPテキストおよび家畜共済ドラフトを派生出力として管理する

### 要件13: データモデル

**ユーザーストーリー:** 開発者として、牛と診療記録のデータモデルが明確に定義されていてほしい。それにより、一貫性のあるデータ管理ができる。

#### 受入基準

1. THE System SHALL Cowエンティティ（cow_id（10桁個体識別番号、先頭0あり、文字列として保存）、ear_tag_no（耳標番号、任意）、sex（性別: 雌/雄/去勢）、breed（品種）、birth_date（生年月日）、parity（産次/分娩回数、任意）、last_calving_date（最終分娩日、任意）、name（牛の名前、任意）、farm（農場名、任意））を管理する
2. THE System SHALL Visitエンティティ（visit_id、cow_id、datetime、transcript_raw、extracted_json、soap_text、kyosai_text、status）を管理する
3. THE System SHALL Extracted_JSONにvital（temp_c）、s（稟告）、o（所見）、a（病名候補＋Confidence）、p（処置・薬剤候補＋Confidence）のフィールドを含める
4. WHEN Visitが保存される, THE System SHALL visit_idとcow_idの関連を維持し、1頭の牛に対して複数のVisitを紐付け可能とする

### 要件14: 開発用の複数エントリポイント

**ユーザーストーリー:** 開発者として、開発・デバッグ時にパイプラインの任意の段階から処理を開始したい。それにより、各コンポーネントを個別にテスト・検証できる。

#### 受入基準

1. THE System SHALL 本番フロー（QRスキャン→音声入力→全パイプライン処理）をデフォルトのEntry_Pointとして提供する
2. WHERE 開発モードが有効, THE System SHALL テキスト直接入力のEntry_Pointを提供し、QRスキャンと音声入力をスキップしてトランスクリプトテキストを直接貼り付け可能とする
3. WHERE 開発モードが有効, THE System SHALL 音声ファイルアップロードのEntry_Pointを提供し、QRスキャンをスキップして音声ファイルからパイプライン処理を開始可能とする
4. WHERE 開発モードが有効, THE System SHALL 構造化JSON入力のEntry_Pointを提供し、QRスキャン・音声入力・構造化抽出をスキップしてSOAP生成および家畜共済記録生成を直接テスト可能とする
5. WHEN 開発用Entry_Pointから処理が開始される, THE System SHALL スキップされた段階以降のパイプライン処理を本番フローと同一のロジックで実行する

### 要件15: LLM利用（Amazon Bedrock）の明確化

**ユーザーストーリー:** 開発者として、各コンポーネントがLLMを利用するか否かを明確に把握したい。それにより、コスト管理・レイテンシ最適化・テスト戦略を適切に設計できる。

#### 受入基準

1. THE Extractor SHALL Bedrock経由でLLMを利用し、フリーテキストのトランスクリプトから構造化JSONフィールド（vital, s, o, a, p）を抽出する
2. THE SOAP_Generator SHALL Bedrock経由でLLMを利用し、構造化JSONから自然な日本語のSOAPサマリーを生成する
3. THE Kyosai_Generator SHALL Bedrock経由でLLMを利用し、構造化JSONから家畜共済記録ドラフトを生成する
4. THE Dictionary_Expander SHALL LLMを使用せず、辞書ルックアップ（ルールベース）により略語・同義語の展開を行う
5. THE Master_Matcher SHALL LLMを使用せず、文字列類似度・ファジーマッチングによりCSVマスタデータとの照合を行う

### 要件16: 診療タイプ別テンプレート

**ユーザーストーリー:** 獣医師として、診療タイプに応じた定型テンプレートでSOAPや共済記録が生成されてほしい。それにより、出力の一貫性が向上し、必要な情報の漏れを防げる。

#### 受入基準

1. THE System SHALL 以下の最低限のテンプレートを提供する：一般診療SOAP、繁殖（妊娠鑑定・分娩）SOAP、蹄病SOAP、家畜共済テンプレート（必須フィールド強制）
2. WHEN Extracted_JSONが生成される, THE System SHALL 診療内容に基づいて適切なテンプレートを自動選択する（獣医師による手動変更も可能）
3. THE System SHALL テンプレートを構造化JSONから生成する（テンプレートは派生出力であり、構造化JSONがSource of Truthである原則を維持する）
4. WHEN テンプレートに必須フィールドが定義されている場合, THE System SHALL 該当フィールドが欠落している場合にユーザーに通知する

### 要件17: 診療履歴サマリー

**ユーザーストーリー:** 獣医師として、牛の詳細画面で直近の診療履歴をワンタップで確認したい。それにより、新しい診療を開始する前に素早く文脈を把握できる。

#### 受入基準

1. WHEN 獣医師が牛の詳細画面で「履歴サマリー」ボタンをタップする, THE System SHALL 直近3件のVisitから主要な臨床イベント、診断名、処置・薬剤のサマリーを生成する
2. THE System SHALL サマリーを保存済みの構造化JSON（extracted_json）から生成する
3. IF 該当する牛のVisitが3件未満の場合, THEN THE System SHALL 存在するVisitのみでサマリーを生成する
4. IF 該当する牛のVisitが0件の場合, THEN THE System SHALL 「診療履歴がありません」と表示する

### 要件18: Visit再利用

**ユーザーストーリー:** 獣医師として、前回の診療内容をテンプレートとして再利用したい。それにより、同じ処置を複数の牛に行う場合に入力を効率化できる。

#### 受入基準

1. WHEN 獣医師が新規診療を開始する際, THE System SHALL 「前回のVisitをテンプレートとして使用」オプションを提供する
2. WHEN 獣医師がVisit再利用を選択する, THE System SHALL 選択されたVisitのextracted_jsonをコピーし、cow_idとdatetimeを除外した状態で新規Visitの初期値として設定する
3. THE System SHALL 再利用されたextracted_jsonの各フィールドを編集可能な状態で表示する
4. WHEN Visit再利用で作成された新規Visitが保存される, THE System SHALL 元のVisitとは独立した新しいvisit_idとdatetimeを付与する

### 要件19: 牛の登録方法

**ユーザーストーリー:** 獣医師として、新しい牛をシステムに登録したい。それにより、QRコードスキャン後に牛の情報を管理できる。

#### 受入基準

1. WHEN QRコードをスキャンしてcow_idが取得されるが、システムに該当する牛が存在しない場合, THE System SHALL 新規牛登録画面を表示し、cow_id（個体識別番号）を自動入力した状態で登録フォームを提供する
2. THE System SHALL 新規牛登録時に以下の必須フィールドの入力を求める: cow_id（10桁個体識別番号）、sex（性別）、breed（品種）、birth_date（生年月日）
3. THE System SHALL 新規牛登録時に以下の任意フィールドの入力を許可する: ear_tag_no（耳標番号）、parity（産次）、last_calving_date（最終分娩日）、name（牛の名前）、farm（農場名）
4. WHEN 獣医師が牛の登録を完了する, THE System SHALL 牛の基本情報画面に遷移し、診療セッションの開始を可能にする
5. THE System SHALL 牛の詳細画面から個体情報の編集機能を提供する
6. THE System SHALL cow_id（個体識別番号）が10桁の文字列であることをバリデーションする（先頭0を許容）
