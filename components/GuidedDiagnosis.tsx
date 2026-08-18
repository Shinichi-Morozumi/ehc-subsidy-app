"use client";

import { useEffect, useState } from "react";
import { MatchInput, EquipType, InterestType, RefriType, SizeType } from "@/lib/types";
import { estimateAnnualKwhFromGroups, estimateInvestManYenFromGroups } from "@/lib/pricing";
import { OPEN_HEARING_EVENT } from "./HowItWorks";
import { ArrowLeft, Check, ClipboardList, Sparkles, X } from "lucide-react";

const PREFS = ["東京都", "神奈川県", "大阪府", "埼玉県", "千葉県", "愛知県", "北海道", "福岡県", "その他"];
const BUILDINGS = [
  ["office", "オフィス・事務所"], ["retail", "小売店舗"], ["restaurant", "飲食店"],
  ["hotel", "ホテル・宿泊"], ["medical", "医療・福祉"], ["school", "学校・教育"], ["other", "その他事業所"],
] as const;
const TOTAL_STEPS = 11;

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

  const update = <K extends keyof MatchInput>(key: K, value: MatchInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));
  const updateGroup = (patch: Partial<MatchInput["equipGroups"][number]>) =>
    setInput((prev) => ({ ...prev, equipGroups: prev.equipGroups.map((g, i) => (i === 0 ? { ...g, ...patch } : g)) }));
  const next = () => { setAssist(null); setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)); };
  const choose = (fn: () => void) => { fn(); next(); };
  const useAssist = (message: string, fn: () => void) => {
    fn();
    setAssist(message);
    window.setTimeout(() => { setAssist(null); setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)); }, 650);
  };
  const finish = () => { setOpen(false); onComplete(false); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print" role="dialog" aria-modal="true" aria-label="かんたんガイド診断">
      <div className="absolute inset-0 bg-black/75" onClick={() => setOpen(false)} />
      <div className="relative w-full sm:max-w-xl min-h-[72vh] sm:min-h-0 sm:h-[620px] max-h-[92vh] rounded-t-3xl sm:rounded-3xl border border-white/15 bg-night-900 shadow-lift overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-ehc-600 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-white" /></div>
          <div className="flex-1"><h2 className="text-sm font-bold text-white">かんたんガイド診断</h2><p className="text-[11px] text-slate-400">1画面1問。分からない項目だけAI目安を使えます</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </header>
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2"><span>質問 {step + 1} / {TOTAL_STEPS}</span><span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span></div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-ehc-600 to-ehc-400 transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} /></div>
        </div>
        <main className="flex-1 overflow-y-auto px-5 py-6">
          {assist && <div className="mb-4 rounded-xl border border-cobalt-500/30 bg-cobalt-500/10 p-3 text-xs text-cobalt-100 flex items-start gap-2"><Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" /> {assist}</div>}
          <Question step={step} input={input} choose={choose} next={next} update={update} updateGroup={updateGroup} useAssist={useAssist} finish={finish} />
        </main>
        <footer className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"><ArrowLeft className="w-4 h-4" /> 戻る</button>
          <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-slate-500 hover:text-slate-300">保存して閉じる</button>
        </footer>
      </div>
    </div>
  );
}

