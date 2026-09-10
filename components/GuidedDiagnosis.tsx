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
      <div className="absolute inset-0 bg-black/75" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-diagnosis-title"
        tabIndex={-1}
        className="relative w-full sm:max-w-xl min-h-[72vh] sm:min-h-0 sm:h-[620px] max-h-[92vh] rounded-t-3xl sm:rounded-3xl border border-white/15 bg-night-900 shadow-lift overflow-hidden flex flex-col focus:outline-none"
      >
        <header className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ehc-600 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" aria-hidden="true" /></div>
          <div className="flex-1"><h2 id="guided-diagnosis-title" className="text-sm font-bold text-white">3分で制度マッチング</h2><p className="text-xs text-slate-400">期限に関わる質問から確認。空調仕様は後で補完できます</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </header>
        <div className="px-5 pt-4"><div className="flex items-center justify-between text-xs text-slate-400 mb-2"><span>質問 {step + 1} / {TOTAL_STEPS}</span><span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span></div><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-ehc-600 to-ehc-400 transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} /></div></div>
        <main className="flex-1 overflow-y-auto px-5 py-6">
          {assist ? <div className="mb-4 rounded-xl border border-cobalt-500/30 bg-cobalt-500/10 p-3 text-xs text-cobalt-100 flex items-start gap-2"><Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" /> {assist}</div> : null}
          <Question step={step} input={input} choose={choose} next={next} update={update} handleAssist={handleAssist} finish={finish} />
        </main>
        <footer className="px-5 py-3 border-t border-white/10 flex items-center justify-between"><button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="min-h-[44px] inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"><ArrowLeft className="w-4 h-4" /> 戻る</button><button type="button" onClick={() => setOpen(false)} className="min-h-[44px] inline-flex items-center text-xs text-slate-500 hover:text-slate-300">保存して閉じる</button></footer>
      </div>
    </div>
  );
}

function Question({ step, input, choose, next, update, handleAssist, finish }: {
  step: number; input: MatchInput; choose: (fn: () => void) => void; next: () => void;
  update: <K extends keyof MatchInput>(key: K, value: MatchInput[K]) => void;
  handleAssist: (message: string, fn: () => void) => void; finish: () => void;
}) {
  const heading = (title: string, help: string) => <div className="mb-5"><h3 className="text-xl font-bold text-white leading-snug">{title}</h3><p className="text-xs text-slate-400 mt-2 leading-relaxed">{help}</p></div>;
  const button = (label: string, action: () => void, active = false) => <button key={label} type="button" onClick={() => choose(action)} className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm font-semibold transition-colors ${active ? "border-ehc-400 bg-ehc-500/15 text-ehc-100" : "border-white/15 bg-white/[0.03] text-slate-200 hover:border-ehc-500/50 hover:bg-ehc-500/10"}`}>{label}</button>;

  if (step === 0) return <>{heading("業務用空調の更新予定はありますか？", "制度は契約・発注前の申請が必要な場合があります。予定の確度から確認します。")}<div className="space-y-2">{([ ["planned", "更新する予定がある"], ["considering", "更新を検討している"], ["none", "まだ予定はない"] ] as [UpdatePlan, string][]).map(([v, label]) => button(label, () => { update("updatePlan", v); update("interest", "subsidy"); }, input.updatePlan === v))}</div></>;
  if (step === 1) return <>{heading("いつ頃、更新したいですか？", "受付期限と申請準備に間に合う可能性を先に判定します。")}<div className="space-y-2">{([ ["within_1m", "1か月以内"], ["within_3m", "3か月以内"], ["within_6m", "6か月以内"], ["within_12m", "1年以内"], ["undecided", "まだ決めていない"] ] as [DesiredTiming, string][]).map(([v, label]) => button(label, () => update("desiredTiming", v), input.desiredTiming === v))}</div></>;
  if (step === 2) return <>{heading("設備がある都道府県は？", "国の制度に加えて、自治体の制度を照合します。")}<SelectAnswer value={input.pref} options={PREFS} onChange={(v) => update("pref", v)} onNext={next} /></>;
  if (step === 3) return <>{heading("事業者区分を教えてください", "法人・個人事業主の区分は制度要件の確認に使います。")}<div className="space-y-2">{([ ["corporation", "法人・団体"], ["sole_proprietor", "個人事業主"] ] as [EntityType, string][]).map(([v, label]) => button(label, () => { update("entityType", v); update("bizType", "business"); update("customerKind", v === "sole_proprietor" ? "individual" : "company"); }, input.entityType === v))}</div></>;
  if (step === 4) return <>{heading("事業規模を教えてください", "資本金・従業員数による最終判定は、候補表示後に確認します。")}<div className="space-y-2">{([ ["sme", "中小企業・小規模事業者"], ["middle", "中堅企業"], ["large", "大企業"] ] as [SizeType, string][]).map(([v, label]) => button(label, () => update("size", v), input.size === v))}</div></>;
  if (step === 5) return <>{heading("建物の用途は？", "用途限定制度の判定と、後段の省エネ概算に使います。")}<div className="space-y-2">{BUILDINGS.map(([v, label]) => button(label, () => update("building", v), input.building === v))}</div></>;
  return <>{heading("空調更新の予算・見積額は？", "おおよその税抜金額で構いません。補助額と実質負担の概算に使います。")}<NumberAnswer value={input.invest} onChange={(v) => update("invest", v)} onNext={finish} /><button type="button" onClick={() => handleAssist("現時点では500万円として仮計算します。結果後に詳しい設備情報から上書きできます。", () => update("invest", 500))} className="w-full rounded-xl border border-cobalt-500/35 bg-cobalt-500/10 px-4 py-3 text-left text-sm font-semibold text-cobalt-100 hover:bg-cobalt-500/20 flex items-center gap-2"><Sparkles className="w-4 h-4" /> 分からない（500万円で仮診断）</button></>;
}

function SelectAnswer({ value, options, onChange, onNext }: { value: string; options: string[]; onChange: (value: string) => void; onNext: () => void }) {
  return <div><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/20 bg-night-800 px-4 py-3.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-ehc-500/50">{options.map((option) => <option key={option}>{option}</option>)}</select><button type="button" onClick={onNext} className="mt-3 w-full rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 py-3.5 text-sm font-bold text-white inline-flex items-center justify-center gap-2">次へ <Check className="w-4 h-4" /></button></div>;
}

function NumberAnswer({ value, onChange, onNext }: { value: number; onChange: (value: number) => void; onNext: () => void }) {
  return <div className="mb-3"><div className="flex items-center gap-2"><input type="number" inputMode="numeric" min={1} value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value)))} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-night-800 px-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-ehc-500/50" /><span className="text-sm text-slate-400">万円</span></div><button type="button" onClick={onNext} className="mt-3 w-full rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 py-3.5 text-sm font-bold text-white inline-flex items-center justify-center gap-2">制度候補を見る <Check className="w-4 h-4" /></button></div>;
}
