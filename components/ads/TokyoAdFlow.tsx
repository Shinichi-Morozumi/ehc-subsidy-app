"use client";
// EHC-0120 / v1 / 2026-11-03. 既存の制度台帳・会社情報・施工実績を共用する広告入口。
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, Phone, ShieldCheck, Video } from "lucide-react";
import ConsultationFields from "@/components/ConsultationFields";
import { ReferralCapture } from "@/components/programs/ReferralCapture";
import { SiteFooterSimple } from "@/components/programs/SiteShell";
import { COMPANY } from "@/lib/company";
import { PROGRAMS } from "@/lib/programs";
import { BUILD_RECORDS, BUILD_RECORDS_NOTE, WHY } from "@/lib/team";
import { AD_BUDGETS, AD_CAMPAIGN, AD_INDUSTRIES, AD_PREFS, adGuidance, type AdVariant } from "@/lib/adConsultation";
import { readConsultation } from "@/lib/consultation";
import { chooseAdMeasurement, enableAdMeasurement, measurementChoice, recordAdConversion } from "@/lib/adMeasurement";
import { currentReferral } from "@/lib/referralClient";
import { splitReach } from "@/lib/programLead";
import { track } from "@/lib/track";

const P = PROGRAMS.tokyoZeroemi;
const PRIMARY = "inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full bg-brand-deep px-6 py-3 text-[16px] font-bold text-white shadow-card hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:opacity-60";
const INPUT = "mt-2 min-h-[52px] w-full min-w-0 rounded-xl border border-ink-line bg-white px-3 py-2 text-[16px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
const ymd = (s?: string) => s ? `${Number(s.slice(0, 4))}年${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日` : "公式発表待ち";

