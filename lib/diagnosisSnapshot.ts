/* ───────────────────────────────────────────────────────────
   診断の確定スナップショット（EHC-0039 第8片 / 2026-09-14 v1）

   ■ なぜ「スナップショット」という1本を挟むのか
   　　この案件では、同じ診断の結果が4か所に出る。
   　　　① 画面（お客様が見ている数字）
   　　　② PDF（お客様が保存・転送する数字）
   　　　③ お客様宛メール本文
   　　　④ 担当者宛メール本文
   　　この4つを、それぞれの場所で state から組み立てると、
   　　組み立てた時刻が数ミリ秒ずれるだけで別の数字になりうる。
   　　実際に起きる形はこうである——送信ボタンを押した直後に
   　　入力欄がひとつ書き換わり、PDFは旧値・メールは新値で出る。
   　　受け取った側は同じ受付番号の書類2通で数字が違う理由を知らない。

   　　そこで「送信ボタンを押した瞬間の値」を1つのオブジェクトに固め、
   　　以後この4か所はすべてそのオブジェクトだけを読む。
   　　固めたあとの入力変更は、次の受付番号の話になる。

   ■ ここが計算を持たないこと
   　　金額は lib/pricing.ts の estimateUpdateBreakdownGroups()、
   　　工程日数は lib/timeline.ts の buildConstructionTimeline() を呼ぶだけ。
   　　式は1本も書かない。サーバ側もこの関数を呼んで再計算するので、
   　　画面が送ってきた金額と食い違えばサーバ側の値が残る。

   ■ null の意味（全案件で統一）
   　　　null … 分からない・未回答（既定値で埋めない）
   　　　0    … 確認した結果ゼロ
   　　　負値 … 削減ではなく増加
   ─────────────────────────────────────────────────────────── */

import type { DesiredTiming, EquipGroup, EquipType, MatchInput } from "./types";
import { estimateUpdateBreakdownGroups, yenJP } from "./pricing";
import { buildConstructionTimeline } from "./timeline";
import { readEnergyBill } from "./diagnosisEnergy";
/* 型だけを借りる。実体（buildReductionBasisViews）はここでは呼ばない。
   呼ぶと、このファイルが「根拠を組み立てる場所」になってしまい、
   lib/reductionBasisView.ts を1本の組み立て口にした意味が消える。
   import type は出力時に消えるので、実行時の依存も増えない。 */
import type { ReductionBasisView } from "./reductionBasisView";

export const EQUIP_LABEL_JA: Record<EquipType, string> = {
  ac: "業務用パッケージ",
  multi: "ビル用マルチ",
};

export const TIMING_LABEL_JA: Record<DesiredTiming, string> = {
  within_1m: "1か月以内",
  within_3m: "3か月以内",
  within_6m: "6か月以内",
  within_12m: "1年以内",
  undecided: "まだ決めていない",
};

/** 連絡先。氏名とメールだけを必須にする（会社名・電話は任意）。
    必須を増やすほど、まだ社名を出したくない段階の相談が落ちる。 */
export interface DiagnosisContact {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
}

/** 金額を出さなかった項目。件名だけ残して理由を添える。0円にしない。 */
export interface SnapshotUnpricedItem {
  label: string;
  reason: string;
}

export interface SnapshotEstimate {
  lines: { label: string; detail: string; amount: number }[];
  machine: number;
  work: number;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  /** 機種グレードによる幅。下限・上限とも同じ見積エンジンを通した値 */
  lowTotal: number;
  highTotal: number;
  units: number;
  systems: number;
  kg: number;
}

/* ───────── 補助金の候補と適合チェック（2026-09-25）─────────
   C段（結果と根拠）で表示した候補制度と、お客様ご自身の適合チェックの回答・結果を、
   問い合わせ（診断書PDF・担当者宛メール）に載せるための形。

   サーバはこの内容を作り直せない（所在地・規模を含む MatchInput を受け取っていないため、
   制度の判定をやり直せない）。よって「お客様の画面に出た内容」としてそのまま載せ、
   本文にもそう書く。内容の照合（指紋）には入れない。入れると、この節を送らない古い画面からの
   送信がすべて 409 になる（app/api/diagnosis-submit/route.ts の plans と同じ理由）。
   長さと件数は normalizeSubsidyCheck() で画面とサーバの両方が同じように切り詰める。 */
