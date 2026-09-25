/* ───────────────────────────────────────────────────────────
   型番ごとの実機性能（メーカー一次資料）
   EHC-0039 v2 §4 作業3 / 台帳 #31 / 2026-09-16 v1

   ■ なぜこのファイルが必要か

   これまで「既設 → 標準更新 → 高効率更新」の比較は、lib/coefficients.ts の
   4係数（経年劣化・冷媒世代差・制御効率差・業種別省エネ余地）だけで作っていた。
   4つとも provisional（出典未確定）である。つまり実機の性能は1台も見ていない。
   それでも画面には「実効削減率 33%」のような数字が出る。
   大塚倉庫の「−33%」と同じ立場である。

   そこでメーカーの標準仕様ページを実際に取得し、型番ごとの
   　　冷房／暖房の定格能力(kW)、定格消費電力(kW)、通年エネルギー消費効率(APF)
   を、出典URL・カタログ番号・ページ番号・確認日つきで持つ。

   ■ 埋めない

   ・一次資料で読めなかった型番はここに載せない。似た型番から推定して載せない。
   ・馬力（1.5馬力＝P40 など）から能力(kW)を起こすことはしない。
   　馬力呼称と能力の対応を明記したメーカー一次資料を特定できていないため、
   　ここで対応表を書くと、出典の無い対応表が実機性能の顔をして下流へ流れる。
   　（能力の起点は型番だけ。型番が無い案件は実機比較をしない＝係数概算に落ちる。）
   ・電気代・CO2 はここでは扱わない。単価と排出係数は lib/pricing.ts の持ち物。

   ■ 指標をまたいだ比較を型で止める

   APF は算出基準が JIS B8616：2015 で改正されている。
   同じ「APF」という名前で、2006年基準の値と2015年基準の値が世の中に併存する。
   実際、今回取得した FIVE STAR ZEAS のページ（CP21213A-2 p.201）には
   　「APFの算出基準はJIS B8616：2015に基づき改正されました。
   　　本ページのAPFの値は改正前の算出基準によるものです。」
   と明記されている。この 5.6 と、2015年基準の 8.0 を割り算すると
   削減率が実態よりはるかに大きく出る。
   だから値と一緒に「どの基準の値か」(EfficiencyIndex) を必ず持たせ、
   基準が違う組み合わせは lib/performanceCompare.ts が計算を拒否する。
   ─────────────────────────────────────────────────────────── */

/* ------------------------------------------------------------------ *
 * 出典
 * ------------------------------------------------------------------ */

export interface SpecSource {
  /** 画面・帳票に出す資料名 */
  title: string;
  /** 原典のURL（PDFの当該ページ） */
  url: string;
  /** カタログ番号（版の違いを追えるようにする） */
  catalog: string;
  /** ページ番号 */
  page: number;
  /** ISO yyyy-mm-dd。実際に原典を開いて値を照合した日 */
  checkedAt: string;
}

const CHECKED_AT = "2026-09-16";

/** Eco-ZEAS（標準機）天井埋込カセット形 S-ラウンドフロー／天井吊形 スタイリッシュフロー */
const SRC_ECO_167: SpecSource = {
  title: "ダイキン工業 店舗・オフィスエアコン スカイエア 標準仕様（Eco-ZEAS シリーズ）p.167",
  url: "https://ec.daikinaircon.com/ecatalog/CP22179-1X/images/CP22179-1X167.pdf",
  catalog: "CP22179-1X",
  page: 167,
  checkedAt: CHECKED_AT,
};

/** Eco-ZEAS（標準機）天井吊形〈標準〉／壁掛形 */
const SRC_ECO_173: SpecSource = {
  title: "ダイキン工業 店舗・オフィスエアコン スカイエア 標準仕様（Eco-ZEAS シリーズ）p.173",
  url: "https://ec.daikinaircon.com/ecatalog/CP22179-1X/images/CP22179-1X173.pdf",
  catalog: "CP22179-1X",
  page: 173,
  checkedAt: CHECKED_AT,
};

/** FIVE STAR ZEAS（高効率機）天井埋込カセット形 S-ラウンドフロー〈センシング〉／天井吊形 スタイリッシュフロー */
const SRC_FSZ_153: SpecSource = {
  title: "ダイキン工業 店舗・オフィスエアコン スカイエア 標準仕様（FIVE STAR ZEAS シリーズ）p.153",
  url: "https://ec.daikinaircon.com/ecatalog/CP26016XX1/images/CP26016XX1153.pdf",
  catalog: "CP26016XX1",
  page: 153,
  checkedAt: CHECKED_AT,
};

