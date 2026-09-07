import { getSubsidies } from "./subsidies";
import { fetchLiveSubsidies } from "./jgrants";

/* 2026-08-27 監査での修正 ─ 制度改定監視が実質機能していなかった件
 *
 * 旧実装は HEAD を1回投げ、Last-Modified が officialCheckedAt より新しければ needs_review、
 * それ以外は全部 unchanged としていた。ここには3つの穴があった。
 *
 *  1. 官公庁・自治体の制度ページは動的生成が多く、Last-Modified を返さない。
 *     返らなければ sourceChanged は常に false になり、**永久に unchanged** と表示される。
 *     つまり「監視しています」と言いながら、実際には何も検知していなかった。
 *  2. HEAD を拒否する（405/403）サーバがある。旧実装はそれを unavailable とだけ言い、
 *     GET で取り直さなかったので、生きているページを落ちている扱いにしていた。
 *  3. sourceUrl が制度ページではなく**ポータルのトップ**である制度がある
 *     （SII の 2制度＝ syouenehojyokin.sii.or.jp/、観光庁トップ、大阪府トップ）。
 *     トップページを見ても、その制度が改定されたかは分からない。
 *     それを unchanged と表示するのは「確認できていない」を「確認した」と偽ることになる。
 *
 * 2026-08-27 追記:
 *  上記3を実際に潰した際、この穴が実害を出していたことが確認できた。
 *  SII 設備単位型／GX設備単位型の 3次公募が 2026/8/20 に開始されていたのに、
 *  監視先が syouenehojyokin.sii.or.jp/ のトップだったため検知できず、
 *  アプリは 2次公募の締切（2026/7/9）を根拠に「終了」と表示し続けていた。
 *  空調更新で最も効く制度を、締切1か月前に「終了」と案内していたことになる。
 *  同時に、同一公募の2類型が1枚の公募情報ページを共有するのは設計上正しいため、
 *  「意図した共有」を Subsidy.sourceSharedGroup で宣言できるようにした（下記 isProgramPageUrl）。
 *
 * 本版での変更:
 *  - HEAD が使えなければ GET で取り直す。タイムアウトを入れる。
 *  - リダイレクト先のパスが変わっていたら改定・移設の疑いとして needs_review。
 *  - Last-Modified が無い場合も黙って unchanged にせず、**最終確認からの経過日数**で
 *    stale（要再確認）に落とす。時間が経てば必ず誰かが見直す状態にする。
 *  - 制度ページ単位で監視できていないものは coverage_gap として、
 *    「監視できていない」ことを結果に明示する（unchanged に混ぜない）。
 */

export type MonitorState = "unchanged" | "needs_review" | "stale" | "coverage_gap" | "unavailable";

/** 公式確認から何日経ったら「要再確認」に落とすか。制度の年度替わりに追随できる長さにしている。 */
export const OFFICIAL_CHECK_STALE_DAYS = 90;

/** ページ取得のタイムアウト(ms)。route.ts の maxDuration=60 を1URLで食い潰さないため。 */
const FETCH_TIMEOUT_MS = 8000;

export interface SourceMonitorResult {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  httpStatus: number | null;
  lastModified: string | null;
  etag: string | null;
  state: MonitorState;
  note: string;
  /** true = sourceUrl が制度ページではなくポータルのトップ。改定の自動検知が効かない。 */
  coverageGap: boolean;
  /** 最終確認からの経過日数（officialCheckedAt が無ければ null） */
  daysSinceOfficialCheck: number | null;
}

/* URLが「その制度のページ」を指しているかの判定。
   パスが無い（トップ）か、ディレクトリ1階層だけのポータル入口は制度ページとみなさない。

   複数制度が同じURLを共有している場合は、原則としてそのURLで制度を区別できないため
   制度ページとみなさない。ただし例外がひとつある。
   同一公募の複数類型（SII の 設備単位型／GX設備単位型 など）は、
   1枚の公募情報ページに併記されるのが正しい姿で、
   そのページが更新されれば両方を見直せばよいので変更検知は成立する。
   この「意図した共有」は sharedGroup で宣言する。
   sharedGroup は、そのURLを共有する制度が**全て同じ値を宣言している**ときだけ
   非 null で渡される（1つでも未宣言・不一致なら null）。 */
