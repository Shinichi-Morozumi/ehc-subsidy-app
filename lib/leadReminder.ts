/* ───────────────────────────────────────────────────────────
   「未着手」のままの相談を担当者に知らせる（2026-09-26 改善5）

   ■ なぜ
   　　Web診断の相談は Notion「EHC見込み顧客アタックリスト」に「未着手」で1行入る（lib/diagnosisLead.ts）。
   　　お客様には「5営業日以内にご連絡します」と約束しているのに、期限を過ぎても誰にも知らせが行かなかった。

   ■ 決めたこと
   　　・平日の朝9時（日本時間）に Vercel の定期実行（vercel.json の crons）で1回だけ見る。
   　　・対象：ステータスが「未着手」で、送信日から2営業日以上たった、Web診断の行（提案No が "EHC-2" で始まる）。
   　　　（公募のお知らせ登録（EHC-N-…）・手で足した行・旧提案書の行は対象にしない）
   　　・担当者宛（診断の担当者宛メールと同じ宛先）に、まとめて1通送る。
   　　・送ったら、その行の「リマインド送信日」に今日の日付を入れる。同じ日には2度送らない
   　　　（定期実行の口は誰でも叩けるので、何度叩かれても1日1通に収めるため）。
   　　・ステータスを「未着手」以外に変えれば、翌日から知らせは止まる。
   　　・営業日は土日を除いた日で数える（祝日は数えに入る。祝日の翌日は1日早めに知らせることがある）。
   ─────────────────────────────────────────────────────────── */

export const REMIND_AFTER_BUSINESS_DAYS = 2;
export const REMINDED_PROPERTY = "リマインド送信日";

const ymdToUtcNoon = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const utcNoonToYmd = (d: Date): string => d.toISOString().slice(0, 10);
const isWeekday = (d: Date): boolean => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

/** today から n 営業日さかのぼった日（YYYY-MM-DD）。この日以前の送信日が「n営業日以上たった」行 */
export function businessDaysBefore(todayYmd: string, n: number): string {
  const cur = ymdToUtcNoon(todayYmd);
  let back = 0;
  while (back < n) {
    cur.setUTCDate(cur.getUTCDate() - 1);
    if (isWeekday(cur)) back += 1;
  }
  return utcNoonToYmd(cur);
}

/** from の翌日から to までの営業日の数（to が from 以前なら 0） */
export function businessDaysBetween(fromYmd: string, toYmd: string): number {
  const cur = ymdToUtcNoon(fromYmd);
  const end = ymdToUtcNoon(toYmd);
  let n = 0;
  while (cur < end) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (isWeekday(cur)) n += 1;
  }
  return n;
}

/** from から n 営業日後（YYYY-MM-DD） */
export function businessDaysAfter(fromYmd: string, n: number): string {
  const cur = ymdToUtcNoon(fromYmd);
  let added = 0;
  while (added < n) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (isWeekday(cur)) added += 1;
  }
  return utcNoonToYmd(cur);
}

/** Notion の database query に渡す絞り込み */
export function reminderFilter(todayYmd: string) {
  return {
    and: [
      { property: "ステータス", select: { equals: "未着手" } },
      { property: "送信日", date: { on_or_before: businessDaysBefore(todayYmd, REMIND_AFTER_BUSINESS_DAYS) } },
      { property: "提案No", rich_text: { starts_with: "EHC-2" } },
    ],
  };
}

export interface ReminderRow {
  pageId: string;
  url: string | null;
  company: string;
  receiptNo: string;
  sentDate: string | null;
  remindedDate: string | null;
  email: string | null;
  phone: string | null;
}

type NotionProp = Record<string, unknown> & { type?: string };
const plain = (p: NotionProp | undefined): string => {
  if (!p) return "";
  const arr = (p.title ?? p.rich_text) as { plain_text?: string }[] | undefined;
  return Array.isArray(arr) ? arr.map((t) => t.plain_text ?? "").join("") : "";
};
const dateStart = (p: NotionProp | undefined): string | null => {
  const d = p?.date as { start?: string } | null | undefined;
  return d?.start ? d.start.slice(0, 10) : null;
};

/** Notion の query の結果（results）を、通知に使う形にする。読めない行は捨てる。 */
export function rowsFromNotion(results: unknown): ReminderRow[] {
  if (!Array.isArray(results)) return [];
  const rows: ReminderRow[] = [];
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const page = r as { id?: string; url?: string; properties?: Record<string, NotionProp> };
    if (!page.id || !page.properties) continue;
    const props = page.properties;
    rows.push({
      pageId: page.id,
      url: page.url ?? null,
      company: plain(props["会社名"]) || "（会社名なし）",
      receiptNo: plain(props["提案No"]),
      sentDate: dateStart(props["送信日"]),
      remindedDate: dateStart(props[REMINDED_PROPERTY]),
      email: typeof props["担当メール"]?.email === "string" ? (props["担当メール"].email as string) : null,
      phone: typeof props["電話"]?.phone_number === "string" ? (props["電話"].phone_number as string) : null,
    });
  }
  return rows;
}

/** 今日まだ知らせていない行だけ */
export function dueToday(rows: ReminderRow[], todayYmd: string): ReminderRow[] {
  return rows.filter((r) => r.remindedDate !== todayYmd);
}

export function reminderMail(rows: ReminderRow[], todayYmd: string, replyDays: number): { subject: string; text: string } {
  const lines = rows.map((r, i) => {
    const sent = r.sentDate ?? "不明";
    const passed = r.sentDate ? businessDaysBetween(r.sentDate, todayYmd) : null;
    const due = r.sentDate ? businessDaysAfter(r.sentDate, replyDays) : null;
    const left = due ? businessDaysBetween(todayYmd, due) : null;
    const dueText = due
      ? due < todayYmd
        ? `ご連絡の目安 ${due}（過ぎています）`
        : due === todayYmd
          ? `ご連絡の目安 ${due}（今日まで）`
          : `ご連絡の目安 ${due}（あと${left}営業日）`
      : "ご連絡の目安 不明";
    return [
      `${i + 1}. ${r.company}　受付番号 ${r.receiptNo || "不明"}`,
      `   送信日 ${sent}${passed != null ? `（${passed}営業日前）` : ""}／${dueText}`,
      `   連絡先 ${[r.email, r.phone].filter(Boolean).join("／") || "（Notion の行をご覧ください）"}`,
      r.url ? `   Notion ${r.url}` : "",
    ].filter(Boolean).join("\n");
  });
  return {
    subject: `【要対応】Web診断のご相談が「未着手」のままです（${rows.length}件）`,
    text: [
      "Web診断から届いたご相談のうち、送信から2営業日以上たっても Notion のステータスが「未着手」の行です。",
      `お客様には「${replyDays}営業日以内にご連絡します」とお伝えしています。ご連絡のうえ、ステータスを更新してください（更新すると翌日から知らせは止まります）。`,
      "",
      ...lines,
      "",
      "このメールは、平日の朝に自動で送っています（Notion「EHC見込み顧客アタックリスト」の「リマインド送信日」に今日の日付を入れました）。",
    ].join("\n"),
  };
}
