/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 補助金サイト3本柱（国の省エネ SII・介護施設・東京都）の制度カードのデータ

   ■ なぜ
   　　診断を開いた人が3か月で3人しかいなかった（トップで帰る人が多い）。
   　　トップと診断の結果を「制度カード」（何に使えるか・対象・要件・いつ・流れ・結局いくら）に作り直す。
   　　カードの形は東京都の介護施設向けパンフ（EHC-0099）の「制度02」のカードに合わせる。

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
  verifiedAt: string;
}

const facilityRole = (window: string): ProgramRole => ({ who: "施設（申請者）", what: `${window}への相談・申請、工事の契約と支払い、完了の報告` });
const EHC_ROLE: ProgramRole = { who: "EHC", what: "現地調査、見積書・図面・省エネの資料づくり、工事" };
export const GYOSEI_ROLE: ProgramRole = GYOSEI_INTRO_APPROVED
  ? { who: "行政書士", what: "申請書類の作成（必要な場合。行政書士をご紹介できます）" }
  : { who: "行政書士", what: "申請書類の作成（必要な場合。EHC は申請書類を作りません）" };

export const PROGRAMS: Readonly<Record<ProgramId, Program>> = {
  tokyoZeroemi: {
    id: "tokyoZeroemi",
    short: "都 ゼロエミ",
    color: "tokyo",
    pillar: "tokyo",
    tag: "東京都｜省エネ",
    title: "事業所の省エネ設備への入れ替え",
    icon: "survey",
    officialName: "ゼロエミッション化に向けた省エネ設備導入・運用改善支援事業",
    organizer: "東京都・クール・ネット東京",
    use: ["高効率な空調への更新", "全熱交換器・LED照明・断熱窓など", "設計費・設備費・工事費が対象"],
    target: "都内の中小規模事業所",
    targetNote: "中小企業・社会福祉法人・医療法人など。年間の光熱費がおおむね1億円未満が目安。宗教法人などは対象外。",
    requirements: [
      "都内の中小規模事業所であること",
      "CO2の削減量で区分が決まる（年28トン以上／省エネ診断を受けて3トンか30%以上／自分で計画）",
      "申請したあとに区分は変えられない",
      "交付決定の前に契約・発注しない",
    ],
    rate: { pre: "対象経費の", value: "3/4", post: "まで", note: "CO2を年28トン以上減らす場合。省エネ診断を受けて3トンか30%以上なら2/3。" },
    caps: [
      { label: "CO2を年28トン以上減らす", man: 4500, rate: 3 / 4, rateLabel: "3/4" },
      { label: "省エネ診断を受けて、3トンか30%以上", man: 2500, rate: 2 / 3, rateLabel: "2/3" },
      { label: "自分で計画を作る", man: 1000, rate: 2 / 3, rateLabel: "2/3" },
    ],
    capNote: "予算を超えたら抽選。採択と金額は審査で決まります。",
    costBasis: "all",
    windows: [
      { label: "第5回 申請受付", short: "第5回", start: "2026-11-09", end: "2026-11-20", time: "9時〜17時（必着）" },
      { label: "第6回 申請受付（令和8年度の最終回）", short: "第6回（最終回）", start: "2027-01-18", end: "2027-01-29", time: "9時〜17時（必着）" },
    ],
    scheduleNote: "交付決定まで約2か月。完了届の最終期限は2027年11月30日。令和9年度に続くかは未発表です。",
    flow: ["相談・現地調査", "省エネ診断（区分による）・見積", "申請（受付期間内）", "交付決定（約2か月）", "契約・工事・支払い", "完了届・補助金の入金", "2年間の報告"],
    stopAt: 3,
    stack: "同じ設備に、国の補助など他の補助を重ねて受けられるかは、募集要項で決まります（事務局に確認中）。",
    money: "後払いです。工事代金をいったん施設が支払い、振込の明細を付けて完了届を出したあとに補助金が入ります。",
    pitfalls: [
      "予算を超えると抽選になる",
      "申請したあとに区分は変えられない",
      "支払いは振込で、明細が必要",
      "冷媒だけの入れ替えは対象外の見込み",
      "交付決定の前に契約すると対象外",
    ],
    roles: [facilityRole("クール・ネット東京"), EHC_ROLE, GYOSEI_ROLE, { who: "クール・ネット東京", what: "審査・交付決定・完了の確認・補助金の支払い" }],
    official: [{ label: "クール・ネット東京（公式）", url: "https://www.tokyo-co2down.jp/subsidy/zeroemi-shoene/" }],
    pending: ["冷媒だけの入れ替えの扱い", "国・都のほかの補助との併用の範囲", "令和9年度に続くか"],
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
    use: ["老朽化した空調の更新", "給排水・浴室・食堂・外壁・屋上防水などの大規模な改修"],
    target: "都内の特別養護老人ホーム・養護老人ホーム",
    targetNote: "建物の所有者が民間の法人などの条件あり。公立の施設と八王子市内の施設は対象外。",
    requirements: [
      "都内の特養・養護（公立・八王子市内を除く。建物の所有者が民間の法人）",
      "創設や、補助を受けた大規模改修の完了から10年を過ぎていること（10年ルール）",
      "養護老人ホームは、原則として特定施設入居者生活介護の指定を受けていること",
      "区市町村の確認を受けてから、都へ予約・事前提出",
      "財務の審査がある",
      "空調の特別枠は、平成28〜令和7年度に都の大規模改修の補助を受け、耐用年数を超えた空調を更新する施設など",
    ],
    rate: { pre: "補助基準額・対象経費の", value: "3/4", post: "まで", note: "補助基準額と対象経費の範囲内。採択と金額は審査で決まります。" },
    caps: [
      { label: "建物・設備などの大規模改修", man: 18419.2, rate: 3 / 4, rateLabel: "3/4" },
      { label: "空調設備更新の特別枠", man: 6759.7, rate: 3 / 4, rateLabel: "3/4", note: "補助基準額9,013万円の3/4" },
    ],
    capNote: "空調の特別枠は対象になる施設が限られます（要件をご確認ください）。",
    costBasis: "all",
    windows: [{ label: "第2回 協議書の提出締切", short: "第2回 協議書", end: "2027-01-08", note: "その前に、区市町村の確認と都への予約が必要です。" }],
    scheduleNote: "内示は2027年6月下旬の予定。工事は内示のあと（工事の時期も事前に確認）。",
    flow: ["相談・現地調査", "見積・図面", "区市町村の確認", "都へ予約・協議書の提出", "内示（2027年6月下旬予定）", "入札・契約・工事", "実績報告・補助金の入金"],
    stopAt: 4,
    stack: "同じ工事に、国の交付金など他の補助を重ねられるかは、都の要綱で決まります（要確認）。",
    money: "後払いが基本です。工事の完了後、実績報告を経て補助金が入ります。",
    pitfalls: ["内示の前に契約しない", "前回の大規模改修などから10年たっていないと対象外", "業者は入札などのルールに沿って施設が公平に決める", "空調の特別枠は対象になる施設が限られる"],
    roles: [facilityRole("区市町村・東京都"), EHC_ROLE, GYOSEI_ROLE, { who: "区市町村・東京都", what: "確認・協議の受付・審査・内示・補助金の支払い" }],
    official: [{ label: "東京都 福祉局（改修費補助の資料）", url: "https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/06-2_kaishyuuhihojomatomer8-3-13-pdf-1" }],
    pending: ["財務審査の条件と事前予約の手順"],
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
    use: ["空調・給排水・屋上防水などの大規模な修繕"],
    target: "都内の地域密着型特養・小規模多機能・看護小規模多機能",
    targetNote: "区市町村がこの事業を行っている場合に限ります。",
    requirements: ["区市町村がこの事業を行っていること（実施は区市町村の任意）", "都の内示のあとに入札・契約・着工すること", "令和8年度内に工事を終えること", "対象経費が80万円以上", "国の交付金（大規模修繕等）とは併用できない"],
    rate: { pre: "対象経費の", value: "1/2", post: "（都1/4＋区市町村1/4）", note: "区市町村がこの事業を行う場合。残りの1/2は施設の負担です。" },
    caps: [
      { label: "地域密着型特養", man: 1660, rate: 0, rateLabel: "確認中", note: "上限か基準額か確認中" },
      { label: "小規模多機能・看護小規模多機能", man: 833, rate: 0, rateLabel: "確認中", note: "上限か基準額か確認中" },
    ],
    capNote: "1施設あたりの金額です。都の資料では「補助上限」とありますが、読み方を都に確認中のため、補助の目安は出していません。",
    costBasis: "all",
    minMan: 80,
    windows: [{ label: "協議の最終期限（区市町村→都）", short: "協議の最終期限（区市町村→都）", end: "2026-11-27", note: "施設から区市町村への提出は、これより前です。区市町村にご確認ください。" }],
    scheduleNote: "内示のあとに入札・契約。令和8年度内に工事を終えます。",
    flow: ["相談・現地調査", "見積", "区市町村へ相談・提出", "区市町村から都へ協議", "内示", "入札・契約・工事（年度内）", "実績報告・入金"],
    stopAt: 4,
    stack: "国の交付金（大規模修繕等）とは併用できません。",
    money: "区市町村を通じた後払いが基本です（区市町村によります）。",
    pitfalls: ["区市町村が行っていないと使えない", "施設からの提出の期限は11月27日より前", "年度内に工事を終える必要がある"],
    roles: [facilityRole("区市町村"), EHC_ROLE, GYOSEI_ROLE, { who: "区市町村・東京都", what: "募集・協議・内示・補助金の支払い" }],
    official: [{ label: "東京都 福祉局（令和8年度の資料）", url: "https://www.fukushi.metro.tokyo.lg.jp/documents/d/fukushi/2026-09-09-111358-349" }],
    pending: ["1,660万円・833万円が上限か基準額か", "所在地の区市町村が行っているか"],
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
    use: ["空調などの大規模修繕", "非常用自家発電・給水・水害対策・換気など"],
    target: "定員29人以下の介護施設",
    targetNote: "特養・老健・介護医療院・ケアハウスは1施設1,660万円、グループホーム・小規模多機能・看護小規模多機能・養護などは833万円まで。",
    requirements: [
      "定員29人以下（30人以上は別のメニュー）",
      "対象経費が80万円以上",
      "市区町村の募集に合わせて協議する",
      "令和9年度分から、大規模修繕には中長期の修繕計画が必要",
    ],
    rate: { pre: "対象経費の", value: "10/10", post: "（上限まで）", note: "上限を超える分・対象外の経費は施設の負担です。" },
    caps: [
      { label: "特養・老健・介護医療院・ケアハウス", man: 1660, rate: 1, rateLabel: "10/10" },
      { label: "グループホーム・小規模多機能・養護など", man: 833, rate: 1, rateLabel: "10/10" },
    ],
    capNote: "1施設あたり。採択と金額は審査と市区町村の要綱で決まります。",
    costBasis: "all",
    minMan: 80,
    windows: [],
    scheduleNote: "令和8年度の一次の協議は終わっています（6月に内示）。次の募集は市区町村が案内します（未発表）。",
    flow: ["相談・現地調査", "見積・修繕の計画", "市区町村へ協議", "内示・交付決定", "入札・契約・工事", "実績報告・交付"],
    stopAt: 3,
    stack: "都の「地域密着型の大規模な修繕」とは併用できません。ほかの補助との重ね方は要綱で決まります。",
    money: "市区町村を通じて交付されます。工事の前に受け取れる場合もあります（概算払・市区町村が認めた場合）。",
    pitfalls: ["市区町村が募集していないと申請できない", "内示の前に契約しない", "80万円未満は対象外", "来年度分から修繕計画が必要"],
    roles: [facilityRole("市区町村"), EHC_ROLE, GYOSEI_ROLE, { who: "市区町村", what: "募集・協議の受付・交付決定・補助金の支払い" }],
    official: [
      { label: "厚生労働省（実施要綱）", url: "https://www.mhlw.go.jp/content/001715706.pdf" },
      { label: "厚生労働省（修繕計画の通知 10/16）", url: "https://www.mhlw.go.jp/content/001760352.pdf" },
    ],
    pending: ["所在地の市区町村が受け付けているか", "令和8年度補正の追加の募集があるか"],
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
    use: ["耐震化・非常用発電などの防災対策と一体で行う大規模修繕"],
    target: "定員30人以上の介護施設",
    targetNote: "窓口は都道府県。対象になる工事のメニューが限られます。",
    requirements: ["定員30人以上", "防災対策と一体で行う改修であること", "都道府県の募集に合わせて協議する"],
    rate: { pre: "基準額の", value: "2/3", post: "まで", note: "国1/3＋都道府県等1/3。" },
    caps: [{ label: "基準額 3,160万円の2/3", man: 2106, rate: 2 / 3, rateLabel: "2/3" }],
    capNote: "採択と金額は審査と都道府県の要綱で決まります。",
    costBasis: "all",
    windows: [],
    scheduleNote: "次の募集は都道府県が案内します（未発表）。",
    flow: ["相談・現地調査", "見積・防災の計画", "都道府県へ協議", "内示・交付決定", "入札・契約・工事", "実績報告・交付"],
    stopAt: 3,
    stack: "ほかの補助との重ね方は要綱で決まります（要確認）。",
    money: "都道府県を通じた後払いが基本です。",
    pitfalls: ["防災対策と一体でないと対象外", "内示の前に契約しない", "都道府県のメニューにあるか確認が要る"],
    roles: [facilityRole("都道府県"), EHC_ROLE, GYOSEI_ROLE, { who: "都道府県", what: "募集・協議の受付・交付決定・補助金の支払い" }],
    official: [{ label: "厚生労働省（実施要綱）", url: "https://www.mhlw.go.jp/content/001715706.pdf" }],
    pending: ["所在地の都道府県のメニューと募集の時期"],
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
    organizer: "経済産業省・環境共創イニシアチブ（SII）",
    use: ["指定された高効率な機種（空調など）への更新", "対象は設備費（工事費は対象外）"],
    target: "国内の法人・個人事業主",
    targetNote: "社会福祉法人・医療法人は従業員300人以下なら中小企業者等。大企業は条件あり。",
    requirements: ["指定された機種への更新", "3社以上の見積り", "点数の高い順に予算の範囲で採択", "交付決定の前に契約しない"],
    rate: { pre: "設備費の", value: "1/3", post: "まで", note: "トップ性能枠（更新）は1/2（空調はクラウドAI制御付きの電気式パッケージに限る）。" },
    caps: [
      { label: "従来枠", man: 10000, rate: 1 / 3, rateLabel: "1/3" },
      { label: "メーカー強化枠・トップ性能枠", man: 30000, rate: 1 / 3, rateLabel: "1/3〜1/2", inEstimate: false },
    ],
    capNote: "指定された機種への更新が対象。採択と金額は審査で決まります。",
    costBasis: "equipment",
    windows: [{ label: "4次 申請締切（郵送・必着）", short: "4次", start: "2026-10-05", end: "2026-10-30", time: "17時必着" }],
    scheduleNote: "次の公募は未発表です。国の来年度の予算の要求に、後継の事業が入っています。",
    flow: ["相談・現地調査", "3社以上の見積り", "申請（公募の期間内）", "交付決定", "契約・工事・支払い", "実績報告・補助金の入金"],
    stopAt: 3,
    stack: "同じ設備に、都のゼロエミなど他の補助を重ねて受けられるかは、公募要領で決まります（要確認）。",
    money: "後払いです。工事の完了と支払いのあと、実績報告を経て入金されます（4次の場合は2027年1〜3月）。",
    pitfalls: ["工事費は対象外（設備費のみ）", "指定の機種でないと対象外", "3社以上の見積りが必要", "完了の期限が短い（4次は2027年1月31日）"],
    roles: [facilityRole("SII"), EHC_ROLE, GYOSEI_ROLE, { who: "SII（事務局）", what: "審査・交付決定・完了の確認・補助金の支払い" }],
    official: [{ label: "SII 省エネ補助金（公式）", url: "https://syouenehojyokin.sii.or.jp/about-type/setsubi.html" }],
    pending: ["次の公募の有無と時期", "冷媒だけの入れ替えが対象外であることの正式な確認"],
    verifiedAt: VERIFIED_AT,
  },
};

export const PROGRAM_ORDER: ProgramId[] = ["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu", "kokuKaigo", "kokuKaigo30", "sii"];

/** どの結果にも一番上に出す注意 */
export const COMMON_CAUTIONS = [
  "どの制度も、交付決定（内示）の前に契約・発注すると対象外になります。",
  "同じ工事にいくつかの補助を重ねて受けられるかは、それぞれの要綱で決まります。この画面では金額を合算しません。",
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
