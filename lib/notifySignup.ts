/* ───────────────────────────────────────────────────────────
   次の公募のお知らせの登録（2026-09-26 改善6）

   ■ なぜ
   　　「今回の締切に間に合わない」「まだ時期が決まっていない」方の連絡先を残す入口が無く、
   　　結果を見て離れた方に、次の公募が始まったことを伝える手段が無かった（営業ロードマップの軸4）。

   ■ 決めたこと
   　　・結果の画面に「次の公募が始まったらお知らせします」を置き、メールアドレス（必須）と会社名（任意）だけ伺う。
   　　・登録は Notion「EHC見込み顧客アタックリスト」に、ステータス「お知らせ希望」で1行（提案No は EHC-N-…）。
   　　　未着手の通知（lib/leadReminder.ts）の対象にはしない（提案No が EHC-2 で始まらない）。
   　　・担当者にも知らせる（診断の担当者宛メールと同じ宛先。DIAGNOSIS_MAIL_MODE が staff / send のとき）。
   　　・お知らせの一斉送付は担当者が行う（Notion で「お知らせ希望」の行を絞り込む）。自動では送らない。
   　　・配信の停止を求められたら、その行を消す（プライバシーポリシーにも書いた）。
   ─────────────────────────────────────────────────────────── */

import type { LeadPayload } from "./notionLead";

export interface NotifySignupInput {
  email: string;
  company: string | null;
  programs: string[];
  pref: string | null;
  building: string | null;
  timing: string | null;
}

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f<>]/g, "").trim();
  return t ? t.slice(0, max) : null;
};

/** 画面から来た値を確かめる。メールが不正・同意が無いときは null */
export function readNotifySignup(body: Record<string, unknown>): NotifySignupInput | null {
  if (body.consent !== true) return null;
  const email = clean(body.email, 120);
  if (!email || !EMAIL_RE.test(email)) return null;
  const programs = Array.isArray(body.programs)
    ? body.programs.map((p) => clean(p, 60)).filter((p): p is string => !!p).slice(0, 6)
    : [];
  return {
    email,
    company: clean(body.company, 80),
    programs,
    pref: clean(body.pref, 10),
    building: clean(body.building, 20),
    timing: clean(body.timing, 20),
  };
}

/** Notion の行に使う受付番号（EHC-N-YYYYMMDD-HHMMSS-XXXX・日本時間） */
export function notifyReceiptNo(now: Date = new Date(), rand: () => number = Math.random): string {
  const j = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const ymd = `${j.getUTCFullYear()}${p(j.getUTCMonth() + 1)}${p(j.getUTCDate())}`;
  const hms = `${p(j.getUTCHours())}${p(j.getUTCMinutes())}${p(j.getUTCSeconds())}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const tail = Array.from({ length: 4 }, () => chars[Math.floor(rand() * chars.length)]).join("");
  return `EHC-N-${ymd}-${hms}-${tail}`;
}

export function notifyLead(input: NotifySignupInput, receiptNo: string, todayYmd: string): LeadPayload {
  return {
    company: input.company || "（公募のお知らせ希望）",
    email: input.email,
    status: "お知らせ希望",
    proposalNo: receiptNo,
    sentDate: todayYmd,
    wishSubsidy: null,
    memo: [
      "次の公募のお知らせを希望（Web診断の結果の画面から登録）。",
      input.programs.length ? `関心のある制度: ${input.programs.join("、")}` : "",
      [input.pref ? `所在地: ${input.pref}` : "", input.building ? `建物: ${input.building}` : "", input.timing ? `希望時期: ${input.timing}` : ""]
        .filter(Boolean)
        .join("／"),
      "配信の停止を求められたら、この行を消してください。",
    ].filter(Boolean).join("\n"),
    nextAction: "公募の開始が分かったら、メールでご案内する",
  };
}

export function notifyStaffMail(input: NotifySignupInput, receiptNo: string): { subject: string; text: string } {
  return {
    subject: `【公募のお知らせ登録 ${receiptNo}】${input.company || input.email}`,
    text: [
      "Web診断の結果の画面から、次の公募のお知らせの登録がありました。",
      "Notion「EHC見込み顧客アタックリスト」に、ステータス「お知らせ希望」で1行追加しています。",
      "",
      `メール: ${input.email}`,
      `会社名: ${input.company || "（未入力）"}`,
      input.programs.length ? `関心のある制度: ${input.programs.join("、")}` : "関心のある制度: （画面に候補なし）",
      [input.pref, input.building, input.timing].some(Boolean)
        ? `条件: ${[input.pref, input.building, input.timing].filter(Boolean).join("／")}`
        : "",
      "",
      "公募の開始が分かったら、Notion で「お知らせ希望」の行を絞り込んでご案内してください。",
    ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n"),
  };
}