export function isProgramPageUrl(rawUrl: string, sharedByCount: number, sharedGroup?: string | null): boolean {
  if (sharedByCount > 1 && !sharedGroup) return false;
  let path: string;
  try {
    path = new URL(rawUrl).pathname;
  } catch {
    return false;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return false;                       // 例: https://www.pref.osaka.lg.jp/
  const last = segments[segments.length - 1];
  // 末尾がファイル名（.html 等）なら制度ページとみなす。ただし index.html は分野トップなので除く。
  if (/\.[a-z]{2,5}$/i.test(last)) return !/^index\./i.test(last);
  // ディレクトリ止まりは2階層以上あれば制度ページとみなす（例: /subsidy/zeroemi-shoene/）
  return segments.length >= 2;
}

function daysBetween(fromIso: string, to: Date): number {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return 0;
  return Math.floor((to.getTime() - from) / 86400000);
}

function samePath(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.host === ub.host && ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "");
  } catch {
    return a === b;
  }
}

/** HEAD → 拒否されたら GET で取り直す。どちらもタイムアウト付き。 */
async function probe(sourceUrl: string): Promise<{ response: Response | null; error: boolean }> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await fetch(sourceUrl, {
        method,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      // HEAD を受け付けないサーバ（405/403/501）は GET で取り直す
      if (method === "HEAD" && [403, 405, 501].includes(response.status)) continue;
      return { response, error: false };
    } catch {
      if (method === "GET") return { response: null, error: true };
    }
  }
  return { response: null, error: true };
}

async function inspectSource(
  sourceUrl: string,
  officialCheckedAt: string | undefined,
  coverageGap: boolean,
  now: Date
): Promise<Omit<SourceMonitorResult, "id">> {
  const fetchedAt = now.toISOString();
  const daysSinceOfficialCheck = officialCheckedAt ? daysBetween(officialCheckedAt, now) : null;
  const base = { sourceUrl, fetchedAt, coverageGap, daysSinceOfficialCheck };

  const { response } = await probe(sourceUrl);
  if (!response) {
    return { ...base, httpStatus: null, lastModified: null, etag: null, state: "unavailable", note: "公式ページへの接続を確認できませんでした。画面では要確認として扱います。" };
  }

  const lastModified = response.headers.get("last-modified");
  const etag = response.headers.get("etag");
  const head = { ...base, httpStatus: response.status, lastModified, etag };

  if (!response.ok) {
    return { ...head, state: "unavailable", note: `公式ページを取得できませんでした（HTTP ${response.status}）。ページの移設・公開終了の可能性があります。` };
  }

  // 転送先のパスが変わっている＝ページの移設や年度切替の疑い
  if (response.url && !samePath(response.url, sourceUrl)) {
    return { ...head, state: "needs_review", note: `公式ページが ${response.url} へ転送されています。移設・年度切替の可能性があるため、人による再確認が必要です。` };
  }

  // Last-Modified が officialCheckedAt より新しい＝確認後に更新されている
  if (lastModified && officialCheckedAt && Date.parse(lastModified) > Date.parse(officialCheckedAt)) {
    return { ...head, state: "needs_review", note: "公式ページが最終確認日時より後に更新されています。人による再確認が必要です。" };
  }

  /* ここから下が本版で足した経路。
     以前はこの時点で全部 unchanged にしていたが、
     Last-Modified を返さないページでは「変わっていない」ことを確かめられたわけではない。
     確かめられていないなら、確かめられていないと言う。 */
  if (coverageGap) {
    return { ...head, state: "coverage_gap", note: "この制度は公式ポータルの入口ページしか監視できていません（または複数制度が同じURLを共有しています）。制度ページ単位のURLを登録するか、同一公募の類型であれば sourceSharedGroup を宣言するまで、改定の自動検知は効きません。" };
  }
  if (!lastModified) {
    return {
      ...head,
      state: daysSinceOfficialCheck !== null && daysSinceOfficialCheck > OFFICIAL_CHECK_STALE_DAYS ? "stale" : "unchanged",
      note: daysSinceOfficialCheck !== null && daysSinceOfficialCheck > OFFICIAL_CHECK_STALE_DAYS
        ? `公式ページが更新日時を返さないため機械的な変更検知ができず、最終確認から${daysSinceOfficialCheck}日が経過しています。人による再確認が必要です。`
        : "公式ページが更新日時を返さないため機械的な変更検知はできていません。最終確認からの経過日数は許容範囲内です。",
    };
  }
  if (daysSinceOfficialCheck !== null && daysSinceOfficialCheck > OFFICIAL_CHECK_STALE_DAYS) {
    return { ...head, state: "stale", note: `更新ヘッダー上の変更は検知していませんが、最終確認から${daysSinceOfficialCheck}日が経過しています。人による再確認が必要です。` };
  }
  return { ...head, state: "unchanged", note: "更新ヘッダー上の新しい変更は検知していません。" };
}

