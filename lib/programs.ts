/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-29 / EHC-0102 補助金サイト3本柱（国の省エネ SII・介護施設・東京都）の制度カードのデータ

   ■ なぜ
   　　診断を開いた人が3か月で3人しかいなかった（トップで帰る人が多い）。
   　　トップと診断の結果を「制度カード」（何に使えるか・対象・要件・いつ・流れ・結局いくら）に作り直す。
   　　カードの形は東京都の介護施設向けパンフ（EHC-0099）の「制度02」のカードに合わせる。

   ■ お金はいつ入るか（money）：2026-10-29 に各制度の要綱・募集要項・公募要領で確かめた流れ。
   　　6制度とも「完了から何か月」という期間の目安は公式に無い（SII だけ4次の支払い時期の記載あり）。推測で月数を書かない。
   ■ 決め事
   　　・数字と日付は 2026-10-29 に公式の資料で確かめたもの（VERIFIED_AT）。出典は official に置く。
   　　・「いつ」は実行したときの日本時間の今日で判定する（lib/programClock.ts）。日付をコードに凍らせない。
   　　・確認日から RECHECK_AFTER_DAYS 日を過ぎたら、カードに「公式で再確認中」と出す（古い情報を受付中と言い続けない）。
   　　・金額は「目安」。上限は公式の数字、補助の目安は入力した工事費からの計算で、採択と金額は審査で決まる。
   　　・景品表示法：「実質0円」「自己負担ゼロ」「必ず採択」「確実」は使わない。補助が工事費を上回る計算でも
   　　　自己負担を「0円」とは出さない（上限を超える分・対象外の経費・消費税は施設の負担と書く）。
   　　・改正行政書士法（2026-01 施行）：EHC は申請書類を作らない。「申請代行」と書かない。
   　　　「行政書士をご紹介できます」は紹介先の了承が取れてから（GYOSEI_INTRO_APPROVED）。
   　　・公開前に事務局へ確かめる点は pending に置く（桝口さんが問い合わせる）。
   ─────────────────────────────────────────────────────────── */

import { daysBetween, todayJst } from "./programClock";

/** 公式の資料で確かめた日 */
export const VERIFIED_AT = "2026-10-29";
/** 確認日からこの日数を過ぎたら「公式で再確認中」と出す（監視 EHC-0095 につなぐまでの決め） */
export const RECHECK_AFTER_DAYS = 14;
/** 「申請書類の作成が必要な場合は、行政書士をご紹介できます」を出すか（紹介先 KRH01 の了承を取ってから true） */
export const GYOSEI_INTRO_APPROVED = false;

export type ProgramId = "tokyoZeroemi" | "tokyoKaishu" | "tokyoChiiki" | "kokuKaigo" | "kokuKaigo30" | "sii";
/** カードの色。介護施設向け＝金、東京都の省エネ＝緑、国の省エネ（SII）＝青 */
export type ProgramColor = "care" | "tokyo" | "sii";
/** どのページの柱か */
export type Pillar = "tokyo" | "kaigo" | "sii";

export const COLORS: Record<ProgramColor, { head: string; soft: string; num: string; box: string; label: string }> = {
  care: { head: "#9A7A35", soft: "#FBF6EA", num: "#7A5E22", box: "#F6EED9", label: "介護施設向け" },
  tokyo: { head: "#2E7D52", soft: "#EEF6F0", num: "#22603F", box: "#E2F0E6", label: "東京都の省エネ" },
  sii: { head: "#2C6E91", soft: "#EDF4F8", num: "#21566F", box: "#DDEBF3", label: "国の省エネ" },
};

export interface ProgramWindow {
  label: string;
  /** 締切ボードで使う短い名前（例：第5回） */
  short: string;
  /** 受付の始まり（YYYY-MM-DD・無ければ締切だけ） */
  start?: string;
  /** 締切（YYYY-MM-DD） */
  end: string;
  /** 時刻・必着など */
  time?: string;
  /** 締切が施設ではなく区市町村など（施設の提出はもっと前）のとき */
  note?: string;
}

export interface ProgramCap {
  label: string;
  /** 万円。null は数字を出さない（確認中） */
  man: number | null;
  /** 補助率（目安の計算用） */
  rate: number;
  /** 補助率の表示 */
  rateLabel: string;
  /** この上限の対象（カードの小さな注記） */
  note?: string;
  /** 結局いくらの計算に使うか（既定 true） */
  inEstimate?: boolean;
}

export interface ProgramRole {
  who: string;
  what: string;
}

