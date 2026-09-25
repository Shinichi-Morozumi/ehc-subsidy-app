import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { clientKeyFromHeaders, overSubmitRateLimit } from "@/lib/submitRateLimit";
import {
  buildDiagnosisSnapshot,
  customerMailText,
  staffMailText,
  type DiagnosisContact,
  type SnapshotUnpricedItem,
} from "@/lib/diagnosisSnapshot";
import type { DesiredTiming, EquipGroup, EquipType, RefriType } from "@/lib/types";
import {
  diagnosisContentForId,
  diagnosisFingerprint,
  estimateDigest,
} from "@/lib/diagnosisId";
import {
  allDelivered,
  channelRecord,
  contentMatchesEntry,
  describeLedger,
  loadEntry,
  markChannel,
  newEntry,
  saveEntry,
  shouldSend,
  withSubmitLock,
  type ChannelState,
  type SubmitChannel,
  type SubmitEntry,
} from "@/lib/submitLedger";
import { getSubsidies } from "@/lib/subsidies";
import { todayJst } from "@/lib/programClock";
import {
  assessTargetProduct,
  describeTargetProductStore,
  fiscalYearOf,
  frameUndecidedAssessment,
  listChecks,
  targetProductKeyOf,
  targetProductStaffLines,
  FRAME_UNDECIDED_LABEL,
  type PlannedUnit,
  type TargetProductSubmitSubsidy,
  type TargetProductSubmitSummary,
} from "@/lib/targetProduct";
import { ensureTargetProductStore } from "@/lib/targetProductStore";
import type { EquipKind } from "@/lib/diagnosisState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────────────────────────────────────────────
   診断フロー E段の送信（EHC-0039 第6片 / 2026-09-14 v1）

   ■ なぜ /api/send-proposal を使い回さないのか
   　　send-proposal は「提案書PDFを社内（EHC＋PN）へ1通送る」ための口である。
   　　お客様には何も届かない。replyTo にお客様のアドレスが入るだけで、
   　　これは返信先の指定であって送信ではない。
   　　E段が要るのは
   　　　① お客様宛（お客様のアドレスへ、社内情報を含まない本文とPDF）
   　　　② 担当者宛（社内の宛先へ、連絡先と現地確認項目つき）
   　　の2通・別送である。send-proposal を改造して両対応にすると、
   　　いま本番で動いている CustomerReport の送信まで一緒に壊れる。
   　　だから新しい口を作り、send-proposal には触らない。

   ■ クライアントの金額を信用しない
   　　画面が送ってきた合計額は参考として受け取るだけで、
   　　メール本文・記録に載せる数字はサーバ側で
   　　buildDiagnosisSnapshot() を呼び直して作る。

   ■ 食い違ったら送らない（2026-09-15 修正4 でここを変えた）
   　　以前は合計が違っても recomputed:true を付けて送っていた。
   　　その結果、画面とPDFには画面側の内容、メール本文にはサーバ側の内容という
   　　中身の違う書類が同じ受付番号で相手に残る余地があった。
   　　いまは内容の指紋（lib/diagnosisId.ts）と明細の要約を突き合わせ、
   　　一致しなければ409で返して1通も送らない。画面は診断のやり直しへ戻す。
   　　PDFのバイト列を検証しているわけではないので、
   　　「PDFを受け取った＝内容が一致した」とは扱わない。

   ■ 送信状態は台帳で持つ（2026-09-15 修正3）
   　　lib/submitLedger.ts が「診断ID × 内容 × 宛先」ごとに状態を持つ。
   　　届いた宛先は二度送らず、落ちた宛先だけ送り直せる。
   　　SMTPの応答が取れなかった場合は unknown として残し、自動再送しない
   　　（2通届くのを避ける）。「必ず一度だけ送信する」とは書かない。
   　　既定の保存先はプロセス内のメモリなので、プロセスをまたいだ再試行は
   　　成立しない。その事実は応答の ledger にそのまま載せる。

   ■ 既定は送らない（dry run）
   　　DIAGNOSIS_MAIL_MODE=send を明示した環境でだけ実際に送る。
   　　既定は本文を組み立ててサーバログに出すところまで。
   　　未承認の実送信を、実装を進めた副作用として起こさないため。

   ■ 環境変数
   　　DIAGNOSIS_MAIL_MODE … "send"＝お客様宛・担当者宛の両方を実送信 ／ "staff"＝担当者宛だけ実送信
