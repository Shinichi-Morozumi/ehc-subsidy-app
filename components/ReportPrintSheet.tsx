"use client";

/* ══════════════════════════════════════════════════════════════════
   お客様向け補助金・省エネ診断書 ── 印刷専用シート
   v1 / 2026-09-08 / EHC-0028（NEO差し戻し「結論の追い出し・制度カードの分断・
   QRの別ページ送り・黒枠」への対応）

   これまでは画面用の診断書DOM（CustomerReport の .report-sheet）を
   そのまま紙へ流していたため、A4の高さを前提にできず、
     ・結論が次ページへ押し出される
     ・制度カードが途中で切れる
     ・案内文とQRが別ページに分かれる
   が起きていた。紙面は画面と別に組む。

   守っている拘束条件（EHC-0028 §6）:
     - 判定・金額は画面と同じスナップショット（assessments / result / diagnosis）を
       受け取るだけ。ここでは制度の再判定も補助額の再計算もしない。
     - 固定高さ＋overflow:hidden での切り捨て、全体 transform 縮小、
       印刷倍率を下げて収める、はいずれも使わない。収まらなければ次ページへ流す。
     - 文字サイズは globals.css の .print-report 側で下限
       （本文10.5pt / 表10pt / 注記9pt）を持つ。ここでTailwindの文字サイズを使わない。
     - 社外秘表示は各ページの走りフッタに置き、数値・グラフ・QRへ重ねない。
     - 問い合わせ文＋問い合わせ先＋診断書番号＋QRは同じブロック（.pr-contact）。

   構成: 本文 ＋ 制度別の別紙。本文の枚数は入力によって変わる（固定6ページをやめた）。
     1  今回の診断・結論
     2..  制度の条件と準備（1ページ4制度の表。制度数で増える）
     ..  費用とシミュレーション
     ..  設備条件・課題と対策
     ..  提案（更新理由・推奨プラン・サポート報酬）
     ..  実績（導入実績・近い事例・実証データ）
     ..  次に確認すること（1ページ14件。件数で増える）
     ..  お手続きの進め方・ご相談先（QRは案内文と同じブロック）
     ..  費用条件・免責／取り扱い条項
     別紙  A→B→C の順。1ページ1制度。
   ページ番号は本文と別紙を通した「n / 総ページ」。本文中の「p.X」参照は
   下の P_* 定数から算出するので、ページが増減しても食い違わない。

   v2 / 2026-09-08 の変更（EHC-0028 C06 / 紙面が割れる不具合の是正）:
     A4（余白1.2cm）の1ページに入る高さは実測 1032px。これを超えたセクションを
     Chrome が物理2ページへ割っていたため「DOM 11枚 / PDF 21ページ」になっていた。
     是正は「1ページあたりの中身を減らし、足りなければページを足す」のみで行う。
     文字を縮める／固定高さ＋overflow:hidden で切る／transform で縮小する／
     印刷倍率を下げる、はいずれも使っていない（§6B）。
   ══════════════════════════════════════════════════════════════════ */

import { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MatchInput, Subsidy, INTEREST_LABELS } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { buildDiagnosisDetails } from "@/lib/diagnosis";
import { ProgramAssessment } from "./ProgramMatchBoard";
import { RoiChart, RoiChartLegend } from "./RoiChart";
import {
  SubsidyState, SUBSIDY_STATE_NOTE, INVEST_UNKNOWN_LABEL, resolveInvestState, yearsOrUnknown,
} from "@/lib/roiState";
import { STEPS } from "./NextSteps";
import { BUILDING_LABELS, REFRI_LABELS } from "@/lib/labels";
import { INDUSTRY_PROFILES } from "@/lib/industries";
import { PROVISIONAL_COEFFICIENT_NOTE } from "@/lib/coefficients";
import { SUBSIDY_DATA_ASOF } from "@/lib/subsidies";
import { PREP_DISCLAIMER, effortLabel, prepLeadLabel } from "@/lib/prep";
import {
  ACHIEVEMENT_STATS,
  findMatchedAchievements,
  AKITA_RICE_WAREHOUSE,
  EHC_FIELD_TEST_2026,
} from "@/lib/achievements";

/* A4縦・左右余白12mm → 使用幅186mm。
   96dpi 換算で 186mm ≒ 703px。グラフはこの実寸で描く（縮小しない）。 */
const CONTENT_WIDTH_PX = 700;
const CHART_HEIGHT_PX = 300;

/* 1ページに載せる件数。実測（A4余白1.2cm で 1ページ＝1032px）に対して
   余裕を見た値。ここを増やすと紙面が割れるので、増やすときは必ず再計測する。 */
const CONDITION_ROWS_PER_PAGE = 4; // 本文「制度の条件と準備」の表の行数
const CHECKS_PER_PAGE = 14; // 本文「次に確認すること」の箇条書き件数

const BUCKET_LABEL: Record<ProgramAssessment["bucket"], string> = {
  A: "いま申請可能性がある",
  B: "条件確認で候補になる",
  C: "今回は対象外・受付終了",
};

function statusLabel(s: Subsidy) {
  if (s.status === "open") return "受付中";
  if (s.status === "upcoming") return "受付予定";
  if (s.status === "closed") return "受付終了";
  return "次回公募・受付時期を確認";
}