export interface SnapshotSubsidyProgram {
  name: string;
  /** 「今回の公募で進められる」「次回の公募に備える」 */
  group: string;
  /** 適合度の呼び名（lib/fitLabels.ts） */
  fit: string;
  timing: string;
  /** 補助額の目安。出していないときは null */
  amount: string | null;
  /** 適合チェックの結果（1行）。この制度に確認が無いときは null */
  selfCheck: string | null;
  /** EHC が確認すること */
  ehcItems: string[];
}

export interface SnapshotSubsidyCheck {
  /** 適合チェックの回答（問い → 答え）。未回答は「未回答」 */
  answers: { question: string; answer: string }[];
  programs: SnapshotSubsidyProgram[];
}

const clip = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";

/** 画面・サーバ共通の切り詰め。形が合わないものは捨てる（null） */
export function normalizeSubsidyCheck(v: unknown): SnapshotSubsidyCheck | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const answers = Array.isArray(o.answers)
    ? o.answers
        .slice(0, 6)
        .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>) : {}))
        .map((a) => ({ question: clip(a.question, 80), answer: clip(a.answer, 40) }))
        .filter((a) => a.question && a.answer)
    : [];
  const programs = Array.isArray(o.programs)
    ? o.programs
        .slice(0, 6)
        .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
        .map((p) => ({
          name: clip(p.name, 80),
          group: clip(p.group, 40),
          fit: clip(p.fit, 40),
          timing: clip(p.timing, 200),
          amount: p.amount == null ? null : clip(p.amount, 40) || null,
          selfCheck: p.selfCheck == null ? null : clip(p.selfCheck, 120) || null,
          ehcItems: Array.isArray(p.ehcItems) ? p.ehcItems.slice(0, 5).map((t) => clip(t, 80)).filter(Boolean) : [],
        }))
        .filter((p) => p.name)
    : [];
  if (!answers.length && !programs.length) return null;
  return { answers, programs };
}

/** 本文（メール）用の行。PDF は components/ContactStage.tsx が同じ内容を組む */
export function subsidyCheckLines(c: SnapshotSubsidyCheck): string[] {
  const out: string[] = [];
  c.programs.forEach((p) => {
    out.push(`　・${p.name}（${p.group}／${p.fit}）`);
    if (p.timing) out.push(`　　申請時期: ${p.timing}`);
    if (p.amount) out.push(`　　補助額の目安: ${p.amount}`);
    if (p.selfCheck) out.push(`　　適合チェック: ${p.selfCheck}`);
    if (p.ehcItems.length) out.push(`　　EHCが確認すること: ${p.ehcItems.join("／")}`);
  });
  if (c.answers.length) {
    out.push("　適合チェックの回答（お客様の自己申告）:");
    c.answers.forEach((a) => out.push(`　　${a.question} → ${a.answer}`));
  }
  return out;
}

/* ───────── 電気料金の明細（2026-09-25・お客様の任意入力）─────────
   担当者宛メールと Notion のメモに載せる（実際の単価が分かると、現地確認の前に削減額を引き直せる）。
   単価はサーバでも同じ式・同じ範囲（lib/diagnosisEnergy.ts の readEnergyBill）で出し直す。画面の値は信じない。
   内容の照合（指紋）には入れない（subsidyCheck と同じ理由）。 */
export interface SnapshotEnergyBill {
  period: "month" | "year";
  kwh: number | null;
  yen: number | null;
  /** 単価（円/kWh）。使用量と請求額がそろい、範囲内のときだけ */
  priceYenPerKwh: number | null;
}

