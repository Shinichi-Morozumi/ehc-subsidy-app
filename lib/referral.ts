/* ───────────────────────────────────────────────────────────
   紹介リンク（アフィリエイトと同じ考え方）2026-10-14 PJ-20261013-EHC-0070

   ■ なぜ
   　　紹介代理店に配る専用のチラシ（介護・ドロップイン・クリニック）の QR／リンクには ?ref= が付いている。
   　　お客様に紹介コードを入力させず、URL だけで「どの代理店の・どのチラシから来たか」を、
   　　受付番号 → 担当者宛メール → Notion の同じ行まで運ぶ。

   ■ 決め事
   　　・どのコードがどの紹介元・資料かは、この表（サーバ側）で決める。画面から来た文字列は信用しない。
   　　　表に無いコードは「未登録の紹介コード」として残すだけで、紹介元には割り当てない（誤った帰属をしない）。
   　　・端末には30日だけ覚える（最後に開いた有効な紹介リンクを優先）。端末に保存できなくても、同じタブの中では運ぶ。
   　　・相談を送った時点の紹介リンクを、その受付番号に固定する（あとで別のリンクを開いても、送った案件は変えない）。
   　　・お客様の画面には紹介コードを出さない。担当者宛メールと Notion にだけ残す。
   　　・紹介料の率・契約相手の名前はここに書かない（契約書と社内の管理記録が正）。
   ─────────────────────────────────────────────────────────── */

export type ReferralMaterial = "care" | "dropin" | "clinic";

export const REFERRAL_MATERIAL_JA: Record<ReferralMaterial, string> = {
  care: "介護施設向け補助金のチラシ",
  dropin: "ドロップイン導入のチラシ",
  clinic: "クリニック・歯科医院のチラシ",
};

export const REFERRAL_MATERIAL_SHORT: Record<ReferralMaterial, string> = {
  care: "介護",
  dropin: "ドロップイン",
  clinic: "クリニック",
};

export interface ReferralLink {
  partnerId: string;
  material: ReferralMaterial;
  /** 配っている URL（QR とチラシのリンクと同じ） */
  entryUrl: string;
}

/** 有効な紹介リンクの表。QR の URL と完全に一致させる（EHC-0071 v2 / EHC-0074 v3） */
export const REFERRAL_LINKS: Readonly<Record<string, ReferralLink>> = {
  "krh01-care": { partnerId: "KRH01", material: "care", entryUrl: "https://ehcjpn.com/kaigo?ref=krh01-care" },
  "krh01-dropin": { partnerId: "KRH01", material: "dropin", entryUrl: "https://ehcjpn.com/?ref=krh01-dropin" },
  "krh01-clinic": { partnerId: "KRH01", material: "clinic", entryUrl: "https://ehcjpn.com/?ref=krh01-clinic" },
};

export const REFERRAL_DAYS = 30;
const DAY_MS = 86400000;
/** 着いたページとして受け付けるパス（それ以外は "/" として扱う） */
const LANDINGS = ["/", "/kaigo"] as const;
export type ReferralLanding = (typeof LANDINGS)[number];

/** URL の ?ref= の値を整える。英数字・ハイフン・下線の20字まで、小文字にそろえる。使えない値は null（紹介なし）。 */
export function sanitizeRef(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,20}$/.test(v) ? v : null;
}

export function referralLinkOf(ref: string | null | undefined): ReferralLink | null {
  if (!ref) return null;
  return Object.prototype.hasOwnProperty.call(REFERRAL_LINKS, ref) ? REFERRAL_LINKS[ref] : null;
}

/** 端末に覚えておく形（お名前などは入れない） */
export interface ReferralClaim {
  ref: string;
  /** 紹介リンクで着いた時刻（ISO 8601） */
  landedAt: string;
  landing: ReferralLanding;
}

export function landingOf(pathname: unknown): ReferralLanding {
  return typeof pathname === "string" && (LANDINGS as readonly string[]).includes(pathname) ? (pathname as ReferralLanding) : "/";
}

