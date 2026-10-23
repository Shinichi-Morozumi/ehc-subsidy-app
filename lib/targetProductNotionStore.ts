// v1 / 2026-10-23 / EHC-0089: 顧客台帳とは別の、対象製品の確認根拠専用データソース。
import { validateCheck, type TargetProductCheck, type TargetProductStore } from "./targetProduct";

const VERSION = "2025-09-03";
const uuid = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
type Row = { id?: string; properties?: Record<string, { type?: string; rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> }> };

function readEvidence(row: Row): TargetProductCheck {
  const text = row.properties?.Evidence?.rich_text;
  if (!Array.isArray(text)) throw new Error("確認根拠のEvidence列を読めません。");
  const check = JSON.parse(text.map(t => t.plain_text ?? t.text?.content ?? "").join(""));
  if (!check || typeof check !== "object" || validateCheck(check).length) throw new Error("確認根拠に不完全な記録があります。担当者の確認が必要です。");
  return check;
}

export async function createNotionTargetProductStore(dataSourceId: string, token: string): Promise<TargetProductStore> {
  if (!uuid.test(dataSourceId) || !token) throw new Error("確認根拠専用のNotionデータソースID・トークンが必要です。");
  async function call(endpoint: string, body?: unknown) {
    const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    // API本文（個人情報・内部情報を含む可能性）は画面へ返さない。
    if (!response.ok) throw new Error(`確認根拠Notionへの接続に失敗しました（HTTP ${response.status}）。権限・設定を確認してください。`);
    return response.json();
  }
  const source = await call(`data_sources/${dataSourceId}`);
  if (source.object !== "data_source" || source.properties?.Name?.type !== "title" || source.properties?.Evidence?.type !== "rich_text") {
    throw new Error("確認根拠専用Notionの列はName（タイトル）・Evidence（テキスト）にしてください。顧客台帳は使用しません。");
  }
  const records: TargetProductCheck[] = [];
  let cursor: string | undefined;
  const cursors = new Set<string>();
  do {
    const page = await call(`data_sources/${dataSourceId}/query`, {
      page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    });
    if (!Array.isArray(page.results) || typeof page.has_more !== "boolean") throw new Error("確認根拠の一覧を読めません。");
    for (const row of page.results) records.push(readEvidence(row));
    if (page.has_more && (typeof page.next_cursor !== "string" || cursors.has(page.next_cursor) || cursors.size >= 100)) {
      throw new Error("確認根拠のページ送りが完了しませんでした。一部の記録だけで判定しません。");
    }
    cursor = page.has_more ? page.next_cursor : undefined;
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return {
    name: "notion:target-product-evidence", connected: true,
    async list(subsidyId, fiscalYear) {
      return records.filter(r => r.subsidyId === subsidyId && r.fiscalYear === fiscalYear).map(r => ({ ...r }));
    },
    async add(check) {
      if (validateCheck(check).length) throw new Error("確認根拠が不完全です。");
      const json = JSON.stringify(check);
      if (json.length > 20000) throw new Error("確認根拠が長すぎます。出典と補足を整理してください。");
      const chunks = json.match(/[\s\S]{1,1500}/gu) ?? [];
      const created = await call("pages", {
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: {
          Name: { title: [{ text: { content: `${check.subsidyId} / ${check.fiscalYear} / ${check.plannedModel}`.slice(0, 1000) } }] },
          Evidence: { rich_text: chunks.map(content => ({ text: { content } })) },
        },
      });
      if (typeof created.id !== "string") throw new Error("確認根拠の保存結果を確認できません。再送前に台帳を確認してください。");
      const saved = readEvidence(await call(`pages/${created.id}`));
      if (JSON.stringify(saved) !== json) throw new Error("確認根拠の保存後の内容が一致しません。再送前に台帳を確認してください。");
      records.push(saved);
    },
  };
}
