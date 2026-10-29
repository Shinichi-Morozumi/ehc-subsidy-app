/* ───────────────────────────────────────────────────────────
   介護施設向け 補助金の事前確認（2026-10-01 EHC-0056）

   ■ なぜ
   　　介護施設向けの紙のパンフ（A4・二つ折り）の QR から来た方の入口が /kaigo。
   　　7つの質問に答えると「使えそうな補助」と「次にやること」が分かり、そのまま相談を送れる。
   　　誰の紹介で来たかを数えるため、QR の URL に紹介コード（?ref=）を付けて配る。

   ■ 制度の数字（2026-10-01 に一次資料で確認。パンフの台帳 xlsx「4_制度の早見表」「5_出典」と同じ）
   　国：地域介護・福祉空間整備等施設整備交付金（防災改修等支援事業／大規模修繕等。実施要綱 別表・令和8年4月8日改正）
   　　・定員29人以下の 特養・老健・介護医療院・ケアハウス … 1施設 16,600千円・10/10
   　　・定員29人以下の 養護・都市型軽費・グループホーム・小規模多機能・看護小規模多機能・認知症デイ など … 8,330千円・10/10
   　　・定員30人以上（耐震化・非常用発電などの防災対策と一体の大規模修繕）… 基準額 31,600千円・国1/3＋都道府県等1/3
   　　・対象経費が80万円未満は対象外。令和9年度分から中長期的な修繕計画の提出が必要。
   　東京都：特別養護老人ホーム等改修費補助（大規模改修）… 3/4・最大184,192千円（都内の特養・養護・建物所有者が民間法人）
   　　第2回の協議書の締切 2027-01-08（内示は2027年6月下旬の予定）。
   　どれも「対象になり得る」までしか言わない。採択と金額は審査と自治体の要綱で決まる（景品表示法：断定しない）。

   ■ 申請書類について（改正行政書士法 2026-01 施行）
   　　報酬を得て官公署に出す書類を作れるのは行政書士だけ（名目を問わない）。EHC は書類を作らない。
   　　画面の文言は「申請の準備（必要書類のご案内・見積書や図面などの資料づくり）」まで。書類の作成は行政書士（EHC が手配）。

   ■ 通知メール（2026-10-01 ご指示「info@ehcjpn.com へ通知もいくように」）
   　　宛先には必ず info@ehcjpn.com を入れる（診断の担当者宛の宛先を変えても外れない）。
   　　社内だけに送る通知なので、DIAGNOSIS_MAIL_MODE が未設定でも送る（staff / send はもちろん送る）。
   　　dry_run などで明示的に止めているときと、送信アカウントが無いときだけ送らない。
   　　確認用ページ（Vercel のプレビュー）からの送信は info@ehcjpn.com だけに送り、件名の頭に【確認用ページから】を付ける（CC は付けない）。

   ■ 紹介コード
   　　URL の ?ref= の値。英数字・ハイフン・下線の20字まで、小文字にそろえる。それ以外は捨てる（紹介なし扱い）。
   　　Notion の行では「メモ」の先頭と「次アクション」に残す（DB の項目は増やさない＝項目名の不一致で全件失敗するのを避ける）。
   ─────────────────────────────────────────────────────────── */

import type { LeadPayload } from "./notionLead";
import type { MailConfig } from "./mailConfig";
import { referralLines, resolveRefOnly, sanitizeRef as sanitizeReferralRef, readReferralClaim, type ResolvedReferral } from "./referral";

/* ───────── 選択肢 ───────── */

export type FacilityGroup = "A" | "B" | "yougo" | "unknown";