export function TokyoAdFlow({ variant, today }: { variant: AdVariant; today: string }) {
  const [phase, setPhase] = useState<"intro" | "check" | "result" | "form">("intro");
  const [step, setStep] = useState(0);
  const [pref, setPref] = useState("東京都");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [budget, setBudget] = useState("");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [reach, setReach] = useState("");
  const [dates, setDates] = useState(["", "", ""]);
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [choice, setChoice] = useState<"granted" | "denied" | null>(null);
  const [showChoice, setShowChoice] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [campaign, setCampaign] = useState<typeof AD_CAMPAIGN | null>(null);
    const requestId = useRef("");
  const openedAt = useRef(0);
  const inFlight = useRef(false);
  const entry = useRef<HTMLElement>(null);
  const datesRead = readConsultation({ mode: "zoom", timezone: "Asia/Tokyo", preferredDates: dates });
  const windows = P.windows.filter(w => w.end && w.end >= today);
  const finalWindow = windows[windows.length - 1];
  const result = adGuidance(pref, budget);
  const exampleCost = 1500;
  const tier = P.caps[2];
  const exampleGrant = Math.min(tier.man ?? Number.POSITIVE_INFINITY, Math.floor(exampleCost * (tier.rate ?? 0)));

  useEffect(() => {
    openedAt.current = Date.now();
    requestId.current = crypto.randomUUID();
    const q = new URLSearchParams(window.location.search);
    const test = q.get("adtest") === "1";
    setIsTest(test);
    setCampaign(q.get("utm_campaign") === AD_CAMPAIGN ? AD_CAMPAIGN : null);
    const saved = measurementChoice();
    setChoice(saved); setShowChoice(saved === null);
    if (saved === "granted") enableAdMeasurement();
    if (!test) track("ad_open", { variant });
    // 成功後の再読込でも、連絡先を端末に保存せず受付番号だけを表示する。
    try {
      const last = sessionStorage.getItem(`ehc_ad_receipt:${variant}`);
      if (last && /^EHCAD-[0-9a-f-]{36}$/i.test(last)) {
        setReceipt(last); setPhase("form");
        // 通信途中で再読込しても、同じ成功受付の計測だけ再開できる（問い合わせは再送しない）。
        recordAdConversion(last);
      }
    } catch { /* 保存不可でも入力・送信できる */ }
  }, [variant]);

  const move = (next: typeof phase) => {
    setError(null); setPhase(next);
    if (!isTest && next === "form") track("ad_form", { variant });
    requestAnimationFrame(() => entry.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const start = () => { if (variant === "diagnosis") setStep(0); move(variant === "lp" ? "form" : "check"); };
  const choose = (v: "granted" | "denied") => { chooseAdMeasurement(v); setChoice(v); setShowChoice(false); };
  const next = () => {
    if (step === 0 && !city.trim()) { setError("工事場所の市区町村をご入力ください。"); return; }
    if (step === 1 && !industry) { setError("施設・業種をお選びください。"); return; }
    if (step === 2 && !budget) { setError("ご予算の目安をお選びください。分からなくても進めます。"); return; }
    setError(null);
    if (step === 2) { if (!isTest) track("ad_result", { variant }); move("result"); }
    else { setStep(step + 1); if (!isTest) track("ad_step", { step: step + 2 }); }
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current || uncertain || receipt) return;
    if (!company.trim() || !name.trim() || splitReach(reach.trim()).error || !city.trim() || !consent || datesRead.error) {
      setError(datesRead.error || "法人名・お名前・連絡先・工事場所と同意をご確認ください。"); return;
    }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const res = await fetch("/api/program-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), name: name.trim(), reach: reach.trim(), consent, source: "tokyo", programIds: ["tokyoZeroemi"],
          referral: currentReferral(), hp, elapsedMs: Date.now() - openedAt.current,
          ad: { variant, requestId: requestId.current, pref, city: city.trim(), industry: industry || null, budget: budget || null, campaign, test: isTest, consultation: datesRead.value } }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || typeof json.receiptNo !== "string") {
        if (res.status >= 500) setUncertain(true);
        setError(json?.error || `送信を確認できませんでした。再送せず、お電話（${COMPANY.tel}）でご確認ください。`);
        if (!isTest) track("ad_submit", { variant, ok: false });
        return;
      }
      setReceipt(json.receiptNo);
      try { sessionStorage.setItem(`ehc_ad_receipt:${variant}`, json.receiptNo); } catch { /* 連絡先は端末保存しない */ }
      if (!isTest) track("ad_submit", { variant, ok: true });
      recordAdConversion(json.receiptNo);
      move("form");
    } catch {
      setUncertain(true);
      setError(`通信の結果を確認できませんでした。再送せず、${COMPANY.tel} に受付番号 EHCAD-${requestId.current} をお知らせください。`);
      if (!isTest) track("ad_submit", { variant, ok: false });
    } finally { inFlight.current = false; setBusy(false); }
  };

  return <div className="min-h-screen bg-paper text-ink">
    <ReferralCapture pathname="/tokyo" />
    <header className="border-b border-ink-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5"><Image src="/icon-192.png" width={38} height={38} alt="" /><span className="text-[13px] font-bold leading-snug sm:text-[16px]">EHCソリューションズ<span className="hidden text-[11px] font-normal text-ink-soft sm:block">空調・設備の改修と補助金のご相談</span></span></Link>
        <a href={COMPANY.telHref} className="inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink-line px-3 text-[13px] font-bold"><Phone className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{COMPANY.tel}</span><span className="sm:hidden">電話で相談</span></a>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-12">
      <section className="grid items-center gap-5 pb-10 pt-9 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:py-14">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-bold tracking-wider text-brand"><span className="h-2 w-2 rounded-full bg-brand" />東京都の事業所の設備更新をご検討中の方へ</p>
          <h1 className="mt-5 text-[31px] font-bold leading-[1.45] tracking-tight sm:text-[43px]">空調の入れ替え。<br /><span className="text-brand">助成金が使えるか、<br />まずは確認。</span></h1>
          <p className="mt-5 max-w-lg text-[16px] leading-[1.95] text-ink-soft">東京都の「ゼロエミ助成」で自己負担を抑えられるか。使える条件と、工事・費用の段取りを一緒に整理します。</p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-bold">{["空調・換気・LEDなど", "複数台の更新にも対応"].map(t => <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-brand" aria-hidden />{t}</span>)}</div>
          <button type="button" onClick={start} className={`${PRIMARY} mt-7 w-full sm:w-auto`}>{variant === "lp" ? "Zoom相談の候補日時を送る" : "3項目で、相談の目安を確認"}<ArrowRight className="h-5 w-5" aria-hidden /></button>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">{variant === "lp" ? "候補日時を3つ送信 → 担当者が折り返し、日程を調整します。" : "連絡先は結果を見たあと。補助対象・金額を確定する診断ではありません。"}</p>
        </div>
        <div className="relative"><Image src="/v17/hero-scene.webp" width={1536} height={1024} alt="事業所の空調機と、設備を確認するEHCの作業員のイラスト" priority sizes="(max-width:1024px) 100vw, 520px" className="h-auto w-full rounded-[28px] mix-blend-multiply" />
          <div className="relative mx-3 -mt-5 flex items-center justify-between gap-3 rounded-2xl border border-ink-line bg-white px-5 py-4 shadow-card"><span className="text-[13px] font-bold">まず確認するのは<br /><span className="text-ink-soft">「自社で使えるか」</span></span><span className="flex items-center gap-2 text-[14px] font-bold text-brand"><Video className="h-5 w-5" aria-hidden />Zoomで相談</span></div>
        </div>
      </section>

      <section ref={entry} id="ad-consult" className="scroll-mt-5" aria-label="相談の受付">
        {phase !== "intro" && <div className="rounded-[28px] border border-ink-line bg-white p-5 shadow-card sm:p-8">
          {receipt ? <div role="status" className="mx-auto max-w-2xl py-6">
            <CheckCircle2 className="h-12 w-12 text-brand" aria-hidden /><h2 className="mt-4 text-[25px] font-bold">候補日時を受け付けました</h2>
            <p className="mt-3 text-[16px] leading-[1.9]">担当者から{COMPANY.replyDays}営業日以内を目安に折り返し、日時とZoomのURLをご案内します。<strong>まだ予約は確定していません。</strong></p>
            <p className="mt-5 break-all rounded-xl bg-paper-sub p-4 text-[14px]">受付番号<br /><strong data-testid="ad-receipt">{receipt}</strong></p>
            <p className="mt-3 text-[13px] text-ink-soft">お客様宛の自動メールはお送りしていません。この画面を控えておいてください。</p>
            <Link href="/team" className="mt-6 inline-flex min-h-[44px] items-center gap-2 font-bold text-brand underline">施工体制と実績を見る<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div> : phase === "check" ? <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-brand">相談の目安を確認</p><p className="text-[13px] text-ink-soft">{step + 1} / 3</p></div>
            <div className="mt-3 flex gap-2" aria-hidden>{[0, 1, 2].map(i => <span key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-brand" : "bg-paper-tint"}`} />)}</div>
            <h2 className="mt-6 text-[23px] font-bold">{["工事場所はどちらですか？", "どのような施設ですか？", "対象設備等のご予算は？"][step]}</h2>
            <p className="mt-2 text-[14px] text-ink-soft">{["会社の本店ではなく、設備を入れ替える場所です。", "施設の種類だけでは、助成の対象は決まりません。", "税抜の目安です。まだ分からなくても進めます。"][step]}</p>
            {step === 0 ? <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]"><label className="text-[14px] font-bold">都道府県<select value={pref} onChange={e => setPref(e.target.value)} className={INPUT}>{AD_PREFS.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-[14px] font-bold">市区町村<input value={city} onChange={e => setCity(e.target.value)} maxLength={60} placeholder="例：中野区" autoComplete="address-level2" className={INPUT} /></label></div> : <fieldset className="mt-5 grid gap-2 sm:grid-cols-2"><legend className="sr-only">{step === 1 ? "施設・業種" : "ご予算"}</legend>{(step === 1 ? AD_INDUSTRIES : AD_BUDGETS).map(x => <label key={x} className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${((step === 1 ? industry : budget) === x) ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="radio" name={`ad-step-${step}`} checked={(step === 1 ? industry : budget) === x} onChange={() => step === 1 ? setIndustry(x) : setBudget(x)} className="h-4 w-4 accent-brand" />{x}</label>)}</fieldset>}
            {error && <p role="alert" className="mt-4 text-[14px] font-bold text-red-800">{error}</p>}
            <div className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={() => { setError(null); step ? setStep(step - 1) : move("intro"); }} className="min-h-[48px] px-3 text-[14px] font-bold text-ink-soft">戻る</button><button type="button" onClick={next} className={PRIMARY}>{step === 2 ? "相談の目安を見る" : "次へ"}<ArrowRight className="h-4 w-4" aria-hidden /></button></div>
          </div> : phase === "result" ? <div className="mx-auto max-w-2xl py-2"><p className="text-[13px] font-bold text-brand">ご相談の目安</p><h2 className="mt-3 text-[24px] font-bold leading-[1.5]">{result.title}</h2><p className="mt-4 text-[16px] leading-[1.9]">{result.reason}</p><dl className="mt-5 grid gap-2 rounded-xl bg-paper-sub p-4 text-[14px]"><div><dt className="inline text-ink-soft">工事場所　</dt><dd className="inline font-bold">{pref} {city}</dd></div><div><dt className="inline text-ink-soft">施設・業種　</dt><dd className="inline font-bold">{industry}</dd></div><div><dt className="inline text-ink-soft">予算の目安　</dt><dd className="inline font-bold">{budget}</dd></div></dl><p className="mt-4 text-[14px] leading-[1.8] text-ink-soft">次に法人規模・設備の型番・省エネ量を確認します。申請や採択を約束するものではありません。</p><button type="button" onClick={() => move("form")} className={`${PRIMARY} mt-6 w-full sm:w-auto`}>Zoom相談の候補日時を送る<ArrowRight className="h-4 w-4" aria-hidden /></button><button type="button" onClick={() => { setStep(0); move("check"); }} className="mt-3 block min-h-[44px] text-[14px] font-bold text-ink-soft underline">回答を見直す</button></div> : <div className="mx-auto max-w-3xl">
            <p className="text-[13px] font-bold tracking-wider text-brand">ONLINE CONSULTATION</p><h2 className="mt-2 text-[25px] font-bold">Zoom相談の申し込み</h2><p className="mt-2 text-[15px] leading-[1.8] text-ink-soft">ご希望を3ついただき、担当者が折り返します。写真・型番の準備は、今は必要ありません。</p>
            {isTest && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[14px] font-bold">公開確認テストです。営業対象・月次実績から除外して受け付けます。</p>}
            <form onSubmit={submit} className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2"><label className="block text-[14px] font-bold">法人名・施設名 <span className="text-red-800">必須</span><input required maxLength={80} autoComplete="organization" value={company} onChange={e => setCompany(e.target.value)} className={INPUT} /></label><label className="block text-[14px] font-bold">お名前 <span className="text-red-800">必須</span><input required maxLength={40} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={INPUT} /></label></div>
              <label className="block text-[14px] font-bold">メールアドレス または 電話番号 <span className="text-red-800">どちらか必須</span><input required maxLength={120} value={reach} onChange={e => setReach(e.target.value)} placeholder="name@example.co.jp または 03-1234-5678" className={INPUT} /><span className="mt-1 block text-[12px] font-normal text-ink-soft">折り返しの連絡に使用します。</span></label>
              {variant === "lp" ? <div className="grid gap-4 sm:grid-cols-[160px_1fr]"><label className="block text-[14px] font-bold">工事場所の都道府県<select value={pref} onChange={e => setPref(e.target.value)} className={INPUT}>{AD_PREFS.map(x => <option key={x}>{x}</option>)}</select></label><label className="block text-[14px] font-bold">工事場所の市区町村 <span className="text-red-800">必須</span><input required maxLength={60} autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)} placeholder="例：中野区" className={INPUT} /></label></div> : <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-sub p-4 text-[14px]"><span>工事場所：{pref} {city}</span><button type="button" onClick={() => { setStep(0); move("check"); }} className="min-h-[44px] font-bold text-brand underline">回答を変更</button></div>}
              <ConsultationFields id="ad-zoom-dates" dates={dates} onChange={setDates} />
              <div aria-hidden="true" className="hidden"><label>website<input value={hp} onChange={e => setHp(e.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line p-4 text-[13px] leading-[1.8]"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand" /><span><Link href="/privacy" target="_blank" rel="noopener" className="font-bold text-brand underline">個人情報の取扱い</Link>を確認し、EHCと施工連携先の株式会社プロジェクトネオへの共有に同意します。候補日時は予約の確定ではありません。</span></label>
              <p className="text-[12px] leading-[1.8] text-ink-soft">見積り・図面・省エネの計算などの資料づくりは、工事に至らなかった場合も規模により費用がかかることがあります。費用は事前にご案内します。</p>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-[14px] font-bold leading-relaxed text-red-800">{error}</p>}
              <button type="submit" disabled={busy || uncertain} className={`${PRIMARY} w-full`}>{busy ? "受け付けを確認しています…" : "この候補日時で相談を申し込む"}{!busy && <ArrowRight className="h-4 w-4" aria-hidden />}</button>
              <p className="text-center text-[12px] text-ink-soft">{COMPANY.replyDays}営業日以内を目安にご連絡します。自動メールは送られません。</p>
            </form>
          </div>}
        </div>}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-[24px] bg-brand-deep p-6 text-white sm:p-8"><p className="text-[13px] font-bold text-[#d6ee86]">条件を満たせば、こんな費用の分かれ方に</p><h2 className="mt-3 text-[22px] font-bold">対象経費 {exampleCost.toLocaleString()}万円の場合</h2><div className="mt-5 flex items-end gap-4"><div className="flex-1 border-r border-white/25 pr-4"><p className="text-[13px]">助成の例（{tier.rateLabel}）</p><p className="mt-1 text-[35px] font-bold leading-tight text-[#d6ee86]">{exampleGrant.toLocaleString()}<span className="text-[16px]">万円</span></p></div><div className="flex-1"><p className="text-[13px]">ご負担の例</p><p className="mt-1 text-[35px] font-bold leading-tight">{(exampleCost - exampleGrant).toLocaleString()}<span className="text-[16px]">万円</span></p></div></div><p className="mt-4 text-[12px] leading-[1.8] text-white/85">税抜の例です。消費税・対象外費用は別途ご負担。自分で省エネ計画を作る区分（上限{tier.man?.toLocaleString()}万円）で、CO2削減量などの条件を満たす場合です。実際の金額は審査で決まります。</p></div>
        <div className="rounded-[24px] border border-ink-line bg-white p-6 sm:p-8"><CalendarDays className="h-6 w-6 text-brand" aria-hidden /><h2 className="mt-3 text-[22px] font-bold">発注より先に、申請の準備を。</h2>{finalWindow ? <><p className="mt-3 text-[14px] text-ink-soft">これから準備するなら、{finalWindow.short}</p><p className="mt-1 text-[20px] font-bold leading-relaxed">{ymd(finalWindow.start)}<br className="sm:hidden" /> 〜 {ymd(finalWindow.end)}</p><p className="mt-2 text-[13px] leading-[1.8]">最終日17時必着。見積り・図面・省エネの計算には通常1か月ほど必要です。</p></> : <p className="mt-3 font-bold">公表済みの受付は終了しています。次年度の募集は公式発表を確認してからご案内します。</p>}<p className="mt-4 rounded-xl bg-amber-50 p-3 text-[13px] font-bold leading-[1.8] text-amber-900">交付決定より前の契約・発注は対象外です。工事代は先に全額支払い、助成金は後から入金されます。</p></div>
      </section>

      <section className="mt-12"><p className="text-[12px] font-bold tracking-wider text-brand">EHC TEAM</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><h2 className="text-[25px] font-bold">設備も、建物も。<br className="sm:hidden" />工事のチームが対応します。</h2><Link href="/team" className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-bold text-brand underline">メンバーと実績<ArrowRight className="h-4 w-4" aria-hidden /></Link></div><div className="mt-5 grid gap-4 md:grid-cols-3">{WHY.map((w, i) => <div key={w.head} className="border-t-2 border-ink-line pt-4"><p className="text-[12px] font-bold text-brand">0{i + 1}</p><h3 className="mt-2 text-[17px] font-bold leading-[1.6]">{w.head}</h3><p className="mt-2 text-[14px] leading-[1.9] text-ink-soft">{w.text}</p></div>)}</div><div className="mt-6 rounded-2xl bg-paper-tint p-5"><p className="text-[13px] font-bold">プロジェクトネオの施工実績</p><div className="mt-2 grid gap-2 text-[15px] font-bold sm:grid-cols-2">{BUILD_RECORDS.map(r => <p key={r.name}>{r.name}<span className="mt-1 block text-[13px] font-normal">{r.what}</span></p>)}</div><p className="mt-3 text-[11px] leading-relaxed text-ink-soft">{BUILD_RECORDS_NOTE}</p></div></section>

      <section className="mt-12 grid gap-5 md:grid-cols-[0.6fr_1fr]"><div><ShieldCheck className="h-6 w-6 text-brand" aria-hidden /><h2 className="mt-3 text-[23px] font-bold">相談の前に、<br />ここだけご確認ください。</h2></div><div className="divide-y divide-ink-line border-y border-ink-line">{[
        { q: "どの会社・施設が対象ですか？", a: "都内の中小規模事業所を所有・使用する中小企業、医療法人・社会福祉法人・学校法人などです。法人の規模、所有関係、年間のエネルギー使用量などを個別に確認します。業種だけでは決まりません。" },
        { q: "最大3/4・4,500万円は、誰でも使えますか？", a: `いいえ。CO2を年28トン以上削減する区分の上限です。ほかに2/3・最大2,500万円／1,000万円の区分があります。補助額800万円を超える見込みの、まとまった設備更新を優先してご案内します。` },
        { q: "申請や工事は、誰が進めますか？", a: "EHCのチームが現地調査・機器選定・見積り・図面や省エネ計算などの準備を進めます。申請者はお客様です。申請書類の作成は行政書士へ依頼します。施工範囲・費用は見積りでご案内します。" },
      ].map(x => <details key={x.q} className="group py-1"><summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold">{x.q}<ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden /></summary><p className="pb-4 text-[14px] leading-[1.95] text-ink-soft">{x.a}</p></details>)}</div></section>
      <section className="mt-10 rounded-[24px] bg-paper-tint px-5 py-7 text-center"><h2 className="text-[21px] font-bold">使える条件と、次の一歩を整理しましょう。</h2><button type="button" onClick={start} className={`${PRIMARY} mt-5 w-full sm:w-auto`}>{variant === "lp" ? "Zoom相談の候補日時を送る" : "3項目で、相談の目安を確認"}<ArrowRight className="h-4 w-4" aria-hidden /></button><p className="mt-3 text-[12px] text-ink-soft">予約は自動で確定しません。担当者が折り返して日程を調整します。</p></section>
      <p className="mt-6 text-[11px] leading-[1.8] text-ink-soft">制度：{P.officialName}。掲載内容の確認日：2026年11月3日。募集・要件は変更されることがあります。<a href={P.official[0].url} target="_blank" rel="noopener noreferrer" className="underline">クール・ネット東京の公式情報</a>をご確認ください。予算を超えた場合は抽選です。{windows.length > 1 ? `直近の受付：${ymd(windows[0].start)}〜${ymd(windows[0].end)}。` : ""}準備状況により間に合わない場合があります。</p>
      <button type="button" onClick={() => setShowChoice(true)} className="mt-3 min-h-[44px] text-[12px] text-ink-soft underline">広告計測の設定{choice ? `（${choice === "granted" ? "許可" : "許可しない"}）` : ""}</button>
    </main>
    <SiteFooterSimple />
    {showChoice && <aside aria-label="広告計測の確認" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-2xl border border-ink-line bg-white p-4 shadow-lift"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><p className="flex-1 text-[12px] leading-[1.8]">広告の効果を確認するため、許可された場合にCookieを使い、広告のクリック情報と受付番号をGoogleに送ります。お名前・連絡先・候補日時は計測に送りません。許可しなくても相談できます。<Link href="/privacy" target="_blank" className="ml-1 underline">詳細</Link></p><div className="flex shrink-0 gap-2"><button type="button" onClick={() => choose("denied")} className="min-h-[44px] flex-1 rounded-xl border border-ink-line px-4 text-[12px] font-bold">許可しない</button><button type="button" onClick={() => choose("granted")} className="min-h-[44px] flex-1 rounded-xl bg-brand-deep px-4 text-[12px] font-bold text-white">計測を許可</button></div></div></aside>}
  </div>;
}
