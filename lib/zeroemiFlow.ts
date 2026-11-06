/* ───────────────────────────────────────────────────────────
   v3 / 2026-11-06 / EHC-0150 ゼロエミ専用ページ（広告の遷移先・東京都内の事業者向け）の決め事
   ・1ページ（/zeroemi）＋上の切り替え（空調・照明など／冷凍冷蔵庫・ショーケース）。/zeroemi/reizo は冷凍冷蔵側を選んだ状態で開く。
     本人の指示「この二つのURL合算できない？」→「1ページ＋上で切り替え」。kind は「どちらの表示で送ったか」だけを表す。
   ・流れ：5問の簡易診断 → 結果と助成の目安・併用の判定 → そのまま問い合わせ。
     Zoom面談を希望するなら空き枠から予約（Zoomで照合）、希望しないなら電話かメールで折り返し。
   ・本人の指示「どちらか受けるとどちらかできないとかもしっかり判定したい」→ combos（併用の判定）。
     決まりの出典（2026-11-06に一次資料の原文で確認。本人の指示「徹底して確認して」）:
       ゼロエミ交付要綱（令和8年3月27日改正）第3条第1項第2号・第12条第3号：
         助成対象設備の経費に、国その他の団体（区市町村を除く）の補助を重ねて受けられない。
       ゼロエミ募集要項（令和8年9月16日版）p.6「2.1(4)その他」ア：同一の内容で国その他の団体（都内区市町村は除く）から
         補助を受けている・受けることが決まっている者は対象外。注1：都の省エネ促進税制（事業税の減免）は受けられない。
         p.14：申請後の区分変更・申請額の修正は一切受け付けない。
         p.15「3.1(3)⑤」：各回で1事業者が申請できるのは1事業所のみ。1事業者が同一事業所を申請できるのは年度に1回まで。
         1事業者から複数の申請があったら、はじめに申請されたものを受理。
       ゼロエミ公式Q&A（令和8年9月15日版）A205（併用不可・都内区市町村を除く）・A206/A606（各回1事業者1事業所）・
         A207（翌年度なら同一事業所で別設備を申請できる）・A208（同一事業所は1回）・A408（CO2の削減は申請設備全体で判定）・A608（区分変更不可）。
       ノンフロン実施要綱（令和8年2月26日改正）第4 5(2)：国その他の団体の助成等を受ける場合、本助成金の交付額から当該額を控除。
         Q&A Ver.1.0（A108 申請回数の制限なし・A111 事業所ごとに申請・A306 室内機と室外機はセット）。
       国の側：SII 省エネ・非化石転換補助金（設備単位型・令和7年度補正）公募要領 p.14：補助対象経費が重複する他の補助との併用不可。
         ただし地方公共団体の一般財源（地方税・地方交付税など使途が特定されていない財源）による補助等との併用は認める。
         環境省 冷凍冷蔵機器の脱フロン・脱炭素化推進事業（JRECO・令和8年度）よくある質問：国の他の補助とは不可。
         地方公共団体等の補助とは併用可（その補助の側が併用できる仕組みであること。交付額は「寄付金その他の収入」に記載）。
   ・ここで出すのは「使える見込み」と「目安」。採択・金額・対象の確定はしない（景表法・要綱の確認が先）。
     併用は「できない（×）」が要綱で確かなものと、「条件つき・要確認（△）」と、「機械を分ければ使える見込み（○）」だけ。
   ・数字の出典：クール・ネット東京（ゼロエミ・2026-11-06確認）／東京都環境公社（ノンフロン・2026-11-06確認）。
   ─────────────────────────────────────────────────────────── */

import { PROGRAMS, PREP_DAYS, upcomingWindows, type ProgramWindow } from "./programs";
import { daysBetween } from "./programClock";

export type ZeroemiKind = "kucho" | "reizo";
export const ZEROEMI_KINDS = ["kucho", "reizo"] as const;
export type ZeroemiContact = "zoom" | "callback";

export const ZE_PLACES = [
  { id: "tokyo", label: "東京都内" },
  { id: "other", label: "東京都の外" },
] as const;
export type ZePlace = (typeof ZE_PLACES)[number]["id"];

