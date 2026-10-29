/* ───────────────────────────────────────────────────────────
   v2 / 2026-10-29 / EHC-0102 制度カードからの相談（3項目のフォーム）の受け口の決め事
   直し2回目：相談したい制度を複数（programIds）・任意の印（急ぎ／施設が複数／連絡はメールを希望）・ご相談の内容（600字まで）を受ける。
   　　　　　 programId（1つ）だけを送る古い画面からの送信も、そのまま受ける。

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
import { ATTACH_MAX_FILES, ATTACH_MAX_TOTAL_BYTES, fmtBytes } from "./attachLimits";
import { readReferralClaim, referralLines, referralTag, type ResolvedReferral } from "./referral";
import { PROGRAMS, type ProgramId } from "./programs";
import { CHECK_PREFS, checkAnswerLines, labelOfOpt, matchLines, matchPrograms, readCheckAnswers, type CheckAnswers } from "./programMatch";
import { CONSULT_NOTE_MAX, consultFlagLabels, readConsultFlags, type ConsultFlagId } from "./consultOptions";

export const PROGRAM_LEAD_SOURCES = ["top", "shindan", "tokyo", "kaigo", "team"] as const;
export type ProgramLeadSource = (typeof PROGRAM_LEAD_SOURCES)[number];

const SOURCE_JA: Record<ProgramLeadSource, string> = {
  top: "トップ（/）",
  shindan: "使える補助金を調べる（/shindan）",
  tokyo: "東京都の制度（/tokyo）",
  kaigo: "介護施設の制度（/kaigo）",
  team: "メンバーと実績（/team）",
};

export interface ProgramLeadInput {
  company: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: ProgramLeadSource;
  /** 相談したい制度の1つ目（Notion の希望制度に使う） */
  programId: ProgramId | null;
  /** 相談したい制度（いくつでも） */
  programIds: ProgramId[];
  /** 任意の印 */
  flags: ConsultFlagId[];
  /** ご相談の内容（任意） */
  note: string | null;
  answers: CheckAnswers | null;
  referral: ResolvedReferral | null;
  /** 添付（写真・PDF）。担当者宛のメールに付ける */
  attachments: LeadAttachment[];
}

export interface LeadAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  kind: "photo" | "pdf";
}

/** 中身の先頭のバイトで種類を確かめる（拡張子や画面から来た type は信じない） */
export function sniffAttachment(buf: Buffer): { contentType: string; ext: string; kind: "photo" | "pdf" } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg", kind: "photo" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: "image/png", ext: "png", kind: "photo" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { contentType: "image/webp", ext: "webp", kind: "photo" };
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { contentType: "application/pdf", ext: "pdf", kind: "pdf" };
  const brand = buf.subarray(4, 12).toString("latin1");
  if (/^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand)) return { contentType: "image/heic", ext: "heic", kind: "photo" };
  return null;
}

/** 送られてきた添付を確かめる。数・大きさ・種類のどれかが合わなければ、画面に出せる文で返す */
export function readAttachments(raw: unknown): { ok: true; files: LeadAttachment[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, files: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "添付の形が正しくありません。お手数ですが、写真はメールでお送りください。" };
  if (raw.length > ATTACH_MAX_FILES) return { ok: false, error: `添付は${ATTACH_MAX_FILES}つまでです。` };
  const files: LeadAttachment[] = [];
  let total = 0;
  for (const [i, item] of raw.entries()) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const data = typeof o.data === "string" ? o.data.replace(/^data:[^,]*,/, "") : "";
    if (!data || !/^[A-Za-z0-9+/=\s]+$/.test(data)) return { ok: false, error: "添付を読み取れませんでした。お手数ですが、写真はメールでお送りください。" };
    const buf = Buffer.from(data, "base64");
    total += buf.length;
    if (total > ATTACH_MAX_TOTAL_BYTES) return { ok: false, error: `添付の合計が大きすぎます（${fmtBytes(ATTACH_MAX_TOTAL_BYTES)}まで）。枚数を減らすか、メールでお送りください。` };
    const t = sniffAttachment(buf);
    if (!t) return { ok: false, error: "写真（JPEG・PNG・HEIC）か PDF だけ添付できます。" };
    const base = (typeof o.name === "string" ? o.name : "")
      .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "")
      .replace(/\.[A-Za-z0-9]{1,5}$/, "")
      .replace(/^[.\s]+/, "")
      .trim()
      .slice(0, 60);
    files.push({ filename: `${String(i + 1).padStart(2, "0")}_${base || (t.kind === "pdf" ? "資料" : "写真")}.${t.ext}`, contentType: t.contentType, content: buf, kind: t.kind });
  }
  return { ok: true, files };
}

export function attachmentLine(files: LeadAttachment[], mailed: boolean | null): string {
  if (!files.length) return "添付: なし";
  const photos = files.filter((f) => f.kind === "photo").length;
  const pdfs = files.length - photos;
  const where = mailed === false ? "担当者宛メールの送信に失敗したため、届いていません。お客様に再送をお願いしてください" : "担当者宛メールに添付して送る";
  return `添付: ${files.length}件（写真${photos}・PDF${pdfs}、${where}）`;
}

