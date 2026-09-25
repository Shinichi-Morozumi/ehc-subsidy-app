/* ───────────────────────────────────────────────────────────
   送信台帳（EHC-0039 修正3 / 2026-09-15 v1）

   ■ 直している事故
   　　app/api/diagnosis-submit/route.ts は「受付番号 → 前回の結果」を
   　　1つの Map に入れ、成功・失敗を区別せず保存していた。
   　　そのため顧客宛だけ落ちたあと、同じ番号でもう一度送っても
   　　保存済みの結果をそのまま返すだけで、失敗した宛先を送り直さない。
   　　画面には「送信に失敗しました」と出るのに、再試行する手段が無い。

   ■ 決めたこと
   　　状態は「診断ID × 内容 × 宛先」ごとに持つ。
   　　　・送信済みの宛先は二度送らない
   　　　・失敗した宛先だけ送り直せる
   　　　・同じIDで内容が変わっていたら、古い受付結果を返さない
   　　　・宛先が変わったら、その宛先は未送信として扱う

   ■ 結果不明（unknown）を作った理由
   　　SMTPは「受け付けた」応答を返す前に接続が切れることがある。
   　　このとき届いたかどうかは送信側では分からない。
   　　　failed とみなして再送すれば、相手には2通届く
   　　　sent とみなせば、届いていない相談を受付済みにする
   　　どちらも嘘なので、第3の状態として残す。
   　　unknown の宛先は自動で送り直さない（人が確認して判断する）。
   　　「必ず一度だけ送信する」とは書かない。保証できていないため。

   ■ 保存先
   　　既定はプロセス内のメモリ。サーバレスでは実行環境が変われば消え、
   　　複数インスタンスの間でも共有されない。
   　　つまりこの既定の構成では「プロセスをまたぐ再試行」は成立しない。
   　　成立させるには setSubmitLedgerStore() で共有の保存先を差し込む。
   　　差し込まれているかは describeLedger().persistence で確認でき、
   　　APIはその値をそのまま応答に載せる（できていないことを黙らない）。
   ─────────────────────────────────────────────────────────── */

export type SubmitChannel = "customer" | "staff";

export type ChannelState =
  /** まだ試していない */
  | "not_attempted"
  /** 送信した（SMTPが受け付けた） */
  | "sent"
  /** 送信しようとして失敗した。再試行の対象 */
  | "failed"
  /** 応答が取れず、届いたか不明。自動では再試行しない */
  | "unknown"
  /** 実送信しない環境（DIAGNOSIS_MAIL_MODE が send 以外）。届いていない */
  | "dry_run"
  /** SMTPの設定が無く送れない。再試行の対象（設定後に送れる） */
  | "not_configured"
  /** 送る条件を満たしていないので送らなかった（内容不一致で止めた等） */
  | "skipped";

export interface ChannelRecord {
  channel: SubmitChannel;
  /** 宛先（to をカンマで結合した文字列）。ここが変われば別の宛先として扱う */
  target: string;
  state: ChannelState;
  attempts: number;
  lastError: string | null;
  lastAt: number;
}

export interface SubmitEntry {
  diagnosisId: string;
  /** 内容の指紋（lib/diagnosisId.ts）。同じIDで内容が変わったかを見る */
  contentFingerprint: string;
  /** 明細の要約。合計だけ同じで明細が違う場合を拾う */
  estimateDigest: string;
  /** "customer\u0000宛先" をキーにした宛先ごとの状態 */
  channels: Record<string, ChannelRecord>;
  createdAt: number;
  updatedAt: number;
  /** 直前に返した応答。重複要求へそのまま返すために持つ */
  lastPayload: unknown;
}

/* ───────── 保存先 ─────────
   同期のMapではなく非同期のインターフェースにしているのは、
   あとで Notion / DB へ差し替えたときに呼び出し側を書き換えないため。 */
export interface SubmitLedgerStore {
  get(diagnosisId: string): Promise<SubmitEntry | null>;
  put(entry: SubmitEntry): Promise<void>;
  /** 共有の保存先か。false の間は「プロセスをまたぐ再試行はできない」 */
  readonly shared: boolean;
  readonly name: string;
}

const memory = new Map<string, SubmitEntry>();
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;

const memoryStore: SubmitLedgerStore = {
  shared: false,
  name: "process_memory",
  async get(diagnosisId) {
    const hit = memory.get(diagnosisId);
    if (!hit) return null;
    if (Date.now() - hit.updatedAt > MEMORY_TTL_MS) {
      memory.delete(diagnosisId);
      return null;
    }
    /* 複製を返す。呼び出し側が書き換えた途中の状態が、
       put する前に他の要求へ見えてしまうのを防ぐ。 */
    return cloneEntry(hit);
  },
  async put(entry) {
    const now = Date.now();
    for (const [k, v] of memory) {
      if (now - v.updatedAt > MEMORY_TTL_MS) memory.delete(k);
    }
    memory.set(entry.diagnosisId, cloneEntry(entry));
  },
};

let store: SubmitLedgerStore = memoryStore;

