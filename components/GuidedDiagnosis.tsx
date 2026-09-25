"use client";

import { useEffect, useRef, useState } from "react";
import { DesiredTiming, EntityType, MatchInput, SizeType, UpdatePlan } from "@/lib/types";
import { OPEN_HEARING_EVENT } from "./HowItWorks";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
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

/* 2026-09-25 UXレビュー No.4:
   MatchInput には旧シミュレーター用の初期値（updatePlan="considering"・size="sme"・
   building="office" など）が入っており、それをそのまま aria-pressed に使っていたため、
   答える前から5問で「選択済み」の印が付いていた。答えたのか既定なのかが見分けられず、
   よく読まずに進むと既定の答えで判定される。
   初期値そのものは旧シミュレーターの計算にも使われるので変えない。
   代わりに「この画面で実際に選んだ問い」だけを選択済みとして表示する。
   共有リンク（?d=）で回答を復元したときは、全問を回答済みとして扱う。 */
type AnswerKey = "updatePlan" | "desiredTiming" | "entityType" | "size" | "building";
const ALL_ANSWER_KEYS: AnswerKey[] = ["updatePlan", "desiredTiming", "entityType", "size", "building"];

export function GuidedDiagnosis({ input, setInput, onComplete }: {
  input: MatchInput;
  setInput: React.Dispatch<React.SetStateAction<MatchInput>>;
  onComplete: (checkEligibility?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [assist, setAssist] = useState<string | null>(null);
  const [answered, setAnswered] = useState<ReadonlySet<AnswerKey>>(() => new Set<AnswerKey>());
  const markAnswered = (key: AnswerKey) => setAnswered((prev) => (prev.has(key) ? prev : new Set<AnswerKey>(Array.from(prev).concat(key))));
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("d")) setAnswered(new Set(ALL_ANSWER_KEYS));
  }, []);
  const completeRef = useRef(onComplete);
  const assistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => () => { if (assistTimer.current) clearTimeout(assistTimer.current); }, [open, step]);

  useEffect(() => {
    const onOpen = () => { if (assistTimer.current) clearTimeout(assistTimer.current); setStep(0); setAssist(null); setOpen(true); };
    window.addEventListener(OPEN_HEARING_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HEARING_EVENT, onOpen);
  }, []);

  const update = <K extends keyof MatchInput>(key: K, value: MatchInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));
  const cancelAssist = () => { if (assistTimer.current) clearTimeout(assistTimer.current); assistTimer.current = null; setAssist(null); };
  const close = () => { cancelAssist(); setOpen(false); };
  const next = () => { cancelAssist(); setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1)); };
  const choose = (fn: () => void) => { fn(); next(); };
  const handleAssist = (message: string, fn: () => void) => {
    cancelAssist();
    fn();
    setAssist(message);
    assistTimer.current = setTimeout(() => {
      setAssist(null);
      if (step === TOTAL_STEPS - 1) {
        setOpen(false);
        completeRef.current(false);
      } else setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
    }, 550);
  };
  const finish = () => { setOpen(false); window.setTimeout(() => onComplete(false), 0); };

  /* 2026-08-24 監査での修正: role="dialog" は付いていたが、Escape で閉じられず、
     Tab がモーダルの外（背後のフォーム）へ抜けていた。開閉フラグで持つ画面なので
     enabled に open を渡し、閉じている間は body のスクロール固定をしない。 */
  const panelRef = useModalA11y(close, open);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print">
      {/* 2026-09-10 EHC-0032 LIGHT-01
          背面の覆いは黒75%だった。紙面の上で真っ黒を敷くと、ページが消えて
          「別の画面へ飛んだ」ように見える。インク色の45%にして、
          後ろに元のページがあることが分かる程度に留める。 */}
      <div className="absolute inset-0 bg-ink/45" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-diagnosis-title"
        tabIndex={-1}
        className="relative flex h-[min(760px,94dvh)] max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-ink-line bg-paper-card shadow-lift focus:outline-none sm:max-w-xl sm:rounded-[30px]"
      >
        <header className="flex shrink-0 items-start gap-2 border-b border-ink-line bg-[#f4f8ee] px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[14px] font-semibold tracking-wide text-brand-deep">空調更新の制度診断</p>
            <h2 id="guided-diagnosis-title" className="text-[18px] font-bold leading-relaxed text-ink sm:text-[20px]">7問で、制度の候補を確認</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="診断を閉じる" className="inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full border border-ink-line bg-paper-card p-2 text-ink-soft hover:bg-paper-tint hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="shrink-0 px-4 pt-4 sm:px-6">
          <p className="mb-3 text-[14px] font-semibold text-ink-soft" role="status">質問 <span className="text-ink">{step + 1}</span> / {TOTAL_STEPS}</p>
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-olive" : "bg-ink-line"}`} />)}
          </div>
        </div>
        {/* 2026-09-25: main はページ本体（app/page.tsx）が持つ。ダイアログの中に2つ目の main を置かない。 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6" role="group" aria-labelledby="guided-question-title">
          {/* 自動補完のお知らせ。青(cobalt)をやめて紙面のセージに寄せる。
              これは警告ではないので amber は使わない（amber は未算定・未確認の予約色）。 */}
          {assist ? <div role="status" className="mb-4 flex items-start gap-2 rounded-2xl border border-ink-line bg-paper-tint p-4 text-[14px] leading-relaxed text-ink"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> {assist}</div> : null}
          <Question step={step} input={input} answered={answered} markAnswered={markAnswered} choose={choose} next={next} update={update} handleAssist={handleAssist} finish={finish} />
        </div>
        {/* 2026-09-11 EHC-0038 第2便 4-J:
            フッターの2ボタンは 48px＋左右の余白。どちらも独立したボタンなので
            文中リンクの免除（WCAG 2.5.8）は使えない。
            「戻る」と「保存して閉じる」は結果が正反対なので、
            当たり判定が文字幅ぴったりだと押し間違いが起きる。 */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-ink-line bg-paper-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6"><button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-ink-soft hover:bg-paper-tint hover:text-ink disabled:opacity-30 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> 戻る</button><button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-[48px] items-center rounded-xl px-3 text-[14px] font-semibold text-ink-soft hover:bg-paper-tint hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">保存して閉じる</button></footer>
      </div>
    </div>
  );
}