function checkedLabel(value?: string) {
  if (!value) return "未確認";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Subsidy.target は EquipType[]。そのまま出すと配列が連結されるので日本語に直す。 */
function equipTargetLabel(target: Subsidy["target"]) {
  if (!target || target.length === 0) return "要確認";
  return target.map((t) => (t === "multi" ? "ビル用マルチ" : "パッケージエアコン")).join("・");
}

function verificationLabel(s: Subsidy) {
  if (s.verificationState === "verified") return "公式情報を確認済み";
  if (s.verificationState === "needs_review") return "公式ページに更新の可能性あり（再確認が必要）";
  if (s.verificationState === "unavailable") return "公式ページを取得できていません";
  return "取得状態は要確認";
}

export interface ReportPrintSheetProps {
  input: MatchInput;
  result: MatchResult;
  /** 画面の制度マッチングと同一の判定結果。印刷側では作り直さない。 */
  assessments: ProgramAssessment[];
  /** 更新監視の最終確認時刻（画面と同じもの） */
  monitorCheckedAt: string | null;
  proposalNo: string;
  /** 発行日（画面ヘッダと同じ文字列） */
  today: string;
  issuedYear: number;
  /** 要件チェック後に確定した補助額（万円）。未確定なら0。 */
  displaySubsidyManYen: number;
  /* 2026-09-10 EHC-0031 F03:
     補助額の状態（未確認 / 算定0円 / 算定済み）は画面側の判定をそのまま受け取る。
     金額の正負から紙側で作り直すと、画面と紙が違うことを言い始める。
     未指定時は従来互換。 */
  subsidyState?: SubsidyState;
  appliedSubsidy?: Subsidy | null;
  /** QR用の短いmailto（本文なし）。画面と同じ値を受け取る。 */
  inquiryMailtoShort: string;
}

export function ReportPrintSheet({
  input,
  result,
  assessments,
  monitorCheckedAt,
  proposalNo,
  today,
  issuedYear,
  displaySubsidyManYen,
  subsidyState,
  appliedSubsidy,
  inquiryMailtoShort,
}: ReportPrintSheetProps) {
  const details = buildDiagnosisDetails(input, result);
  const industryLabel = (INDUSTRY_PROFILES[input.building] ?? INDUSTRY_PROFILES.other).label;
  const interestLabel = input.interest ? INTEREST_LABELS[input.interest] : null;
  const sheetSubsidyState: SubsidyState = subsidyState ?? (displaySubsidyManYen > 0 ? "positive" : "unconfirmed");
  /* F01: 設備投資額が未算定（空欄→0）のとき「0 万円」と印刷しない */
  const sheetInvestState = resolveInvestState(input.invest);
  const displaySubsidyYen = Math.round(displaySubsidyManYen * 10000);
  const rewardYen = Math.round(displaySubsidyManYen * 10000 * 0.1);

  const active = assessments.filter((a) => a.bucket === "A");
  const conditional = assessments.filter((a) => a.bucket === "B");
  const rejected = assessments.filter((a) => a.bucket === "C");

  /* 結論の文言は画面（ProgramMatchBoard）と同じ。判定はし直さない。 */
  const conclusion = active.length
    ? {
        label: "候補制度あり（条件診断へ）",
        reason:
          "所在地・事業規模・設備種別の基本条件とは矛盾しません。発注状況・指定機器・必要書類を確認すると該当見込みを絞れます。",
      }
    : conditional.length
      ? { label: "条件確認が必要", reason: conditional[0].reason }
      : {
          label: "今回は対象外",
          reason: assessments[0]?.reason ?? "現在の入力条件で候補を確認できませんでした。",
        };

  /* ── ページ割り（決定論的にパックする）────────────────────
     v1 は本文6ページ固定・別紙1ページ2〜3制度だったが、実測すると
       本文2  2143px（A/Bの制度カード6枚）
       本文5  1388px
       本文6  1532px
       別紙   1ページ2制度で1100px超
     と 1032px を超えており、Chrome が物理ページを割っていた。
     v2 は「1ページの中身を減らして枚数で吸収する」方針に統一する。
     制度が0件なら別紙は作らない（空白ページを作らない）。 */
  const annexAB = [...active, ...conditional];

  /* 本文「制度の条件と準備」は 1ページ CONDITION_ROWS_PER_PAGE 制度の表。
     A・Bが0件でも「該当なし」を伝えるページは1枚必要なので空チャンクを置く。 */
  const conditionChunks: ProgramAssessment[][] = [];
  for (let i = 0; i < annexAB.length; i += CONDITION_ROWS_PER_PAGE)
    conditionChunks.push(annexAB.slice(i, i + CONDITION_ROWS_PER_PAGE));
  if (conditionChunks.length === 0) conditionChunks.push([]);

  /* 本文「次に確認すること」は件数が入力で変わる（案件により10件前後〜）。 */
  const checkChunks: string[][] = [];
  for (let i = 0; i < details.nextChecks.length; i += CHECKS_PER_PAGE)
    checkChunks.push(details.nextChecks.slice(i, i + CHECKS_PER_PAGE));
  if (checkChunks.length === 0) checkChunks.push([]);

  /* 別紙は1ページ1制度。A→B→C の順。 */
  const annexChunks: ProgramAssessment[][] = [];
  for (const a of annexAB) annexChunks.push([a]);
  for (const a of rejected) annexChunks.push([a]);

  /* 本文の各章が何ページ目に来るか。本文中の「p.X」参照はすべてここから引く。 */
  const P_DIAG = 1;
  const P_COND = P_DIAG + 1;
  const P_COST = P_COND + conditionChunks.length;
  const P_EQUIP = P_COST + 1;
  const P_PLAN = P_EQUIP + 1;
  const P_ACHIEVE = P_PLAN + 1;
  const P_CHECKS = P_ACHIEVE + 1;
  const P_STEPS = P_CHECKS + checkChunks.length;
  const P_TERMS = P_STEPS + 1;
  const bodyPageCount = P_TERMS;

  /* 2026-09-10 EHC-0031 F04:
     走りヘッダの章番号に、上の「ページ番号」P_* をそのまま使っていた。
     章が複数ページに割れるとページ番号が飛ぶため、読み手には
     「第1章 → 第2章 → 第5章」のように章が抜けて見えていた
     （制度が多い案件・確認事項が多い案件ほど酷くなる）。
     章番号は章の通し番号、ページ番号はフッタの物理ページ、
     本文中の「p.X」参照は物理ページ（P_*）と、3つを分けて持つ。 */
  const C_DIAG = 1;
  const C_COND = 2;
  const C_COST = 3;
  const C_EQUIP = 4;
  const C_PLAN = 5;
  const C_ACHIEVE = 6;
  const C_CHECKS = 7;
  const C_STEPS = 8;
  const C_TERMS = 9;

  const annexPageOf = new Map<string, number>();
  annexChunks.forEach((chunk, idx) => {
    chunk.forEach((a) => annexPageOf.set(a.subsidy.id, bodyPageCount + idx + 1));
  });
  const totalPages = bodyPageCount + annexChunks.length;
  const annexRef = (a: ProgramAssessment) => {
    const p = annexPageOf.get(a.subsidy.id);
    return p ? `詳細 p.${p}` : "詳細は別紙未収載";
  };

  /* 本文1に出す主要候補は最大3件。超過分は件数と別紙ページで示す（黙って落とさない）。 */
  const headline = annexAB.slice(0, 3);
  const headlineRest = annexAB.slice(3);

  const matchedAchievements = findMatchedAchievements(input.building, result.representativeEquip);

  const pages: { chapter: string; body: ReactNode }[] = [];

  /* ══ 本文1 今回の診断・結論 ══════════════════════════════ */
  pages.push({
    chapter: `${C_DIAG}. 今回の診断・結論`,
    body: (
      <>
        <div className="pr-keep" style={{ marginBottom: "4mm" }}>
          <p className="pr-note" style={{ margin: 0 }}>業務用空調 補助金・省エネ診断書</p>
          <h1>
            {input.customerCompany || "お客様"} {input.customerKind === "individual" ? "様" : "御中"}
          </h1>
          <p className="pr-note" style={{ margin: 0 }}>
            発行日 {today} ／ 診断書番号 {proposalNo}
            {input.customerContact ? ` ／ ご担当 ${input.customerContact} 様` : ""}
          </p>
          {(input.customerAddress || input.customerPhone || input.customerEmail) && (
            <p className="pr-note" style={{ margin: 0 }}>
              {[input.customerAddress, input.customerPhone ? `TEL: ${input.customerPhone}` : "", input.customerEmail]
                .filter(Boolean)
                .join(" ／ ")}
            </p>
          )}
        </div>

        <div className="pr-sec pr-keep">
          <div className="pr-box-em">
            <div className="pr-h3">補助金を使える可能性：{conclusion.label}</div>
            <p style={{ margin: 0 }}>{conclusion.reason}</p>
          </div>
        </div>

        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">確認した制度の内訳（全{assessments.length}件）</h2>
          <div className="pr-kpi">
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">A：いま申請可能性がある</span>
              <span className="pr-kpi-value">{active.length} 件</span>
              <span className="pr-kpi-sub">公式情報を確認済みで、入力条件と明確な矛盾がない制度</span>
            </div>
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">B：条件確認で候補になる</span>
              <span className="pr-kpi-value">{conditional.length} 件</span>
              <span className="pr-kpi-sub">受付予定・要件不足・関連助成金など、追加確認が必要な制度</span>
            </div>
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">C：今回は対象外・受付終了</span>
              <span className="pr-kpi-value">{rejected.length} 件</span>
              <span className="pr-kpi-sub">対象外の理由、または終了した受付回を別紙に記載</span>
            </div>
          </div>
          <p className="pr-note" style={{ marginTop: "2mm" }}>
            A・B・Cは資格の確定でも採択見込みでもありません。制度データ基準日 {SUBSIDY_DATA_ASOF}。
            {monitorCheckedAt
              ? ` 公式ページ更新確認：${new Date(monitorCheckedAt).toLocaleString("ja-JP")}。`
              : " 公式ページの更新有無は未確認です。"}
          </p>
        </div>

        <div className="pr-sec">
          <h2 className="pr-h2">主要候補と受付期限</h2>
          {headline.length ? (
            <table>
              <thead>
                <tr>
                  <th>制度名</th>
                  <th>区分</th>
                  <th>受付状態・期限</th>
                  <th>別紙</th>
                </tr>
              </thead>
              <tbody>
                {headline.map((a) => (
                  <tr key={a.subsidy.id}>
                    <td>{a.subsidy.name}</td>
                    <td>{a.bucket}</td>
                    <td>{a.timing}</td>
                    <td>{annexRef(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>現在の入力条件では、受付中・受付予定の候補制度を確認できませんでした。</p>
          )}
          {headlineRest.length > 0 && (
            <p className="pr-note" style={{ marginTop: "1.6mm" }}>
              上記のほかに候補が{headlineRest.length}件あります（
              {headlineRest.map((a) => `${a.subsidy.name}：${annexRef(a)}`).join(" ／ ")}）。
            </p>
          )}
        </div>

        <div className="pr-sec pr-keep">
          <p className="pr-note" style={{ margin: 0 }}>
            【この診断書の構成】制度ごとの条件・不足情報・次の行動 p.{P_COND}
            {conditionChunks.length > 1 ? `–${P_COND + conditionChunks.length - 1}` : ""} ／ 費用シミュレーション p.{P_COST} ／
            対象設備 p.{P_EQUIP} ／ ご確認事項（全{details.nextChecks.length}件） p.{P_CHECKS}
            {checkChunks.length > 1 ? `–${P_CHECKS + checkChunks.length - 1}` : ""} ／ ご相談先・QR p.{P_STEPS} ／
            制度の根拠全文（1ページ1制度） p.{bodyPageCount + 1} 以降の別紙。
          </p>
        </div>
      </>
    ),
  });

  /* ══ 本文 制度の条件と準備 ════════════════════════════════
     v1 は1制度＝1カード（8行のdl）で6制度を1ページに積んでいたため
     実測 2143px となり、A4を2枚以上に割っていた。
     v2 は1制度＝表1行に畳み、1ページ CONDITION_ROWS_PER_PAGE 件で改ページする。
     表から落とした「準備の目安・手間」「使い道（対象経費）」は
     別紙の制度カードへ移してあり、情報そのものは失っていない。 */
  conditionChunks.forEach((chunk, idx) => {
    const first = idx === 0;
    pages.push({
      chapter: `${C_COND}. 制度の条件と準備${conditionChunks.length > 1 ? `（${idx + 1}/${conditionChunks.length}）` : ""}`,
      body: (
        <>
          <h2 className="pr-h2">
            候補となる制度の条件・不足情報・次の行動
            {conditionChunks.length > 1 ? `（${idx * CONDITION_ROWS_PER_PAGE + 1}〜${idx * CONDITION_ROWS_PER_PAGE + chunk.length}件目／全${annexAB.length}件）` : ""}
          </h2>
          {first && (
            <p className="pr-note" style={{ marginBottom: "3mm" }}>
              A（いま申請可能性がある）→ B（条件確認で候補になる）の順です。各制度の全文根拠・補助率・上限・準備の目安・対象経費・公式URLは
              p.{bodyPageCount + 1} 以降の別紙に1ページ1制度で記載しています。
              対象外・受付終了（C {rejected.length}件）も同じ別紙で理由を確認できます。
            </p>
          )}

          {chunk.length ? (
            <>
              <table className="pr-table-fixed">
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>区分・制度名</th>
                    <th>受付状態・期限</th>
                    <th>不足している条件</th>
                    <th>次の行動</th>
                    <th>別紙</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((a) => {
                    const cand = details.candidates.find((c) => c.subsidy.id === a.subsidy.id);
                    const pend = details.pending.find((p) => p.subsidy.id === a.subsidy.id);
                    const missing = cand ? [] : (pend?.missing ?? a.missing);
                    return (
                      <tr key={a.subsidy.id}>
                        <td>
                          <span className={a.bucket === "A" ? "pr-badge" : "pr-badge pr-badge-b"}>{a.bucket}</span>
                          {a.subsidy.name}
                          {a.coverageGap ? "※" : ""}
                        </td>
                        <td>
                          {statusLabel(a.subsidy)}／{a.timing}
                        </td>
                        <td>
                          {missing.length
                            ? missing.join("／")
                            : "現時点で追加確認の指摘はありません（公募要領での最終確認は必要です）。"}
                        </td>
                        <td>{a.nextAction}</td>
                        <td>{annexRef(a)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {chunk.some((a) => a.coverageGap) && (
                <p className="pr-note" style={{ marginTop: "1.6mm" }}>
                  ※印の制度は公式ポータルのトップページしか監視できていません。改定は自動検知されないため、申請前に公募要領を直接ご確認ください。
                </p>
              )}
            </>
          ) : (
            <div className="pr-box-warn">
              <p style={{ margin: 0 }}>
                現在の入力条件では、A・Bに該当する制度がありません。対象外・受付終了と判定した{rejected.length}件の理由は別紙に記載しています。
                条件（所在地・事業規模・発注時期・雇用保険の適用状況など）が変われば判定も変わります。
              </p>
            </div>
          )}

          {first && (
            <div className="pr-sec pr-keep">
              {/* 2026-09-10 EHC-0031 F02/F03:
                  判定は金額の正負ではなく、画面から受け取った状態で行う。
                  「算定して0円」と「まだ算定していない」を同じ文章で説明しない。 */}
              <div className={sheetSubsidyState === "positive" ? "pr-box" : "pr-box-warn"}>
                <div className="pr-h3">補助金額の試算可否</div>
                {sheetSubsidyState === "positive" ? (
                  <p style={{ margin: 0 }}>
                    要件チェック後に選択された制度{appliedSubsidy ? `（${appliedSubsidy.name}）` : ""}に基づき、
                    補助額概算 {displaySubsidyManYen.toLocaleString("ja-JP")}万円 で試算しています（p.{P_COST}）。
                    採択・受給・補助額を保証するものではありません。
                  </p>
                ) : sheetSubsidyState === "zero" ? (
                  <p style={{ margin: 0 }}>
                    補助金は0円（自己負担）で試算しています。金額が0円であることは、この設備が補助対象外であることを意味しません。
                    制度を適用する場合は、上表の条件を確認したうえで改めて算定します。
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    現時点では補助額の根拠として使える制度が確定していないため、補助金は未反映で試算しています。
                    「0円と判定した」のではなく「算定する根拠がまだ無い」状態です。上表の「不足している条件」が埋まった時点で改めて算定します。
                  </p>
                )}
              </div>
            </div>
          )}

          {idx === conditionChunks.length - 1 && <p className="pr-note">{PREP_DISCLAIMER}</p>}
        </>
      ),
    });
  });

  /* ══ 本文3 費用とシミュレーション ═════════════════════════ */
  pages.push({
    chapter: `${C_COST}. 費用とシミュレーション`,
    body: (
      <>
        <h2 className="pr-h2">ご提案サマリー</h2>
        <div className="pr-kpi pr-keep">
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">想定補助金額</span>
            {/* F02: 未確認を ¥0 と印刷しない */}
            <span className="pr-kpi-value">
              {sheetSubsidyState === "unconfirmed" ? "未確認" : `¥${displaySubsidyYen.toLocaleString("ja-JP")}`}
            </span>
            <span className="pr-kpi-sub">
              {sheetSubsidyState === "positive"
                ? "要件チェック後に選択した制度による概算"
                : sheetSubsidyState === "zero"
                  ? "補助金なし（自己負担）で試算"
                  : "根拠となる制度が未確定のため未算定"}
            </span>
          </div>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">回収年数(補助金適用前・税抜)</span>
            <span className="pr-kpi-value">{yearsOrUnknown(result.yearsToRecover)}</span>
            <span className="pr-kpi-sub">
              {result.yearsToRecover !== null
                ? "税抜の工事費 ÷ 年間電気代削減額"
                : sheetInvestState === "known"
                  ? "年間削減額が0円以下のため算定できません"
                  : "設備投資額が見積前のため算定できません"}
            </span>
          </div>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">年間電気代削減</span>
            <span className="pr-kpi-value">¥{result.saveYenPerYear.toLocaleString("ja-JP")}</span>
            <span className="pr-kpi-sub">実効削減率 {(result.effectiveReductionRate * 100).toFixed(0)}% による概算</span>
          </div>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">15年累計削減</span>
            <span className="pr-kpi-value">¥{result.total15YearsYen.toLocaleString("ja-JP")}</span>
            <span className="pr-kpi-sub">下グラフと同じ前提での累計</span>
          </div>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">CO₂削減／年</span>
            <span className="pr-kpi-value">{result.co2ReductionTon} t</span>
            <span className="pr-kpi-sub">削減電力量に排出係数を乗じた概算</span>
          </div>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">今回更新分の設備投資概算</span>
            {/* F01: 未入力（空欄→0）を「0 万円」と印刷しない */}
            <span className="pr-kpi-value">
              {sheetInvestState === "known" ? `${input.invest.toLocaleString("ja-JP")} 万円` : INVEST_UNKNOWN_LABEL}
            </span>
            <span className="pr-kpi-sub">
              {sheetInvestState === "known" ? "ヒアリング値。正式見積は現地調査後" : "見積前。0円という意味ではありません"}
            </span>
          </div>
        </div>

        <p className="pr-note" style={{ marginTop: "2mm" }}>
          {industryLabel}は冷媒設備が電力の多くを占め、設置年・冷媒世代に応じた経年劣化も加味すると、
          高効率化＋経年回復で全体の実効削減率 {(result.effectiveReductionRate * 100).toFixed(0)}% で試算しています。
        </p>
        {!result.coefficientAudit.allSourced && (
          <div className="pr-box-warn pr-keep" style={{ marginTop: "2mm" }}>
            <p style={{ margin: 0 }}>
              <strong>削減率は暫定値です。</strong>
              {PROVISIONAL_COEFFICIENT_NOTE}
            </p>
          </div>
        )}

        <div className="pr-sec pr-chart" style={{ marginTop: "5mm" }}>
          <h2 className="pr-h2">15年累計コスト 比較シミュレーション</h2>
          <RoiChart
            invest={input.invest}
            bestSubsidyManYen={displaySubsidyManYen}
            subsidyState={sheetSubsidyState}
            saveYenPerYear={result.saveYenPerYear}
            kwhPerYear={result.totalKwh || input.kwh}
            reductionRate={result.effectiveReductionRate}
            printWidth={CONTENT_WIDTH_PX}
            printHeight={CHART_HEIGHT_PX}
            hideLegend
          />
          {/* 2026-09-10 EHC-0031 F02:
              凡例を紙面で手書きしていたため、緑線が描かれない状態でも
              「緑線：更新（補助金あり）」が客先の書面に残っていた。
              描く線と凡例を roiSeriesFor() 一箇所から出す。 */}
          <RoiChartLegend subsidyState={sheetSubsidyState} className="pr-legend" />
          <p className="pr-note" style={{ marginTop: "2mm" }}>
            基準ケースは「補助金なし」です。
            {sheetSubsidyState === "positive" ? (
              <>
                「補助金あり」は
                {appliedSubsidy ? `「${appliedSubsidy.name}」の要件を満たした場合` : "補助金が適用できた場合"}
                の条件付きケースで、採択・受給・補助額を保証するものではありません。
              </>
            ) : (
              <>{SUBSIDY_STATE_NOTE[sheetSubsidyState]}そのため「補助金あり」の線は描いていません。</>
            )}
            併用可否は各制度の公募要領によるため、複数制度の合算額は出していません。金額は税抜、補助額は千円未満切捨てです。
          </p>
        </div>
      </>
    ),
  });

  /* ══ 本文4 設備条件・課題と対策 ═══════════════════════════ */
  pages.push({
    chapter: `${C_EQUIP}. 設備条件・課題と対策`,
    body: (
      <>
        <h2 className="pr-h2">ご確認条件（ヒアリング内容）</h2>
        <div className={interestLabel ? "pr-kpi pr-keep" : "pr-kpi pr-kpi-2 pr-keep"}>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">業種・用途</span>
            <span className="pr-kpi-value" style={{ fontSize: "11pt" }}>
              {BUILDING_LABELS[input.building] ?? "—"}
            </span>
            <span className="pr-kpi-sub">{industryLabel}</span>
          </div>
          <div className="pr-kpi-cell">
            <span className="pr-kpi-label">年間電力使用量</span>
            <span className="pr-kpi-value" style={{ fontSize: "11pt" }}>
              {result.totalKwh.toLocaleString("ja-JP")} kWh
            </span>
            <span className="pr-kpi-sub">{input.kwhMode === "measured" ? "実測値" : "総使用量からの自動按分"}</span>
          </div>
          {interestLabel && (
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">ご関心</span>
              <span className="pr-kpi-value" style={{ fontSize: "11pt" }}>{interestLabel}</span>
              <span className="pr-kpi-sub">ヒアリング冒頭でお伺いした内容</span>
            </div>
          )}
        </div>

        <div className="pr-sec" style={{ marginTop: "4mm" }}>
          <h2 className="pr-h2">対象設備（{result.groups.length}グループ）</h2>
          <table>
            <thead>
              <tr>
                <th>冷媒</th>
                <th>種別</th>
                <th className="pr-num">設置年</th>
                <th className="pr-num">築年</th>
                <th className="pr-num">台数</th>
                <th className="pr-num">年間kWh</th>
              </tr>
            </thead>
            <tbody>
              {result.groups.map((g) => (
                <tr key={g.id}>
                  <td>{REFRI_LABELS[g.refri] ?? g.refri.toUpperCase()}</td>
                  <td>{g.equip === "multi" ? "マルチ" : "パッケージ"}</td>
                  <td className="pr-num">{g.installYear}</td>
                  <td className="pr-num">築{g.age}年</td>
                  <td className="pr-num">{g.units}台</td>
                  <td className="pr-num">{g.kwh.toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pr-note" style={{ marginTop: "1.6mm" }}>
            年間kWhは
            {input.kwhMode === "measured"
              ? "グループ別の実測値です。"
              : "ご申告の総使用量を設備条件で按分した推計値です（実測ではありません）。"}
            馬力が未入力のグループは一般値を含む概算です。正式見積は現地調査後にご提示します。
          </p>
        </div>

        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">確認された課題</h2>
          <ul>
            {details.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">推奨する対策</h2>
          <div className="pr-box">
            <p style={{ margin: 0 }}>{details.recommendation}</p>
          </div>
        </div>
      </>
    ),
  });

  /* ══ 本文 提案と支援内容 ══════════════════════════════════
     v1 は提案・実績・報酬体系を1ページに積んで実測1388px（＝2枚に割れる）。
     v2 は「提案」と「実績データ」の2ページに分ける。 */
  pages.push({
    chapter: `${C_PLAN}. 提案と支援内容`,
    body: (
      <>
        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">今、更新をご検討いただきたい理由</h2>
          <ol>
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </div>

        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">EHC 推奨プラン</h2>
          <div className="pr-box">
            <p style={{ margin: 0 }}>{result.ehcPlan}</p>
          </div>
        </div>

        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">補助金獲得サポートと報酬体系</h2>
          <div className="pr-box">
            <p>
              EHCソリューションズは、補助金の<strong>適用判定・申請書類作成・実績報告まで一気通貫</strong>でサポートいたします。
            </p>
            <p style={{ margin: 0 }}>
              <strong>成功報酬：獲得補助金額の10%</strong>
              {displaySubsidyManYen > 0 && (
                <>
                  （本ケース想定：補助金 ¥{displaySubsidyYen.toLocaleString("ja-JP")} → サポート報酬 ¥
                  {rewardYen.toLocaleString("ja-JP")}）
                </>
              )}
            </p>
            <p className="pr-note" style={{ marginTop: "1.6mm", marginBottom: 0 }}>
              ※不採択の場合、サポート報酬は発生しません（完全成功報酬制）。※設備費・工事費は別途お見積りいたします。
            </p>
          </div>
        </div>

        <p className="pr-note" style={{ marginTop: "2mm" }}>
          導入実績・実証データは次ページ（p.{P_ACHIEVE}）に記載しています。
        </p>
      </>
    ),
  });

  /* ══ 本文 導入実績・実証データ ════════════════════════════ */
  pages.push({
    chapter: `${C_ACHIEVE}. 導入実績・実証データ`,
    body: (
      <>
        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">EHC 導入実績</h2>
          <div className="pr-kpi">
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">累計実績</span>
              <span className="pr-kpi-value">{ACHIEVEMENT_STATS.totalCases} 件</span>
            </div>
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">累計CO₂削減</span>
              <span className="pr-kpi-value">{ACHIEVEMENT_STATS.totalCo2Ton.toFixed(1)} t</span>
            </div>
            <div className="pr-kpi-cell">
              <span className="pr-kpi-label">平均電力削減</span>
              <span className="pr-kpi-value">{ACHIEVEMENT_STATS.avgPowerReduction.toFixed(1)}%</span>
            </div>
          </div>
          <p className="pr-note" style={{ marginTop: "1.6mm" }}>
            出典：株式会社EHCソリューションズ「炭化水素冷媒 導入事例集」（全{ACHIEVEMENT_STATS.totalCases}件）。
          </p>
        </div>

        {/* 該当事例が無いときに見出しだけの空表を出さない（§6C 空白ブロックを作らない） */}
        {matchedAchievements.length > 0 && (
        <div className="pr-sec pr-keep">
          <h3 className="pr-h3">御社に近い導入事例</h3>
          <table>
            <thead>
              <tr>
                <th>業種</th>
                <th>設備</th>
                <th className="pr-num">台数</th>
                <th className="pr-num">CO₂削減</th>
                <th className="pr-num">電力削減</th>
              </tr>
            </thead>
            <tbody>
              {matchedAchievements.map((a) => (
                <tr key={a.id}>
                  <td>{a.industry}</td>
                  <td>{a.equipment}</td>
                  <td className="pr-num">{a.units}台</td>
                  <td className="pr-num">{a.co2ReductionTon}t</td>
                  <td className="pr-num">{a.powerReductionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className="pr-sec pr-keep">
          <h3 className="pr-h3">
            実証事例：{AKITA_RICE_WAREHOUSE.facility}（夏季ピーク時 最大{AKITA_RICE_WAREHOUSE.peakSummerReduction}%削減）
          </h3>
          <table>
            <thead>
              <tr>
                {AKITA_RICE_WAREHOUSE.monthlyComparison.map((m) => (
                  <th key={m.month} className="pr-num">{m.month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {AKITA_RICE_WAREHOUSE.monthlyComparison.map((m) => (
                  <td key={m.month} className="pr-num">{m.reduction.toFixed(0)}%</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="pr-note" style={{ marginTop: "1.6mm" }}>
            公共施設での実証データ（{AKITA_RICE_WAREHOUSE.comparisonPeriod}）。対象工事・期間・比較条件はこの実証に固有のもので、御社の削減率を約束するものではありません。
          </p>
        </div>

        <div className="pr-sec pr-keep">
          <h3 className="pr-h3">実環境比較：フロン冷媒 vs ハイチルガス（{EHC_FIELD_TEST_2026.period}）</h3>
          <table>
            <thead>
              <tr>
                <th>電力削減（同温度補正）</th>
                <th>年間削減コスト</th>
                <th>年間CO₂削減</th>
                <th>予測安定性</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>−{EHC_FIELD_TEST_2026.reductionRate}%</td>
                <td>
                  {EHC_FIELD_TEST_2026.verifiedAnnualFigures
                    ? `約¥${EHC_FIELD_TEST_2026.annualYen.toLocaleString("ja-JP")}`
                    : "検証中"}
                </td>
                <td>
                  {EHC_FIELD_TEST_2026.verifiedAnnualFigures
                    ? `約${EHC_FIELD_TEST_2026.annualCo2Kg.toLocaleString("ja-JP")}kg`
                    : "検証中"}
                </td>
                <td>R²={EHC_FIELD_TEST_2026.r2}</td>
              </tr>
            </tbody>
          </table>
          <p className="pr-note" style={{ marginTop: "1.6mm" }}>
            同一空調設備で外気温を正規化した回帰分析による比較（年間換算は1日あたり削減量×365日。実稼働日数により変動）
            {!EHC_FIELD_TEST_2026.verifiedAnnualFigures && <>／{EHC_FIELD_TEST_2026.unverifiedNote}</>}
          </p>
        </div>
      </>
    ),
  });

  /* ══ 本文 次に確認すること ════════════════════════════════
     v1 は「確認事項の全件」「5ステップ」「相談先＋QR」「免責」「取り扱い条項」を
     1ページに積んで実測1532px（＝2枚に割れる）。v2 は3ページに分ける。
     確認事項は件数が入力で変わるので CHECKS_PER_PAGE で改ページする。 */
  checkChunks.forEach((chunk, idx) => {
    const offset = idx * CHECKS_PER_PAGE;
    pages.push({
      chapter: `${C_CHECKS}. 次に確認すること${checkChunks.length > 1 ? `（${idx + 1}/${checkChunks.length}）` : ""}`,
      body: (
        <>
          <div className="pr-sec">
            <h2 className="pr-h2">
              次に確認すること（全{details.nextChecks.length}件
              {checkChunks.length > 1 ? ` のうち ${offset + 1}〜${offset + chunk.length}件目` : ""}）
            </h2>
            {chunk.length ? (
              <ol start={offset + 1}>
                {chunk.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ol>
            ) : (
              <p>現時点で追加の確認事項はありません。</p>
            )}
          </div>
          {idx === checkChunks.length - 1 && (
            <p className="pr-note">
              お手続きの進め方とご相談先（QRコード）は次ページ（p.{P_STEPS}）に記載しています。
            </p>
          )}
        </>
      ),
    });
  });

  /* ══ 本文 お手続きの進め方・ご相談先 ══════════════════════
     §6 の拘束条件により、問い合わせ文・診断書番号・QRは同じ .pr-contact に置き、
     ページをまたがせない。 */
  pages.push({
    chapter: `${C_STEPS}. お手続きの進め方・ご相談先`,
    body: (
      <>
        <div className="pr-sec">
          <h2 className="pr-h2">お手続きの進め方</h2>
          {STEPS.map((s) => (
            <div key={s.title} className="pr-card pr-keep">
              <div className="pr-card-title">{s.title}</div>
              <p style={{ margin: "0 0 1.2mm" }}>{s.body}</p>
              <p className="pr-note" style={{ margin: 0 }}>成果物：{s.deliverable}</p>
            </div>
          ))}
        </div>

        <div className="pr-sec">
          <h2 className="pr-h2">お見積り・現地調査（無料）のお申し込み</h2>
          <div className="pr-contact">
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "0 0 1.2mm" }}>
                <strong>メール：info@ehcjpn.com</strong>（cc: info@project-neo.co.jp）
              </p>
              <p style={{ margin: "0 0 1.2mm" }}>
                件名に診断書番号 <strong>{proposalNo}</strong> をご記載ください。
              </p>
              <p style={{ margin: 0 }}>
                このページのQRコードをスマートフォンのカメラで読み取ると、宛先・件名入りのお問い合わせメールがそのまま開きます。
              </p>
              {input.ehcStaff && (
                <p className="pr-note" style={{ margin: "1.2mm 0 0" }}>EHC担当：{input.ehcStaff}</p>
              )}
              <p className="pr-note" style={{ margin: "1.2mm 0 0" }}>
                費用・キャンセル料はかかりません。ご相談先はEHCソリューションズです。
              </p>
            </div>
            <div className="pr-qr">
              <QRCodeSVG value={inquiryMailtoShort} size={96} level="M" fgColor="#0a0a0a" bgColor="#ffffff" />
            </div>
          </div>
        </div>
      </>
    ),
  });

  /* ══ 本文 費用条件・免責／取り扱い条項 ════════════════════ */
  pages.push({
    chapter: `${C_TERMS}. 費用条件・免責`,
    body: (
      <>
        <div className="pr-sec pr-keep">
          <h2 className="pr-h2">費用条件・免責</h2>
          <div className="pr-box">
            <p style={{ margin: 0 }}>
              株式会社EHCソリューションズ（業務用空調・GX・補助金 専門）。
              本診断書は試算値に基づくものであり、実際の補助金採択・補助額・電気代削減効果を保証するものではありません。
              金額はすべて税抜、補助額は千円未満切捨てです。設備費・工事費は別途お見積りいたします。
            </p>
          </div>
        </div>

        <div className="pr-sec pr-keep">
          <div className="pr-box">
            <p className="pr-note" style={{ margin: 0 }}>
              <strong>【本診断書の取り扱いについて】</strong>
              <br />
              本診断書および記載内容（試算結果・提案プラン・施工実績データ・価格情報等）に関する著作権その他一切の権利は、株式会社EHCソリューションズに帰属し、著作権法により保護されています。
              当社の書面による事前承諾なく、本診断書の全部または一部を複製・転載・改変・撮影・第三者への開示もしくは提供（相見積り取得を目的とした他社への提示を含む）することを固く禁じます。
              これらに違反した場合、著作権法に基づく差止請求・損害賠償請求、および不正競争防止法（営業秘密の不正使用）に基づく法的措置の対象となることがあります。
              本診断書は宛先のお客様に限りご利用いただけます（診断書番号 {proposalNo} にて交付先を管理しています）。
              <br />© {issuedYear} EHC Solutions Co., Ltd. All Rights Reserved.
            </p>
          </div>
        </div>
      </>
    ),
  });

  /* ══ 別紙 ═════════════════════════════════════════════════ */
  annexChunks.forEach((chunk, idx) => {
    const isRejected = chunk[0]?.bucket === "C";
    pages.push({
      chapter: `別紙 ${idx + 1}/${annexChunks.length}. 制度の根拠${isRejected ? "（対象外・受付終了）" : ""}`,
      body: (
        <>
          {idx === 0 && (
            <p className="pr-note" style={{ marginBottom: "3mm" }}>
              各制度の判定根拠です。1ページに1制度、A（いま申請可能性がある）→ B（条件確認で候補になる）→ C（今回は対象外・受付終了）の順に並べています。
              Cは対象外と判定した理由を示すもので、A・Bへ格上げする根拠ではありません。制度データ基準日 {SUBSIDY_DATA_ASOF}。
            </p>
          )}
          {chunk.map((a) => {
            /* 本文の表から落とした「準備の目安・手間」をここで拾う。
               cand があれば「受付日程に間に合うか」の文言（inTime）も併記する。 */
            const cand = details.candidates.find((c) => c.subsidy.id === a.subsidy.id);
            return (
            <div
              key={a.subsidy.id}
              className={`pr-card ${a.bucket === "A" ? "pr-card-a" : a.bucket === "B" ? "pr-card-b" : "pr-card-c"}`}
            >
              <div className="pr-card-title">
                <span className={a.bucket === "A" ? "pr-badge" : a.bucket === "B" ? "pr-badge pr-badge-b" : "pr-badge pr-badge-c"}>
                  {a.bucket}
                </span>
                {a.subsidy.name}
              </div>
              <dl className="pr-kv">
                <dt>判定区分</dt>
                <dd>{BUCKET_LABEL[a.bucket]}</dd>
                <dt>{a.bucket === "C" ? "対象外・終了の理由" : "判定の理由"}</dt>
                <dd>{a.reason}</dd>
                <dt>実施主体</dt>
                <dd>{a.subsidy.org}</dd>
                <dt>補助率</dt>
                <dd>{a.subsidy.rate}</dd>
                <dt>上限</dt>
                <dd>{a.subsidy.max}</dd>
                <dt>対象設備</dt>
                {/* target は EquipType[]。配列のまま出すと「acmulti」と連結されてしまう。 */}
                <dd>{equipTargetLabel(a.subsidy.target)}</dd>
                <dt>主な要件</dt>
                <dd>{a.subsidy.requirement}</dd>
                <dt>使い道（対象経費）</dt>
                <dd>{a.subsidy.useOfFunds || "高効率空調等の導入費。対象経費は公募要領で確認します。"}</dd>
                <dt>必要書類</dt>
                <dd>{a.subsidy.docs}</dd>
                <dt>準備の目安・手間</dt>
                <dd>
                  {prepLeadLabel(a.subsidy) ?? "準備日数は要確認"}／{effortLabel(a.subsidy)}
                  {a.subsidy.difficultyNote
                    ? `。${a.subsidy.difficultyNote}`
                    : "。必要書類と審査方法を確認してください。"}
                  {cand ? `。${cand.inTime}` : ""}
                </dd>
                <dt>公募期間</dt>
                <dd>
                  {a.subsidy.period}
                  {a.subsidy.scheduleNote ? `／${a.subsidy.scheduleNote}` : ""}
                </dd>
                <dt>受付状態</dt>
                <dd>
                  {statusLabel(a.subsidy)}／{a.timing}
                </dd>
                <dt>補助額の算定</dt>
                <dd>
                  {a.subsidy.infoOnly
                    ? "情報提供のみの制度のため、補助額・実質負担は算定していません。"
                    : a.amountShown
                      ? `要件を満たす場合の最大概算 ${a.potentialManYen.toLocaleString("ja-JP")}万円（千円未満切捨て）／実質負担概算 ${a.outOfPocketManYen.toLocaleString("ja-JP")}万円`
                      : "未算定（判定に必要な情報が揃っていないため。0円という意味ではありません）"}
                </dd>
                <dt>不足している情報</dt>
                <dd>{a.missing.length ? a.missing.join("／") : "現時点で追加の指摘はありません。"}</dd>
                <dt>次の一手</dt>
                <dd>{a.nextAction}</dd>
                <dt>情報の取得状態</dt>
                <dd>
                  {verificationLabel(a.subsidy)}
                  {a.monitorNote ? `／${a.monitorNote}` : ""}
                  {a.coverageGap ? "／制度ページ単位での更新監視ができていません。" : ""}
                </dd>
                <dt>内容確認日時</dt>
                <dd>{checkedLabel(a.subsidy.officialCheckedAt ?? a.subsidy.fetchedAt)}</dd>
                <dt>公式URL</dt>
                <dd className="pr-url">{a.subsidy.url}</dd>
              </dl>
            </div>
            );
          })}
        </>
      ),
    });
  });

  return (
    <>
      {pages.map((p, i) => (
        <section className="print-page" key={`${p.chapter}-${i}`}>
          <div className="pr-runhead">
            <span className="pr-chapter">{p.chapter}</span>
            <span>
              業務用空調 補助金・省エネ診断書 ｜ {proposalNo} ｜ {today}
            </span>
          </div>
          <div className="pr-body">{p.body}</div>
          <div className="pr-runfoot">
            <span>EHC SOLUTIONS ｜ 社外秘 ｜ 無断複製・転載禁止 ｜ {proposalNo}</span>
            <span>
              {i + 1} / {totalPages}
            </span>
          </div>
        </section>
      ))}
    </>
  );
}
