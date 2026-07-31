import { Tabs, TabsList, TabsTrigger, TabsContent, TabHint, TabGroup } from "@/components/ui/Tabs";
import { HowItWorks } from "@/components/HowItWorks";
import { SubsidyMatcher } from "@/components/SubsidyMatcher";
import { UpdateEstimator } from "@/components/UpdateEstimator";
import { SubsidyDB } from "@/components/SubsidyDB";
import { VendorTable } from "@/components/VendorTable";
import { WeaponList } from "@/components/WeaponList";
import { DiffList } from "@/components/DiffList";
import { DropinDept } from "@/components/DropinDept";
import { BreakerDept } from "@/components/BreakerDept";
import { Target, Database, Wind, TrendingUp, Award, Wrench, AlertCircle, Droplet, Bolt, CalendarClock } from "lucide-react";
import { ProjectProvider } from "@/components/ProjectContext";
import { RoadmapTab } from "@/components/RoadmapTab";
import { DeadlineBanner } from "@/components/DeadlineBanner";
import { DataFreshnessAlert } from "@/components/DataFreshnessAlert";
import { DROPIN_REDUCTION_LABEL } from "@/lib/pricing";
import { REGULATION, freonLawOutlook } from "@/lib/regulations";

const TAB_HINTS: Record<string, string> = {
  match: "設備の情報から使える補助金を自動診断し、実質負担額とROIを試算します。",
  roadmap: "申請から施工・補助金入金までの流れとスケジュールを可視化します。",
  dropin: "既存の業務用空調はそのまま、冷媒だけ交換して電気代と環境負荷を削減します。",
  breaker: "電気の基本料金（契約電力）を見直し、電子ブレーカーで固定費を削減します。",
  db: "国・自治体の補助金を、対象・補助率・締切・申請難易度で一覧比較できます。",
  vendor: "主要メーカーの高効率機種のスペックや特徴を比較します。",
  weapon: "冷媒規制・脱炭素など、商談で使える最新の業界トピックスをまとめています。",
  diff: "競合と比べたEHCグループの強み・差別化ポイントを紹介します。",
};

export default function Page() {
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 print-container">
      <header className="relative overflow-hidden rounded-3xl mb-6 no-print bg-night-900 border border-white/10">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-ehc-600/20 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-cobalt-700/10 blur-3xl"></div>
        {/* 軌道風の細線リング */}
        <div className="absolute -bottom-40 right-10 w-[520px] h-[520px] rounded-full border border-white/5"></div>
        <div className="absolute -bottom-32 right-24 w-[380px] h-[380px] rounded-full border border-dashed border-white/10"></div>
        <div className="relative px-6 py-12 md:px-12 md:py-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-ehc-400 to-ehc-700"></span>
            <span className="text-[11px] tracking-[0.25em] text-slate-300 font-medium uppercase">
              EHC Solutions
            </span>
          </div>
          <h1 className="hero-display text-white text-4xl md:text-6xl mb-5">
            STOP PAYING<br />FOR OLD AIR
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed">
            業務用空調の補助金マッチング & ROI 即答ツール。<br className="hidden md:block" />
            パッケージ・マルチ／炭化水素冷媒ドロップイン更新に特化。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-3 py-1 rounded-full border border-white/15 text-slate-300">補助金 最大3億円</span>
            <span className="px-3 py-1 rounded-full border border-white/15 text-slate-300">高効率機更新 −20〜40%</span>
            <span className="px-3 py-1 rounded-full border border-white/15 text-slate-300">ドロップイン −{DROPIN_REDUCTION_LABEL}</span>
            <span className="px-3 py-1 rounded-full border border-ehc-400/40 text-ehc-200 bg-ehc-600/10">施工実績 22業種</span>
          </div>
        </div>
      </header>

      {/* 着地直後に「何を入れると何が返るか」を伝える常時表示バー。主導線のCTAはここ1本に集約。 */}
      <HowItWorks />

      <DeadlineBanner />
      <DataFreshnessAlert />

      <div className="bg-cobalt-600/10 border border-cobalt-500/30 px-4 py-3 rounded-xl text-xs mb-5 flex items-start gap-2.5 no-print">
        <AlertCircle className="w-4 h-4 text-cobalt-300 flex-shrink-0 mt-0.5" />
        <div className="text-slate-300">
          <strong className="text-white">⏰ 規制カウントダウン：</strong>
          フロン排出抑制法 改正案 <strong className="text-white">{freonLawOutlook().label}</strong>（罰則強化検討中）／
          R410A 製造規制：既に{REGULATION.r410aPhaseOutYear}年完了 / 業務用エアコン 法定耐用年数：
          <strong className="text-white">{REGULATION.legalUsefulLifeYears}年</strong>
        </div>
      </div>

      <ProjectProvider>
      <Tabs defaultValue="match">
        <TabsList>
          {/* 「提案をつくる」側と「調べる」側を2段に分けるだけ。折りたたまないのでクリック数は不変。 */}
          <TabGroup label="まず使う">
            <TabsTrigger value="match" icon={<Target className="w-4 h-4" />} hint={TAB_HINTS.match}>空調更新＋補助金マッチング</TabsTrigger>
            <TabsTrigger value="roadmap" icon={<CalendarClock className="w-4 h-4" />} hint={TAB_HINTS.roadmap}>導入ロードマップ</TabsTrigger>
            <TabsTrigger value="dropin" icon={<Droplet className="w-4 h-4" />} hint={TAB_HINTS.dropin}>ドロップイン</TabsTrigger>
            <TabsTrigger value="breaker" icon={<Bolt className="w-4 h-4" />} hint={TAB_HINTS.breaker}>電子ブレーカー</TabsTrigger>
          </TabGroup>
          <TabGroup label="調べる">
            <TabsTrigger value="db" icon={<Database className="w-4 h-4" />} hint={TAB_HINTS.db}>補助金DB</TabsTrigger>
            <TabsTrigger value="vendor" icon={<Wind className="w-4 h-4" />} hint={TAB_HINTS.vendor}>メーカー機器</TabsTrigger>
            <TabsTrigger value="weapon" icon={<TrendingUp className="w-4 h-4" />} hint={TAB_HINTS.weapon}>業界トピックス</TabsTrigger>
            <TabsTrigger value="diff" icon={<Award className="w-4 h-4" />} hint={TAB_HINTS.diff}>EHCの強み</TabsTrigger>
          </TabGroup>
        </TabsList>
        <TabHint hints={TAB_HINTS} />
        <TabsContent value="match">
          <SubsidyMatcher />
          {/* 更新工事の明細つき概算（高所作業車・設置階=足場判定・価格帯補正はここで入力） */}
          <div className="mt-5 no-print"><UpdateEstimator /></div>
        </TabsContent>
        <TabsContent value="roadmap"><RoadmapTab /></TabsContent>
        <TabsContent value="dropin"><DropinDept /></TabsContent>
        <TabsContent value="breaker"><BreakerDept /></TabsContent>
        <TabsContent value="db"><SubsidyDB /></TabsContent>
        <TabsContent value="vendor"><VendorTable /></TabsContent>
        <TabsContent value="weapon"><WeaponList /></TabsContent>
        <TabsContent value="diff"><DiffList /></TabsContent>
      </Tabs>
      </ProjectProvider>

      <footer className="text-center text-[11px] text-slate-500 mt-10 py-4 no-print border-t border-white/5">
        © 2026 株式会社EHCソリューションズ ｜ 業務用空調・GX・補助金専門
      </footer>
    </div>
  );
}