export const FACILITIES = [
  { id: "tokuyou", label: "特別養護老人ホーム", group: "A" },
  { id: "rouken", label: "介護老人保健施設", group: "A" },
  { id: "iryouin", label: "介護医療院", group: "A" },
  { id: "carehouse", label: "ケアハウス（軽費老人ホーム）", group: "A" },
  { id: "yougo", label: "養護老人ホーム", group: "yougo" },
  { id: "toshigata", label: "都市型軽費老人ホーム", group: "B" },
  { id: "gh", label: "グループホーム", group: "B" },
  { id: "shotaki", label: "小規模多機能・看護小規模多機能", group: "B" },
  { id: "ninchiday", label: "認知症デイサービス", group: "B" },
  { id: "other", label: "その他・わからない", group: "unknown" },
] as const satisfies readonly { id: string; label: string; group: FacilityGroup }[];

export const CAPACITIES = [
  { id: "le29", label: "29人以下" },
  { id: "ge30", label: "30人以上" },
  { id: "unknown", label: "わからない" },
] as const;

export const PREFS = [
  { id: "tokyo", label: "東京都" },
  { id: "kanagawa", label: "神奈川県" },
  { id: "saitama", label: "埼玉県" },
  { id: "chiba", label: "千葉県" },
  { id: "other", label: "その他" },
] as const;

export const BUILDING_AGES = [
  { id: "lt10", label: "10年未満" },
  { id: "10to20", label: "10〜20年" },
  { id: "ge20", label: "20年以上" },
  { id: "unknown", label: "わからない" },
] as const;

export const AC_TYPES = [
  { id: "package", label: "業務用エアコン（天井・壁）" },
  { id: "room", label: "ルームエアコン（家庭用）" },
  { id: "central", label: "セントラル空調" },
  { id: "unknown", label: "わからない" },
] as const;

export const AC_AGES = [
  { id: "lt10", label: "10年未満" },
  { id: "10to15", label: "10〜15年" },
  { id: "ge15", label: "15年以上" },
  { id: "unknown", label: "わからない" },
] as const;

export const TROUBLES = [
  { id: "weak", label: "効きが悪い" },
  { id: "breakdown", label: "故障・修理が多い" },
  { id: "bill", label: "電気代が高い" },
  { id: "heat", label: "熱中症が心配" },
  { id: "refrigerant", label: "古い冷媒で修理が難しい" },
] as const;

export const WANTS = [
  { id: "light", label: "照明" },
  { id: "electric", label: "電気設備（分電盤など）" },
  { id: "water", label: "給排水・給湯" },
  { id: "gas", label: "ガス設備" },
  { id: "fire", label: "消防用設備" },
  { id: "roof", label: "防水・外壁・浴室" },
  { id: "barrierfree", label: "バリアフリー・避難経路" },
] as const;

export const SCOPES = [
  { id: "ac", label: "この施設の空調" },
  { id: "building", label: "この施設の設備全体" },
  { id: "multi", label: "法人のほかの施設もまとめて" },
] as const;

export const CALL_TIMES = [
  { id: "any", label: "いつでも" },
  { id: "am", label: "午前" },
  { id: "pm", label: "午後" },
] as const;

type Opt = { readonly id: string; readonly label: string };
type IdOf<T extends readonly Opt[]> = T[number]["id"];

export type FacilityId = IdOf<typeof FACILITIES>;
export type CapacityId = IdOf<typeof CAPACITIES>;
export type PrefId = IdOf<typeof PREFS>;
export type BuildingAgeId = IdOf<typeof BUILDING_AGES>;
export type AcTypeId = IdOf<typeof AC_TYPES>;
export type AcAgeId = IdOf<typeof AC_AGES>;
export type TroubleId = IdOf<typeof TROUBLES>;
export type WantId = IdOf<typeof WANTS>;
export type ScopeId = IdOf<typeof SCOPES>;
export type CallTimeId = IdOf<typeof CALL_TIMES>;

export interface KaigoAnswers {
  facility: FacilityId;
  capacity: CapacityId;
  pref: PrefId;
  city: string | null;
  buildingAge: BuildingAgeId;
  acType: AcTypeId;
  acAge: AcAgeId;
  troubles: TroubleId[];
  wants: WantId[];
}

import { consultationLines, readConsultation, type ConsultationRequest } from "./consultation";