/** FIVE STAR ZEAS 旧版（APF は 2006年基準）。比較を拒否する経路の実データとして持つ */
const SRC_FSZ_APF2006_201: SpecSource = {
  title:
    "ダイキン工業 店舗・オフィスエアコン スカイエア 標準仕様 参考APF(2006)・冷暖平均COP（FIVE STAR ZEAS シリーズ）p.201",
  url: "https://ec.daikinaircon.com/ecatalog/CP21213A-2/images/CP21213A-2201.pdf",
  catalog: "CP21213A-2",
  page: 201,
  checkedAt: CHECKED_AT,
};

/** 能力・消費電力・APF の測定条件（同じ稼働前提であることの根拠） */
export const JIS_CONDITION_SOURCE: SpecSource = {
  title:
    "ダイキン工業 店舗・オフィスエアコン スカイエア 標準仕様 注記（FIVE STAR ZEAS、Eco-ZEASシリーズ）p.179",
  url: "https://ec.daikinaircon.com/ecatalog/CP26016XXX/images/CP26016XXX179.pdf",
  catalog: "CP26016XXX",
  page: 179,
  checkedAt: CHECKED_AT,
};

/** 画面・帳票に共通で出す、測定条件の説明。文言を1箇所に集約する。 */
export const JIS_CONDITION_NOTE =
  "冷房・暖房の定格能力と定格消費電力は JIS B8616：2015 に準拠した値（冷房：室内27℃DB/19℃WB・外気35℃DB/24℃WB、" +
  "暖房：室内20℃DB/15℃WB・外気7℃DB/6℃WB、接続配管7.5m〈P40〜P63形は5m〉、高さ0m）。" +
  "APF(2015) は同規格が定める条件（地区：東京、建物用途：戸建て店舗）での通年エネルギー消費効率です。" +
  "実際の建物・運用条件はこの前提と異なるため、比較は同一前提での相対差として読んでください。";

/* ------------------------------------------------------------------ *
 * 効率指標
 * ------------------------------------------------------------------ */

/** 効率の指標。名前が同じ「APF」でも算出基準が違えば別の指標として扱う。 */
export type EfficiencyIndex = "apf2015" | "apf2006" | "cop_rated";

export const EFFICIENCY_INDEX_LABEL: Record<EfficiencyIndex, string> = {
  apf2015: "APF(2015)（通年エネルギー消費効率・JIS B8616:2015）",
  apf2006: "APF(2006)（通年エネルギー消費効率・改正前基準）",
  cop_rated: "定格COP（定格点のエネルギー消費効率）",
};

/**
 * 2つの効率値を割り算してよいか。
 *
 * 同じ指標どうしだけ true。
 * apf2015 と apf2006 は「期間の効率」という意味では似ているが、
 * 算出基準（対象期間・負荷分布・区分）が違うので比較できない。
 * apf と cop_rated は「期間」と「定格1点」で、混ぜると削減を過大に見せる。
 */
export function canCompareIndex(a: EfficiencyIndex, b: EfficiencyIndex): boolean {
  return a === b;
}

/* ------------------------------------------------------------------ *
 * 機種の区分
 * ------------------------------------------------------------------ */

/** 室内機の形状。更新候補は同じ形状の中から選ぶ（カセットを壁掛に置き換えない） */
export type EquipShape =
  | "cassette_s_round" // 天井埋込カセット形 S-ラウンドフロー
  | "ceiling_suspended" // 天井吊形〈標準〉
  | "ceiling_suspended_stylish" // 天井吊形 スタイリッシュフロー
  | "wall"; // 壁掛形

export const EQUIP_SHAPE_LABEL: Record<EquipShape, string> = {
  cassette_s_round: "天井埋込カセット形 S-ラウンドフロー",
  ceiling_suspended: "天井吊形〈標準〉",
  ceiling_suspended_stylish: "天井吊形 スタイリッシュフロー",
  wall: "壁掛形",
};

/** 室内機の組合せ。同じ能力でも組合せが違えば別の仕様値になる */
export type EquipCombination = "pair" | "twin" | "triple" | "double_twin";

export const EQUIP_COMBINATION_LABEL: Record<EquipCombination, string> = {
  pair: "ペア（室内機1台）",
  twin: "ツイン同時（室内機2台）",
  triple: "トリプル同時（室内機3台）",
  double_twin: "ダブルツイン同時（室内機4台）",
};

/** 機種の位置づけ。standard=標準機 / high_efficiency=高効率機 */
export type ModelGrade = "standard" | "high_efficiency";

