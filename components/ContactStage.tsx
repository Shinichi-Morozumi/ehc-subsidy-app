"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesiredTiming, EquipGroup, MatchInput } from "@/lib/types";
import type { MatchResult } from "@/lib/match";
import { buildReductionBasisViews, type ReductionBasisView } from "@/lib/reductionBasisView";
import { yenJP } from "@/lib/pricing";
import {
  caseFingerprintOf,
  diagnosisContentForId,
  estimateDigest,
  peekDiagnosisId,
  resolveDiagnosisId,
  type DiagnosisIdInput,
} from "@/lib/diagnosisId";
import { buildDiagnosisPdf, MAX_PDF_BASE64_CHARS } from "@/lib/diagnosisPdf";
import {
  EQUIP_LABEL_JA,
  TIMING_LABEL_JA,
  buildDiagnosisSnapshot,
  normalizeEnergyBill,
  normalizeSubsidyCheck,
  nowJstText,
  pricedGroupsOf,
  type DiagnosisContact,
  type DiagnosisSnapshot,
  type SnapshotSubsidyCheck,
  type SnapshotUnpricedItem,
} from "@/lib/diagnosisSnapshot";
import type { EnergyBill } from "@/lib/diagnosisEnergy";
import {
  UNRESOLVED_REASON_LABEL,
  UNRESOLVED_REASON_NOTE,
  type EquipProjection,
} from "@/lib/diagnosisProjection";
import { COMPANY } from "@/lib/company";

/* ───────────────────────────────────────────────────────────
   E段「診断書を受け取って相談」（EHC-0039 第7片 / 2026-09-14 v1）

   ■ この段が引き受けること
   　　ここまでの4段で出した内容を1つに固め、
   　　　① PDFにする
   　　　② お客様宛に送る
   　　　③ 担当者宛に送る
   　　を1回の操作で終わらせる。

   ■ 診断結果をメール入力で遮らない
   　　よくある作りは「結果を見るにはメールアドレスを入力」だが、
   　　この画面ではC段（結果と根拠）もD段（概算費用と工事）も
   　　メールを入れずに読み終わっている。
   　　ここで入力するのは「送り先」であって「閲覧の鍵」ではない。
   　　戻れば結果はそのまま読める、と画面にも書いておく。

   ■ 必須は氏名とメールだけ
   　　会社名・電話は任意。既存チャット側の4項目必須ゲートは流用しない。
   　　社名をまだ出したくない段階の相談を、必須項目で落とさない。

   ■ 画面・PDF・顧客メール・担当者メールで数字を割らせない
   　　送信ボタンを押した時点で buildDiagnosisSnapshot() を1回だけ呼び、
   　　以後はそのオブジェクトだけを読む。
   　　サーバ側も同じ関数で計算し直し、内容の指紋と明細の要約を突き合わせる。
   　　食い違ったらサーバは1通も送らず 409 を返す（2026-09-15 修正4）。
   　　以前はサーバ側の値で送っていたが、それは画面・PDFとメールで
   　　中身の違う書類を同じ受付番号で相手に残す動きだった。

   ■ 失敗を成功で隠さない
   　　PDF生成／お客様宛／担当者宛は別々に結果を出す。
   　　「送信しました」の一言でまとめない。
   　　既定ではサーバは実送信しない（DIAGNOSIS_MAIL_MODE=send のときだけ送る）。
   　　その場合は画面にも「実際には送っていない」と出す。嘘をつかない。
   ─────────────────────────────────────────────────────────── */

type Phase = "input" | "rendering" | "sending" | "done";

/* 2026-09-15 EHC-0039 修正3:
   送信結果は「宛先ごと」に持つ。sent / failed の2値に潰さない。
     unknown       … SMTPの応答が取れなかった。届いたか届いていないか分からない。
                     これを failed と同じ扱いにして再送すると二重送信になり、
                     sent と同じ扱いにすると届いていない相談を受付済みにする。
     already_sent  … 前回の試行で送信済み。今回は送っていない（重複防止）。
     skipped       … 送る条件を満たしていない（内容不一致で送信を止めた等）。 */
type ChannelResult =
  | "sent"
  | "already_sent"
  | "dry_run"
  | "failed"
  | "unknown"
  | "not_configured"
  | "skipped";

interface SubmitResult {
  ok: boolean;
  mode: "send" | "dry_run" | "not_sent";
  receiptNo: string;
  /** not_sent は「内容が一致しないので添付の処理にも進んでいない」 */
  pdf: "ok" | "missing" | "too_large" | "invalid" | "not_sent";
  customer: ChannelResult;
  staff: ChannelResult;
  /** 画面とサーバで内容が食い違ったか。true のときは1通も送っていない */
  contentMismatch?: boolean;
  /** 食い違いの内訳（合計だけか、明細か、入力そのものか） */
  mismatchKind?: "fingerprint" | "total" | "estimate" | null;
  /** サーバ側で内容の指紋を突き合わせられたか。false なら照合できていない */
  contentVerified?: boolean;
  /** 同じ受付番号に別の内容が来た。古い受付結果は返さない */
  idReused?: boolean;
  serverTotal: number | null;
  clientTotal: number | null;
  duplicate?: boolean;
  /** 全宛先に届いているか */
  allDelivered?: boolean;
  /** 今回この要求で送り直した宛先（前回届いていなかったもの） */
  retriedChannels?: string[];
  /* 送信状態の保存先。プロセスをまたいだ再試行が成立するかを載せる。
     できていないことを画面側でも黙らないため、型に残す。 */
  ledger?: { persistence: string; shared: boolean; crossProcessRetry: boolean };
  note?: string;
  /** お客様宛メールの運用（EHC-0043）。off＝担当者宛だけ送る運用で、お客様宛は送っていない */
  customerMail?: "on" | "off" | "dry_run";
}

/* 2026-09-25 EHC-0043:
   画面の説明文は、実際の送り方と同じ値から作る。next.config.mjs が
   サーバの DIAGNOSIS_MAIL_MODE から NEXT_PUBLIC_DIAGNOSIS_CUSTOMER_MAIL を作る
   （send のときだけ "on"）。お客様宛を送らない運用なのに
   「このアドレスへお送りします」と約束する画面にしないため。 */
const CUSTOMER_MAIL_ON = process.env.NEXT_PUBLIC_DIAGNOSIS_CUSTOMER_MAIL === "on";

export interface ContactStageProps {
  input: MatchInput | null;
  projection: EquipProjection;
  /* 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）:
     削減率の根拠を診断書PDFへ載せるために、C段と同じ照合結果を受け取る。
     ここで matchSubsidies() を呼び直さないこと。呼べば、同じ画面の中で
     結果の出どころが2つになり、C段の画面とPDFで％が割れる余地ができる。
     まだ照合していない（設備が1群も計算できる形になっていない）ときは null。 */
  result: MatchResult | null;
  customerBudgetYen: number | null;
  desiredTiming: DesiredTiming | null;
  /* 2026-09-25 補助金の候補と適合チェックの結果（DiagnosisFlow が C段と同じ判定結果から作る）。
     診断書PDFと担当者宛メールに載せる。 */
  subsidyCheck?: SnapshotSubsidyCheck | null;
  /** 2026-09-25 電気料金の明細（任意）。担当者宛メールに載せる */
  energyBill?: EnergyBill | null;
  /** 「概算費用と工事」へ戻す */
  onBack?: () => void;
}

