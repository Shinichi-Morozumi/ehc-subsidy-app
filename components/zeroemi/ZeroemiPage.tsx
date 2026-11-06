"use client";
/* ───────────────────────────────────────────────────────────
   v3 / 2026-11-06 / EHC-0150 ゼロエミ専用ページ（広告の遷移先・東京都内の事業者向け）
   ・v3：1ページ＋上の切り替え（空調・照明など／冷凍冷蔵庫・ショーケース）にまとめた。/zeroemi/reizo は冷凍冷蔵側で開く。
     簡易診断は5問（ほかの補助金の予定を追加）。結果に「併用の判定」（同じ機械に2制度は不可・国の補助とは不可・同じ事業所は1回 など）。
   ・v2：スマホで見やすく（助成の3枚・工事の種類・7段を縦の短い並びに、冷凍冷蔵の表を機械ごとのカードに、
     小さい文字を13px以上に、診断の「次へ」を画面下に固定、下の貼り付けボタンは同じボタンが見えている間は出さない）
   ・kind="kucho"（/zeroemi・空調）と kind="reizo"（/zeroemi/reizo・冷凍冷蔵庫・ショーケース）。
   ・流れ：5問の簡易診断 → 結果と助成の目安・併用の判定 → そのまま問い合わせ。
     Zoom面談を希望するなら空き枠から予約（サーバでZoomと照合してから送信）、希望しないなら電話かメールで折り返し。
   ・見た目は手渡し用チラシ（EHC-0145 v3・EHC-0146 v3）と同じ：写真・最大3/4・赤い締切・日付入りの7段。
   ・決め事は lib/zeroemiFlow.ts。送信は既存の /api/program-lead（Notion・担当者メール・受付番号は今までと同じ）。
   ─────────────────────────────────────────────────────────── */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AirVent, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, Droplets, Fan, Lightbulb, Phone, ShieldCheck, Video, Zap } from "lucide-react";
import ZoomBookingPicker from "@/components/ZoomBookingPicker";
import { ReferralCapture } from "@/components/programs/ReferralCapture";
import { SiteFooterSimple } from "@/components/programs/SiteShell";
import { COMPANY } from "@/lib/company";
import { PROGRAMS, jaDate } from "@/lib/programs";
import { BUILD_RECORDS, BUILD_RECORDS_NOTE, WHY } from "@/lib/team";
import { chooseAdMeasurement, enableAdMeasurement, measurementChoice, recordAdConversion, recordQaConversion } from "@/lib/adMeasurement";
import { currentReferral } from "@/lib/referralClient";
import { referralLinkOf } from "@/lib/referral";
import { splitReach } from "@/lib/programLead";
import { track } from "@/lib/track";
import { captureLeadContext, currentLeadContext } from "@/lib/leadContextClient";
import { bookingDate, type ZoomBooking } from "@/lib/zoomBooking";
import {
  NONFURON_END, NONFURON_URL, ZEROEMI_REPORT_END, ZE_BUDGETS, ZE_EQUIP, ZE_ORGS, ZE_OTHERS, ZE_PLACES,
  judgeZeroemi, zeroemiTargetWindow, type ZeBudget, type ZeOrg, type ZeOther, type ZePlace, type ZeroemiAnswers, type ZeroemiContact, type ZeroemiKind,
} from "@/lib/zeroemiFlow";

const P = PROGRAMS.tokyoZeroemi;
const PRIMARY = "inline-flex min-h-[54px] items-center justify-center gap-3 rounded-full bg-brand-deep px-6 py-3 text-[16px] font-bold text-white shadow-card hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:opacity-60";
const INPUT = "mt-2 min-h-[52px] w-full min-w-0 rounded-xl border border-ink-line bg-white px-3 py-2 text-[16px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
const RED = "#DC2626";
/* 節の見出し：スマホは少し小さく・行間を詰めて2行以内に */
const H2 = "text-[21px] font-bold leading-snug sm:text-[24px]";
/* EHCの準備の目安（第6回 2027/1/29 に向けた日程。公式の日程ではない。クロ版営業ガイド v6 と同じ） */
const SIXTH_END = "2027-01-29";

const CFG = {
  kucho: {
    path: "/zeroemi" as const,
    source: "zeroemi" as const,
    hero: "/zeroemi/kucho-hero.webp",
    heroAlt: "天井に業務用エアコンが並ぶ明るいオフィス（イメージ）",
    heroPos: "50% 6%",
    over: "空調・照明などを入れ替える、都内の事業所さまへ（業種は問いません）",
    titleA: "空調の入れ替え費用の",
    sub: "古い空調・照明などを省エネ型に入れ替える工事に使える、東京都の補助金「ゼロエミ」",
    tiles: [
      { k: "CO2を年28トン以上 減らす", n: "最大 3/4", c: "上限4,500万円。届くかは東京都の計算シートで確かめます", col: "#1E8E5A" },
      { k: "東京都の省エネ診断か、自分の計画で年3トン以上か30%以上 減らす", n: "2/3", c: "上限2,500万円（診断）／1,000万円（自分の計画）", col: "#2563A8" },
      { k: "例：補助の対象になる費用が1,000万円", n: "助成 750万円", c: "28トン以上の場合（2/3の区分なら667万円）", col: "#B45309" },
    ],
  },
  reizo: {
    path: "/zeroemi/reizo" as const,
    source: "zeroemiReizo" as const,
    hero: "/zeroemi/reizo-hero.webp",
    heroAlt: "冷蔵ショーケースが並ぶお店の通路（イメージ）",
    heroPos: "50% 40%",
    over: "冷凍冷蔵庫・ショーケースを入れ替える、お店・工場・倉庫の事業者さまへ",
    titleA: "冷凍冷蔵庫・ショーケースの入れ替え費用の",
    sub: "省エネ型や、フロンを使わない新しい機械への入れ替えに使える、東京都の2つの制度",
    tiles: [
      { k: "【1】ゼロエミ（省エネの機械へ）", n: "最大 3/4", c: "上限4,500万円（CO2を年28トン以上減らす場合）", col: "#1E8E5A" },
      { k: "【2】ノンフロン機器（フロンを使わない機械へ）", n: "最大 6,700万円", c: "1台あたりの上限（中小企業など・助成率2/3）", col: "#0E7490" },
      { k: "例：別置型ショーケース一式 900万円", n: "助成 600万円", c: "【2】・中小企業の場合の目安（仮の金額）", col: "#B45309" },
    ],
  },
} as const;

