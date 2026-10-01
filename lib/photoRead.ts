/* ───────────────────────────────────────────────────────────
   写真から入力を読み取る（2026-09-26 改善11）

   ■ 何をするか
   　　お客様がスマホで撮った写真から、入力欄の値を読み取って入れる。
   　　　・電気料金の明細（電気ご使用量のお知らせ・請求書）… 期間・使用量（kWh）・請求額（円）
   　　　・室外機・室内機の銘板 … メーカー・型式・製造年・馬力
   　　読み取りは Anthropic 社の AI（Claude）に任せる（app/api/read-photo/route.ts）。
   　　ここには、頼み方（指示文）と、返ってきた答えの確かめ方だけを置く。画面とサーバの両方が使う。

   ■ 守ること
   　　・読めない値は推測させない（null のまま返させる）。こちらでも範囲外の値は捨てる。
   　　・読み取った値は「入力の手伝い」であって確定値ではない。画面では必ず「明細・銘板と見比べて」と添える。
   　　・画像はどこにも保存しない（サーバのログにも残さない）。
   　　・馬力は、銘板に馬力が書かれていなくても冷房能力（kW）が読めれば、業務用エアコンの
   　　　標準の能力区分（例：11.2kW＝4馬力）に当てはまるときだけ換算する。当てはまらなければ空欄。
   ─────────────────────────────────────────────────────────── */

export type PhotoKind = "bill" | "nameplate";
export type PhotoConfidence = "high" | "medium" | "low";

export interface BillReading {
  period: "month" | "year" | null;
  kwh: number | null;
  yen: number | null;
}

export interface NameplateReading {
  maker: string | null;
  modelOutdoor: string | null;
  modelIndoor: string | null;
  year: number | null;
  hp: number | null;
  /** 馬力を冷房能力から換算したとき、その能力（kW）。換算していなければ null */
  hpFromCapacityKw: number | null;
}

export type PhotoReading = BillReading | NameplateReading;

export interface PhotoReadOk<R extends PhotoReading = PhotoReading> {
  ok: true;
  kind: PhotoKind;
  reading: R;
  confidence: PhotoConfidence;
  note: string | null;
}
export interface PhotoReadNg {
  ok: false;
  error: string;
}
export type PhotoReadResponse<R extends PhotoReading = PhotoReading> = PhotoReadOk<R> | PhotoReadNg;

/** 画面で縮めてから送る。長い辺の最大ピクセル */
export const PHOTO_MAX_EDGE = 1600;
/** サーバが受け付ける画像の大きさ（data URL の文字数）。Vercel の関数の上限（約4.5MB）の内側 */
export const PHOTO_MAX_DATA_URL_CHARS = 4_000_000;

export function promptFor(kind: PhotoKind): string {
  if (kind === "bill") {
    return [
      "この画像は、日本の電気料金の明細（「電気ご使用量のお知らせ」や請求書）です。",
      "次の形の JSON だけを返してください。説明の文は書かないでください。",
      '{"period": "month" または "year" または null, "kwh": 使用量（kWh・数値）または null, "yen": 請求金額（円・税込の合計・数値）または null, "confidence": "high" または "medium" または "low", "note": 気づいた点（30字以内）または null}',
      "・読めない値、写っていない値は推測せず null にしてください。",
      "・1か月分の明細なら period は month。1年分の合計が書かれた資料なら year。",
      "・複数の月が載っている場合は、いちばん新しい1か月分を読んでください。",
      "・kwh と yen は、カンマや単位を付けない数値にしてください。",
    ].join("\n");
  }
  return [
    "この画像は、業務用エアコン（室外機または室内機）の銘板（機種の情報が書かれたシール・プレート）です。",
    "次の形の JSON だけを返してください。説明の文は書かないでください。",
    '{"maker": メーカー名 または null, "model_outdoor": 室外機の型式 または null, "model_indoor": 室内機の型式 または null, "year": 製造年（西暦・数値）または null, "hp": 馬力（数値）または null, "capacity_kw": 冷房能力（kW・数値）または null, "confidence": "high" または "medium" または "low", "note": 気づいた点（30字以内）または null}',
    "・読めない値、写っていない値は推測せず null にしてください。",
    "・馬力が書かれていなければ hp は null にしてください（能力から推測しない）。",
    "・製造年が「2012年製」や「製造年月 2012.05」のように書かれていれば 2012。",
  ].join("\n");
}

/** 業務用エアコンの標準の能力区分（冷房能力 kW → 馬力） */
const CAPACITY_CLASSES: [number, number][] = [
  [4.0, 1.5],
  [4.5, 1.8],
  [5.0, 2],
  [5.6, 2.3],
  [6.3, 2.5],
  [8.0, 3],
  [11.2, 4],
  [14.0, 5],
  [16.0, 6],
  [22.4, 8],
  [28.0, 10],
];

/** 能力がどれかの区分に±3%で当てはまるときだけ、その馬力を返す */
export function hpFromCapacityKw(kw: number): number | null {
  if (!Number.isFinite(kw) || kw <= 0) return null;
  for (const [cls, hp] of CAPACITY_CLASSES) {
    if (Math.abs(kw - cls) / cls <= 0.03) return hp;
  }
  return null;
}

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s円kKwWhH]/g, "");
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  }
  return null;
};
const inRange = (v: number | null, min: number, max: number): number | null => (v != null && v >= min && v <= max ? v : null);
const text = (v: unknown, max = 60): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f<>]/g, "").trim();
  return t ? t.slice(0, max) : null;
};

/** AI の答え（文字列）から最初の JSON を取り出す。コードブロックで囲まれていても読む。 */
export function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(raw.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function confidenceOf(v: unknown): PhotoConfidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

export function parseBillAnswer(raw: string): PhotoReadOk<BillReading> | null {
  const j = extractJson(raw);
  if (!j) return null;
  const period = j.period === "month" || j.period === "year" ? j.period : null;
  const reading: BillReading = {
    period,
    kwh: inRange(num(j.kwh), 1, 50_000_000),
    yen: inRange(num(j.yen), 1, 5_000_000_000),
  };
  if (reading.kwh == null && reading.yen == null) return null;
  return { ok: true, kind: "bill", reading, confidence: confidenceOf(j.confidence), note: text(j.note, 60) };
}

export function parseNameplateAnswer(raw: string, nowYear: number = new Date().getFullYear()): PhotoReadOk<NameplateReading> | null {
  const j = extractJson(raw);
  if (!j) return null;
  const stated = inRange(num(j.hp), 0.5, 100);
  const capacity = inRange(num(j.capacity_kw), 1, 200);
  const derived = stated == null && capacity != null ? hpFromCapacityKw(capacity) : null;
  const reading: NameplateReading = {
    maker: text(j.maker, 40),
    modelOutdoor: text(j.model_outdoor, 60),
    modelIndoor: text(j.model_indoor, 60),
    year: inRange(num(j.year), 1980, nowYear),
    hp: stated ?? derived,
    hpFromCapacityKw: derived != null ? capacity : null,
  };
  if (!reading.maker && !reading.modelOutdoor && !reading.modelIndoor && reading.year == null && reading.hp == null) return null;
  return { ok: true, kind: "nameplate", reading, confidence: confidenceOf(j.confidence), note: text(j.note, 60) };
}

/** data URL（data:image/jpeg;base64,...）を分解する。受け付けない形なら null */
export function splitImageDataUrl(dataUrl: unknown): { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string } | null {
  if (typeof dataUrl !== "string" || dataUrl.length > PHOTO_MAX_DATA_URL_CHARS) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] };
}
