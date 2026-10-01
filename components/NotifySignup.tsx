"use client";

import { useId, useRef, useState } from "react";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";

/* ───────────────────────────────────────────────────────────
   次の公募のお知らせの登録（2026-09-26 改善6）

   結果の画面（第3段階）の制度の一覧の下に置く。決め事は lib/notifySignup.ts、受け口は app/api/notify-signup。
   ・伺うのはメールアドレス（必須）と会社名（任意）だけ。同意の欄を付ける。
   ・関心のある制度（画面に出ている制度名）と、7問の条件（所在地・建物・希望時期）を一緒に送る。
   ・迷惑な送信の見分け（lib/spamGuard.ts）も診断の相談と同じにする。
   ─────────────────────────────────────────────────────────── */

export function NotifySignup({
  programNames,
  pref,
  building,
  timing,
}: {
  programNames: string[];
  pref: string | null;
  building: string | null;
  timing: string | null;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hp, setHp] = useState("");
  const openedAt = useRef(Date.now());

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailError = touched && !emailOk ? (email.trim() ? "メールアドレスの形式をご確認ください（例：name@example.co.jp）。" : "メールアドレスをご入力ください。") : null;
  const consentError = touched && !consent ? "内容をご確認のうえ、チェックを入れてください。" : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!emailOk || !consent || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notify-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company: company.trim() || null,
          consent,
          programs: programNames,
          pref,
          building,
          timing,
          hp,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        track("notify_signup", { ok: false });
        setError(json?.error || "登録できませんでした。時間をおいて、もう一度お試しください。");
        return;
      }
      track("notify_signup", { ok: true });
      setDone(true);
    } catch {
      track("notify_signup", { ok: false });
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

  return (
    <section aria-labelledby={`${id}-heading`} className="ehc-notify-signup rounded-2xl border border-ink-line bg-paper-card p-4 sm:p-5">
      <h3 id={`${id}-heading`} className="flex items-start gap-2 text-[18px] font-bold leading-[1.6] text-ink">
        <BellRing aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand" />
        次の公募が始まったら、お知らせします
      </h3>
      {done ? (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-paper-tint px-4 py-3 text-[16px] leading-[1.8] text-ink">
          <CheckCircle2 aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brand-deep" />
          <span>登録しました。公募の日程が分かったら、EHC からメールでお知らせします。</span>
        </p>
      ) : (
        <>
          <p className="mt-2 text-[16px] leading-[1.8] text-ink-soft">
            今回は間に合わない方や、更新の時期がまだ決まっていない方へ。省エネ補助金などの次の公募の日程が発表されたら、メールでお知らせします。
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-email`} className="block text-[14px] font-bold leading-[1.7] text-ink">
                メールアドレス<span className="ml-1 text-[14px] font-bold text-red-800">必須</span>
              </label>
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!emailError || undefined}
                aria-describedby={emailError ? `${id}-email-error` : undefined}
                className={inputCls(!!emailError)}
              />
              {emailError && <p id={`${id}-email-error`} className="mt-1 text-[14px] font-bold leading-[1.6] text-red-800">{emailError}</p>}
            </div>
            <div>
              <label htmlFor={`${id}-company`} className="block text-[14px] font-bold leading-[1.7] text-ink">会社名（任意）</label>
              <input
                id={`${id}-company`}
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputCls(false)}
              />
            </div>
          </div>
          <div className="ehc-hp-field" aria-hidden="true">
            <label htmlFor={`${id}-hp`}>この欄は空のままにしてください</label>
            <input id={`${id}-hp`} name="ehc_hp_website" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>
          <label className="mt-4 flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-paper-sub p-3 text-[16px] leading-[1.7] text-ink">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={!!consentError || undefined}
              className="mt-1 h-5 w-5 shrink-0 accent-brand"
            />
            <span>
              公募のお知らせのために、メールアドレスと会社名を EHC が使うことに同意します（
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-deep underline underline-offset-4">
                プライバシーポリシー<span className="sr-only">（新しいタブで開きます）</span>
              </a>
              ）。いつでも停止できます。
            </span>
          </label>
          {consentError && <p className="mt-1 text-[14px] font-bold leading-[1.6] text-red-800">{consentError}</p>}
          {error && <p role="alert" className="mt-3 rounded-xl border border-red-700/40 bg-red-50 px-4 py-3 text-[14px] font-bold leading-[1.7] text-red-800">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep px-4 text-[16px] font-bold leading-[1.7] text-white hover:bg-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            {busy && <Loader2 aria-hidden className="h-5 w-5 animate-spin" />}
            {busy ? "登録しています…" : "お知らせを受け取る"}
          </button>
        </>
      )}
    </section>
  );
}