const KUCHO_WORKS = [
  { icon: AirVent, t: "高効率な空調", d: "同じ能力で年間の効率が上がる機種" },
  { icon: Fan, t: "換気設備", d: "全熱交換器など" },
  { icon: Lightbulb, t: "LED照明", d: "人感センサー・スイッチの細分化も" },
  { icon: Droplets, t: "給湯・ボイラー", d: "高効率な機種へ" },
  { icon: Zap, t: "変圧器など", d: "断熱窓・コンプレッサも対象" },
];
/* EHC-0136（冷凍冷蔵の総合版）の早見表と同じ。○＝対象 △＝条件しだい ×＝対象外 */
const REIZO_MATRIX = [
  { name: "内蔵型ショーケース（コンセント式）", ze: ["○", "インバータ圧縮機・組込の高効率照明の機種"], nf: ["○", "自然冷媒の機種。上限270万円/台（中小）"] },
  { name: "別置型ショーケース（冷凍機が別）", ze: ["○", "インバータ圧縮機の冷凍機など"], nf: ["○", "自然冷媒。冷凍機とセット。上限2,200万円/台（中小）"] },
  { name: "プレハブ冷蔵庫・冷凍庫の冷凍機", ze: ["○", "インバータ圧縮機の機種"], nf: ["○", "自然冷媒。上限6,700万円/台（中小）"] },
  { name: "業務用冷凍冷蔵庫・コールドテーブル", ze: ["△", "インバータ圧縮機の機種なら対象になりうる（機種ごとに確認）"], nf: ["×", "対象外"] },
  { name: "チリングユニット", ze: ["△", "機種ごとに確認"], nf: ["○", "自然冷媒。上限6,700万円/台（中小）"] },
] as const;
/* ゼロエミとノンフロンのちがい（どちらも候補になる冷凍冷蔵の機械があるときに結果に出す）。出典は zeroemiFlow.ts の冒頭 */
const COMPARE_ROWS: { k: string; ze: string; nf: string; zeLarge?: string; nfLarge?: string }[] = [
  { k: "助成の割合", ze: "最大3/4（CO2を年28トン以上減らす場合）、ほかは2/3", nf: "2/3", zeLarge: "大企業は対象外", nfLarge: "1/2（大企業）" },
  { k: "上限", ze: "1つの申請で4,500万円（空調などと合わせて）", nf: "機械1台ごと（例：別置型ショーケース2,200万円）", nfLarge: "機械1台ごと（例：別置型ショーケース1,600万円）" },
  { k: "受付", ze: "年6回。各回の締切・予算を超えたら抽選", nf: "先着順。2027年3月31日まで（予算に達したら終了）" },
  { k: "対象の機種", ze: "インバータ圧縮機などの省エネ機種", nf: "自然冷媒（CO2・プロパンなど）の機種だけ" },
];
const markColor = (m: string) => (m === "○" ? "#1E8E5A" : m === "△" ? "#B45309" : "#B91C1C");

type Phase = "intro" | "check" | "result" | "form";

