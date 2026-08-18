import { SUBSIDIES } from "./subsidies";
import { fetchLiveSubsidies } from "./jgrants";

export interface SourceMonitorResult {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  httpStatus: number | null;
  lastModified: string | null;
  etag: string | null;
  state: "unchanged" | "needs_review" | "unavailable";
  note: string;
}

async function inspectSource(id: string, sourceUrl: string, officialCheckedAt?: string): Promise<SourceMonitorResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(sourceUrl, { method: "HEAD", redirect: "follow", cache: "no-store" });
    const lastModified = response.headers.get("last-modified");
    const etag = response.headers.get("etag");
    if (!response.ok) return { id, sourceUrl, fetchedAt, httpStatus: response.status, lastModified, etag, state: "unavailable", note: "公式ページを取得できませんでした。画面では要確認として扱います。" };
    const sourceChanged = Boolean(lastModified && officialCheckedAt && Date.parse(lastModified) > Date.parse(officialCheckedAt));
    return {
      id, sourceUrl, fetchedAt, httpStatus: response.status, lastModified, etag,
      state: sourceChanged ? "needs_review" : "unchanged",
      note: sourceChanged ? "公式ページが最終確認日時より後に更新されています。人による再確認が必要です。" : "更新ヘッダー上の新しい変更は検知していません。",
    };
  } catch {
    return { id, sourceUrl, fetchedAt, httpStatus: null, lastModified: null, etag: null, state: "unavailable", note: "公式ページへの接続を確認できませんでした。" };
  }
}

export async function monitorOfficialSources() {
  const unique = Array.from(new Map(SUBSIDIES.map((s) => [s.sourceUrl || s.url, s])).values());
  const [sources, jgrants] = await Promise.all([
    Promise.all(unique.map((s) => inspectSource(s.id, s.sourceUrl || s.url, s.officialCheckedAt))),
    fetchLiveSubsidies().catch(() => []),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    sources,
    needsReview: sources.filter((s) => s.state !== "unchanged").map((s) => s.id),
    jgrantsDiscovery: {
      count: jgrants.length,
      items: jgrants,
      verificationState: "needs_review" as const,
      note: "J-Grants一覧APIの検索結果です。詳細API・公募要領・実施主体の公式ページを確認するまでA判定には使用しません。",
    },
  };
}