/** 共有の保存先を差し込む。運用環境で複数インスタンスになる場合は必須。 */
export function setSubmitLedgerStore(next: SubmitLedgerStore): void {
  store = next;
}

/** 試験用。既定のメモリ保存先へ戻し、中身を空にする。 */
export function resetSubmitLedger(): void {
  store = memoryStore;
  memory.clear();
  locks.clear();
}

export function describeLedger(): {
  persistence: string;
  shared: boolean;
  /** プロセスをまたぐ再試行が成立するか */
  crossProcessRetry: boolean;
} {
  return { persistence: store.name, shared: store.shared, crossProcessRetry: store.shared };
}

function cloneEntry(e: SubmitEntry): SubmitEntry {
  return {
    ...e,
    channels: Object.fromEntries(Object.entries(e.channels).map(([k, v]) => [k, { ...v }])),
  };
}

/* ───────── 排他 ─────────
   同じ診断IDへの要求を直列にする。これが無いと、2つの同時要求が
   どちらも「未送信」を読んでから両方送り、同じ宛先へ2通出る。

   ⚠ これはプロセス内の直列化でしかない。複数インスタンスで動く環境では
      共有の排他（DBの行ロック等）が別に必要で、それは store 側の仕事になる。
      できていないことを describeLedger().crossProcessRetry で表に出す。 */
const locks = new Map<string, Promise<unknown>>();

export async function withSubmitLock<T>(diagnosisId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(diagnosisId) ?? Promise.resolve();
  /* 前の処理が失敗しても鎖を切らない（catch で受けて次へ進む）。
     ここで throw を伝播させると、1件の失敗で以降の要求が全部落ちる。 */
  const run = prev.then(fn, fn);
  /* 鎖に繋ぐのは「終わったこと」だけ。結果と失敗は呼び出し側へ返し、
     鎖には成否を伝えない（次の要求が前の失敗で落ちないようにする）。 */
  const settled = run.then(
    () => undefined,
    () => undefined
  );
  locks.set(diagnosisId, settled);
  try {
    return await run;
  } finally {
    /* 自分が鎖の末尾のままなら、鍵を片付ける。
       後続の要求が既に差し替えている場合は触らない（その要求の待ち先を壊す）。 */
    if (locks.get(diagnosisId) === settled) locks.delete(diagnosisId);
  }
}

export function channelKey(channel: SubmitChannel, target: string): string {
  return `${channel}\u0000${target}`;
}

export async function loadEntry(diagnosisId: string): Promise<SubmitEntry | null> {
  return store.get(diagnosisId);
}

export async function saveEntry(entry: SubmitEntry): Promise<void> {
  entry.updatedAt = Date.now();
  await store.put(entry);
}

export function newEntry(src: {
  diagnosisId: string;
  contentFingerprint: string;
  estimateDigest: string;
}): SubmitEntry {
  const now = Date.now();
  return {
    diagnosisId: src.diagnosisId,
    contentFingerprint: src.contentFingerprint,
    estimateDigest: src.estimateDigest,
    channels: {},
    createdAt: now,
    updatedAt: now,
    lastPayload: null,
  };
}

export function channelRecord(
  entry: SubmitEntry,
  channel: SubmitChannel,
  target: string
): ChannelRecord {
  const key = channelKey(channel, target);
  const hit = entry.channels[key];
  if (hit) return hit;
  const fresh: ChannelRecord = {
    channel,
    target,
    state: "not_attempted",
    attempts: 0,
    lastError: null,
    lastAt: 0,
  };
  entry.channels[key] = fresh;
  return fresh;
}

export function markChannel(
  entry: SubmitEntry,
  channel: SubmitChannel,
  target: string,
  state: ChannelState,
  error: string | null = null
): void {
  const rec = channelRecord(entry, channel, target);
  rec.state = state;
  rec.lastError = error;
  rec.lastAt = Date.now();
  if (state !== "not_attempted" && state !== "skipped") rec.attempts += 1;
}

/**
 * この宛先へ今回送るべきか。
 *
 *   sent           … 送らない。成功した宛先を重複送信しない
 *   unknown        … 送らない。届いたか不明な宛先を機械的に再送しない
 *                    （2通届く可能性を作らない。人が確認して判断する）
 *   failed
 *   not_configured
 *   not_attempted
 *   dry_run
 *   skipped        … 送る。前回届いていないので再試行の対象
 */
export function shouldSend(rec: ChannelRecord): boolean {
  return rec.state !== "sent" && rec.state !== "unknown";
}

/** 同じIDで内容が入れ替わっていないか。入れ替わっていれば古い結果を返さない。 */
export function contentMatchesEntry(
  entry: SubmitEntry,
  contentFingerprint: string,
  estimateDigest: string
): boolean {
  return (
    entry.contentFingerprint === contentFingerprint && entry.estimateDigest === estimateDigest
  );
}

/** 全宛先が「届いた」か。dry_run は届いていないので含めない。 */
export function allDelivered(entry: SubmitEntry, targets: Array<{ channel: SubmitChannel; target: string }>): boolean {
  return targets.every((t) => channelRecord(entry, t.channel, t.target).state === "sent");
}