export const ZE_ORGS = [
  { id: "sme", label: "中小企業・個人事業主" },
  { id: "corp", label: "医療法人・社会福祉法人・学校法人など" },
  { id: "large", label: "大企業、または大企業が株式の半分以上を持つ会社" },
  { id: "unknown", label: "分からない" },
] as const;
export type ZeOrg = (typeof ZE_ORGS)[number]["id"];

export const ZE_EQUIP = {
  kucho: [
    { id: "ac", label: "空調（業務用エアコン）" },
    { id: "vent", label: "換気（全熱交換器など）" },
    { id: "light", label: "LED照明" },
    { id: "water", label: "給湯・ボイラー" },
    { id: "other", label: "その他（変圧器・断熱窓など）" },
  ],
  reizo: [
    { id: "sc_in", label: "内蔵型ショーケース（コンセント式）" },
    { id: "sc_out", label: "別置型ショーケース（冷凍機が別）" },
    { id: "unit", label: "プレハブ冷蔵庫・冷凍庫の冷凍機" },
    { id: "fridge", label: "業務用冷凍冷蔵庫・コールドテーブル" },
    { id: "chiller", label: "チリングユニット" },
    { id: "unknown", label: "冷凍冷蔵の機械（機種はまだ分からない）" },
  ],
} as const;
/** 空調・照明などと冷凍冷蔵をまとめた一覧（1ページにまとめたので、どちらの表示からでも両方選べる） */
export const ZE_EQUIP_ALL = [...ZE_EQUIP.kucho, ...ZE_EQUIP.reizo] as const;
const KUCHO_IDS: readonly string[] = ZE_EQUIP.kucho.map((x) => x.id);
const REIZO_IDS: readonly string[] = ZE_EQUIP.reizo.map((x) => x.id);

/** ほかの補助金の予定（併用の判定に使う）。none は他と同時に選ばない */
export const ZE_OTHERS = [
  { id: "national", label: "国の補助金（省エネ補助金など）に申し込んだ・申し込む予定" },
  { id: "city", label: "区市町村の補助金も使う予定" },
  { id: "zeAlready", label: "今年度、この事業所でゼロエミにもう申し込んだ" },
  { id: "multiSite", label: "店舗・事業所が複数ある（いくつかで入れ替えたい）" },
  { id: "none", label: "特にない・分からない" },
] as const;
export type ZeOther = (typeof ZE_OTHERS)[number]["id"];

export const ZE_BUDGETS = [
  { id: "lt500", label: "500万円未満", min: 0, max: 500 },
  { id: "500", label: "500万〜1,000万円", min: 500, max: 1000 },
  { id: "1000", label: "1,000万〜3,000万円", min: 1000, max: 3000 },
  { id: "3000", label: "3,000万円以上", min: 3000, max: null },
  { id: "unknown", label: "まだ分からない", min: null, max: null },
] as const;
export type ZeBudget = (typeof ZE_BUDGETS)[number]["id"];

/** ノンフロン機器の申請受付の終わり（東京都環境公社・令和8年度。予算に達したらその時点で終了） */
export const NONFURON_END = "2027-03-31";
export const NONFURON_URL = "https://www.tokyokankyo.jp/apply/nonfuron/nonfuron-r8/";
/** ゼロエミの工事完了届の最終提出期限（第5回・第6回とも。クール・ネット東京） */
export const ZEROEMI_REPORT_END = "2027-11-30";

export interface ZeroemiAnswers {
  /** どちらの表示（切り替え）で答えたか。判定には使わない */
  kind: ZeroemiKind;
  place: ZePlace;
  city: string;
  org: ZeOrg;
  /** 空調・照明などと冷凍冷蔵の両方から選べる */
  equip: string[];
  budget: ZeBudget;
  /** ほかの補助金の予定。古い画面から来た答えには無いので省略可 */
  others?: ZeOther[];
}

export interface ZeroemiMark {
  name: string;
  mark: "○" | "△" | "×";
  note: string;
}