export function normalizeEnergyBill(v: unknown): SnapshotEnergyBill | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const period = o.period === "year" ? "year" : o.period === "month" ? "month" : null;
  const num = (x: unknown, max: number): number | null =>
    typeof x === "number" && Number.isFinite(x) && x > 0 && x <= max ? x : null;
  const kwh = num(o.kwh, 1_000_000_000);
  const yen = num(o.yen, 100_000_000_000);
  if (!period || (kwh == null && yen == null)) return null;
  return { period, kwh, yen, priceYenPerKwh: readEnergyBill({ period, kwh, yen }).priceYenPerKwh };
}

export function energyBillLine(b: SnapshotEnergyBill): string {
  const kwh = b.kwh != null ? `${Math.round(b.kwh).toLocaleString("ja-JP")}kWh` : "未入力";
  const yen = b.yen != null ? yenJP(b.yen) : "未入力";
  const price = b.priceYenPerKwh != null ? `（単価 約${b.priceYenPerKwh.toFixed(1)}円/kWh・画面の削減額はこの単価で計算）` : "（単価は出していません）";
  return `${b.period === "month" ? "1か月分" : "1年分の合計"}　使用量 ${kwh}／請求額 ${yen}${price}`;
}

export interface DiagnosisSnapshotSource {
  receiptNo: string;
  issuedAtJst: string;
  contact: DiagnosisContact;
  /** 投影済みの群（種類・台数・設置年が揃ったもの）だけを渡す */
  equipGroups: EquipGroup[];
  /** 投影に落ちなかった群の理由（文言は lib/diagnosisProjection.ts が持つ） */
  unpriced: SnapshotUnpricedItem[];
  customerBudgetYen: number | null;
  desiredTiming: DesiredTiming | null;
  /* ───────── 削減率の根拠（2026-09-16 EHC-0039 v2 §4 作業3 / 台帳 #31）─────────
     C段の画面（components/ReductionBasisPanel.tsx）に出したものと同じ文言を
     診断書PDFにも載せるために、固める対象へ加える。
     組み立ては lib/reductionBasisView.ts の buildReductionBasisViews() だけが行い、
     呼び出し側（components/ContactStage.tsx）が結果を渡す。

     null と [] を分けること。全案件共通の null の意味をここでも守る。
       null … 根拠を組み立てていない（＝この経路では分からない）。紙に節を出さない
       []   … 組み立てた結果、対象の設備群が無かった。これも節は出ないが理由が違う

     サーバ（app/api/diagnosis-submit/route.ts）は null を渡す。
     サーバが受け取るのは設備群だけで、所在地・規模を含む MatchInput が無く、
     matchSubsidies() を呼び直せない＝根拠を作り直せないためである。
     作れないものを [] で渡すと「確認した結果、根拠が無かった」と読めてしまう。
     したがってメール本文（customerMailText / staffMailText）はこの値を使わない。
     使えば、画面が作った根拠とサーバが作れない根拠で書類が割れる。 */
  reductionBasis: ReductionBasisView[] | null;
  /** 2026-09-25 補助金の候補と適合チェック。送っていない（古い画面など）ときは null／省略 */
  subsidyCheck?: SnapshotSubsidyCheck | null;
  /** 2026-09-25 電気料金の明細（任意）。入れていない・送っていないときは null／省略 */
  energyBill?: SnapshotEnergyBill | null;
}

export interface DiagnosisSnapshot extends DiagnosisSnapshotSource {
  /** 金額を出せなかったときは null。0 ではない */
  estimate: SnapshotEstimate | null;
  /** estimate が null の理由。null のときだけ入る */
  estimateUnavailable: string | null;
  /** 実働日数の目安。総工期ではない。出せないときは null */
  workDays: number | null;
  /** 金額を算定した室内機の合計台数 */
  pricedUnits: number;
}

/** 馬力が入っている群だけが金額の対象。
    estimateMachineCost(0) は ¥250,000 を返すため、
    馬力の無い群を渡すと「誰も答えていない設備の機器費」が合計に混ざる。 */
