// Jグランツ（デジタル庁）公開APIの取得・正規化ユーティリティ。
// 公開検索/詳細のみ（申請提出APIは無い）。認証不要。
// ドキュメント: https://developers.digital.go.jp/documents/jgrants/api/

const JGRANTS_BASE = "https://api.jgrants-portal.go.jp/exp/v1/public";

// 業務用空調・省エネ・脱炭素まわりで拾いたいキーワード群。
// keyword は2文字以上必須。複数叩いて id で重複排除する。
// 空調に直接関係する語のみに限定（「高効率」等は水力発電・レーザー加工など無関係公募を拾うため不使用）。
export const JGRANTS_KEYWORDS = ["空調", "エアコン"];

// 万一混入した場合の保険。タイトルにこれらを含む公募は空調と無関係とみなし除外する。
export const JGRANTS_NG_KEYWORDS = ["レーザー", "変圧器", "水素ステーション"];

// jGrants 検索APIの1件（必要なフィールドのみ）
interface JGrantsSearchRaw {
  id: string;
  name: string;
  title: string;
  target_area_search: string | null;
  subsidy_max_limit: number | null;
  target_number_of_employees: string | null;
  acceptance_start_datetime: string | null;
  acceptance_end_datetime: string | null;
  institution_name: string | null;
}

// アプリ内で扱う正規化済みの生きた公募
export interface JGrantsSubsidy {
  id: string;
  title: string;
  area: string; // 対象地域（"全国" 等）
  maxLimit: number | null; // 補助上限額（円）。0/未設定は null
  employees: string; // 従業員規模の条件
  acceptanceStart: string | null; // ISO
  acceptanceEnd: string | null; // ISO（締切）
  url: string; // Jグランツ公式の詳細ページ
}

function normalize(r: JGrantsSearchRaw): JGrantsSubsidy {
  return {
    id: r.id,
    title: r.title,
    area: r.target_area_search || "全国",
    maxLimit: r.subsidy_max_limit && r.subsidy_max_limit > 0 ? r.subsidy_max_limit : null,
    employees: r.target_number_of_employees || "指定なし",
    acceptanceStart: r.acceptance_start_datetime || null,
    acceptanceEnd: r.acceptance_end_datetime || null,
    url: `https://www.jgrants-portal.go.jp/subsidy/${r.id}`,
  };
}

// 1キーワードで受付中(acceptance=1)を締切昇順に取得
async function searchOne(keyword: string): Promise<JGrantsSearchRaw[]> {
  const params = new URLSearchParams({
    keyword,
    sort: "acceptance_end_datetime",
    order: "ASC",
    acceptance: "1",
  });
  const res = await fetch(`${JGRANTS_BASE}/subsidies?${params.toString()}`, {
    headers: { Accept: "application/json" },
    // Vercel/Next側でキャッシュ。個別キーワードの一時失敗は握りつぶす。
    next: { revalidate: 21600 }, // 6時間
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { result?: JGrantsSearchRaw[] };
  return Array.isArray(json.result) ? json.result : [];
}

// 全キーワードを叩いて id で重複排除し、締切昇順で返す
export async function fetchLiveSubsidies(): Promise<JGrantsSubsidy[]> {
  const batches = await Promise.all(JGRANTS_KEYWORDS.map((k) => searchOne(k).catch(() => [])));
  const byId = new Map<string, JGrantsSearchRaw>();
  for (const batch of batches) {
    for (const raw of batch) {
      if (raw && raw.id && !byId.has(raw.id)) byId.set(raw.id, raw);
    }
  }
  const list = Array.from(byId.values())
    .filter((raw) => !JGRANTS_NG_KEYWORDS.some((ng) => (raw.title || "").includes(ng)))
    .map(normalize);
  list.sort((a, b) => {
    const ta = a.acceptanceEnd ? Date.parse(a.acceptanceEnd) : Infinity;
    const tb = b.acceptanceEnd ? Date.parse(b.acceptanceEnd) : Infinity;
    return ta - tb;
  });
  return list;
}

// ── 準備間に合う判定 ────────────────────────────
// EHC標準リードタイム（現地調査→見積→補助金申請書類作成→提出）: おおよそ約5週。
// NextSteps STEP1〜4（電気料金確認→現地調査→詳細見積→申請代行）に対応。
export const PREP_LEAD_DAYS = 35;

export type PrepVerdict = "ample" | "rush" | "tight" | "closed";

export interface PrepAssessment {
  daysLeft: number | null; // 締切までの残日数（締切不明は null）
  verdict: PrepVerdict;
  label: string;
  note: string;
}

export function assessPrep(acceptanceEnd: string | null, now: Date = new Date()): PrepAssessment {
  if (!acceptanceEnd) {
    return {
      daysLeft: null,
      verdict: "ample",
      label: "通年・随時",
      note: "締切が公表されていません。着手のタイミングは個別にご相談ください。",
    };
  }
  const end = Date.parse(acceptanceEnd);
  const daysLeft = Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { daysLeft, verdict: "closed", label: "受付終了", note: "この回の受付は終了しています。次回公募をお待ちください。" };
  }
  if (daysLeft >= PREP_LEAD_DAYS + 14) {
    return {
      daysLeft,
      verdict: "ample",
      label: "◎ 十分間に合います",
      note: `締切まで残り約${daysLeft}日。現地調査から申請書類作成まで余裕をもって準備できます。`,
    };
  }
  if (daysLeft >= 21) {
    return {
      daysLeft,
      verdict: "rush",
      label: "△ 急げば間に合います",
      note: `締切まで残り約${daysLeft}日。今すぐ現地調査に着手すれば申請可能です。早めのご連絡を推奨します。`,
    };
  }
  return {
    daysLeft,
    verdict: "tight",
    label: "✕ 今回は厳しい見込み",
    note: `締切まで残り約${daysLeft}日。書類準備が間に合わない可能性が高いため、次回公募での申請をおすすめします。`,
  };
}