/** 併用の判定（どちらかを受けると、もう一方ができない、など） */
export interface ZeroemiCombo {
  /** ×＝できない（要綱で確か）／△＝条件つき・要確認／○＝機械を分ければ使える見込み */
  mark: "○" | "△" | "×";
  title: string;
  note: string;
  /** 根拠（画面と担当者メールに出す） */
  src: string;
}

export interface ZeroemiJudge {
  level: "likely" | "check" | "other";
  title: string;
  reason: string;
  marks: ZeroemiMark[];
  /** 助成の目安（万円）。予算が分からない・対象外なら null */
  estimate: { min: number; max: number | null; text: string; note: string } | null;
  combos: ZeroemiCombo[];
  /** ゼロエミとノンフロンのどちらも候補になる機械がある（比べる表を出す） */
  compare: boolean;
}

const SRC_ZE_YOUKOU = "ゼロエミ交付要綱（令和8年度）第3条・第12条、募集要項（令和8年9月16日版）p.6";
const SRC_ZE_ONCE = "ゼロエミ募集要項（令和8年9月16日版）p.15、公式Q&A（令和8年9月15日版）A208・A408";
const SRC_NF = "ノンフロン機器の助成 実施要綱（令和8年度）第4 5(2)";
const SRC_NATIONAL = "SII省エネ補助金 公募要領（令和7年度補正）p.14、環境省 冷凍冷蔵機器の補助（JRECO）よくある質問";

const labelOf = (list: readonly { readonly id: string; readonly label: string }[], id: string): string => list.find((x) => x.id === id)?.label ?? id;

/** 万円を「1,500万円」の形に */
const man = (v: number) => `${Math.round(v).toLocaleString("ja-JP")}万円`;

function rangeText(min: number, max: number | null): string {
  if (max === null) return `${man(min)}〜`;
  if (min <= 0) return `〜${man(max)}`;
  if (Math.round(min) === Math.round(max)) return man(max);
  return `${Math.round(min).toLocaleString("ja-JP")}万〜${man(max)}`;
}

/** 機械ごとの見込み（EHC-0136 の早見表と同じ）。○＝対象 △＝機種しだい ×＝対象外 */
const ZE_ITEM: Record<string, ZeroemiMark["mark"]> = { ac: "○", vent: "○", light: "○", water: "○", other: "○", sc_in: "○", sc_out: "○", unit: "○", fridge: "△", chiller: "△", unknown: "△" };
const NF_ITEM: Record<string, ZeroemiMark["mark"]> = { sc_in: "○", sc_out: "○", unit: "○", fridge: "×", chiller: "○", unknown: "△" };
const bestOf = (ids: string[], m: Record<string, ZeroemiMark["mark"]>): ZeroemiMark["mark"] => {
  const marks = ids.map((e) => m[e] ?? "△");
  return marks.includes("○") ? "○" : marks.includes("△") ? "△" : "×";
};

