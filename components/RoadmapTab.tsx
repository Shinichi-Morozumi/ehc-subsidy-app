"use client";
import { Card, CardTitle } from "./ui/Card";
import { useProject } from "./ProjectContext";
import { RoadmapView } from "./RoadmapView";
import { Map, ArrowLeft } from "lucide-react";

export function RoadmapTab() {
  const { input, result } = useProject();
  if (!input || !result) {
    return (
      <Card>
        <CardTitle icon={<Map className="w-5 h-5" />}>導入ロードマップ</CardTitle>
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          先に「補助金マッチング」タブで案件情報を入力し「即答」を押すと、ここに申請〜入金・工事タイムラインと年次の段階更新プランが表示されます。
        </div>
      </Card>
    );
  }
  return <RoadmapView input={input} result={result} />;
}
