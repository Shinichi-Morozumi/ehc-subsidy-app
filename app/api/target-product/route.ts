/* ───────────────────────────────────────────────────────────
   対象製品の照合結果を返す口（EHC-0039 v2 §2 / 2026-09-16 v1）

   ■ この口があることで何が変わるか
   　　`MatchInput.targetProductChecked` には書き手が1つも無かった。
   　　そのため「適合は高い」は受入テストの直接入力でしか出ず、
   　　実画面では永久に0件だった（v2 §2 の FAIL、台帳 #63）。
   　　画面はここへ導入予定機器を送り、**サーバが保存先から引き直した**
   　　照合結果を受け取る。

   ■ クライアントの申告を受け取らない
   　　body から読むのは「何を入れる予定か」（設備群・型番・メーカー）だけ。
   　　`targetProductChecks` / `checked` / `verdict` の類が body に入っていても
   　　読まない。照合結果はサーバが lib/targetProduct.ts の保存先から作る。
   　　受け取ってしまうと、補助対象かどうかの根拠が利用者の手元に移る。

   ■ 保存先が未接続のとき
   　　既定の保存先は「未接続」で、空の記録集合を返す。
   　　その結果は必ず unchecked になり、checks は全制度 false になる。
   　　ここでダミーの確認済みを作らない。未接続であることは
   　　レスポンスの store.connected で表に出し、画面がそのまま言えるようにする。

   ■ 年度と枠（2026-09-16 台帳#32 で改訂）
   　　対象製品一覧は年度ごと・枠ごとに入れ替わる。
   　　v1 は全制度を「今日（JST）の年度」「frameOf() の1枠」で引いていた。
   　　これは2つの点で実態と合っていなかった。
   　　　1. SII の設備単位型／GX設備単位型は令和7年度補正（2025年度）の事業で、
   　　　　 3次公募の受付だけが2026年度に行われる。今日から年度を出すと
   　　　　 2026 という、参照する一覧と1年ずれたキーで記録が保存される。
   　　　2. sii_gx はメーカー強化枠とトップ性能枠の2枠を持つのに1枠へ潰れており、
   　　　　 片方の枠で取った確認が制度全体へ繰り上がる状態だった。
   　　いまは targetProductKeyOf(s, today) が制度ごとに年度と枠を決める。
   　　枠が2つ以上あるあいだは照合キーが決まらないので、
   　　frameUndecidedAssessment で止める（checked は false のまま）。
   　　`SUBSIDY_DATA_ASOF` は「2026年8月27日」という和文表記で、
   　　しかも意味が違う（制度データをこちらが確認した日であって、
   　　いま申請しようとしている年度ではない）。ここでは使わない。
   ─────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { getSubsidies } from "@/lib/subsidies";
import { todayJst } from "@/lib/programClock";
import {
  assessTargetProduct,
  describeTargetProductStore,
  fiscalYearOf,
  frameUndecidedAssessment,
  listChecks,
  targetProductKeyOf,
  FRAME_UNDECIDED_LABEL,
  type PlannedUnit,
  type TargetProductApiResponse,
} from "@/lib/targetProduct";
import { ensureTargetProductStore } from "@/lib/targetProductStore";
import type { EquipKind } from "@/lib/diagnosisState";

export const runtime = "nodejs";
/* 保存先の記録が更新されたら即座に効かないと、
   「照合したのに画面が古い未確認のまま」になる。キャッシュしない。 */
export const dynamic = "force-dynamic";

/* body は外から来る。型を信じず、1件ずつ形を確かめて落とす。 */
function readPlannedUnits(raw: unknown): PlannedUnit[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannedUnit[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const kind = o.equipKind;
    const equipKind: EquipKind =
      kind === "room" || kind === "ac" || kind === "multi" || kind === "unknown" ? kind : null;
    const model = typeof o.model === "string" && o.model.trim() ? o.model.trim() : null;
    const maker = typeof o.maker === "string" && o.maker.trim() ? o.maker.trim() : null;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `plan-${i}`;
    out.push({ id, equipKind, model, maker });
  });
  return out;
}

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const plans = readPlannedUnits((body as Record<string, unknown> | null)?.plans);

  /* 保存先へ接続する。接続できなければ既定の未接続のまま進む。
     ここで失敗しても照合は走る（結果が必ず未確認になるだけ）。
     未接続であることは store で表に出し、画面がそのまま言えるようにする。 */
  const storeStatus = ensureTargetProductStore();

  const today = todayJst();
  const fiscalYear = fiscalYearOf(today);
  const subsidies = getSubsidies();

  const checks: Record<string, boolean> = {};
  const notes: Record<string, string> = {};
  const details: TargetProductApiResponse["details"] = {};

  for (const s of subsidies) {
    /* 制度ごとの照合キー（年度・枠）。今日の年度で代用しない。 */
    const key = targetProductKeyOf(s, today);

    /* 枠が2つ以上あって未確定なら、見るべき対象製品一覧そのものが決まらない。
       保存先を引きにも行かない（引けば「どちらかの枠の記録」を
       制度全体の確認済みへ繰り上げる余地が生まれる）。 */
    const a =
      key.frame === null
        ? frameUndecidedAssessment(key.frames, plans)
        : assessTargetProduct(
            { subsidyId: s.id, fiscalYear: key.fiscalYear, frame: key.frame, plans },
            /* 保存先から引き直す。クライアントが送ってきた値は一切見ていない。 */
            await listChecks(s.id, key.fiscalYear),
            /* この制度が対象とする設備群。s.target は "ac" | "multi" で、
               room はここに入らない。入らない群を ac へ読み替えない。 */
            [...s.target]
          );

    const frameLabel = key.frame ?? FRAME_UNDECIDED_LABEL;
    checks[s.id] = a.checked;
    notes[s.id] = a.reason;
    details[s.id] = {
      status: a.status,
      frame: frameLabel,
      fiscalYear: key.fiscalYear,
      frames: key.frames,
      reason: a.reason,
      nextAction: a.nextAction,
      units: a.units,
      evidence: a.evidence,
    };
  }

  const res: TargetProductApiResponse = {
    fiscalYear,
    checkedAt: today,
    store: {
      ...describeTargetProductStore(),
      ...(storeStatus.reason ? { reason: storeStatus.reason } : {}),
    },
    checks,
    notes,
    details,
  };
  return NextResponse.json(res);
}
