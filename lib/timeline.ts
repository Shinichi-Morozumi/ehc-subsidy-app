import { MatchInput, EquipGroup, RefriType } from "./types";
import { matchSubsidies } from "./match";
import { effectiveInterest } from "./features";
import { todayJst, jstDate } from "./programClock";

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

/* 2026-09-10 EHC-0038 P0-8:
   このファイルの日付計算はすべて「実行環境のローカル時刻」で行われていた。
   ブラウザ（日本の利用者）はJSTなので合うが、VercelのサーバはUTCなので、
   同じ案件でもサーバ描画とクライアント描画で工程表の「現在地」が1日ずれる。
   公募日程はJSTで書かれているので、日付の基準をJSTに固定する。

   やり方は「入口でJSTの正午に寄せる」の1点だけ。
   正午にしておけば、その後の getFullYear() / getMonth()（＝ローカル時刻での読み出し）が
   JST(+9) でも UTC(±0) でも同じ暦日を返すため、月送りや年月ラベルの計算を
   書き換えずに済む。日付境界の±1日はここで断つ。 */
function tlParseDate(s?: string): Date | null {
  if (!s) return null;
  const d = jstDate(s); // JSTの正午
  return isNaN(d.getTime()) ? null : d;
}
function tlAddMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}
/* 2026-09-10 EHC-0038 P0-8:
   ここは setHours(0,0,0,0) で「その日の0時」を作っていたが、0時は実行環境の
   ローカル時刻での0時なので、UTCのサーバでは日本時間の朝9時を指す。
   しかもこの関数を通るのは tlParseDate 済みの制度日程だけでなく、
   buildSubsidyTimeline / tlWithStatus に素の new Date()（＝いまの瞬間）として
   渡ってくる「今日」もである。入口の tlParseDate だけJSTに寄せても、
   比較相手の「今日」がUTCのままなら工程表の現在地は1日ずれたままになる。

   なので「今日」もJSTの暦日に丸め、tlParseDate と同じJST正午に揃える。
   両辺が同じ基準（JST正午）になるので、以降の >= 比較と日数差は
   タイムゾーンに依らず同じ結果を返す。 */