/** 簡易診断の判定。使える見込みと目安・併用の判定だけを出す（確定はしない）。 */
export function judgeZeroemi(a: ZeroemiAnswers): ZeroemiJudge {
  const b = ZE_BUDGETS.find((x) => x.id === a.budget) ?? ZE_BUDGETS[4];
  const others = a.others ?? [];
  if (a.place !== "tokyo") {
    return {
      level: "other",
      title: "東京都の外の工事は、ゼロエミの対象外です",
      reason: "ゼロエミとノンフロン機器の助成は、都内の事業所が対象です。国の省エネ補助金（SII）など、工事場所で使える制度があるか一緒に確かめます。このままご相談ください。",
      marks: [{ name: "東京都のゼロエミ", mark: "×", note: "都内の事業所が対象" }],
      estimate: null,
      combos: [],
      compare: false,
    };
  }
  const kuchoSel = a.equip.filter((e) => KUCHO_IDS.includes(e));
  const reizoSel = a.equip.filter((e) => REIZO_IDS.includes(e));
  const large = a.org === "large";
  const already = others.includes("zeAlready");
  let zeMark: ZeroemiMark["mark"] = large || already ? "×" : bestOf(a.equip.length ? a.equip : ["unknown"], ZE_ITEM);
  if (zeMark === "○" && a.org === "unknown") zeMark = "△";
  const nfMark: ZeroemiMark["mark"] | null = reizoSel.length ? bestOf(reizoSel, NF_ITEM) : null;
  const zeOk = zeMark !== "×";
  const nfOk = nfMark !== null && nfMark !== "×";
  /* 両方の制度の候補になる機械（同じ機械にはどちらか一方） */
  const both = reizoSel.filter((e) => ZE_ITEM[e] !== "×" && NF_ITEM[e] !== "×");

  const marks: ZeroemiMark[] = [{
    name: "東京都のゼロエミ（省エネの機械へ）",
    mark: zeMark,
    note: large ? "中小企業・医療法人・社会福祉法人などが対象（大企業は対象外）"
      : already ? "同じ事業所の申請は年度に1回まで（募集要項）"
      : kuchoSel.length && reizoSel.length ? "空調・照明などと冷凍冷蔵を、1つの申請にまとめて入れ替え"
      : reizoSel.length ? "インバータ圧縮機などの省エネ機種への入れ替え" : "空調・換気・照明・給湯などの入れ替え",
  }];
  if (nfMark) marks.push({ name: "ノンフロン機器の助成（フロンを使わない冷凍冷蔵の機械へ）", mark: nfMark, note: `自然冷媒（CO2・プロパンなど）の機種。業務用冷凍冷蔵庫・コールドテーブルは対象外${large ? "。大企業は1/2" : ""}` });

  const level: ZeroemiJudge["level"] = marks.some((m) => m.mark === "○") ? "likely" : marks.some((m) => m.mark === "△") ? "check" : "other";

  /* ───── 併用の判定（×は要綱・募集要項で確かなもの） ───── */
  const combos: ZeroemiCombo[] = [];
  if (both.length && zeOk) {
    combos.push({ mark: "×", title: "同じ機械に、ゼロエミとノンフロンの両方は使えません", note: "ゼロエミは、国や都など（都内の区市町村を除く）ほかの補助を同じ設備に重ねられません。冷凍冷蔵の機械は、1台ずつどちらか一方を選びます。", src: SRC_ZE_YOUKOU });
    if (kuchoSel.length || reizoSel.length > 1) {
      combos.push({ mark: "○", title: "機械を分ければ、両方の制度を使える見込みです", note: kuchoSel.length ? "例：空調・照明などはゼロエミ、自然冷媒のショーケース・冷凍機はノンフロン。1台に1つの制度なら、重ねたことになりません。" : "例：別置型ショーケースはノンフロン、ほかの機械はゼロエミ。1台に1つの制度なら、重ねたことになりません。", src: "両制度の要綱（重ねられないのは同じ設備・経費）。進める前に両方の事務局に確認します" });
    }
  }
  if (zeOk) {
    combos.push({
      mark: "×",
      title: "ゼロエミは、同じ事業所で今年度1回だけ（あとから設備を足せません）",
      note: kuchoSel.length && reizoSel.length
        ? "空調・照明などと冷凍冷蔵をゼロエミで入れ替えるなら、1つの申請にまとめます。CO2の削減は申請した設備全体で数えるので、まとめると区分（3/4）に届きやすくなります。"
        : "入れ替えたい設備は、最初の申請にまとめます。CO2の削減は申請した設備全体で数えます。",
      src: SRC_ZE_ONCE,
    });
    combos.push({ mark: "×", title: "区分（3/4か2/3）と申請額は、申し込んだあとに変えられません", note: "CO2をどれだけ減らせるかを先に計算し、区分を決めてから申し込みます。", src: "ゼロエミ募集要項（令和8年9月16日版）p.14、公式Q&A A608" });
    combos.push({ mark: "×", title: "ゼロエミを受けると、都の省エネ促進税制（事業税の減免）は受けられません", note: "事業税の減免を使う予定がある場合は、どちらが有利かを先に比べます。", src: "ゼロエミ募集要項（令和8年9月16日版）p.6 注1" });
  }
  if (others.includes("national")) {
    if (zeOk) combos.push({ mark: "×", title: "国の補助（省エネ補助金など）とゼロエミは、同じ設備に重ねられません", note: "国の補助を受ける設備は、ゼロエミの対象になりません。設備ごとにどちらか一方を選びます。", src: `${SRC_ZE_YOUKOU}、公式Q&A A205` });
    if (nfOk) combos.push({ mark: "△", title: "ノンフロンは国の補助と重ねられますが、国の補助の額を差し引きます", note: "ノンフロンの助成は、国などの補助を受けるとその額を引いた額になります。合計はノンフロン単独とほぼ同じで、1台ごとの上限を超える分だけ増えます。国の側は、環境省の自然冷媒機器の補助は地方の補助との併用を認めています。SIIの省エネ補助金は、地方の一般財源による補助だけ併用を認めるため、ノンフロンが当たるかをSIIと都に確認します。", src: `${SRC_NF}／${SRC_NATIONAL}` });
  }
  if (others.includes("city")) {
    combos.push({ mark: "△", title: "都内の区市町村の補助は、ゼロエミと重ねられます（区市町村の側の決まりを確認）", note: `ゼロエミは、重ねてはいけない補助から都内の区市町村を除いています。区市町村の制度の側が、都の補助との併用を認めているかを確かめます。${nfOk ? "ノンフロンは、ほかの補助を受けるとその額を差し引きます。" : ""}`, src: `${SRC_ZE_YOUKOU}${nfOk ? `／${SRC_NF}` : ""}` });
  }
  if (already) {
    combos.push({ mark: "×", title: "この事業所は、今年度のゼロエミに追加で申し込めません", note: `同じ事業所の申請は年度に1回までです（翌年度なら別の設備で申請できますが、この事業は2026年度までで、続くかは未発表です）。${nfOk ? "冷凍冷蔵の自然冷媒の機械なら、ノンフロン機器の助成（先着順・2027年3月31日まで）を考えます。" : "別の事業所（別の店舗など）なら申し込めます。"}`, src: "ゼロエミ募集要項（令和8年9月16日版）p.15、公式Q&A A207・A208" });
  }
  if (others.includes("multiSite")) {
    if (zeOk) combos.push({ mark: "×", title: "ゼロエミは、1回の受付で1事業所だけ申し込めます", note: "同じ回に2つ以上出すと、はじめに出した申請だけが受理されます。事業所ごとに回を分けるので、今年度の残りの回で出せる事業所の数には限りがあります。どの事業所を先に出すかを決めます。", src: "ゼロエミ募集要項（令和8年9月16日版）p.15、公式Q&A A206・A606" });
    if (nfOk) combos.push({ mark: "○", title: "ノンフロン機器の助成は、事業所ごとに何度でも申請できます", note: "設置場所ごとに申請します。申請の回数の制限はありません（予算に達したら受付終了）。", src: "ノンフロン Q&A Ver.1.0 A108・A111" });
  }

  const rateNf = large ? 1 / 2 : 2 / 3;
  const est = b.min === null || (!zeOk && !nfOk) ? null
    : zeOk && !nfOk ? { min: Math.min(b.min * 2 / 3, 1000), max: b.max === null ? 4500 : Math.min(b.max * 3 / 4, 4500) }
    : !zeOk ? { min: b.min * rateNf, max: b.max === null ? null : b.max * rateNf }
    : { min: b.min * 2 / 3, max: b.max === null ? null : b.max * 3 / 4 };
  const estNote = zeOk && !nfOk
    ? "補助の対象になる費用（税抜）がこの予算の場合の目安です。年28トン以上減らすなら3/4（上限4,500万円）、それ以外は2/3（上限2,500万円か1,000万円）。撤去・処分費と消費税は対象外です。"
    : !zeOk ? `${large ? "大企業はノンフロン機器の助成（1/2）だけです。" : "ノンフロン機器の助成は2/3です。"}上限は機械1台ごとに決まっています。予算が補助の対象になる費用（税抜）の場合の目安です。`
    : "ゼロエミは最大3/4（1つの申請で上限4,500万円）、ノンフロンは2/3（上限は機械1台ごと）。同じ機械には一方だけです。予算が補助の対象になる費用（税抜）の場合の目安です。";

  const title = level === "other"
    ? (already && !nfOk ? "この事業所は、今年度のゼロエミに追加で申し込めません"
      : large && !reizoSel.length ? "大企業は、ゼロエミの対象外です"
      : "選んだ機械は、2つの制度の対象外の見込みです")
    : level === "check" ? "機種や会社の区分しだいで、使える見込みがあります"
    : zeMark === "○" && nfMark === "○" ? "ゼロエミかノンフロンの助成が使える見込みがあります"
    : zeMark === "○" ? "ゼロエミが使える見込みがあります"
    : "ノンフロン機器の助成が使える見込みがあります";
  const reason = level === "other"
    ? (already ? "同じ事業所のゼロエミの申請は、年度に1回までです。別の事業所や、ほかの制度を一緒に確かめます。"
      : large && !reizoSel.length ? "ゼロエミは中小企業・医療法人・社会福祉法人などが対象です。国の省エネ補助金（SII）など、ほかの制度を一緒に確かめます。"
      : "業務用冷凍冷蔵庫・コールドテーブルは、ノンフロンの対象外です。大企業はゼロエミの対象外です。ほかの方法も含めてご相談ください。")
    : both.length && zeOk ? "同じ機械に2つの制度は使えません。今の機械・冷媒・電気の使い方を現地で見て、機械ごとにどちらが合うかと、助成の目安をお伝えします。"
    : zeOk ? (a.org === "unknown"
      ? "会社の区分（中小企業等か）を確かめたうえで、CO2をどれだけ減らせるかで助成の割合（3/4か2/3）が決まります。現地で今の設備と電気の使い方を確かめます。"
      : "CO2をどれだけ減らせるかで、助成の割合（3/4か2/3）と上限が決まります。現地で今の設備と電気の使い方を確かめ、どの区分になるかをお伝えします。")
    : "自然冷媒（CO2・プロパンなど）の機種への入れ替えが対象です。機械1台ごとの上限があります。現地で今の機械と冷媒を確かめます。";

  return {
    level, title, reason, marks,
    estimate: est ? { ...est, text: rangeText(est.min, est.max), note: estNote } : null,
    combos,
    compare: both.length > 0 && zeOk,
  };
}