export const MODEL_GRADE_LABEL: Record<ModelGrade, string> = {
  standard: "標準機",
  high_efficiency: "高効率機",
};

/** 電源。V=単相200V / T=3相200V。型番から読み取れないものは null（推定しない） */
export type PowerPhase = "single" | "three";

/* ------------------------------------------------------------------ *
 * 型番ごとの仕様
 * ------------------------------------------------------------------ */

export interface ModelSpec {
  /** 機種名（システム型番。室内機＋室外機の組合せに与えられた名前） */
  modelNo: string;
  /** シリーズ名 */
  series: string;
  grade: ModelGrade;
  shape: EquipShape;
  combination: EquipCombination;
  /** 冷房定格能力(kW)。一次資料に無ければ null（推定しない） */
  coolingKw: number | null;
  /** 暖房定格能力(kW) */
  heatingKw: number | null;
  /** 冷房定格消費電力(kW) */
  coolingPowerKw: number | null;
  /** 暖房定格消費電力(kW) */
  heatingPowerKw: number | null;
  /** 効率の指標 */
  efficiencyIndex: EfficiencyIndex;
  /** 効率の値 */
  efficiency: number;
  phase: PowerPhase | null;
  source: SpecSource;
}

/* 以下は一次資料の表をそのまま写したもの。
   1行＝カタログの1行で、値を丸めたり補間したりしていない。
   ワイヤレス機（機種名の (N)）は同じ行の値なので、正規化で吸収する（下の findModelSpec）。 */

function eco(
  modelNo: string,
  shape: EquipShape,
  combination: EquipCombination,
  coolingKw: number,
  heatingKw: number,
  efficiency: number,
  coolingPowerKw: number,
  heatingPowerKw: number,
  phase: PowerPhase | null,
  source: SpecSource
): ModelSpec {
  return {
    modelNo,
    series: "Eco-ZEAS",
    grade: "standard",
    shape,
    combination,
    coolingKw,
    heatingKw,
    coolingPowerKw,
    heatingPowerKw,
    efficiencyIndex: "apf2015",
    efficiency,
    phase,
    source,
  };
}

function fsz(
  modelNo: string,
  shape: EquipShape,
  combination: EquipCombination,
  coolingKw: number,
  heatingKw: number,
  efficiency: number,
  coolingPowerKw: number,
  heatingPowerKw: number,
  phase: PowerPhase | null
): ModelSpec {
  return {
    modelNo,
    series: "FIVE STAR ZEAS",
    grade: "high_efficiency",
    shape,
    combination,
    coolingKw,
    heatingKw,
    coolingPowerKw,
    heatingPowerKw,
    efficiencyIndex: "apf2015",
    efficiency,
    phase,
    source: SRC_FSZ_153,
  };
}

/** APF が2006年基準のページからしか取れていない機種。能力・消費電力はそのページに無い。 */
function fszApf2006(
  modelNo: string,
  shape: EquipShape,
  combination: EquipCombination,
  efficiency: number,
  phase: PowerPhase | null
): ModelSpec {
  return {
    modelNo,
    series: "FIVE STAR ZEAS（BJ）",
    grade: "high_efficiency",
    shape,
    combination,
    coolingKw: null,
    heatingKw: null,
    coolingPowerKw: null,
    heatingPowerKw: null,
    efficiencyIndex: "apf2006",
    efficiency,
    phase,
    source: SRC_FSZ_APF2006_201,
  };
}

