/* ───────────────────────────────────────────────────────────
   対象製品の確認記録を入れる口（EHC担当者専用）
   EHC-0039 v2 §2 / 2026-09-16 v1

   ■ この口だけが「登録済みを確認しました」を作れる
   　　診断画面（/api/target-product）は読むだけで、何も書けない。
   　　書けるのはここだけで、しかも人が公式一覧を見た記録としてしか入らない。
   　　利用者が自分で「確認済み」に印を付ける経路は、どこにも作らない。

   ■ 合言葉が設定されていなければ、書かせない
   　　EHC_TARGET_PRODUCT_ADMIN_KEY が未設定のときに「誰でも書ける」に
   　　倒すと、補助対象かどうかの根拠を外から書き込めてしまう。
   　　未設定は「まだ運用していない」であって「全員に許可」ではない。
   　　だから未設定なら 503 で断る。開ける側が明示的に設定する。

   ■ サイト全体のパスコード（EHC_PASSCODE）とは別物
   　　あれは閲覧者全員に同じ合言葉を配る入口の鍵で、担当者の鍵ではない。
   　　同じ物を使うと、診断を見られる人全員が記録を書けることになる。

   ■ 検証しないものは受け取らない
   　　addCheck() が validateCheck() を通す。出典が空・確認日が YYYY-MM-DD で
   　　ない・確認主体が「システム」などは、ここで弾かれて入らない。

   ■ 照合キーが合わない記録も受け取らない（2026-09-16 台帳#32 で追加）
   　　validateCheck() は「1件の記録として形が整っているか」しか見ない。
   　　形が整っていても、制度ID・年度・申請枠・設備群が
   　　照合側（lib/targetProduct.ts の targetProductKeyOf）が使うキーと違えば、
   　　その記録は保存されるだけで**永久に効かない**。
   　　担当者は入れたつもりになり、画面は「未確認」を出し続ける。
   　　いちばん見つけにくい壊れ方なので、書き込む前にここで弾く。
   　　照合側と同じ関数（targetProductKeyOf / framesOf）でキーを作るので、
   　　片方だけ直してずれることがない。
   ─────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { getSubsidies } from "@/lib/subsidies";
import {
  addCheck,
  fiscalYearOf,
  framesOf,
  listChecks,
  targetProductKeyOf,
  validateCheck,
  type TargetProductCheck,
} from "@/lib/targetProduct";
import { ensureTargetProductStore } from "@/lib/targetProductStore";
import { todayJst } from "@/lib/programClock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const key = process.env.EHC_TARGET_PRODUCT_ADMIN_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      status: 503,
      message:
        "担当者用の合言葉（EHC_TARGET_PRODUCT_ADMIN_KEY）が設定されていないため、記録の受付を開けていません。設定するまで、この口は誰にも書かせません。",
    };
  }
  const given = req.headers.get("x-ehc-admin-key")?.trim();
  if (given !== key) {
    return { ok: false, status: 401, message: "担当者用の合言葉が一致しません。" };
  }
  return { ok: true };
}

/* ───── 読み出し：その制度・年度に何件入っているかを担当者が見るため ───── */
export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const store = ensureTargetProductStore();
  const url = new URL(req.url);
  const subsidyId = url.searchParams.get("subsidyId")?.trim() ?? "";
  const yearRaw = url.searchParams.get("fiscalYear")?.trim();
  if (!subsidyId) {
    return NextResponse.json({ error: "subsidyId を指定してください。" }, { status: 400 });
  }
  const fiscalYear = yearRaw ? Number(yearRaw) : fiscalYearOf(todayJst());
  if (!Number.isInteger(fiscalYear)) {
    return NextResponse.json({ error: "fiscalYear が整数ではありません。" }, { status: 400 });
  }

  const checks = await listChecks(subsidyId, fiscalYear);
  return NextResponse.json({ store, subsidyId, fiscalYear, checks });
}

/* ───── 書き込み：1件だけ追記する ───── */
export async function POST(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const store = ensureTargetProductStore();
  if (!store.connected) {
    /* 書けない場所へ「受け付けました」と返すと、担当者は入れたつもりになる。
       入っていないことは、その場で言う。 */
    return NextResponse.json(
      {
        error:
          store.reason ??
          "確認記録の保存先に接続できていないため、記録を受け付けられません。",
        store,
      },
      { status: 503 }
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "本文を読めませんでした。" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const s = (k: string): string => (typeof o[k] === "string" ? (o[k] as string).trim() : "");

  const check = {
    subsidyId: s("subsidyId"),
    fiscalYear: Number(o.fiscalYear),
    frame: s("frame"),
    equipKind: s("equipKind"),
    plannedModel: s("plannedModel"),
    officialSource: s("officialSource"),
    checkedOn: s("checkedOn"),
    verdict: s("verdict"),
    checkedBy: s("checkedBy"),
    ...(s("note") ? { note: s("note") } : {}),
  } as TargetProductCheck;

  /* 先に理由を全部集めて返す。1つ直すたびに往復させない。 */
  const bad = validateCheck(check);

  /* 照合キーの検証（2026-09-16 台帳#32）。
     ここで弾くのは「保存はできるが照合で一致しないキー」。
     形の検証（validateCheck）と同じ配列に理由を足して、1往復で全部返す。 */
  const subsidy = getSubsidies().find((x) => x.id === check.subsidyId);
  if (!subsidy) {
    bad.push(
      `制度ID「${check.subsidyId}」は本アプリの制度一覧にありません。この記録は照合で一致しないため受け取れません。`
    );
  } else {
    const key = targetProductKeyOf(subsidy, todayJst());
    if (check.fiscalYear !== key.fiscalYear) {
      /* 制度が年度を宣言している場合（SII 設備単位型／GX設備単位型は令和7年度補正＝2025年度）、
         今日の年度で記録すると照合キーが1年ずれる。期待する年度を返して直させる。 */
      bad.push(
        `年度が照合側と一致しません。この制度（${subsidy.name}）の照合年度は ${key.fiscalYear} 年度です（送られた値: ${check.fiscalYear}）。`
      );
    }
    const frames = framesOf(subsidy);
    if (!frames.includes(check.frame)) {
      bad.push(
        `申請枠「${check.frame}」は、この制度の枠ではありません。選べる枠は ${frames.join("／")} です。`
      );
    }
    if (!(subsidy.target as readonly string[]).includes(check.equipKind)) {
      /* room を ac として記録させない。読み替えて保存すると、
         対象外の設備に「登録済みを確認」が付く。 */
      bad.push(
        `設備群「${check.equipKind}」は、この制度が対象とする設備群（${subsidy.target.join("／")}）ではありません。`
      );
    }
  }

  if (bad.length) {
    return NextResponse.json({ error: "記録が不完全です。", problems: bad }, { status: 400 });
  }

  try {
    await addCheck(check);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存できませんでした。" },
      { status: 500 }
    );
  }

  const checks = await listChecks(check.subsidyId, check.fiscalYear);
  return NextResponse.json({ saved: check, store, count: checks.length });
}
