/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 制度カードからの相談（3項目のフォーム）の受け口の決め事

   ・入力は3項目だけ：法人名・施設名／お名前／ご連絡先（電話かメールのどちらか1つ）。同意のチェックは必須。
   ・6問の答え（あれば）と、画面に出したカードの判定を、そのまま担当者宛メールと Notion のメモに運ぶ。
   ・Notion「EHC見込み顧客アタックリスト」に「未着手」で1行（提案No＝受付番号）。介護の事前確認（/kaigo）と同じ。
   ・通知メールの宛先と送るかどうかは、介護の事前確認と同じ決め方（lib/kaigo.ts の kaigoMailPlan）。
   ・紹介リンク（?ref=）は送った時点のものを受付番号に固定する（lib/referral.ts）。お客様の画面には出さない。
   ・お客様宛の自動メールは送らない（画面に受付番号と電話・写真の送り先を出す）。
   ─────────────────────────────────────────────────────────── */

import type { LeadPayload, LeadWish } from "./notionLead";
import { EMAIL_RE, PHONE_RE } from "./kaigo";
import { COMPANY } from "./company";
import { readReferralClaim, referralLines, referralTag, type ResolvedReferral } from "./referral";
import { PROGRAMS, type ProgramId } from "./programs";
import { CHECK_PREFS, checkAnswerLines, labelOfOpt, matchLines, matchPrograms, readCheckAnswers, type CheckAnswers } from "./programMatch";

export const PROGRAM_LEAD_SOURCES = ["top", "shindan", "tokyo", "kaigo"] as const;
export type ProgramLeadSource = (typeof PROGRAM_LEAD_SOURCES)[number];

const SOURCE_JA: Record<ProgramLeadSource, string> = {
  top: "トップ（/）",
  shindan: "6問の診断（/shindan）",
  tokyo: "東京都の制度（/tokyo）",
  kaigo: "介護施設の制度（/kaigo）",
};

export interface ProgramLeadInput {
  company: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: ProgramLeadSource;
  /** どのカードの「この制度で相談する」から来たか */
  programId: ProgramId | null;
  answers: CheckAnswers | null;
  referral: ResolvedReferral | null;
}

export type ProgramLeadRead = { ok: true; input: ProgramLeadInput } | { ok: false; error: string };

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** 「ご連絡先」の1欄を、メールか電話に振り分ける */
export function splitReach(raw: string | null): { phone: string | null; email: string | null; error: string | null } {
  if (!raw) return { phone: null, email: null, error: "お電話番号かメールアドレスをご入力ください。" };
  if (raw.includes("@")) {
    return EMAIL_RE.test(raw) ? { phone: null, email: raw, error: null } : { phone: null, email: null, error: "メールアドレスの形式をご確認ください（例：name@example.co.jp）。" };
  }
  return PHONE_RE.test(raw) ? { phone: raw, email: null, error: null } : { phone: null, email: null, error: "お電話番号をご確認ください（例：03-1234-5678）。" };
}

export function readProgramSubmit(body: Record<string, unknown>): ProgramLeadRead {
  if (body.consent !== true) return { ok: false, error: "内容をご確認のうえ、同意の欄にチェックを入れてください。" };
  const company = clean(body.company, 80);
  const name = clean(body.name, 40);
  if (!company) return { ok: false, error: "法人名・施設名をご入力ください。" };
  if (!name) return { ok: false, error: "お名前をご入力ください。" };
  const reach = splitReach(clean(body.reach, 120));
  if (reach.error) return { ok: false, error: reach.error };
  const source = (PROGRAM_LEAD_SOURCES as readonly string[]).includes(body.source as string) ? (body.source as ProgramLeadSource) : "top";
  const programId = typeof body.programId === "string" && Object.prototype.hasOwnProperty.call(PROGRAMS, body.programId) ? (body.programId as ProgramId) : null;
  return {
    ok: true,
    input: {
      company,
      name,
      phone: reach.phone,
      email: reach.email,
      source,
      programId,
      answers: body.answers === undefined || body.answers === null ? null : readCheckAnswers(body.answers),
      referral: readReferralClaim(body.referral),
    },
  };
}

