import { Card, CardTitle } from "./ui/Card";
import { WEAPONS } from "@/lib/weapons";
import { TrendingUp, Zap } from "lucide-react";

export function WeaponList() {
  return (
    <Card>
      <CardTitle icon={<TrendingUp className="w-5 h-5" />}>
        業界トピックス & 更新メリット
      </CardTitle>
      <div className="space-y-3">
        {WEAPONS.map((w, i) => (
          <div
            key={i}
            className="bg-gradient-to-r from-amber-50 to-white border border-amber-100 px-4 py-3.5 rounded-xl text-sm hover:shadow-card transition-shadow"
          >
            <div className="font-bold text-amber-800 mb-1.5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
              {w.title}
            </div>
            <div
              className="text-slate-700 text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: w.body }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