export function ZeroemiPage({ kind: initialKind, today }: { kind: ZeroemiKind; today: string }) {
  /* 1ページ＋切り替え。kind は「いま表示している方」。開いたURLで初期値が決まる */
  const [kind, setKind] = useState<ZeroemiKind>(initialKind);
  const cfg = CFG[kind];
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<ZePlace | "">("");
  const [city, setCity] = useState("");
  const [org, setOrg] = useState<ZeOrg | "">("");
  const [equip, setEquip] = useState<string[]>([]);
  const [budget, setBudget] = useState<ZeBudget | "">("");
  const [others, setOthers] = useState<ZeOther[]>([]);
  const [contact, setContact] = useState<ZeroemiContact | "">("");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reach, setReach] = useState("");
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState<ZoomBooking | null>(null);
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [sentContact, setSentContact] = useState<ZeroemiContact | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [choice, setChoice] = useState<"granted" | "denied" | null>(null);
  const [showChoice, setShowChoice] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [campaign, setCampaign] = useState<string | null>(null);
  const requestId = useRef("");
  const openedAt = useRef(0);
  const inFlight = useRef(false);
  const entry = useRef<HTMLElement>(null);
  const heroCta = useRef<HTMLButtonElement>(null);
  const panelCta = useRef<HTMLButtonElement>(null);
  const endCta = useRef<HTMLButtonElement>(null);
  const [ctaInView, setCtaInView] = useState(true);

  const answers: ZeroemiAnswers | null = place && org && budget && equip.length && others.length ? { kind, place, city: city.trim(), org, equip, budget, others } : null;
  const judge = answers ? judgeZeroemi(answers) : null;
  const { target, tooSoon } = zeroemiTargetWindow(today);
  const sixth = target?.end === SIXTH_END;
  const receiptKey = "ehc_ze_receipt";

  useEffect(() => {
    openedAt.current = Date.now();
    requestId.current = crypto.randomUUID();
    const q = new URLSearchParams(window.location.search);
    const context = captureLeadContext();
    setIsTest(context.test);
    const utm = q.get("utm_campaign");
    setCampaign(utm && /^[a-z0-9_]{1,60}$/.test(utm) ? utm : null);
    const saved = measurementChoice();
    setChoice(saved); setShowChoice(saved === null);
    if (saved === "granted") enableAdMeasurement();
    if (!context.test) track("ze_open", { kind });
    // 成功後の再読込でも、連絡先は端末に保存せず受付番号だけを出す。
    try {
      const last = sessionStorage.getItem(receiptKey);
      if (last && /^EHC-[0-9a-f-]{36}$/i.test(last)) {
        setReceipt(last); setPhase("form");
        if (sessionStorage.getItem(`ehc_ze_eligible:${last}`) === "1") recordAdConversion(last);
      }
    } catch { /* 保存できなくても入力・送信はできる */ }
    // 開いたときの表示だけ記録する（切り替えでは数え直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptKey]);

  /* スマホの貼り付けボタンは、ページ内の同じボタン（写真の上・診断の枠・ページ末尾）が見えていない時だけ出す */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setCtaInView(false); return; }
    const seen = new Set<Element>();
    const io = new IntersectionObserver((list) => {
      list.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      setCtaInView(seen.size > 0);
    }, { threshold: 0.5 });
    [heroCta.current, panelCta.current, endCta.current].forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [phase, receipt]);

  const scrollToEntry = () => requestAnimationFrame(() => entry.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const move = (next: Phase) => {
    setError(null); setPhase(next);
    if (!isTest && next === "form") track("ze_form", { kind, contact: contact || "none" });
    scrollToEntry();
  };
  const start = () => { if (phase === "intro") { setStep(0); move("check"); } else scrollToEntry(); };
  const choose = (v: "granted" | "denied") => { chooseAdMeasurement(v); setChoice(v); setShowChoice(false); };
  const toggleEquip = (id: string) => setEquip((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  /* 「特にない・分からない」は他と同時に選ばない */
  const toggleOther = (id: ZeOther) => setOthers((cur) => id === "none" ? (cur.includes("none") ? [] : ["none"]) : (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.filter((x) => x !== "none"), id]));
  /* 切り替え：表示とURLだけ変える（答えはそのまま。どちらの表示からでも両方の設備を選べる） */
  const switchKind = (k: ZeroemiKind) => {
    if (k === kind) return;
    setKind(k);
    try { window.history.replaceState(window.history.state, "", `${CFG[k].path}${window.location.search}`); } catch { /* URLが変えられなくても表示は切り替わる */ }
    if (!isTest) track("ze_tab", { kind: k });
  };

  const next = () => {
    if (step === 0 && !place) { setError("工事をする場所をお選びください。"); return; }
    if (step === 0 && place === "tokyo" && !city.trim()) { setError("工事をする区市町村をご入力ください（例：中野区）。"); return; }
    if (step === 1 && !org) { setError("会社の区分をお選びください。分からなくても進めます。"); return; }
    if (step === 2 && !equip.length) { setError("入れ替えたいものを1つ以上お選びください。"); return; }
    if (step === 3 && !budget) { setError("予算の目安をお選びください。分からなくても進めます。"); return; }
    if (step === 4 && !others.length) { setError("ほかの補助金の予定をお選びください。なければ「特にない・分からない」を。"); return; }
    setError(null);
    if (step === 4) { if (!isTest) track("ze_result", { kind, level: judgeZeroemi({ kind, place: place as ZePlace, city, org: org as ZeOrg, equip, budget: budget as ZeBudget, others }).level }); move("result"); }
    else { setStep(step + 1); if (!isTest) track("ze_step", { kind, step: step + 2 }); }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inFlight.current || uncertain || receipt || !answers) return;
    if (!company.trim() || !name.trim()) { setError("法人名・施設名と、お名前をご入力ください。"); return; }
    if (!contact) { setError("連絡の方法をお選びください。"); return; }
    const reachValue = contact === "zoom" ? email.trim() : reach.trim();
    const r = splitReach(reachValue || null);
    if (r.error) { setError(contact === "zoom" ? "Zoomの予約に使うメールアドレスをご入力ください。" : r.error); return; }
    if (contact === "zoom" && (!r.email || !booking?.start)) { setError("Zoomの空き枠から予約してから送ってください。予約しない場合は「電話かメールで連絡がほしい」をお選びください。"); return; }
    if (!consent) { setError("個人情報の取扱いをご確認のうえ、同意の欄にチェックを入れてください。"); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const res = await fetch("/api/program-lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(), name: name.trim(), reach: reachValue, consent, source: cfg.source, programIds: ["tokyoZeroemi"],
          requestId: requestId.current, note: note.trim() || null, context: currentLeadContext(), referral: currentReferral(), hp, elapsedMs: Date.now() - openedAt.current,
          ...(contact === "zoom" && booking ? { consultation: { mode: "zoom", timezone: "Asia/Tokyo", booking: { eventId: booking.eventId, attendeeId: booking.attendeeId } } } : {}),
          zeroemi: { kind, answers, contact, campaign, test: isTest },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || typeof json.receiptNo !== "string") {
        if (res.status >= 500) setUncertain(true);
        setError(json?.error || `送信を確認できませんでした。再送せず、お電話（${COMPANY.tel}）でご確認ください。`);
        if (!isTest) track("ze_submit", { kind, ok: false });
        return;
      }
      setReceipt(json.receiptNo); setSentContact(contact);
      setWarning(json.warning ?? null);
      if (json.qaCvEligible) recordQaConversion(json.receiptNo);
      try { sessionStorage.setItem(receiptKey, json.receiptNo); } catch { /* 連絡先は端末に保存しない */ }
      if (!isTest) track("ze_submit", { kind, ok: true });
      const sentRef = currentReferral()?.ref;
      if (sentRef && referralLinkOf(sentRef) && json.cvEligible) track("ref_submit", { ref: sentRef, ok: true });
      if (json.cvEligible && !isTest) {
        try { sessionStorage.setItem(`ehc_ze_eligible:${json.receiptNo}`, "1"); } catch { /* メモリでも重複を防ぐ */ }
        recordAdConversion(json.receiptNo);
      }
      scrollToEntry();
    } catch {
      setUncertain(true);
      setError(`通信の結果を確認できませんでした。再送せず、${COMPANY.tel} に受付番号 EHC-${requestId.current} をお知らせください。`);
      if (!isTest) track("ze_submit", { kind, ok: false });
    } finally { inFlight.current = false; setBusy(false); }
  };

  const deadlineCells = kind === "kucho"
    ? [
        { head: target ? `${target.short.replace("（最終回）", "")}${sixth ? "（今年度の最終回）" : ""}` : "受付", date: target?.end ?? null, time: "17時", note: target ? `受付は${jaDate(target.start ?? target.end, false)}9時から・電子申請。予算を超えた回は抽選。この事業は2026年度まで` : "今年度の受付は終わりました。来年度の募集は公式の発表を確かめてからご案内します" },
        { head: "工事完了届の最終期限", date: ZEROEMI_REPORT_END, time: "", note: "工事が終わったら30日以内に提出。契約は交付決定（申し込みから約2か月）のあと" },
      ]
    : [
        { head: `【1】ゼロエミ ${target ? `${target.short.replace("（最終回）", "")}${sixth ? "（今年度の最終回）" : ""}` : ""}`, date: target?.end ?? null, time: "17時", note: target ? `受付は${jaDate(target.start ?? target.end, false)}9時から・電子申請。予算を超えた回は抽選。この事業は2026年度まで` : "今年度の受付は終わりました" },
        { head: "【2】ノンフロン機器", date: NONFURON_END, time: "17時", note: "受付中・メールで先着順。予算（約16億円）に達したら、その時点で終わります" },
      ];

  const steps = [
    { n: 1, t: kind === "kucho" ? "現地調査" : "現地確認・機種選び", d: sixth ? "〜12月上旬" : "まず", sub: kind === "kucho" ? "設備の台数・年数と電気の使い方を確認" : "機械・冷媒・電気の使い方を確認。使う制度を決める", who: "EHC" },
    { n: 2, t: kind === "kucho" ? "枠を決める・見積" : "見積・資料", d: sixth ? "〜1/15" : "1か月ほど", sub: kind === "kucho" ? "28トンに届くか計算。見積3社以上・書類" : "見積書・図面・冷媒の系統図・写真", who: "EHC・お客様" },
    { n: 3, t: "申し込み", d: target && target.start ? `${target.start.slice(5).replace("-", "/").replace(/^0/, "")}〜${target.end.slice(5).replace("-", "/").replace(/^0/, "")}` : "受付期間内", dl: target ? `締切 ${target.end.slice(5).replace("-", "/").replace(/^0/, "")} 17時` : "", sub: kind === "kucho" ? "9時から受付。電子申請" : "【2】ノンフロンは先着順（締切 3/31）", who: "お客様", hot: true },
    { n: 4, t: "交付決定", d: sixth ? "3月下旬ごろ" : "約2か月後", sub: "申し込みから約2か月（目安）。それまで契約しない", who: "公社" },
    { n: 5, t: "契約・工事", d: "交付決定のあと", sub: "工事代金はいったんお立て替え", who: "お客様・EHC" },
    { n: 6, t: "完了の報告", d: "工事のあと", dl: kind === "kucho" ? "完了届 最終 2027/11/30" : "【1】最終 2027/11/30", sub: kind === "kucho" ? "完了から30日以内に完了届" : "【1】30日以内／【2】60日以内（最終 2029/10/1）", who: "お客様・EHC" },
    { n: 7, t: "助成金の入金", d: "金額の確定後", sub: "報告の審査で金額が決まってから（後払い）", who: "公社" },
  ];

  return <div className="min-h-screen bg-paper text-ink">
    <ReferralCapture pathname={CFG[initialKind].path} />
    <header className="border-b border-ink-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
        <Link href="/" className="flex min-h-[44px] items-center gap-2.5"><Image src="/icon-192.png" width={36} height={36} alt="" /><span className="text-[13px] font-bold leading-snug sm:text-[16px]">EHCソリューションズ<span className="hidden text-[11px] font-normal text-ink-soft sm:block">空調・設備の改修と補助金のご相談</span></span></Link>
        <a href={COMPANY.telHref} className="inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink-line px-3 text-[13px] font-bold"><Phone className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{COMPANY.tel}</span><span className="sm:hidden">電話で相談</span></a>
      </div>
    </header>

    {/* 切り替え：空調・照明など／冷凍冷蔵庫・ショーケース（同じページの中で表示が変わる） */}
    <nav aria-label="入れ替えるものの切り替え" className="border-b border-ink-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 py-2 sm:flex sm:px-5">
        {(["kucho", "reizo"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => switchKind(k)} className={`min-h-[48px] rounded-full px-4 text-[15px] font-bold leading-tight sm:px-6 ${kind === k ? "bg-brand-deep text-white" : "border border-ink-line bg-white text-ink hover:bg-paper-sub"}`}>{k === "kucho" ? <>空調・照明など</> : <>冷凍冷蔵庫<span className="hidden min-[400px]:inline">・</span><br className="min-[400px]:hidden" />ショーケース</>}</button>)}
      </div>
    </nav>

    <section className="relative h-[460px] overflow-hidden sm:h-[520px]" aria-label="ゼロエミのご案内">
      <Image src={cfg.hero} alt={cfg.heroAlt} fill priority sizes="100vw" className="object-cover" style={{ objectPosition: cfg.heroPos }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,44,30,.30) 0%, rgba(8,44,30,0) 22%, rgba(8,44,30,.22) 40%, rgba(8,44,30,.95) 78%)" }} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-6 text-white sm:px-5 sm:pb-7">
        {/* スマホは1行に収まるよう年を省く（年は下の締切の枠に出す） */}
        {target && <p className="inline-block rounded-md bg-amber-400 px-3 py-1 text-[14px] font-bold text-amber-950"><span className="sm:hidden">{kind === "reizo" ? "【1】" : ""}{target.short}の締切 {jaDate(target.end, false)} 17時</span><span className="hidden sm:inline">{sixth ? "今年度の最終回 ｜ " : ""}{kind === "reizo" ? "【1】" : ""}{target.short.replace("（最終回）", "")}の締切 {jaDate(target.end)} 17時</span></p>}
        <p className="mt-3 text-[14px] font-bold leading-snug opacity-95 sm:text-[15px]">{cfg.over}</p>
        <h1 className="mt-1.5 text-[28px] font-bold leading-[1.32] sm:text-[44px]">{cfg.titleA}<span className="text-[#86EFAC]">最大3/4</span>を<br className="hidden sm:block" />東京都が助成します</h1>
        <p className="mt-2 text-[15px] font-bold leading-relaxed opacity-95 sm:text-[16px]">{cfg.sub}</p>
        <button ref={heroCta} type="button" onClick={start} className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-full bg-brand-lime px-6 py-3 text-[16px] font-bold text-ink hover:brightness-95 sm:w-auto">使えるか1分で確かめる（5問）<ArrowRight className="h-5 w-5" aria-hidden /></button>
      </div>
    </section>

    <main className="mx-auto max-w-6xl px-4 pb-28 sm:px-5 sm:pb-12">
      {/* スマホは「大きな数字｜条件と上限」の横並びで3枚を短く。PCは従来の3列 */}
      <section className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3" aria-label="助成の大きさ">
        {cfg.tiles.map((t) => <div key={t.k} className="flex overflow-hidden rounded-2xl border border-ink-line bg-white sm:block">
          <span aria-hidden className="w-1.5 shrink-0 sm:block sm:h-1.5 sm:w-full" style={{ background: t.col }} />
          <div className="grid flex-1 grid-cols-[108px_1fr] items-center gap-x-3 gap-y-0.5 py-3 pl-3 pr-3 sm:block sm:p-4">
            <p className="col-start-2 row-start-1 text-[13px] font-bold leading-snug text-ink-soft sm:min-h-[38px]">{t.k}</p>
            {/* 「最大 3/4」「助成 750万円」は、スマホでは前の語を小さく上に置き、数字を1行に収める */}
            <p className="col-start-1 row-span-2 row-start-1 text-[23px] font-bold leading-tight sm:mt-1 sm:text-[30px]" style={{ color: t.col }}>{t.n.includes(" ") ? <><span className="block text-[14px] sm:inline sm:text-[1em]">{t.n.split(" ")[0]}</span><span className="hidden sm:inline"> </span>{t.n.split(" ").slice(1).join(" ")}</> : t.n}</p>
            <p className="col-start-2 row-start-2 text-[13px] font-bold leading-snug sm:mt-1">{t.c}</p>
          </div>
        </div>)}
      </section>

      <section className="mt-4 grid overflow-hidden rounded-2xl border-2 bg-white sm:grid-cols-[110px_1fr_1fr]" style={{ borderColor: RED }} aria-label="申し込みの締切">
        <div className="flex items-center justify-center px-3 py-2 text-center text-[15px] font-bold leading-snug text-white" style={{ background: RED }}>申し込みの<br className="hidden sm:block" />締切</div>
        {deadlineCells.map((c, i) => <div key={c.head} className={`px-4 py-3 ${i === 0 ? "border-b sm:border-b-0 sm:border-r" : ""}`} style={{ borderColor: "#F5D0D0" }}>
          <p className="text-[14px] font-bold text-brand-deep sm:text-[13px]">{c.head}</p>
          {c.date ? <p className="mt-0.5 text-[26px] font-bold leading-tight" style={{ color: RED }}><span className="text-[14px]">{c.date.slice(0, 4)}年</span>{jaDate(c.date, false)}<span className="text-[15px]">{c.time}</span></p> : null}
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft sm:text-[12px]">{c.note}</p>
        </div>)}
      </section>
      {tooSoon && target && tooSoon.end !== target.end && <p className="mt-2 text-[13px] leading-relaxed text-ink-soft sm:text-[12px]">{tooSoon.short}（{jaDate(tooSoon.end, false)}締切）は準備の期間が短いため、書類がすでにそろっている場合に限ります。これから準備するなら{target.short.replace("（最終回）", "")}をおすすめします。</p>}

      <section ref={entry} id="check" className="mt-6 scroll-mt-4" aria-label="簡易診断と相談">
        <div className="rounded-[24px] border border-ink-line bg-white p-4 shadow-card sm:rounded-[28px] sm:p-8">
          {receipt ? <div role="status" className="mx-auto max-w-2xl py-4">
            <CheckCircle2 className="h-12 w-12 text-brand" aria-hidden />
            <h2 className="mt-4 text-[25px] font-bold">ご相談を受け付けました</h2>
            <p className="mt-3 text-[16px] leading-[1.9]">{sentContact === "zoom" && booking?.start ? `Zoomは ${bookingDate(booking.start)}（日本時間）で予約済みです。Zoomから届く確認メールの参加URLからお入りください。` : `担当から${COMPANY.replyDays}営業日以内を目安に、お電話かメールでご連絡します。`}</p>
            <p className="mt-5 break-all rounded-xl bg-paper-sub p-4 text-[14px]">受付番号<br /><strong data-testid="ze-receipt">{receipt}</strong></p>
            {warning && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-[14px] text-amber-950">{warning}</p>}
            <p className="mt-3 text-[13px] text-ink-soft">相談内容の自動返信はありません。受付番号を控えておいてください。お急ぎの場合はお電話（{COMPANY.tel}・{COMPANY.hours}）でどうぞ。</p>
            <Link href="/team" className="mt-6 inline-flex min-h-[44px] items-center gap-2 font-bold text-brand underline">施工体制と実績を見る<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div> : phase === "intro" ? <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[13px] font-bold text-brand">簡易診断（5問・約1分）</p><h2 className="mt-1 text-[20px] font-bold leading-snug sm:text-[22px]">5つの質問に答えると、使える見込みと助成の目安、併用できるかが出ます</h2><p className="mt-2 text-[14px] leading-relaxed text-ink-soft sm:text-[13px]">質問：工事場所・会社の区分・入れ替えたいもの（空調・照明も冷凍冷蔵も選べます）・予算の目安・ほかの補助金の予定。連絡先は結果を見たあとで、そのまま相談やZoom面談の予約ができます。</p></div>
            <button ref={panelCta} type="button" onClick={start} className={`${PRIMARY} w-full shrink-0 sm:w-auto`}>診断をはじめる<ArrowRight className="h-5 w-5" aria-hidden /></button>
          </div> : phase === "check" ? <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-brand">簡易診断</p><p className="text-[13px] text-ink-soft">{step + 1} / 5</p></div>
            <div className="mt-3 flex gap-2" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-brand" : "bg-paper-tint"}`} />)}</div>
            <h2 className="mt-5 text-[21px] font-bold leading-snug sm:mt-6 sm:text-[23px]">{["工事をする場所は？", "申し込む会社は？", "入れ替えたいものは？（いくつでも）", "予算の目安は？（税抜）", "ほかの補助金の予定は？（いくつでも）"][step]}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{["会社の本店ではなく、設備を入れ替える事業所の場所です。", "ゼロエミは中小企業・医療法人・社会福祉法人などが対象です。", "空調・照明なども、冷凍冷蔵の機械も、まとめて選べます。今ある設備を、より省エネの機種に入れ替える工事が対象です。", "補助の対象になる費用（機器・工事・設計）の目安です。分からなくても進めます。", "同じ設備に重ねて使えない補助があります。併用できるかの判定に使います。"][step]}</p>
            {step === 0 ? <div className="mt-5 space-y-3">
              <fieldset className="grid gap-2 sm:grid-cols-2"><legend className="sr-only">工事をする場所</legend>{ZE_PLACES.map((x) => <label key={x.id} className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${place === x.id ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="radio" name="ze-place" checked={place === x.id} onChange={() => setPlace(x.id)} className="h-4 w-4 accent-brand" />{x.label}</label>)}</fieldset>
              {place === "tokyo" && <label className="block text-[14px] font-bold">区市町村<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="例：中野区" autoComplete="address-level2" className={INPUT} /></label>}
            </div> : step === 1 ? <fieldset className="mt-5 grid gap-2"><legend className="sr-only">会社の区分</legend>{ZE_ORGS.map((x) => <label key={x.id} className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${org === x.id ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="radio" name="ze-org" checked={org === x.id} onChange={() => setOrg(x.id)} className="h-4 w-4 accent-brand" />{x.label}</label>)}</fieldset>
            : step === 2 ? <div className="mt-5 space-y-5">{(kind === "kucho" ? (["kucho", "reizo"] as const) : (["reizo", "kucho"] as const)).map((g) => <fieldset key={g}><legend className="mb-2 text-[15px] font-bold text-brand-deep">{g === "kucho" ? "空調・照明など" : "冷凍冷蔵庫・ショーケース"}</legend><div className="grid gap-2 sm:grid-cols-2">{ZE_EQUIP[g].map((x) => <label key={x.id} className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${equip.includes(x.id) ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="checkbox" checked={equip.includes(x.id)} onChange={() => toggleEquip(x.id)} className="h-4 w-4 shrink-0 accent-brand" />{x.label}</label>)}</div></fieldset>)}</div>
            : step === 3 ? <fieldset className="mt-5 grid gap-2 sm:grid-cols-2"><legend className="sr-only">予算の目安</legend>{ZE_BUDGETS.map((x) => <label key={x.id} className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${budget === x.id ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="radio" name="ze-budget" checked={budget === x.id} onChange={() => setBudget(x.id)} className="h-4 w-4 accent-brand" />{x.label}</label>)}</fieldset>
            : <fieldset className="mt-5 grid gap-2"><legend className="sr-only">ほかの補助金の予定</legend>{ZE_OTHERS.map((x) => <label key={x.id} className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold leading-snug ${others.includes(x.id) ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="checkbox" checked={others.includes(x.id)} onChange={() => toggleOther(x.id)} className="h-4 w-4 shrink-0 accent-brand" />{x.label}</label>)}</fieldset>}
            {error && <p role="alert" className="mt-4 text-[14px] font-bold text-red-800">{error}</p>}
            {/* スマホは「戻る／次へ」を画面の下に貼り付け、選択肢が長くても押しやすくする */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex items-center justify-between gap-3 border-t border-ink-line bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0"><button type="button" onClick={() => { setError(null); if (step) setStep(step - 1); else move("intro"); }} className="min-h-[48px] px-3 text-[15px] font-bold text-ink-soft">戻る</button><button type="button" onClick={next} className={`${PRIMARY} flex-1 sm:flex-none`}>{step === 4 ? "結果を見る" : "次へ"}<ArrowRight className="h-4 w-4" aria-hidden /></button></div>
          </div> : phase === "result" && judge ? <div className="mx-auto max-w-2xl">
            <p className="text-[13px] font-bold text-brand">簡易診断の結果（確定ではありません）</p>
            <h2 className="mt-2 text-[22px] font-bold leading-[1.45] sm:text-[24px]">{judge.title}</h2>
            <p className="mt-3 text-[15px] leading-[1.9]">{judge.reason}</p>
            <ul className="mt-4 space-y-2">{judge.marks.map((m) => <li key={m.name} className="flex items-start gap-3 rounded-xl bg-paper-sub px-4 py-3"><span className="text-[22px] font-bold leading-none" style={{ color: markColor(m.mark) }}>{m.mark}</span><span className="text-[14px] leading-relaxed"><b>{m.name}</b><br /><span className="text-ink-soft">{m.note}</span></span></li>)}</ul>
            {judge.estimate && <div className="mt-4 rounded-2xl bg-brand-deep p-5 text-white"><p className="text-[13px] font-bold text-brand-lime">助成の目安（予算が「{ZE_BUDGETS.find((x) => x.id === budget)?.label}」の場合）</p><p className="mt-1 text-[32px] font-bold leading-tight">{judge.estimate.text}</p><p className="mt-2 text-[13px] leading-[1.75] text-white/85 sm:text-[12px] sm:leading-[1.8]">{judge.estimate.note} 採択と金額は審査で決まります。</p></div>}
            {judge.combos.length > 0 && <div className="mt-5 rounded-2xl border border-ink-line p-4">
              <p className="text-[15px] font-bold">併用の判定（どちらかを使うと、もう一方が使えない など）</p>
              <ul className="mt-2 divide-y divide-ink-line">{judge.combos.map((c) => <li key={c.title} className="flex items-start gap-3 py-3"><span aria-hidden className="w-6 shrink-0 text-center text-[20px] font-bold leading-none" style={{ color: markColor(c.mark) }}>{c.mark}</span><div className="min-w-0"><p className="text-[15px] font-bold leading-snug"><span className="sr-only">{c.mark === "×" ? "できない：" : c.mark === "△" ? "条件つき・要確認：" : "できる見込み："}</span>{c.title}</p><p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{c.note}</p><p className="mt-1 text-[12px] text-ink-soft">根拠：{c.src}</p></div></li>)}</ul>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">×＝できない（要綱・募集要項に書かれている）　△＝条件つき・確認が必要　○＝できる見込み。2026年11月6日に各制度の要綱・募集要項・Q&Aで確認しました。最終的な可否は、それぞれの事務局の確認で決まります。</p>
            </div>}
            {judge.compare && <div className="mt-4 overflow-hidden rounded-2xl border border-ink-line">
              <p className="bg-paper-sub px-4 py-2 text-[14px] font-bold">冷凍冷蔵の機械は、どちらか一方。ちがいの目安</p>
              {/* スマホは「項目名」の下に2列、PCは「項目名｜ゼロエミ｜ノンフロン」の3列 */}
              <div className="hidden grid-cols-[110px_1fr_1fr] gap-3 border-b border-ink-line px-4 py-2 text-[13px] font-bold sm:grid"><span /><span style={{ color: "#1E8E5A" }}>ゼロエミ</span><span style={{ color: "#0E7490" }}>ノンフロン</span></div>
              <div className="divide-y divide-ink-line text-[14px] leading-snug">{COMPARE_ROWS.map((r) => <div key={r.k} className="px-4 py-2.5 sm:grid sm:grid-cols-[110px_1fr_1fr] sm:gap-3"><p className="text-[13px] font-bold text-ink-soft">{r.k}</p><div className="mt-1 grid grid-cols-2 gap-3 sm:contents"><p><span className="block text-[12px] font-bold sm:hidden" style={{ color: "#1E8E5A" }}>ゼロエミ</span>{org === "large" ? r.zeLarge ?? r.ze : r.ze}</p><p><span className="block text-[12px] font-bold sm:hidden" style={{ color: "#0E7490" }}>ノンフロン</span>{org === "large" ? r.nfLarge ?? r.nf : r.nf}</p></div></div>)}</div>
            </div>}
            {target && judge.level !== "other" && <p className="mt-4 rounded-xl border-2 p-3 text-[14px] font-bold leading-relaxed" style={{ borderColor: RED, color: RED }}>これから準備するなら{target.short.replace("（最終回）", "")}：締切 {jaDate(target.end)} 17時。準備（現地調査・見積・書類）に1か月ほどかかります。</p>}
            <button ref={panelCta} type="button" onClick={() => move("form")} className={`${PRIMARY} mt-6 w-full sm:w-auto`}>このまま相談する<ArrowRight className="h-4 w-4" aria-hidden /></button>
            <button type="button" onClick={() => { setStep(0); move("check"); }} className="mt-3 block min-h-[44px] text-[14px] font-bold text-ink-soft underline">答えを見直す</button>
          </div> : <div className="mx-auto max-w-3xl">
            <p className="text-[13px] font-bold text-brand">ご相談（約1分）</p><h2 className="mt-1 text-[21px] font-bold leading-snug sm:text-[24px]">簡易診断の答えと一緒に、そのまま相談できます</h2>
            {judge && <p className="mt-2 rounded-xl bg-paper-sub p-3 text-[13px] leading-relaxed">診断の結果：<b>{judge.title}</b>{judge.estimate ? `（助成の目安 ${judge.estimate.text}）` : ""}　<button type="button" onClick={() => { setStep(0); move("check"); }} className="font-bold text-brand underline">答えを変える</button></p>}
            {isTest && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[14px] font-bold">公開確認テストです。営業対象・月次実績から除外して受け付けます。</p>}
            <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
              <div className="grid gap-5 sm:grid-cols-2"><label className="block text-[14px] font-bold">法人名・施設名 <span className="text-red-800">必須</span><input maxLength={80} autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className={INPUT} /></label><label className="block text-[14px] font-bold">お名前 <span className="text-red-800">必須</span><input maxLength={40} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} /></label></div>
              <fieldset><legend className="text-[14px] font-bold">連絡の方法 <span className="text-red-800">必須</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${contact === "zoom" ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="radio" name="ze-contact" checked={contact === "zoom"} onChange={() => setContact("zoom")} className="h-4 w-4 accent-brand" /><Video className="h-5 w-5 text-brand" aria-hidden /><span>Zoomで面談したい<span className="block text-[13px] font-normal text-ink-soft sm:text-[12px]">空き枠から30分を予約</span></span></label>
                <label className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-bold ${contact === "callback" ? "border-brand bg-paper-tint" : "border-ink-line bg-white hover:bg-paper-sub"}`}><input type="radio" name="ze-contact" checked={contact === "callback"} onChange={() => setContact("callback")} className="h-4 w-4 accent-brand" /><Phone className="h-5 w-5 text-brand" aria-hidden /><span>電話かメールで連絡がほしい<span className="block text-[13px] font-normal text-ink-soft sm:text-[12px]">担当から{COMPANY.replyDays}営業日以内に</span></span></label>
              </div></fieldset>
              {contact === "zoom" && <div className="space-y-3">
                <label className="block text-[14px] font-bold">メールアドレス <span className="text-red-800">必須</span><input type="email" maxLength={120} autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); if (booking) setBooking(null); }} placeholder="name@example.co.jp" className={INPUT} /><span className="mt-1 block text-[13px] font-normal text-ink-soft sm:text-[12px]">Zoomの予約にも同じメールアドレスをお使いください。</span></label>
                <ZoomBookingPicker email={email} booking={booking} onChange={setBooking} fallbackHint="メールアドレスを入れると空き枠を開けます。予約しない場合は「電話かメールで連絡がほしい」をお選びください。" />
              </div>}
              {contact === "callback" && <label className="block text-[14px] font-bold">電話番号かメールアドレス <span className="text-red-800">必須</span><input maxLength={120} value={reach} onChange={(e) => setReach(e.target.value)} placeholder="03-1234-5678 または name@example.co.jp" className={INPUT} /><span className="mt-1 block text-[13px] font-normal text-ink-soft sm:text-[12px]">折り返しの連絡にだけ使います。</span></label>}
              <label className="block text-[14px] font-bold">ご相談の内容（任意）<textarea maxLength={600} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "kucho" ? "例：天井のエアコン8台が15年目。夏に効きが悪い" : "例：別置型ショーケース5台と冷凍機1台を入れ替えたい"} className={`${INPUT} min-h-[96px]`} /></label>
              <div aria-hidden="true" className="hidden"><label>website<input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line p-4 text-[13px] leading-[1.8]"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand" /><span><Link href="/privacy" target="_blank" rel="noopener" className="font-bold text-brand underline">個人情報の取扱い</Link>を確認し、EHCと施工連携先の株式会社プロジェクトネオへの共有に同意します。</span></label>
              <p className="text-[13px] leading-[1.75] text-ink-soft sm:text-[12px] sm:leading-[1.8]">見積り・図面・省エネの計算などの資料づくりは、工事に至らなかった場合も規模により費用がかかることがあります。費用は事前にご案内します。申請書類の作成は行政書士の業務のため、EHCでは作りません。</p>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-[14px] font-bold leading-relaxed text-red-800">{error}</p>}
              <button type="submit" disabled={busy || uncertain} className={`${PRIMARY} w-full`}>{busy ? "受け付けを確認しています…" : "この内容で相談する"}{!busy && <ArrowRight className="h-4 w-4" aria-hidden />}</button>
              <p className="text-center text-[13px] text-ink-soft sm:text-[12px]">自動返信のメールはありません。送信後に受付番号を表示します。</p>
            </form>
          </div>}
        </div>
      </section>

      {kind === "kucho" ? <section className="mt-10 sm:mt-12"><h2 className={H2}>こんな入れ替え工事に使えます</h2><div className="mt-4 grid gap-2 sm:grid-cols-5 sm:gap-3">{KUCHO_WORKS.map((w) => <div key={w.t} className="flex items-center gap-3 rounded-2xl border border-ink-line bg-white px-4 py-3 sm:block sm:p-4 sm:text-center"><w.icon className="h-7 w-7 shrink-0 text-brand sm:mx-auto sm:h-8 sm:w-8" aria-hidden /><div><p className="text-[16px] font-bold sm:mt-2 sm:text-[15px]">{w.t}</p><p className="mt-0.5 text-[14px] leading-snug text-ink-soft sm:mt-1 sm:text-[12px]">{w.d}</p></div></div>)}</div><p className="mt-2 text-[13px] leading-relaxed text-ink-soft sm:text-[12px]">冷凍冷蔵設備も対象です（<button type="button" onClick={() => { switchKind("reizo"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-bold text-brand underline">冷凍冷蔵庫・ショーケースの表示に切り替える</button>）。対象外：撤去・処分費、中古品、新しく足すだけの設備。</p></section>
      : <section className="mt-10 sm:mt-12"><h2 className={H2}>どっちを使う？<br className="sm:hidden" />入れ替える機械で決まります</h2>
        {/* スマホは横スクロールの表をやめ、機械ごとのカードにする */}
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft sm:hidden"><span className="block"><b style={{ color: "#1E8E5A" }}>【1】ゼロエミ</b>＝省エネの機械へ</span><span className="block"><b style={{ color: "#0E7490" }}>【2】ノンフロン</b>＝フロンを使わない機械へ</span></p>
        <ul className="mt-3 space-y-2 sm:hidden">{REIZO_MATRIX.map((r) => <li key={r.name} className="rounded-2xl border border-ink-line bg-white px-4 py-3"><p className="text-[16px] font-bold leading-snug">{r.name}</p><div className="mt-1 divide-y divide-ink-line text-[14px] leading-snug">{([["【1】", "#1E8E5A", r.ze], ["【2】", "#0E7490", r.nf]] as const).map(([label, col, v]) => <div key={label} className="flex items-start gap-2 py-2"><b aria-hidden className="w-5 shrink-0 text-center text-[18px] leading-[1.1]" style={{ color: markColor(v[0]) }}>{v[0]}</b><p><b style={{ color: col }}>{label}<span className="sr-only">{label === "【1】" ? "ゼロエミ" : "ノンフロン"}：{v[0] === "○" ? "対象" : v[0] === "△" ? "条件しだい" : "対象外"}　</span></b>{v[1]}</p></div>)}</div></li>)}</ul>
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-ink-line bg-white sm:block"><table className="w-full min-w-[640px] text-left text-[14px]"><thead><tr className="border-b border-ink-line text-[13px] text-ink-soft"><th className="px-4 py-3">入れ替える機械</th><th className="px-4 py-3" style={{ color: "#1E8E5A" }}>【1】ゼロエミ（省エネの機械へ）</th><th className="px-4 py-3" style={{ color: "#0E7490" }}>【2】ノンフロン機器（フロンを使わない機械へ）</th></tr></thead><tbody>{REIZO_MATRIX.map((r) => <tr key={r.name} className="border-b border-ink-line last:border-0"><td className="px-4 py-3 font-bold">{r.name}</td><td className="px-4 py-3"><b className="mr-2 text-[18px]" style={{ color: markColor(r.ze[0]) }}>{r.ze[0]}</b>{r.ze[1]}</td><td className="px-4 py-3"><b className="mr-2 text-[18px]" style={{ color: markColor(r.nf[0]) }}>{r.nf[0]}</b>{r.nf[1]}</td></tr>)}</tbody></table></div><p className="mt-2 text-[13px] leading-relaxed text-ink-soft sm:text-[12px]">○＝対象 △＝条件しだい（機種ごとに窓口へ確認）×＝対象外。同じ機械に【1】【2】の両方は使えません。冷媒だけの入れ替え（ドロップイン）はどちらも対象外です。空調は<button type="button" onClick={() => { switchKind("kucho"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-bold text-brand underline">空調・照明などの表示</button>へ。</p></section>}

      <section className="mt-10 sm:mt-12"><h2 className={H2}>{sixth ? <>第6回（今年度の最終回）の<br className="sm:hidden" />スケジュール<span className="hidden sm:inline">　</span></> : "申し込みから入金まで"}{sixth && <span className="mt-1 block text-[18px] sm:mt-0 sm:inline sm:text-[24px]" style={{ color: RED }}>締切 {jaDate(SIXTH_END)} 17時</span>}</h2><p className="mt-1 text-[14px] leading-relaxed text-ink-soft sm:text-[13px]">工事代金はいったんお立て替え（後払い）。公社＝東京都環境公社。</p>
        {/* スマホは縦の時系列（番号・やること・時期が1行）。PCは従来の7列 */}
        <ol className="mt-4 sm:grid sm:grid-cols-7 sm:gap-2">{steps.map((s, i) => {
          const hot = "hot" in s && s.hot;
          return <li key={s.n} className={`relative flex gap-3 pb-3 last:pb-0 sm:block sm:rounded-2xl sm:bg-white sm:p-3 sm:text-center ${hot ? "sm:border-2" : "sm:border sm:border-ink-line"}`} style={hot ? { borderColor: RED } : undefined}>
            {i < steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-0.5 bg-ink-line sm:hidden" />}
            <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white sm:mx-auto sm:h-7 sm:w-7 sm:text-[13px] ${hot ? "" : "bg-brand"}`} style={hot ? { background: RED } : undefined}>{s.n}</span>
            <div className={`min-w-0 flex-1 sm:mt-2 ${hot ? "rounded-xl border-2 bg-red-50/40 p-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0" : "pt-1 sm:pt-0"}`} style={hot ? { borderColor: RED } : undefined}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:block">
                <p className="text-[16px] font-bold leading-snug sm:text-[14px]">{s.t}</p>
                <p className="rounded-md px-2 py-0.5 text-[13px] font-bold sm:mt-2 sm:px-1 sm:py-1" style={hot ? { background: RED, color: "#fff" } : { background: "#E8F0D9", color: "#254d39" }}>{s.d}</p>
              </div>
              {"dl" in s && s.dl ? <p className="mt-1 text-[14px] font-bold sm:text-[12px]" style={{ color: RED }}>{s.dl}</p> : null}
              <p className="mt-1 text-[14px] leading-snug text-ink-soft sm:text-[12px]">{s.sub}<span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-paper-sub px-2 py-0.5 align-middle text-[12px] font-bold text-ink sm:hidden">{s.who}</span></p>
              <p className="mt-2 hidden rounded-full bg-paper-sub px-2 py-0.5 text-[11px] font-bold sm:inline-block">{s.who}</p>
            </div>
          </li>;
        })}</ol>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft sm:text-[12px]">{sixth ? "1・2の日付はEHCの準備の目安です（公式の日程ではありません）。" : ""}交付決定の時期は「申し込みから約2か月」からの目安です。{kind === "reizo" ? "【2】ノンフロンはいま申し込みが多く、審査に時間がかかっています。" : ""}</p>
      </section>

      <section className="mt-10 grid gap-3 sm:mt-12 md:grid-cols-2 md:gap-4"><div className="rounded-[24px] bg-amber-50 p-5 sm:p-6"><p className="text-[15px] font-bold text-amber-900 sm:text-[13px]">気をつけること</p><ul className="mt-2 space-y-2 text-[15px] leading-[1.75] sm:text-[14px] sm:leading-[1.8]">{["補助が決まる（交付決定）前に契約・発注・購入すると対象外", "助成金は工事代金をいったんお支払いいただいたあとに入ります（後払い）", kind === "kucho" ? "国の補助とは一緒に使えません（区市町村の補助とは使えます）" : "同じ機械に【1】【2】の両方は使えません", "採択されるか・助成の金額は、審査で決まります。お約束するものではありません"].map((t) => <li key={t} className="flex gap-2"><span className="font-bold text-amber-900">!</span>{t}</li>)}</ul></div>
        <div className="rounded-[24px] bg-paper-tint p-5 sm:p-6"><p className="text-[15px] font-bold text-brand-deep sm:text-[13px]">だれが何をするか</p><ul className="mt-2 space-y-2 text-[15px] leading-[1.75] sm:text-[14px] sm:leading-[1.8]"><li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden /><span><b>お客様</b>：申し込み（申請書類はお客様が用意。行政書士に頼むときはお客様から）・契約・支払い・完了の報告</span></li><li className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden /><span><b>EHC</b>：現地調査、使う制度と区分の確認、日程の段取り、見積書・図面・省エネの計算の資料、工事と保守</span></li></ul></div>
      </section>

      <section className="mt-10 sm:mt-12"><p className="text-[12px] font-bold tracking-wider text-brand">EHC TEAM</p><div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1"><h2 className={H2}>設備も、建物も。<br className="sm:hidden" />工事のチームが対応します。</h2><Link href="/team" className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-brand underline sm:text-[14px]">メンバーと実績<ArrowRight className="h-4 w-4" aria-hidden /></Link></div><div className="mt-3 grid gap-3 sm:mt-5 md:grid-cols-3 md:gap-4">{WHY.map((w, i) => <div key={w.head} className="border-t-2 border-ink-line pt-3 sm:pt-4"><p className="text-[12px] font-bold text-brand">0{i + 1}</p><h3 className="mt-1 text-[17px] font-bold leading-[1.5] sm:mt-2 sm:leading-[1.6]">{w.head}</h3><p className="mt-1.5 text-[15px] leading-[1.75] text-ink-soft sm:mt-2 sm:text-[14px] sm:leading-[1.9]">{w.text}</p></div>)}</div><div className="mt-5 rounded-2xl bg-paper-tint p-4 sm:mt-6 sm:p-5"><p className="text-[14px] font-bold sm:text-[13px]">プロジェクトネオの施工実績</p><div className="mt-2 grid gap-2 text-[15px] font-bold sm:grid-cols-2">{BUILD_RECORDS.map((r) => <p key={r.name}>{r.name}<span className="mt-0.5 block text-[14px] font-normal sm:mt-1 sm:text-[13px]">{r.what}</span></p>)}</div><p className="mt-3 text-[12px] leading-relaxed text-ink-soft sm:text-[11px]">{BUILD_RECORDS_NOTE}</p></div></section>

      <section className="mt-10 grid gap-3 sm:mt-12 md:grid-cols-[0.6fr_1fr] md:gap-5"><div className="flex items-center gap-2 md:block"><ShieldCheck className="h-6 w-6 text-brand" aria-hidden /><h2 className={`${H2} md:mt-3`}>よくあるご質問</h2></div><div className="divide-y divide-ink-line border-y border-ink-line">{[
        { q: "どの会社・施設が対象ですか？", a: "都内の中小規模事業所を所有・使用する中小企業、医療法人・社会福祉法人・学校法人などです。大企業と、大企業が株式の半分以上を持つ会社などは対象外です。業種だけでは決まりません。" },
        { q: "最大3/4・4,500万円は、誰でも使えますか？", a: "いいえ。CO2を年28トン以上減らす区分の上限です。ほかに2/3・上限2,500万円（東京都の省エネ診断を受ける）と、2/3・上限1,000万円（自分で計画を作る）の区分があります。区分は申し込んだあとに変えられません。" },
        { q: "空調と冷凍冷蔵の両方を入れ替えたい。補助は重ねられますか？", a: "同じ機械に2つの制度は使えません。ゼロエミは、国や都など（都内の区市町村を除く）ほかの補助を同じ設備に重ねられないためです。空調・照明などはゼロエミ、自然冷媒のショーケース・冷凍機はノンフロン機器の助成のように、機械を分ければ両方を使える見込みです。ゼロエミは同じ事業所で年度に1回しか申し込めないため、ゼロエミで入れ替える設備は1つの申請にまとめます（CO2の削減は申請した設備全体で数えます）。簡易診断の結果に「併用の判定」を出します。" },
        { q: "店舗・事業所が複数あります。", a: "どちらの制度も、事業所（設置場所）ごとに申請します。ゼロエミは1回の受付で1つの事業者が申し込めるのは1事業所だけなので、事業所ごとに回を分けます（同じ回に2つ出すと、はじめの1つだけが受理されます）。ノンフロン機器の助成は、申請の回数に制限がありません。" },
        { q: "国の補助金と一緒に使えますか？", a: "ゼロエミは、国の補助を受ける設備には使えません。ノンフロン機器の助成は国の補助と重ねられますが、国の補助の額を差し引くため、合計はほとんど増えません。国の側の決まり（省エネ補助金・環境省の自然冷媒機器の補助）も含めて、どの組み合わせが有利かを一緒に確かめます。" },
        { q: "Zoomで面談しないと相談できませんか？", a: `いいえ。「電話かメールで連絡がほしい」を選べば、担当から${COMPANY.replyDays}営業日以内にご連絡します。Zoomを選んだ場合は、空き枠から30分を予約できます。` },
        { q: "申請や工事は、誰が進めますか？", a: "EHCのチームが現地調査・機器選定・見積り・図面や省エネの計算などの準備を進めます。申請者はお客様です。申請書類の作成は行政書士の業務のため、EHCでは作りません。" },
      ].map((x) => <details key={x.q} className="group py-1"><summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold leading-snug sm:text-[15px]">{x.q}<ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180 sm:h-4 sm:w-4" aria-hidden /></summary><p className="pb-4 text-[15px] leading-[1.85] text-ink-soft sm:text-[14px] sm:leading-[1.95]">{x.a}</p></details>)}</div></section>

      {!receipt && <section className="mt-10 rounded-[24px] bg-paper-tint px-4 py-7 text-center sm:px-5"><CalendarDays className="mx-auto h-7 w-7 text-brand" aria-hidden /><h2 className="mt-2 text-[21px] font-bold">使えるかどうか、まず1分で。</h2><button ref={endCta} type="button" onClick={start} className={`${PRIMARY} mt-5 w-full sm:w-auto`}>使えるか1分で確かめる（5問）<ArrowRight className="h-4 w-4" aria-hidden /></button><p className="mt-3 text-[13px] text-ink-soft sm:text-[12px]">そのまま相談でき、ご希望ならZoom面談も予約できます。</p></section>}
      <p className="mt-6 text-[12px] leading-[1.8] text-ink-soft sm:text-[11px]">写真はイメージです。制度：{P.officialName}{kind === "reizo" ? "、省エネ型ノンフロン機器普及促進事業" : ""}。受付期間・締切・最終期限は2026年11月6日に公式の情報で確認しました。募集・要件は変わることがあります。<a href={P.official[0].url} target="_blank" rel="noopener noreferrer" className="underline">クール・ネット東京の公式情報</a>{kind === "reizo" ? <>・<a href={NONFURON_URL} target="_blank" rel="noopener noreferrer" className="underline">東京都環境公社の公式情報</a></> : null}をご確認ください。採択と金額は審査と要綱で決まり、お約束するものではありません。</p>
      <button type="button" onClick={() => setShowChoice(true)} className="mt-3 min-h-[44px] text-[12px] text-ink-soft underline">広告計測の設定{choice ? `（${choice === "granted" ? "許可" : "許可しない"}）` : ""}</button>
    </main>
    <SiteFooterSimple />
    {/* スマホの下に貼り付くボタン：同じ役目のボタンが画面に見えている間は出さない（二重に並ばないように） */}
    {!receipt && !ctaInView && (phase === "intro" || (phase === "result" && judge)) && <div className="fixed inset-x-3 bottom-3 z-30 sm:hidden">{phase === "intro"
      ? <button type="button" onClick={start} className={`${PRIMARY} w-full`}>使えるか1分で確かめる（5問）<ArrowRight className="h-4 w-4" aria-hidden /></button>
      : <button type="button" onClick={() => move("form")} className={`${PRIMARY} w-full`}>このまま相談する<ArrowRight className="h-4 w-4" aria-hidden /></button>}</div>}
    {showChoice && <aside aria-label="広告計測の確認" className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-3xl rounded-2xl border border-ink-line bg-white p-3 shadow-lift sm:inset-x-3 sm:bottom-3 sm:p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"><p className="flex-1 text-[12px] leading-[1.7] sm:leading-[1.8]">広告の効果を確認するため、許可された場合にCookieを使い、広告のクリック情報と受付番号をGoogleに送ります。お名前・連絡先・ご相談の内容は計測に送りません。許可しなくても相談できます。<Link href="/privacy" target="_blank" className="ml-1 underline">詳細</Link></p><div className="flex shrink-0 gap-2"><button type="button" onClick={() => choose("denied")} className="min-h-[44px] flex-1 rounded-xl border border-ink-line px-4 text-[12px] font-bold">許可しない</button><button type="button" onClick={() => choose("granted")} className="min-h-[44px] flex-1 rounded-xl bg-brand-deep px-4 text-[12px] font-bold text-white">計測を許可</button></div></div></aside>}
  </div>;
}
