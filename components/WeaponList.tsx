import { Card, CardTitle } from "./ui/Card";
import { WEAPONS } from "@/lib/weapons";

export function WeaponList() {
  return (
    <Card>
      <CardTitle>営業武器集（法律・値上がり・老朽化）</CardTitle>
      <div className="space-y-2.5">
        {WEAPONS.map((w, i) => (
          <div key={i} className="bg-red-50 border-l-4 border-ehc-danger px-3.5 py-3 rounded text-sm">
            <div className="font-bold text-ehc-danger mb-1">⚡ {w.title}</div>
            <div>{w.body}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
