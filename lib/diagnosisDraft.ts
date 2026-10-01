/* ───────────────────────────────────────────────────────────
   診断の途中保存（2026-09-26 改善4）

   ■ なぜ
   　　入力をどこにも保存していなかったので、室外機の銘板や電気料金の明細を撮りに
   　　カメラへ切り替えた拍子に画面が読み直されると、7問の答えも設備の入力も全部消えた
   　　（スマホのブラウザは、裏に回った画面をよく読み直す）。

   ■ 決めたこと
   　　・保存先はお使いの端末（ブラウザの localStorage）だけ。サーバには送らない。
   　　・保存するのは「7問の答え」と「5段の診断の入力（設備・適合チェック・電気料金の明細）」と「いまの段」。
   　　・お名前・メール・会社名・電話・住所など、連絡先の欄は保存しない（sanitizeAnswers で消す）。
   　　・14日たったら使わずに消す。相談を送ったら消す。「最初から答え直す」でも消す。
   　　・保存も読み込みも、失敗したら黙って何もしない（プライベートブラウズなどで使えない端末がある）。

   ■ 再開の流れ
   　　トップの「無料で今すぐ診断」を押したときに、保存した続きがあれば7問の画面で案内する（GuidedDiagnosis）。
   　　「続きから再開」を押すと DRAFT_RESTORE_EVENT を1回だけ飛ばし、受け手がそれぞれの状態を戻す。
   　　　・SubsidyMatcher … 7問の答えを入力に戻して判定し直す（共有リンク ?d= と同じ動き）
   　　　・GuidedDiagnosis … 7問を「回答済み」として表示する
   　　　・DiagnosisFlow   … 設備などの入力と、いまの段・到達した段を戻す
   　　　・app/page.tsx   … 診断の画面を開く
   ─────────────────────────────────────────────────────────── */

import type { MatchInput } from "./types";
import type { DiagnosisState } from "./diagnosisState";
import type { InvestSource } from "./amountBasis";

export const DRAFT_KEY = "ehc.diagnosis.draft.v1";
export const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const DRAFT_RESTORE_EVENT = "ehc:diagnosis-restore";

/** components/StageNav.tsx の DiagnosisStage と同じ値（lib から components を読まないため、ここにも持つ） */
export type DraftStage = "find" | "equip" | "result" | "estimate" | "docs";
const STAGES: readonly DraftStage[] = ["find", "equip", "result", "estimate", "docs"];

export interface DraftFlow {
  stage: DraftStage;
  reached: DraftStage[];
  state: DiagnosisState;
  investSource: InvestSource;
}

export interface DiagnosisDraft {
  v: 1;
  /** 最後に保存した時刻（ミリ秒） */
  savedAt: number;
  /** 7問の答え（連絡先の欄を消したもの）。null はまだ7問を終えていない */
  answers: Partial<MatchInput> | null;
  /** 5段の診断の入力。null はまだ何も入れていない */
  flow: DraftFlow | null;
}

/** 保存しない欄（連絡先・担当者名）。旧シミュレーターの入力に入っていることがある */
const PERSONAL_KEYS = [
  "customerCompany",
  "customerContact",
  "customerEmail",
  "customerPhone",
  "customerAddress",
  "ehcStaff",
] as const;

export function sanitizeAnswers(input: MatchInput): Partial<MatchInput> {
  const copy: Record<string, unknown> = { ...input };
  for (const key of PERSONAL_KEYS) delete copy[key];
  return copy as Partial<MatchInput>;
}

type StoreLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): StoreLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** 保存した入力が、いまの画面で読める形か。壊れていたら使わない（既定値で埋めて出さない）。 */
export function isValidFlow(flow: unknown): flow is DraftFlow {
  if (!isObject(flow)) return false;
  if (!STAGES.includes(flow.stage as DraftStage)) return false;
  if (!Array.isArray(flow.reached) || !flow.reached.every((s) => STAGES.includes(s as DraftStage))) return false;
  if (flow.investSource !== "estimate" && flow.investSource !== "answer") return false;
  const state = flow.state;
  if (!isObject(state)) return false;
  if (!Array.isArray(state.groups) || state.groups.length === 0) return false;
  if (!state.groups.every((g) => isObject(g) && typeof g.id === "string")) return false;
  if (!Array.isArray(state.plannedUnits)) return false;
  const bill = state.energyBill;
  if (!isObject(bill) || (bill.period !== "month" && bill.period !== "year")) return false;
  return true;
}

function parse(raw: string | null): DiagnosisDraft | null {
  if (!raw) return null;
  try {
    const d: unknown = JSON.parse(raw);
    if (!isObject(d) || d.v !== 1 || typeof d.savedAt !== "number") return null;
    const answers = isObject(d.answers) ? (d.answers as Partial<MatchInput>) : null;
    const flow = isValidFlow(d.flow) ? d.flow : null;
    return { v: 1, savedAt: d.savedAt, answers, flow };
  } catch {
    return null;
  }
}

/** 再開に使える保存があれば返す。7問を終えていない保存・14日を過ぎた保存は返さない（古いものは消す）。 */
export function readDraft(now: number = Date.now(), store: StoreLike | null = defaultStore()): DiagnosisDraft | null {
  if (!store) return null;
  try {
    const d = parse(store.getItem(DRAFT_KEY));
    if (!d) return null;
    if (now - d.savedAt > DRAFT_TTL_MS || d.savedAt - now > 60 * 60 * 1000) {
      store.removeItem(DRAFT_KEY);
      return null;
    }
    return d.answers ? d : null;
  } catch {
    return null;
  }
}

/** 一部だけ書き換えて保存する（7問の答えと5段の入力は、別々の画面が書く）。 */
export function writeDraft(
  patch: Partial<Pick<DiagnosisDraft, "answers" | "flow">>,
  now: number = Date.now(),
  store: StoreLike | null = defaultStore()
): void {
  if (!store) return;
  try {
    const cur = parse(store.getItem(DRAFT_KEY)) ?? { v: 1 as const, savedAt: now, answers: null, flow: null };
    const next: DiagnosisDraft = { ...cur, ...patch, v: 1, savedAt: now };
    store.setItem(DRAFT_KEY, JSON.stringify(next));
  } catch {
    /* 容量不足・使えない端末では保存しない */
  }
}

export function clearDraft(store: StoreLike | null = defaultStore()): void {
  if (!store) return;
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    /* 何もしない */
  }
}

/** 7問の画面の案内に出す、保存の中身の短い説明 */
export function describeDraft(d: DiagnosisDraft, stageLabel: (s: DraftStage) => string): string {
  const parts = ["7問の答え"];
  const groups = d.flow?.state.groups ?? [];
  const started = groups.filter((g) => g.kind !== null || g.units !== null || g.installYear !== null || g.hp !== null);
  if (started.length > 0) parts.push(`設備 ${started.length}種類`);
  if (d.flow?.state.energyBill && (d.flow.state.energyBill.kwh != null || d.flow.state.energyBill.yen != null)) {
    parts.push("電気料金の明細");
  }
  const at = d.flow && d.flow.stage !== "find" ? `（「${stageLabel(d.flow.stage)}」まで）` : "";
  return `${parts.join("・")}${at}`;
}

/** 「9月26日 10:30」の形（日本時間） */
export function formatSavedAtJst(ms: number): string {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${hh}:${mm}`;
}