export function pricedGroupsOf(groups: EquipGroup[]): EquipGroup[] {
  return groups.filter((g) => typeof g.hp === "number" && (g.hp as number) > 0 && g.units > 0);
}

export function buildDiagnosisSnapshot(src: DiagnosisSnapshotSource): DiagnosisSnapshot {
  const priced = pricedGroupsOf(src.equipGroups);
  const groupInput = priced.map((g) => ({ units: g.units, hp: g.hp as number }));

  let estimate: SnapshotEstimate | null = null;
  let estimateUnavailable: string | null = null;

  if (groupInput.length > 0) {
    const est = estimateUpdateBreakdownGroups(groupInput);
    const low = estimateUpdateBreakdownGroups(groupInput, { costClass: "value" });
    const high = estimateUpdateBreakdownGroups(groupInput, { costClass: "premium" });
    estimate = {
      lines: est.lines.map((l) => ({ label: l.label, detail: l.detail, amount: l.amount })),
      machine: est.machine,
      work: est.work,
      subtotal: est.subtotal,
      tax: est.tax,
      taxRate: est.taxRate,
      total: est.total,
      lowTotal: low.total,
      highTotal: high.total,
      units: est.units,
      systems: est.systems,
      kg: est.kg,
    };
  } else if (src.equipGroups.length > 0) {
    estimateUnavailable =
      "馬力が未入力のため金額を出していません（機器の価格は馬力でほぼ決まるため、一般値で埋めていません）。";
  } else {
    estimateUnavailable = "金額を出せる設備の入力がありません。";
  }

  /* 工程日数。buildConstructionTimeline は input.equipGroups と input.interest しか読まない。
     dropinOnly を false で明示しているので interest 側の分岐は評価されない（?? は短絡する）。
     ここで日数の式を書き写すと、工程表と診断書で日数が割れる。 */
  let workDays: number | null = null;
  if (priced.length > 0) {
    const planInput = { equipGroups: priced } as unknown as MatchInput;
    workDays = buildConstructionTimeline(planInput, { dropinOnly: false }).workDays;
  }

  return {
    ...src,
    estimate,
    estimateUnavailable,
    workDays,
    pricedUnits: priced.reduce((a, g) => a + g.units, 0),
  };
}

/* ───────── 本文の組み立て ─────────
   お客様宛と担当者宛で、同じスナップショットから別の本文を作る。
   数字は同じ、書く範囲だけが違う。
   お客様宛に社内の情報（協力会社名・会計期・担当者の割り当て）は入れない。 */

function equipLines(s: DiagnosisSnapshot): string[] {
  const priced = pricedGroupsOf(s.equipGroups);
  const out = priced.map(
    (g) =>
      `　・${EQUIP_LABEL_JA[g.equip]}／${g.hp}馬力／室内機${g.units}台／${g.installYear}年設置`
  );
  const noHp = s.equipGroups.filter((g) => !priced.includes(g));
  noHp.forEach((g) => {
    out.push(
      `　・${EQUIP_LABEL_JA[g.equip]}／室内機${g.units}台／${g.installYear}年設置　— 未算定（馬力が未入力）`
    );
  });
  s.unpriced.forEach((u) => out.push(`　・${u.label}　— 未算定（${u.reason}）`));
  return out.length > 0 ? out : ["　・（入力なし）"];
}

function estimateLines(s: DiagnosisSnapshot): string[] {
  if (!s.estimate) {
    return [`　概算金額: 未算定　${s.estimateUnavailable ?? ""}`.trimEnd()];
  }
  const e = s.estimate;
  return [
    `　機器費（税抜）: ${yenJP(e.machine)}`,
    `　工事費・諸経費（税抜）: ${yenJP(e.work)}`,
    `　小計（税抜）: ${yenJP(e.subtotal)}`,
    `　消費税（${Math.round(e.taxRate * 100)}%）: ${yenJP(e.tax)}`,
    `　合計（税込）: ${yenJP(e.total)}`,
    `　機種グレードによる幅: ${yenJP(e.lowTotal)} 〜 ${yenJP(e.highTotal)}`,
  ];
}

