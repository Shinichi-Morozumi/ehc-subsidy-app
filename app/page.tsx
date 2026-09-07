import { HowItWorks } from "@/components/HowItWorks";
import { SubsidyMatcher } from "@/components/SubsidyMatcher";
import { ProjectProvider } from "@/components/ProjectContext";
import { ShieldCheck } from "lucide-react";

export default function Page() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 print-container">
      <header className="relative overflow-hidden rounded-3xl mb-5 no-print bg-night-900 border border-white/10">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-ehc-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-cobalt-700/10 blur-3xl" />
        <div className="relative px-6 py-10 md:px-12 md:py-14">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-ehc-400 to-ehc-700" />
            <span className="text-xs tracking-[0.18em] text-slate-300 font-medium">EHC SOLUTIONS</span>
          </div>
          <h1 className="font-display text-white text-3xl md:text-5xl font-black leading-tight tracking-tight max-w-3xl">
            空調更新で使える可能性のある<br className="hidden md:block" />補助金・助成金と期限を確認
          </h1>
          <p className="mt-4 text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
            更新時期・所在地・事業規模から、候補制度と「今から何をすべきか」を匿名で整理します。
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-ehc-300" />
            公式一次情報の確認範囲を表示・採択や受給は保証しません
          </div>
        </div>
      </header>

      <HowItWorks />

      <ProjectProvider>
        <SubsidyMatcher />
      </ProjectProvider>

      <footer className="text-center text-xs text-slate-500 mt-10 py-4 no-print border-t border-white/5">
        © 2026 株式会社EHCソリューションズ ｜ 業務用空調・補助金マッチング
      </footer>
    </div>
  );
}
