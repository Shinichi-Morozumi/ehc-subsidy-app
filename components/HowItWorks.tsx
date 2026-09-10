"use client";

import { ClipboardList, SearchCheck, FileText } from "lucide-react";

/* 着地直後に「何を入れると、何が返ってくるか」を3秒で伝える常時表示バー。
   ツアーUI（コーチマーク）は文言が腐る・客先で毎回出る/一度も出ないのどちらかで事故るため採用しない。
   主導線はこのバーのCTA1本に集約し、サンプル／直接入力はテキストリンクへ格下げする。 */

const STEPS = [
  {
    icon: ClipboardList,
    n: "1",
    title: "更新時期と所在地を入力",
    body: "期限に関わる質問から開始。細かな空調仕様は後で補完できます。",
  },
  {
    icon: SearchCheck,
    n: "2",
    title: "候補制度と期限を確認",
    body: "申請可能性・条件確認・対象外に分け、次に何をするかを表示します。",
  },
  {
    icon: FileText,
    n: "3",
    title: "同意後に診断書PDFを発行",
    body: "匿名結果を先に確認し、希望する場合だけ宛名入りPDF・相談へ進めます。",
  },
];

// 画面内のガイド診断コンポーネントを開くイベント名
export const OPEN_HEARING_EVENT = "ehc:open-hearing";

export function HowItWorks() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="no-print mb-5 rounded-3xl border border-ink-line bg-paper-card p-5 md:p-6">
      <h2 className="text-sm md:text-base font-bold text-ink mb-1">
        空調更新に使える制度と期限を、3分で確認
      </h2>
      <p className="text-xs text-ink-soft mb-4">
        個人情報なしで候補を確認できます。採択・受給を保証する診断ではありません。
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_HEARING_EVENT))}
          /* 2026-09-10 EHC-0032 LIGHT-01
             メインページ（HomeV17）の CTA と同じ形・同じ色にする。
               .ehc17 .primary{background:var(--yellow)=#d6ee86;color:var(--ink);border:0;box-shadow:none}
               .ehc17 .primary{border-radius:100px}  .primary:hover{background:#c6e377;transform:translateY(-2px)}
             ここはユーザーが直前に押したボタンと**同じボタン**なので、
             緑グラデーション＋発光ではなくライムの丸ボタンに揃える。
             こうしないと「押したボタンが別の色に変わった」ように見える。 */
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-brand-lime text-ink font-bold text-sm hover:bg-[#c6e377] hover:-translate-y-0.5 transition-all active:translate-y-0"
        >
          <ClipboardList className="w-4 h-4" />
          3分で診断を始める
        </button>
        <button type="button" onClick={() => scrollTo("project-info-section")} className="min-h-[44px] inline-flex items-center text-xs text-ink-soft underline underline-offset-2 hover:text-ink">詳しい設備情報を直接入力する</button>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              /* 2026-09-10 EHC-0032 LIGHT-01
                 手順カードは HomeV17 の淡いセージ面（.result-summary の #e8f0d9 系）。
                 白いカードの中に白い枠を置くと段差が出ないので、面の色で1段だけ沈める。
                 番号の丸は HomeV17 の .stamp（#d7e7ae のライム地＋インク文字）に合わせる。
                 白抜き文字の濃い丸にすると、3つ並んだときに点が強すぎて本文より先に目が行く。 */
              className="relative rounded-2xl border border-ink-line bg-paper-tint p-4"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#d7e7ae] text-ink text-xs font-black flex-shrink-0">
                  {s.n}
                </span>
                <Icon className="w-4 h-4 text-brand flex-shrink-0" />
                <span className="text-[13px] font-bold text-ink leading-tight">{s.title}</span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">{s.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