export interface Program {
  id: ProgramId;
  color: ProgramColor;
  pillar: Pillar;
  /** カードの頭の小さな文字（例：東京都｜省エネ） */
  tag: string;
  /** カードの頭の大きな文字 */
  title: string;
  /** 帯の図・一覧で使う短い名前（例：都 ゼロエミ） */
  short: string;
  icon: "ac" | "survey" | "build";
  officialName: string;
  organizer: string;
  /** 何に使えるか */
  use: string[];
  /** 何に使えるかの補足（対象経費・ほかのメニューなど） */
  useNote: string;
  /** 何に使えるか（トップの入口カード用の1行） */
  useShort: string;
  /** いくら（トップの入口カード用の1行。補助率・上限） */
  amountShort: string;
  /** これからの受付が無いときの一言（トップの入口カード用） */
  noneText: string;
  /** 対象 */
  target: string;
  targetNote: string;
  /** 要件 */
  requirements: string[];
  /** 補助率（大きく出す） */
  rate: { pre: string; value: string; post: string; note: string };
  /** 上限（大きく出す） */
  caps: ProgramCap[];
  capNote: string;
  /** 結局いくら：どの費用が対象か */
  costBasis: "all" | "equipment";
  /** 対象経費の下限（万円・ある場合） */
  minMan?: number;
  /** いつ */
  windows: ProgramWindow[];
  scheduleNote: string;
  /** 流れ（stopAt の段まで契約・発注しない） */
  flow: string[];
  stopAt: number;
  /** 重ねて使えるか */
  stack: string;
  /** お金の流れ（後払い・立替・入金の時期） */
  money: string;
  /** 落ちやすい所 */
  pitfalls: string[];
  /** だれが何をするか */
  roles: ProgramRole[];
  official: { label: string; url: string }[];
  /** 公開前に事務局へ確かめる点（画面には「確認中」として出す） */
  pending: string[];
  /** 業者の選び方：入札など（bid）／3社以上の見積り（quotes）。EHC の箱の書き方を変える */
  selection?: "bid" | "quotes";
  /** 上限が何で分かれるか：施設の種類（facility）なら結局いくらを施設ごとに、区分（tier）なら幅で出す */
  capsBy?: "facility" | "tier";
  verifiedAt: string;
}

/* 2026-10-29 直し2回目（10名のレビュー）：「EHCがやらないこと」より先に「だれが何をするか」を、EHC → 施設 → 行政書士 → 事務局の順に書く */
export const EHC_ROLE: ProgramRole = { who: "EHC", what: "現地調査、見積書・図面・省エネの計算の資料づくり、工事" };
const facilityRole = (window: string): ProgramRole => ({ who: "施設（申し込む人）", what: `${window}への相談・申し込み、工事の契約と支払い、完了の報告` });
export const GYOSEI_ROLE: ProgramRole = GYOSEI_INTRO_APPROVED
  ? { who: "行政書士（頼む場合）", what: "申請書類の作成。施設から頼みます（行政書士をご紹介できます）" }
  : { who: "行政書士（頼む場合）", what: "申請書類の作成。施設から頼みます（申請書類の作成は行政書士の業務のため、EHC では作りません）" };

