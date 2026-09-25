export type EquipType = "ac" | "multi";
export type BizType = "business" | "personal";
export type SizeType = "sme" | "middle" | "large";
export type RefriType = "r22" | "r410a" | "r32" | "unknown";
export type EntityType = "corporation" | "sole_proprietor";
export type UpdatePlan = "planned" | "considering" | "none";
export type DesiredTiming = "within_1m" | "within_3m" | "within_6m" | "within_12m" | "undecided";
export type ProgramStatus = "open" | "upcoming" | "closed" | "unknown" | "suspended";
export type VerificationState = "verified" | "needs_review" | "stale" | "unavailable";

/* ───────── 契約の進み具合 ─────────
   2026-09-16 EHC-0039 修正2 でここへ移した（定義は lib/diagnosisState.ts にあった）。

   移した理由。補助金は交付決定前に発注・契約・着工していると対象外になる制度が多く、
   これは「参考情報」ではなく適格性の判定材料そのものである。
   判定の持ち主は lib/eligibility.ts で、その入力は MatchInput（このファイル）。
   入力状態側（diagnosisState.ts）にだけ型があると、計算入力へ渡す道が型の上で存在せず、
   実際 v19 時点では画面が聞いた答えが判定へ届いていなかった。

   null は「未回答」。未回答を not_yet（まだ発注していない）で埋めないこと。
   埋めた瞬間に、こちらが立てた仮定が「発注前であることを確認済み」として
   適合度・補助額の根拠になる。 */
/** 適合チェックの回答（はい／いいえ／分からない） */
export type SelfAnswer = "yes" | "no" | "unknown";

export type ContractStatus =
  | "not_yet" // まだ発注・契約していない
  | "quoting" // 見積を取っている最中（契約はしていない）
  | "contracted" // すでに契約・発注済み
  | null; // 未回答

// AIヒアリングの冒頭で伺う「今日のご関心」。以降の案内先（タブ/CTA）と提案書・メールの記載に使う
export type InterestType = "subsidy" | "energy" | "dropin" | "update" | "unsure";
export const INTEREST_LABELS: Record<InterestType, string> = {
  subsidy: "補助金でいくら安くなるか",
  energy: "電気代を下げたい",
  dropin: "冷媒だけ入替（ドロップイン）",
  update: "機器の入替・更新工事",
  unsure: "まだ決めていない・おまかせ",
};

export interface Subsidy {
  id: string;
  name: string;
  org: string;
  period: string;
  rate: string;
  max: string;
  target: EquipType[];
  biz: BizType[];
  size: SizeType[];
  pref: "all" | string[];
  requirement: string;
  docs: string;
  url: string;
  rateNum: number;
  capManYen: number;
  adoptionRate?: string; // 採択率の参考値（回次・年度により変動。自治体先着型は「予算枠」等）
  difficulty?: "低" | "中" | "高"; // 申請難易度の目安
  difficultyNote?: string; // 難易度の理由（任意）
  infoOnly?: boolean; // true=資金額/ROI計算に含めず情報提供のみ（例: 持続化補助金）
  closed?: boolean;   // true=今年度の受付終了（マッチング対象外・DBには表示）
  applyOpen?: string;   // 公募開始日(ISO yyyy-mm-dd)。判明している回のみ
  applyClose?: string;  // 申請締切日(ISO)。判明している回のみ
  scheduleNote?: string; // 次回公募の見込み等の注記
  useOfFunds?: string; // この制度で想定する主な使い道（対象経費は公募要領で最終確認）
  nextCheck?: string; // 申請前に次に確認する事項
  programKind?: "subsidy" | "grant";
  programCategory?: "equipment" | "employment" | "training" | "resilience";
  status?: ProgramStatus;
  /* 2026-08-24 監査での修正: 以前は任意項目で、subsidies.ts 側に
     `verificationState: s.verificationState ?? "verified"` という既定値があった。
     つまり制度を追加した人が確認状態を書き忘れただけで「公式確認済み」扱いになり、
     match.ts の補助額計算ゲート（verified 以外は0円）を素通りしてしまう設計だった。
     未記入を型エラーにするため必須にする。 */
  verificationState: VerificationState;
  officialCheckedAt?: string;
  sourceType?: "official_api" | "official_page" | "official_pdf";
  sourceUrl?: string;
  /* 2026-08-27 監査での追加 ─ 同一公募の複数類型が1つの公募情報ページを共有する件
   *
   * program-monitor.ts は「複数制度が同じURLを共有している＝そのURLでは制度を区別できない」
   * として coverage_gap（監視できていない）に落とす。これはポータルのトップを
   * 各制度が指している状態を検知するための規則だった。
   * だが SII の設備単位型／GX設備単位型のように、**同じ公募の2類型**が
   * 1枚の公募情報ページ（例: sii.or.jp/setsubi07r/overview3.html）に併記される制度がある。
   * この場合、共有は設計上正しく、しかもそのページが更新されれば両方を見直せばよいので
   * 変更検知は正しく働く。データをどう直しても解消できない gap を出し続けるのは誤検知である。
   *
   * そこで「意図した共有」を宣言できるようにする。同一URLを共有する制度が
   * **全て同じ sourceSharedGroup を宣言している**場合に限り、共有を正常とみなす。
   * 宣言の無い共有（＝ポータルのトップを指しているだけ）は従来どおり coverage_gap のまま。 */
  sourceSharedGroup?: string;
  fetchedAt?: string;
  prepLeadDaysMin?: number;
  prepLeadDaysMax?: number;
  /* 2026-09-16 EHC-0039 v2 §2 で追加。
     申請枠。同じ制度でも枠が違えば対象製品一覧が違うため、
     対象製品の確認記録（lib/targetProduct.ts）の照合キーに使う。
     未宣言の制度は NO_FRAME_LABEL として扱う（frameOf）。
     ここを後から埋めると、旧ラベルで取った確認記録は
     キー不一致で自動的に無効になる。それでよい。 */
  applicationFrame?: string;
  /* 2026-09-16 EHC-0039 台帳#32 で追加。
     申請枠が複数ある制度（SII GX設備単位型のメーカー強化枠／トップ性能枠など）。
     枠が決まらないと補助率も対象製品一覧も決まらないので、
     「どれか1つの枠で確認した」を制度全体の確認済みに繰り上げてはならない。
     宣言が2件以上あるあいだ、対象製品の照合は frame_undecided で止まる。
     applicationFrame と併用しない。複数あるなら全部をこちらに書く。 */
  applicationFrames?: string[];
  /* 2026-09-16 EHC-0039 台帳#32 で追加。
     制度が属する会計年度。対象製品一覧・公募要領はこの年度のものを見る。
     SII の設備単位型／GX設備単位型は令和7年度補正予算の事業で、
     3次公募の受付は 2026-08-20〜09-28（＝2026年度）に行われる。
     今日から年度を出すと、参照している一覧（令和7年度補正）と年度キーが実態としてずれ、
     年度が変わっても記録が自動失効しない事故になる。
     宣言の無い制度は従来どおり今日（JST）の年度で照合する。 */
  programFiscalYear?: number;
}