const COMMON_CAVEATS = [
  "この金額は概算です。足場・高所作業車・既存配管の更新・電源容量の増設・夜間割増は含みません。",
  "系統数は室内機2台で1系統、回収するフロンは室内機1台あたり3kgとして置いた仮定です。銘板の確認後に置き換わります。",
  "実働日数は目安で、総工期ではありません。日程は現地確認と機器の納期で決まります。",
  "補助制度によっては、交付決定より前の発注・契約・着工が対象外になります。該当するかは制度ごとに異なるため、着工前に確認します。",
];

/** お客様宛の件名（自動送付と、担当者が転送するときの件名を同じにする） */
export function customerMailSubject(s: Pick<DiagnosisSnapshot, "receiptNo">): string {
  return `【受付番号 ${s.receiptNo}】空調更新の診断結果と概算見積（株式会社EHCソリューションズ）`;
}

/* お客様に見せてよい節（受付番号〜ご確認ください）。自動送付の本文と、
   担当者が転送するときの文面の両方で使う。社内向けの記述（照合記録・現地確認の
   未確定項目・担当割り当て）はここに入れないこと。 */
function customerCoreLines(s: DiagnosisSnapshot): string[] {
  const lines: string[] = [
    `受付番号: ${s.receiptNo}`,
    `受付日時: ${s.issuedAtJst}`,
    "",
    "■ ご入力の設備",
    ...equipLines(s),
    "",
    "■ 概算費用",
    ...estimateLines(s),
  ];
  if (s.workDays != null) {
    lines.push("", `■ 工事の目安　実働 約${s.workDays}日（室内機${s.pricedUnits}台）`);
  }
  if (s.customerBudgetYen != null) {
    lines.push(
      "",
      `■ 伺っているご予算　${yenJP(s.customerBudgetYen)}`,
      "　概算金額の代わりには使っていません。ご予算に収める組み方のご相談に使わせていただきます。"
    );
  }
  if (s.desiredTiming != null) {
    lines.push("", `■ ご希望の時期　${TIMING_LABEL_JA[s.desiredTiming]}（確定した工期ではありません）`);
  }
  if (s.subsidyCheck && (s.subsidyCheck.programs.length || s.subsidyCheck.answers.length)) {
    lines.push("", "■ 補助金の候補と適合チェック（画面に表示した内容）", ...subsidyCheckLines(s.subsidyCheck));
  }
  lines.push("", "■ ご確認ください", ...COMMON_CAVEATS.map((c) => `　・${c}`));
  return lines;
}

export function customerMailText(s: DiagnosisSnapshot): string {
  return [
    `${s.contact.name} 様`,
    "",
    "空調更新の診断をお申し込みいただきありがとうございます。",
    "ご入力いただいた内容で診断書と概算見積をお作りしました。PDFを添付しています。",
    "",
    ...customerCoreLines(s),
    "",
    "担当者より改めてご連絡いたします。お急ぎの場合は、この受付番号をお伝えください。",
    "",
    "株式会社EHCソリューションズ",
  ].join("\n");
}

/** 担当者が名前を書き込む場所（転送用の文面で2か所） */
export const FORWARD_STAFF_PLACEHOLDER = "〔担当者名〕";

/** 担当者がお客様へ転送するときの文面（2026-09-25）。
 *  お客様宛の自動送付を止めている運用で、担当者宛メールの末尾に載せる。
 *  中身は自動送付の文面と同じ節（customerCoreLines）なので、書いてある数字は
 *  画面・診断書PDFと同じ。社内向けの記述は入れない。 */