export const PROGRAMS: Readonly<Record<ProgramId, Program>> = {
  tokyoZeroemi: {
    id: "tokyoZeroemi",
    short: "都 省エネ（ゼロエミ）",
    color: "tokyo",
    pillar: "tokyo",
    tag: "東京都｜省エネ（通称ゼロエミ）",
    title: "事業所の省エネ設備への入れ替え",
    icon: "survey",
    officialName: "ゼロエミッション化に向けた省エネ設備導入・運用改善支援事業",
    organizer: "東京都・クール・ネット東京（都の事務局）",
    use: ["高効率な空調への入れ替え", "全熱交換器（換気）", "LED照明", "断熱窓", "高効率ボイラー・給湯", "高効率な変圧器・コンプレッサ", "冷凍冷蔵設備", "人感センサー・照明スイッチの細分化などの運用改善"],
    useNote: "設計費・設備費・工事費が対象。事前に省エネ診断を受けると、2/3・最大2,500万円の区分も使えます。",
    useShort: "高効率な空調・換気・LED照明・断熱窓・給湯などへの入れ替え（設計費・設備費・工事費が対象）",
    amountShort: "3/4・最大4,500万円（区分により2/3・最大2,500万円／1,000万円）",
    noneText: "2026年度の受付は終わりました（2027年度は未発表）",
    target: "都内の中小規模事業所",
    targetNote: "中小企業・社会福祉法人・医療法人など。建物（事業所）ごとの年間の光熱費がおおむね1億円未満が目安。宗教法人などは対象外。",
    requirements: [
      "都内の中小規模事業所であること",
      "CO2の削減量で区分が決まる（年28トン以上／省エネ診断を受けてCO2を年3トンか30%以上減らす／自分で計画を作る）",
      "申請したあとに区分は変えられない",
      "交付決定（補助が正式に決まる知らせ）の前に契約・発注しない",
    ],
    rate: { pre: "対象経費の", value: "3/4", post: "まで", note: "CO2を年28トン以上減らす場合。省エネ診断（専門家が建物の省エネの余地を調べるもの）を受けて、CO2を年3トンか30%以上減らすなら2/3。" },
    caps: [
      { label: "CO2を年28トン以上減らす", man: 4500, rate: 3 / 4, rateLabel: "3/4" },
      { label: "省エネ診断を受けて、CO2を年3トンか30%以上減らす", man: 2500, rate: 2 / 3, rateLabel: "2/3" },
      { label: "自分で省エネの計画を作る", man: 1000, rate: 2 / 3, rateLabel: "2/3" },
    ],
    capNote: "予算を超えたら抽選。採択と金額は審査で決まります。",
    costBasis: "all",
    windows: [
      { label: "第5回 申請受付", short: "第5回", start: "2026-11-09", end: "2026-11-20", time: "受付 9時〜17時（最終日の17時までに届くこと＝必着）" },
      { label: "第6回 申請受付（2026年度の最終回）", short: "第6回（最終回）", start: "2027-01-18", end: "2027-01-29", time: "受付 9時〜17時（最終日の17時までに届くこと＝必着）" },
    ],
    scheduleNote: "申し込みから交付決定（補助が正式に決まる知らせ）まで約2か月。完了届の最終期限は2027年11月30日。2027年度に続くかは未発表です。",
    flow: ["相談・現地調査", "省エネ診断（区分による）・見積", "申し込み（受付期間内）", "交付決定（補助が正式に決まる・約2か月）", "契約・工事・支払い", "完了届・補助金の入金", "2年間の省エネの報告"],
    stopAt: 3,
    stack: "同じ設備に、国の補助など他の補助を重ねて受けられるかは、募集のルール（募集要項）で決まります（事務局に確認中）。",
    money: "後払いです。工事代金は先に施設が振込で支払い（明細が要ります）、工事の完了から30日以内（各回の最終期限が先ならその日まで）に完了届を出します。書類の審査（必要なら現地調査）と額の確定を経て振り込まれます。入金までの期間の目安は、公式には示されていません。",
    pitfalls: [
      "予算を超えると抽選になる",
      "申請したあとに区分は変えられない",
      "支払いは振込で、明細が必要",
      "冷媒だけの入れ替えは対象外の見込み",
      "交付決定の前に契約すると対象外",
    ],
    roles: [EHC_ROLE, facilityRole("クール・ネット東京"), GYOSEI_ROLE, { who: "クール・ネット東京（都の事務局）", what: "審査・交付決定・完了の確認・補助金の支払い" }],
    official: [{ label: "クール・ネット東京（公式）", url: "https://www.tokyo-co2down.jp/subsidy/zeroemi-shoene/" }],
    pending: ["冷媒だけの入れ替えの扱い", "国・都のほかの補助との併用の範囲", "2027年度に続くか"],
    capsBy: "tier",
    verifiedAt: VERIFIED_AT,
  },
  tokyoKaishu: {
    id: "tokyoKaishu",
    short: "都 特養等の改修",
    color: "care",
    pillar: "tokyo",
    tag: "東京都｜介護施設",
    title: "特養・養護の空調・建物の改修",
    icon: "ac",
    officialName: "特別養護老人ホーム等改修費補助（大規模改修／大規模改修（空調設備更新））",
    organizer: "東京都 福祉局",
    use: ["老朽化した空調の更新", "給排水・電気・ガス・冷暖房・消防などの設備の改造", "浴室・食堂の改修、外壁・屋上の防水", "居室・浴室・食堂の内部改修、段差の解消", "避難しやすくする改修", "換気設備・アスベストの処理", "法令改正で必要になった消防設備・昇降機", "緊急災害時用の自家発電設備"],
    useNote: "このほか、多床室のプライバシー保護（1床90.6万円）・看取り対応（1施設450万円）・増床・ユニット化・耐震などの改修のメニューもあります。",
    useShort: "特養・養護の空調の更新、給排水・電気・消防設備、浴室・防水・外壁、段差の解消、自家発電などの大規模改修",
    amountShort: "3/4・最大1億8,419.2万円（空調の特別枠は最大6,759.7万円）",
    noneText: "次の協議は未発表です",
    target: "都内の特別養護老人ホーム・養護老人ホーム",
    targetNote: "建物の所有者が民間の法人などの条件あり。公立の施設と八王子市内の施設は対象外。",
    requirements: [
      "都内の特養・養護（公立・八王子市内を除く。建物の所有者が民間の法人）",
      "創設や、補助を受けた大規模改修の完了から10年を過ぎていること（10年ルール）",
      "養護老人ホームは、原則として特定施設入居者生活介護の指定を受けていること",
      "区市町村の確認を受けてから、都へ予約・事前提出（協議＝申し込みの前の書類のやり取り）",
      "財務の審査がある",
      "空調の特別枠は、2016〜2025年度（平成28〜令和7年度）に都の大規模改修の補助を受け、耐用年数を超えた空調を更新する施設など",
    ],
    rate: { pre: "補助基準額・対象経費の", value: "3/4", post: "まで", note: "補助基準額（都が決めた、補助の計算に使う上限の額）と、実際の対象経費の少ない方が基準です。採択と金額は審査で決まります。" },
    caps: [
      { label: "建物・設備などの大規模改修", man: 18419.2, rate: 3 / 4, rateLabel: "3/4" },
      { label: "空調設備更新の特別枠", man: 6759.7, rate: 3 / 4, rateLabel: "3/4", note: "補助基準額9,013万円の3/4" },
    ],
    capNote: "空調の特別枠は対象になる施設が限られます。「結局いくら」は、どちらの枠でも上限の内側なら同じ金額です。",
    costBasis: "all",
    windows: [{ label: "第2回 協議書（申し込みの書類）の提出締切", short: "第2回 協議書", end: "2027-01-08", note: "その前に、区市町村の確認と都への予約（事前の連絡）が必要です。日程は都と区市町村にご確認ください。" }],
    scheduleNote: "内示（補助の内定の知らせ）は2027年6月下旬の予定。工事はそのあと（工事の時期も事前に確認）。",
    flow: ["相談・現地調査", "見積・図面", "区市町村の確認", "都へ予約・協議書（申し込みの書類）の提出", "内示＝補助の内定（2027年6月下旬予定）", "入札・契約・工事", "実績報告・補助金の入金"],
    stopAt: 4,
    stack: "同じ工事に、国の交付金など他の補助を重ねられるかは、都のルール（要綱）で決まります（要確認）。",
    money: "後払いが基本です。工事の完了から10日以内に実績報告を出し、都の審査・額の確定・請求を経て交付されます。入金までの期間の目安は、公式には示されていません。年度の補助額が1億円以上なら、条件（工事の出来高が30%以上など）により2回に分けて受け取れることがあります。",
    pitfalls: ["内示の前に契約しない", "前回の大規模改修などから10年たっていないと対象外", "業者は入札などのルールに沿って施設が公平に決める", "空調の特別枠は対象になる施設が限られる"],
    roles: [EHC_ROLE, facilityRole("区市町村・東京都"), GYOSEI_ROLE, { who: "区市町村・東京都", what: "確認・協議の受付・審査・内示・補助金の支払い" }],
    official: [{ label: "東京都 福祉局（改修費補助の資料）", url: "https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/06-2_kaishyuuhihojomatomer8-3-13-pdf-1" }],
    pending: ["財務審査の条件と事前予約の手順"],
    selection: "bid",
    verifiedAt: VERIFIED_AT,
  },
  tokyoChiiki: {
    id: "tokyoChiiki",
    short: "都 地域密着型",
    color: "care",
    pillar: "tokyo",
    tag: "東京都｜介護施設",
    title: "地域密着型の施設の大規模な修繕",
    icon: "build",
    officialName: "地域密着型サービス等整備推進事業（大規模な修繕等）",
    organizer: "東京都 福祉局（区市町村を通じて）",
    use: ["空調の入れ替え", "給排水・給湯・電気設備の修繕", "屋上防水・外壁", "そのほか既存施設の大規模な修繕"],
    useNote: "工事費と工事事務費（設計・監理などの事務の費用。工事費の2.6%まで）が対象です。",
    useShort: "地域密着型特養・小規模多機能の、空調・給排水・電気・防水などの大規模な修繕",
    amountShort: "1/2（都1/4＋区市町村1/4）・1施設1,660万円／833万円（上限額か基準額かを都に確認中）",
    noneText: "次の協議は未発表です",
    target: "都内の地域密着型特養・小規模多機能・看護小規模多機能",
    targetNote: "区市町村がこの事業を行っている場合に限ります。行っているかは、区市町村の高齢者福祉（介護保険）の担当課で確かめます。",
    requirements: ["区市町村がこの事業を行っていること（実施は区市町村の任意）", "都の内示のあとに入札・契約・着工すること", "2026年度内（2027年3月まで）に工事を終えること", "対象経費が80万円以上", "国の交付金（大規模修繕等）とは併用できない"],
    rate: { pre: "対象経費の", value: "1/2", post: "（都1/4＋区市町村1/4）", note: "区市町村がこの事業を行う場合。残りの1/2は施設の負担です。" },
    caps: [
      { label: "地域密着型特養", man: 1660, rate: 0, rateLabel: "確認中", note: "上限か基準額か確認中" },
      { label: "小規模多機能・看護小規模多機能", man: 833, rate: 0, rateLabel: "確認中", note: "上限か基準額か確認中" },
    ],
    capNote: "1施設あたりの金額です。都の資料では「補助上限」とありますが、読み方を都に確認中のため、補助の目安は出していません。",
    costBasis: "all",
    minMan: 80,
    windows: [{ label: "都の締切（区市町村から都へ申し込む期限）", short: "都の締切（区市町村→都）", end: "2026-11-27", note: "施設の締切はこれより前です（区市町村ごとに違います）。区市町村にご確認ください。" }],
    scheduleNote: "内示（補助の内定の知らせ）のあとに入札・契約。2026年度内（2027年3月まで）に工事を終えます。",
    flow: ["相談・現地調査", "見積", "区市町村へ相談・提出", "区市町村から都へ申し込み（協議）", "内示（補助の内定）", "入札・契約・工事（年度内）", "実績報告・補助金の入金"],
    stopAt: 4,
    stack: "国の交付金（大規模修繕等）とは併用できません。",
    money: "区市町村を通じた後払いです。完了後の実績報告と、都・区市町村の手続きを経て振り込まれます。時期は区市町村によって違い、公式に期間の目安は示されていません。",
    pitfalls: ["区市町村が行っていないと使えない", "施設からの提出の期限は11月27日より前", "年度内に工事を終える必要がある"],
    roles: [EHC_ROLE, facilityRole("区市町村"), GYOSEI_ROLE, { who: "区市町村・東京都", what: "募集・協議・内示・補助金の支払い" }],
    official: [{ label: "東京都 福祉局（2026年度の資料）", url: "https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/2026-09-09-111358-349" }],
    pending: ["1,660万円・833万円が上限か基準額か", "所在地の区市町村が行っているか"],
    selection: "bid",
    verifiedAt: VERIFIED_AT,
  },
  kokuKaigo: {
    id: "kokuKaigo",
    short: "国 介護の交付金",
    color: "care",
    pillar: "kaigo",
    tag: "国｜介護施設",
    title: "介護施設の大規模修繕・防災の改修",
    icon: "build",
    officialName: "地域介護・福祉空間整備等施設整備交付金（防災改修等支援事業・大規模修繕等）",
    organizer: "厚生労働省（市区町村を通じて）",
    use: ["空調（冷暖房）", "照明", "電気設備（分電盤など）", "給排水・給湯", "ガス設備", "消防用設備（スプリンクラーは別の補助）", "防水・外壁・浴室", "バリアフリー・避難経路", "非常用自家発電・給水設備", "水害対策・換気"],
    useNote: "空調だけでなく、建物と設備をまとめて直す修繕に使えます。どの工事も EHC のチームでまとめて計画・施工できます。",
    useShort: "空調・照明・電気・給排水・ガス・消防・防水・バリアフリーなどの大規模修繕、非常用発電・換気など（定員29人以下）",
    amountShort: "10/10・1施設 最大1,660万円（施設の種類により833万円）",
    noneText: "次の募集は未発表（市区町村が案内します）",
    target: "定員29人以下の介護施設",
    targetNote: "特養・老健・介護医療院・ケアハウスは1施設1,660万円、グループホーム・小規模多機能・看護小規模多機能・養護などは833万円まで。",
    requirements: [
      "定員29人以下（30人以上は別のメニュー）",
      "対象経費が80万円以上",
      "市区町村の募集に合わせて協議する",
      "2027年度（令和9年度）分から、大規模修繕には中長期の修繕計画が必要",
    ],
    rate: { pre: "対象経費の", value: "10/10", post: "（上限の額まで）", note: "10/10 は上限の額までの話です。上限を超える分・対象外の経費・消費税は施設の負担です。" },
    caps: [
      { label: "特養・老健・介護医療院・ケアハウス", man: 1660, rate: 1, rateLabel: "10/10" },
      { label: "グループホーム・小規模多機能・養護など", man: 833, rate: 1, rateLabel: "10/10" },
    ],
    capNote: "1施設あたり。採択と金額は審査と市区町村の要綱で決まります。",
    costBasis: "all",
    minMan: 80,
    windows: [],
    scheduleNote: "2026年度の1回目の募集は終わっています（6月に内定）。次の募集は市区町村が案内します（未発表）。いまのうちに見積と修繕の計画を用意しておくと、募集が出たときに間に合いやすくなります。",
    flow: ["相談・現地調査", "見積・修繕の計画", "市区町村へ申し込み（協議）", "内示・交付決定（補助が決まる）", "入札・契約・工事", "実績報告・補助金の入金"],
    stopAt: 3,
    stack: "都の「地域密着型の大規模な修繕」とは併用できません。ほかの補助との重ね方は制度のルール（要綱）で決まります。",
    money: "市区町村を通じて入ります。完了後の実績報告と、市区町村での額の確定を経て振り込まれるのが基本です。前払い（概算払）ができるかと時期は市区町村によって違い、公式に期間の目安は示されていません。",
    pitfalls: ["市区町村が募集していないと申請できない", "内示の前に契約しない", "80万円未満は対象外", "来年度分から修繕計画が必要"],
    roles: [EHC_ROLE, facilityRole("市区町村"), GYOSEI_ROLE, { who: "市区町村", what: "募集・協議の受付・交付決定・補助金の支払い" }],
    official: [
      { label: "厚生労働省（実施要綱）", url: "https://www.mhlw.go.jp/content/001715706.pdf" },
      { label: "厚生労働省（修繕計画の通知 10/16）", url: "https://www.mhlw.go.jp/content/001760352.pdf" },
    ],
    pending: ["所在地の市区町村が受け付けているか", "2026年度の補正予算で追加の募集があるか"],
    selection: "bid",
    capsBy: "facility",
    verifiedAt: VERIFIED_AT,
  },
  kokuKaigo30: {
    id: "kokuKaigo30",
    short: "国 介護（30人〜）",
    color: "care",
    pillar: "kaigo",
    tag: "国｜介護施設",
    title: "定員30人以上の施設の、防災と一体の改修",
    icon: "build",
    officialName: "地域介護・福祉空間整備等施設整備交付金（防災対策と一体の大規模修繕）",
    organizer: "厚生労働省（都道府県を通じて）",
    use: ["耐震化と一体の大規模修繕", "非常用発電・給水と一体の改修", "防災対策と合わせた空調・設備の更新"],
    useNote: "防災の工事と組み合わせることが条件です。どの組み合わせが対象になるかは都道府県のメニューで決まります。",
    useShort: "定員30人以上の施設の、耐震化・非常用発電など防災と一体の改修",
    amountShort: "2/3・最大2,106万円（基準額3,160万円）",
    noneText: "次の募集は未発表（都道府県が案内します）",
    target: "定員30人以上の介護施設",
    targetNote: "窓口は都道府県。対象になる工事のメニューが限られます。",
    requirements: ["定員30人以上", "防災対策と一体で行う改修であること", "都道府県の募集に合わせて協議する"],
    rate: { pre: "基準額の", value: "2/3", post: "まで", note: "国1/3＋都道府県等1/3。" },
    caps: [{ label: "基準額 3,160万円の2/3", man: 2106, rate: 2 / 3, rateLabel: "2/3" }],
    capNote: "採択と金額は審査と都道府県の要綱で決まります。",
    costBasis: "all",
    windows: [],
    scheduleNote: "次の募集は都道府県が案内します（未発表）。いまのうちに防災の計画と見積を用意しておくと、募集が出たときに間に合いやすくなります。",
    flow: ["相談・現地調査", "見積・防災の計画", "都道府県へ申し込み（協議）", "内示・交付決定（補助が決まる）", "入札・契約・工事", "実績報告・補助金の入金"],
    stopAt: 3,
    stack: "ほかの補助との重ね方は制度のルール（要綱）で決まります（要確認）。",
    money: "都道府県を通じた後払いが基本です。完了後の実績報告と額の確定を経て振り込まれます（公式に期間の目安は示されていません）。",
    pitfalls: ["防災対策と一体でないと対象外", "内示の前に契約しない", "都道府県のメニューにあるか確認が要る"],
    roles: [EHC_ROLE, facilityRole("都道府県"), GYOSEI_ROLE, { who: "都道府県", what: "募集・協議の受付・交付決定・補助金の支払い" }],
    official: [{ label: "厚生労働省（実施要綱）", url: "https://www.mhlw.go.jp/content/001715706.pdf" }],
    pending: ["所在地の都道府県のメニューと募集の時期"],
    selection: "bid",
    verifiedAt: VERIFIED_AT,
  },
  sii: {
    id: "sii",
    short: "国 SII",
    color: "sii",
    pillar: "sii",
    tag: "国｜省エネ（SII）",
    title: "高効率な空調への更新（全国）",
    icon: "ac",
    officialName: "省エネルギー投資促進支援事業費補助金（設備単位型）",
    organizer: "経済産業省・環境共創イニシアチブ（SII＝国の事務局）",
    use: ["高効率な空調（指定された機種）", "業務用給湯器・産業ヒートポンプ", "制御機能付きLED照明", "冷凍冷蔵設備・変圧器"],
    useNote: "指定された機種への入れ替えが対象で、補助は機器代（設備費）だけです（工事費は対象外）。",
    useShort: "指定された高効率な空調への更新（全国・対象は機器代だけ）",
    amountShort: "機器代の1/3・最大1億円（工事費は対象外。メーカー強化枠・トップ性能枠は最大3億円、トップ性能枠は1/2）",
    noneText: "次の公募は未発表（後継の事業が国の予算要求に入っています）",
    target: "国内の法人・個人事業主",
    targetNote: "社会福祉法人・医療法人は、従業員300人以下なら中小企業者等として扱われます。301人以上などの大企業も申請できる場合がありますが、条件は公募のルール（公募要領）で確かめます。",
    requirements: ["指定された機種への更新", "省エネ率10%以上・省エネ量1kl以上などのいずれか（省エネの計算で確かめる）", "3社以上の見積り", "点数の高い順に予算の範囲で採択", "交付決定（補助が正式に決まる知らせ）の前に契約しない"],
    rate: { pre: "機器代（設備費）の", value: "1/3", post: "まで", note: "トップ性能枠（更新）は1/2（空調は、クラウドのAI制御が付いた電気式の業務用エアコンに限る）。" },
    caps: [
      { label: "従来枠", man: 10000, rate: 1 / 3, rateLabel: "1/3" },
      { label: "メーカー強化枠・トップ性能枠", man: 30000, rate: 1 / 3, rateLabel: "1/3〜1/2", note: "GXに取り組むメーカーの機種・特に性能の高い機種", inEstimate: false },
    ],
    capNote: "指定された機種への更新が対象。採択と金額は審査で決まります。",
    costBasis: "equipment",
    windows: [{ label: "4次 申請締切（郵送・必着）", short: "4次", start: "2026-10-05", end: "2026-10-30", time: "17時必着" }],
    scheduleNote: "次の公募は未発表です。国の来年度の予算の要求に、後継の事業が入っています。いまのうちに機種の選定と見積りを進めておけます（契約はしません）。",
    flow: ["相談・現地調査", "3社以上の見積り", "申し込み（公募の期間内）", "交付決定（補助が正式に決まる）", "契約・工事・支払い", "実績報告・補助金の入金"],
    stopAt: 3,
    stack: "同じ設備に、都のゼロエミなど他の補助を重ねて受けられるかは、公募のルール（公募要領）で決まります（要確認）。",
    money: "後払い（精算払い）です。設備の検収と代金の支払いを終えたあと、実績報告と確定検査を経て振り込まれます。2026年度の4次の公募要領では、単年度の事業の支払いの時期を2027年1月末〜3月末としていました（次の公募では変わることがあります）。",
    pitfalls: ["工事費は対象外（機器代＝設備費のみ）", "指定の機種でないと対象外", "3社以上の見積りが必要", "完了の期限が短い（4次は2027年1月31日）"],
    roles: [EHC_ROLE, facilityRole("SII"), GYOSEI_ROLE, { who: "SII（国の事務局）", what: "審査・交付決定・完了の確認・補助金の支払い" }],
    official: [{ label: "SII 省エネ補助金（公式）", url: "https://syouenehojyokin.sii.or.jp/about-type/setsubi.html" }],
    pending: ["次の公募の有無と時期", "冷媒だけの入れ替えが対象外であることの正式な確認"],
    selection: "quotes",
    verifiedAt: VERIFIED_AT,
  },
};

