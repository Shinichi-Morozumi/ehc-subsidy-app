"use client";

import { useEffect, useState } from "react";
import { DesiredTiming, EntityType, MatchInput, SizeType, UpdatePlan } from "@/lib/types";
import { OPEN_HEARING_EVENT } from "./HowItWorks";
import { ArrowLeft, Check, ClipboardList, Sparkles, X } from "lucide-react";
import { useModalA11y } from "./ui/useModalA11y";

const PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];
const BUILDINGS = [
  ["office", "オフィス・事務所"], ["retail", "小売店舗"], ["restaurant", "飲食店"],
  ["hotel", "ホテル・宿泊"], ["medical", "医療・福祉"], ["school", "学校・教育"], ["other", "その他事業所"],
] as const;
const TOTAL_STEPS = 7;

export function GuidedDiagnosis({ input, setInput, onComplete }: {
  input: MatchInput;
  setInput: React.Dispatch<React.SetStateAction<MatchInput>>;
  onComplete: (checkEligibility?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [assist, setAssist] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = () => { setStep(0); setAssist(null); setOpen(true); };
    window.addEventListener(OPEN_HEARING_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HEARING_EVENT, onOpen);
  }, []);

  const update = <K extends keyof MatchInput>(key: K, value: MatchInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));
  const next = () => { setAssist(null); setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)); };
  const choose = (fn: () => void) => { fn(); next(); };
  const handleAssist = (message: string, fn: () => void) => {
    fn();
    setAssist(message);
    window.setTimeout(() => { setAssist(null); setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)); }, 550);
  };
  const finish = () => { setOpen(false); window.setTimeout(() => onComplete(false), 0); };

  /* 2026-08-24 監査での修正: role="dialog" は付いていたが、Escape で閉じられず、
     Tab がモーダルの外（背後のフォーム）へ抜けていた。開閉フラグで持つ画面なので
     enabled に open を渡し、閉じている間は body のスクロール固定をしない。 */
  const panelRef = useModalA11y(() => setOpen(false), open);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print">
      {/* 2026-09-10 EHC-0032 LIGHT-01
          背面の覆いは黒75%だった。紙面の上で真っ黒を敷くと、ページが消えて
          「別の画面へ飛んだ」ように見える。インク色の45%にして、
          後ろに元のページがあることが分かる程度に留める。 */}
      <div className="absolute inset-0 bg-ink/45" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-diagnosis-title"
        tabIndex={-1}
        className="relative w-full sm:max-w-xl min-h-[72vh] sm:min-h-0 sm:h-[620px] max-h-[92vh] rounded-t-3xl sm:rounded-3xl border border-ink-line bg-paper-card shadow-lift overflow-hidden flex flex-col focus:outline-none"
      >
        <header className="px-5 py-4 border-b border-ink-line flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" aria-hidden="true" /></div>
          <div className="flex-1"><h2 id="guided-diagnosis-title" className="text-sm font-bold text-ink">3分で制度マッチング</h2><p className="text-xs text-ink-soft">期限に関わる質問から確認。空調仕様は後で補完できます</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-ink-soft hover:text-ink"><X className="w-5 h-5" /></button>
        </header>
        {/* 2026-09-10 EHC-0032 LIGHT-01: 進捗バーは HomeV17 の .progress span.done と同じオリーブ(#7b9c4a)。
            溝は ink-line。グラデーションは使わない（白地では2色に割れて見えるだけ）。 */}
        <div className="px-5 pt-4"><div className="flex items-center justify-between text-xs text-ink-soft mb-2"><span>質問 {step + 1} / {TOTAL_STEPS}</span><span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span></div><div className="h-1.5 rounded-full bg-ink-line overflow-hidden"><div className="h-full bg-brand-olive transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} /></div></div>
        <main className="flex-1 overflow-y-auto px-5 py-6">
          {/* 自動補完のお知らせ。青(cobalt)をやめて紙面のセージに寄せる。
              これは警告ではないので amber は使わない（amber は未算定・未確認の予約色）。 */}
          {assist ? <div className="mb-4 rounded-xl border border-ink-line bg-paper-tint p-3 text-xs text-ink flex items-start gap-2"><Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand" /> {assist}</div> : null}
          <Question step={step} input={input} choose={choose} next={next} update={update} handleAssist={handleAssist} finish={finish} />
        </main>
        <footer className="px-5 py-3 border-t border-ink-line flex items-center justify-between"><button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="min-h-[44px] inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink disabled:opacity-30"><ArrowLeft className="w-4 h-4" /> 戻る</button><button type="button" onClick={() => setOpen(false)} className="min-h-[44px] inline-flex items-center text-xs text-ink-soft hover:text-ink">保存して閉じる</button></footer>
      </div>
    </div>
  );
}

