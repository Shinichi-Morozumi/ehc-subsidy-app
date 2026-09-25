/* ───────────────────────────────────────────────────────────
   診断IDの発行（EHC-0039 修正1 / 2026-09-15 v1）

   ■ 直している事故
   　　components/CustomerReport.tsx の proposalNo と
   　　components/ContactStage.tsx の receiptNo が、それぞれ自分の
   　　useState の中で issueDocumentNumber() を呼んでいた。
   　　発行関数が同じでも、呼ぶ場所が2つあれば番号は2つ出る。
   　　同じ相談について、お客様の手元に番号の違う書類が2通残る。

   ■ 決めたこと
   　　番号は「診断内容」に対して1つ。発行主体をこのファイル1本にする。
   　　内容が同じなら何度呼んでも同じ番号が返る（＝再表示・PDF再生成・
   　　送信再試行で番号が増えない）。内容が変わったら別の番号になる。

   ■ セッションで配らない理由
   　　「同じタブだから同じ番号」にすると、旧・提案書（CustomerReport）と
   　　新・診断書（ContactStage）という中身の違う2種類の書類に
   　　同じ番号が貼られる。番号で照会したときにどちらの内容か決まらない。
   　　だから鍵は内容そのもの（fingerprint）にして、書類の種類（kind）も
   　　鍵に含める。種類が違えば、たとえ項目が偶然一致しても別番号になる。

   ■ 過去に発行した番号を書き換えない
   　　registry は「fingerprint → 発行済みの番号」の一方向の台帳で、
   　　既存の項目を上書きする経路を持たない。内容が変わったときは
   　　新しい項目が増えるだけで、すでに出したPDFの番号は動かない。

   ■ ここが持たないもの
   　　金額計算・適格性判定は一切書かない。渡された内容を正規化して
   　　指紋を取るだけ。番号の文字列の作り方は lib/docNumber.ts のまま使う
   　　（形式 EHC-YYYYMMDD-HHMMSS-XXXX を変えると
   　　 app/api/diagnosis-submit/route.ts の検査と既存の照会が壊れる）。

   ■ サーバでは発行しない
   　　registry はモジュール内のメモリなので、ブラウザとサーバで別物になる。
   　　サーバ側（API）はここで番号を作らず、クライアントから来た番号と
   　　内容の指紋を突き合わせるのに diagnosisFingerprint() だけを使う。
   　　サーバで発行してしまうと、同じ内容にブラウザ側とサーバ側の2番号が出る。
   ─────────────────────────────────────────────────────────── */

import { issueDocumentNumber } from "./docNumber";

/** 書類の種類。旧・提案書と新・診断書を同じ番号に寄せないための区別。 */
export type DiagnosisDocKind = "diagnosis" | "proposal";

export interface DiagnosisIdInput {
  kind: DiagnosisDocKind;
  /* 同一案件をまとめる鍵。メールアドレスや会社名など、
     「同じ相手の何度目か」を数えるためだけに使う。
     空文字でよい（改訂番号が常に1になるだけで、番号の一致性には影響しない）。 */
  caseKey: string;
  /** 内容そのもの。ここが1文字でも変われば別の番号になる */
  content: unknown;
  /* 2026-09-16 EHC-0039 v2 §3 修正1b:
     案件の指紋。caseFingerprintOf() で作る（連絡先メール＋設備群だけ）。
     これは指紋（diagnosisFingerprint）には一切入らない。
     入れると、この欄を足しただけで既存の番号が全部変わり、
     app/api/diagnosis-submit/route.ts の内容照合が総崩れになる。
     使い道は1つだけで、kind:"diagnosis" が確定したときに
     「この案件の受付番号はこれ」という札を立てること。
     旧・提案書（kind:"proposal"）はその札を読んで受付番号を併記する。
     省略してよい。省略した場合は札を立てない／読まないだけで、
     番号の発行と一致性の動きは従来と同じ。 */
  caseFingerprint?: string;
}

export interface DiagnosisIdRecord {
  /** EHC-YYYYMMDD-HHMMSS-XXXX。画面・PDF・顧客メール・社内メールで共通 */
  id: string;
  /** 内容の指紋。サーバ側の内容照合（修正4）で使う */
  fingerprint: string;
  /* 同じ caseKey・同じ kind で何番目の内容か（1始まり）。
     内容を直して確定し直すと 2, 3 … と増える。
     番号そのものを上書きしないので、旧内容の書類と識別できる。 */
  contentVersion: number;
  /** 発行時刻（JST表記）。台帳の読み物用で、判定には使わない */
  issuedAtJst: string;
}