/** 担当者メールの件名に入れる「何を入れ替えたいか」 */
export function zeroemiSubjectTag(a: ZeroemiAnswers): string {
  const k = a.equip.some((e) => KUCHO_IDS.includes(e)), r = a.equip.some((e) => REIZO_IDS.includes(e));
  return k && r ? "空調＋冷凍冷蔵" : r ? "冷凍冷蔵" : "空調";
}

/** これから準備するならどの回か（締切まで準備の日数がある最初の回）。無ければ最後の回。 */
export function zeroemiTargetWindow(today: string): { target: ProgramWindow | null; tooSoon: ProgramWindow | null } {
  const ws = upcomingWindows(PROGRAMS.tokyoZeroemi, today);
  const target = ws.find((w) => daysBetween(today, w.end) >= PREP_DAYS) ?? null;
  const tooSoon = ws.find((w) => daysBetween(today, w.end) < PREP_DAYS) ?? null;
  return { target, tooSoon };
}

/* ───────── 送信の確かめ（サーバ側） ───────── */

export interface ZeroemiLead {
  kind: ZeroemiKind;
  answers: ZeroemiAnswers;
  contact: ZeroemiContact;
  campaign: string | null;
  test: boolean;
}

const CITY_BAD = /[\u0000-\u001f<>]/;