export interface KaigoContact {
  company: string;
  name: string;
  phone: string | null;
  email: string | null;
  scope: ScopeId | null;
  callTime: CallTimeId | null;
  consultation?: ConsultationRequest;
}

export interface KaigoSubmitInput {
  answers: KaigoAnswers;
  contact: KaigoContact;
  ref: string | null;
  referral?: ResolvedReferral | null;
}

export function labelOf<T extends readonly Opt[]>(list: T, id: string | null | undefined): string {
  return list.find((o) => o.id === id)?.label ?? "";
}

/* ───────── 紹介コード ───────── */

/** URL の ?ref= の値を整える。使えない値は null（紹介なし）。
 *  2026-10-14 PJ-20261013-EHC-0070: 決め方はトップの紹介リンクと共通（lib/referral.ts）。中身は変えていない。 */
export function sanitizeRef(raw: unknown): string | null {
  return sanitizeReferralRef(raw);
}

/** 紹介の表（lib/referral.ts）で確かめた行。表にあれば紹介元・資料・専用URLまで出す（社内向け） */
const partnerLines = (ref: string | null, receiptNo?: string) => (ref ? referralLines(resolveRefOnly(ref), receiptNo) : []);

/* ───────── 目安の判定 ───────── */

export type ProgramLevel = "main" | "maybe" | "alt";

export interface KaigoProgram {
  key: string;
  level: ProgramLevel;
  name: string;
  rate: string;
  cap: string;
  note: string;
}

export interface KaigoEstimate {
  /** 画面の一番上に出す1文（断定しない） */
  headline: string;
  programs: KaigoProgram[];
  cautions: string[];
}

const NATIONAL_NAME = "国の交付金（防災改修等支援事業・大規模修繕等）";
const P_A: KaigoProgram = {
  key: "kokuA", level: "main", name: NATIONAL_NAME, rate: "10/10", cap: "1施設 最大1,660万円",
  note: "定員29人以下の特養・老健・介護医療院・ケアハウス。市区町村を通じた補助です。",
};
const P_B: KaigoProgram = {
  key: "kokuB", level: "main", name: NATIONAL_NAME, rate: "10/10", cap: "1施設 最大833万円",
  note: "グループホーム・小規模多機能・定員29人以下の養護など。市区町村を通じた補助です。",
};
const P_30: KaigoProgram = {
  key: "koku30", level: "main", name: "国の交付金（防災対策と一体の大規模修繕）", rate: "2/3（国1/3＋都道府県等1/3）", cap: "基準額 3,160万円",
  note: "定員30人以上。耐震化・非常用発電などの防災対策と一体で行う改修が対象です。",
};
const P_TOKYO: KaigoProgram = {
  key: "tokyo", level: "maybe", name: "東京都 特別養護老人ホーム等改修費補助（大規模改修）", rate: "3/4", cap: "最大1億8,419万円",
  note: "都内の特養・養護（建物所有者が民間法人など条件あり）。第2回の締切は2027年1月8日です。",
};
const P_SII: KaigoProgram = {
  key: "sii", level: "alt", name: "省エネ補助金（国）", rate: "1/3など", cap: "制度・区分による",
  note: "省エネ性能の高い空調への更新が対象になり得ます。",
};
const P_ZEROEMI: KaigoProgram = {
  key: "zeroemi", level: "alt", name: "東京都の省エネ設備の助成（クール・ネット東京）", rate: "最大3/4", cap: "区分により最大4,500万円",
  note: "都内の中小企業等（社会福祉法人を含む）。受付は年に数回です。",
};

export function facilityGroup(id: FacilityId): FacilityGroup {
  return FACILITIES.find((f) => f.id === id)?.group ?? "unknown";
}