export async function monitorOfficialSources(now: Date = new Date()) {
  /* 2026-08-24 監査での修正:
     以前は `new Map(SUBSIDIES.map((s) => [s.sourceUrl || s.url, s]))` でURLをキーに重複排除しており、
     同じURL（https://syouenehojyokin.sii.or.jp/）を共有する sii_iv と sii_gx のうち
     後勝ちで sii_gx だけが残り、**sii_iv は監視対象から黙って消えていた**。
     HTTPアクセスはURL単位で1回に抑えつつ、結果は同じURLを参照する全制度に配る。 */
  const all = getSubsidies(now);
  const urls = Array.from(new Set(all.map((s) => s.sourceUrl || s.url)));
  const sharedCount = new Map<string, number>();
  /* そのURLを共有する制度が全て同じ sourceSharedGroup を宣言していれば、その値。
     1つでも未宣言・不一致なら null（＝意図しない共有として coverage_gap に落とす）。 */
  const sharedGroup = new Map<string, string | null>();
  urls.forEach((url) => {
    const members = all.filter((s) => (s.sourceUrl || s.url) === url);
    sharedCount.set(url, members.length);
    const groups = members.map((s) => s.sourceSharedGroup);
    const first = groups[0];
    sharedGroup.set(url, first && groups.every((g) => g === first) ? first : null);
  });

  const [byUrl, jgrants] = await Promise.all([
    Promise.all(
      urls.map(async (url) => {
        // 最終確認日時は、そのURLを参照する制度の中で最も古いものに合わせる（安全側）
        const checkedAts = all
          .filter((s) => (s.sourceUrl || s.url) === url)
          .map((s) => s.officialCheckedAt)
          .filter((v): v is string => Boolean(v))
          .sort();
        const coverageGap = !isProgramPageUrl(url, sharedCount.get(url) ?? 1, sharedGroup.get(url) ?? null);
        const result = await inspectSource(url, checkedAts[0], coverageGap, now);
        return [url, result] as const;
      })
    ),
    fetchLiveSubsidies().catch(() => []),
  ]);
  const resultByUrl = new Map(byUrl);
  const sources: SourceMonitorResult[] = all.map((s) => {
    const url = s.sourceUrl || s.url;
    return { ...resultByUrl.get(url)!, id: s.id };
  });

  /* needsReview は「A判定から降格させる制度」の一覧である。
     coverage_gap は“監視できていない”という体制側の欠落であって、
     制度そのものが変わった証拠ではないため、ここには含めない（画面には注記として出す）。
     混ぜてしまうと主要制度が恒久的にA判定から消え、営業上使えない道具になる。 */
  const needsReview = sources.filter((s) => s.state === "needs_review" || s.state === "stale" || s.state === "unavailable").map((s) => s.id);
  const coverageGaps = sources.filter((s) => s.state === "coverage_gap").map((s) => s.id);

  return {
    checkedAt: now.toISOString(),
    sources,
    needsReview,
    coverageGaps,
    staleAfterDays: OFFICIAL_CHECK_STALE_DAYS,
    jgrantsDiscovery: {
      count: jgrants.length,
      items: jgrants,
      verificationState: "needs_review" as const,
      note: "J-Grants一覧APIの検索結果です。詳細API・公募要領・実施主体の公式ページを確認するまでA判定には使用しません。",
    },
  };
}