/* ───────── 指紋 ─────────
   要件は2つだけ。
     ・同じ内容なら必ず同じ文字列になる（キーの順序・±0・undefined に左右されない）
     ・違う内容なら実用上ぶつからない

   crypto.subtle.digest を使わない理由: 非同期になるため、
   レンダー中（useMemo）とサーバの同期処理の両方から呼べなくなる。
   ここは改ざん対策ではなく取り違え対策なので、同期の非暗号ハッシュでよい。
   32bitを2本（別の初期値）取って16進16桁にする。 */

function canonical(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undef";
  const t = typeof v;
  if (t === "number") {
    const n = v as number;
    if (Number.isNaN(n)) return "nan";
    if (!Number.isFinite(n)) return n > 0 ? "inf" : "-inf";
    /* -0 と 0 を同じにする。JSON.stringify(-0) は "0" だが、
       ここは自前で組むので明示しておく。 */
    return String(n === 0 ? 0 : n);
  }
  if (t === "boolean") return n2s(v as boolean);
  if (t === "string") return JSON.stringify(v);
  if (v instanceof Date) return `D${v.toISOString()}`;
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (t === "object") {
    const o = v as Record<string, unknown>;
    /* キーを並べ替える。オブジェクトの書き順が違うだけで
       別番号になるのを防ぐ。値が undefined のキーは落とす
       （JSONに載らない＝送信側でも消えるため）。 */
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  /* function / symbol / bigint。内容として渡されることを想定していない。
     黙って無視すると「違う内容が同じ指紋」になるので、型名を残す。 */
  return `<${t}>`;
}

function n2s(b: boolean): string {
  return b ? "true" : "false";
}

function fnv1a(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

/** 内容の指紋。同じ内容なら同じ文字列。長さは常に16進16桁＋種別。 */
export function diagnosisFingerprint(input: DiagnosisIdInput): string {
  const text = `${input.kind}\u0000${canonical(input.content)}`;
  return `${input.kind}:${hex8(fnv1a(text, 0x811c9dc5))}${hex8(fnv1a(text, 0x7fb9d2c1))}`;
}

/* ───────── 台帳 ─────────
   ブラウザのタブ（またはサーバのプロセス）が生きている間だけ持つ。
   永続化していないので、リロード後に同じ内容を確定し直すと
   新しい番号になる。これは「同じ内容なら常に同じ番号」ではないが、
   すでに発行した番号を書き換えることは無いので、
   出したPDFと後の書類が食い違うことは起きない。
   恒久的な採番の一意化は記録先（Notion/DB）を決めてから。
   決めるまではこの但し書きを消さないこと。 */
const registry = new Map<string, DiagnosisIdRecord>();
/** caseKey+kind ごとの発行数。改訂番号（contentVersion）に使う */
const caseCounter = new Map<string, number>();

function caseBucket(input: DiagnosisIdInput): string {
  return `${input.kind}\u0000${input.caseKey}`;
}

function nowJst(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

/**
 * 内容に対応する番号を返す。無ければ発行して台帳に載せる。
 *
 * 呼んでよい場所: 内容を確定した時点（送信ボタン／印刷用ビューの組み立て）。
 * 呼んではいけない場所: 入力途中のレンダー。
 *   入力1文字ごとに指紋が変わるため、番号が増え続ける。
 *   入力中の画面は peekDiagnosisId() を使い、未発行なら「送信時に発行します」と書く。
 */
export function resolveDiagnosisId(
  input: DiagnosisIdInput,
  now: Date = new Date()
): DiagnosisIdRecord {
  const fingerprint = diagnosisFingerprint(input);
  const hit = registry.get(fingerprint);
  if (hit) {
    /* 再表示・再試行でここへ戻ってきたときも札は立て直す。
       新しい番号は出さない（hit をそのまま返す）。 */
    markCaseReceipt(input, hit);
    return hit;
  }

  const bucket = caseBucket(input);
  const contentVersion = (caseCounter.get(bucket) ?? 0) + 1;
  caseCounter.set(bucket, contentVersion);

  const record: DiagnosisIdRecord = {
    id: issueDocumentNumber(now),
    fingerprint,
    contentVersion,
    issuedAtJst: nowJst(now),
  };
  registry.set(fingerprint, record);
  markCaseReceipt(input, record);
  return record;
}

/** 発行せずに見るだけ。未発行なら null。入力中の画面から使う。 */
export function peekDiagnosisId(input: DiagnosisIdInput): DiagnosisIdRecord | null {
  return registry.get(diagnosisFingerprint(input)) ?? null;
}

/** 番号から台帳を引く。同じ番号に別の内容が来ていないかの確認に使う。 */
export function findDiagnosisIdById(id: string): DiagnosisIdRecord | null {
  for (const r of registry.values()) if (r.id === id) return r;
  return null;
}

/* ───────── 案件の受付番号（ID・版の受け渡し） ─────────
   2026-09-16 EHC-0039 v2 §3 修正1b

   ■ 直している事故
   　　同じ相談で2枚の紙が出る。
   　　　・旧・提案書（CustomerReport） … 紙に「診断書番号 EHC-…」と刷る
   　　　・新・診断書（ContactStage）　 … 画面とPDFとメールに「受付番号 EHC-…」と出す
   　　どちらも「この番号をお伝えください」と書いてあるのに、番号が違う。
   　　お客様がどちらを言うかで、こちらの引き当て先が変わる。

   ■ 決めたこと（どちらを正にするかの決着）
   　　照会の正は **受付番号（kind:"diagnosis"）** 1本。
   　　理由は、受付番号だけがサーバまで届いているから。
   　　　app/api/diagnosis-submit/route.ts が形式を検査し（EHC-YYYYMMDD-HHMMSS-XXXX）、
   　　　lib/submitLedger.ts がこの番号を鍵に送信状態と排他を持っている。
   　　提案書の番号はブラウザの外へ一度も出ない。紙の管理番号でしかない。
   　　だから提案書は自分の番号を捨てず（別内容の帳票なので別IDでよい）、
   　　同じ案件の受付番号が発行済みなら、それを併記して照会先を1つに寄せる。

   ■ 番号を1本に統合しない理由
   　　旧・提案書と新・診断書は中身の違う書類である（載っている表も結論も違う）。
   　　同じ番号を貼ると、番号で照会したときにどちらの内容か決まらない。
   　　「別内容の帳票は別IDでよい。同じ診断内容を共有する場合のID・版の受け渡しを
   　　　実出力で確認する」という指示（v2 §3）は、統合ではなく受け渡しを求めている。

   ■ 案件の鍵に何を入れるか
   　　連絡先メールと設備群だけ。両方の画面が同じ形で持っている材料はこれだけで、
   　　しかもこれが違えば別の案件だと言い切れる。
   　　入れないもの:
   　　　・書類の種類 … 入れたら種類ごとに札が分かれて受け渡しにならない
   　　　・金額・制度・補助額 … 提案書だけが持つ。診断書側と一致しようがない
   　　　・会社名・担当者名・電話 … 表記ゆれ（(株)／株式会社、ハイフン有無）で
   　　　　同じ案件が別案件になる。メールが空の相談は札を立てない（null を返す）。

   ■ この札が保証しないこと
   　　registry と同じくタブのメモリなので、リロードで消える。
   　　消えたときは併記が出なくなるだけで、番号そのものは動かない
   　　（すでに刷った紙の番号は registry にも案件札にも依存しない）。
   　　恒久化は記録先（Notion/DB）を決めてから。決めるまでこの但し書きを消さないこと。 */

export interface CaseKeySource {
  /** 連絡先メール。空・null なら案件を特定しない（札を立てない） */
  email: string | null | undefined;
  equipGroups: Array<{
    equip: string;
    /* 受け取るが指紋には使わない。理由は caseFingerprintOf の但し書きを読むこと。
       呼ぶ側は MatchInput["equipGroups"] をそのまま渡せるように型に残してある。 */
    refri?: string;
    installYear: number;
    units: number;
    hp?: number | null;
  }>;
}

/**
 * 案件の指紋。どの帳票からでも同じに作れる最小の材料だけで作る。
 * メールが無い（空）ときは null。案件を特定できないのに札を立てると、
 * 別のお客様の受付番号を提案書に刷ってしまう。
 *
 * ■ 冷媒（refri）を材料に入れない理由（2026-09-17 v50 の実測で確定）
 * 　　5段診断の設備入力（B段）は冷媒を聞いていない。
 * 　　lib/diagnosisProjection.ts は聞いていない冷媒を推定せず、
 * 　　必ず "unknown" を立てる（同ファイルの但し書きのとおり、
 * 　　設置年から r22 / r410a を推定すると根拠のない世代差が削減率に乗るため）。
 * 　　一方、提案書側が読む MatchInput は詳細フォームの冷媒（例 "r410a"）を持つ。
 * 　　v50 の実測では、同じメール・同じ種別・同じ設置年・同じ台数・同じ馬力で、
 * 　　冷媒だけが r410a / unknown と割れた。
 * 　　　提案書側 : ["ac","r410a",2014,5,hp なし]
 * 　　　診断書側 : ["ac","unknown",2014,5,hp なし]
 * 　　refri を材料に残す限り、この2画面の指紋は原理的に一致しない。
 * 　　冷媒の申告は「どの案件か」を変えるものではない（同じお客様の同じ設備である）。
 *
 * 　　なお「内容が変わったら別の番号」を担保しているのは diagnosisFingerprint() で、
 * 　　そちらは refri を含む診断内容そのものを見ている。ここを緩めても
 * 　　番号の一意性・改訂の識別は変わらない。この指紋は
 * 　　「どの提案書と結び付けるか」を決めるためだけの鍵である。
 */
export function caseFingerprintOf(src: CaseKeySource): string | null {
  const email = (src.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const groups = src.equipGroups
    .map((g) => ({
      equip: g.equip,
      installYear: g.installYear,
      units: g.units,
      hp: g.hp == null ? null : g.hp,
    }))
    .sort((a, b) =>
      canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0
    );
  const text = `case\u0000${email}\u0000${canonical(groups)}`;
  return `case:${hex8(fnv1a(text, 0x811c9dc5))}${hex8(fnv1a(text, 0x7fb9d2c1))}`;
}

/* 案件指紋 → 直近に確定した診断書の record。
   上書きする（＝最新の確定を指す）。過去の番号は registry に残って消えないので、
   すでに出したPDFと食い違うことは起きない。版は contentVersion で見分ける。 */
const caseReceipts = new Map<string, DiagnosisIdRecord>();
const listeners = new Set<() => void>();

function markCaseReceipt(input: DiagnosisIdInput, record: DiagnosisIdRecord): void {
  /* 札を立てるのは診断書だけ。提案書は読む側であって、立てる側ではない。 */
  if (input.kind !== "diagnosis") return;
  const fp = input.caseFingerprint;
  if (!fp) return;
  const before = caseReceipts.get(fp);
  if (before && before.id === record.id) return;
  caseReceipts.set(fp, record);
  listeners.forEach((fn) => fn());
}

/** 案件の受付番号を読む。未発行・案件不明なら null。ここでは発行しない。 */
export function findCaseReceipt(caseFingerprint: string | null): DiagnosisIdRecord | null {
  if (!caseFingerprint) return null;
  return caseReceipts.get(caseFingerprint) ?? null;
}

/* useSyncExternalStore 用。
   提案書は診断書より先に描かれていることが多い（マッチング → 提案書 → 診断）。
   受け渡しを「描くときに1回読む」だけにすると、あとから受付番号が出ても
   提案書は古いまま残る。購読して、札が立った時点で描き直す。 */
export function subscribeDiagnosisId(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * 案件の受付番号の要約を1本の文字列で返す（未発行・案件不明なら null）。
 * useSyncExternalStore の getSnapshot は、同じ状態なら同じ値を返さなければならない
 * （オブジェクトを新しく作って返すと毎回別物になり、描き直しが止まらない）。
 * 文字列は値で比べられるのでそのまま使える。読み解きは parseCaseReceipt()。
 */
export function caseReceiptSnapshot(caseFingerprint: string | null): string | null {
  const r = findCaseReceipt(caseFingerprint);
  return r ? `${r.id}\u0000${r.contentVersion}\u0000${r.issuedAtJst}` : null;
}

export interface CaseReceiptView {
  id: string;
  contentVersion: number;
  issuedAtJst: string;
}

/** caseReceiptSnapshot() の文字列を読み解く。 */
export function parseCaseReceipt(snapshot: string | null): CaseReceiptView | null {
  if (!snapshot) return null;
  const [id, version, issuedAtJst] = snapshot.split("\u0000");
  if (!id) return null;
  const n = Number(version);
  return {
    id,
    contentVersion: Number.isFinite(n) && n > 0 ? n : 1,
    issuedAtJst: issuedAtJst ?? "",
  };
}

/** 試験用。本番経路から呼ばない（呼ぶと発行済みの番号が引けなくなる）。 */
export function resetDiagnosisIdRegistry(): void {
  registry.clear();
  caseCounter.clear();
  caseReceipts.clear();
  listeners.forEach((fn) => fn());
}

/** 試験用。発行済み件数。 */
export function diagnosisIdRegistrySize(): number {
  return registry.size;
}

/* ───────── 指紋に入れる内容の定義 ─────────
   ここを画面側とサーバ側で別々に書くと、同じ診断なのに指紋が違う、
   という形で「内容不一致」が誤検知される。定義はこの1関数だけに置く。

   入れるもの: 書類の中身を決める入力（連絡先・設備群・予算・希望時期）。
   入れないもの:
     ・受付日時 … 送信のたびに変わる。変えたくないのは番号の方なので入れない。
     ・番号そのもの … 指紋から番号を作るので循環する。
     ・画面の表示状態（開いている段、スクロール位置）… 書類の中身ではない。
     ・金額 … 設備群から計算で出る。入れると、計算式を直した日に
       　　　　同じ入力の指紋が変わってしまう（番号は入力に紐づけたい）。
       　　　　金額の一致はサーバの再計算で別に確かめる（修正4）。 */

export interface DiagnosisContentForId {
  contact: { name: string; email: string; company: string | null; phone: string | null };
  /** 計算に渡した群。id は入れない（並べ替えで指紋が変わるのを避ける） */
  equipGroups: Array<{
    equip: string;
    refri: string;
    installYear: number;
    units: number;
    hp: number | null;
  }>;
  /** 未算定の群。件名と理由まで一致して初めて同じ内容とみなす */
  unpriced: Array<{ label: string; reason: string }>;
  customerBudgetYen: number | null;
  desiredTiming: string | null;
}

/**
 * 診断内容から、指紋を取る対象を組み立てる。
 * 設備群は並び順で指紋が変わらないように整列する
 * （画面で群を入れ替えただけで別番号になるのを避ける）。
 */
export function diagnosisContentForId(src: {
  contact: { name: string; email: string; company: string | null; phone: string | null };
  equipGroups: Array<{
    equip: string;
    refri: string;
    installYear: number;
    units: number;
    hp?: number | null;
  }>;
  unpriced: Array<{ label: string; reason: string }>;
  customerBudgetYen: number | null;
  desiredTiming: string | null;
}): DiagnosisContentForId {
  const groups = src.equipGroups
    .map((g) => ({
      equip: g.equip,
      refri: g.refri,
      installYear: g.installYear,
      units: g.units,
      hp: g.hp == null ? null : g.hp,
    }))
    .sort((a, b) =>
      canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0
    );
  const unpriced = [...src.unpriced]
    .map((u) => ({ label: u.label, reason: u.reason }))
    .sort((a, b) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0));
  return {
    contact: {
      name: src.contact.name,
      email: src.contact.email,
      company: src.contact.company,
      phone: src.contact.phone,
    },
    equipGroups: groups,
    unpriced,
    customerBudgetYen: src.customerBudgetYen,
    desiredTiming: src.desiredTiming,
  };
}

/* ───────── 金額の要約（修正4の明細照合用） ─────────
   合計だけを比べると「合計は同じで明細が違う」書類を取り違える。
   機器費・工事費・税・台数・系統数・回収kg・明細行まで含めた
   短い文字列にして、画面側とサーバ側で突き合わせる。

   これは「PDFの中身を検証した」ことにはならない。
   PDFは画面側で画像化したもので、こちらは同じ入力から作った
   数値の要約でしかない。PDFを受け取っただけで内容が一致したとは扱わない。 */
export interface EstimateDigestSource {
  machine: number;
  work: number;
  subtotal: number;
  tax: number;
  total: number;
  lowTotal: number;
  highTotal: number;
  units: number;
  systems: number;
  kg: number;
  lines: Array<{ label: string; detail: string; amount: number }>;
}

export function estimateDigest(e: EstimateDigestSource | null): string {
  if (!e) return "none";
  const text = canonical({
    machine: e.machine,
    work: e.work,
    subtotal: e.subtotal,
    tax: e.tax,
    total: e.total,
    lowTotal: e.lowTotal,
    highTotal: e.highTotal,
    units: e.units,
    systems: e.systems,
    kg: e.kg,
    lines: e.lines.map((l) => ({ label: l.label, detail: l.detail, amount: l.amount })),
  });
  return `${hex8(fnv1a(text, 0x811c9dc5))}${hex8(fnv1a(text, 0x7fb9d2c1))}`;
}
