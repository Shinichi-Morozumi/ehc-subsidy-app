import type { Metadata } from "next";
import { todayJst } from "@/lib/programClock";
import { ProgramCheck } from "@/components/programs/ProgramCheck";
import { SiteFooterSimple, SiteHeader } from "@/components/programs/SiteShell";
import { ReferralCapture } from "@/components/programs/ReferralCapture";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 6問の診断 → 制度カード（締切の近い順・結局いくら）→ 3項目の相談
   今日の日付で残り日数を出すので、1時間ごとに作り直す（開いた端末でも取り直す：lib/useToday.ts）。
   ─────────────────────────────────────────────────────────── */

export const revalidate = 3600;

const TITLE = "使える補助金を調べる（空調・設備の入れ替え／東京都・介護施設・国の省エネ）";
const DESCRIPTION =
  "所在地・施設の種類・定員・法人・工事の内容・工事費の目安に答えると、使えそうな補助金を締切の近い順に。補助率・上限・自己負担の目安・流れを1枚のカードで。株式会社EHCソリューションズ。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/shindan" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "ja_JP", url: "/shindan", images: [{ url: "/og.jpg" }] },
};

export default function ShindanPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <ReferralCapture pathname="/shindan" />
      <SiteHeader page="shindan" />
      <main className="mx-auto max-w-5xl px-4 pb-6 pt-5">
        <ProgramCheck initialToday={todayJst()} />
      </main>
      <SiteFooterSimple />
    </div>
  );
}
