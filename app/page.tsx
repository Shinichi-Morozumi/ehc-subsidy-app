import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { SubsidyMatcher } from "@/components/SubsidyMatcher";
import { SubsidyDB } from "@/components/SubsidyDB";
import { VendorTable } from "@/components/VendorTable";
import { WeaponList } from "@/components/WeaponList";
import { DiffList } from "@/components/DiffList";

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="bg-gradient-to-br from-ehc-primary to-ehc-accent text-white p-6 rounded-xl mb-6">
        <h1 className="text-xl font-bold mb-1">
          EHC 補助金マッチング & ROI 即答ツール
          <span className="ml-2 text-[11px] bg-white/20 px-2 py-0.5 rounded">v1.0</span>
        </h1>
        <div className="text-xs opacity-90">業務用空調（パッケージ・マルチ）／ドロップイン更新工事 専用</div>
      </header>

      <div className="bg-ehc-light text-ehc-primary p-3 px-3.5 rounded-md text-xs mb-3.5 font-medium">
        ⚙️ <strong>このツールの対象範囲：</strong>業務用空調（パッケージエアコン・ビル用マルチ）の更新／ドロップイン工事のみ。
        冷凍冷蔵系（チラー・業務用冷凍冷蔵庫・ショーケース等）は別途お問い合わせください。
      </div>

      <div className="bg-ehc-warm border-l-4 border-orange-500 p-3 px-4 rounded-lg mb-5 text-xs">
        <strong className="text-ehc-warning">⏰ 規制カウントダウン</strong>
        フロン排出抑制法 改正案 国会提出予定: <strong>2027年</strong>（罰則強化検討中）／
        R410A 製造規制: 既に2025年完了 / 業務用エアコン 法定耐用年数: <strong>15年</strong>
      </div>

      <Tabs defaultValue="match">
        <TabsList>
          <TabsTrigger value="match">① 補助金マッチング</TabsTrigger>
          <TabsTrigger value="db">② 補助金DB</TabsTrigger>
          <TabsTrigger value="vendor">③ メーカー機器</TabsTrigger>
          <TabsTrigger value="weapon">④ 営業武器</TabsTrigger>
          <TabsTrigger value="diff">⑤ 競合差別化</TabsTrigger>
        </TabsList>
        <TabsContent value="match"><SubsidyMatcher /></TabsContent>
        <TabsContent value="db"><SubsidyDB /></TabsContent>
        <TabsContent value="vendor"><VendorTable /></TabsContent>
        <TabsContent value="weapon"><WeaponList /></TabsContent>
        <TabsContent value="diff"><DiffList /></TabsContent>
      </Tabs>

      <footer className="text-center text-[11px] text-gray-500 mt-8 py-4">
        © 2026 株式会社EHCソリューションズ ｜ 業務用空調・GX・補助金専門
      </footer>
    </div>
  );
}
