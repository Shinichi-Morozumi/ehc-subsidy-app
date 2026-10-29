"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Loader2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { COMPANY } from "@/lib/company";
import { readConsultation } from "@/lib/consultation";
import ConsultationFields from "@/components/ConsultationFields";
import { captureReferral, currentReferral } from "@/lib/referralClient";
import { referralLinkOf, type ReferralClaim } from "@/lib/referral";
import {
  AC_AGES, AC_TYPES, BUILDING_AGES, CALL_TIMES, CAPACITIES, FACILITIES, PREFS, SCOPES, TROUBLES, WANTS,
  kaigoEstimate, labelOf, sanitizeRef,
  type AcAgeId, type AcTypeId, type BuildingAgeId, type CallTimeId, type CapacityId, type FacilityId,
  type KaigoAnswers, type PrefId, type ScopeId, type TroubleId, type WantId,
} from "@/lib/kaigo";

/* ───────────────────────────────────────────────────────────
   介護施設向け 補助金の事前確認（/kaigo・2026-10-01 EHC-0056）

   紙のパンフの QR から来た方向け。チャットの形で1問ずつ答える（スマホ前提）。
   ・質問1〜6に答えると、使えそうな補助の目安（lib/kaigo.ts の kaigoEstimate）を出す。
   ・質問7（ご連絡先）を送ると、Notion に「未着手」で1行・担当者宛メール（app/api/kaigo-lead）。
   ・紹介コード（URL の ?ref=）は、この端末に30日だけ覚えておく（あとで ref なしで開き直しても数えられるように）。
   　覚えるのは紹介コードだけで、答えや連絡先は端末に残さない。
   ・計測（lib/track.ts）に送るのは段の番号と紹介コードだけ。お名前・連絡先は送らない。
   ・2026-10-14 PJ-20261013-EHC-0070: トップ（/）の紹介リンクと同じ所（lib/referralClient.ts）にも覚える。
   　トップの紹介リンクで来てから /kaigo に移っても、紹介元が切れないようにする。
   　お客様の画面には紹介コードを出さない（「紹介リンクからのご相談」とだけ出す）。
   ─────────────────────────────────────────────────────────── */

const REF_KEY = "ehc_kaigo_ref";
const REF_DAYS = 30;

type Draft = {
  facility?: FacilityId;
  capacity?: CapacityId;
  pref?: PrefId;
  city: string;
  buildingAge?: BuildingAgeId;
  acType?: AcTypeId;
  acAge?: AcAgeId;
  troubles: TroubleId[];
  wants: WantId[];
  noWants: boolean;
};

const QUESTIONS = [
  { q: "施設の種類を教えてください。", hint: null },
  { q: "定員は何人ですか？", hint: "同じ建物の施設の定員でお答えください。" },
  { q: "施設の所在地は？", hint: "市区町村まで分かると、募集の時期をお調べできます（任意）。" },
  { q: "建物の年数は？", hint: "開設、または前回の大規模な修繕からの年数です。" },
  { q: "いまの空調について教えてください。", hint: "種類と年数を選んでください。困りごとはいくつでも。" },
  { q: "空調のほかに、直したい所はありますか？", hint: "どの工事も EHC が対応します。同じ補助の中で、まとめて計画できます。いくつでも選べます。" },
] as const;
const TOTAL_Q = 7;

function readStoredRef(): string | null {
  try {
    const raw = window.localStorage.getItem(REF_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { ref?: string; at?: number };
    if (!v.ref || !v.at || Date.now() - v.at > REF_DAYS * 86400000) return null;
    return sanitizeRef(v.ref);
  } catch {
    return null;
  }
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-[48px] rounded-2xl border px-4 py-2 text-left text-[16px] font-bold leading-[1.5] transition-colors",
        "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
        selected ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line bg-white text-ink hover:border-brand"
      )}
    >
      {children}
    </button>
  );
}

function Bot({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex items-start gap-2">
      <span aria-hidden className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-deep text-[12px] font-bold text-white">EHC</span>
      <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-paper-card px-4 py-3 text-[16px] leading-[1.8] text-ink shadow-soft">{children}</div>
    </div>
  );
}

function Me({ children, onEdit }: { children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-brand-deep px-4 py-3 text-[16px] font-bold leading-[1.7] text-white">{children}</div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="min-h-[32px] text-[14px] font-bold text-brand-deep underline underline-offset-4">
          変更する
        </button>
      )}
    </div>
  );
}