export function readZeroemiAnswers(raw: unknown): ZeroemiAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!(ZEROEMI_KINDS as readonly unknown[]).includes(r.kind)) return null;
  const kind = r.kind as ZeroemiKind;
  if (!ZE_PLACES.some((x) => x.id === r.place)) return null;
  if (!ZE_ORGS.some((x) => x.id === r.org)) return null;
  if (!ZE_BUDGETS.some((x) => x.id === r.budget)) return null;
  const city = typeof r.city === "string" ? r.city.trim() : "";
  if (city.length > 60 || CITY_BAD.test(city)) return null;
  if (r.place === "tokyo" && !city) return null;
  /* 1ページにまとめたので、どちらの表示からでも空調・照明などと冷凍冷蔵の両方を受ける */
  const allowed = ZE_EQUIP_ALL.map((x) => x.id as string);
  const equip = Array.isArray(r.equip) ? Array.from(new Set(r.equip.filter((e): e is string => typeof e === "string" && allowed.includes(e)))).slice(0, ZE_EQUIP_ALL.length) : [];
  if (!equip.length) return null;
  const okOthers = ZE_OTHERS.map((x) => x.id as string);
  let others = Array.isArray(r.others) ? Array.from(new Set(r.others.filter((e): e is ZeOther => typeof e === "string" && okOthers.includes(e)))) : [];
  if (others.length > 1) others = others.filter((o) => o !== "none");
  return { kind, place: r.place as ZePlace, city, org: r.org as ZeOrg, equip, budget: r.budget as ZeBudget, others };
}