export const PROGRAM_ORDER: ProgramId[] = ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu", "kokuKaigo", "kokuKaigo30", "sii"];

/** どの結果にも一番上に出す注意 */
export const COMMON_CAUTIONS = [
  "どの制度も、交付決定・内示（補助が決まったという知らせ）の前に契約・発注すると対象外になります。",
  "同じ工事にいくつかの補助を重ねて受けられるかは、それぞれの制度のルール（要綱）で決まります。この画面では金額を合算しません。",
  "金額は入力した工事費からの目安です。採択と金額は審査で決まります。消費税は補助の対象にならないことが多いため、税抜でお考えください。",
];

/* ───────── いつ（受付の状態と残り日数） ───────── */

export type WindowState = "open" | "upcoming" | "none";

export interface NextWindow {
  state: WindowState;
  window: ProgramWindow | null;
  /** 受付開始までの日数（upcoming のとき） */
  daysToStart: number | null;
  /** 締切までの日数（open / upcoming のとき） */
  daysToEnd: number | null;
}

/** 今日（JST）から見た、次の受付（受付中か、これからのもの）。締切を過ぎたものは飛ばす。 */
export function nextWindow(p: Program, today: string = todayJst()): NextWindow {
  const list = [...p.windows].sort((a, b) => a.end.localeCompare(b.end));
  for (const w of list) {
    if (daysBetween(today, w.end) < 0) continue;
    const startIn = w.start ? daysBetween(today, w.start) : null;
    const state: WindowState = startIn !== null && startIn > 0 ? "upcoming" : "open";
    return { state, window: w, daysToStart: state === "upcoming" ? startIn : null, daysToEnd: daysBetween(today, w.end) };
  }
  return { state: "none", window: null, daysToStart: null, daysToEnd: null };
}

