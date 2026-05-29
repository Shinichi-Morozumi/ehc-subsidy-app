import { Card, CardTitle } from "./ui/Card";
import { DIFFS } from "@/lib/diffs";

export function DiffList() {
  return (
    <Card>
      <CardTitle>EHC vs 競合 差別化ポイント</CardTitle>
      <div className="space-y-2">
        {DIFFS.map((d, i) => (
          <div key={i} className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded text-xs">
            <strong className="text-blue-600">{d.title}</strong>
            <br />
            {d.body}
          </div>
        ))}
      </div>
    </Card>
  );
}