　　　　　　　　　　　　 （お客様宛は送らない。EHC-0043）／ それ以外・未設定＝dry run（既定）
   　　SMTP_USER / SMTP_PASS / SMTP_HOST / SMTP_PORT … send-proposal と共通
   　　DIAGNOSIS_FROM_EMAIL … 省略時 PROPOSAL_FROM_EMAIL → SMTP_USER
   　　DIAGNOSIS_STAFF_TO_EMAIL … 省略時 PROPOSAL_TO_EMAIL → info@ehcjpn.com
   　　DIAGNOSIS_STAFF_CC_EMAIL … 省略時 PROPOSAL_CC_EMAIL → info@project-neo.co.jp
   ─────────────────────────────────────────────────────────── */

const MAX_PDF_BASE64_CHARS = 14_000_000;

/* 2026-09-15 EHC-0039 修正3:
   ここには「受付番号 → 前回の結果」の Map があり、成功・失敗を問わず
   結果を保存していた。そのため顧客宛だけ失敗したあと、同じ番号で
   再試行しても保存済みの結果を返すだけで、失敗した宛先を送り直さなかった。
   状態は lib/submitLedger.ts が「診断ID × 内容 × 宛先」ごとに持つ。
   このファイルは台帳に問い合わせて、送る宛先を決めるだけにする。 */

/* ───────── 受け取った値の正規化 ─────────
   クライアントから来るものは全部 unknown として扱う。
   数値のふりをした文字列・NaN・負の台数が、そのまま見積エンジンに入ると
   金額が静かに壊れる（estimateMachineCost は負のhpを0に丸めて最低額を返す）。 */

const EQUIP_TYPES: EquipType[] = ["ac", "multi"];
const REFRI_TYPES: RefriType[] = ["r22", "r410a", "r32", "unknown"];
const TIMINGS: DesiredTiming[] = [
  "within_1m",
  "within_3m",
  "within_6m",
  "within_12m",
  "undecided",
];

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function asPositiveNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function asText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function normalizeGroups(v: unknown): EquipGroup[] {
  if (!Array.isArray(v)) return [];
  const out: EquipGroup[] = [];
  for (const raw of v.slice(0, 30)) {
    if (!raw || typeof raw !== "object") continue;
    const g = raw as Record<string, unknown>;
    const equip = EQUIP_TYPES.includes(g.equip as EquipType) ? (g.equip as EquipType) : null;
    const units = asPositiveInt(g.units);
    const installYear = asPositiveInt(g.installYear);
    /* 種類・台数・設置年のどれかが欠けている群は、ここで落とす。
       落とした事実は unpriced 側（画面が別途送ってくる未算定一覧）に
       すでに理由つきで入っている。ここで既定値を作って補完しない。 */
    if (!equip || units == null || installYear == null) continue;
    out.push({
      id: asText(g.id, 40) || `g${out.length + 1}`,
      equip,
      refri: REFRI_TYPES.includes(g.refri as RefriType) ? (g.refri as RefriType) : "unknown",
      installYear,
      units,
      hp: asPositiveNumber(g.hp),
    });
  }
  return out;
}

function normalizeUnpriced(v: unknown): SnapshotUnpricedItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 30)
    .map((raw) => {
      const u = (raw || {}) as Record<string, unknown>;
      return { label: asText(u.label, 120), reason: asText(u.reason, 200) };
    })
    .filter((u) => u.label.length > 0);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeContact(v: unknown): DiagnosisContact | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const name = asText(c.name, 80);
  const email = asText(c.email, 160);
  /* 氏名とメールだけを必須にする。会社名・電話は任意。
     ここを4項目必須にすると、社名を出したくない段階の相談が全部落ちる。 */
  if (!name || !EMAIL_RE.test(email)) return null;
  return {
    name,
    email,
    company: asText(c.company, 120) || null,
    phone: asText(c.phone, 40) || null,
  };
}

/* ───────── 導入予定機器（対象製品の照合用・台帳 #65） ─────────
   ここで読むのは「入れる予定のもの」だけである。

   読まないもの（body に入っていても無視する）:
     targetProductChecks / targetProductChecked / checked / verdict /
     details / evidence
   これらは「補助対象かどうかの判定結果」であって、クライアントが
   決めてよい値ではない。受け取ると判定の根拠が利用者の手元に移る。
   判定は下の buildTargetProductSummary() が保存先から引き直して作る。

   equipGroups（既設群）と混ぜない。既設は撤去する機械の銘板で、
   補助対象になるのは導入予定機器のほうである。
   app/api/target-product/route.ts の readPlannedUnits() と同じ厳しさで読む。 */
