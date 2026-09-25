"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ELECTRIC_PRICE_YEN_PER_KWH, AGE_DEGRADATION_DEFAULT_PER_YEAR,
  OLD_EQUIPMENT_REPAIR_MANYEN_PER_YEAR, ROI_CHART_YEARS,
  ELECTRIC_PRICE_ASOF, ELECTRIC_PRICE_SOURCE,
  ELECTRIC_CONTRACT_LABEL, ELECTRIC_PRICE_DEFAULT_CONTRACT,
  ELECTRIC_PRICE_ESTIMATE_NOTE,
} from "@/lib/pricing";
import {
  SubsidyState, RoiSeriesDef, roiSeriesFor,
  SUBSIDY_STATE_NOTE, INVEST_UNKNOWN_LABEL, resolveInvestState,
} from "@/lib/roiState";

interface RoiChartProps {
  invest: number;
  bestSubsidyManYen: number;
  /* 2026-09-10 EHC-0031 F02:
     補助額は「未確認」「算定0円」「正額」の3状態がある。
     bestSubsidyManYen が 0 という数値だけでは、未確認なのか
     算定して0円だったのかが区別できず、緑線を描くべきか判断できない。
     呼び出し側（画面・PDF）は lib/roiState.ts の buildRoiSnapshot が
     決めた同じ状態をここへ渡す。グラフ側で再判定しない（F03）。
     未指定時は従来互換で、正額なら positive・0なら unconfirmed とみなす。 */
  subsidyState?: SubsidyState;
  saveYenPerYear: number;
  kwhPerYear: number;
  reductionRate?: number;
  /** 電力単価(円/kWh)。未指定時は lib/pricing.ts の共通定数（マッチング試算と同一）を使う */
  electricPrice?: number;
  /** 老朽機を使い続けた場合の年間修理・メンテ増分(万円/年)。
      保守契約額・修理履歴で実額が判明した案件でのみ渡す。
      未指定なら 0（出典の無い金額で「何もしない」を不利に見せない）。 */
  repairCostManYenPerYear?: number;
  /** 旧機を使い続けた場合の年あたり電力増分（経年劣化）。
      2026-09-10 EHC-0038 P0-3:
      以前はここが常に共通定数 0.02 で、15年後の「何もしない」線が
      黙って 1.30倍に膨らんでいた。出典が特定できていない係数なので、
      既定は 0（未計上）とし、実測の効率低下が判明した案件でのみ実値を渡す。
      0 は「劣化しない」という主張ではない（画面には「未計上」と書く）。 */
  degradationPerYear?: number;
  /* 2026-09-08 EHC-0028:
     印刷専用シートは画面上 display:none の中に置かれるため、
     ResponsiveContainer が幅0を測ってグラフが消える。
     紙のときは実寸(px)を渡して LineChart を直接描く。
     縮小 transform は使わない（§6B で禁止）。 */
  printWidth?: number;
  printHeight?: number;
  /** 凡例は紙面では別ブロックに固定するので、内蔵Legendを消せるようにする */
  hideLegend?: boolean;
}