function Question({ step, input, answered, markAnswered, choose, next, update, handleAssist, finish }: {
  step: number; input: MatchInput; answered: ReadonlySet<AnswerKey>; markAnswered: (key: AnswerKey) => void; choose: (fn: () => void) => void; next: () => void;
  update: <K extends keyof MatchInput>(key: K, value: MatchInput[K]) => void;
  handleAssist: (message: string, fn: () => void) => void; finish: () => void;
}) {
  const heading = (title: string, help: string) => <div className="mb-6"><h3 id="guided-question-title" className="text-[22px] font-bold leading-[1.5] tracking-tight text-ink sm:text-2xl">{title}</h3><p id="guided-question-help" className="mt-3 text-[14px] leading-[1.8] text-ink-soft">{help}</p></div>;
  /* 2026-09-10 EHC-0032 LIGHT-01
     選択肢を HomeV17 の .option / .equipment-choice に合わせる。
       未選択: border:1.5px solid #859f8c / 背景白
       選択中: border-color:var(--green) + box-shadow:0 0 0 1px var(--green) + background:#edf6e8
     選択中だけ枠を2pxに太くすると 0.5px ぶん中身がずれて、押した瞬間に文字が動く。
     HomeV17 は枠の太さを変えず「同色の1pxリングを外に足す」ことで濃さを出しているので、
     ここも ring-1 で同じ手を使う（Tailwind の ring は外側に描かれるのでレイアウトが動かない）。

     ───────── 2026-09-11 EHC-0038 第2便 4-H / 4-J ─────────
     枠線 #859f8c（白地コントラスト 2.863）を #57685e（5.920）へ。
     ここは診断の全設問が並ぶ場所で、枠が見えないと
     「選択肢が何個あるのか」自体が分からなくなる。
     フォーカスは半透明リングではなく不透明2px outline＋2px offset。
     この画面はキーボード／スクリーンリーダーだけで最後まで進めるはずの導線なので、
     いま何番目の選択肢にいるかが常に一定の濃さで見えている必要がある。
     タップ領域は py-3.5＋text-sm で 48px を満たす（4-H）。 */
  const button = (label: string, action: () => void, active = false) => <button key={label} type="button" aria-pressed={active} onClick={() => choose(action)} className={`flex w-full min-h-[56px] items-center justify-between gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 text-left text-[16px] font-semibold leading-relaxed transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${active ? "border-brand ring-1 ring-brand bg-[#edf6e8] text-ink" : "border-[#57685e] bg-paper-card text-ink hover:border-brand hover:bg-[#f0f6df]"}`}><span className="min-w-0">{label}</span><span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${active ? "bg-brand-deep text-white" : "border border-[#859f8c] text-ink-soft"}`}>{active ? <Check className="h-4 w-4" /> : <ArrowRight className="h-3.5 w-3.5" />}</span></button>;

  if (step === 0) return <>{heading("業務用空調の更新予定はありますか？", "制度は契約・発注前の申請が必要な場合があります。予定の確度から確認します。")}<div className="space-y-2">{([ ["planned", "更新する予定がある"], ["considering", "更新を検討している"], ["none", "まだ予定はない"] ] as [UpdatePlan, string][]).map(([v, label]) => button(label, () => { markAnswered("updatePlan"); update("updatePlan", v); update("interest", "subsidy"); }, answered.has("updatePlan") && input.updatePlan === v))}</div></>;
  if (step === 1) return <>{heading("いつ頃、更新したいですか？", "受付期限と申請準備に間に合う可能性を先に判定します。")}<div className="space-y-2">{([ ["within_1m", "1か月以内"], ["within_3m", "3か月以内"], ["within_6m", "6か月以内"], ["within_12m", "1年以内"], ["undecided", "まだ決めていない"] ] as [DesiredTiming, string][]).map(([v, label]) => button(label, () => { markAnswered("desiredTiming"); update("desiredTiming", v); }, answered.has("desiredTiming") && input.desiredTiming === v))}</div></>;
  if (step === 2) return <>{heading("設備がある都道府県は？", "国の制度に加えて、自治体の制度を照合します。")}<SelectAnswer value={input.pref} options={PREFS} placeholder="選択してください（未選択のままでも進めます）" onChange={(v) => update("pref", v)} onNext={next} /></>;
  if (step === 3) return <>{heading("事業者区分を教えてください", "法人・個人事業主の区分は制度要件の確認に使います。")}<div className="space-y-2">{([ ["corporation", "法人・団体"], ["sole_proprietor", "個人事業主"] ] as [EntityType, string][]).map(([v, label]) => button(label, () => { markAnswered("entityType"); update("entityType", v); update("bizType", "business"); update("customerKind", v === "sole_proprietor" ? "individual" : "company"); }, answered.has("entityType") && input.entityType === v))}</div></>;
  if (step === 4) return <>{heading("事業規模を教えてください", "資本金・従業員数による最終判定は、候補表示後に確認します。")}<div className="space-y-2">{([ ["sme", "中小企業・小規模事業者"], ["middle", "中堅企業"], ["large", "大企業"] ] as [SizeType, string][]).map(([v, label]) => button(label, () => { markAnswered("size"); update("size", v); }, answered.has("size") && input.size === v))}</div></>;
  if (step === 5) return <>{heading("建物の用途は？", "用途限定制度の判定と、後段の省エネ概算に使います。")}<div className="space-y-2">{BUILDINGS.map(([v, label]) => button(label, () => { markAnswered("building"); update("building", v); }, answered.has("building") && input.building === v))}</div></>;
  /* 2026-09-10 EHC-0038 P0-1
     ここは以前「分からない → 500万円で仮診断」だった。
     聞いていない金額を既知の見積額として置くと、補助額・実質負担・回収年が
     そのまま数字で出てしまい、後段のどこにも「これは仮」と残らない。
     未入力は未入力のまま持ち回る（0 は resolveInvestState() で未算定扱い）。
     制度候補の判定は金額を使わないので、診断はそのまま続けられる。 */
  return <>{heading("空調更新の予算・見積額は？", "見積があれば、おおよその税抜金額を。分からなければ空欄のまま進めてください（制度候補は金額なしで判定し、あとで設備の情報から概算も出します）。")}<NumberAnswer value={input.invest} onChange={(v) => update("invest", v)} onNext={finish} /><button type="button" onClick={() => handleAssist("金額は未算定のまま進みます。制度の候補と期限はこのまま判定し、補助額・実質負担・回収年は「未算定」と表示します。", () => update("invest", 0))} className="flex min-h-[56px] w-full items-start gap-3 rounded-2xl border-[1.5px] border-[#57685e] bg-paper-sub px-4 py-4 text-left text-[16px] font-medium leading-relaxed text-ink hover:border-brand hover:bg-paper-tint focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span>分からない<span className="mt-1 block text-[14px] font-normal text-ink-soft">金額は未算定のまま進む</span></span></button></>;
}

/* 2026-09-10 EHC-0031 P0-D:
   都道府県の既定値を撤去したため value="" を取りうる。
   プレースホルダーの選択肢が無いと、React が selectedIndex=-1 で
   空白を描くだけになり「なぜ空欄なのか」が伝わらない。明示的に出す。 */
function SelectAnswer({ value, options, onChange, onNext, placeholder }: { value: string; options: string[]; onChange: (value: string) => void; onNext: () => void; placeholder?: string }) {
  /* 2026-09-11 EHC-0038 第2便 4-H / 4-J: 枠線 #859f8c→#57685e、
     フォーカスは不透明2px outline＋2px offset、タップ領域 48px。 */
  return <div><select aria-labelledby="guided-question-title" aria-describedby="guided-question-help" value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[56px] rounded-2xl border-[1.5px] border-[#57685e] bg-paper-card px-4 py-3.5 text-[16px] font-semibold text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand focus:border-brand">{placeholder !== undefined && <option value="">選択してください</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><p className="mt-3 text-[14px] leading-relaxed text-ink-soft">未選択のままでも進めます。</p><button type="button" onClick={onNext} className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full bg-brand-deep px-4 py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">次へ <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>;
}

/* 2026-09-10 EHC-0038 P0-1
   以前は Math.max(1, Number(...)) で、消しても 1（＝1万円）が入った。
   1万円は「未入力」ではなく「1万円と見積もった」という別の主張になる。
   空欄・非数値・0以下は 0 に戻し、0 は未算定として扱う（表示も空欄）。 */
function NumberAnswer({ value, onChange, onNext }: { value: number; onChange: (value: number) => void; onNext: () => void }) {
  return <div className="mb-4"><div className="flex items-center gap-3"><input type="number" aria-label="空調更新の予算・見積額（税抜・万円）" aria-describedby="guided-question-help" inputMode="numeric" min={0} placeholder="未入力でも進めます" value={value > 0 ? value : ""} onChange={(e) => { const n = Number(e.target.value); onChange(e.target.value === "" || !Number.isFinite(n) || n <= 0 ? 0 : n); }} className="min-h-[56px] min-w-0 flex-1 rounded-2xl border-[1.5px] border-[#57685e] bg-paper-card px-4 py-3.5 text-lg font-bold text-ink placeholder:text-[14px] placeholder:font-medium placeholder:text-ink-soft focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand focus:border-brand" /><span className="shrink-0 text-[16px] text-ink-soft">万円</span></div><button type="button" onClick={onNext} className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full bg-brand-deep px-4 py-3.5 text-[16px] font-bold text-white transition-colors hover:bg-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">制度候補を見る <ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>;
}