function readPlannedUnits(raw: unknown): PlannedUnit[] {
  if (!Array.isArray(raw)) return [];
  const out: PlannedUnit[] = [];
  raw.slice(0, 30).forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const kind = o.equipKind;
    /* room / ac / multi / unknown 以外は null に落とす。
       ここで room を ac へ読み替えない（AGENTS §2-4 の禁止事項）。 */
    const equipKind: EquipKind =
      kind === "room" || kind === "ac" || kind === "multi" || kind === "unknown" ? kind : null;
    const model = asText(o.model, 80) || null;
    const maker = asText(o.maker, 80) || null;
    const id = asText(o.id, 40) || `plan-${i}`;
    out.push({ id, equipKind, model, maker });
  });
  return out;
}

/** 保存先から引き直して、制度ごとの照合結果を作る。クライアントの申告は見ない。 */
async function buildTargetProductSummary(
  plans: PlannedUnit[]
): Promise<TargetProductSubmitSummary> {
  /* 接続できなければ未接続のまま進む。ここで例外にしない。
     未接続だと全制度が未確認になるだけで、送信そのものは成立する
     （相談は受け付けられる）。未接続という事実は summary に残す。 */
  const storeStatus = ensureTargetProductStore();
  /* 既定の年度は今日（JST）から出す。SUBSIDY_DATA_ASOF は
     「制度データをこちらが確認した日」であって申請年度ではない。

     2026-09-16 台帳#32: ただし制度が programFiscalYear を宣言していれば
     その年度で引く。SII の設備単位型／GX設備単位型は令和7年度補正（2025年度）の
     事業で、3次公募の受付だけが2026年度に行われるため、
     今日の年度で引くと参照している一覧と1年ずれたキーになる。
     照合キーの決定は lib/targetProduct.ts の targetProductKeyOf ただ1つに置く
     （画面の口 app/api/target-product と同じ関数を使い、結果がずれないようにする）。 */
  const checkedAt = todayJst();
  const fiscalYear = fiscalYearOf(checkedAt);

  const subsidies: TargetProductSubmitSubsidy[] = [];
  for (const s of getSubsidies()) {
    const key = targetProductKeyOf(s, checkedAt);
    /* 枠が2つ以上あって未確定なら、見るべき一覧そのものが決まらない。
       保存先も引かない（片方の枠の記録を制度全体へ繰り上げる余地を作らない）。 */
    const a =
      key.frame === null
        ? frameUndecidedAssessment(key.frames, plans)
        : assessTargetProduct(
            { subsidyId: s.id, fiscalYear: key.fiscalYear, frame: key.frame, plans },
            await listChecks(s.id, key.fiscalYear),
            [...s.target]
          );
    subsidies.push({
      subsidyId: s.id,
      subsidyName: s.name,
      frame: key.frame ?? FRAME_UNDECIDED_LABEL,
      fiscalYear: key.fiscalYear,
      frames: key.frames,
      status: a.status,
      checked: a.checked,
      reason: a.reason,
      nextAction: a.nextAction,
      evidence: a.evidence,
    });
  }

  return {
    fiscalYear,
    checkedAt,
    store: {
      ...describeTargetProductStore(),
      ...(storeStatus.reason ? { reason: storeStatus.reason } : {}),
    },
    plans,
    subsidies,
  };
}

/* ───────── SMTPの失敗の分け方（修正3） ─────────
   「送れなかった（相手は受け取っていない）」と
   「送れたか分からない（受け取っている可能性がある）」を分ける。
   前者は再試行して構わない。後者を機械的に再試行すると2通届く。

   判断の材料は nodemailer が投げるエラーの形:
     responseCode がある … SMTPサーバが番号で拒否した。本文は受理されていない
     command が本文を渡す前の段 … 接続・認証・宛先で落ちた。渡していない
     それ以外の切断（DATA中・タイムアウト） … 受理されたか分からない */
const PRE_DATA_COMMANDS = new Set([
  "CONN",
  "EHLO",
  "HELO",
  "AUTH",
  "AUTH PLAIN",
  "AUTH LOGIN",
  "AUTH XOAUTH2",
  "STARTTLS",
  "MAIL FROM",
  "RCPT TO",
  "API",
]);
const INDETERMINATE_CODES = new Set([
  "ETIMEDOUT",
  "ESOCKET",
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "ETLS",
]);