function Question({ step, input, choose, next, update, handleAssist, finish }: {
  step: number; input: MatchInput; choose: (fn: () => void) => void; next: () => void;
  update: <K extends keyof MatchInput>(key: K, value: MatchInput[K]) => void;
  handleAssist: (message: string, fn: () => void) => void; finish: () => void;
}) {
  const heading = (title: string, help: string) => <div className="mb-5"><h3 className="text-xl font-bold text-ink leading-snug">{title}</h3><p className="text-xs text-ink-soft mt-2 leading-relaxed">{help}</p></div>;
  /* 2026-09-10 EHC-0032 LIGHT-01
     選択肢を HomeV17 の .option / .equipment-choice に合わせる。
       未選択: border:1.5px solid #859f8c / 背景白
       選択中: border-color:var(--green) + box-shadow:0 0 0 1px var(--green) + background:#edf6e8
     選択中だけ枠を2pxに太くすると 0.5px ぶん中身がずれて、押した瞬間に文字が動く。
     HomeV17 は枠の太さを変えず「同色の1pxリングを外に足す」ことで濃さを出しているので、
     ここも ring-1 で同じ手を使う（Tailwind の ring は外側に描かれるのでレイアウトが動かない）。 */
  const button = (label: string, action: () => void, active = false) => <button key={label} type="button" onClick={() => choose(action)} className={`w-full text-left rounded-xl border-[1.5px] px-4 py-3.5 text-sm font-semibold transition-colors ${active ? "border-brand ring-1 ring-brand bg-[#edf6e8] text-ink" : "border-[#859f8c] bg-paper-card text-ink hover:border-brand hover:bg-[#f0f6df]"}`}>{label}</button>;

  if (step === 0) return <>{heading("業務用空調の更新予定はありますか？", "制度は契約・発注前の申請が必要な場合があります。予定の確度から確認します。")}<div className="space-y-2">{([ ["planned", "更新する予定がある"], ["considering", "更新を検討している"], ["none", "まだ予定はない"] ] as [UpdatePlan, string][]).map(([v, label]) => button(label, () => { update("updatePlan", v); update("interest", "subsidy"); }, input.updatePlan === v))}</div></>;
  if (step === 1) return <>{heading("いつ頃、更新したいですか？", "受付期限と申請準備に間に合う可能性を先に判定します。")}<div className="space-y-2">{([ ["within_1m", "1か月以内"], ["within_3m", "3か月以内"], ["within_6m", "6か月以内"], ["within_12m", "1年以内"], ["undecided", "まだ決めていない"] ] as [DesiredTiming, string][]).map(([v, label]) => button(label, () => update("desiredTiming", v), input.desiredTiming === v))}</div></>;
  if (step === 2) return <>{heading("設備がある都道府県は？", "国の制度に加えて、自治体の制度を照合します。")}<SelectAnswer value={input.pref} options={PREFS} placeholder="選択してください（未選択のままでも進めます）" onChange={(v) => update("pref", v)} onNext={next} /></>;
  if (step === 3) return <>{heading("事業者区分を教えてください", "法人・個人事業主の区分は制度要件の確認に使います。")}<div className="space-y-2">{([ ["corporation", "法人・団体"], ["sole_proprietor", "個人事業主"] ] as [EntityType, string][]).map(([v, label]) => button(label, () => { update("entityType", v); update("bizType", "business"); update("customerKind", v === "sole_proprietor" ? "individual" : "company"); }, input.entityType === v))}</div></>;
  if (step === 4) return <>{heading("事業規模を教えてください", "資本金・従業員数による最終判定は、候補表示後に確認します。")}<div className="space-y-2">{([ ["sme", "中小企業・小規模事業者"], ["middle", "中堅企業"], ["large", "大企業"] ] as [SizeType, string][]).map(([v, label]) => button(label, () => update("size", v), input.size === v))}</div></>;
  if (step === 5) return <>{heading("建物の用途は？", "用途限定制度の判定と、後段の省エネ概算に使います。")}<div className="space-y-2">{BUILDINGS.map(([v, label]) => button(label, () => update("building", v), input.building === v))}</div></>;
  return <>{heading("空調更新の予算・見積額は？", "おおよその税抜金額で構いません。補助額と実質負担の概算に使います。")}<NumberAnswer value={input.invest} onChange={(v) => update("invest", v)} onNext={finish} /><button type="button" onClick={() => handleAssist("現時点では500万円として仮計算します。結果後に詳しい設備情報から上書きできます。", () => update("invest", 500))} className="w-full rounded-xl border-[1.5px] border-ink-line bg-paper-sub px-4 py-3 text-left text-sm font-medium text-ink hover:border-brand/60 hover:bg-paper-tint flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand" /> 分からない（500万円で仮診断）</button></>;
}

/* 2026-09-10 EHC-0031 P0-D:
   都道府県の既定値を撤去したため value="" を取りうる。
   プレースホルダーの選択肢が無いと、React が selectedIndex=-1 で
   空白を描くだけになり「なぜ空欄なのか」が伝わらない。明示的に出す。 */
function SelectAnswer({ value, options, onChange, onNext, placeholder }: { value: string; options: string[]; onChange: (value: string) => void; onNext: () => void; placeholder?: string }) {
  return <div><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border-[1.5px] border-[#859f8c] bg-paper-card px-4 py-3.5 text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="button" onClick={onNext} className="mt-3 w-full rounded-full bg-brand-deep py-3.5 text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:bg-brand transition-colors">次へ <Check className="w-4 h-4" /></button></div>;
}

function NumberAnswer({ value, onChange, onNext }: { value: number; onChange: (value: number) => void; onNext: () => void }) {
  return <div className="mb-3"><div className="flex items-center gap-2"><input type="number" inputMode="numeric" min={1} value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value)))} className="min-w-0 flex-1 rounded-xl border-[1.5px] border-[#859f8c] bg-paper-card px-4 py-3.5 text-lg font-bold text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" /><span className="text-sm text-ink-soft">万円</span></div><button type="button" onClick={onNext} className="mt-3 w-full rounded-full bg-brand-deep py-3.5 text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:bg-brand transition-colors">制度候補を見る <Check className="w-4 h-4" /></button></div>;
}
