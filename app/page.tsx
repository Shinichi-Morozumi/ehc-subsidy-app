import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { SubsidyMatcher } from "@/components/SubsidyMatcher";
import { SubsidyDB } from "@/components/SubsidyDB";
import { VendorTable } from "@/components/VendorTable";
import { WeaponList } from "@/components/WeaponList";
import { DiffList } from "@/components/DiffList";
import { DropinDept } from "@/components/DropinDept";
import { BreakerDept } from "@/components/BreakerDept";
import { Target, Database, Wind, TrendingUp, Award, Wrench, AlertCircle, Droplet, Bolt } from "lucide-react";

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 print-container">
      <header className="bg-gradient-to-br from-ehc-900 via-ehc-700 to-ehc-600 text-white px-6 py-8 md:px-10 md:py-10 rounded-2xl mb-6 shadow-lift no-print relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-300/10 rounded-full -ml-24 -mb-24"></div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-5 h-5 text-emerald-200" />
            <span className="text-xs text-emerald-100 font-medium tracking-wide">
              株式会社EHCソリューションズ
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight">
            補助金マッチング & ROI 即答ツール
          </h1>
          <div className="text-sm text-emerald-100">
            業務用空調（パッケージ・マルチ）／ドロップイン更新工事 専用
          </div>
        </div>
      </header>

      <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-xl text-xs mb-4 flex items-start gap-2.5 no-print">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-amber-900">
          <strong>⏰ 規制カウントダウン：</strong>
          フロン排出抑制法 改正案 国会提出予定 <strong>2027年</strong>（罰則強化検討中）／
          R410A 製造規制：既に2025年完了 / 業務用エアコン 法定耐用年数：<strong>15年</strong>
        </div>
      </div>

      <Tabs defaultValue="match">
        <TabsList>
          <TabsTrigger value="match" icon={<Target className="w-4 h-4" />}>補助金マッチング</TabsTrigger>
          <TabsTrigger value="dropin" icon={<Droplet className="w-4 h-4" />}>ドロップイン</TabsTrigger>
          <TabsTrigger value="breaker" icon={<Bolt className="w-4 h-4" />}>電子ブレーカー</TabsTrigger>
          <TabsTrigger value="db" icon={<Database className="w-4 h-4" />}>補助金DB</TabsTrigger>
          <TabsTrigger value="vendor" icon={<Wind className="w-4 h-4" />}>メーカー機器</TabsTrigger>
          <TabsTrigger value="weapon" icon={<TrendingUp className="w-4 h-4" />}>業界トピックス</TabsTrigger>
          <TabsTrigger value="diff" icon={<Award className="w-4 h-4" />}>EHCの強み</TabsTrigger>
        </TabsList>
        <TabsContent value="match"><SubsidyMatcher /></TabsContent>
        <TabsContent value="dropin"><DropinDept /></TabsContent>
        <TabsContent value="breaker"><BreakerDept /></TabsContent>
        <TabsContent value="db"><SubsidyDB /></TabsContent>
        <TabsContent value="vendor"><VendorTable /></TabsContent>
        <TabsContent value="weapon"><WeaponList /></TabsContent>
        <TabsContent value="diff"><DiffList /></TabsContent>
      </Tabs>

      <footer className="text-center text-[11px] text-slate-500 mt-10 py-4 no-print">
        © 2026 株式会社EHCソリューションズ ｜ 業務用空調・GX・補助金専門
      </footer>
    </div>
  );
}
