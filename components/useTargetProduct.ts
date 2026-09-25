"use client";

/* ───────────────────────────────────────────────────────────
   対象製品の照合結果をサーバへ問い合わせる（EHC-0039 v2 §2 / 2026-09-16 v1）

   ■ この hook が判定しないこと
   　　「登録されているか」をここで決めない。決めるのはサーバ
   　　（app/api/target-product → lib/targetProduct.ts の保存先）だけ。
   　　ここは送って受け取るだけで、結果を加工もしない。

   ■ 問い合わせない場合に空オブジェクトを返さない
   　　導入予定機器を1台も足していない間は undefined を返す。
   　　空の `{}` を返すと lib/eligibility.ts は
   　　「問い合わせた結果すべて未確認」として扱い、
   　　受入テストが直接渡す targetProductChecked が効かなくなる。
   　　「まだ聞いていない」と「聞いた結果ゼロ」を混ぜないこと
   　　（AGENTS §2-5）。

   ■ 失敗したときに「確認済み」へ倒さない
   　　通信失敗は未確認であって、対象製品に登録されている根拠ではない。
   　　error を持って画面に出し、checks は返さない。
   ─────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannedUnit, TargetProductApiResponse } from "@/lib/targetProduct";

export interface TargetProductQuery {
  /** サーバが返した照合結果。未問い合わせ・失敗時は undefined */
  data: TargetProductApiResponse | undefined;
  loading: boolean;
  /** 失敗の理由（画面にそのまま出す）。成功時は null */
  error: string | null;
}

export function useTargetProduct(plans: PlannedUnit[]): TargetProductQuery {
  const [data, setData] = useState<TargetProductApiResponse | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 送る内容だけを鍵にする。配列の同一性で再取得すると、
     親が再描画するたびに毎回叩きにいく。 */
  const key = useMemo(
    () =>
      JSON.stringify(
        plans.map((p) => ({ id: p.id, equipKind: p.equipKind, model: p.model, maker: p.maker }))
      ),
    [plans]
  );

  /* 応答が前後した場合に古い結果で新しい結果を上書きしないための番号。 */
  const seq = useRef(0);

  useEffect(() => {
    const parsed = JSON.parse(key) as PlannedUnit[];
    if (parsed.length === 0) {
      setData(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch("/api/target-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans: parsed }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as TargetProductApiResponse;
      })
      .then((json) => {
        if (!alive || mine !== seq.current) return;
        setData(json);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive || mine !== seq.current) return;
        /* 失敗を「確認済み」にしない。前回の結果も捨てる
           （古い結果を新しい入力の根拠として残さない）。 */
        setData(undefined);
        setError(
          `対象製品の照合結果を取得できませんでした（${
            e instanceof Error ? e.message : "原因不明"
          }）。未確認として扱っています。`
        );
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  return { data, loading, error };
}