export interface Vendor {
  maker: string;
  series: string;
  refri: string;
  use: string;
  note: string;
}

export interface Weapon {
  title: string;
  body: string;
}

export interface Diff {
  title: string;
  body: string;
}

// 設備グループ（冷媒・種別・設置年・台数がバラバラな機種を1案件内で複数扱う）
export type KwhMode = "auto" | "measured"; // auto=総kWh按分 / measured=エニマス等の実測値をグループ別入力

/* 既設機の型番（銘板の写し）。
   2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）で追加。

   なぜ計算側の型に入れるか。
   診断入力（DiagnosisEquipGroup）には以前から maker / modelSet / modelIndoor /
   modelOutdoor があったが、lib/diagnosisProjection.ts の projectEquipGroups() が
   EquipGroup へ落とす際に捨てていた。捨てていたので、削減率は
   lib/coefficients.ts の4係数（いずれも provisional）だけで作られていた。
   ＝実機の性能を1台も見ずに「実効削減率 33%」と出していた。
   型番が届けば lib/equipmentPerformance.ts の一次資料と照合でき、
   照合できた群だけ実機性能で比べられる。

   ここに入るのは**既設機**の型番である。導入予定機器ではない。
   対象製品リストの照合（targetProductChecks）の根拠にしてはならない。
   一次資料に無い型番は推定で寄せない（lib/equipmentPerformance.ts の findModelSpec）。 */
export interface EquipModelNos {
  /** 銘板に1つだけ書かれている場合のシステム型番 */
  set?: string | null;
  /** 室内機の型番 */
  indoor?: string | null;
  /** 室外機の型番 */
  outdoor?: string | null;
}

export interface EquipGroup {
  id: string;
  refri: RefriType;
  equip: EquipType;     // ac=パッケージ / multi=ビル用マルチ
  installYear: number;  // 設置年(西暦)
  units: number;        // 台数
  hp?: number;          // 馬力(任意・自動按分の重み付けに使用)
  kwh?: number;         // 実測モード時のグループ別 年間電力使用量(kWh)
  /** 既設機の型番。未入力は undefined（空文字で埋めない） */
  models?: EquipModelNos;
  /** メーカー名（表示用）。照合には使わない（型番だけで照合する） */
  maker?: string | null;
}