export function ContactStage({
  input,
  projection,
  result: matchResult,
  customerBudgetYen,
  desiredTiming,
  subsidyCheck,
  energyBill,
  onBack,
}: ContactStageProps) {
  /* 2026-09-15 EHC-0039 修正1:
     ここは以前 useState の初期化関数で issueDocumentNumber() を呼んでいた。
     CustomerReport.tsx も同じことをしていたので、同じ相談について
     番号が2つ出ていた（発行関数が同じでも、呼ぶ場所が2つあれば番号は2つ）。

     番号の発行主体を lib/diagnosisId.ts 1本に移し、鍵は「診断内容」にする。
     ・内容を確定した時点（送信ボタン）で1回だけ引き当てる
     ・同じ内容なら何度でも同じ番号（戻る・再表示・PDF再生成・送信再試行）
     ・内容を直して確定し直したら別の番号（旧内容の書類と識別できる）
     入力途中で引き当てないこと。1文字ごとに内容が変わるので番号が増える。 */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  /* 送信用に固めたスナップショット。
     これを state に入れてから、隠しシートが描かれた次のレンダーでPDFにする。 */
  const [frozen, setFrozen] = useState<DiagnosisSnapshot | null>(null);
  /* 固めた内容の指紋。サーバ側が同じ内容から同じ指紋を作れるかを確かめる（修正4）。
     state ではなく ref にしているのは、この値でレンダーを起こす必要がなく、
     PDF化のeffectの依存（frozen 1本）を増やしたくないため。 */
  const fingerprintRef = useRef<string>("");

  const sheetRef = useRef<HTMLDivElement | null>(null);

  /* 2026-09-25 UXレビュー No.12: 空欄のときに「形式をご確認ください」と出していた。
     空欄は「ご入力ください」、形式違いは例を添えて伝える。 */
  const nameError = touched && name.trim().length === 0 ? "お名前をご入力ください。" : null;
  const emailError = !touched
    ? null
    : email.trim().length === 0
      ? "メールアドレスをご入力ください。"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? "メールアドレスの形式をご確認ください（例：name@example.co.jp）。"
        : null;
  const canSubmit =
    privacyAgreed &&
    name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    phase === "input";

  const unpriced: SnapshotUnpricedItem[] = projection.unresolvedGroups.map((u) => ({
    label:
      u.group.units != null ? `室内機 ${u.group.units} 台の設備` : "台数が未入力の設備",
    reason: u.reasons
      .map((r) => `${UNRESOLVED_REASON_LABEL[r]}／${UNRESOLVED_REASON_NOTE[r]}`)
      .join(" / "),
  }));

  /* いまの入力内容に対応する番号の引き当て条件。
     resolveDiagnosisId() はここでは呼ばない（発行してしまう）。 */
  const buildIdInput = useCallback(
    (contact: DiagnosisContact): DiagnosisIdInput => ({
      kind: "diagnosis",
      caseKey: contact.email,
      /* 2026-09-16 EHC-0039 v2 §3 修正1b:
         確定した時点で「この案件の受付番号はこれ」という札を立てるための鍵。
         指紋（番号の一致性）には入らないので、この行を足しても
         既存の番号・サーバ側の内容照合は1文字も変わらない。
         札を読むのは旧・提案書（CustomerReport）side だけである。 */
      caseFingerprint: caseFingerprintOf({
        email: contact.email,
        equipGroups: input?.equipGroups ?? [],
      }) ?? undefined,
      content: diagnosisContentForId({
        contact,
        equipGroups: input?.equipGroups ?? [],
        unpriced,
        customerBudgetYen,
        desiredTiming,
      }),
    }),
    [input, unpriced, customerBudgetYen, desiredTiming]
  );

  const currentContact: DiagnosisContact = {
    name: name.trim(),
    email: email.trim(),
    company: company.trim() || null,
    phone: phone.trim() || null,
  };
  /* すでに同じ内容で発行済みなら、その番号を先に見せる。
     「戻る」で離れて同じ内容に戻ってきた人に、同じ番号が出る。
     未発行のときは null で、画面は「送信時に発行します」と書く。
     ここで発行しないこと（入力中に番号が増える）。 */
  const issuedRecord = peekDiagnosisId(buildIdInput(currentContact));

  const handleSubmit = useCallback(() => {
    setTouched(true);
    setError(null);
    if (!canSubmit) {
      /* 2026-09-25 UXレビュー No.12: 送信ボタンは画面の下にあり、エラー文は上の欄の下に出る。
         気づかずに何度も押さないよう、最初に直す欄へ画面を戻してカーソルを置く。 */
      if (phase !== "input") return;
      const firstId =
        name.trim().length === 0
          ? "contact-name"
          : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            ? "contact-email"
            : !privacyAgreed
              ? "contact-privacy"
              : null;
      if (firstId && typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          const el = document.getElementById(firstId);
          el?.scrollIntoView({ block: "center", behavior: "auto" });
          el?.focus({ preventScroll: true });
        });
      }
      return;
    }

    const contact: DiagnosisContact = {
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || null,
      phone: phone.trim() || null,
    };
    /* 内容を確定した時点で1回だけ引き当てる。
       同じ内容で2回目に押したときは、同じ record が返る（新発行はされない）。 */
    const record = resolveDiagnosisId(buildIdInput(contact));
    const snapshot = buildDiagnosisSnapshot({
      receiptNo: record.id,
      issuedAtJst: nowJstText(),
      contact,
      equipGroups: input?.equipGroups ?? [],
      unpriced,
      customerBudgetYen,
      desiredTiming,
      /* 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）:
         削減率の根拠も、送信ボタンを押した時点の値として一緒に固める。
         紙を描く時に組み立てると、C段で見た根拠と、PDFに載る根拠が
         別のレンダーの値になりうる（このファイル冒頭の「数字を割らせない」と同じ理由）。
         照合をまだ行えていない（result が null）ときは null。[] にしない。
         [] は「確かめた結果、対象の群が無かった」の意味で、いまは確かめていない。 */
      reductionBasis: matchResult ? buildReductionBasisViews(matchResult.groups) : null,
      /* 2026-09-25: 補助金の候補と適合チェック。サーバと同じ切り詰め（normalizeSubsidyCheck）を
         ここでも通し、PDFに載る内容とサーバが担当者宛メールに載せる内容を同じにする。 */
      subsidyCheck: normalizeSubsidyCheck(subsidyCheck ?? null),
      energyBill: normalizeEnergyBill(energyBill ?? null),
    });
    fingerprintRef.current = record.fingerprint;
    setFrozen(snapshot);
    setPhase("rendering");
  }, [
    canSubmit,
    phase,
    privacyAgreed,
    name,
    email,
    company,
    phone,
    buildIdInput,
    input,
    matchResult,
    unpriced,
    customerBudgetYen,
    desiredTiming,
    subsidyCheck,
    energyBill,
  ]);

  /* 2026-09-14 EHC-0039: 送信が終わっても「送信しています…」から戻らなかった不具合の修正
     ───────────────────────────────────────────────────────────
     もとの実装は、この useEffect の依存が [phase, frozen] で、
     中の非同期処理が途中で setPhase("sending") を呼んでいた。
     つまり自分で依存を書き換えていた。その結果、

       1回目の実行: PDFを作る → setPhase("sending")
       → phase が変わったので effect が作り直される
       → 1回目の後片付けが走り、1回目の alive が false になる
       → 2回目の実行は phase!=="rendering" なので即 return
       → 1回目の fetch が返ってきても `if (!alive) return` で捨てられ、
         setPhase("done") に到達しない

     という順序になり、サーバは受け付けているのに画面は永久に
     「送信しています…」のまま止まる。受け付けられた事実が画面から消えるので、
     利用者は届いていないと判断してもう一度送る。そのとき受付番号は
     コンポーネントごとに発行済みのものが使われるとは限らず、
     サーバ側の重複防止（同一受付番号10分）をすり抜けて
     担当者宛が2通出る余地が残る。成功を失敗のように見せる表示なので直す。

     直し方は2つ。
     ① 依存から phase を外し、確定スナップショット（frozen）が
        新しくなったときだけ走らせる。handleSubmit は frozen と
        phase="rendering" を同じ更新でセットするので、
        この effect が動く時点で隠しシートは描かれている。
     ② 打ち切り判定を「この effect 実行が作り直されたか」ではなく
        「コンポーネントが本当に消えたか」に変える。
        React の StrictMode は開発時に effect を二重に呼ぶため、
        実行ごとの alive フラグのままだと同じ取りこぼしが起きる。

     再送（失敗後にもう一度押す）は handleSubmit が新しい
     スナップショットを作るため、識別子ではなくオブジェクトの同一性で
     判定すれば正しく走る。受付番号が同じ再送はサーバ側が
     duplicate:true を返して二重送信を防ぐ。 */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const startedRef = useRef<DiagnosisSnapshot | null>(null);

  /* 2026-09-25 EHC-0043: 作ったPDFを画面から保存できるようにする。
     お客様宛メールを止めている間は、これがお客様の唯一の受け取り方になる。
     作り直したら古いURLは解放する（端末のメモリに数MBずつ残さない）。 */
  const [pdfFile, setPdfFile] = useState<{ url: string; filename: string } | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const replacePdfFile = (next: { url: string; filename: string } | null) => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = next ? next.url : null;
    setPdfFile(next);
  };
  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    []
  );

  /* 隠しシートが描かれてからPDFにする。
     handleSubmit の中で続けて呼ぶと、まだ古いDOM（または空）を撮ってしまう。 */
  useEffect(() => {
    if (!frozen) return;
    if (startedRef.current === frozen) return;
    startedRef.current = frozen;
    const alive = () => mountedRef.current;

    (async () => {
      let pdfBase64 = "";
      let filename = "";
      try {
        const el = sheetRef.current;
        if (!el) throw new Error("診断書の描画が見つかりません。");
        /* 2026-09-25: お客様ごとの個別のPDFなので、ファイル名にもお名前（会社名）を入れる。
           担当者が転送するときに、どのお客様のものか一目で分かるようにする。 */
        const pdf = await buildDiagnosisPdf(el, frozen.receiptNo, frozen.contact.company || frozen.contact.name);
        if (pdf.base64Length > MAX_PDF_BASE64_CHARS) {
          throw new Error("PDFのサイズが大きすぎます。");
        }
        pdfBase64 = pdf.base64;
        filename = pdf.filename;
        try {
          /* data URI を自前で Blob にする（fetch に data: を渡すと、端末の設定次第で拒まれるため）。 */
          const b64 = pdf.base64.slice(pdf.base64.indexOf(",") + 1);
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
          if (alive()) replacePdfFile({ url, filename: pdf.filename });
          else URL.revokeObjectURL(url);
        } catch (e) {
          console.error("[ContactStage] 保存用のPDFを用意できませんでした:", e);
        }
      } catch (e) {
        /* PDFだけ失敗しても、相談の受付は続ける。
           ここで止めると、入力した人は何も起きないまま放置される。
           PDF無しで送ったことは、結果表示で必ず出す。 */
        console.error("[ContactStage] PDF生成に失敗:", e);
      }
      if (!alive()) return;
      setPhase("sending");

      try {
        const res = await fetch("/api/diagnosis-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptNo: frozen.receiptNo,
            issuedAtJst: frozen.issuedAtJst,
            contact: frozen.contact,
            equipGroups: frozen.equipGroups,
            unpriced: frozen.unpriced,
            customerBudgetYen: frozen.customerBudgetYen,
            desiredTiming: frozen.desiredTiming,
            clientTotal: frozen.estimate?.total ?? null,
            /* 2026-09-15 EHC-0039 修正4:
               合計だけでなく、内容そのものの指紋と明細の要約も送る。
               サーバは同じ定義で作り直して突き合わせ、食い違えば送信しない。
               ・contentFingerprint … 入力（設備群・連絡先・予算・時期）が同じか
               ・estimateDigest     … 機器費・工事費・税・台数・系統・明細行が同じか
                 （合計だけ一致していて明細が違う書類を取り違えないため）
               pdfBase64 はこの内容から作った画像だが、こちらでPDFの中身を
               検証できたわけではない。指紋は画面側の申告として扱う。 */
            contentFingerprint: fingerprintRef.current,
            estimateDigest: estimateDigest(frozen.estimate),
            /* 2026-09-25 補助金の候補と適合チェック（指紋には入れない。サーバ側のコメント参照） */
            subsidyCheck: frozen.subsidyCheck ?? null,
            energyBill: frozen.energyBill ?? null,
            pdfBase64,
            filename,
          }),
        });
        const json = (await res.json()) as SubmitResult & { error?: string };
        if (!alive()) return;
        if (!res.ok) {
          setError(json.error || "受け付けできませんでした。時間をおいて再度お試しください。");
          /* 2026-09-15 EHC-0039 修正4:
             内容不一致で止められた場合は、固めたスナップショットを捨てる。
             残したままにすると、次に押したときに同じ古いPDFを送り直す。
             捨てると handleSubmit が現在の入力から作り直す（＝再表示・再生成）。
             番号は内容に紐づいているので、内容が同じなら同じ番号のまま。 */
          if (json.contentMismatch || ["missing", "too_large", "invalid"].includes(json.pdf)) {
            startedRef.current = null;
            setFrozen(null);
          }
          setPhase("input");
          return;
        }
        setResult(json);
        setPhase("done");
      } catch (e) {
        if (!alive()) return;
        console.error("[ContactStage] 送信に失敗:", e);
        setError("通信に失敗しました。電波の良い場所で、もう一度お試しください。");
        setPhase("input");
      }
    })();
  }, [frozen]);

  return (
    <section aria-labelledby="contact-heading" className="space-y-4">
      <header className="space-y-2">
        <h2 id="contact-heading" className="text-[20px] font-bold leading-[1.5] text-ink">
          診断書を受け取る
        </h2>
        <p className="text-[16px] leading-[1.7] text-ink-soft">
          設備・概算費用・次の確認事項を、1つのPDFに。社内での共有や、EHCへの相談に使えます。
        </p>
      </header>

      {phase === "done" && result ? (
        <div className="space-y-4">
          {issuedRecord?.fingerprint !== fingerprintRef.current && (
            <p role="status" className="rounded-2xl border border-amber-500/45 bg-amber-50 p-4 text-[16px] leading-[1.7] text-amber-800">
              送信後に入力条件が変わっています。下は送信時の内容です。最新の内容で作り直す場合は「入力内容を確認する」へ進んでください。
            </p>
          )}
          {/* 2026-09-25 UXレビュー No.9: 保存ボタンは「受け付けました」のすぐ下へ（SubmitReport の中に移した） */}
          <SubmitReport result={result} snapshot={frozen} pdfFile={pdfFile} />
          <button type="button" className="min-h-[48px] w-full rounded-2xl border border-brand bg-paper-card px-4 py-3 text-[16px] font-bold text-brand-deep"
            onClick={() => { startedRef.current = null; replacePdfFile(null); setFrozen(null); setResult(null); setError(null); setTouched(false); setPrivacyAgreed(false); setPhase("input"); }}>
            入力内容を確認する（修正・再送）
          </button>
          <p className="text-[14px] leading-relaxed text-ink-soft">このボタンでは送信しません。内容と同意を確認してから、改めて送信します。</p>
        </div>
      ) : (
        <>
          <div className="ehc-contact-fields rounded-2xl border border-ink-line bg-paper-card p-4">
            {/* 2026-09-25 UXレビュー No.11: お客様宛にメールを送らない運用では「送り先」は事実と合わない */}
            <h3 className="text-[16px] font-bold leading-[1.7] text-ink">{CUSTOMER_MAIL_ON ? "診断書の送り先" : "ご連絡先"}</h3>
            {/* 結果はメールと引き換えではない、と先に書く。
                入力欄の下に書くと、書く前に閉じた人には届かない。 */}
            <p className="mt-1 text-[16px] leading-[1.7] text-ink-soft">
              お名前とメールアドレスをご入力ください。結果は、入力せずに前の画面でも確認できます。
              送信後、{COMPANY.replyDays}営業日以内に担当者からご連絡します。
            </p>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TextField
                id="contact-name"
                label="お名前"
                required
                value={name}
                onChange={setName}
                error={nameError}
                autoComplete="name"
              />
              <TextField
                id="contact-email"
                label="メールアドレス"
                required
                type="email"
                value={email}
                onChange={setEmail}
                error={emailError}
                autoComplete="email"
                note={CUSTOMER_MAIL_ON ? "このアドレスへ診断書PDFをお送りします。" : "担当者からのご連絡に使います。診断書PDFは、送信後にこの画面から保存できます。"}
              />
            </div>
            {/* 2026-09-25 UXレビュー No.27: 電話は一番連絡がつきやすいのに、畳まれていて入力されにくかった。
                任意のまま、畳まずに出す。 */}
            <div className="mt-5 border-t border-ink-line pt-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  id="contact-company"
                  label="会社名"
                  value={company}
                  onChange={setCompany}
                  autoComplete="organization"
                  note="まだ社名を出したくない段階でも構いません。"
                />
                <TextField
                  id="contact-phone"
                  label="電話番号"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  autoComplete="tel"
                  note="ご入力いただくと、お急ぎの場合にお電話でご連絡できます。"
                />
              </div>
            </div>
          </div>

          <WhatYouGet input={input} projection={projection} receiptRecord={issuedRecord} />

          <div className="ehc-contact-privacy rounded-2xl border border-ink-line bg-paper-sub p-4">
            <h3 className="text-[16px] font-bold leading-[1.7] text-ink">送信前にご確認ください</h3>
            <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">
              個人情報の取扱いは
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="mx-1 font-bold text-brand-deep underline underline-offset-4">
                プライバシーポリシー<span className="sr-only">（新しいタブで開きます）</span> ↗
              </a>
              をご覧ください（診断の入力は消えません）。
            </p>
            <p className="mt-2 text-[16px] leading-[1.8] text-ink-soft">
              入力情報と診断結果を、PDFの作成・送付、相談への回答、EHCおよび施工連携先PNでの顧客対応・診断履歴の管理に使用します。
              {CUSTOMER_MAIL_ON ? "送信すると、お客様宛と担当者宛に診断内容が送られます。" : "送信すると、診断内容が担当者に届きます。お客様宛のメールは現在お送りしていません（診断書PDFは送信後にこの画面から保存できます）。"}制度の採択・受給・補助額、削減効果を保証するものではありません。
            </p>
            <label className="mt-4 flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-paper-card p-3 text-[16px] leading-[1.7] text-ink">
              <input id="contact-privacy" type="checkbox" checked={privacyAgreed} onChange={(event) => setPrivacyAgreed(event.target.checked)} aria-invalid={touched && !privacyAgreed ? true : undefined} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
              <span>{CUSTOMER_MAIL_ON ? "取得目的・利用範囲を確認し、診断書の送付と相談内容の共有に同意します。" : "取得目的・利用範囲を確認し、相談内容の共有に同意します。"}</span>
            </label>
            {touched && !privacyAgreed && <p role="alert" className="mt-2 flex items-start gap-1.5 text-[14px] font-bold leading-relaxed text-red-700"><AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />内容をご確認のうえ、同意欄にチェックしてください。</p>}
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-ink-line bg-paper-sub p-4 text-[14px] leading-[1.7] text-ink"
            >
              <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={phase !== "input"}
                className={cn(
                  "min-h-[48px] w-full rounded-2xl border border-ink-line bg-paper-card px-4 text-[16px] font-bold leading-[1.7] text-ink",
                  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
                  phase !== "input" && "opacity-60"
                )}
              >
                概算費用と工事へ戻る
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={phase !== "input"}
              aria-busy={phase !== "input"}
              className={cn(
                "min-h-[48px] w-full rounded-2xl bg-brand px-4 text-[16px] font-bold leading-[1.7] text-white",
                "flex items-center justify-center gap-2",
                "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
                phase !== "input" && "opacity-70"
              )}
            >
              {phase === "rendering" && (
                <Loader2 aria-hidden className="h-5 w-5 shrink-0 animate-spin" />
              )}
              {phase === "sending" && (
                <Loader2 aria-hidden className="h-5 w-5 shrink-0 animate-spin" />
              )}
              {phase === "input"
                ? "PDFを受け取り、相談する"
                : phase === "rendering"
                ? "診断書を作成しています…"
                : "送信しています…"}
            </button>
          </div>
        </>
      )}

      {/* 隠し印刷シート。
          display:none にすると html2canvas が幅0で撮って白紙になるため、
          画面の外へ出す方式にする。aria-hidden で読み上げからは外す。 */}
      {/* 2026-09-14 EHC-0039 §7: data-pdf-sheet を付ける理由
          ───────────────────────────────────────────────
          §7の「本文16px／根拠14px以上」は画面で人が読む文字の基準で、
          ここは A4（794px）の紙に落とすための版面である。紙は 10〜13px で組む。
          この2つを同じ物差しで測ると、紙の 11px が画面の違反として出てくる。
          実際、E段の文字サイズ検査で 55 個の「14px未満」が出たが、
          すべてこの隠しシートの中だった。
          display:none にできない（html2canvas が幅0で撮って白紙になる）ので、
          検査側が「これは紙だ」と判別できる目印を要素に持たせる。
          data 属性なので見た目・DOM構造・PDF出力は一切変わらない。 */}
      {frozen && createPortal(
        <div
          aria-hidden
          data-pdf-sheet
          className="no-print pointer-events-none fixed left-[-10000px] top-0 w-[794px]"
        >
          <div ref={sheetRef} className="bg-white p-8">
            <DiagnosisSheet snapshot={frozen} />
          </div>
        </div>, document.body
      )}
    </section>
  );
}