/** これからの受付（締切が今日以降のもの）を早い順に */
export function upcomingWindows(p: Program, today: string = todayJst()): ProgramWindow[] {
  return [...p.windows].filter((w) => daysBetween(today, w.end) >= 0).sort((a, b) => a.end.localeCompare(b.end));
}

/** 受付の期間の書き方（例：11月9日（月）〜11月20日（金）／2027年1月8日（金）まで）。今日と年が違えば年を付ける */
export function windowRangeText(w: ProgramWindow, today: string = todayJst()): string {
  const y = today.slice(0, 4);
  const withYear = (ymd: string) => ymd.slice(0, 4) !== y;
  if (w.start) {
    const endYear = withYear(w.end) && w.end.slice(0, 4) !== w.start.slice(0, 4);
    return `${jaDate(w.start, withYear(w.start))}〜${jaDate(w.end, endYear)}`;
  }
  return `${jaDate(w.end, withYear(w.end))}まで`;
}

export interface WindowItem {
  programId: ProgramId;
  window: ProgramWindow;
  state: "open" | "upcoming";
  daysToStart: number | null;
  daysToEnd: number;
  /** 次の節目までの日数（これからなら開始まで、受付中なら終了まで） */
  nextDays: number;
}

/** これからの受付（受付中・これから始まるもの）を、次の節目が近い順に1行ずつ。締切ボードとトップの入口に使う */
export function upcomingWindowItems(today: string = todayJst(), ids: ProgramId[] = PROGRAM_ORDER): WindowItem[] {
  const out: WindowItem[] = [];
  for (const id of ids) {
    for (const w of PROGRAMS[id].windows) {
      const toEnd = daysBetween(today, w.end);
      if (toEnd < 0) continue;
      const toStart = w.start ? daysBetween(today, w.start) : null;
      const upcoming = toStart !== null && toStart > 0;
      out.push({ programId: id, window: w, state: upcoming ? "upcoming" : "open", daysToStart: upcoming ? toStart : null, daysToEnd: toEnd, nextDays: upcoming ? (toStart as number) : toEnd });
    }
  }
  return out.sort((a, b) => a.nextDays - b.nextDays || a.daysToEnd - b.daysToEnd);
}