export interface MatchInput {
  bizType: BizType;
  size: SizeType;
  pref: string;
  building: string;
  equipGroups: EquipGroup[];
  kwhMode: KwhMode;
  kwh: number;          // 自動按分モード時の年間総電力使用量(kWh)
  invest: number;
  /* 2026-09-11 EHC-0038 第2便 4-B:
     invest に入っている金額が「正式見積で確認済み」か「概算」かを持つ。
     金額そのものからは区別できない（1,200万円という数字は、
     業者見積の写しでも、こちらの一般値試算でも同じ形をしている）。
     既定は undefined ＝ 概算。申告が無いうちは概算として扱う。
     この値は計算には一切使わず、表示ラベルのみを変える。 */
  investQuoted?: boolean;
  customerCompany: string;
  customerContact: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  ehcStaff: string;
  customerKind?: "company" | "individual"; // 診断書の宛名区分（個人は個人事業主向け）
  interest?: InterestType; // AIヒアリング冒頭で選ばれたご関心（任意）
  entityType?: EntityType;
  updatePlan?: UpdatePlan;
  desiredTiming?: DesiredTiming;
  employeeCount?: number;
  employmentInsurance?: "yes" | "no" | "unknown";
  hiringOrTrainingPlan?: "yes" | "no" | "unknown";
  resilienceNeed?: "yes" | "no" | "unknown";

  /* ───────── 必須要件の「確認できた」を受け取る2つの口 ─────────
     2026-09-16 EHC-0039 修正2（v1_2026-09-15 独立検収 §修正2）。

     独立検収の指摘はこうだった ――
     「eligibility.ts の checkApplicationPrereq は対象製品型番の未確認を confirmations へ入れる。
       confirmations に残る申請条件は high を止めない。
       このため『high の不変条件184件合格』だけでは、型番等の必須条件を確認した証明にならない。」

     直し方は2通りある。
       (a) 未確認を missing へ移す → verdict が needs_check になり、全制度の金額が消える。
           このファイル冒頭と eligibility.ts 冒頭に書いたとおり、実際そうなりかけた道。
       (b) verdict は変えずに「必須要件が未確認である」という事実を別の配列で持ち、
           適合度の high だけを止める。
     採るのは (b)。金額は「要件に矛盾が無い前提での目安」として出し続けてよいが、
     「適合は高い」は確認できていない以上、言ってはならない。

     その (b) を成立させるには、未確認を解消する口が要る。
     口が無ければ high は永久に到達しない。下の2つがその口。
     どちらも既定 undefined ＝ 未確認で、埋めないこと。 */

  /** 交付決定前の着手かどうか。診断入力（DiagnosisState.contractStatus）から投影して渡す。
      undefined / null は未回答であり、「まだ発注していない」ではない。 */
  contractStatus?: ContractStatus;

  /* ───────── 2026-09-25 適合チェック（お客様ご自身での確認）の回答 ─────────
     第3段階の「この制度に合うか、今確認する」で伺う。どちらもお客様の自己申告で、
     EHC が書類を見て確認したという意味ではない。
     undefined は未回答。"unknown" は「分からない」と答えた、で未回答とは別。 */
  /** 資本金・従業員数を決算書・登記事項証明書などで示せるか（企業規模の区分の裏付け） */
  sizeDocs?: SelfAnswer;
  /** SII の補助事業ポータルに事業者登録（ID発行）済みか。SII の2制度だけが見る */
  siiPortal?: SelfAnswer;

  /** 導入予定機器の型番が、当該年度の対象製品リストに登録されていることを照合した、という記録。
      照合の主体はEHC担当者で、本アプリが自動で判定しているわけではない。
      true を入れてよいのは実際に公募要領・対象製品一覧と突き合わせたときだけ。
      診断入力の型番（DiagnosisEquipGroup.model*）は**既設機**の銘板であって、
      導入予定機器ではないので、これを根拠に true にしない。

      ⚠ 2026-09-16 EHC-0039 v2 §2 で**直接の入力口ではなくなった**。
      　　この単一の boolean は制度を区別しない。対象製品一覧は制度・年度・申請枠ごとに
      　　別物なので、1つの true を全制度へ配ると「A制度で確認した型番が
      　　B制度でも確認済み」という嘘になる。
      　　実画面からは下の targetProductChecks（制度IDごと）だけを使う。
      　　ここは受入テストが1制度を直接叩くための口として残してあり、
      　　targetProductChecks がある場合はそちらが優先される（lib/eligibility.ts）。 */
  targetProductChecked?: boolean;

  /* ───────── 対象製品の確認結果（制度IDごと） ─────────
     2026-09-16 EHC-0039 v2 §2。

     値の作り手は lib/targetProduct.ts の assessTargetProduct() ただ1つで、
     その入力になる確認記録（制度ID・年度・申請枠・対象設備群・導入予定型番・
     公式出典・確認日・確認結果・確認主体）はサーバ側の保存先にしか無い。
     画面は /api/target-product へ導入予定機器を送って、返ってきた結果を
     ここへ入れるだけ。画面が勝手に true を作る経路は無い。

     送信時（app/api/diagnosis-submit）はサーバが保存先から引き直して
     組み立て直す。クライアントが送ってきた true はそこで捨てられる。 */

  /** 制度ID → その制度・年度・枠で導入予定型番の登録を確認できたか */
  targetProductChecks?: Record<string, boolean>;

  /** 制度ID → 確認の状態を説明する文（未確認の理由と次の一手）。
      未確認を出して次の一手を書かないことをしないために持つ。 */
  targetProductNotes?: Record<string, string>;
}
