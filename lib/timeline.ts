import { MatchInput, EquipGroup, RefriType } from "./types";
import { matchSubsidies } from "./match";

export interface TimelineStep {
  label: string;
  month: number; // 公募/起点からの概算月数
  note?: string;
  star?: boolean; // 重要マイルストーン（交付決定など）
}

// 補助金フロー（公募→申請→交付決定→着工→完工→実績報告→入金）。月数は一般的な概算。
export function buildSubsidyTimeline(): { steps: TimelineStep[]; caution: string } {
  return {
    steps: [
      { label: "公募開始", month: 0 },
      { label: "申請締切", month: 1, note: "GビズIDプライム・事業計画・見積を準備" },
      { label: "交付決定", month: 3, star: true, note: "この前に発注・着工すると補助対象外（フライング厳禁）" },
      { label: "着工", month: 3 },
      { label: "完工", month: 5 },
      { label: "実績報告", month: 6, note: "請求書・施工写真・計測データを提出" },
      { label: "補助金入金", month: 9, star: true, note: "確定検査後の後払い。概ね2〜3か月で精算" },
    ],
    caution:
      "原則『交付決定後に着工』。決定前の発注・着工は補助対象外です。入金は工事完了→実績報告→確定後の後払いのため、つなぎ資金の確保を推奨します。",
  };
}

// 工事フロー（EHC施工・ENIMAS計測込み）
export function buildConstructionTimeline(): TimelineStep[] {
  return [
    { label: "現地調査・機器確認", month: 0, note: "ENIMASでビフォー計測開始（2週間〜が理想）" },
    { label: "設計・見積", month: 0 },
    { label: "発注（交付決定後）", month: 3, note: "補助金案件は交付決定を待って発注" },
    { label: "施工（ドロップイン/更新）", month: 4 },
    { label: "試運転・アフター計測", month: 4, note: "ENIMASでアフター計測→削減実績を可視化" },
    { label: "引渡・実績報告", month: 5 },
  ];
}

export interface RoadmapYear {
  year: number;
  phaseLabel: string;
  groupLabels: string[];
  units: number;
  subsidyName: string;
  saveYenPerYear: number;
  saveKwhPerYear: number;
  co2ReductionTon: number;
  investManYen: number;
}

const REFRI_PRIORITY: Record<RefriType, number> = { r22: 0, r410a: 1, unknown: 1, r32: 2 };
const REFRI_LABEL: Record<RefriType, string> = { r22: "R22", r410a: "R410A", r32: "R32", unknown: "冷媒不明" };

// 段階更新ロードマップ：古い/R22群から優先し、年次に分割。各年をその年に動かす設備＋補助金に紐付け。
export function buildMultiYearRoadmap(input: MatchInput, maxYears = 3): RoadmapYear[] {
  const startYear = new Date().getFullYear();
  const sorted = [...input.equipGroups].sort((a, b) => {
    if (REFRI_PRIORITY[a.refri] !== REFRI_PRIORITY[b.refri]) return REFRI_PRIORITY[a.refri] - REFRI_PRIORITY[b.refri];
    return a.installYear - b.installYear;
  });
  if (sorted.length === 0) return [];
  const years = Math.min(maxYears, sorted.length);
  const perYear = Math.ceil(sorted.length / years);
  const totalUnits = sorted.reduce((a, g) => a + g.units, 0) || 1;

  const out: RoadmapYear[] = [];
  for (let y = 0; y < years; y++) {
    const yg = sorted.slice(y * perYear, (y + 1) * perYear);
    if (yg.length === 0) continue;
    const subUnits = yg.reduce((a, g) => a + g.units, 0);
    const ratio = subUnits / totalUnits;
    const subInput: MatchInput = {
      ...input,
      equipGroups: yg,
      kwh: Math.round(input.kwh * ratio),
      invest: Math.round(input.invest * ratio),
    };
    const r = matchSubsidies(subInput);
    const saveKwh = r.groups.reduce((a, g) => a + g.saveKwhPerYear, 0);
    const subsidyName = r.matched.find((s) => !s.infoOnly)?.name || "（対象補助金は要確認）";
    out.push({
      year: startYear + y,
      phaseLabel: y === 0 ? "今期（Year 1）" : `翌${y === 1 ? "" : y + ""}年（Year ${y + 1}）`,
      groupLabels: yg.map((g: EquipGroup) => `${REFRI_LABEL[g.refri]}・${g.units}台（${g.installYear}年）`),
      units: subUnits,
      subsidyName,
      saveYenPerYear: r.saveYenPerYear,
      saveKwhPerYear: saveKwh,
      co2ReductionTon: r.co2ReductionTon,
      investManYen: subInput.invest,
    });
  }
  return out;
}