export function RoiChart({ invest, bestSubsidyManYen, subsidyState, saveYenPerYear, kwhPerYear, reductionRate = 0.3, electricPrice, repairCostManYenPerYear, degradationPerYear, printWidth, printHeight, hideLegend = false }: RoiChartProps) {
  const ELECTRIC_PRICE = electricPrice && electricPrice > 0 ? electricPrice : ELECTRIC_PRICE_YEN_PER_KWH;
  const state: SubsidyState = subsidyState ?? (bestSubsidyManYen > 0 ? "positive" : "unconfirmed");
  const series = roiSeriesFor(state);
  const investState = resolveInvestState(invest);
  const priceIsDefault = !(electricPrice && electricPrice > 0);
  /* 2026-09-10 EHC-0038 P0-3:
     経年劣化は既定で未計上（0）。渡されたときだけ加算する。
     修理費（OLD_EQUIPMENT_REPAIR_MANYEN_PER_YEAR）を既定0にしたのと同じ扱いで、
     出典の無い係数で「何もしない」を不利に見せない。 */
  const OLD_EQUIPMENT_DEGRADATION_PER_YEAR =
    degradationPerYear != null && Number.isFinite(degradationPerYear) && degradationPerYear > 0
      ? degradationPerYear
      : AGE_DEGRADATION_DEFAULT_PER_YEAR;
  const REPAIR_COST_PER_YEAR =
    repairCostManYenPerYear && repairCostManYenPerYear > 0
      ? repairCostManYenPerYear
      : OLD_EQUIPMENT_REPAIR_MANYEN_PER_YEAR;
  // 業種別の想定削減率を反映（更新後の電力＝旧×(1−削減率)）。未指定時は従来通り30%。
  const newPowerFactor = Math.max(0, Math.min(1, 1 - reductionRate));

  const years = ROI_CHART_YEARS;
  /* 未確認・算定0円のときは補助金を差し引かない。
     0 を引くのではなく「引く対象が無い」ものとして扱う。 */
  const subsidyForChart = state === "positive" ? Math.max(0, bestSubsidyManYen) : 0;
  const data: Record<string, string | number>[] = [];

  for (let y = 0; y <= years; y++) {
    const oldCost =
      kwhPerYear * ELECTRIC_PRICE * y * (1 + OLD_EQUIPMENT_DEGRADATION_PER_YEAR * y) / 10000 +
      REPAIR_COST_PER_YEAR * y;

    const newCostWithSubsidy =
      (invest - subsidyForChart) + (kwhPerYear * newPowerFactor * ELECTRIC_PRICE * y) / 10000;

    const newCostNoSubsidy = invest + (kwhPerYear * newPowerFactor * ELECTRIC_PRICE * y) / 10000;

    const row: Record<string, string | number> = {
      year: `${y}年`,
      "何もしない（旧機器維持）": Math.round(oldCost),
      "更新（補助金なし）": Math.round(newCostNoSubsidy),
    };
    // 緑線は正額のときだけ持たせる（0円の補助を引いた線を「補助金あり」と呼ばない）
    if (state === "positive") row["更新（補助金あり）"] = Math.round(newCostWithSubsidy);
    data.push(row);
  }

  const formatYen = (val: number) => `¥${(val * 10000).toLocaleString("ja-JP")}`;

  const forPrint = !!(printWidth && printWidth > 0);
  const chartWidth = printWidth ?? 0;
  const chartHeight = printHeight && printHeight > 0 ? printHeight : 280;

  /* 2026-08-24 監査: 計算に使った前提と出典を、グラフと同じ場所に必ず出す。
     前提が見えないグラフは、後から「その単価はどこから来たのか」と問われた時に守れない。
     2026-09-08 EHC-0028: 紙面でもこの一文をグラフと同じページに置くため、
     画面用と印刷用で同じノードを共有する（文言を二重管理しない）。 */
  /* 2026-09-10 EHC-0038 P0-5:
     既定単価は「実勢」ではなく【推計】である。
     22.78円/kWh は販売収入÷販売電力量の平均販売単価で、契約kWに対する基本料金を含む。
     基本料金は使用量を減らしても減らないので、削減kWhに掛けると上振れする。
     「実勢＋再エネ賦課金」という書き方は、その案件で実際に回避できる従量単価に読めてしまう。
     入力値のときは実額なのでこの注記は出さない（priceIsDefault で分岐）。 */
  const assumptionText = (
    <>
      電力単価 {ELECTRIC_PRICE.toLocaleString("ja-JP")}円/kWh
      {priceIsDefault ? `（推計・${ELECTRIC_CONTRACT_LABEL[ELECTRIC_PRICE_DEFAULT_CONTRACT]}の平均販売単価＋再エネ賦課金／${ELECTRIC_PRICE_ASOF}）` : "（入力値）"}
      ／経年劣化{" "}
      {OLD_EQUIPMENT_DEGRADATION_PER_YEAR > 0
        ? `年${Math.round(OLD_EQUIPMENT_DEGRADATION_PER_YEAR * 1000) / 10}%（入力値）`
        : "未計上（旧機の効率低下は加算していません。実測値が判明するまで、劣化しない前提でも劣化する前提でもなく、この比較には織り込みません）"}
      ／修理・メンテ増分{" "}
      {REPAIR_COST_PER_YEAR > 0
        ? `${REPAIR_COST_PER_YEAR.toLocaleString("ja-JP")}万円/年（入力値）`
        : "未計上（保守契約額が判明するまで加算しません）"}
      。
      {priceIsDefault && <>{ELECTRIC_PRICE_ESTIMATE_NOTE}出典: {ELECTRIC_PRICE_SOURCE}。</>}
    </>
  );

  /* 系列・色・線幅は画面と紙で同一にする。
     紙ではアニメーションを切らないと、印刷時点で線が描き切れていないことがある。 */
  const chartBody = (
    <LineChart
      data={data}
      {...(forPrint ? { width: chartWidth, height: chartHeight } : {})}
      margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
    >
      {/* 2026-09-11 EHC-0038 第2便 4-C
          軸・格子・ツールチップの色が slate 系（#e2e8f0 / #64748b / #94a3b8）で、
          HomeV17 の紙面（罫線 #d4ddd4・弱い文字 #57685e）と別の系統だった。
          青みのある灰色を緑みのある紙の上に置くと、グラフだけ色温度が違って浮く。
          グラフの補助線・目盛は本文と同じトークンに揃える。
          目盛の #57685e は白地でコントラスト 5.920（4.5以上）で、
          12px でも読める。#94a3b8 は 2.5 前後で足りていなかった。 */}
      <CartesianGrid strokeDasharray="3 3" stroke="#d4ddd4" />
      {/* 2026-09-10 EHC-0031 F04: 軸目盛は12px以上。
          11pxのままだと、印刷時の縮尺で実寸9pt を下回り読めなくなる。
          文字を小さくして収める対応は §6B で禁止されているため、
          収まらない場合はグラフの高さ・余白側で調整する。 */}
      <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#57685e" }} stroke="#d4ddd4" />
      <YAxis
        tick={{ fontSize: 12, fill: "#57685e" }}
        stroke="#d4ddd4"
        tickFormatter={(v) => `${v}万`}
        width={58}
      />
      {!forPrint && (
        <Tooltip
          formatter={(v: number) => formatYen(v)}
          contentStyle={{
            background: "#fff",
            border: "1px solid #d4ddd4",
            borderRadius: "12px",
            fontSize: "12px",
            color: "#193e33",
          }}
        />
      )}
      {!hideLegend && <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "#193e33" }} />}
      <ReferenceLine y={0} stroke="#57685e" />
      {/* 描く線は lib/roiState.ts の roiSeriesFor が返した系列だけ。
          凡例（画面・PDF・提案書）も同じ配列を読むので、線が無いのに
          凡例だけ「補助金あり」が残る状態が構造的に起きない。 */}
      {series.map((s) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          stroke={s.color}
          strokeWidth={s.strokeWidth}
          /* 2026-09-11 EHC-0038 第2便 4-C:
             線種も roiSeriesFor が持つ。白黒印刷・色覚型によって
             色が読めない場合でも、線種と太さで3本を区別できる。 */
          strokeDasharray={s.dash}
          dot={{ r: s.dotRadius }}
          isAnimationActive={!forPrint}
        />
      ))}
    </LineChart>
  );

  /* 2026-09-10 EHC-0031 F01:
     設備投資額が未算定（空欄・0・負・非有限）のとき、従来は invest=0 のまま
     線を引いていたため、更新が初期費用0円で始まるグラフになっていた。
     費用が不明なことと0円であることは違うので、グラフは描かず理由を出す。
     グラフの高さは確保して、紙面のレイアウトが崩れないようにする。 */
  const investUnknownNotice = (
    <>
      設備投資額が{INVEST_UNKNOWN_LABEL}のため、費用の比較グラフは表示していません。
      「今回更新分の設備投資概算」に金額を入力するか、更新工事の概算見積を反映すると表示されます。
    </>
  );

  // 補助金の状態は必ず文章でも添える（未確認と0円を金額欄だけで区別させない）
  const stateNote = SUBSIDY_STATE_NOTE[state];

  if (forPrint) {
    return (
      <div style={{ width: chartWidth }}>
        {investState === "known" ? (
          chartBody
        ) : (
          <div
            style={{
              width: chartWidth,
              height: chartHeight,
              border: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4mm",
              textAlign: "center",
            }}
          >
            <p className="pr-note">{investUnknownNotice}</p>
          </div>
        )}
        <p className="pr-note" style={{ marginTop: "2mm" }}>
          {assumptionText}
        </p>
        <p className="pr-note" style={{ marginTop: "1mm" }}>
          補助金: {stateNote}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
    <div className="w-full h-72 md:h-80">
      {investState === "known" ? (
        <ResponsiveContainer width="100%" height="100%">
          {chartBody}
        </ResponsiveContainer>
      ) : (
        /* 2026-09-11 EHC-0038 第2便 4-D:
           暗色時代は「黒地に5%の橙＋amber-200の文字」だった。
           白地では塗りが消え、amber-200(#fde68a) の文字はコントラスト1.6で読めない。
           塗り(amber-50)＋濃い文字(amber-900)へ反転させる。
           グラフが出ない理由は、この画面で最も読ませたい一文である。 */
        <div className="w-full h-full flex items-center justify-center rounded-xl border border-amber-500/40 bg-amber-50 px-4">
          <p className="text-xs text-amber-900 leading-relaxed text-center">{investUnknownNotice}</p>
        </div>
      )}
    </div>
      <p className="text-xs text-ink-soft mt-2 leading-relaxed">{assumptionText}</p>
      <p className="text-xs text-ink-soft mt-1 leading-relaxed">補助金: {stateNote}</p>
    </div>
  );
}

