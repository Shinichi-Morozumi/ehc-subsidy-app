/* ───────────────────────────────────────────────────────────
   Notion「EHC見込み顧客アタックリスト」への1行追加（共通）

   もとは app/api/send-proposal/route.ts の中にあった関数を、2026-09-25 に
   診断フロー（app/api/diagnosis-submit）からも使うためにここへ移した。
   振る舞いは同じ（失敗を黙って消さない・8秒で打ち切る・NOTION_TOKEN が無ければ何もしない）。
   足したのは2点だけ: 長い文を Notion の上限（1要素2,000字）の内側で切る／ステータスを選べる。

   DB の項目（2026-09-25 に Notion で確認）:
     会社名(title)／ステータス(select: 未着手・提案送付済み・現地調査・見積提示・受注・失注)／
     希望制度(select: ものづくり・省エネ補助金・持続化・自治体・未定)／補助金額(概算)(number・円)／
     回収年数(number)／担当メール(email)／電話(phone_number)／住所(text)／提案No(text)／
     送信日(date)／メモ(text)／次アクション(text)
   項目名を Notion 側で変えると全件失敗する。失敗はログに lead ごと残すので、そこから手で戻せる。

   必要な環境変数（Vercel）:
     NOTION_TOKEN … Notion内部インテグレーションのシークレット（未設定なら何もしない）
     NOTION_DB_ID … 追記先の database_id（既定: 27c3f8fe-bc9b-49f7-bba1-430b90697cec）
   ─────────────────────────────────────────────────────────── */

export type LeadStatus = "未着手" | "提案送付済み" | "現地調査" | "見積提示" | "受注" | "失注";
export type LeadWish = "ものづくり" | "省エネ補助金" | "持続化" | "自治体" | "未定";

export type LeadPayload = {
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  subsidyYen?: number;
  yearsToRecover?: number | null;
  wishSubsidy?: string | null;
  proposalNo?: string;
  sentDate?: string; // YYYY-MM-DD
  memo?: string;
  /** 既定は「提案送付済み」（旧提案書の送付）。Web診断の相談は「未着手」で入れる */
  status?: LeadStatus;
  nextAction?: string;
};

export type NotionResult = { ok: boolean; skipped?: boolean; error?: string };

/** Notion の rich_text 1要素は2,000字まで */
const clipText = (s: string, max = 1900) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function buildLeadProperties(lead: LeadPayload): Record<string, unknown> {
  const props: Record<string, unknown> = {
    会社名: { title: [{ text: { content: clipText(lead.company || "（無題）", 200) } }] },
    ステータス: { select: { name: lead.status ?? "提案送付済み" } },
  };
  if (typeof lead.subsidyYen === "number" && Number.isFinite(lead.subsidyYen)) props["補助金額(概算)"] = { number: lead.subsidyYen };
  if (typeof lead.yearsToRecover === "number" && Number.isFinite(lead.yearsToRecover)) props["回収年数"] = { number: lead.yearsToRecover };
  if (lead.wishSubsidy) props["希望制度"] = { select: { name: lead.wishSubsidy } };
  if (lead.email) props["担当メール"] = { email: lead.email };
  if (lead.phone) props["電話"] = { phone_number: lead.phone };
  if (lead.address) props["住所"] = { rich_text: [{ text: { content: clipText(lead.address) } }] };
  if (lead.proposalNo) props["提案No"] = { rich_text: [{ text: { content: clipText(lead.proposalNo, 100) } }] };
  if (lead.sentDate) props["送信日"] = { date: { start: lead.sentDate } };
  if (lead.memo) props["メモ"] = { rich_text: [{ text: { content: clipText(lead.memo) } }] };
  if (lead.nextAction) props["次アクション"] = { rich_text: [{ text: { content: clipText(lead.nextAction) } }] };
  return props;
}

const DEFAULT_DB_ID = "27c3f8fe-bc9b-49f7-bba1-430b90697cec";

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

export async function appendLeadToNotion(lead: LeadPayload): Promise<NotionResult> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { ok: false, skipped: true, error: "NOTION_TOKEN 未設定" };
  const databaseId = process.env.NOTION_DB_ID || DEFAULT_DB_ID;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000); // 8秒でタイムアウト
  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: buildLeadProperties(lead),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      // Notion のエラー本文には失敗理由（プロパティ名不一致・権限不足など）が入る
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Notion ${res.status}: ${detail.slice(0, 500)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** 「提案No」が同じ行がすでにあるか。
 *  true＝ある／false＝無い／null＝確かめられなかった（権限・通信・タイムアウト）。 */
export async function leadExistsInNotion(proposalNo: string): Promise<boolean | null> {
  const token = process.env.NOTION_TOKEN;
  if (!token || !proposalNo) return null;
  const databaseId = process.env.NOTION_DB_ID || DEFAULT_DB_ID;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        filter: { property: "提案No", rich_text: { equals: proposalNo } },
        page_size: 1,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { results?: unknown[] } | null;
    return Array.isArray(data?.results) ? data!.results.length > 0 : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 同じ受付番号の行を2回作らない追加（Web診断用）。
 *  送信台帳はプロセス内のメモリなので、別のインスタンスで再送されると
 *  担当者宛メールがもう1通出ることがある。Notion の行まで重ねないため、先に「提案No」で探す。
 *  探せなかったとき（権限・通信）は追加する。行が無いより、重なるほうが後で直せる。 */
export async function appendLeadToNotionOnce(lead: LeadPayload): Promise<NotionResult & { duplicate?: boolean }> {
  if (!process.env.NOTION_TOKEN) return { ok: false, skipped: true, error: "NOTION_TOKEN 未設定" };
  if (lead.proposalNo) {
    const exists = await leadExistsInNotion(lead.proposalNo);
    if (exists === true) return { ok: true, duplicate: true };
  }
  return appendLeadToNotion(lead);
}
