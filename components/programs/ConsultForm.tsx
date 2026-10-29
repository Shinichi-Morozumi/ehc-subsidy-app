"use client";

/* ───────────────────────────────────────────────────────────
   v3 / 2026-10-29 / EHC-0102 相談の入口（写真・PDFを添えて送る・電話・3項目のフォーム）
   直し2回目（10名のレビュー）：
   ・送ったあとに何が起きるかを先に見せる（4段）。急ぎは電話へ。
   ・相談したい制度を選べる（いくつでも・任意。カードの「この制度で相談する」から来たらその制度に印）。
   ・任意で「ご相談の内容」と、印（急ぎ／施設・建物が複数／連絡はメールを希望）を付けられる。必須は3項目のまま。
   ・現地調査の費用（本人の回答 2026-10-29「確定してる現場なら」）：工事のご依頼が決まった現場だけ「費用はかかりません」と書く。
   ・資料づくりの費用（同「はい、規模による」）：工事にならなかった場合も、規模によって費用がかかることがあると書く。
   ・連絡の早さ（同「今のまま」）：5営業日以内・電話は平日12〜17時のまま。準備に1か月ほどかかることを書く。

   ・フォームは3項目だけ：法人名・施設名／お名前／ご連絡先（電話かメールのどちらか）。同意は必須。
   ・写真・PDF をそのまま添えて送れる（ご指示 2026-10-29「写真、PDF 送れるように」）。5つ・合計3.2MBまで。
   　写真はこの端末の中で長い辺1600pxの JPEG に縮めてから送る。添付は担当者宛のメールに付けて届け、サイトには保存しない。
   ・送り先は app/api/program-lead（Notion に未着手で1行・担当者宛メール）。お客様宛の自動メールは送らない。
   ・紹介リンク（?ref=）は送った時点のものを運ぶ。お客様の画面には出さない。
   ─────────────────────────────────────────────────────────── */

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CheckCircle2, FileText, Loader2, Paperclip, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { COMPANY } from "@/lib/company";
import { currentReferral } from "@/lib/referralClient";
import { PROGRAMS, type ProgramId } from "@/lib/programs";
import { CONSULT_FLAGS, CONSULT_MULTI_EVENT, CONSULT_NOTE_MAX, CONSULT_SITES_MAX, type ConsultFlagId } from "@/lib/consultOptions";
import { ATTACH_ACCEPT, ATTACH_MAX_FILES, ATTACH_MAX_TOTAL_BYTES, ATTACH_PHOTO_MAX_EDGE, fmtBytes } from "@/lib/attachLimits";
import type { CheckAnswers } from "@/lib/programMatch";
import type { ProgramLeadSource } from "@/lib/programLead";

const PHOTO_SUBJECT = "写真で概算の依頼";
const photoHref = (receiptNo?: string | null) =>
  `mailto:${COMPANY.email}?subject=${encodeURIComponent(receiptNo ? `${PHOTO_SUBJECT}（受付番号 ${receiptNo}）` : PHOTO_SUBJECT)}&body=${encodeURIComponent(
    "法人名・施設名：\nお名前：\nご連絡先：\n\n添付する写真（分かる範囲で）：\n・室外機の銘板（型番・製造年の書かれた札）\n・室内機\n・電気料金の明細（直近のもの）\n"
  )}`;

type Picked = { id: string; name: string; kind: "photo" | "pdf"; bytes: number; data: string; preview: string | null };

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("ファイルを読めませんでした。"));
    r.readAsDataURL(file);
  });

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

/** 写真は長い辺1600pxの JPEG に縮める。開けない形式（パソコンの HEIC など）は、そのまま送る */
async function toPicked(file: File): Promise<Picked> {
  const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    try {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("decode"));
          el.src = url;
        });
        const scale = Math.min(1, ATTACH_PHOTO_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const jpeg = canvas.toDataURL("image/jpeg", 0.82);
        return { id, name: file.name.replace(/\.[^.]+$/, "") + ".jpg", kind: "photo", bytes: bytesOf(jpeg), data: jpeg, preview: jpeg };
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      /* 下でそのまま読む */
    }
  }
  const raw = await readAsDataUrl(file);
  return { id, name: file.name, kind: isPdf ? "pdf" : "photo", bytes: file.size, data: raw, preview: null };
}