export function kaigoEstimate(a: KaigoAnswers): KaigoEstimate {
  const g = facilityGroup(a.facility);
  const programs: KaigoProgram[] = [];
  const maybe = (p: KaigoProgram): KaigoProgram => ({ ...p, level: "maybe" });

  if (g === "B") {
    programs.push(P_B);
  } else if (g === "A") {
    if (a.capacity === "le29") programs.push(P_A);
    else if (a.capacity === "ge30") programs.push(P_30);
    else programs.push(maybe(P_A), maybe(P_30));
  } else if (g === "yougo") {
    if (a.capacity === "le29") programs.push(P_B);
    else if (a.capacity === "ge30") programs.push(P_30);
    else programs.push(maybe(P_B), maybe(P_30));
  } else {
    programs.push(maybe(P_A), maybe(P_B));
  }

  if (a.pref === "tokyo" && (a.facility === "tokuyou" || a.facility === "yougo")) programs.push(P_TOKYO);

  const hasTenTen = programs.some((p) => p.rate === "10/10");
  if (!hasTenTen || a.capacity === "ge30") {
    programs.push(P_SII);
    if (a.pref === "tokyo") programs.push(P_ZEROEMI);
  }

  const cautions: string[] = [];
  if (a.acType === "room") {
    cautions.push("ルームエアコンを買うだけ（備品の購入）は対象外です。業務用への入れ替えなど、建物に付いた設備の工事なら対象になり得ます。");
  }
  if (a.acAge === "lt10") {
    cautions.push("入れ替えは、おおむね10年以上たった設備が目安です（熱中症対策の空調の新設は別に考えます）。");
  }
  if (a.pref === "tokyo" && programs.some((p) => p.key === "tokyo") && a.buildingAge === "lt10") {
    cautions.push("東京都の改修費補助には、開設や前回の改修から10年の決まりがあります。");
  }
  cautions.push("採択と金額は、審査と自治体の要綱で決まります。内示（交付決定）より前に契約・着工すると対象外です。");

  const top = programs[0];
  let headline: string;
  if (top.rate === "10/10" && top.level === "main") {
    headline = `国の補助 10/10（${top.cap}）の対象になり得ます。`;
  } else if (hasTenTen) {
    headline = "定員や施設の種類によって、国の補助 10/10 の対象になり得ます。";
  } else {
    headline = `国の補助（${top.rate}・${top.cap}）の対象になり得ます。`;
  }
  return { headline, programs, cautions };
}

/* ───────── 送信の確かめ（サーバ） ───────── */

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const PHONE_RE = /^[0-9０-９+＋()（）\-－ー‐\s]{10,20}$/;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f<>]/g, "").trim();
  return t ? t.slice(0, max) : null;
};
const pick = <T extends readonly Opt[]>(list: T, v: unknown): IdOf<T> | null =>
  typeof v === "string" && list.some((o) => o.id === v) ? (v as IdOf<T>) : null;
const pickMany = <T extends readonly Opt[]>(list: T, v: unknown, max: number): IdOf<T>[] =>
  Array.isArray(v) ? Array.from(new Set(v.map((x) => pick(list, x)).filter((x): x is IdOf<T> => !!x))).slice(0, max) : [];

export type KaigoReadResult = { ok: true; input: KaigoSubmitInput } | { ok: false; error: string };

