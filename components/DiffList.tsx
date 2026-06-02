import { Card, CardTitle } from "./ui/Card";
import { DIFFS } from "@/lib/diffs";
import { Award, ShieldCheck } from "lucide-react";

export function DiffList() {
  return (
    <Card>
      <CardTitle icon={<Award className="w-5 h-5" />}>EHC の強み</CardTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DIFFS.map((d, i) => (
          <div
            key={i}
            className="bg-gradient-to-br from-sky-500/10 to-night-900 border border-sky-500/20 p-4 rounded-xl text-xs hover:shadow-card transition-shadow"
          >
            <div className="flex items-start gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <strong className="text-sky-300 text-sm">{d.title}</strong>
            </div>
            <p className="text-slate-300 leading-relaxed pl-6">{d.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
