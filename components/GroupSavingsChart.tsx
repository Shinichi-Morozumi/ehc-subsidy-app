"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { GroupResult } from "@/lib/match";

/* ───────── 2026-09-11 EHC-0038 第2便 4-G / 4-C ─────────
   ライト化にあたって2点変えた。

   1) 配色（4-G）
      軸・グリッド・ツールチップが #2a2a2a / #131313 / #fff の黒地前提で、
      白い紙の上では目盛が真っ黒な線、ツールチップが黒い箱になっていた。
      画面トークン（ink / ink-soft / ink-line / brand）と同じ値に合わせる。
      Tailwind のクラスは recharts の内部SVGに効かないので、
      ここだけは色を直値で持つ。値は tailwind.config.ts と同一。

   2) 棒の色分けをやめた（4-C）
      変更前は6段の青を順番に割り当てていた。しかしこのグラフは
      Y軸に「R22・3台(2009)」という名前が出ているので、
      色は何も区別していない（名前で既に区別できている）。
      意味を持たない6色は、
        ・白黒印刷すると淡い3色が背景と混ざって棒が消える
        ・「薄い青は何か弱い群なのか」と読み手に余計な推測をさせる
      ので害だけが残る。棒は brand 1色にし、代わりに
      各棒の右端へ金額そのものを出す。色を読めなくても値が読める。
   ─────────────────────────────────────────────────────── */
const AXIS_INK = "#57685e";   // ink-soft
const GRID_INK = "#d4ddd4";   // ink-line
const BAR_FILL = "#286644";   // brand
const CARD_BG = "#ffffff";    // paper-card
const TEXT_INK = "#193e33";   // ink

// 設備グループ別の年間電気代削減額（横棒）。古い/旧冷媒の群が大きく出る
export function GroupSavingsChart({ groups }: { groups: GroupResult[] }) {
  const data = groups.map((g) => ({
    name: `${g.refri.toUpperCase()}・${g.units}台(${g.installYear})`,
    万円: Math.round(g.saveYenPerYear / 10000),
    pct: Math.round(g.effectiveReductionRate * 100),
  }));
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 52 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_INK} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: AXIS_INK }} tickFormatter={(v) => `${v}万`} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: AXIS_INK }} />
          <Tooltip
            formatter={(v: number, _n, p: any) => [`¥${(v * 10000).toLocaleString("ja-JP")}/年（実効${p.payload.pct}%）`, "年間削減"]}
            contentStyle={{ background: CARD_BG, border: `1px solid ${GRID_INK}`, borderRadius: 8, fontSize: 12, color: TEXT_INK }}
          />
          <Bar dataKey="万円" radius={[0, 4, 4, 0]} fill={BAR_FILL}>
            {/* 4-C: 色ではなく数字で読ませる。白黒印刷でも値が落ちない */}
            <LabelList
              dataKey="万円"
              position="right"
              formatter={(v: number) => `${v}万円`}
              style={{ fontSize: 12, fill: TEXT_INK, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