export function readZeroemiLead(raw: unknown): { value: ZeroemiLead | null; error: string | null } {
  if (raw == null) return { value: null, error: null };
  if (typeof raw !== "object" || Array.isArray(raw)) return { value: null, error: "簡易診断の答えを確認できません。ページを開き直してください。" };
  const r = raw as Record<string, unknown>;
  const answers = readZeroemiAnswers(r.answers);
  if (!answers) return { value: null, error: "簡易診断の答え（工事場所・会社の区分・設備・予算）をご確認ください。" };
  if (r.contact !== "zoom" && r.contact !== "callback") return { value: null, error: "連絡の方法（Zoomで面談か、電話・メールで連絡か）をお選びください。" };
  const campaign = typeof r.campaign === "string" && /^[a-z0-9_]{1,60}$/.test(r.campaign) ? r.campaign : null;
  return { value: { kind: answers.kind, answers, contact: r.contact, campaign, test: r.test === true }, error: null };
}

/** 担当者宛メールと Notion のメモに載せる行 */
export function zeroemiLines(z: ZeroemiLead): string[] {
  const a = z.answers;
  const j = judgeZeroemi(a);
  return [
    ...(z.test ? ["【営業対象外・公開確認テスト／月次集計から除外】"] : []),
    `入口: ゼロエミ専用ページ /zeroemi（${z.kind === "kucho" ? "空調・照明など" : "冷凍冷蔵庫・ショーケース"}の表示で送信）`,
    `キャンペーン: ${z.campaign ?? "広告以外／未確認"}`,
    `連絡の方法: ${z.contact === "zoom" ? "Zoomで面談（空き枠から予約）" : "電話かメールで折り返し"}`,
    "簡易診断の答え:",
    `・工事場所: ${labelOf(ZE_PLACES, a.place)}${a.city ? ` ${a.city}` : ""}`,
    `・会社の区分: ${labelOf(ZE_ORGS, a.org)}`,
    `・入れ替える設備: ${a.equip.map((e) => labelOf(ZE_EQUIP_ALL, e)).join("・")}`,
    `・予算の目安（税抜）: ${labelOf(ZE_BUDGETS, a.budget)}`,
    `・ほかの補助金の予定: ${(a.others ?? []).length ? (a.others ?? []).map((o) => labelOf(ZE_OTHERS, o)).join("・") : "（未回答）"}`,
    `画面に出した結果（確定ではない）: ${j.title}`,
    ...j.marks.map((m) => `・${m.mark} ${m.name}（${m.note}）`),
    ...(j.estimate ? [`・助成の目安: ${j.estimate.text}`] : []),
    ...(j.combos.length ? ["併用の判定（画面に出したもの）:", ...j.combos.map((c) => `・${c.mark} ${c.title}（根拠: ${c.src}）`)] : []),
    "補助対象・補助額: 未確定。法人規模・所有関係・実機・CO2削減量の確認が必要。",
  ];
}