function classifySendFailure(e: unknown): Extract<ChannelState, "failed" | "unknown"> {
  const err = (e ?? {}) as { code?: unknown; command?: unknown; responseCode?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  const command = typeof err.command === "string" ? err.command.toUpperCase() : "";
  if (typeof err.responseCode === "number") return "failed";
  if (code === "EAUTH" || code === "ECONNECTION" || code === "EENVELOPE" || code === "EMESSAGE") {
    return "failed";
  }
  if (PRE_DATA_COMMANDS.has(command)) return "failed";
  if (INDETERMINATE_CODES.has(code)) return "unknown";
  /* 分類できないものは failed にしない。届いた可能性を消せないため。
     unknown は自動再送されないので、人が確認する側に倒す。 */
  return command === "DATA" || command === "" ? "unknown" : "failed";
}

/** 画面へ返す宛先ごとの結果。前回すでに送れていた宛先は already_sent で区別する。 */
function channelResult(
  entry: SubmitEntry,
  channel: SubmitChannel,
  target: string,
  attemptedNow: boolean
): string {
  const rec = channelRecord(entry, channel, target);
  if (!attemptedNow && rec.state === "sent") return "already_sent";
  return rec.state;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "リクエスト形式が不正です。" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  const receiptNo = asText(body.receiptNo, 40);
  if (!/^EHC-\d{8}-\d{6}-[0-9A-Z]{4}$/.test(receiptNo)) {
    return NextResponse.json({ ok: false, error: "受付番号がありません。" }, { status: 400 });
  }

  const contact = normalizeContact(body.contact);
  if (!contact) {
    return NextResponse.json(
      { ok: false, error: "お名前とメールアドレスをご確認ください。" },
      { status: 400 }
    );
  }

  const equipGroups = normalizeGroups(body.equipGroups);
  const unpriced = normalizeUnpriced(body.unpriced);
  const budget = asPositiveNumber(body.customerBudgetYen);
  const desiredTiming = TIMINGS.includes(body.desiredTiming as DesiredTiming)
    ? (body.desiredTiming as DesiredTiming)
    : null;
  const issuedAtJst = asText(body.issuedAtJst, 60) || new Date().toISOString();

  /* ここがサーバ側の再計算。画面が送ってきた合計（clientTotal）は
     照合にしか使わず、本文・記録にはこの snapshot の値だけを使う。 */
  const snapshot = buildDiagnosisSnapshot({
    receiptNo,
    issuedAtJst,
    contact,
    equipGroups,
    unpriced,
    customerBudgetYen: budget ?? null,
    desiredTiming,
    /* 2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）:
       削減率の根拠は null で渡す。[] ではない。
       根拠は matchSubsidies() が出した GroupResult から作るもので、
       サーバがこの要求で受け取るのは設備群・連絡先・予算・時期だけである。
       所在地や事業規模を含む MatchInput が無いので照合をやり直せない。
       画面が送ってきた根拠をそのまま信じて本文に載せることもしない
       （サーバ側の再計算という、この API の役目と逆になる）。
       よってメール本文には根拠を書かない。根拠が載るのは
       画面（C段）と、画面側で作る診断書PDFの2つだけである。 */
    reductionBasis: null,
  });

  /* ───────── 内容の照合（修正4） ─────────
     画面が「この内容で確定した」と言っている指紋と、サーバが同じ定義で
     作り直した指紋を突き合わせる。一致しなければ、画面・PDF・メールの
     どこかが別の内容を指している。そのまま送ると、番号は合っているのに
     中身の違う書類が相手に残る。だから送らずに返す。

     合計だけでなく明細の要約（estimateDigest）も見る。
     機器の入れ替えで合計が偶然同じになることはあり、合計一致だけを
     根拠にすると明細の違う書類を取り違える。

     指紋が付いていない要求も送らない。照合できないものを
     「照合できた」と扱わないため。古い画面から来た場合は、
     画面を再読み込みして作り直してもらう。 */
  const clientTotal = typeof body.clientTotal === "number" ? body.clientTotal : null;
  const serverTotal = snapshot.estimate?.total ?? null;
  const clientFingerprint = asText(body.contentFingerprint, 80);
  const clientDigest = asText(body.estimateDigest, 40);
  const serverFingerprint = diagnosisFingerprint({
    kind: "diagnosis",
    caseKey: contact.email,
    content: diagnosisContentForId({
      contact,
      equipGroups,
      unpriced,
      customerBudgetYen: budget ?? null,
      desiredTiming,
    }),
  });
  const serverDigest = estimateDigest(snapshot.estimate);

  const mismatchKind: "fingerprint" | "estimate" | "total" | null = !clientFingerprint
    ? "fingerprint"
    : clientFingerprint !== serverFingerprint
      ? "fingerprint"
      : !clientDigest || clientDigest !== serverDigest
        ? "estimate"
        : clientTotal != null && serverTotal != null && Math.abs(clientTotal - serverTotal) >= 1
          ? "total"
          : null;

  if (mismatchKind) {
    console.error(
      "[diagnosis-submit] 画面とサーバで診断内容が一致しません。送信しません:",
      JSON.stringify({
        receiptNo,
        mismatchKind,
        clientFingerprint: clientFingerprint || null,
        serverFingerprint,
        clientDigest: clientDigest || null,
        serverDigest,
        clientTotal,
        serverTotal,
      })
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          "画面の内容とサーバの計算結果が一致しないため、送信を中止しました。恐れ入りますが前の段から診断をやり直してください。",
        mode: "not_sent",
        receiptNo,
        issuedAtJst,
        contentMismatch: true,
        mismatchKind,
        contentVerified: false,
        /* 添付の処理にも進んでいない。PDFの状態は「送っていない」で表す。 */
        pdf: "not_sent",
        customer: "skipped",
        staff: "skipped",
        duplicate: false,
        retriedChannels: [],
        serverTotal,
        clientTotal,
        ledger: describeLedger(),
      },
      { status: 409 }
    );
  }

  // v1 / 2026-09-23: 添付が無い・破損している要求では1通も送らない。
  // ここで確認するのは形式のみ。PDFの診断内容とsnapshotの一致を保証するものではない。
  const rawPdf = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  const filename = asText(body.filename, 120) || `診断書_${receiptNo}.pdf`;
  let pdfStatus: "ok" | "missing" | "too_large" | "invalid" = "missing";
  let pdfBytes: Buffer | null = null;
  if (rawPdf.length > MAX_PDF_BASE64_CHARS) {
    pdfStatus = "too_large";
  } else if (rawPdf) {
    const base64 = rawPdf.startsWith("data:")
      ? /^data:application\/pdf;(?:filename=[^;,]*;)?base64,(.*)$/s.exec(rawPdf)?.[1]
      : rawPdf;
    if (base64 && base64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      const bytes = Buffer.from(base64, "base64");
      const header = bytes.subarray(0, 9).toString("ascii");
      const tail = bytes.subarray(Math.max(0, bytes.length - 1024)).toString("ascii");
      if (bytes.toString("base64") === base64 && /^%PDF-(?:1\.[0-7]|2\.0)/.test(header) && /%%EOF\s*$/.test(tail)) {
        pdfBytes = bytes;
        pdfStatus = "ok";
      } else pdfStatus = "invalid";
    } else pdfStatus = "invalid";
  }
  if (!pdfBytes) {
    return NextResponse.json({
      ok: false,
      error: pdfStatus === "too_large"
        ? "PDFの容量が上限を超えています。送信していません。"
        : "診断書PDFを確認できなかったため送信を中止しました。内容を確認して、もう一度お試しください。",
      mode: "not_sent", receiptNo, issuedAtJst, pdf: pdfStatus,
      customer: "skipped", staff: "skipped", allDelivered: false,
    }, { status: pdfStatus === "too_large" ? 413 : 422 });
  }
  const attachment = { filename, content: pdfBytes, contentType: "application/pdf" };

  /* ───────── 対象製品の照合（台帳 #65） ─────────
     画面の口（/api/target-product）で引き直した結果はブラウザの中にしか無い。
     送信の時点で担当者が受け取る書類に確認状態が1行も無いと、
     「照合していない案件」と「登録を確認できた案件」が手元で区別できない。
     だからここでもサーバがもう一度保存先から引き直す。

     body の targetProductChecks / checked / verdict は読んでいない
     （readPlannedUnits は plans だけを読む）。

     ■ plans を diagnosisContentForId に足さない
     　　足すと、plans を送らない既存の画面から来た要求の
     　　contentFingerprint が必ずサーバ側と食い違い、
     　　上の照合で全件 409 になって誰も送信できなくなる。
     　　対象製品の照合結果はサーバが保存先から引き直すものなので、
     　　「画面とサーバで同じ内容か」の指紋に入れる必要が無い。
     　　（指紋の定義を変えるときは、画面側と同時に変える。）

     照合に失敗しても送信は止めない。相談の受付そのものは成立している。
     失敗したときは節を出さず、理由をサーバログに残す。 */
  const plans = readPlannedUnits(body.plans);
  let targetProduct: TargetProductSubmitSummary | null = null;
  try {
    targetProduct = await buildTargetProductSummary(plans);
  } catch (e) {
    console.error(
      "[diagnosis-submit] 対象製品の照合に失敗しました（送信は続行します）:",
      e instanceof Error ? e.message : String(e)
    );
  }

  /* 画面へ返す形。checks はサーバが保存先から引き直した値であって、
     クライアントが送ってきた値ではない。null は「照合できなかった」で、
     「対象ではない」ではない。画面がこの2つを取り違えないよう別の値にする。 */
  const targetProductPayload = targetProduct
    ? {
        fiscalYear: targetProduct.fiscalYear,
        checkedAt: targetProduct.checkedAt,
        store: targetProduct.store,
        planCount: plans.length,
        listedSubsidyIds: targetProduct.subsidies.filter((s) => s.checked).map((s) => s.subsidyId),
        checks: Object.fromEntries(targetProduct.subsidies.map((s) => [s.subsidyId, s.checked])),
        notes: Object.fromEntries(targetProduct.subsidies.map((s) => [s.subsidyId, s.reason])),
        /* 2026-09-16 台帳#32。制度ごとの照合年度と枠。
           上の fiscalYear（既定＝今日の年度）だけを返すと、
           令和7年度補正の制度を「2026年度の一覧で確認した」と読ませてしまう。
           枠未確定の制度は frames が2件以上あり、checks は false のままになる。 */
        fiscalYears: Object.fromEntries(
          targetProduct.subsidies.map((s) => [s.subsidyId, s.fiscalYear])
        ),
        frames: Object.fromEntries(targetProduct.subsidies.map((s) => [s.subsidyId, s.frames])),
        frameUndecidedSubsidyIds: targetProduct.subsidies
          .filter((s) => s.status === "frame_undecided")
          .map((s) => s.subsidyId),
      }
    : null;

  const customerText = customerMailText(snapshot);
  /* 確認主体・出典・確認日は社内の照合記録なので、担当者宛にだけ載せる。
     customerMailText には渡さない。 */
  const staffText = staffMailText(
    snapshot,
    targetProduct ? targetProductStaffLines(targetProduct) : undefined
  );
  const subjectCustomer = `【受付番号 ${receiptNo}】空調更新の診断結果と概算見積（株式会社EHCソリューションズ）`;
  const subjectStaff = `【Web診断 ${receiptNo}】${contact.company || contact.name} 様からのご相談`;

  // ───────── 送信 ─────────
  /* 2026-09-25 EHC-0043: "staff" を追加した。担当者宛だけ実際に送り、お客様宛は送らない。
     お客様宛は「画面から来た宛先へ、画面から来たPDFを、EHC の Gmail から送る」ため、
     サーバ側でPDFを作る仕組みと送信回数の制限が揃うまでは、踏み台にされる余地が残る。
     担当者宛は宛先が社内に固定なので、その余地が無い。
       live         … 何かしら実送信する（staff / send）
       liveCustomer … お客様宛も実送信する（send のときだけ） */
  const mailMode = (process.env.DIAGNOSIS_MAIL_MODE || "").toLowerCase();
  const liveCustomer = mailMode === "send";
  const live = liveCustomer || mailMode === "staff";
  const customerMail: "on" | "off" | "dry_run" = liveCustomer ? "on" : live ? "off" : "dry_run";

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const from =
    process.env.DIAGNOSIS_FROM_EMAIL ||
    process.env.PROPOSAL_FROM_EMAIL ||
    (smtpUser ? `EHCソリューションズ <${smtpUser}>` : "");
  const staffTo = (process.env.DIAGNOSIS_STAFF_TO_EMAIL || process.env.PROPOSAL_TO_EMAIL || "info@ehcjpn.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const staffCc = (process.env.DIAGNOSIS_STAFF_CC_EMAIL || process.env.PROPOSAL_CC_EMAIL || "info@project-neo.co.jp")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  /* 宛先の文字列。ここが変われば別の宛先として扱われ、未送信から始まる
     （社内の宛先を増やしたのに「もう送った」と判定されないため）。 */
  const staffTarget = [...staffTo, ...staffCc].join(",");
  const targets: Array<{ channel: SubmitChannel; target: string }> = [
    { channel: "customer", target: contact.email },
    { channel: "staff", target: staffTarget },
  ];

  /* ───────── ここから台帳（修正3） ─────────
     同じ診断IDへの要求を直列にする。直列にしないと、連打した2つの要求が
     どちらも「未送信」を読んでから両方送り、同じ宛先へ2通出る。 */
  /* 2026-09-25 EHC-0043: 実送信する設定のときだけ、接続元ごとの連続送信を止める。
     上限に触れたら1通も送らず、台帳にも触れない。 */
  if (live && overSubmitRateLimit(clientKeyFromHeaders(req.headers))) {
    console.warn("[diagnosis-submit] 連続送信の上限に触れたため受け付けません:", receiptNo);
    return NextResponse.json(
      {
        ok: false,
        error:
          "短い時間に送信が続いたため、いったん受付を止めています。1時間ほどおいてから、もう一度お試しください。お急ぎの場合はお電話（03-5937-4340）でご連絡ください。",
        mode: "not_sent",
        receiptNo,
        issuedAtJst,
        pdf: "not_sent",
        customer: "skipped",
        staff: "skipped",
        customerMail,
        rateLimited: true,
      },
      { status: 429 }
    );
  }

  const outcome = await withSubmitLock(receiptNo, async () => {
    const existing = await loadEntry(receiptNo);

    /* 同じ番号で内容が違う。前回の受付結果を返してはいけない。
       返すと、いま画面に出ている内容が受け付けられたように見える。 */
    if (existing && !contentMatchesEntry(existing, serverFingerprint, serverDigest)) {
      console.error(
        "[diagnosis-submit] 同じ受付番号に別の内容が来ました。送信しません:",
        JSON.stringify({ receiptNo, stored: existing.contentFingerprint, now: serverFingerprint })
      );
      return {
        status: 409,
        payload: {
          ok: false,
          error:
            "この受付番号は別の内容で受け付けています。恐れ入りますが前の段から診断をやり直してください。",
          mode: "not_sent",
          receiptNo,
          issuedAtJst,
          contentMismatch: true,
          mismatchKind: "fingerprint" as const,
          contentVerified: false,
          idReused: true,
          pdf: "not_sent",
          customer: "skipped",
          staff: "skipped",
          duplicate: false,
          retriedChannels: [] as string[],
          serverTotal,
          clientTotal,
          ledger: describeLedger(),
        },
      };
    }

    const entry =
      existing ??
      newEntry({
        diagnosisId: receiptNo,
        contentFingerprint: serverFingerprint,
        estimateDigest: serverDigest,
      });

    const customerRec = channelRecord(entry, "customer", contact.email);
    const staffRec = channelRecord(entry, "staff", staffTarget);
    /* staff 運用ではお客様宛を送る対象に入れない。送らないので「未送信で残っている宛先」にもしない。 */
    const sendCustomer = live && !liveCustomer ? false : shouldSend(customerRec);
    const sendStaff = shouldSend(staffRec);
    /* 前回1度でも試していて、まだ届いていない宛先。画面に出して
       「どこを送り直したか」が分かるようにする。 */
    const retriedChannels = [
      ...(sendCustomer && customerRec.attempts > 0 ? ["customer"] : []),
      ...(sendStaff && staffRec.attempts > 0 ? ["staff"] : []),
    ];

    const mode = live ? "send" : "dry_run";

    /* 2026-09-25 EHC-0043: staff 運用では、お客様宛は方針として送らない。
       skipped は送信回数に数えない（lib/submitLedger.ts の markChannel）。
       以前の send 運用で届いた記録（sent）や結果不明（unknown）は上書きしない。 */
    if (live && !liveCustomer && customerRec.state !== "sent" && customerRec.state !== "unknown") {
      markChannel(entry, "customer", contact.email, "skipped", "お客様宛の自動送付は停止中（担当者宛のみ運用）");
    }

    if (!sendCustomer && !sendStaff) {
      /* 送るべき宛先が無い。すでに全部届いている、または
         結果不明で自動再送しない宛先しか残っていない。
         エラーにしないのは、通信が切れて結果を受け取れなかった人が
         もう一度押したときに「失敗」と見えると、さらに押すからである。 */
      const payload = {
        ok: staffRec.state === "sent" || staffRec.state === "dry_run",
        mode,
        customerMail,
        receiptNo,
        issuedAtJst,
        pdf: pdfStatus,
        customer: channelResult(entry, "customer", contact.email, false),
        staff: channelResult(entry, "staff", staffTarget, false),
        duplicate: true,
        retriedChannels,
        note: "この受付番号はすでに受け付けています。重ねて送信していません。",
        contentMismatch: false,
        mismatchKind: null,
        contentVerified: true,
        allDelivered: allDelivered(entry, targets),
        serverTotal,
        clientTotal,
        targetProduct: targetProductPayload,
        ledger: describeLedger(),
      };
      entry.lastPayload = payload;
      await saveEntry(entry);
      return { status: 200, payload };
    }

    if (!live) {
      /* 送らない。本文が正しく組めているかは、この2本のログで確認する。
         「送信できた」と画面に出さないこと。dry_run のまま返す。
         dry_run を送信済みとして台帳に書かない（書くと、実送信に
         切り替えた日に「もう送った」と判定されて誰にも届かない）。 */
      console.info(
        "[diagnosis-submit] DRY RUN（DIAGNOSIS_MAIL_MODE が staff / send ではないため送信しません）",
        JSON.stringify({
          receiptNo,
          pdf: pdfStatus,
          customer: { to: contact.email, subject: subjectCustomer, chars: customerText.length },
          staff: { to: staffTo, cc: staffCc, subject: subjectStaff, chars: staffText.length },
        })
      );
      console.info(`[diagnosis-submit] 顧客宛本文 ${receiptNo}\n${customerText}`);
      console.info(`[diagnosis-submit] 担当者宛本文 ${receiptNo}\n${staffText}`);
      if (sendCustomer) markChannel(entry, "customer", contact.email, "dry_run");
      if (sendStaff) markChannel(entry, "staff", staffTarget, "dry_run");
    } else if (!smtpUser || !smtpPass) {
      console.error("[diagnosis-submit] SMTP_USER / SMTP_PASS が未設定のため送信できません。");
      if (sendCustomer) {
        markChannel(entry, "customer", contact.email, "not_configured", "SMTP未設定");
      }
      if (sendStaff) markChannel(entry, "staff", staffTarget, "not_configured", "SMTP未設定");
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || "465"),
        secure: Number(process.env.SMTP_PORT || "465") === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      /* 2通は別々に送る。お客様を社内のCCに入れない。
         1通にまとめて cc でお客様を入れると、社内向けの記述
         （担当割り当て・現地確認の未確定項目）がそのままお客様に届く。
         片方が落ちても、もう片方は送る。まとめて失敗にしない。
         すでに届いている宛先は、ここに入らない（shouldSend で外れている）。 */
      if (sendCustomer) {
        try {
          await transporter.sendMail({
            from,
            to: contact.email,
            subject: subjectCustomer,
            text: customerText,
            attachments: attachment ? [attachment] : undefined,
          });
          markChannel(entry, "customer", contact.email, "sent");
        } catch (e) {
          const state = classifySendFailure(e);
          const msg = e instanceof Error ? e.message : String(e);
          markChannel(entry, "customer", contact.email, state, msg);
          console.error(`[diagnosis-submit] お客様宛の送信に失敗(${state}):`, msg);
        }
      }

      if (sendStaff) {
        try {
          await transporter.sendMail({
            from,
            to: staffTo,
            cc: staffCc,
            replyTo: contact.email,
            subject: subjectStaff,
            text: staffText,
            attachments: attachment ? [attachment] : undefined,
          });
          markChannel(entry, "staff", staffTarget, "sent");
        } catch (e) {
          const state = classifySendFailure(e);
          const msg = e instanceof Error ? e.message : String(e);
          markChannel(entry, "staff", staffTarget, state, msg);
          console.error(`[diagnosis-submit] 担当者宛の送信に失敗(${state}):`, msg);
        }
      }
    }

    const staffState: ChannelState = channelRecord(entry, "staff", staffTarget).state;

    /* ok は「担当者に届いたか」で決める。
       お客様宛が失敗しても相談自体は受け付けられているので、
       画面には ok:true ＋ customer:"failed" を出し、
       「メールが届かない場合は…」の案内を出させる。
       逆に担当者宛が落ちたときは、受け付けられていないので ok:false。
       結果不明（unknown）は ok にしない。届いた前提で案内を出せない。 */
    const payload = {
      ok: staffState === "sent" || staffState === "dry_run",
      mode,
      customerMail,
      receiptNo,
      issuedAtJst,
      pdf: pdfStatus,
      customer: channelResult(entry, "customer", contact.email, sendCustomer),
      staff: channelResult(entry, "staff", staffTarget, sendStaff),
      duplicate: false,
      retriedChannels,
      contentMismatch: false,
      mismatchKind: null,
      contentVerified: true,
      allDelivered: allDelivered(entry, targets),
      serverTotal,
      clientTotal,
      targetProduct: targetProductPayload,
      /* できていないことを黙らない。既定の保存先はプロセス内のメモリなので、
         再起動やインスタンスの切り替えをまたいだ再試行は成立しない。 */
      ledger: describeLedger(),
    };
    entry.lastPayload = payload;
    await saveEntry(entry);
    return { status: 200, payload };
  });

  return NextResponse.json(outcome.payload, { status: outcome.status });
}
