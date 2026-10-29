"use client";

/* ───────────────────────────────────────────────────────────
   v1 / 2026-10-29 / EHC-0102 相談の入口（写真で概算・電話・3項目のフォーム）

   ・フォームは3項目だけ：法人名・施設名／お名前／ご連絡先（電話かメールのどちらか）。同意は必須。
   ・送り先は app/api/program-lead（Notion に未着手で1行・担当者宛メール）。お客様宛の自動メールは送らない。
   ・写真は、メールに添付して送ってもらう（件名に受付番号）。サイトに写真を上げる仕組みは作らない。
   ・紹介リンク（?ref=）は送った時点のものを運ぶ。お客様の画面には出さない。
   ─────────────────────────────────────────────────────────── */

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { COMPANY } from "@/lib/company";
import { currentReferral } from "@/lib/referralClient";
import { PROGRAMS, type ProgramId } from "@/lib/programs";
import type { CheckAnswers } from "@/lib/programMatch";
import type { ProgramLeadSource } from "@/lib/programLead";

const PHOTO_SUBJECT = "写真で概算の依頼";
const photoHref = (receiptNo?: string | null) =>
  `mailto:${COMPANY.email}?subject=${encodeURIComponent(receiptNo ? `${PHOTO_SUBJECT}（受付番号 ${receiptNo}）` : PHOTO_SUBJECT)}&body=${encodeURIComponent(
    "法人名・施設名：\nお名前：\nご連絡先：\n\n添付する写真（分かる範囲で）：\n・室外機の銘板（型式・製造年の書かれた札）\n・室内機\n・電気料金の明細（直近のもの）\n"
  )}`;

export function ConsultForm({
  source,
  programId,
  answers,
  id: anchorId = "consult",
}: {
  source: ProgramLeadSource;
  programId?: ProgramId | null;
  answers?: CheckAnswers | null;
  id?: string;
}) {
  const id = useId();
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [reach, setReach] = useState("");
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const openedAt = useRef<number>(0);
  useEffect(() => { openedAt.current = Date.now(); }, []);

  const program = programId ? PROGRAMS[programId] : null;
  const reachText = reach.trim();
  const reachOk = reachText.includes("@")
    ? /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/.test(reachText)
    : /^[0-9０-９+＋()（）\-－ー‐\s]{10,20}$/.test(reachText);
  const errs = {
    company: touched && !company.trim() ? "法人名・施設名をご入力ください。" : null,
    name: touched && !name.trim() ? "お名前をご入力ください。" : null,
    reach: touched && !reachText ? "お電話番号かメールアドレスをご入力ください。" : touched && !reachOk ? "お電話番号（例：03-1234-5678）かメールアドレス（例：name@example.co.jp）をご確認ください。" : null,
    consent: touched && !consent ? "内容をご確認のうえ、チェックを入れてください。" : null,
  };

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!company.trim() || !name.trim() || !reachText || !reachOk || !consent || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/program-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(), name: name.trim(), reach: reachText, consent,
          source, programId: programId ?? null, answers: answers ?? null,
          referral: currentReferral(), hp, elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; receiptNo?: string } | null;
      if (!res.ok || !json?.ok || !json.receiptNo) {
        track("consult_submit", { ok: false, source });
        setError(json?.error || `送信できませんでした。時間をおいて、もう一度お試しください。お急ぎの場合はお電話（${COMPANY.tel}）でどうぞ。`);
        return;
      }
      track("consult_submit", { ok: true, source });
      setReceiptNo(json.receiptNo);
    } catch {
      track("consult_submit", { ok: false, source });
      setError("通信に失敗しました。電波の良い場所で、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = (bad: boolean) =>
    cn(
      "mt-1 min-h-[52px] w-full rounded-xl border bg-white px-3 text-[16px] leading-[1.6] text-ink",
      "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
      bad ? "border-red-700" : "border-ink-line"
    );

  return (
    <section id={anchorId} aria-labelledby={`${id}-title`} className="scroll-mt-32 rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
      <h2 id={`${id}-title`} className="text-[22px] font-bold leading-[1.4]">相談する</h2>
      <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">
        入力は3つだけです。{COMPANY.replyDays}営業日以内に担当からご連絡します。申請書類の作成は行政書士の業務のため、EHC では作りません。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href={photoHref(receiptNo)}
          onClick={() => track("consult_call", { kind: "photo", place: source })}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-brand-deep bg-paper-sub px-4 py-3 text-brand-deep"
        >
          <Camera aria-hidden className="h-6 w-6 shrink-0" />
          <span><b className="block text-[16px]">写真で概算</b><span className="text-[13px] text-ink">室外機の銘板・電気料金の明細をメールで</span></span>
        </a>
        <a
          href={COMPANY.telHref}
          onClick={() => track("consult_call", { kind: "tel", place: source })}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-brand-deep bg-paper-sub px-4 py-3 text-brand-deep"
        >
          <Phone aria-hidden className="h-6 w-6 shrink-0" />
          <span><b className="block text-[16px]">電話 {COMPANY.tel}</b><span className="text-[13px] text-ink">受付 {COMPANY.hours}</span></span>
        </a>
      </div>

      {receiptNo ? (
        <div role="status" className="mt-5 space-y-3 rounded-2xl bg-paper-tint p-4 text-[16px] leading-[1.8]">
          <p className="flex items-start gap-2">
            <CheckCircle2 aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand-deep" />
            <span><b>受け付けました。</b>受付番号 <b>{receiptNo}</b></span>
          </p>
          <p>{COMPANY.replyDays}営業日以内に、担当からご連絡します。お急ぎの場合は、お電話（{COMPANY.tel}・{COMPANY.hours}）でどうぞ。</p>
          <p>
            室外機の銘板・電気料金の明細の写真を
            <a href={photoHref(receiptNo)} className="mx-1 font-bold text-brand-deep underline underline-offset-4">メールで送る</a>
            と、概算が早く出せます（件名に受付番号が入ります）。
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {program && (
            <p className="rounded-xl bg-paper-sub px-3 py-2 text-[14px] leading-[1.7]">
              相談したい制度：<b>{program.tag} {program.title}</b>
            </p>
          )}
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
          <div>
            <label htmlFor={`${id}-reach`} className="block text-[14px] font-bold text-ink">ご連絡先（電話かメール）<span className="ml-1 text-red-800">必須</span></label>
            <input id={`${id}-reach`} type="text" inputMode="email" autoComplete="email" placeholder="03-1234-5678 または name@example.co.jp" value={reach} onChange={(e) => setReach(e.target.value)} aria-invalid={!!errs.reach || undefined} className={inputCls(!!errs.reach)} />
            {errs.reach && <p className="mt-1 text-[14px] font-bold text-red-800">{errs.reach}</p>}
          </div>
          <div style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
            <label htmlFor={`${id}-hp`}>この欄は空のままにしてください</label>
            <input id={`${id}-hp`} name="ehc_hp_website" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>
          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-paper-sub p-3 text-[15px] leading-[1.7]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errs.consent || undefined} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
            <span>
              ご相談への連絡のために、入力した内容{answers ? "と診断の答え" : ""}を EHC が使うことに同意します（
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
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep px-4 text-[17px] font-bold text-white hover:bg-brand disabled:opacity-60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            {busy && <Loader2 aria-hidden className="h-5 w-5 animate-spin" />}
            {busy ? "送信しています…" : "この内容で相談する"}
          </button>
        </div>
      )}
    </section>
  );
}