/** グラフの凡例。画面・PDF・提案書はこれを使う（色と文言を一元化）。
    子要素は div。印刷用CSS `.pr-legend div` が枠線を当てるため、
    紙と画面で同じDOM構造にしておく（紙だけ別実装にしない）。
    レイアウト（grid / flex）は呼び出し側の className に任せる。 */
export function RoiChartLegend({
  subsidyState,
  className = "",
}: {
  subsidyState: SubsidyState;
  className?: string;
}) {
  const series: RoiSeriesDef[] = roiSeriesFor(subsidyState);
  /* 2026-09-11 EHC-0038 第2便 4-C:
     線に線種を入れたので、凡例の見本も実線のままにはできない。
     見本が実線なのに図の線が破線だと、どの線の説明なのか対応が取れない。
     破線の見本は repeating-linear-gradient で作る（背景なので、
     印刷時に背景を落とす設定でも globals.css の .pr-swatch 側で
     幅・高さが残り、形は保たれる）。
     dash 文字列の第1数値＝線分長、第2数値＝空き。同じ比率で見本にする。 */
  const swatchBackground = (s: RoiSeriesDef) => {
    if (!s.dash) return s.color;
    const [on, off] = s.dash.split(/\s+/).map((n) => Number(n));
    if (!Number.isFinite(on) || !Number.isFinite(off) || on <= 0 || off <= 0) return s.color;
    return `repeating-linear-gradient(to right, ${s.color} 0 ${on}px, transparent ${on}px ${on + off}px)`;
  };
  return (
    <div className={className}>
      {series.map((s) => (
        <div key={s.key}>
          <span
            aria-hidden
            className="pr-swatch"
            style={{ display: "inline-block", width: "14px", height: "3px", background: swatchBackground(s), borderRadius: "2px", marginRight: "6px", verticalAlign: "middle" }}
          />
          <span>
            {s.colorName}：{s.key}
            {s.best ? "（ベスト）" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