type CountItem = { state: "open" | "upcoming" | "none"; daysToStart: number | null; daysToEnd: number | null; window?: ProgramWindow | null };

/** 残り日数の「何まで」（ご指示 2026-10-29「開始まで」「終了まで」に、10名のレビューで「受付」を足した）。
    これからなら受付開始まで、受付中なら受付終了まで、締切だけのもの（区市町村→都の期限など）は締切まで */
export function countdownKind(item: CountItem): string {
  if (item.state === "upcoming") return "受付開始まで";
  return item.window && !item.window.start ? "締切まで" : "受付終了まで";
}

export function countdownLabel(item: CountItem): string {
  if (item.state === "upcoming" && item.daysToStart !== null) return `受付開始まであと${item.daysToStart}日`;
  if (item.daysToEnd === null) return "";
  const end = item.window && !item.window.start ? "締切" : "受付終了";
  if (item.daysToEnd <= 0) return `今日で${end}`;
  if (item.daysToEnd === 1) return `明日で${end}`;
  return `${countdownKind(item)}あと${item.daysToEnd}日`;
}

/* 2026-10-29 EHC の回答（本人）：「対応期間が短すぎる。締切まで1か月くらいないと無理」。
   申し込みの準備（現地調査・見積・図面・省エネの計算）に1か月ほどかかるので、締切まで1か月を切った回にはそう書く。 */
