/* v1 / 2026-10-29 / EHC-0102 直し2回目：相談フォームの任意の印と「ご相談の内容」（画面とサーバで同じ決まりを使う）
   10名のレビュー：「止まったので急ぎ」「施設・建物が複数」「電話は困る」を伝える方法が無い、への対応。必須の3項目は増やさない。 */

export const CONSULT_FLAGS = [
  { id: "urgent", label: "急ぎ（空調が止まった・壊れた）", mail: "急ぎ（空調が止まった・壊れた）" },
  { id: "multiSite", label: "施設・建物が複数ある", mail: "施設・建物が複数" },
  { id: "mailOnly", label: "連絡はメールを希望", mail: "連絡はメールを希望（電話は控える）" },
] as const;

export type ConsultFlagId = (typeof CONSULT_FLAGS)[number]["id"];

/** ご相談の内容の文字数の上限 */
export const CONSULT_NOTE_MAX = 600;

/* ブラッシュアップ4（2026-10-29）：法人の本部・ビル管理会社など、施設が複数あるときに一度でまとめて相談できる */
/** 施設の一覧（1行に1施設）の文字数の上限 */
export const CONSULT_SITES_MAX = 1500;
/** どのページからでも「施設が複数」の相談フォームを開く合図（トップのボタンなど） */
export const CONSULT_MULTI_EVENT = "ehc:consult-multi";

export function readConsultFlags(raw: unknown): ConsultFlagId[] {
  if (!Array.isArray(raw)) return [];
  const ok = new Set<string>(CONSULT_FLAGS.map((f) => f.id));
  return Array.from(new Set(raw.filter((v): v is ConsultFlagId => typeof v === "string" && ok.has(v))));
}

export function consultFlagLabels(flags: ConsultFlagId[]): string[] {
  return CONSULT_FLAGS.filter((f) => flags.includes(f.id)).map((f) => f.mail);
}