/** 画面から来た値を確かめる。足りない・おかしいときは、画面に出せる文で返す。 */
export function readKaigoSubmit(body: Record<string, unknown>): KaigoReadResult {
  const a = (body.answers && typeof body.answers === "object" ? body.answers : {}) as Record<string, unknown>;
  const c = (body.contact && typeof body.contact === "object" ? body.contact : {}) as Record<string, unknown>;
  const facility = pick(FACILITIES, a.facility);
  const capacity = pick(CAPACITIES, a.capacity);
  const pref = pick(PREFS, a.pref);
  const buildingAge = pick(BUILDING_AGES, a.buildingAge);
  const acType = pick(AC_TYPES, a.acType);
  const acAge = pick(AC_AGES, a.acAge);
  if (!facility || !capacity || !pref || !buildingAge || !acType || !acAge) {
    return { ok: false, error: "質問の答えが足りません。お手数ですが、最初からもう一度お試しください。" };
  }
  if (body.consent !== true) return { ok: false, error: "内容をご確認のうえ、同意の欄にチェックを入れてください。" };
  const company = clean(c.company, 80);
  const name = clean(c.name, 40);
  const email = clean(c.email, 120);
  const phone = clean(c.phone, 20);
  if (!company) return { ok: false, error: "法人名・施設名をご入力ください。" };
  if (!name) return { ok: false, error: "お名前をご入力ください。" };
  if (!phone && !email) return { ok: false, error: "お電話番号かメールアドレスの、どちらかをご入力ください。" };
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "メールアドレスの形式をご確認ください（例：name@example.co.jp）。" };
  if (phone && !PHONE_RE.test(phone)) return { ok: false, error: "お電話番号をご確認ください（例：03-1234-5678）。" };
  const consultation = readConsultation(c.consultation);
  if (consultation.error) return { ok: false, error: consultation.error };
  return {
    ok: true,
    input: {
      answers: {
        facility, capacity, pref, buildingAge, acType, acAge,
        city: clean(a.city, 30),
        troubles: pickMany(TROUBLES, a.troubles, TROUBLES.length),
        wants: pickMany(WANTS, a.wants, WANTS.length),
      },
      contact: { company, name, phone, email, scope: pick(SCOPES, c.scope), callTime: pick(CALL_TIMES, c.callTime), ...(consultation.value ? { consultation: consultation.value } : {}) },
      ref: body.referral !== undefined ? readReferralClaim(body.referral)?.ref ?? null : sanitizeRef(body.ref),
      ...(body.referral !== undefined ? { referral: readReferralClaim(body.referral) } : {}),
    },
  };
}

/* ───────── 通知メールの宛先と送るかどうか ───────── */

export const KAIGO_NOTIFY_TO = "info@ehcjpn.com";

export interface KaigoMailPlan {
  send: boolean;
  to: string[];
  cc: string[];
  subjectPrefix: string;
  /** 送らないときの理由（ログ用） */
  reason: string;
}

export function kaigoMailPlan(cfg: MailConfig, env: NodeJS.ProcessEnv = process.env): KaigoMailPlan {
  const mode = (env.DIAGNOSIS_MAIL_MODE || "").trim().toLowerCase();
  const stopped = mode !== "" && mode !== "staff" && mode !== "send";
  const prod = env.VERCEL_ENV === "production";
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const to: string[] = [];
  for (const a of [KAIGO_NOTIFY_TO, ...cfg.staffTo]) if (a && !to.some((x) => same(x, a))) to.push(a.trim());
  const cc = prod ? cfg.staffCc.filter((c) => c && !to.some((x) => same(x, c))) : [];
  if (!cfg.user || !cfg.pass) return { send: false, to, cc, subjectPrefix: "", reason: "送信アカウント（SMTP_USER / SMTP_PASS）が無い" };
  if (stopped) return { send: false, to, cc, subjectPrefix: "", reason: `DIAGNOSIS_MAIL_MODE=${mode} で止めている` };
  return { send: true, to, cc, subjectPrefix: prod ? "" : "【確認用ページから】", reason: "" };
}

/* ───────── Notion の行・担当者宛メール ───────── */

export function answerLines(a: KaigoAnswers): string[] {
  const troubles = a.troubles.map((t) => labelOf(TROUBLES, t)).join("、");
  const wants = a.wants.map((w) => labelOf(WANTS, w)).join("、");
  return [
    `施設: ${labelOf(FACILITIES, a.facility)}／定員: ${labelOf(CAPACITIES, a.capacity)}`,
    `所在地: ${labelOf(PREFS, a.pref)}${a.city ? ` ${a.city}` : ""}`,
    `建物の年数（開設・前回の大規模修繕から）: ${labelOf(BUILDING_AGES, a.buildingAge)}`,
    `空調: ${labelOf(AC_TYPES, a.acType)}・${labelOf(AC_AGES, a.acAge)}${troubles ? `／困りごと: ${troubles}` : ""}`,
    `ほかに直したい所: ${wants || "特になし"}`,
  ];
}