function Question({ step, input, choose, next, update, updateGroup, useAssist, finish }: {
  step: number;
  input: MatchInput;
  choose: (fn: () => void) => void;
  next: () => void;
  update: <K extends keyof MatchInput>(key: K, value: MatchInput[K]) => void;
  updateGroup: (patch: Partial<MatchInput["equipGroups"][number]>) => void;
  useAssist: (message: string, fn: () => void) => void;
  finish: () => void;
}) {
  const group = input.equipGroups[0];
  const heading = (title: string, help: string) => <div className="mb-5"><h3 className="text-xl font-bold text-white leading-snug">{title}</h3><p className="text-xs text-slate-400 mt-2 leading-relaxed">{help}</p></div>;
  const button = (label: string, action: () => void, active = false) => <button key={label} type="button" onClick={() => choose(action)} className={`w-full text-left rounded-xl border px-4 py-3.5 text-sm font-semibold transition-colors ${active ? "border-ehc-400 bg-ehc-500/15 text-ehc-100" : "border-white/15 bg-white/[0.03] text-slate-200 hover:border-ehc-500/50 hover:bg-ehc-500/10"}`}>{label}</button>;
  const assistButton = (label: string, message: string, action: () => void) => <button type="button" onClick={() => useAssist(message, action)} className="w-full rounded-xl border border-cobalt-500/35 bg-cobalt-500/10 px-4 py-3 text-left text-sm font-semibold text-cobalt-100 hover:bg-cobalt-500/20 flex items-center gap-2"><Sparkles className="w-4 h-4" /> {label}</button>;

  if (step === 0) return <>{heading("今日は何を一番知りたいですか？", "回答に合わせて結果画面の見方を整えます。")}<div className="space-y-2">{([
    ["subsidy", "補助金でいくら安くなるか"], ["energy", "電気代をどれだけ下げられるか"], ["update", "機器の入替・更新工事"], ["dropin", "冷媒だけ入替（ドロップイン）"], ["unsure", "まだ決めていない"],
  ] as [InterestType, string][]).map(([v, label]) => button(label, () => update("interest", v), input.interest === v))}</div></>;
  if (step === 1) return <>{heading("企業規模を教えてください", "補助金の対象区分に使います。個人事業主は中小企業を選べます。")}<div className="space-y-2">{([
    ["sme", "中小企業・個人事業主"], ["middle", "中堅企業"], ["large", "大企業"],
  ] as [SizeType, string][]).map(([v, label]) => button(label, () => update("size", v), input.size === v))}</div></>;
  if (step === 2) return <>{heading("設備がある都道府県は？", "国の制度に加えて、自治体の制度を照合します。")}<div className="grid grid-cols-2 gap-2">{PREFS.map((pref) => button(pref, () => update("pref", pref), input.pref === pref))}</div></>;
  if (step === 3) return <>{heading("建物の用途は？", "用途別の稼働時間から省エネ効果の目安を計算します。")}<div className="space-y-2">{BUILDINGS.map(([v, label]) => button(label, () => update("building", v), input.building === v))}</div></>;
  if (step === 4) return <>{heading("現在の冷媒は分かりますか？", "室外機側面の銘板に R22 / R410A / R32 と記載されています。")}<div className="space-y-2">{([
    ["r22", "R22"], ["r410a", "R410A"], ["r32", "R32"],
  ] as [RefriType, string][]).map(([v, label]) => button(label, () => updateGroup({ refri: v }), group.refri === v))}{assistButton("分からない（AIは安全側に『不明』で診断）", "冷媒を『不明』にしました。銘板写真があれば、相談時にEHCが確認します。", () => updateGroup({ refri: "unknown" }))}</div></>;
  if (step === 5) return <>{heading("空調の種類は？", "室外機1台に複数の室内機がつながる場合は、ビル用マルチが一般的です。")}<div className="space-y-2">{([
    ["ac", "パッケージエアコン"], ["multi", "ビル用マルチエアコン"],
  ] as [EquipType, string][]).map(([v, label]) => button(label, () => updateGroup({ equip: v }), group.equip === v))}{assistButton("分からない（AIは一般的なパッケージで仮入力）", "一般的なパッケージエアコンとして仮入力しました。後でフォームから修正できます。", () => updateGroup({ equip: "ac" }))}</div></>;
  if (step === 6) {
    const year = new Date().getFullYear();
    return <>{heading("設置した時期はいつ頃ですか？", "正確な年でなくても構いません。経年劣化の目安に使います。")}<div className="space-y-2">{[[5, `約5年前（${year - 5}年頃）`], [10, `約10年前（${year - 10}年頃）`], [15, `約15年前（${year - 15}年頃）`], [20, `20年以上前（${year - 20}年以前）`]].map(([age, label]) => button(String(label), () => updateGroup({ installYear: year - Number(age) })))}{assistButton("分からない（AIは12年経過として仮入力）", "業務用空調の更新検討帯を基に12年経過で仮入力しました。", () => updateGroup({ installYear: year - 12 }))}</div></>;
  }
  if (step === 7) return <>{heading("更新を検討する台数は？", "同じ種類・年式の室外機台数を入力してください。複数グループは後で追加できます。")}<NumberAnswer value={group.units} unit="台" min={1} onChange={(v) => updateGroup({ units: v })} onNext={next} />{assistButton("分からない（AIは1台で仮入力）", "まず1台として概算しました。現地調査前に台数を修正できます。", () => updateGroup({ units: 1 }))}</>;
  if (step === 8) return <>{heading("1台あたりの馬力は？", "銘板の能力欄や型番から確認できます。分からなくても診断可能です。")}<NumberAnswer value={group.hp ?? 4} unit="馬力" min={1} onChange={(v) => updateGroup({ hp: v })} onNext={next} />{assistButton("分からない（AIは4馬力で仮入力）", "SIIの参考計算で使う4馬力を仮入力しました。", () => updateGroup({ hp: 4 }))}</>;
  if (step === 9) return <>{heading("年間の電力使用量は分かりますか？", "更新対象の事業所について、直近1年の請求書合計kWhが最も正確です。")}<NumberAnswer value={input.kwh} unit="kWh/年" min={1} onChange={(v) => update("kwh", v)} onNext={next} />{assistButton("分からない（AIが設備情報から目安計算）", "台数・馬力・建物用途から一般的な年間使用量を仮計算しました。請求書があれば後で上書きしてください。", () => update("kwh", estimateAnnualKwhFromGroups(input.equipGroups, input.building)))}</>;
  return <>{heading("設備投資の見積額は分かりますか？", "今回更新する設備の本体＋工事費を、税抜・万円で入力します。")}<NumberAnswer value={input.invest} unit="万円" min={1} onChange={(v) => update("invest", v)} onNext={finish} nextLabel="診断結果を見る" />{assistButton("分からない（AIが実勢単価から概算）", "台数・馬力とEHC/PNの実勢単価から概算しました。このまま診断結果へ進みます。", () => { update("invest", estimateInvestManYenFromGroups(input.equipGroups)); window.setTimeout(finish, 700); })}</>;
}

function NumberAnswer({ value, unit, min, onChange, onNext, nextLabel = "次へ" }: { value: number; unit: string; min: number; onChange: (value: number) => void; onNext: () => void; nextLabel?: string }) {
  return <div className="mb-3"><div className="flex items-center gap-2"><input type="number" inputMode="numeric" min={min} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value)))} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-night-800 px-4 py-3.5 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-ehc-500/50" /><span className="text-sm text-slate-400 whitespace-nowrap">{unit}</span></div><button type="button" onClick={onNext} className="mt-3 w-full rounded-xl bg-gradient-to-r from-ehc-600 to-ehc-500 py-3.5 text-sm font-bold text-white hover:from-ehc-500 hover:to-ehc-400 inline-flex items-center justify-center gap-2">{nextLabel} <Check className="w-4 h-4" /></button></div>;
}
