"use client";

/* v1 / 2026-10-29 / EHC-0102 補助を使わない選択肢（ドロップイン）のカード。
   工事が「冷媒だけ入れ替える」「まだ決めていない」のときに、制度カードと並べて出す。
   ドロップインを補助の対象のように見せない。効果の数字（削減率など）はここに書かない（根拠の出し方が決まるまで）。 */

import Image from "next/image";
import Link from "next/link";
import { track } from "@/lib/track";

export function DropinCard({ onConsult }: { onConsult: () => void }) {
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-ink-line bg-white" aria-labelledby="card-dropin">
      <header className="relative bg-paper-tint px-5 pb-5 pt-4">
        <p className="text-[13px] font-bold text-brand-deep">補助を使わない選択肢</p>
        <h3 id="card-dropin" className="mt-1 pr-[84px] text-[22px] font-bold leading-[1.4]">冷媒だけの入れ替え（ドロップイン）</h3>
        <span className="absolute right-3 top-3 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white">
          <Image src="/programs/ac.webp" alt="" width={64} height={64} className="h-16 w-16" />
        </span>
      </header>
      <div className="space-y-3 px-5 py-5 text-[16px] leading-[1.8] text-ink">
        <p>今の空調の機器を活かして、冷媒だけを入れ替える方法です。</p>
        <ul className="space-y-1">
          <li className="flex gap-2"><span aria-hidden className="text-brand">●</span>国・都の多くの補助は、冷媒だけの入れ替えを対象外としている見込みです。</li>
          <li className="flex gap-2"><span aria-hidden className="text-brand">●</span>補助を使わない分、交付決定を待たずに進められます。</li>
          <li className="flex gap-2"><span aria-hidden className="text-brand">●</span>機器を入れ替えるか、冷媒だけにするかは、現地で機器の状態を見てご提案します。</li>
        </ul>
        <button
          type="button"
          onClick={() => { track("card_consult", { program: "dropin", place: "shindan" }); onConsult(); }}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-brand-deep bg-white px-4 text-[16px] font-bold text-brand-deep"
        >
          入れ替えと比べて相談する
        </button>
        <Link href="/dropin" className="flex min-h-[44px] items-center justify-center text-[15px] font-bold text-brand-deep underline underline-offset-4">ドロップインの実測の例・費用の目安を見る</Link>
      </div>
    </article>
  );
}