export function forwardMailText(
  s: DiagnosisSnapshot,
  company: { name: string; address: string; tel: string; hours: string; site?: string }
): string {
  return [
    ...(s.contact.company ? [s.contact.company] : []),
    `${s.contact.name} 様`,
    "",
    `${company.name}の${FORWARD_STAFF_PLACEHOLDER}です。`,
    "このたびは空調更新のWeb診断をご利用いただき、ありがとうございます。",
    "ご入力いただいた内容で作成した診断書（PDF）を添付してお送りします。",
    "",
    ...customerCoreLines(s),
    "",
    "■ この後の進め方",
    "　1. 現地確認の日程をご相談させてください。系統数・冷媒の種類・搬入経路などを拝見し、仮置きの前提を置き換えます。",
    "　2. 現地確認のあと、正式なお見積りと、補助金を使う場合の進め方（申請の時期・必要な書類）をご案内します。",
    "",
    `ご不明な点は、このメールへのご返信か、お電話（${company.tel}／${company.hours}）でお知らせください。`,
    "",
    company.name,
    FORWARD_STAFF_PLACEHOLDER,
    company.address,
    `TEL ${company.tel}（${company.hours}）`,
    ...(company.site ? [company.site] : []),
  ].join("\n");
}

/* 対象製品の確認（台帳 #65）は、サーバが保存先から引き直した結果を
   **呼び出し側から行の配列として受け取る**。ここで保存先を読みに行かない。
   このファイルは画面（クライアント）からも import されるので、
   サーバ専用の import（保存先・ファイル入出力）を持ち込めない。
   省略したときは節そのものを出さない。空の節を出すと
   「確認した結果、何も無い」と読めてしまう。 */
export function staffMailText(s: DiagnosisSnapshot, targetProductLines?: string[]): string {
  const lines: string[] = [
    "Web診断（5段フロー）から新規の相談が入りました。",
    "",
    `受付番号: ${s.receiptNo}`,
    `受付日時: ${s.issuedAtJst}`,
    "",
    "■ 連絡先",
    `　お名前: ${s.contact.name}`,
    `　メール: ${s.contact.email}`,
    `　会社名: ${s.contact.company || "（未入力）"}`,
    `　電話: ${s.contact.phone || "（未入力）"}`,
    "",
    "■ 入力された設備",
    ...equipLines(s),
    "",
    "■ 概算（画面・PDF・お客様宛メールと同じ値）",
    ...estimateLines(s),
  ];
  if (s.workDays != null) {
    lines.push("", `■ 実働日数の目安　約${s.workDays}日（室内機${s.pricedUnits}台）`);
  }
  lines.push(
    "",
    "■ ご予算・時期",
    `　ご予算: ${s.customerBudgetYen != null ? yenJP(s.customerBudgetYen) : "未回答"}`,
    `　希望時期: ${s.desiredTiming != null ? TIMING_LABEL_JA[s.desiredTiming] : "未回答"}`
  );
  if (s.energyBill) {
    lines.push("", "■ 電気料金の明細（お客様の任意入力）", `　${energyBillLine(s.energyBill)}`);
  }
  if (s.subsidyCheck && (s.subsidyCheck.programs.length || s.subsidyCheck.answers.length)) {
    lines.push(
      "",
      "■ 補助金の候補と適合チェック（お客様の画面に表示した内容。サーバでは判定し直していません）",
      ...subsidyCheckLines(s.subsidyCheck)
    );
  } else {
    lines.push("", "■ 補助金の候補と適合チェック", "　（この送信には含まれていません）");
  }
  if (targetProductLines && targetProductLines.length) {
    lines.push("", ...targetProductLines);
  }
  lines.push(
    "",
    "■ 現地確認で埋める項目",
    "　・系統数（いまは室内機2台=1系統の仮置き）",
    "　・冷媒の種類と充填量（いまは不明のまま計算）",
    "　・設置階・搬入経路（足場と高所作業車の要否）",
    "　・未算定の設備（上の一覧で「未算定」と付いたもの）"
  );
  return lines.join("\n");
}

/** JSTの受付日時。サーバとクライアントで別々に now を取ると数秒ずれるので、
    スナップショットを作る側で1回だけ取り、以後はその文字列を使い回す。 */
export function nowJstText(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}