export function estimateLines(e: KaigoEstimate): string[] {
  return e.programs.map((p) => `・${p.name}：${p.rate}・${p.cap}${p.level === "main" ? "" : p.level === "maybe" ? "（条件しだい）" : "（ほかの選択肢）"}`);
}

const refLabel = (ref: string | null) => (ref ? ref.toUpperCase() : "なし");

export function kaigoLead(input: KaigoSubmitInput, receiptNo: string, todayYmd: string): LeadPayload {
  const { answers: a, contact: c } = input;
  const est = kaigoEstimate(a);
  return {
    company: c.company,
    contact: c.name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    address: `${labelOf(PREFS, a.pref)}${a.city ? ` ${a.city}` : ""}`,
    status: "未着手",
    wishSubsidy: "自治体",
    proposalNo: receiptNo,
    sentDate: todayYmd,
    memo: [
      `【介護施設パンフ（QR）の事前確認】紹介コード: ${refLabel(input.ref)}`,
      ...consultationLines(c.consultation),
      ...(input.referral !== undefined ? referralLines(input.referral, receiptNo) : partnerLines(input.ref, receiptNo)),
      `ご担当: ${c.name}${c.callTime ? `／連絡の希望: ${labelOf(CALL_TIMES, c.callTime)}` : ""}${c.scope ? `／相談の範囲: ${labelOf(SCOPES, c.scope)}` : ""}`,
      ...answerLines(a),
      "画面に出した目安:",
      ...estimateLines(est),
    ].join("\n"),
    nextAction: `候補日時3件を確認しZoomの日時・URLを折り返し案内。現地調査の日程調整（紹介コード ${refLabel(input.ref)}）`,
  };
}

export function kaigoStaffMail(
  input: KaigoSubmitInput,
  receiptNo: string,
  opts: { notionSaved?: boolean } = {}
): { subject: string; text: string } {
  const { answers: a, contact: c } = input;
  const est = kaigoEstimate(a);
  return {
    subject: `【介護施設の事前確認 ${receiptNo}】${c.company}（紹介コード ${refLabel(input.ref)}）`,
    text: [
      "介護施設向けパンフの QR（ehcjpn.com/kaigo）から、事前確認の相談がありました。",
      opts.notionSaved === false
        ? "※ Notion への追加に失敗しました。このメールの内容で「EHC見込み顧客アタックリスト」に手で1行追加してください（提案No ＝ 受付番号）。"
        : "Notion「EHC見込み顧客アタックリスト」に、ステータス「未着手」で1行追加しています（提案No ＝ 受付番号）。",
      "",
      `受付番号: ${receiptNo}`,
      `紹介コード: ${refLabel(input.ref)}`,
      ...(input.referral !== undefined ? referralLines(input.referral, receiptNo) : partnerLines(input.ref, receiptNo)),
      "",
      "■ ご連絡先",
      `法人名・施設名: ${c.company}`,
      `お名前: ${c.name}`,
      `電話: ${c.phone || "（未入力）"}`,
      `メール: ${c.email || "（未入力）"}`,
      ...consultationLines(c.consultation),
      `連絡の希望: ${c.callTime ? labelOf(CALL_TIMES, c.callTime) : "（指定なし）"}`,
      `相談の範囲: ${c.scope ? labelOf(SCOPES, c.scope) : "（指定なし）"}`,
      "",
      "■ 7つの質問の答え",
      ...answerLines(a),
      "",
      "■ 画面に出した目安（断定はしていない）",
      ...estimateLines(est),
      "",
      "■ 次にやること",
      "候補日時3件を確認し、Zoomの日時とURLを折り返し案内してください（予約未確定）。所在地の市区町村の募集時期と現地調査の日程も相談してください。",
      "空調のほか、照明・電気・給排水・ガス・消防用設備・防水・バリアフリーの工事も EHC で対応します（2026-10-01 確認）。",
      "申請書類の作成は行政書士の業務です（EHC では作らない）。業者は補助のルールに沿って施設が公平に決めます。",
    ].join("\n"),
  };
}