/** 申し込みの準備にかかる日数の目安 */
export const PREP_DAYS = 30;

/** 締切まで1か月を切っていて、準備が間に合わないことがある回か。間に合う次の回があれば一緒に返す */
export function prepWarning(p: Program, today: string = todayJst()): { window: ProgramWindow; daysToEnd: number; later: ProgramWindow | null } | null {
  const next = nextWindow(p, today);
  if (!next.window || next.daysToEnd === null || next.daysToEnd >= PREP_DAYS) return null;
  const later = upcomingWindows(p, today).find((w) => w.end !== next.window!.end && daysBetween(today, w.end) >= PREP_DAYS) ?? null;
  return { window: next.window, daysToEnd: next.daysToEnd, later };
}

/** 確認日から日数が経って、公式で確かめ直す必要があるか */
export function needsRecheck(p: Program, today: string = todayJst()): boolean {
  return daysBetween(p.verifiedAt, today) > RECHECK_AFTER_DAYS;
}

export interface Milestone {
  programId: ProgramId;
  kind: "start" | "end";
  date: string;
  days: number;
  label: string;
}

/** これからの節目（受付開始・締切）を近い順に。トップの締切ボードに使う。 */
export function upcomingMilestones(today: string = todayJst(), ids: ProgramId[] = PROGRAM_ORDER): Milestone[] {
  const out: Milestone[] = [];
  for (const id of ids) {
    for (const w of PROGRAMS[id].windows) {
      if (w.start) {
        const d = daysBetween(today, w.start);
        if (d > 0) out.push({ programId: id, kind: "start", date: w.start, days: d, label: `${w.short}の受付開始` });
      }
      const d = daysBetween(today, w.end);
      if (d >= 0) out.push({ programId: id, kind: "end", date: w.end, days: d, label: w.start ? `${w.short}の締切` : w.short });
    }
  }
  return out.sort((a, b) => a.days - b.days || (a.kind === "end" ? -1 : 1));
}