/* ───────── 入力欄 ─────────
   48px以上。枠の色だけでエラーを示さず、必ず文章を併記する。 */

function TextField({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  error,
  note,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  error?: string | null;
  note?: string;
  autoComplete?: string;
}) {
  const describedBy = [note ? `${id}-note` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label htmlFor={id} className="block text-[16px] font-bold leading-[1.7] text-ink">
        {label}
        {required ? (
          <span className="ml-2 rounded-full bg-paper-tint px-2 py-0.5 text-[14px] font-bold text-brand-deep">
            必須
          </span>
        ) : (
          <span className="ml-2 text-[14px] font-normal text-ink-soft">任意</span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "mt-1 min-h-[48px] w-full rounded-2xl border bg-paper-card px-4 text-[16px] leading-[1.7] text-ink",
          "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep",
          /* 2026-09-25 UXレビュー No.12: エラーは枠と文字の両方で示す（色だけにしない＝下に文章も出す）。
             赤は入力エラー専用。amber は「未算定・未確認」の予約色なので使わない。 */
          error ? "border-[1.5px] border-red-700 bg-red-50/40" : "border-ink-line"
        )}
      />
      {note && (
        <p id={`${id}-note`} className="mt-1 text-[14px] leading-[1.7] text-ink-soft">
          {note}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 flex items-start gap-1.5 text-[14px] font-bold leading-[1.7] text-red-700"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/* ───────── 何が届くのか ─────────
   押す前に、何が起きるかを書く。
   「送信する」を押したあとに初めて中身が分かる作りにしない。 */

function WhatYouGet({
  input,
  projection,
  receiptRecord,
}: {
  input: MatchInput | null;
  projection: EquipProjection;
  receiptRecord: ReturnType<typeof peekDiagnosisId>;
}) {
  /* ───────── 2026-09-16 EHC-0039 修正A ─────────
     input.equipGroups は「計算に渡せた群」だけで、
     ルームエアコン・種類未選択・台数未入力の群は
     lib/diagnosisProjection.ts の段階で除かれ projection.unresolvedGroups に入る。
     以前ここは頭数に groups.length を出していたため、
     ac 1群 + room 1群 のとき「設備1群（…算定1群、未算定1件）」となり、
     1群のうち2件という、足して合わない文が出ていた。
     頭数は「お客様が入力した群の総数」でなければならないので、
     除かれた群を足し戻す。除かれた群を計算へ戻すわけではない。 */
  const groups = input?.equipGroups ?? [];
  const priced = pricedGroupsOf(groups);
  const notPriced = groups.length - priced.length + projection.unresolvedGroups.length;
  const totalGroups = priced.length + notPriced;

  return (
    <div className="space-y-2">
      <details className="ehc-report-benefit rounded-2xl border border-ink-line bg-paper-sub">
        <summary className="min-h-[48px] cursor-pointer px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
          診断書に含まれる内容を確認
        </summary>
        <div className="border-t border-ink-line p-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              `ご入力の設備${totalGroups}群（算定${priced.length}群・未算定${notPriced}群）`,
              "補助金の候補と、適合チェックのご回答・結果",
              "概算費用の内訳・算定の仮定・含まない費用",
              "工事の流れ（現地確認 → 手続き → 機器手配と工事 → 試運転と引渡し）",
              "お問い合わせに使える受付番号",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-[16px] leading-[1.7] text-ink-soft">
                <CheckCircle2 aria-hidden className="mt-1 h-4 w-4 shrink-0 text-brand" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {/* 発行済みの番号だけを参照する。開閉によって新しい番号は発行しない。 */}
          <p className="mt-4 text-[14px] leading-[1.7] text-ink-soft">
            {receiptRecord ? (
              <>
                受付番号 <span className="break-words font-bold text-ink">{receiptRecord.id}</span>
                　この内容で発行済みです。
                {receiptRecord.contentVersion > 1 && (
                  <>　（ご入力を変更されたため、前回とは別の番号です）</>
                )}
              </>
            ) : (
              <>受付番号は送信時に発行します。</>
            )}
            {CUSTOMER_MAIL_ON ? "画面・PDF・お客様宛メール・担当者宛メールは、すべて同じ番号で揃えます。" : "画面・PDF・担当者宛メールは、すべて同じ番号で揃えます。"}
          </p>
        </div>
      </details>
      {!projection.canCompute && (
        <p className="text-[16px] leading-[1.7] text-ink-soft">
          概算金額は未算定です。金額欄は空のまま、設備の一覧とご相談内容を担当者にお送りします。
        </p>
      )}
    </div>
  );
}

/* ───────── 送信後の報告 ─────────
   3つの経路（PDF・お客様宛・担当者宛）を別々に出す。
   1つでも落ちていれば、それを画面に残す。 */

function SubmitReport({
  result,
  snapshot,
  pdfFile,
}: {
  result: SubmitResult;
  snapshot: DiagnosisSnapshot | null;
  /** 画面から保存できる診断書PDF（作れなかったときは null） */
  pdfFile: { url: string; filename: string } | null;
}) {
  /* 2026-09-15 EHC-0039 修正4:
     PDFが作れていないのに「診断書をお送りしました」と読める書き方をしない。
     添付が無いまま送った場合は、メールの行にもそれを書く。
     PDFの行だけに書くと、メールの行の「送信しました」を見た人は
     診断書が届いたと受け取る。 */
  const pdfAttached = result.pdf === "ok";
  const pdfNote = pdfAttached
    ? ""
    : "（診断書PDFは添付できていません。担当者から個別にお送りします）";

  const channelText = (v: ChannelResult, kind: "customer" | "staff"): string => {
    const arrive = kind === "customer" ? "送信しました" : "届いています";
    switch (v) {
      case "sent":
        return `${arrive}${pdfNote}`;
      case "already_sent":
        return `前回の送信で${kind === "customer" ? "送信済み" : "届いています"}。重ねて送っていません。`;
      case "dry_run":
        return "この環境では実際には送信していません（動作確認モード）";
      case "not_configured":
        return "送信の設定がされていないため送れていません";
      case "unknown":
        /* ここを「失敗」と書くと、届いている可能性を無いことにする。
           「成功」と書くと、届いていない可能性を無いことにする。
           どちらも嘘なので、分からないと書いて確認の連絡先を出す。 */
        return "送信の結果を確認できませんでした。届いている場合と届いていない場合があります。自動では送り直しません。受付番号をお伝えのうえご確認ください。";
      case "skipped":
        return "送信していません。";
      default:
        return kind === "customer"
          ? "送信に失敗しました。担当者から別の方法でご連絡します。"
          : "届いていません。お手数ですが、お電話でご連絡ください。";
    }
  };

  /* 2026-09-25 UXレビュー No.9: お客様宛メールを止めている運用（customerMail=off）では、
     「お客様宛メール：お送りしていません」という否定の行を一覧の上に出さない。
     保存ボタンのすぐ下で「この画面から保存してください」と肯定形で案内する。 */
  const customerMailOff = result.customerMail === "off" && result.customer === "skipped";
  const allRows: { label: string; value: string; good: boolean }[] = [
    {
      label: "診断書PDF",
      value:
        result.pdf === "ok"
          ? "作成して添付しました"
          : result.pdf === "too_large"
          ? "作成しましたが容量が大きく添付できませんでした（担当者から個別にお送りします）"
          : result.pdf === "not_sent"
          ? "送信していません（画面とサーバの内容が一致しなかったため）"
          : "作成できませんでした（担当者から個別にお送りします）",
      good: pdfAttached,
    },
    {
      label: "お客様宛メール",
      value:
        result.customerMail === "off" && result.customer === "skipped"
          ? pdfAttached
            ? "お送りしていません（現在、お客様宛のメール送付は行っていません）。診断書PDFは下の「診断書PDFを保存する」から保存できます。"
            : "お送りしていません（現在、お客様宛のメール送付は行っていません）。診断書PDFは担当者から個別にお送りします。"
          : channelText(result.customer, "customer"),
      good: result.customer === "sent" || result.customer === "already_sent",
    },
    {
      label: "担当者への連絡",
      value: channelText(result.staff, "staff"),
      good: result.staff === "sent" || result.staff === "already_sent",
    },
  ];
  const rows = customerMailOff ? allRows.filter((r) => r.label !== "お客様宛メール") : allRows;
  const pdfReady = !!pdfFile && result.pdf === "ok";

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border p-4",
          result.ok ? "border-brand bg-paper-tint" : "border-ink bg-paper-sub"
        )}
      >
        <h3 className="flex items-center gap-2 text-[20px] font-bold leading-[1.5] text-ink">
          {result.ok ? (
            <CheckCircle2 aria-hidden className="h-6 w-6 shrink-0 text-brand-deep" />
          ) : (
            <AlertCircle aria-hidden className="h-6 w-6 shrink-0 text-ink" />
          )}
          {result.ok ? "受け付けました" : "受け付けできていません"}
        </h3>
        <p className="mt-2 text-[16px] leading-[1.7] text-ink">
          受付番号 <span className="font-bold">{result.receiptNo}</span>
        </p>
        {result.duplicate && (
          <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">
            {result.note ?? "同じ受付番号ですでに受け付けています。重ねて送信していません。"}
          </p>
        )}
        {result.mode === "dry_run" && (
          <p className="mt-2 text-[16px] leading-[1.7] text-ink-soft">
            動作確認モードです。メールは実際には送信していません。
          </p>
        )}
      </div>

      {pdfReady && pdfFile && (
        <div className="space-y-1">
          <a
            href={pdfFile.url}
            download={pdfFile.filename}
            className={cn(
              "min-h-[56px] w-full rounded-2xl bg-brand px-4 text-[16px] font-bold leading-[1.7] text-white",
              "flex items-center justify-center gap-2",
              "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
            )}
          >
            診断書PDFを保存する
          </a>
          <p className="text-[14px] leading-relaxed text-ink-soft">
            {customerMailOff ? "診断書はこの画面から保存してください（メールではお送りしていません）。" : ""}
            スマートフォンでは、開いたPDFの共有ボタンから「ファイルに保存」できます。
          </p>
        </div>
      )}

      {result.ok && <NextStepsAfterSubmit receiptNo={result.receiptNo} phoneGiven={!!snapshot?.contact.phone} />}

      <dl className="divide-y divide-ink-line rounded-2xl border border-ink-line bg-paper-card">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-start gap-2 p-4"
          >
            {r.good ? (
              <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            ) : (
              <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" />
            )}
            <div>
              <dt className="text-[16px] font-bold leading-[1.7] text-ink">{r.label}</dt>
              <dd className="text-[16px] leading-[1.7] text-ink-soft">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {/* 2026-09-15 EHC-0039 修正4:
          以前ここは「サーバ側の値で送りました」という事後報告だった。
          つまり画面・PDFと違う内容のメールを送ったことを認めていた。
          いまは食い違った時点で送信を止めるため、この画面には到達しない
          （405/409 で error に落ちる）。万一 contentMismatch を持った結果が
          ここへ来た場合は、送っていないことをそのまま書く。 */}
      {result.contentMismatch && (
        <p className="rounded-2xl border border-ink bg-paper-sub p-4 text-[14px] leading-[1.7] text-ink">
          画面に表示している内容と、サーバで計算し直した内容が一致しませんでした。
          {result.mismatchKind === "estimate"
            ? "（合計は同じですが、費用の明細が一致していません）"
            : result.mismatchKind === "total"
            ? `（合計が一致していません。サーバ側の計算では${
                result.serverTotal != null ? ` ${yenJP(result.serverTotal)} ` : "別の値 "
              }です）`
            : "（ご入力の内容そのものが一致していません）"}
          取り違えを防ぐため、メールは1通も送っていません。恐れ入りますが、前の段から診断をやり直してください。
        </p>
      )}

      {result.retriedChannels && result.retriedChannels.length > 0 && (
        <details className="rounded-2xl border border-ink-line bg-paper-sub">
          <summary className="min-h-[48px] cursor-pointer px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
            再送した宛先を確認
          </summary>
          <p className="border-t border-ink-line p-4 text-[16px] leading-[1.7] text-ink-soft">
            前回届いていなかった宛先（
            {result.retriedChannels
              .map((c) => (c === "customer" ? "お客様宛" : "担当者宛"))
              .join("・")}
            ）だけを送り直しました。すでに届いている宛先へは重ねて送っていません。
          </p>
        </details>
      )}

      {/* できていないことを黙らない。既定の保存先はプロセス内のメモリなので、
          サーバが入れ替わると送信済みの記録が消える。 */}
      {result.ledger && !result.ledger.crossProcessRetry && (result.customer === "failed" || result.staff === "failed" || result.customer === "unknown" || result.staff === "unknown") && (
        <div className="rounded-2xl border border-ink-line bg-paper-sub p-4">
          <p className="text-[16px] leading-[1.7] text-ink">
            再送すると同じメールが重複して届く可能性があります。まず受付番号をお伝えのうえ、送信状況をご確認ください。
          </p>
          <details className="mt-2">
            <summary className="min-h-[48px] cursor-pointer py-3 text-[16px] font-bold leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
              再送に注意が必要な理由
            </summary>
            <p className="text-[16px] leading-[1.7] text-ink-soft">
              送信状態の記録はこのサーバの一時領域（{result.ledger.persistence}）にあります。
              時間をおいて送り直した場合、この記録が残っていないことがあります。
              その場合は同じ宛先へ重ねて送られる可能性があります。
            </p>
          </details>
        </div>
      )}

      {/* 2026-09-15 EHC-0039 通し検証で発見:
          ここは customer の状態に関係なく「宛にお送りしています」と出していた。
          動作確認モード（dry_run）でも、送信失敗でも、届いた前提の案内が出るため、
          お客様が受信箱を探し続けることになる。
          app/api/diagnosis-submit/route.ts のコメント
          「『送信できた』と画面に出さないこと」に反する表示だった。
          実際に送れたとき（customer === "sent"）だけ到達前提の案内を出し、
          それ以外は何が起きているかをそのまま書く。 */}
      {snapshot && !customerMailOff && (
        <details
          open={result.customer !== "sent" && result.customer !== "already_sent" && result.customer !== "dry_run"}
          className="rounded-2xl border border-ink-line bg-paper-card"
        >
          <summary className="min-h-[48px] cursor-pointer px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
            送付先・メールが届かない場合
          </summary>
          <p className="flex items-start gap-2 border-t border-ink-line p-4 text-[16px] leading-[1.7] text-ink-soft">
            <Mail aria-hidden className="mt-1 h-5 w-5 shrink-0" />
            <span className="min-w-0 break-words">
            {result.customer === "sent" || result.customer === "already_sent" ? (
              <>
                {snapshot.contact.email} 宛に
                {pdfAttached ? "診断書PDFを添付して" : "（診断書PDFの添付なしで）"}
                お送りしています。数分たっても届かない場合は、
                迷惑メールフォルダをご確認ください。それでも見当たらない場合は、受付番号をお伝えください。
              </>
            ) : result.customer === "unknown" ? (
              <>
                {snapshot.contact.email} 宛の送信結果を確認できませんでした。
                届いている場合と届いていない場合があります。重ねてお送りすると同じ内容が2通になるため、
                自動では送り直していません。受付番号 {result.receiptNo} をお伝えいただければ、こちらで確認します。
              </>
            ) : result.customerMail === "off" && result.customer === "skipped" ? (
              <>
                現在、お客様宛のメール送付は行っていません（{snapshot.contact.email} 宛には届きません）。
                {pdfAttached
                  ? "診断書PDFは、この画面の「診断書PDFを保存する」から保存してください。"
                  : "診断書PDFは担当者から個別にお送りします。"}
                ご相談内容は受付番号 {result.receiptNo} で担当者に届いています。担当者からご連絡します。
              </>
            ) : result.customer === "dry_run" ? (
              <>
                本番環境では {snapshot.contact.email} 宛にお送りします。
                いまは動作確認モードのため、このアドレスへは届いていません。
              </>
            ) : (
              <>
                {snapshot.contact.email} 宛のメールは送れていません。
                受付自体は番号 {result.receiptNo} で残っていますので、担当者から別の方法でご連絡します。
              </>
            )}
            </span>
          </p>
        </details>
      )}
    </div>
  );
}

/* ───────── 送信後の見通し（2026-09-25 UXレビュー No.10） ─────────
   「いつ・誰から連絡が来るか」「待つ間に何を用意すればよいか」が無く、
   待っていてよいのか分からなかった。流れは D段の「相談から工事までの4ステップ」と同じ言葉で書く。
   連絡の目安（5営業日以内）と受付時間は 2026-09-25 に運用として決まった値（lib/company.ts）。 */
function NextStepsAfterSubmit({ receiptNo, phoneGiven }: { receiptNo: string; phoneGiven: boolean }) {
  return (
    <section aria-labelledby="after-submit-heading" className="ehc-after-submit rounded-2xl border border-ink-line bg-paper-card p-4 sm:p-5">
      <h3 id="after-submit-heading" className="text-[18px] font-bold leading-[1.6] text-ink">このあとの流れ</h3>
      <ol className="mt-3 space-y-3">
        {[
          `${COMPANY.replyDays}営業日以内（土日祝を除く）に、EHC の担当者から、ご入力のメールアドレス${phoneGiven ? "またはお電話" : ""}へご連絡します。`,
          "現地で設置場所・銘板（機種・馬力・冷媒）を確認し、概算を正式なお見積りに置き換えます。",
          "補助金を使う場合は、候補制度の受付状況と必要書類を確かめ、申請の準備を一緒に進めます。",
        ].map((text, i) => (
          <li key={text} className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-3">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-tint text-[14px] font-bold text-brand-deep">{i + 1}</span>
            <span className="pt-1 text-[16px] leading-[1.7] text-ink">{text}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl bg-paper-sub px-4 py-3 text-[14px] leading-[1.8] text-ink">
        <span className="font-bold">用意しておくと話が早いもの：</span>
        室外機の銘板の写真、電気料金の明細（直近1年分があれば）
      </p>
      <p className="mt-3 text-[14px] leading-[1.8] text-ink-soft">
        お急ぎの場合は、お電話（<a className="font-bold text-brand-deep underline underline-offset-4" href={COMPANY.telHref}>{COMPANY.tel}</a>・{COMPANY.hours}）で受付番号 {receiptNo} をお伝えください。
      </p>
    </section>
  );
}

/* ───────── PDFの中身 ─────────
   画面のコンポーネントを流用せず、紙用に別で組む。
   画面用はカードの影・角丸・折りたたみを前提にしていて、
   A4へ縦に流すと余白と枠線だけでページが増える。
   数値はすべて snapshot から読む。ここで計算しない。 */

function DiagnosisSheet({ snapshot: s }: { snapshot: DiagnosisSnapshot }) {
  const priced = pricedGroupsOf(s.equipGroups);
  const hpMissing = s.equipGroups.filter((g) => !priced.includes(g));

  /* ───────── 章番号を固定文字列で書かない（2026-09-16）─────────
     「4. 伺っているご希望」は予算も時期も未回答なら出ない章である。
     それでも後ろが「5.」と固定で書いてあったので、未回答の人に届く紙は
     1・2・3・5 と番号が飛んでいた。
     ここへ削減率の根拠（台帳 #31）が加わり、出る章と出ない章の
     組み合わせがさらに増えるので、描いた順に振る小さな数え上げへ変える。
     数えるのは章の並びだけで、金額・率・日数には一切触らない。 */
  let sectionNo = 0;
  const nextNo = () => ++sectionNo;

  return (
    <div style={{ color: "#143b2d", fontSize: 13, lineHeight: 1.7 }}>
      <div style={{ borderBottom: "2px solid #286644", paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#5a6b5f" }}>
          受付番号 {s.receiptNo}　／　受付日時 {s.issuedAtJst}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
          空調更新の診断書と概算見積
        </div>
        <div style={{ fontSize: 12, color: "#5a6b5f", marginTop: 2 }}>
          {s.contact.company ? `${s.contact.company}　` : ""}
          {s.contact.name} 様
        </div>
      </div>

      <SheetHeading>{nextNo()}. ご入力の設備</SheetHeading>
      {/* 2026-09-14 EHC-0039: 1章の表だけ列幅を固定する
          ───────────────────────────────────────────
          既定の table-layout:auto は、列幅を「その列で一番長い内容」で決める。
          この表は右の欄に未算定の理由が120字ほど入る行があるため、
          右が幅をほぼ全部取り、左の設備名が
          「業務用パッケージ／／8馬力／室内機6／台」のように
          3行へ折り返されて読みにくくなっていた（実際に出力した紙で確認）。
          左は設備名、右は年か理由文と役割が決まっているので、
          内容に幅を決めさせず、こちらで 42%／58% に固定する。
          794px の紙で左は約306px、12pxの設備名なら1行に収まる。
          2章（費用明細）は左が長く右が金額と性質が逆なので、auto のままにする。 */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "42%" }} />
          <col style={{ width: "58%" }} />
        </colgroup>
        <tbody>
          {priced.map((g: EquipGroup) => (
            <SheetRow
              key={g.id}
              left={`${EQUIP_LABEL_JA[g.equip]}／${g.hp}馬力／室内機${g.units}台`}
              right={`${g.installYear}年設置`}
            />
          ))}
          {hpMissing.map((g: EquipGroup) => (
            <SheetRow
              key={g.id}
              left={`${EQUIP_LABEL_JA[g.equip]}／室内機${g.units}台`}
              right={`${g.installYear}年設置　— 未算定（馬力が未入力）`}
              wrapRight
            />
          ))}
          {s.unpriced.map((u, i) => (
            <SheetRow key={`u${i}`} left={u.label} right={`未算定（${u.reason}）`} wrapRight />
          ))}
          {s.equipGroups.length === 0 && s.unpriced.length === 0 && (
            <SheetRow left="（入力なし）" right="—" />
          )}
        </tbody>
      </table>

      {/* 2026-09-25 補助金の候補と、ご自身での確認（適合チェック）。
          C段で表示した制度と、お客様の回答・結果をそのまま載せる。ここで判定し直さない。 */}
      {s.subsidyCheck && (s.subsidyCheck.programs.length > 0 || s.subsidyCheck.answers.length > 0) && (
        <SubsidyCheckSheetSection no={nextNo()} check={s.subsidyCheck} />
      )}

      {/* 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）:
          C段の画面（components/ReductionBasisPanel.tsx）に出した根拠を、
          同じ文言・同じ丸めで紙にも出す。
          文言は lib/reductionBasisView.ts が組み立てたものだけを使い、
          ここで率を計算したり、比べられるかを判定したりしない。
          null（＝根拠を組み立てていない経路）と空配列のときは節を出さない。
          空の節を出すと「確認した結果、根拠が無かった」と読めてしまう。 */}
      {s.reductionBasis && s.reductionBasis.length > 0 && (
        <ReductionBasisSheetSection no={nextNo()} views={s.reductionBasis} />
      )}

      <SheetHeading>{nextNo()}. 概算費用</SheetHeading>
      {s.estimate ? (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {s.estimate.lines.map((l, i) => (
                <SheetRow key={i} left={`${l.label}　${l.detail}`} right={yenJP(l.amount)} />
              ))}
              <SheetRow left="小計（税抜）" right={yenJP(s.estimate.subtotal)} bold />
              <SheetRow
                left={`消費税（${Math.round(s.estimate.taxRate * 100)}%）`}
                right={yenJP(s.estimate.tax)}
              />
              <SheetRow left="合計（税込）" right={yenJP(s.estimate.total)} bold />
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "#5a6b5f", marginTop: 6 }}>
            機種グレードによる幅：{yenJP(s.estimate.lowTotal)} 〜 {yenJP(s.estimate.highTotal)}
            　／　系統数 {s.estimate.systems} 系統・回収フロン {s.estimate.kg}kg として計算（いずれも現地確認前の仮定）
          </p>
          <p style={{ fontSize: 11, color: "#5a6b5f", marginTop: 4 }}>
            補助額の算定に使うのは税抜の小計です。消費税は含みません。制度ごとに対象外の費目があるため、
            実際の補助対象経費はこれより小さくなることがあります。
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12 }}>
          未算定　{s.estimateUnavailable}
        </p>
      )}

      <SheetHeading>{nextNo()}. 工事の目安</SheetHeading>
      <p style={{ fontSize: 12 }}>
        {s.workDays != null
          ? `実働 約${s.workDays}日（室内機${s.pricedUnits}台）。連続した日数とは限らず、総工期ではありません。日程は現地確認と機器の納期で決まります。`
          : "金額を算定した設備がないため、日数の目安を出していません。"}
      </p>

      {(s.customerBudgetYen != null || s.desiredTiming != null) && (
        <>
          <SheetHeading>{nextNo()}. 伺っているご希望（概算には反映していません）</SheetHeading>
          <p style={{ fontSize: 12 }}>
            {s.customerBudgetYen != null && `ご予算：${yenJP(s.customerBudgetYen)}　`}
            {s.desiredTiming != null && `ご希望の時期：${TIMING_LABEL_JA[s.desiredTiming]}`}
          </p>
        </>
      )}

      <SheetHeading>{nextNo()}. ご確認ください</SheetHeading>
      <ul style={{ fontSize: 11, color: "#5a6b5f", paddingLeft: 16, margin: 0 }}>
        <li>
          この金額は概算です。足場・高所作業車・既存配管の更新・電源容量の増設・夜間割増は含みません。
        </li>
        <li>系統数と回収フロン量は仮定です。銘板の確認後に置き換わります。</li>
        <li>実働日数は目安で、総工期ではありません。</li>
        <li>
          補助制度によっては、交付決定より前の発注・契約・着工が対象外になります。該当するかは制度ごとに異なるため、着工前に確認します。
        </li>
      </ul>

      <div
        style={{
          borderTop: "1px solid #d4ddd4",
          marginTop: 14,
          paddingTop: 6,
          fontSize: 10,
          color: "#5a6b5f",
        }}
      >
        株式会社EHCソリューションズ　／　受付番号 {s.receiptNo}
      </div>
    </div>
  );
}

/* ───────── 補助金の候補と適合チェック（紙面）2026-09-25 ─────────
   字の大きさは他の章と同じ（表12px・注記11px）。 */
function SubsidyCheckSheetSection({ no, check }: { no: number; check: SnapshotSubsidyCheck }) {
  const cell = { borderBottom: "1px solid #d4ddd4", padding: "5px 8px 5px 0", verticalAlign: "top" as const, wordBreak: "break-word" as const };
  return (
    <>
      <SheetHeading>{no}. 補助金の候補と、ご自身での確認</SheetHeading>
      {check.programs.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "66%" }} />
          </colgroup>
          <tbody>
            {check.programs.map((p, i) => (
              <tr key={i}>
                <td style={cell}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#5a6b5f" }}>{p.group}／{p.fit}</div>
                </td>
                <td style={cell}>
                  {p.timing && <div>申請時期：{p.timing}</div>}
                  {p.amount && <div>補助額の目安：{p.amount}</div>}
                  {p.selfCheck && <div style={{ fontWeight: 700 }}>適合チェック：{p.selfCheck}</div>}
                  {p.ehcItems.length > 0 && (
                    <div style={{ fontSize: 11, color: "#5a6b5f" }}>EHC が確認すること：{p.ehcItems.join("／")}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {check.answers.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          <div style={{ fontWeight: 700 }}>適合チェックのご回答</div>
          <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
            {check.answers.map((a, i) => (
              <li key={i}>
                {a.question} → <b>{a.answer}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={{ fontSize: 11, color: "#5a6b5f", marginTop: 4 }}>
        適合チェックは、ご回答にもとづく目安です。申請できることや採択を保証するものではありません。
        対象製品の型番・省エネ量の計算などは、EHC が公募要領と照らして確認します。
      </p>
    </>
  );
}

/* ───────── 削減率の根拠（紙面）─────────
   2026-09-16 EHC-0039 v2 §4 作業3 / 台帳 #31

   出す内容は lib/reductionBasisView.ts が組み立てたものだけ。
   ここで率を計算したり、比べられるかを判定したりしない。

   文言と丸めは components/ReductionBasisPanel.tsx（C段の画面）と
   components/ReportPrintSheet.tsx（旧経路の紙面）に揃える。
   同じ案件の同じ群について、画面と2種類の紙で3通りの説明が出ることを避ける。

   紙では折りたたみが使えないので、群ごとの表と注記を必ず開いた状態で出す。
   字の大きさは §7 の画面基準（本文16px）ではなく、この隠しシート（data-pdf-sheet）
   の版面基準に合わせる。表12px・注記11px は 1章・2章と同じ。 */
function ReductionBasisSheetSection({
  no,
  views,
}: {
  no: number;
  views: ReductionBasisView[];
}) {
  const measured = views.filter((v) => v.measured != null);

  /* 出典は同じ資料が群をまたいで重複するので、資料番号とページで一意にする。
     並び順は最初に現れた順のまま（並べ替えると資料の追いかけが増える）。 */
  const sources: { key: string; text: string }[] = [];
  const seen = new Set<string>();
  measured.forEach((v) => {
    v.measured?.sources.forEach((src) => {
      const key = `${src.catalog}#${src.page}`;
      if (seen.has(key)) return;
      seen.add(key);
      sources.push({
        key,
        text: `${src.title}（資料番号 ${src.catalog} / p.${src.page} / 確認日 ${src.checkedAt}）`,
      });
    });
  });

  const th: CSSProperties = {
    borderBottom: "1px solid #286644",
    padding: "4px 8px 4px 0",
    textAlign: "left",
    verticalAlign: "bottom",
    fontWeight: 700,
  };
  const td: CSSProperties = {
    borderBottom: "1px solid #d4ddd4",
    padding: "4px 8px 4px 0",
    verticalAlign: "top",
    wordBreak: "break-word",
  };

  return (
    <>
      <SheetHeading>{no}. 削減率の根拠（設備グループごと）</SheetHeading>
      <p style={{ fontSize: 12 }}>
        設備グループごとに、削減率を何から出したかを書いています。メーカー公表値による比較と、
        係数による概算は、1つの％の中で混ぜていません。
      </p>
      {/* 列幅を固定する理由は1章と同じ。右端の「照合した型番・効率」に
          80字ほどの文が入る行があり、auto のままだと左の設備名が
          1文字ずつ縦に潰れる。 */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          tableLayout: "fixed",
          marginTop: 6,
        }}
      >
        <colgroup>
          <col style={{ width: "26%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "42%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={th}>設備グループ</th>
            <th style={th}>根拠</th>
            <th style={{ ...th, textAlign: "right" }}>削減率</th>
            <th style={th}>照合した型番・効率</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.groupId}>
              <td style={td}>{v.groupLabel}</td>
              <td style={td}>{v.basisLabel}</td>
              <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                {Math.round(v.reductionRate * 100)}%
              </td>
              <td style={td}>
                {v.measured
                  ? `既設 ${v.measured.fromModelNo}（${v.measured.fromEfficiency}） → 更新候補 ${v.measured.toModelNo}（${v.measured.toEfficiency}）／${v.measured.indexLabel}`
                  : v.notComparable
                    ? v.notComparable.label
                    : "既設機の型番が未入力のため照合していません"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {views.map((v) => (
        <p key={`note-${v.groupId}`} style={{ fontSize: 11, color: "#5a6b5f", marginTop: 4 }}>
          {v.groupLabel}：{v.note}
          {v.notComparable ? `／これから揃えるもの: ${v.notComparable.needed}` : ""}
        </p>
      ))}

      {measured.length > 0 && measured[0].measured && (
        <p style={{ fontSize: 11, color: "#5a6b5f", marginTop: 4 }}>
          ※測定条件: {measured[0].measured.conditionNote}
        </p>
      )}

      {sources.length > 0 && (
        <p style={{ fontSize: 11, color: "#5a6b5f", marginTop: 4 }}>
          ※出典: {sources.map((src) => src.text).join(" ／ ")}
        </p>
      )}
    </>
  );
}

function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        marginTop: 14,
        marginBottom: 4,
        borderLeft: "4px solid #286644",
        paddingLeft: 6,
      }}
    >
      {children}
    </div>
  );
}

/* 2026-09-14 EHC-0039: 右の欄を必ず1行にしていたのをやめる
   ───────────────────────────────────────────────
   もとは右の td が常に whiteSpace:"nowrap" だった。
   金額（¥3,396,000）や「2011年設置」なら正しい。桁の途中で折り返されると読めない。
   ところが未算定の行は、右の欄に
   「未算定（ルームエアコンのため、この診断では金額を算定しません／…別途ご相談ください。）」
   という120字ほどの文章が入る。これを nowrap にすると
   1行で数千pxの、途中で切れない箱ができる。
   その結果、実際に出力したPDFでは

     ・表が右の欄に幅を全部持っていかれ、左の「業務用パッケージ／8馬力／室内機6台」が
       1文字ずつ縦に並ぶところまで潰れた
     ・それでも収まらず、理由の文章が紙の右端で切れて読めなくなった

   という紙が出た。画面では折り返されるので気づかず、PDFにして初めて出る壊れ方である。
   金額の行だけ1行固定を残し、文章の行は折り返す。どちらの行かは
   呼び出し側が分かっているので、勝手に文字数で判定せず wrapRight で明示させる。
   縦位置を top に揃えるのは、折り返して2行以上になった行で
   左右がずれて対応が読めなくなるのを防ぐため。 */
function SheetRow({
  left,
  right,
  bold,
  wrapRight,
}: {
  left: string;
  right: string;
  bold?: boolean;
  /** 右の欄が文章のとき true。金額・年など短い値は既定（1行固定）のままにする。 */
  wrapRight?: boolean;
}) {
  return (
    <tr>
      <td
        style={{
          borderBottom: "1px solid #d4ddd4",
          padding: "4px 8px 4px 0",
          verticalAlign: "top",
          wordBreak: "break-word",
          fontWeight: bold ? 700 : 400,
        }}
      >
        {left}
      </td>
      <td
        style={{
          borderBottom: "1px solid #d4ddd4",
          padding: "4px 0",
          textAlign: wrapRight ? "left" : "right",
          whiteSpace: wrapRight ? "normal" : "nowrap",
          wordBreak: "break-word",
          verticalAlign: "top",
          fontWeight: bold ? 700 : 400,
        }}
      >
        {right}
      </td>
    </tr>
  );
}