export const MODEL_SPECS: ModelSpec[] = [
  /* ───── Eco-ZEAS 天井埋込カセット形 S-ラウンドフロー〈標準〉（CP22179-1X p.167） ───── */
  eco("SZRC40BYV", "cassette_s_round", "pair", 3.6, 4.0, 6.5, 0.805, 0.810, "single", SRC_ECO_167),
  eco("SZRC40BYT", "cassette_s_round", "pair", 3.6, 4.0, 6.5, 0.805, 0.810, "three", SRC_ECO_167),
  eco("SZRC45BYV", "cassette_s_round", "pair", 4.0, 4.5, 6.5, 0.960, 0.960, "single", SRC_ECO_167),
  eco("SZRC45BYT", "cassette_s_round", "pair", 4.0, 4.5, 6.5, 0.960, 0.960, "three", SRC_ECO_167),
  eco("SZRC50BYV", "cassette_s_round", "pair", 4.5, 5.0, 6.4, 1.19, 1.13, "single", SRC_ECO_167),
  eco("SZRC50BYT", "cassette_s_round", "pair", 4.5, 5.0, 6.4, 1.19, 1.13, "three", SRC_ECO_167),
  eco("SZRC56BYV", "cassette_s_round", "pair", 5.0, 5.6, 6.4, 1.21, 1.25, "single", SRC_ECO_167),
  eco("SZRC56BYT", "cassette_s_round", "pair", 5.0, 5.6, 6.4, 1.21, 1.25, "three", SRC_ECO_167),
  eco("SZRC63BYV", "cassette_s_round", "pair", 5.6, 6.3, 6.5, 1.44, 1.45, "single", SRC_ECO_167),
  eco("SZRC63BYT", "cassette_s_round", "pair", 5.6, 6.3, 6.5, 1.44, 1.45, "three", SRC_ECO_167),
  eco("SZRC80BYV", "cassette_s_round", "pair", 7.1, 8.0, 5.8, 2.10, 2.05, "single", SRC_ECO_167),
  eco("SZRC80BYT", "cassette_s_round", "pair", 7.1, 8.0, 5.8, 2.10, 2.05, "three", SRC_ECO_167),
  eco("SZRC112BY", "cassette_s_round", "pair", 10.0, 11.2, 6.1, 2.47, 2.35, null, SRC_ECO_167),
  eco("SZRC140BY", "cassette_s_round", "pair", 12.5, 14.0, 5.8, 3.49, 3.36, null, SRC_ECO_167),
  eco("SZRC160BY", "cassette_s_round", "pair", 14.0, 16.0, 5.6, 4.44, 4.08, null, SRC_ECO_167),
  eco("SZRC80BYVD", "cassette_s_round", "twin", 7.1, 8.0, 5.8, 1.72, 1.85, "single", SRC_ECO_167),
  eco("SZRC80BYTD", "cassette_s_round", "twin", 7.1, 8.0, 5.8, 1.72, 1.85, "three", SRC_ECO_167),
  eco("SZRC112BYD", "cassette_s_round", "twin", 10.0, 11.2, 6.0, 2.45, 2.54, null, SRC_ECO_167),
  eco("SZRC140BYD", "cassette_s_round", "twin", 12.5, 14.0, 5.8, 3.38, 3.28, null, SRC_ECO_167),
  eco("SZRC160BYD", "cassette_s_round", "twin", 14.0, 16.0, 5.5, 4.18, 4.05, null, SRC_ECO_167),
  eco("SZRC224BAD", "cassette_s_round", "twin", 20.0, 22.4, 5.9, 5.95, 5.72, null, SRC_ECO_167),
  eco("SZRC280BAD", "cassette_s_round", "twin", 25.0, 28.0, 5.5, 8.48, 7.49, null, SRC_ECO_167),
  eco("SZRC160BYM", "cassette_s_round", "triple", 14.0, 16.0, 5.9, 4.05, 3.93, null, SRC_ECO_167),
  eco("SZRC224BAM", "cassette_s_round", "triple", 20.0, 22.4, 5.7, 6.34, 5.60, null, SRC_ECO_167),
  eco("SZRC224BAW", "cassette_s_round", "double_twin", 20.0, 22.4, 5.8, 6.14, 5.49, null, SRC_ECO_167),
  eco("SZRC280BAW", "cassette_s_round", "double_twin", 25.0, 28.0, 5.6, 7.53, 7.10, null, SRC_ECO_167),

  /* ───── Eco-ZEAS 天井吊形 スタイリッシュフロー（CP22179-1X p.167） ───── */
  eco("SZRHU40BYV", "ceiling_suspended_stylish", "pair", 3.6, 4.0, 5.1, 0.980, 0.880, "single", SRC_ECO_167),
  eco("SZRHU40BYT", "ceiling_suspended_stylish", "pair", 3.6, 4.0, 5.1, 0.980, 0.880, "three", SRC_ECO_167),
  eco("SZRHU50BYV", "ceiling_suspended_stylish", "pair", 4.5, 5.0, 4.9, 1.41, 1.22, "single", SRC_ECO_167),
  eco("SZRHU50BYT", "ceiling_suspended_stylish", "pair", 4.5, 5.0, 4.9, 1.41, 1.22, "three", SRC_ECO_167),
  eco("SZRHU63BYV", "ceiling_suspended_stylish", "pair", 5.6, 6.3, 4.9, 2.07, 1.68, "single", SRC_ECO_167),
  eco("SZRHU63BYT", "ceiling_suspended_stylish", "pair", 5.6, 6.3, 4.9, 2.07, 1.68, "three", SRC_ECO_167),
  eco("SZRHU80BYV", "ceiling_suspended_stylish", "pair", 7.1, 8.0, 4.8, 2.48, 2.33, "single", SRC_ECO_167),
  eco("SZRHU80BYT", "ceiling_suspended_stylish", "pair", 7.1, 8.0, 4.8, 2.48, 2.33, "three", SRC_ECO_167),

  /* ───── Eco-ZEAS 天井吊形〈標準〉（CP22179-1X p.173） ───── */
  eco("SZRH40BYV", "ceiling_suspended", "pair", 3.6, 4.0, 5.5, 0.950, 0.950, "single", SRC_ECO_173),
  eco("SZRH40BYT", "ceiling_suspended", "pair", 3.6, 4.0, 5.5, 0.950, 0.950, "three", SRC_ECO_173),
  eco("SZRH45BYV", "ceiling_suspended", "pair", 4.0, 4.5, 5.3, 1.11, 1.10, "single", SRC_ECO_173),
  eco("SZRH45BYT", "ceiling_suspended", "pair", 4.0, 4.5, 5.3, 1.11, 1.10, "three", SRC_ECO_173),
  eco("SZRH50BYV", "ceiling_suspended", "pair", 4.5, 5.0, 5.4, 1.26, 1.24, "single", SRC_ECO_173),
  eco("SZRH50BYT", "ceiling_suspended", "pair", 4.5, 5.0, 5.4, 1.26, 1.24, "three", SRC_ECO_173),
  eco("SZRH56BYV", "ceiling_suspended", "pair", 5.0, 5.6, 5.1, 1.42, 1.39, "single", SRC_ECO_173),
  eco("SZRH56BYT", "ceiling_suspended", "pair", 5.0, 5.6, 5.1, 1.42, 1.39, "three", SRC_ECO_173),
  eco("SZRH63BYV", "ceiling_suspended", "pair", 5.6, 6.3, 5.1, 1.68, 1.63, "single", SRC_ECO_173),
  eco("SZRH63BYT", "ceiling_suspended", "pair", 5.6, 6.3, 5.1, 1.68, 1.63, "three", SRC_ECO_173),
  eco("SZRH80BYV", "ceiling_suspended", "pair", 7.1, 8.0, 5.2, 2.30, 2.37, "single", SRC_ECO_173),
  eco("SZRH80BYT", "ceiling_suspended", "pair", 7.1, 8.0, 5.2, 2.30, 2.37, "three", SRC_ECO_173),
  eco("SZRH112BY", "ceiling_suspended", "pair", 10.0, 11.2, 5.5, 2.72, 2.70, null, SRC_ECO_173),
  eco("SZRH140BY", "ceiling_suspended", "pair", 12.5, 14.0, 5.0, 4.22, 3.78, null, SRC_ECO_173),
  eco("SZRH160BY", "ceiling_suspended", "pair", 14.0, 16.0, 4.7, 5.38, 4.65, null, SRC_ECO_173),
  eco("SZRH224BA", "ceiling_suspended", "pair", 20.0, 22.4, 4.2, 7.21, 6.48, null, SRC_ECO_173),
  eco("SZRH280BA", "ceiling_suspended", "pair", 25.0, 28.0, 4.0, 10.2, 8.54, null, SRC_ECO_173),
  eco("SZRH80BYVD", "ceiling_suspended", "twin", 7.1, 8.0, 5.1, 2.00, 2.00, "single", SRC_ECO_173),
  eco("SZRH80BYTD", "ceiling_suspended", "twin", 7.1, 8.0, 5.1, 2.00, 2.00, "three", SRC_ECO_173),
  eco("SZRH112BYD", "ceiling_suspended", "twin", 10.0, 11.2, 5.3, 2.80, 2.90, null, SRC_ECO_173),
  eco("SZRH140BYD", "ceiling_suspended", "twin", 12.5, 14.0, 5.3, 3.72, 3.61, null, SRC_ECO_173),
  eco("SZRH160BYD", "ceiling_suspended", "twin", 14.0, 16.0, 5.1, 4.77, 4.45, null, SRC_ECO_173),
  eco("SZRH224BAD", "ceiling_suspended", "twin", 20.0, 22.4, 5.0, 6.81, 6.15, null, SRC_ECO_173),
  eco("SZRH280BAD", "ceiling_suspended", "twin", 25.0, 28.0, 4.7, 9.80, 8.60, null, SRC_ECO_173),
  eco("SZRH160BYM", "ceiling_suspended", "triple", 14.0, 16.0, 5.1, 4.46, 4.30, null, SRC_ECO_173),
  eco("SZRH224BAM", "ceiling_suspended", "triple", 20.0, 22.4, 5.0, 7.05, 6.69, null, SRC_ECO_173),

  /* ───── Eco-ZEAS 壁掛形（CP22179-1X p.173） ───── */
  eco("SZRA40BYV", "wall", "pair", 3.6, 4.0, 5.5, 0.940, 0.980, "single", SRC_ECO_173),
  eco("SZRA40BYT", "wall", "pair", 3.6, 4.0, 5.5, 0.940, 0.980, "three", SRC_ECO_173),
  eco("SZRA45BYV", "wall", "pair", 4.0, 4.5, 5.3, 1.10, 1.20, "single", SRC_ECO_173),
  eco("SZRA45BYT", "wall", "pair", 4.0, 4.5, 5.3, 1.10, 1.20, "three", SRC_ECO_173),
  eco("SZRA50BYV", "wall", "pair", 4.5, 5.0, 5.2, 1.35, 1.44, "single", SRC_ECO_173),
  eco("SZRA50BYT", "wall", "pair", 4.5, 5.0, 5.2, 1.35, 1.44, "three", SRC_ECO_173),
  eco("SZRA56BYV", "wall", "pair", 5.0, 5.6, 5.2, 1.31, 1.52, "single", SRC_ECO_173),
  eco("SZRA56BYT", "wall", "pair", 5.0, 5.6, 5.2, 1.31, 1.52, "three", SRC_ECO_173),
  eco("SZRA63BYV", "wall", "pair", 5.6, 6.3, 5.2, 1.61, 1.62, "single", SRC_ECO_173),
  eco("SZRA63BYT", "wall", "pair", 5.6, 6.3, 5.2, 1.61, 1.62, "three", SRC_ECO_173),
  eco("SZRA80BYV", "wall", "pair", 7.1, 8.0, 5.3, 2.49, 2.49, "single", SRC_ECO_173),
  eco("SZRA80BYT", "wall", "pair", 7.1, 8.0, 5.3, 2.49, 2.49, "three", SRC_ECO_173),
  eco("SZRA112BY", "wall", "pair", 10.0, 11.2, 5.1, 2.98, 3.49, null, SRC_ECO_173),

  /* ───── FIVE STAR ZEAS 天井埋込カセット形 S-ラウンドフロー〈センシング〉（CP26016XX1 p.153） ───── */
  fsz("SSRC40DV", "cassette_s_round", "pair", 3.6, 4.0, 8.0, 0.677, 0.757, "single"),
  fsz("SSRC40DT", "cassette_s_round", "pair", 3.6, 4.0, 8.0, 0.677, 0.757, "three"),
  fsz("SSRC45DV", "cassette_s_round", "pair", 4.0, 4.5, 7.8, 0.770, 0.885, "single"),
  fsz("SSRC45DT", "cassette_s_round", "pair", 4.0, 4.5, 7.8, 0.770, 0.885, "three"),
  fsz("SSRC50DV", "cassette_s_round", "pair", 4.5, 5.0, 7.8, 0.915, 1.03, "single"),
  fsz("SSRC50DT", "cassette_s_round", "pair", 4.5, 5.0, 7.8, 0.915, 1.03, "three"),
  fsz("SSRC56DV", "cassette_s_round", "pair", 5.0, 5.6, 7.6, 1.08, 1.25, "single"),
  fsz("SSRC56DT", "cassette_s_round", "pair", 5.0, 5.6, 7.6, 1.08, 1.25, "three"),
  fsz("SSRC63DV", "cassette_s_round", "pair", 5.6, 6.3, 7.4, 1.27, 1.34, "single"),
  fsz("SSRC63DT", "cassette_s_round", "pair", 5.6, 6.3, 7.4, 1.27, 1.34, "three"),
  fsz("SSRC80DV", "cassette_s_round", "pair", 7.1, 8.0, 7.1, 1.59, 1.61, "single"),
  fsz("SSRC80DT", "cassette_s_round", "pair", 7.1, 8.0, 7.2, 1.59, 1.58, "three"),
  fsz("SSRC112D", "cassette_s_round", "pair", 10.0, 11.2, 7.4, 2.20, 2.20, null),
  fsz("SSRC140D", "cassette_s_round", "pair", 12.5, 14.0, 6.9, 3.19, 3.19, null),
  fsz("SSRC160D", "cassette_s_round", "pair", 14.0, 16.0, 6.7, 3.70, 3.76, null),
  fsz("SSRC80DVD", "cassette_s_round", "twin", 7.1, 8.0, 6.5, 1.55, 1.61, "single"),
  fsz("SSRC80DTD", "cassette_s_round", "twin", 7.1, 8.0, 6.5, 1.55, 1.61, "three"),
  fsz("SSRC112DD", "cassette_s_round", "twin", 10.0, 11.2, 6.6, 2.30, 2.45, null),
  fsz("SSRC140DD", "cassette_s_round", "twin", 12.5, 14.0, 6.3, 2.95, 3.20, null),
  fsz("SSRC160DD", "cassette_s_round", "twin", 14.0, 16.0, 6.3, 3.50, 3.80, null),
  fsz("SSRC224DD", "cassette_s_round", "twin", 20.0, 22.4, 6.1, 5.55, 5.53, null),
  fsz("SSRC280DD", "cassette_s_round", "twin", 25.0, 28.0, 5.7, 8.30, 7.35, null),
  fsz("SSRC160DM", "cassette_s_round", "triple", 14.0, 16.0, 6.4, 3.50, 3.80, null),
  fsz("SSRC224DM", "cassette_s_round", "triple", 20.0, 22.4, 6.1, 5.30, 5.20, null),
  fsz("SSRC224DW", "cassette_s_round", "double_twin", 20.0, 22.4, 5.9, 5.80, 5.47, null),
  fsz("SSRC280DW", "cassette_s_round", "double_twin", 25.0, 28.0, 5.7, 7.51, 7.08, null),

  /* ───── FIVE STAR ZEAS 天井吊形 スタイリッシュフロー（CP26016XX1 p.153） ───── */
  fsz("SSRHU40DV", "ceiling_suspended_stylish", "pair", 3.6, 4.0, 5.6, 0.905, 0.850, "single"),
  fsz("SSRHU40DT", "ceiling_suspended_stylish", "pair", 3.6, 4.0, 5.6, 0.905, 0.850, "three"),
  fsz("SSRHU50DV", "ceiling_suspended_stylish", "pair", 4.5, 5.0, 5.5, 1.28, 1.18, "single"),
  fsz("SSRHU50DT", "ceiling_suspended_stylish", "pair", 4.5, 5.0, 5.5, 1.28, 1.18, "three"),
  fsz("SSRHU63DV", "ceiling_suspended_stylish", "pair", 5.6, 6.3, 5.4, 1.65, 1.65, "single"),
  fsz("SSRHU63DT", "ceiling_suspended_stylish", "pair", 5.6, 6.3, 5.4, 1.65, 1.65, "three"),
  fsz("SSRHU80DV", "ceiling_suspended_stylish", "pair", 7.1, 8.0, 5.1, 2.20, 2.25, "single"),
  fsz("SSRHU80DT", "ceiling_suspended_stylish", "pair", 7.1, 8.0, 5.1, 2.20, 2.25, "three"),

  /* ───── FIVE STAR ZEAS（BJ）天井埋込カセット形 S-ラウンドフロー〈センシング〉
           APF は2006年基準のページからしか取れていない（CP21213A-2 p.201）。
           このまま apf2015 の機種と割り算すると削減率が過大に出るので、
           lib/performanceCompare.ts が index 不一致として計算を拒否する。 ───── */
  fszApf2006("SSRC40BJV", "cassette_s_round", "pair", 6.7, "single"),
  fszApf2006("SSRC40BJT", "cassette_s_round", "pair", 6.7, "three"),
  fszApf2006("SSRC45BJV", "cassette_s_round", "pair", 6.7, "single"),
  fszApf2006("SSRC45BJT", "cassette_s_round", "pair", 6.7, "three"),
  fszApf2006("SSRC50BJV", "cassette_s_round", "pair", 6.6, "single"),
  fszApf2006("SSRC50BJT", "cassette_s_round", "pair", 6.6, "three"),
  fszApf2006("SSRC56BJV", "cassette_s_round", "pair", 6.4, "single"),
  fszApf2006("SSRC56BJT", "cassette_s_round", "pair", 6.4, "three"),
  fszApf2006("SSRC63BJV", "cassette_s_round", "pair", 6.3, "single"),
  fszApf2006("SSRC63BJT", "cassette_s_round", "pair", 6.3, "three"),
  fszApf2006("SSRC80BJV", "cassette_s_round", "pair", 6.3, "single"),
  fszApf2006("SSRC80BJT", "cassette_s_round", "pair", 6.4, "three"),
  fszApf2006("SSRC112BJ", "cassette_s_round", "pair", 6.4, null),
  fszApf2006("SSRC140BJ", "cassette_s_round", "pair", 6.0, null),
  fszApf2006("SSRC160BJ", "cassette_s_round", "pair", 5.8, null),
];

