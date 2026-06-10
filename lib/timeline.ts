import { MatchInput, EquipGroup, RefriType } from "./types";
import { matchSubsidies } from "./match";

export interface TimelineStep {
  label: string;
  month: number; // 公募/起点からの概算月数
  note?: string;
  star?: boolean; // 重要マイルストーン（交付決定など）
}

// 補助金フロー（公募→申請→交付決定→着工→完工→実績報告→入金）。
// 各制度の実公募日程と「今日」を比較し、実カレンダー日付＋進捗(完了/現在地/予定)で返す。
export interface DatedStep {
  label: string;
  dateLabel: string;
  note?: string;
  status: "done" | "current" | "upcoming";
  star?: boolean;
}
export interface SubsidyTimeline {
  headline: string;
  steps: DatedStep[];
  caution: string;
  estimated: boolean; // true=日程が概算/未定
}

const SUBSIDY_CAUTION =
  "原則『交付決定後に着工』。決定前の発注・着工は補助対象外です。入金は工事完了→実績報告→確定後の後払いのため、つなぎ資金の確保を推奨します。";

function tlParseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function tlAddMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}
function tlStartOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function tlYm(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
function tlDayDiff(a: Date, b: Date): number {
  return Math.ceil((tlStartOfDay(b).getTime() - tlStartOfDay(a).getTime()) / 86400000);
}
function tlWithStatus(
  ms: { label: string; date: Date; note?: string; star?: boolean }[],
  today: Date
): DatedStep[] {
  const t = tlStartOfDay(today).getTime();
  let cur = ms.findIndex((m) => tlStartOfDay(m.date).getTime() >= t);
  if (cur === -1) cur = ms.length;
  return ms.map((m, i) => ({
    label: m.label,
    dateLabel: tlYm(m.date),
    note: m.note,
    star: m.star,
    status: i < cur ? "done" : i === cur ? "current" : "upcoming",
  }));
}

export function buildSubsidyTimeline(
  subsidy?: { applyOpen?: string; applyClose?: string; scheduleNote?: string } | null,
  today: Date = new Date()
): SubsidyTimeline {
  const close = tlParseDate(subsidy?.applyClose);
  const open = tlParseDate(subsidy?.applyOpen) || (close ? tlAddMonths(close, -1) : null);
  const note = subsidy?.scheduleNote;
  const t = tlStartOfDay(today).getTime();

  // 公募回が判明し、締切が未到来（=今から狙える回）→ 実日付タイムライン
  if (close && open && tlStartOfDay(close).getTime() >= t) {
    const grant = tlAddMonths(close, 2);
    const finish = tlAddMonths(close, 4);
    const report = tlAddMonths(close, 5);
    const pay = tlAddMonths(close, 8);
    const ms = [
      { label: "公募開始", date: open },
      { label: "申請締切", date: close, note: "GビズIDプライム・事業計画・見積を準備" },
      { label: "交付決定", date: grant, star: true, note: "この前の発注・着工は補助対象外（フライング厳禁）" },
      { label: "着工", date: grant },
      { label: "完工", date: finish },
      { label: "実績報告", date: report, note: "請求書・施工写真・計測データを提出" },
      { label: "補助金入金", date: pay, star: true, note: "確定検査後の後払い。概ね2〜3か月で精算" },
    ];
    const steps = tlWithStatus(ms, today);
    const headline =
      t < tlStartOfDay(open).getTime()
        ? `現在: 申請受付前（${tlYm(open)}開始予定・あと約${tlDayDiff(today, open)}日）`
        : `現在: 公募受付中（締切 ${tlYm(close)}・あと約${tlDayDiff(today, close)}日）`;
    return { headline, steps, caution: SUBSIDY_CAUTION, estimated: false };
  }

  // 締切済み or 日程未定 → 次回公募基準の概算
  const rel = [
    { label: "次回公募開始", off: 0 },
    { label: "申請締切", off: 1, note: "GビズIDプライム・事業計画・見積を準備" },
    { label: "交付決定", off: 3, star: true, note: "この前の発注・着工は補助対象外（フライング厳禁）" },
    { label: "着工", off: 3 },
    { label: "完工", off: 5 },
    { label: "実績報告", off: 6, note: "請求書・施工写真・計測データを提出" },
    { label: "補助金入金", off: 9, star: true, note: "確定検査後の後払い。概ね2〜3か月で精算" },
  ];
  const steps: DatedStep[] = rel.map((s) => ({
    label: s.label,
    dateLabel: `公募開始＋約${s.off}か月`,
    note: s.note,
    star: s.star,
    status: "upcoming",
  }));
  const headline = close
    ? `現在: 直近の公募回は締切済み。次回公募待ち（${note || "日程未定"}）`
    : `現在: 公募日程は未定（${note || "確定後に自動で再計算"}）`;
  return { headline, steps, caution: SUBSIDY_CAUTION, estimated: true };
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

export interface RoadmapCategory {
  label: string;
  refri: RefriType;
  units: number;
  investManYen: number;
  saveYenPerYear: number;
  saveKwhPerYear: number;
  paybackYears: number | null; // 回収年数＝損益分岐点
  roiPct: number;              // 年利回り(年間削減/投資)
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
  categories: RoadmapCategory[];
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
    // カテゴリ(設備群)別に投資を按分し、ROI・損益分岐を算出
    const gw = yg.map((g) => Math.max(1, g.units) * (g.hp && g.hp > 0 ? g.hp : 1));
    const gwSum = gw.reduce((a, b) => a + b, 0) || 1;
    const categories: RoadmapCategory[] = r.groups.map((gr, gi) => {
      const investManYen = Math.round(subInput.invest * (gw[gi] / gwSum));
      const saveYen = gr.saveYenPerYear;
      const paybackYears = saveYen > 0 ? Number(((investManYen * 10000) / saveYen).toFixed(1)) : null;
      const roiPct = investManYen > 0 ? Math.round((saveYen / (investManYen * 10000)) * 100) : 0;
      return {
        label: gr.label,
        refri: gr.refri,
        units: gr.units,
        investManYen,
        saveYenPerYear: saveYen,
        saveKwhPerYear: gr.saveKwhPerYear,
        paybackYears,
        roiPct,
      };
    });
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
      categories,
    });
  }
  return out;
}
