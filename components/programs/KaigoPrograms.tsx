"use client";

/* v1 / 2026-10-29 / EHC-0102 /kaigo のチャットの下に置く「国の交付金」の制度カード。
   相談の入口は上のチャット（7つの質問）のまま。カードの「この制度で相談する」はチャットへ戻す。
   東京都の施設には、都の補助（/tokyo）も案内する。 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProgramsBoard } from "./ProgramsBoard";

export function KaigoPrograms({ initialToday }: { initialToday: string }) {
  return (
    <section aria-labelledby="kaigo-programs" className="mt-12">
      <h2 id="kaigo-programs" className="text-[22px] font-bold leading-[1.45]">国の交付金の中身（制度カード）</h2>
      <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">
        何に使えるか・対象・要件・いつ・流れ・結局いくらを1枚にまとめました。「結局いくら」は工事費1,000万円の場合の例です。施設ごとの目安は、上のチャットのあとに担当からお伝えします。
      </p>
      <div className="mt-4">
        <ProgramsBoard
          ids={["kokuKaigo", "kokuKaigo30"]}
          initialToday={initialToday}
          source="kaigo"
          withForm={false}
          showCheckCta={false}
          columns={1}
          onConsultInstead={() => document.getElementById("kaigo-chat")?.scrollIntoView({ block: "start", behavior: "smooth" })}
        />
      </div>
      <Link href="/tokyo?from=kaigo" className="mt-6 flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border-2 border-[#2E7D52] bg-white px-4 py-3 text-[16px] font-bold text-[#22603F]">
        <span>東京都の施設は、都の補助もあります（特養・養護の改修費 3/4、ゼロエミ など）</span>
        <ArrowRight aria-hidden className="h-5 w-5 shrink-0" />
      </Link>
    </section>
  );
}