function NextButton({ disabled, onClick, label = "次へ" }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-brand-deep px-4 text-[16px] font-bold text-white hover:bg-brand disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
    >
      {label}
    </button>
  );
}

/* 2026-10-29 EHC-0102: children に制度カード（国の交付金）を受け取り、チャットの下・会社情報の上に置く（/kaigo のページから渡す） */
export function KaigoChat({ children }: { children?: React.ReactNode } = {}) {
  const id = useId();
  const [ref, setRef] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ city: "", troubles: [], wants: [], noWants: false });
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [callTime, setCallTime] = useState<CallTimeId | null>(null);
  const [scope, setScope] = useState<ScopeId | null>(null);
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const openedAt = useRef(Date.now());
  const moved = useRef(false);
  const submittedReferral = useRef<{ claim: ReferralClaim | null } | null>(null);
  const [preferredDates, setPreferredDates] = useState<string[]>(["", "", ""]);
  const consultation = readConsultation({ mode: "zoom", timezone: "Asia/Tokyo", preferredDates });

  /* 紹介コード：URL にあればそれを覚え直す。無ければ30日以内に覚えたものを使う。 */
  useEffect(() => {
    let r: string | null = null;
    try {
      r = sanitizeRef(new URLSearchParams(window.location.search).get("ref"));
      if (r) window.localStorage.setItem(REF_KEY, JSON.stringify({ ref: r, at: Date.now() }));
    } catch {
      /* 端末に保存できなくても進める */
    }
    /* トップと共通の覚え方（保存を断られても、このタブの中では覚える） */
    const shared = captureReferral(window.location.search, "/kaigo");
    const use = shared?.ref ?? r ?? readStoredRef();
    setRef(use);
    track("kaigo_open", { ref: use ?? "none" });
    const link = shared && referralLinkOf(shared.ref);
    if (r && shared && link) track("ref_open", { ref: shared.ref, material: link.material });
  }, []);

  /* 質問が進んだら、いまの質問まで画面を送る（最初の表示では動かさない） */
  useEffect(() => {
    if (!moved.current) return;
    const el = document.getElementById(`${id}-now`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step, receiptNo, id]);

  const go = (n: number) => {
    moved.current = true;
    setStep(n);
    if (n <= 6) track("kaigo_step", { step: n + 1 });
    if (n === 6) track("kaigo_result", { ref: ref ?? "none" });
  };
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const toggle = <T extends string>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const answers: KaigoAnswers | null =
    d.facility && d.capacity && d.pref && d.buildingAge && d.acType && d.acAge
      ? { facility: d.facility, capacity: d.capacity, pref: d.pref, city: d.city.trim() || null, buildingAge: d.buildingAge, acType: d.acType, acAge: d.acAge, troubles: d.troubles, wants: d.wants }
      : null;
  const estimate = answers ? kaigoEstimate(answers) : null;

  const summaries: (string | null)[] = [
    d.facility ? labelOf(FACILITIES, d.facility) : null,
    d.capacity ? labelOf(CAPACITIES, d.capacity) : null,
    d.pref ? `${labelOf(PREFS, d.pref)}${d.city.trim() ? ` ${d.city.trim()}` : ""}` : null,
    d.buildingAge ? labelOf(BUILDING_AGES, d.buildingAge) : null,
    d.acType && d.acAge
      ? `${labelOf(AC_TYPES, d.acType)}・${labelOf(AC_AGES, d.acAge)}${d.troubles.length ? `／${d.troubles.map((t) => labelOf(TROUBLES, t)).join("、")}` : ""}`
      : null,
    d.wants.length ? d.wants.map((w) => labelOf(WANTS, w)).join("、") : d.noWants ? "特にない" : null,
  ];

  const phoneOk = /^[0-9０-９+＋()（）\-－ー‐\s]{10,20}$/.test(phone.trim());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const errs = {
    company: touched && !company.trim() ? "法人名・施設名をご入力ください。" : null,
    name: touched && !name.trim() ? "お名前をご入力ください。" : null,
    reach:
      touched && !phone.trim() && !email.trim()
        ? "お電話番号かメールアドレスの、どちらかをご入力ください。"
        : touched && phone.trim() && !phoneOk
          ? "お電話番号をご確認ください（例：03-1234-5678）。"
          : touched && email.trim() && !emailOk
            ? "メールアドレスの形式をご確認ください（例：name@example.co.jp）。"
            : null,
    consent: touched && !consent ? "内容をご確認のうえ、チェックを入れてください。" : null,
  };

  const submit = async () => {
    setTouched(true);
    setError(null);
    const reachOk = (phone.trim() || email.trim()) && (!phone.trim() || phoneOk) && (!email.trim() || emailOk);
    if (!answers || !company.trim() || !name.trim() || !reachOk || !consent || busy || consultation.error) return;
    setBusy(true);
    if (!submittedReferral.current) submittedReferral.current = { claim: currentReferral() };
    try {
      const res = await fetch("/api/kaigo-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          contact: { company: company.trim(), name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, scope, callTime, consultation: consultation.value },
          consent,
          ref,
          referral: submittedReferral.current.claim,
          hp,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; receiptNo?: string } | null;
      if (!res.ok || !json?.ok || !json.receiptNo) {
        track("kaigo_submit", { ok: false, ref: ref ?? "none" });
        setError(json?.error || `送信できませんでした。時間をおいて、もう一度お試しください。お急ぎの場合はお電話（${COMPANY.tel}）でどうぞ。`);
        return;
      }
      track("kaigo_submit", { ok: true, ref: ref ?? "none" });
      const sentRef = submittedReferral.current.claim?.ref;
      if (sentRef && referralLinkOf(sentRef)) track("ref_submit", { ref: sentRef, ok: true });
      moved.current = true;
      setReceiptNo(json.receiptNo);
    } catch {
      track("kaigo_submit", { ok: false, ref: ref ?? "none" });
      setError("通信に失敗しました。電波の良い場所で、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = (bad: boolean) =>
    cn(
      "mt-1 min-h-[48px] w-full rounded-xl border bg-white px-3 text-[16px] leading-[1.6] text-ink",
      "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
      bad ? "border-red-700" : "border-ink-line"
    );

  /* いまの質問の入力欄 */
  const current = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FACILITIES.map((f) => (
              <Chip key={f.id} selected={d.facility === f.id} onClick={() => { set({ facility: f.id }); go(1); }}>{f.label}</Chip>
            ))}
          </div>
        );
      case 1:
        return (
          <div className="flex flex-wrap gap-2">
            {CAPACITIES.map((c) => (
              <Chip key={c.id} selected={d.capacity === c.id} onClick={() => { set({ capacity: c.id }); go(2); }}>{c.label}</Chip>
            ))}
          </div>
        );
      case 2:
        return (
          <div>
            <div className="flex flex-wrap gap-2">
              {PREFS.map((p) => (
                <Chip key={p.id} selected={d.pref === p.id} onClick={() => set({ pref: p.id })}>{p.label}</Chip>
              ))}
            </div>
            <label htmlFor={`${id}-city`} className="mt-3 block text-[14px] font-bold text-ink">市区町村（任意）</label>
            <input id={`${id}-city`} type="text" autoComplete="address-level2" value={d.city} onChange={(e) => set({ city: e.target.value })} placeholder="例：世田谷区" className={inputCls(false)} />
            <NextButton disabled={!d.pref} onClick={() => go(3)} />
          </div>
        );
      case 3:
        return (
          <div className="flex flex-wrap gap-2">
            {BUILDING_AGES.map((b) => (
              <Chip key={b.id} selected={d.buildingAge === b.id} onClick={() => { set({ buildingAge: b.id }); go(4); }}>{b.label}</Chip>
            ))}
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            <fieldset>
              <legend className="text-[14px] font-bold text-ink">空調の種類</legend>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AC_TYPES.map((a) => <Chip key={a.id} selected={d.acType === a.id} onClick={() => set({ acType: a.id })}>{a.label}</Chip>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[14px] font-bold text-ink">使っている年数</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {AC_AGES.map((a) => <Chip key={a.id} selected={d.acAge === a.id} onClick={() => set({ acAge: a.id })}>{a.label}</Chip>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[14px] font-bold text-ink">困りごと（いくつでも）</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {TROUBLES.map((t) => <Chip key={t.id} selected={d.troubles.includes(t.id)} onClick={() => set({ troubles: toggle(d.troubles, t.id) })}>{t.label}</Chip>)}
              </div>
            </fieldset>
            <NextButton disabled={!d.acType || !d.acAge} onClick={() => go(5)} />
          </div>
        );
      case 5:
        return (
          <div>
            <div className="flex flex-wrap gap-2">
              {WANTS.map((w) => (
                <Chip key={w.id} selected={d.wants.includes(w.id)} onClick={() => set({ wants: toggle(d.wants, w.id), noWants: false })}>{w.label}</Chip>
              ))}
              <Chip selected={d.noWants && !d.wants.length} onClick={() => set({ wants: [], noWants: true })}>特にない</Chip>
            </div>
            <NextButton disabled={!d.wants.length && !d.noWants} onClick={() => go(6)} label="結果を見る" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-paper pb-16 text-ink">
      <header className="sticky top-0 z-10 border-b border-ink-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="text-[15px] font-bold leading-tight text-brand-deep">
            EHCソリューションズ
            <span className="block text-[12px] font-normal text-ink-soft">介護施設の補助金 事前確認</span>
          </Link>
          <a
            href={COMPANY.telHref}
            onClick={() => track("kaigo_call", { place: "header" })}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-brand-deep px-3 text-[14px] font-bold text-brand-deep"
          >
            <Phone aria-hidden className="h-4 w-4" />電話で相談
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        <section className="pt-4">
          <Image
            src="/kaigo/hero.jpg"
            alt="猛暑の日の介護施設と、涼しい室内で水を受け取る入居者と職員のイラスト"
            width={1600}
            height={900}
            priority
            sizes="(max-width: 672px) 100vw, 640px"
            className="h-auto w-full rounded-2xl"
          />
          <p className="mt-4 inline-block rounded-xl bg-paper-tint px-3 py-1 text-[14px] font-bold text-brand-deep">定員29人以下の介護施設なら</p>
          <h1 className="mt-2 text-[26px] font-bold leading-[1.45] sm:text-[30px]">
            {/* 2026-10-29 ご指示「空調の入れ替えだけじゃない」：建物と設備の大規模修繕に使えることを見出しで伝える */}
            空調も、建物と設備の修繕も。<br className="sm:hidden" />国の補助 <span className="whitespace-nowrap rounded-lg bg-[#B8913A] px-2 text-white">10/10</span><span className="ml-1 whitespace-nowrap text-[16px] font-bold sm:text-[18px]">（上限の額まで）</span>
          </h1>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="使える工事の例">
            {["空調（冷暖房）", "照明", "電気設備", "給排水・給湯", "ガス設備", "消防用設備", "防水・外壁・浴室", "バリアフリー・避難経路", "非常用自家発電"].map((w) => (
              <li key={w} className="rounded-full bg-[#F6EED9] px-3 py-1 text-[13px] font-bold text-[#7A5E22]">{w}</li>
            ))}
          </ul>
          <p className="mt-3 text-[16px] leading-[1.8] text-ink-soft">
            定員29人以下の介護施設は、建物と設備をまとめて直す大規模修繕に、1施設あたり最大1,660万円まで（施設の種類により833万円）。市区町村を通じた国の交付金です。どの工事も EHC のチームでまとめてお受けします。
            上限を超える分と消費税は施設の負担です。補助金は工事のあとが基本です。市区町村によっては、工事の前に受け取れる場合もあります（前払い＝概算払）。
          </p>
          <p className="mt-3 text-[15px] leading-[1.8]">
            定員30人以上の施設や、都内の特養・養護老人ホームには、ほかの補助もあります。
            <Link href="/shindan?for=kaigo" className="ml-1 font-bold text-brand-deep underline underline-offset-4">使える補助金を調べる</Link>
          </p>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            自治体ごとの受付・予算は確認が必要です。以下は2026年10月29日に公表資料で確かめた条件で、受付中や受給額の確定を示すものではありません。
          </p>
        </section>

        <section id="kaigo-chat" aria-label="事前確認のチャット" className="mt-6 scroll-mt-24 space-y-4" aria-live="polite">
          <Bot>
            介護施設の補助金を、事前に確認します。いくつかの質問に答えると、使えそうな補助と次にやることが分かります。チャットでの事前確認に費用はかかりません。
          </Bot>

          {QUESTIONS.map((item, i) => {
            if (i > step) return null;
            const isNow = i === step && !receiptNo;
            return (
              <div key={i} className="space-y-3">
                <Bot id={isNow ? `${id}-now` : undefined}>
                  <span className="mr-2 inline-block rounded-md bg-paper-pill px-2 text-[12px] font-bold text-brand-deep">質問 {i + 1}/{TOTAL_Q}</span>
                  <b>{item.q}</b>
                  {item.hint && <span className="mt-1 block text-[14px] leading-[1.7] text-ink-soft">{item.hint}</span>}
                </Bot>
                {i < step && summaries[i] ? <Me onEdit={receiptNo ? undefined : () => { moved.current = true; setStep(i); }}>{summaries[i]}</Me> : null}
                {isNow && <div className="pl-10">{current()}</div>}
              </div>
            );
          })}

          {step >= 6 && estimate && (
            <div className="space-y-3">
              <Bot id={!receiptNo ? `${id}-now` : undefined}>
                <span className="block text-[14px] font-bold text-ink-soft">使えそうな補助（目安）</span>
                <b className="mt-1 block text-[18px] leading-[1.6] text-brand-deep">{estimate.headline}</b>
              </Bot>
              <div className="space-y-2 pl-10">
                {estimate.programs.map((p) => (
                  <div key={p.key} className={cn("rounded-2xl border bg-white p-4", p.level === "main" ? "border-[#B8913A]" : "border-ink-line")}>
                    <p className="text-[12px] font-bold text-ink-soft">{p.level === "main" ? "対象になり得ます" : p.level === "maybe" ? "条件しだいで" : "ほかの選択肢"}</p>
                    <p className="mt-1 text-[16px] font-bold leading-[1.6]">{p.name}</p>
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-[16px]">
                      <span className="rounded-md bg-brand-deep px-2 font-bold text-white">{p.rate}</span>
                      <span className="font-bold">{p.cap}</span>
                    </p>
                    <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">{p.note}</p>
                  </div>
                ))}
                <ul className="list-disc space-y-1 rounded-2xl bg-paper-sub p-4 pl-8 text-[14px] leading-[1.7] text-ink-soft">
                  {estimate.cautions.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
              <Bot>
                このあと EHC が、所在地の募集の時期を確かめ、<b>現地調査</b>の日程をご相談します。
                市区町村への相談の段取り・申請の準備から、工事・完了報告まで、まとめてお手伝いします。空調だけでなく、照明・電気・給排水・防水などの工事も EHC が対応します（申請書類の作成は行政書士が担当・EHC が手配します）。
                <span className="mt-1 block text-[14px] text-ink-soft">質問 7/7：ご連絡先を教えてください。</span>
              </Bot>

              {!receiptNo && (
                <div className="space-y-4 pl-10">
                  <div>
                    <label htmlFor={`${id}-company`} className="block text-[14px] font-bold text-ink">法人名・施設名<span className="ml-1 text-red-800">必須</span></label>
                    <input id={`${id}-company`} type="text" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} aria-invalid={!!errs.company || undefined} className={inputCls(!!errs.company)} />
                    {errs.company && <p className="mt-1 text-[14px] font-bold text-red-800">{errs.company}</p>}
                  </div>
                  <div>
                    <label htmlFor={`${id}-name`} className="block text-[14px] font-bold text-ink">お名前<span className="ml-1 text-red-800">必須</span></label>
                    <input id={`${id}-name`} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errs.name || undefined} className={inputCls(!!errs.name)} />
                    {errs.name && <p className="mt-1 text-[14px] font-bold text-red-800">{errs.name}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`${id}-phone`} className="block text-[14px] font-bold text-ink">お電話番号</label>
                      <input id={`${id}-phone`} type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errs.reach || undefined} className={inputCls(!!errs.reach)} />
                    </div>
                    <div>
                      <label htmlFor={`${id}-email`} className="block text-[14px] font-bold text-ink">メールアドレス</label>
                      <input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.reach || undefined} className={inputCls(!!errs.reach)} />
                    </div>
                  </div>
                  <p className="-mt-2 text-[14px] text-ink-soft">お電話かメールの、どちらかは必須です。</p>
                  {errs.reach && <p className="-mt-2 text-[14px] font-bold text-red-800">{errs.reach}</p>}
                  <ConsultationFields id={`${id}-consultation`} dates={preferredDates} onChange={setPreferredDates} error={touched ? consultation.error : null} />
                  <fieldset>
                    <legend className="text-[14px] font-bold text-ink">ご連絡の希望（任意）</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {CALL_TIMES.map((c) => <Chip key={c.id} selected={callTime === c.id} onClick={() => setCallTime(callTime === c.id ? null : c.id)}>{c.label}</Chip>)}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-[14px] font-bold text-ink">ご相談の範囲（任意）</legend>
                    <div className="mt-1 grid grid-cols-1 gap-2">
                      {SCOPES.map((s) => <Chip key={s.id} selected={scope === s.id} onClick={() => setScope(scope === s.id ? null : s.id)}>{s.label}</Chip>)}
                    </div>
                  </fieldset>
                  <div style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                    <label htmlFor={`${id}-hp`}>この欄は空のままにしてください</label>
                    <input id={`${id}-hp`} name="ehc_hp_website" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
                  </div>
                  <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-paper-sub p-3 text-[16px] leading-[1.7]">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errs.consent || undefined} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
                    <span>
                      ご相談への連絡のために、入力した内容を EHC が使うことに同意します（
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-deep underline underline-offset-4">
                        プライバシーポリシー<span className="sr-only">（新しいタブで開きます）</span>
                      </a>
                      ）。
                    </span>
                  </label>
                  {errs.consent && <p className="-mt-2 text-[14px] font-bold text-red-800">{errs.consent}</p>}
                  {error && <p role="alert" className="rounded-xl border border-red-700/40 bg-red-50 px-4 py-3 text-[14px] font-bold leading-[1.7] text-red-800">{error}</p>}
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={busy}
                    className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep px-4 text-[17px] font-bold text-white hover:bg-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                  >
                    {busy && <Loader2 aria-hidden className="h-5 w-5 animate-spin" />}
                    {busy ? "送信しています…" : "この内容で相談する"}
                  </button>
                </div>
              )}
            </div>
          )}

          {receiptNo && (
            <div id={`${id}-now`} className="space-y-3">
              <Bot>
                <span className="flex items-start gap-2">
                  <CheckCircle2 aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand-deep" />
                  <span>
                    <b>受け付けました。</b>受付番号 <b>{receiptNo}</b>
                    <span className="mt-1 block">{COMPANY.replyDays}営業日以内に、担当からご連絡します。お急ぎの場合は、お電話（{COMPANY.tel}・{COMPANY.hours}）でどうぞ。</span>
                  </span>
                </span>
              </Bot>
              <div className="space-y-3 pl-10">
                <p className="rounded-2xl bg-paper-sub p-4 text-[15px] leading-[1.8]">候補日時を3件受け付けました。担当者が折り返し、Zoomの日時・URLをご案内します。まだ予約は確定していません。</p>
                <div className="rounded-2xl border border-ink-line bg-white p-4 text-[15px] leading-[1.8]">
                  <p className="font-bold">ご用意いただくと早いもの</p>
                  <p className="mt-1"><b>空調の場合：</b>施設の種類・定員、開設年・前回の大規模修繕の年、空調の台数・年式（室外機の銘板の写真）、電気料金の明細（12か月分）、図面（あれば）</p>
                  <p className="mt-1"><b>施設全体を見る場合：</b>物件一覧と、設備等のリスト</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {step > 0 && !receiptNo && (
          <p className="mt-6">
            <button type="button" onClick={() => { moved.current = true; setStep(Math.max(0, Math.min(step, 6) - 1)); }} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-deep underline underline-offset-4">
              <ChevronLeft aria-hidden className="h-4 w-4" />ひとつ前の質問へ
            </button>
          </p>
        )}

        {children}

        <footer className="mt-10 border-t border-ink-line pt-4 text-[13px] leading-[1.8] text-ink-soft">
          <p className="font-bold text-ink">{COMPANY.name}</p>
          <p>{COMPANY.address}</p>
          <p>
            電話 <a href={COMPANY.telHref} onClick={() => track("kaigo_call", { place: "footer" })} className="font-bold text-brand-deep underline underline-offset-4">{COMPANY.tel}</a>（受付 {COMPANY.hours}）／ <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-4">{COMPANY.email}</a>
          </p>
          <p className="mt-2">
            制度の内容は2026年10月29日に確かめた公表資料によります。採択と金額は審査と自治体の要綱で決まり、お約束するものではありません。
          </p>
          {ref && <p className="mt-2">紹介リンクからのご相談として受け付けます。</p>}
        </footer>
      </div>
    </main>
  );
}
