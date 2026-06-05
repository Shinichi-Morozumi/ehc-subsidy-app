"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { GroupResult } from "@/lib/match";

const COLORS = ["#2d4295", "#3d54aa", "#5a72c5", "#7f95d9", "#aebde9", "#d7def4"];

// 設備グループ別の年間電気代削減額（横棒）。古い/旧冷媒の群が大きく出る
export function GroupSavingsChart({ groups }: { groups: GroupResult[] }) {
  const data = groups.map((g, i) => ({
    name: `${g.refri.toUpperCase()}・${g.units}台(${g.installYear})`,
    万円: Math.round(g.saveYenPerYear / 10000),
    pct: Math.round(g.effectiveReductionRate * 100),
    color: COLORS[i % COLORS.length],
  }));
  return (
    <div className="w-full" style={{ height: Math.max(160, data.length * 52 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v}万`} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#cbd5e1" }} />
          <Tooltip
            formatter={(v: number, _n, p: any) => [`¥${(v * 10000).toLocaleString("ja-JP")}/年（実効${p.payload.pct}%）`, "年間削減"]}
            contentStyle={{ background: "#131313", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12, color: "#fff" }}
          />
          <Bar dataKey="万円" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