export type ProgramLeadRead = { ok: true; input: ProgramLeadInput } | { ok: false; error: string };

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** ご相談の内容：制御文字を落とし、改行は2つまで、600字まで */
export function cleanNote(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return t ? t.slice(0, CONSULT_NOTE_MAX) : null;
}

const isProgramId = (v: unknown): v is ProgramId => typeof v === "string" && Object.prototype.hasOwnProperty.call(PROGRAMS, v);

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
  const att = readAttachments(body.attachments);
  if (!att.ok) return { ok: false, error: att.error };
  const source = (PROGRAM_LEAD_SOURCES as readonly string[]).includes(body.source as string) ? (body.source as ProgramLeadSource) : "top";
  const fromList = Array.isArray(body.programIds) ? Array.from(new Set(body.programIds.filter(isProgramId))).slice(0, 6) : [];
  const single = isProgramId(body.programId) ? body.programId : null;
  const programIds = fromList.length ? fromList : single ? [single] : [];
  return {
    ok: true,
    input: {
      company,
      name,
      phone: reach.phone,
      email: reach.email,
      source,
      programId: programIds[0] ?? null,
      programIds,
      flags: readConsultFlags(body.flags),
      note: cleanNote(body.note),
      answers: body.answers === undefined || body.answers === null ? null : readCheckAnswers(body.answers),
      referral: readReferralClaim(body.referral),
      attachments: att.files,
    },
  };
}

/** Notion の「希望制度」。SII は省エネ補助金、都・介護の交付金は自治体、分からなければ未定 */
export function wishOf(programId: ProgramId | null): LeadWish {
  if (!programId) return "未定";
  return programId === "sii" ? "省エネ補助金" : "自治体";
}

const idsOf = (input: Pick<ProgramLeadInput, "programId" | "programIds">): ProgramId[] =>
  input.programIds?.length ? input.programIds : input.programId ? [input.programId] : [];

function bodyLines(input: ProgramLeadInput, receiptNo: string, todayYmd: string): string[] {
  const ids = idsOf(input);
  const result = input.answers ? matchPrograms(input.answers, todayYmd) : null;
  const flags = consultFlagLabels(input.flags ?? []);
  return [
    `入口: ${SOURCE_JA[input.source]}`,
    ids.length
      ? `相談したい制度: ${ids.map((id) => `${PROGRAMS[id].tag} ${PROGRAMS[id].title}（${PROGRAMS[id].officialName}）`).join("／")}`
      : "相談したい制度: 指定なし",
    `印: ${flags.length ? flags.join("・") : "なし"}`,
    `ご相談の内容: ${input.note ? input.note : "（未入力）"}`,
    attachmentLine(input.attachments, null),
    ...referralLines(input.referral, receiptNo),
    ...(input.answers ? ["質問の答え:", ...checkAnswerLines(input.answers)] : ["質問の答え: なし（カードから直接の相談）"]),
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
    nextAction: `${input.flags?.includes("urgent") ? "【急ぎ】" : ""}${input.flags?.includes("mailOnly") || !input.phone ? "メールで" : "電話で"}折り返し、写真（室外機の銘板・電気料金の明細）をお願いして概算。現地調査の日程を調整${tag ? `（${tag}）` : ""}`,
  };
}

export function programStaffMail(
  input: ProgramLeadInput,
  receiptNo: string,
  todayYmd: string,
  opts: { notionSaved?: boolean } = {}
): { subject: string; text: string } {
  const ids = idsOf(input);
  const p = ids.length ? PROGRAMS[ids[0]] : null;
  const tag = referralTag(input.referral);
  const urgent = input.flags?.includes("urgent");
  const mailOnly = input.flags?.includes("mailOnly");
  return {
    subject: `${urgent ? "【急ぎ】" : ""}【補助金サイトの相談 ${receiptNo}】${input.company}${p ? `（${p.tag}${ids.length > 1 ? ` ほか${ids.length - 1}件` : ""}）` : ""}${tag ? `［${tag}］` : ""}`,
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
      ...(mailOnly ? ["ご希望の連絡方法: メール（お電話は控えてください）"] : []),
      "",
      "■ 内容",
      ...bodyLines(input, receiptNo, todayYmd),
      "",
      "■ 次にやること",
      `1. ${urgent ? "急ぎの印あり。できるだけ早く" : `${COMPANY.hours}に`}${mailOnly ? "メールで" : ""}折り返す（連絡の目安${COMPANY.replyDays}営業日以内）。写真（室外機の銘板・電気料金の明細）をお願いすると概算が早い。`,
      "2. 制度の締切と、交付決定の前に契約しないことを先に伝える。",
      "3. 申請書類の作成は行政書士の業務です（EHC では作らない）。業者は補助のルールに沿って施設が公平に決めます。",
    ].join("\n"),
  };
}