/** 日付を「2026年11月9日（月）」の形に */
export function jaDate(ymd: string, withYear = true): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withYear ? `${y}年` : ""}${m}月${d}日（${wd}）`;
}

/** 締切の表示（例：あと22日／今日まで） */
export function daysLabel(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return "今日まで";
  if (days === 1) return "明日まで";
  return `あと${days}日`;
}

/* ───────── 結局いくら ───────── */

/** 万円の数を「1億8,419万円」の形に（小数は1桁まで） */
export function fmtMan(man: number): string {
  const v = Math.round(man * 10) / 10;
  const oku = Math.floor(v / 10000);
  const rest = Math.round((v - oku * 10000) * 10) / 10;
  const restText = rest ? `${rest.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万` : "";
  if (oku > 0) return `${oku}億${restText}円`;
  return `${rest.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`;
}

export interface EstimateLine {
  label: string;
  /** 補助の目安（万円・切り捨て） */
  subsidyMan: number;
  /** 自己負担の目安（万円）。補助が工事費に届く計算のときは null（0円とは出さない） */
  selfMan: number | null;
  /** 上限で頭打ちになったか */
  capped: boolean;
}

export type EstimateKind = "ok" | "needCost" | "needEquipment" | "belowMin" | "unknownRate";

export interface Estimate {
  kind: EstimateKind;
  lines: EstimateLine[];
  /** 計算の前提（例：工事費1,000万円（税抜）×3/4、上限4,500万円） */
  basis: string;
  /** 画面に出す一言 */
  note: string;
}

export interface EstimateInput {
  /** 工事費の目安（万円・税抜） */
  costMan?: number | null;
  /** うち機器代（万円・税抜。SII は設備費だけが対象） */
  equipmentMan?: number | null;
  /** 国の介護交付金で、上限のどちらを使うか（A=1,660万円・B=833万円・不明なら両方） */
  kaigoGroup?: "A" | "B" | null;
}

const validMan = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1_000_000 ? v : null);

export function estimateFor(p: Program, input: EstimateInput): Estimate {
  const cost = validMan(input.costMan);
  const equip = validMan(input.equipmentMan);
  const usable = p.caps.filter((c) => c.inEstimate !== false);
  const caps = p.id === "kokuKaigo" && input.kaigoGroup ? [usable[input.kaigoGroup === "A" ? 0 : 1]] : usable;

  if (caps.some((c) => c.rate === 0)) {
    return { kind: "unknownRate", lines: [], basis: "", note: "金額の読み方を確認中のため、補助の目安は出していません。相談でお調べします。" };
  }
  const base = p.costBasis === "equipment" ? equip : cost;
  if (base === null) {
    return p.costBasis === "equipment"
      ? { kind: cost === null ? "needCost" : "needEquipment", lines: [], basis: "", note: "この制度は機器代（設備費）だけが対象です。機器代が分かると目安を出せます（工事費は対象外）。" }
      : { kind: "needCost", lines: [], basis: "", note: "工事費の目安を入れると、補助の目安と自己負担の目安を出します。" };
  }
  if (p.minMan && base < p.minMan) {
    return { kind: "belowMin", lines: [], basis: "", note: `対象経費が${fmtMan(p.minMan)}未満のため、対象外の見込みです。` };
  }
  const total = cost ?? base;
  const lines: EstimateLine[] = caps.map((c) => {
    const raw = p.id === "kokuKaigo30" ? Math.min(base, 3160) * c.rate : base * c.rate;
    const capMan = c.man ?? Infinity;
    const subsidy = Math.floor(Math.min(raw, capMan));
    const self = Math.ceil(total - subsidy);
    return { label: c.label, subsidyMan: subsidy, selfMan: self > 0 ? self : null, capped: raw > capMan };
  });
  const what = p.costBasis === "equipment" ? `機器代 ${fmtMan(base)}（税抜）` : `工事費 ${fmtMan(base)}（税抜）`;
  return {
    kind: "ok",
    lines,
    basis: `${what}で計算${p.costBasis === "equipment" && cost !== null ? `。自己負担は工事費 ${fmtMan(cost)} から` : ""}`,
    note: "目安です。上限を超える分・対象外の経費・消費税は施設の負担です。採択と金額は審査で決まります。",
  };
}

export interface EstimateSummary {
  /** 補助の目安（万円）。区分で違えば幅 */
  subsidyMin: number;
  subsidyMax: number;
  /** 自己負担の目安（万円）。どの区分でも補助が工事費に届く計算なら null（0円とは出さない） */
  selfMin: number | null;
  selfMax: number | null;
  /** どれかの区分が上限で頭打ちになったか */
  capped: boolean;
  /** 区分ごとの数字が違うか（違えば内訳を小さく出す） */
  varies: boolean;
}

/** 「結局いくら」を1行にまとめる（10名のレビュー：区分ごとに数字が並ぶと、どれが自分か分からない） */
export function estimateSummary(est: Estimate): EstimateSummary | null {
  if (est.kind !== "ok" || !est.lines.length) return null;
  const subs = est.lines.map((l) => l.subsidyMan);
  const selfs = est.lines.map((l) => l.selfMan).filter((v): v is number => v !== null);
  const subsidyMin = Math.min(...subs);
  const subsidyMax = Math.max(...subs);
  return {
    subsidyMin,
    subsidyMax,
    selfMin: selfs.length ? Math.min(...selfs) : null,
    selfMax: selfs.length ? Math.max(...selfs) : null,
    capped: est.lines.some((l) => l.capped),
    varies: subsidyMin !== subsidyMax || new Set(est.lines.map((l) => l.selfMan)).size > 1,
  };
}

/** 「666万〜750万円」「750万円」の形 */
export function manRange(min: number, max: number): string {
  if (min === max) return fmtMan(min);
  return `${fmtMan(min).replace(/円$/, "")}〜${fmtMan(max)}`;
}