export function ConsultForm({
  source,
  programId,
  options,
  preselect,
  answers,
  id: anchorId = "consult",
}: {
  source: ProgramLeadSource;
  /** カードの「この制度で相談する」で押された制度（変わるたびに印を付ける） */
  programId?: ProgramId | null;
  /** 選べる制度（並べる順） */
  options?: ProgramId[];
  /** 最初から印を付けておく制度 */
  preselect?: ProgramId[];
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
  const [delivered, setDelivered] = useState<boolean | null>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const openedAt = useRef<number>(0);
  useEffect(() => { openedAt.current = Date.now(); }, []);

  const [picked, setPicked] = useState<ProgramId[]>(() => Array.from(new Set([...(preselect ?? []), ...(programId ? [programId] : [])])));
  useEffect(() => {
    if (programId) setPicked((x) => (x.includes(programId) ? x : [...x, programId]));
  }, [programId]);
  const choices = Array.from(new Set([...(options ?? []), ...picked, ...(programId ? [programId] : [])])).filter((x) => Object.prototype.hasOwnProperty.call(PROGRAMS, x));
  const togglePick = (pid: ProgramId) => setPicked((x) => (x.includes(pid) ? x.filter((y) => y !== pid) : [...x, pid]));
  const [flags, setFlags] = useState<ConsultFlagId[]>([]);
  const toggleFlag = (f: ConsultFlagId) => setFlags((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  const [note, setNote] = useState("");
  const [sites, setSites] = useState("");
  const sectionRef = useRef<HTMLElement | null>(null);
  /* 施設が複数：?multi=1 で来たとき・「まとめて相談」のボタンが押されたときに、印を付けて施設の一覧の欄を出す */
  useEffect(() => {
    const on = () => {
      setFlags((x) => (x.includes("multiSite") ? x : [...x, "multiSite"]));
      sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    if (new URLSearchParams(window.location.search).get("multi") === "1") on();
    window.addEventListener(CONSULT_MULTI_EVENT, on);
    return () => window.removeEventListener(CONSULT_MULTI_EVENT, on);
  }, []);
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
  const total = files.reduce((n, f) => n + f.bytes, 0);

  const addFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setFileMsg(null);
    setReading(true);
    try {
      const next = [...files];
      for (const f of Array.from(list)) {
        if (next.length >= ATTACH_MAX_FILES) { setFileMsg(`添付は${ATTACH_MAX_FILES}つまでです。`); break; }
        const p = await toPicked(f);
        if (next.reduce((n, x) => n + x.bytes, 0) + p.bytes > ATTACH_MAX_TOTAL_BYTES) {
          setFileMsg(`合計が${fmtBytes(ATTACH_MAX_TOTAL_BYTES)}を超えるため「${f.name}」は添えられませんでした。大きなPDFはメールでお送りください。`);
          continue;
        }
        next.push(p);
      }
      setFiles(next);
    } catch {
      setFileMsg("ファイルを読めませんでした。写真（JPEG・PNG・HEIC）か PDF をお選びください。");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!company.trim() || !name.trim() || !reachText || !reachOk || !consent || busy || reading) return;
    setBusy(true);
    try {
      const res = await fetch("/api/program-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(), name: name.trim(), reach: reachText, consent,
          source, programId: picked[0] ?? null, programIds: picked, flags, note: note.trim(), sites: flags.includes("multiSite") ? sites.trim() : "", answers: answers ?? null,
          attachments: files.map((f) => ({ name: f.name, data: f.data })),
          referral: currentReferral(), hp, elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; receiptNo?: string; attachmentsDelivered?: boolean | null } | null;
      if (!res.ok || !json?.ok || !json.receiptNo) {
        track("consult_submit", { ok: false, source });
        setError(json?.error || (res.status === 413 ? "添付が大きすぎて送れませんでした。枚数を減らすか、写真はメールでお送りください。" : `送信できませんでした。時間をおいて、もう一度お試しください。お急ぎの場合はお電話（${COMPANY.tel}）でどうぞ。`));
        return;
      }
      track("consult_submit", { ok: true, source });
      setDelivered(json.attachmentsDelivered ?? null);
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
    <section ref={sectionRef} id={anchorId} aria-labelledby={`${id}-title`} className="scroll-mt-32 rounded-3xl border border-ink-line bg-white p-5 shadow-card sm:p-6">
      <h2 id={`${id}-title`} className="text-[22px] font-bold leading-[1.4]">相談する</h2>
      <p className="mt-1 text-[15px] leading-[1.8] text-ink-soft">
        必須の入力は3つだけです（ほかは任意）。写真やPDFもそのまま添えて送れます。
      </p>
      <div className="mt-3 rounded-2xl bg-paper-sub p-4">
        <p className="text-[15px] font-bold">送ったあとの流れ</p>
        <ol className="mt-2 grid gap-1.5 text-[14px] leading-[1.6]">
          {[
            `担当からご連絡します（${COMPANY.replyDays}営業日以内。電話かメールの、ご希望の方法で）`,
            "写真・図面・電気料金の明細から、工事と補助の目安をお伝えします",
            "現地を見て、お見積りをお出しします（工事のご依頼が決まった現場の現地調査には、費用はかかりません）",
            "制度の申し込みの準備をします（補助が決まる前に、契約はしません）",
          ].map((t, i) => (
            <li key={t} className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-deep text-[12px] font-bold text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">見積り・図面・省エネの計算などの資料づくりは、工事にならなかった場合も、工事の規模によって費用がかかることがあります。申し込みの準備には1か月ほどかかるため、締切の1か月前までのご相談をおすすめします。</p>
        <p className="mt-1 text-[13px] leading-[1.7] text-ink-soft">お急ぎのとき（空調が止まった・壊れた）は、お電話がいちばん早いです。補助が決まる前に工事を始めると補助は使えないため、待てないときは、補助を使わずに直す方法も含めてご相談ください。</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => { track("consult_call", { kind: "photo", place: source }); fileRef.current?.click(); }}
          disabled={!!receiptNo}
          className="flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-brand-deep bg-paper-sub px-4 py-3 text-left text-brand-deep disabled:opacity-50"
        >
          <Camera aria-hidden className="h-6 w-6 shrink-0" />
          <span><b className="block text-[16px]">写真・PDFを選ぶ</b><span className="text-[13px] text-ink">押すと、室外機の型番の札（銘板）・電気料金の明細・図面を選べます</span></span>
        </button>
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
          {files.length > 0 && delivered !== false && <p>添えていただいた {files.length} 件の写真・PDF も、担当に届けました。</p>}
          {files.length > 0 && delivered === false && (
            <p className="rounded-xl border border-red-700/30 bg-red-50 px-3 py-2 text-red-800">
              ご相談は受け付けましたが、添えていただいた写真・PDFは届きませんでした。お手数ですが
              <a href={photoHref(receiptNo)} className="mx-1 font-bold underline underline-offset-4">メールで送って</a>
              ください（件名に受付番号が入ります）。
            </p>
          )}
          {files.length === 0 && (
            <p>
              室外機の銘板・電気料金の明細の写真があると、概算が早く出せます。
              <a href={photoHref(receiptNo)} className="mx-1 font-bold text-brand-deep underline underline-offset-4">メールで送る</a>
              （件名に受付番号が入ります）
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {choices.length > 0 && (
            <fieldset>
              <legend className="text-[14px] font-bold text-ink">相談したい制度（任意・いくつでも）</legend>
              <div className="mt-1 grid gap-2">
                {choices.map((pid) => {
                  const pr = PROGRAMS[pid];
                  const on = picked.includes(pid);
                  return (
                    <button key={pid} type="button" aria-pressed={on} onClick={() => togglePick(pid)} className={cn("flex min-h-[48px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-[14px] leading-[1.5]", on ? "border-brand-deep bg-paper-tint font-bold text-brand-deep" : "border-ink-line bg-white text-ink")}>
                      <span aria-hidden className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border-2", on ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line")}>{on ? "✓" : ""}</span>
                      <span><span className="block text-[12px] font-bold text-ink-soft">{pr.tag}</span>{pr.title}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[13px] text-ink-soft">選ばなくても大丈夫です（担当がご一緒に決めます）。</p>
            </fieldset>
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

          <fieldset>
            <legend className="text-[14px] font-bold text-ink">当てはまるもの（任意）</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {CONSULT_FLAGS.map((f) => {
                const on = flags.includes(f.id);
                return (
                  <button key={f.id} type="button" aria-pressed={on} onClick={() => toggleFlag(f.id)} className={cn("min-h-[44px] rounded-full border px-3 text-[14px] font-bold", on ? "border-brand-deep bg-brand-deep text-white" : "border-ink-line bg-white text-ink")}>
                    {on ? "✓ " : ""}{f.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {flags.includes("multiSite") && (
            <div className="rounded-2xl border-2 border-brand-deep/30 bg-paper-tint p-3">
              <label htmlFor={`${id}-sites`} className="block text-[14px] font-bold text-ink">施設・建物の一覧（任意・1行に1施設）</label>
              <p className="text-[13px] leading-[1.7] text-ink-soft">施設名・所在地（市区町村まで）・種類（特養・事務所ビルなど）・気になっている設備を、分かる範囲で。まとめて1回の相談として承ります。</p>
              <textarea id={`${id}-sites`} rows={5} maxLength={CONSULT_SITES_MAX} value={sites} onChange={(e) => setSites(e.target.value)} placeholder={"例：\n特養あおば　世田谷区　広域型特養　空調が20年\nグループホームみどり　川崎市　GH　給湯器\n本社ビル　中野区　事務所　照明"} className={cn(inputCls(false), "min-h-[140px] py-2")} />
            </div>
          )}
          <div>
            <label htmlFor={`${id}-note`} className="block text-[14px] font-bold text-ink">ご相談の内容（任意）</label>
            <textarea id={`${id}-note`} rows={3} maxLength={CONSULT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：夏に1台止まった／施設が3つあり、まとめて相談したい／図面はある など" className={cn(inputCls(false), "min-h-[96px] py-2")} />
          </div>

          <div>
            <p className="text-[14px] font-bold text-ink">写真・PDF（任意・{ATTACH_MAX_FILES}つまで）</p>
            <label
              htmlFor={`${id}-files`}
              className="mt-1 flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-line bg-paper-sub px-4 py-3 text-center text-[15px] font-bold text-brand-deep hover:border-brand"
            >
              {reading ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Paperclip aria-hidden className="h-5 w-5" />}
              {reading ? "読み込んでいます…" : "写真・PDFを選ぶ（撮影もできます）"}
            </label>
            <input
              ref={fileRef}
              id={`${id}-files`}
              type="file"
              multiple
              accept={ATTACH_ACCEPT}
              className="sr-only"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <p className="mt-1 text-[13px] leading-[1.7] text-ink-soft">
              例：室外機の型番の札（銘板）、室内機、電気料金の明細、図面。写真は送る前にこの端末で小さくします（合計 {fmtBytes(ATTACH_MAX_TOTAL_BYTES)} まで）。
            </p>
            {fileMsg && <p className="mt-1 text-[14px] font-bold text-red-800">{fileMsg}</p>}
            {files.length > 0 && (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl border border-ink-line bg-white p-2">
                    {f.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.preview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-paper-sub"><FileText aria-hidden className="h-6 w-6 text-brand-deep" /></span>
                    )}
                    <span className="min-w-0 flex-1 text-[13px] leading-[1.5]">
                      <span className="block truncate font-bold">{f.name}</span>
                      <span className="text-ink-soft">{f.kind === "pdf" ? "PDF" : "写真"}・{fmtBytes(f.bytes)}</span>
                    </span>
                    <button type="button" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-paper-sub" aria-label={`${f.name} を外す`}>
                      <X aria-hidden className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {files.length > 0 && <p className="mt-1 text-[12px] text-ink-soft">合計 {fmtBytes(total)} ／ {fmtBytes(ATTACH_MAX_TOTAL_BYTES)}</p>}
          </div>

          <div style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
            <label htmlFor={`${id}-hp`}>この欄は空のままにしてください</label>
            <input id={`${id}-hp`} name="ehc_hp_website" type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>
          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-paper-sub p-3 text-[15px] leading-[1.7]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errs.consent || undefined} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
            <span>
              ご相談への連絡のために、入力した内容{answers ? "・診断の答え" : ""}{files.length ? "・添えた写真やPDF" : ""}を EHC が使うことに同意します（
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
            disabled={busy || reading}
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-deep px-4 text-[17px] font-bold text-white hover:bg-brand disabled:opacity-60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
          >
            {busy && <Loader2 aria-hidden className="h-5 w-5 animate-spin" />}
            {busy ? "送信しています…" : files.length ? `この内容で相談する（添付 ${files.length} 件）` : "この内容で相談する"}
          </button>
        </div>
      )}
    </section>
  );
}