/* ------------------------------------------------------------------ *
 * 型番の照合
 * ------------------------------------------------------------------ */

/** 大小文字・記号・空白の違いを落とす。値の意味は変えない。 */
function normalizeModelNo(raw: string): string {
  return raw
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const SPEC_BY_KEY: Map<string, ModelSpec> = (() => {
  const m = new Map<string, ModelSpec>();
  MODEL_SPECS.forEach((s) => m.set(normalizeModelNo(s.modelNo), s));
  return m;
})();

/* カタログが明記している「別シリーズだが仕様値は同じ」表記の吸収。

   ・「機種名で (N) はワイヤレス機を示します」 … SZRC40BY(N)V は
     ワイヤード機 SZRC40BYV と同じ行の値である。
   ・「UVストリーマ除菌シリーズの仕様値は下記の値を参照ください。
      【例】SZRUC40BYV… U を削除した機種名 SZRC40BYV（呼出番号350）の値を参照ください」
   ・「ストリーマ除菌シリーズ … 【例】SZRJH63BYV… J を削除した機種名」

   つまりカタログ自身が N / U / J の1文字を取り除いた型番を参照せよと書いている。
   推測ではなくカタログの指示なので、その3文字に限って1文字だけ除去して再照合する。
   除去した結果が表に無ければ照合しない（近い型番に寄せることはしない）。 */
const REMOVABLE_LETTERS = new Set(["N", "U", "J"]);

/** 型番から仕様を引く。引けなければ null（似た型番に寄せない）。 */
export function findModelSpec(raw: string | null | undefined): ModelSpec | null {
  if (!raw) return null;
  const key = normalizeModelNo(raw);
  if (key.length === 0) return null;
  const direct = SPEC_BY_KEY.get(key);
  if (direct) return direct;
  for (let i = 0; i < key.length; i++) {
    if (!REMOVABLE_LETTERS.has(key[i])) continue;
    const hit = SPEC_BY_KEY.get(key.slice(0, i) + key.slice(i + 1));
    if (hit) return hit;
  }
  return null;
}

/**
 * 診断入力の3つの型番欄（系列名・室内機・室外機）から仕様を引く。
 *
 * 標準仕様表の値は「機種名（システム型番）」に対して与えられている。
 * 室内機だけ・室外機だけの型番は組合せによって値が変わるため、
 * 系列名 → 室外機 → 室内機 の順に照合し、最初に表と一致したものを採る。
 * どれも一致しなければ null。分かった気にならない。
 */
export function findModelSpecFromInputs(models: {
  set?: string | null;
  outdoor?: string | null;
  indoor?: string | null;
}): ModelSpec | null {
  return (
    findModelSpec(models.set) ?? findModelSpec(models.outdoor) ?? findModelSpec(models.indoor) ?? null
  );
}

/* ------------------------------------------------------------------ *
 * 更新候補の選定
 * ------------------------------------------------------------------ */

export interface CandidateQuery {
  shape: EquipShape;
  combination: EquipCombination;
  /** 必要な冷房定格能力(kW)。既設の定格能力をそのまま使う */
  coolingKw: number;
  grade: ModelGrade;
  /** 電源。指定があれば同じ電源の機種だけを候補にする */
  phase?: PowerPhase | null;
}

/**
 * 同じ形状・同じ組合せ・同じ冷房定格能力の中から、指定した位置づけ（標準機／高効率機）で
 * 最も効率の高い機種を返す。能力を変えた機種は返さない。
 *
 * 能力を「以上」で拾わないのは、能力が変われば熱負荷に対する余裕が変わり、
 * 同じ稼働前提での比較にならないため。表に同じ能力が無ければ候補なし（null）。
 */
export function findBestModelFor(q: CandidateQuery): ModelSpec | null {
  const pool = MODEL_SPECS.filter(
    (s) =>
      s.grade === q.grade &&
      s.shape === q.shape &&
      s.combination === q.combination &&
      s.coolingKw != null &&
      Math.abs((s.coolingKw as number) - q.coolingKw) < 1e-9 &&
      (q.phase == null || s.phase === q.phase)
  );
  if (pool.length === 0) return null;
  /* 効率の指標が混在しうるので、指標ごとに分けず「最大値」を取るのは危険。
     apf2015 の機種と apf2006 の機種を数値の大小だけで並べると、
     基準の違いを無視して選んでしまう。現行カタログ基準（apf2015）に限る。 */
  const current = pool.filter((s) => s.efficiencyIndex === "apf2015");
  const target = current.length > 0 ? current : [];
  if (target.length === 0) return null;
  return target.reduce((best, s) => (s.efficiency > best.efficiency ? s : best), target[0]);
}