function tlStartOfDay(d: Date): Date {
  return jstDate(todayJst(d));
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

// 工事フロー（EHC施工・ENIMAS計測込み）。
// 案件の設備構成（台数・種別・冷媒）と、補助金を使うか／ドロップインかで工程と日数を出し分ける。
// 固定文言を返すと「機器と無関係の工事日程」になるため、必ず input を渡すこと。
export interface ConstructionPlan {
  steps: TimelineStep[];
  headline: string;
  useSubsidy: boolean;
  workDays: number;
  units: number;
}

export function buildConstructionTimeline(
  input?: MatchInput | null,
  opts?: { subsidyName?: string | null; dropinOnly?: boolean }
): ConstructionPlan {
  const groups = input?.equipGroups ?? [];
  const units = groups.reduce((a, g) => a + Math.max(0, g.units), 0);
  const multiUnits = groups.filter((g) => g.equip === "multi").reduce((a, g) => a + Math.max(0, g.units), 0);
  const pkgUnits = Math.max(0, units - multiUnits);
  // 非表示中は interest==="dropin" が残っていてもドロップイン工程表に落とさない
  const dropinOnly = opts?.dropinOnly ?? effectiveInterest(input?.interest) === "dropin";
  const useSubsidy = !!opts?.subsidyName;

  // 実働日数の目安：更新工事＝パッケージ1日2台／ビル用マルチ1日1台、ドロップイン＝1日6台
  const workDays = dropinOnly
    ? Math.max(1, Math.ceil(units / 6))
    : Math.max(1, Math.ceil(pkgUnits / 2) + multiUnits);
  // 20営業日/月を超える規模は施工〜引渡を後ろへずらす
  const workMonths = Math.max(0, Math.ceil(workDays / 20) - 1);

  const refriLabels = Array.from(new Set(groups.map((g) => REFRI_LABEL[g.refri])));
  const equipLabel =
    multiUnits > 0 && pkgUnits > 0
      ? `パッケージ${pkgUnits}台＋ビル用マルチ${multiUnits}台`
      : multiUnits > 0
      ? `ビル用マルチ${multiUnits}台`
      : `パッケージ${pkgUnits}台`;
  const surveyNote =
    units > 0
      ? `対象 ${equipLabel}（冷媒: ${refriLabels.join("・") || "要確認"}）。ENIMASでビフォー計測開始（2週間〜が理想）`
      : "ENIMASでビフォー計測開始（2週間〜が理想）";

  // ① ドロップイン（冷媒入替のみ）：交付決定待ちが不要なぶん最短
  if (dropinOnly) {
    const steps: TimelineStep[] = [
      { label: "現地調査・機器確認", month: 0, note: surveyNote },
      { label: "冷媒選定・見積", month: 0, note: "既存機の適合可否と必要冷媒量を確定" },
      { label: "発注・工程調整", month: 1 },
      {
        label: `ドロップイン施工（${units || "—"}台・実働約${workDays}日）`,
        month: 1 + workMonths,
        note: "既存冷媒の回収・破壊処理を含む。営業時間内の系統ごと施工が可能で全館停止は不要",
      },
      { label: "試運転・アフター計測", month: 2 + workMonths, note: "ENIMASでアフター計測→削減実績を可視化" },
      { label: "引渡・報告書提出", month: 2 + workMonths },
    ];
    return {
      steps,
      headline: `ドロップイン（冷媒入替）：${units || "—"}台・実働約${workDays}日・着手から約${2 + workMonths}か月で引渡`,
      useSubsidy,
      workDays,
      units,
    };
  }

  // ② 更新工事＋補助金：発注は交付決定後（フライング厳禁）
  if (useSubsidy) {
    const steps: TimelineStep[] = [
      { label: "現地調査・機器確認", month: 0, note: surveyNote },
      { label: "設計・見積", month: 0 },
      { label: "補助金申請書類の作成・提出", month: 1, note: `${opts?.subsidyName}で申請` },
      {
        label: "発注（交付決定後）",
        month: 3,
        star: true,
        note: "交付決定前の発注・着工は補助対象外。機器の納期確保もこの時点から",
      },
      {
        label: `更新工事（${units || "—"}台・実働約${workDays}日）`,
        month: 4,
        note: multiUnits > 0 ? "ビル用マルチは系統単位で切替。夜間・休日施工で営業影響を最小化" : "系統ごとに切替え、営業への影響を最小化",
      },
      { label: "試運転・アフター計測", month: 4 + workMonths, note: "ENIMASでアフター計測→削減実績を可視化" },
      { label: "引渡・実績報告", month: 5 + workMonths, note: "請求書・施工写真・計測データを提出" },
    ];
    return {
      steps,
      headline: `更新工事＋補助金：${units || "—"}台・実働約${workDays}日・交付決定後に着工（着手から約${5 + workMonths}か月で引渡）`,
      useSubsidy,
      workDays,
      units,
    };
  }

  // ③ 更新工事（補助金なし）：交付決定待ちが無いので即発注できる
  const steps: TimelineStep[] = [
    { label: "現地調査・機器確認", month: 0, note: surveyNote },
    { label: "設計・見積", month: 0 },
    { label: "発注・機器手配", month: 1, note: "補助金を使わないため交付決定待ちは不要" },
    {
      label: `更新工事（${units || "—"}台・実働約${workDays}日）`,
      month: 2,
      note: multiUnits > 0 ? "ビル用マルチは系統単位で切替。夜間・休日施工で営業影響を最小化" : "系統ごとに切替え、営業への影響を最小化",
    },
    { label: "試運転・アフター計測", month: 2 + workMonths, note: "ENIMASでアフター計測→削減実績を可視化" },
    { label: "引渡・報告書提出", month: 3 + workMonths },
  ];
  return {
    steps,
    headline: `更新工事：${units || "—"}台・実働約${workDays}日・着手から約${3 + workMonths}か月で引渡`,
    useSubsidy,
    workDays,
    units,
  };
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
  /* 2026-09-11 EHC-0038 P0-10:
     null は「算定できていない」。表示は lib/match.ts の co2TonLabel() を通すこと。 */
  co2ReductionTon: number | null;
  investManYen: number;
  categories: RoadmapCategory[];
}

const REFRI_PRIORITY: Record<RefriType, number> = { r22: 0, r410a: 1, unknown: 1, r32: 2 };
const REFRI_LABEL: Record<RefriType, string> = { r22: "R22", r410a: "R410A", r32: "R32", unknown: "冷媒不明" };

// 段階更新ロードマップ：古い/R22群から優先し、年次に分割。各年をその年に動かす設備＋補助金に紐付け。
// preferredSubsidyId＝画面で選択中の制度。その年の設備部分集合でも実際にマッチする場合のみ採用し、
// マッチしない年は無理に載せない（＝案件と関係ない補助金を表示しないため）。
export function buildMultiYearRoadmap(
  input: MatchInput,
  maxYears = 3,
  preferredSubsidyId?: string | null
): RoadmapYear[] {
  /* 2026-09-10 EHC-0038 P0-8:
     new Date().getFullYear() は実行環境のローカル年。UTCのサーバでは
     日本時間の元日 00:00〜08:59 がまだ前年なので、年始の9時間だけ
     段階更新ロードマップの開始年が1年古く出る。年のラベルは
     「初年度に何を替えるか」を指す数字なので、ここもJSTで固定する。 */
  const startYear = Number(todayJst().slice(0, 4));
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
    /* 2026-09-11 EHC-0038 P0-10:
       グループ別の丸め済み値を足すと、年次の分け方で合計が動く。
       丸める前の値で合算し、表示のために最後だけ丸める。 */
    const saveKwh = Math.round(r.groups.reduce((a, g) => a + g.saveKwhPerYearExact, 0));
    const preferred = preferredSubsidyId
      ? r.matched.find((s) => s.id === preferredSubsidyId && !s.infoOnly)
      : undefined;
    const subsidyName = (preferred ?? r.matched.find((s) => !s.infoOnly))?.name || "（この設備量では対象制度なし・要確認）";
    // カテゴリ(設備群)別に投資を按分し、ROI・損益分岐を算出
    const gw = yg.map((g) => Math.max(1, g.units) * (g.hp && g.hp > 0 ? g.hp : 1));
    const gwSum = gw.reduce((a, b) => a + b, 0) || 1;
    const categories: RoadmapCategory[] = r.groups.map((gr, gi) => {
      const investManYen = Math.round(subInput.invest * (gw[gi] / gwSum));
      // 2026-09-11 EHC-0038 P0-10: 回収年数・利回りの計算は丸める前の削減額から。
      const saveYen = gr.saveYenPerYearExact;
      const paybackYears = saveYen > 0 ? Number(((investManYen * 10000) / saveYen).toFixed(1)) : null;
      const roiPct = investManYen > 0 ? Math.round((saveYen / (investManYen * 10000)) * 100) : 0;
      return {
        label: gr.label,
        refri: gr.refri,
        units: gr.units,
        investManYen,
        saveYenPerYear: gr.saveYenPerYear,
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