/** 30日以内で、時刻が未来すぎない（5分の時計ずれまで）ものだけを有効とする */
export function isFreshClaim(c: ReferralClaim | null | undefined, now: number = Date.now()): c is ReferralClaim {
  if (!c || !sanitizeRef(c.ref)) return false;
  const at = Date.parse(c.landedAt);
  if (!Number.isFinite(at)) return false;
  return at <= now + 5 * 60 * 1000 && now - at <= REFERRAL_DAYS * DAY_MS;
}

/** 送信に付いてきた紹介リンクを、サーバ側の表で確かめた結果 */
export interface ResolvedReferral {
  ref: string;
  /** 表にある（紹介元に割り当てた）コードか */
  known: boolean;
  partnerId: string | null;
  material: ReferralMaterial | null;
  entryUrl: string | null;
  landedAt: string | null;
  landing: ReferralLanding | null;
}

/** 送信の本文の referral（{ ref, landedAt, landing }）を確かめる。無い・壊れている・30日を過ぎたものは null（紹介なし）。 */
export function readReferralClaim(raw: unknown, now: number = Date.now()): ResolvedReferral | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ref = sanitizeRef(o.ref);
  if (!ref) return null;
  const landedAt = typeof o.landedAt === "string" ? o.landedAt.slice(0, 40) : "";
  const claim: ReferralClaim = { ref, landedAt, landing: landingOf(o.landing) };
  if (!isFreshClaim(claim, now)) return null;
  const link = referralLinkOf(ref);
  return {
    ref,
    known: !!link,
    partnerId: link?.partnerId ?? null,
    material: link?.material ?? null,
    entryUrl: link?.entryUrl ?? null,
    landedAt: new Date(Date.parse(landedAt)).toISOString(),
    landing: claim.landing,
  };
}

/** /kaigo の送信のように、コードだけが来たときの確かめ方（着いた時刻は分からない） */
export function resolveRefOnly(ref: string | null | undefined): ResolvedReferral | null {
  const r = sanitizeRef(ref);
  if (!r) return null;
  const link = referralLinkOf(r);
  return {
    ref: r,
    known: !!link,
    partnerId: link?.partnerId ?? null,
    material: link?.material ?? null,
    entryUrl: link?.entryUrl ?? null,
    landedAt: null,
    landing: null,
  };
}

function jstText(iso: string | null): string {
  if (!iso) return "不明";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "不明";
  const d = new Date(t + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}（日本時間）`;
}

/** 件名・次アクションに付ける短い印。紹介なしは "" */
export function referralTag(r: ResolvedReferral | null): string {
  if (!r) return "";
  if (!r.known || !r.partnerId || !r.material) return "未登録の紹介コード";
  return `紹介 ${r.partnerId}・${REFERRAL_MATERIAL_SHORT[r.material]}`;
}

/** 担当者宛メールと Notion のメモに書く行（社内向け。お客様には出さない） */
export function referralLines(r: ResolvedReferral | null, receiptNo?: string): string[] {
  if (!r) return ["紹介リンク: なし"];
  const where = `着いた日時: ${jstText(r.landedAt)}${r.landing ? `／着いたページ: ${r.landing}` : ""}${receiptNo ? `／受付番号: ${receiptNo}` : ""}`;
  if (!r.known || !r.partnerId || !r.material) {
    return [
      `紹介リンク: 未登録のコード（ref=${r.ref}）。紹介元には割り当てていません。必要なら紹介の台帳と照らしてください。`,
      where,
    ];
  }
  return [
    `紹介リンク: 紹介元 ${r.partnerId}／資料 ${REFERRAL_MATERIAL_JA[r.material]}（ref=${r.ref}）`,
    `流入した専用URL: ${r.entryUrl}`,
    where,
    "紹介料の対象・率は契約書と紹介の管理記録で確かめる（このメール・行では確定しない）。",
  ];
}