/** Notion の「希望制度」。SII は省エネ補助金、都・介護の交付金は自治体、分からなければ未定 */
export function wishOf(programId: ProgramId | null): LeadWish {
  if (!programId) return "未定";
  return programId === "sii" ? "省エネ補助金" : "自治体";
}

function bodyLines(input: ProgramLeadInput, receiptNo: string, todayYmd: string): string[] {
  const p = input.programId ? PROGRAMS[input.programId] : null;
  const result = input.answers ? matchPrograms(input.answers, todayYmd) : null;
  return [
    `入口: ${SOURCE_JA[input.source]}`,
    `相談したい制度: ${p ? `${p.tag} ${p.title}（${p.officialName}）` : "指定なし"}`,
    ...referralLines(input.referral, receiptNo),
    ...(input.answers ? ["6問の答え:", ...checkAnswerLines(input.answers)] : ["6問の答え: なし（カードから直接の相談）"]),
    ...(result ? ["画面に出した判定（断定はしていない）:", ...matchLines(result)] : []),
  ];
}

export function programLead(input: ProgramLeadInput, receiptNo: string, todayYmd: string): LeadPayload {
  const tag = referralTag(input.referral);
  return {
    company: input.company,
    contact: input.name,
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
    address: input.answers ? labelOfOpt(CHECK_PREFS, input.answers.pref) : undefined,
    status: "未着手",
    wishSubsidy: wishOf(input.programId),
    proposalNo: receiptNo,
    sentDate: todayYmd,
    memo: [`【補助金サイトの相談（制度カード）】`, ...bodyLines(input, receiptNo, todayYmd)].join("\n"),
    nextAction: `電話かメールで折り返し、写真（室外機の銘板・電気料金の明細）をお願いして概算。現地調査の日程を調整${tag ? `（${tag}）` : ""}`,
  };
}

export function programStaffMail(
  input: ProgramLeadInput,
  receiptNo: string,
  todayYmd: string,
  opts: { notionSaved?: boolean } = {}
): { subject: string; text: string } {
  const p = input.programId ? PROGRAMS[input.programId] : null;
  const tag = referralTag(input.referral);
  return {
    subject: `【補助金サイトの相談 ${receiptNo}】${input.company}${p ? `（${p.tag}）` : ""}${tag ? `［${tag}］` : ""}`,
    text: [
      "補助金サイト（ehcjpn.com）の制度カードから、相談がありました。",
      opts.notionSaved === false
        ? "※ Notion への追加に失敗しました。このメールの内容で「EHC見込み顧客アタックリスト」に手で1行追加してください（提案No ＝ 受付番号）。"
        : "Notion「EHC見込み顧客アタックリスト」に、ステータス「未着手」で1行追加しています（提案No ＝ 受付番号）。",
      "",
      `受付番号: ${receiptNo}`,
      "",
      "■ ご連絡先",
      `法人名・施設名: ${input.company}`,
      `お名前: ${input.name}`,
      `電話: ${input.phone || "（未入力）"}`,
      `メール: ${input.email || "（未入力）"}`,
      "",
      "■ 内容",
      ...bodyLines(input, receiptNo, todayYmd),
      "",
      "■ 次にやること",
      `1. ${COMPANY.hours}に折り返す（連絡の目安${COMPANY.replyDays}営業日以内）。写真（室外機の銘板・電気料金の明細）をお願いすると概算が早い。`,
      "2. 制度の締切と、交付決定の前に契約しないことを先に伝える。",
      "3. 申請書類の作成は行政書士の業務です（EHC では作らない）。業者は補助のルールに沿って施設が公平に決めます。",
    ].join("\n"),
  };
}
