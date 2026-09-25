"use client";

import { getSubsidies } from "@/lib/subsidies";
import { MatchInput, Subsidy } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { canShowAmount, assessFit, type FitAssessment, type FitGroupKind } from "@/lib/eligibility";
import { subsidyAmountManYen, SUBSIDY_CAP_UNKNOWN_NOTE } from "@/lib/pricing";
/* 2026-09-10 EHC-0038 P0-2:
   この画面は input.invest を直接割り算して「実質負担」「回収目安」を出していた。
   投資額が未算定（0）でも 0万円・0.0年という“既知の答え”になってしまうため、
   状態を持った共通結果（buildRoiSnapshot）を経由させる。 */
import {
  buildRoiSnapshot,
  resolveInvestState,
  INVEST_UNKNOWN_LABEL,
  RECOVERY_UNKNOWN_LABEL,
  /* 2026-09-11 EHC-0038 第2便 4-B:
     「未算定」「概算」「見積確認済み」の語と記号は lib/roiState.ts で1か所に決める。
     ここで "未算定" という文字列を直書きすると、画面とPDFで言い方が分かれる。 */
  AMOUNT_UNSET_MARK,
  AMOUNT_BASIS_LABEL,
  AMOUNT_BASIS_NOTE,
  type AmountBasis,
  type RoiSnapshot,
} from "@/lib/roiState";
import { judgePrep, PREP_DISCLAIMER } from "@/lib/prep";
import { AlertCircle, CalendarClock, CheckCircle2, ExternalLink, HelpCircle, WalletCards, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ProgramBucket = "A" | "B" | "C";

export interface ProgramAssessment {
  subsidy: Subsidy;
  bucket: ProgramBucket;
  /* 2026-09-14 EHC-0039 v3指示 §C段:
     C段の適合度は5段階（不可／低い／余地あり／高い／判定保留）。
     3値の bucket からは作れない（A は「入力設備が全群対象か」を見ていない）ので、
     lib/eligibility.ts の assessFit() が出した結果をそのまま持ち回る。
     bucket は既存の3カラム表示・並び順が依存しているので残す。
     表示側（ResultStage.tsx）でこの level を作り直さないこと。 */
  fit: FitAssessment;
  reason: string;
  missing: string[];
  /* 2026-08-24 監査で追加。
     金額を出してよいかの判定を、金額そのものと分けて持つ。
     以前は potentialManYen だけがあり、適格性が判定できていない制度にも
     「補助額 最大約◯万円」と表示していた。0円と「未算定」も区別できなかった。 */
  amountShown: boolean;
  /* 2026-09-10 EHC-0038 P0-2:
     金額を出さない理由は「適格性が未確認」と「投資額が未算定」で別物で、
     客がとるべき次の行動も違う。どちらなのかを持ち回る。 */
  amountUnavailableReason: string | null;
  potentialManYen: number;
  outOfPocketManYen: number;
  nextAction: string;
  timing: string;
  monitorNote?: string;
  /* 2026-08-27 監査で追加。
     coverage_gap は「制度が変わった」ではなく「その制度を監視できていない」状態なので、
     verificationState を降格させない。しかし降格させないと
     『monitorNote && verificationState !== "verified"』という表示条件に引っかかって
     注記そのものが画面から消え、「監視できていない」ことを誰も知らないまま
     公式確認済みバッジだけが残る。これは本監査が潰そうとしている“黙って落ちる”不具合そのもの。
     判定と表示を別のフラグで持ち、注記は必ず出す。 */
  coverageGap: boolean;
}

/* 2026-08-24 監査での修正:
   以前は const REFERENCE_NOW = new Date("2026-08-18T12:00:00+09:00") という固定値で
   「残り約N日」を計算していた。ビルド後に時間が経つほど残日数が実際より多く表示され、
   締切を過ぎた制度でも「今から準備できる可能性があります」と言い続ける状態だった。
   基準時刻は呼び出し時の現在時刻に統一する。 */

/* samePref() はここにあったが、地域要件の判定は lib/eligibility.ts に集約したので削除した。
   同じ判定を2箇所に置くと、片方だけ直したときに画面内で結論が食い違う。 */

function dateLabel(value?: string) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}

function checkedLabel(value?: string) {
  if (!value) return "未確認";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildTiming(s: Subsidy, now: Date) {
  if (s.status === "closed") return `受付終了${s.scheduleNote ? `。${s.scheduleNote}` : ""}`;
  if (s.status === "upcoming") return `受付予定：${dateLabel(s.applyOpen) ?? "公式発表待ち"}〜${dateLabel(s.applyClose) ?? "期限未定"}`;
  if (s.status === "open") {
    if (!s.applyClose) return "受付中（締切は公式要領で確認）";
    /* 2026-09-08 NEOレビュー差し戻しでの修正:
       残日数が最大日数を下回ると一律「早急な個別確認」になっており、
       最小日数すら切っている制度と区別できなかった。判定は lib/prep.ts に一本化。 */
    return `受付中・期限 ${dateLabel(s.applyClose)}。${judgePrep(s, now).text}`;
  }
  return s.scheduleNote || "受付時期は公式確認が必要です";
}

/* 2026-08-27 監査での修正:
     状態は "unchanged" | "needs_review" | "unavailable" の3値しか受け取っていなかった。
     監視側に stale（最終確認から日が経ちすぎ）と coverage_gap（制度ページ単位で監視できていない）を
     足したので、こちらも受け取れるようにする。
     stale は needs_review と同じくA判定から降ろす。
     coverage_gap は制度が変わった証拠ではなく監視体制の欠落なので降格はさせず、注記だけ出す。 */
type MonitorState = "unchanged" | "needs_review" | "stale" | "coverage_gap" | "unavailable";
interface MonitorSourceState { id: string; fetchedAt: string; state: MonitorState; note: string }
interface MonitorPayload { checkedAt: string; sources: MonitorSourceState[] }

function monitorVerification(state: MonitorState | undefined): "needs_review" | "unavailable" | null {
  if (state === "needs_review" || state === "stale") return "needs_review";
  if (state === "unavailable") return "unavailable";
  return null;
}
let monitorPromise: Promise<MonitorPayload | null> | null = null;

function loadMonitor() {
  if (!monitorPromise) monitorPromise = fetch("/api/subsidies/monitor").then((r) => r.ok ? r.json() as Promise<MonitorPayload> : null).catch(() => null);
  return monitorPromise;
}

/* 2026-09-16 EHC-0039 修正2:
   第5引数を「試算に含めなかった群の数」から「その群の種類の配列」へ変えた。
   数だけでは、ルームエアコン（対象種別でないと分かっている）と
   種類未選択（何も分かっていない）を区別できず、
   適合度がどちらへ倒しても事実と違う文になる。
   判定の中身は lib/eligibility.ts の assessFit() 側に全て書いてある。
   projection を持たない呼び出し側は渡さなくてよい（既定＝空配列）。 */
export function assessPrograms(input: MatchInput, result: MatchResult, monitorStates: Record<string, MonitorSourceState> = {}, now: Date = new Date(), excludedKinds: FitGroupKind[] = []): ProgramAssessment[] {
  return getSubsidies(now).map((s) => {
    const monitored = monitorStates[s.id];
    const verificationState = monitorVerification(monitored?.state) ?? s.verificationState;
    const effectiveSubsidy: Subsidy = { ...s, verificationState, fetchedAt: monitored?.fetchedAt ?? s.fetchedAt };

    /* 2026-08-24 監査での修正:
         ここに「事業者区分が対象外」「対象地域外」…という要件判定が、
         lib/match.ts のフィルタとは別に、独立してもう1本書かれていた。
         同じことを2箇所で判定しているので、片方だけ直すと
         同じ画面の「診断結果」と「該当制度」で結論が食い違う。
         判定は lib/eligibility.ts の1本に寄せ、ここはその結果を読むだけにする。 */
    const elig = result.eligibility[s.id];
    const hardReasons: string[] = elig ? [...elig.blockers] : [];

    /* 2026-09-10 EHC-0038 P0-4:
       ここには「導入予定機器の型番・対象設備登録」「契約・発注・着工前であること」
       「資本金・従業員数による正式な事業規模」「希望する契約・発注・導入時期」を
       直接 missing へ push するコードが並んでいた。
       画面には不足事項として表示されるのに、下のバケット判定にも金額ゲートにも一切効かない。
       同じカードが「これが足りません」と言いながら確定額を出していたということ。
       文言の作成は lib/eligibility.ts の checkApplicationPrereq() に移し、
       1件ずつ「金額を止める（missing）／止めない（confirmations）」を明示した。
       この画面は判定結果を読むだけにする。 */
    const missing: string[] = elig ? [...elig.missing, ...elig.confirmations] : [];

    /* バケットは lib/eligibility.ts の3値をそのまま写す。
       ただし更新監視（/api/subsidies/monitor）が「公式ページが変わった」と言っている制度は、
       eligibility が verified と判断していてもA判定にしない。
       監視結果はビルド時点の subsidies.ts より新しい情報だからである。 */
    let bucket: ProgramBucket;
    if (hardReasons.length || s.status === "closed" || s.status === "suspended") bucket = "C";
    else if (
      elig?.verdict === "eligible" &&
      verificationState === "verified" &&
      s.programCategory === "equipment"
    ) bucket = "A";
    else bucket = "B";

    /* 2026-09-14 EHC-0039:
       適合度5段階。判定は lib/eligibility.ts の assessFit() が持つ。ここでは呼ぶだけ。
       渡すのは effectiveSubsidy（更新監視を反映した方）。s を渡すと、
       監視が「公式ページが変わった」と言っている制度が「高い」のまま残る。
       elig が無い＝判定そのものを実行できていない状態なので、
       「低い」ではなく「判定保留」にする。判定していないことを否定側へ倒さない。 */
    const fit: FitAssessment = elig
      ? assessFit(effectiveSubsidy, input, elig, { excludedKinds })
      : {
          level: "on_hold",
          why: ["この制度の適格性判定を実行できていません。"],
          /* 判定を実行できていない以上、算定可否も分からない。
             calculable: true にすると「金額は出せます」と言ったことになる。 */
          amount: {
            calculable: false,
            note: "適格性の判定を実行できていないため、補助額を算定していません。",
          },
        };

    /* 金額は「適格と判定できた制度」だけに出す。
       判定に必要な情報が欠けている段階で金額を出すと、根拠のない数字を客に渡すことになる。
       計算式（千円未満切捨て）は lib/pricing.ts に一本化した。 */
    /* 2026-09-10 EHC-0038 P0-2:
       投資額が未算定のときは補助率を掛ける相手が無い。
       従来はここが 0 を返し、amountShown は true のままだったので、
       画面には「補助額 最大約0万円」という算定済みの顔をした0が出ていた。 */
    /* 2026-09-10 EHC-0038 P0-7:
       subsidyAmountManYen は算定できないときに null を返すようになった
       （補助上限が未確認＝0や非有限のとき等）。null を 0 に読み替えると
       P0-2 で消した「算定済みの顔をした0万円」が上限側から復活する。
       算定できなかった制度は amountShown を false にして金額欄ごと出さない。 */
    const investKnown = resolveInvestState(input.invest) === "known";
    const amountEligible = bucket === "A" && !s.infoOnly && investKnown && (elig ? canShowAmount(elig) : false);
    const calcManYen = amountEligible ? subsidyAmountManYen(input.invest, s.rateNum, s.capManYen) : null;
    const amountShown = amountEligible && calcManYen != null;
    const potentialManYen = calcManYen ?? 0;
    /* 2026-09-10 EHC-0031 P0-D: 所在地は既定値を持たない（未入力を取りうる）。
       未入力のまま `${input.pref}・…` と書くと文が「・中小企業等…」で始まり、
       しかも所在地を判定したかのように読める。未入力なら所在地に触れない。 */
    const prefPhrase = input.pref ? `${input.pref}・` : "";
    const reason = bucket === "A"
      ? `${prefPhrase}${input.size === "sme" ? "中小企業等" : "選択した事業規模"}・業務用空調更新が、公式確認済みの基本条件と矛盾しないためです。`
      : bucket === "B"
        ? s.programCategory === "equipment"
          ? `${prefPhrase}事業規模・空調更新との関連がありますが、${s.status === "upcoming" ? "受付開始前です" : "公式要件と不足情報の追加確認が必要です"}。`
          : "雇用・研修等の取組がある場合に関連する可能性があります。空調設備費の補助額には算入しません。"
        : hardReasons.length ? hardReasons.join("、") : "今回確認した受付回は終了しています。";
    /* 2026-09-10 EHC-0038 P0-4:
       以前は missing[0] を文の途中へ差し込んでいた（「発注前に◯◯を確認し、…」）。
       不足事項・確認事項は lib/eligibility.ts 側で句点まで含む完成した文になっているので、
       文中に埋めると日本語が壊れる（「発注前に…未確認です。を確認し」）。
       先頭の1件はそのまま1文として置き、続きを別の文にする。 */
    const firstTodo = missing[0] ?? null;
    const nextAction = bucket === "A"
      ? firstTodo
        ? `${firstTodo} そのうえで見積・設備一覧の準備を始めてください。`
        : "公募要領を確認し、見積・設備一覧の準備を始める"
      : bucket === "B"
        ? firstTodo ?? "最新の公募要領を確認する"
        : s.scheduleNote?.includes("次") ? "次回公募の公式発表を待ち、見積・設備一覧を先に準備する" : "今回は計算に含めず、別制度を確認する";

    /* 2026-09-16 EHC-0039 修正2の続き:
       ここは「金額を出していない理由」であって「制度に適合しない理由」ではない。
       以前は最後の1本（＝情報が揃っていない）へ全部が落ちていたため、
       受付が終了していて不可になった制度にも「情報が揃っていないため」と書いていた。
       実測: 埼玉県・宿泊施設・神奈川県・千葉県・大阪府の5件が、
       「受付終了。」と書いた直後に「適格性の判定に必要な情報が揃っていないため」と続き、
       同じカードに理由が2つ並んでいた。読み手はどちらを信じるか決められない。
       不可（C）と判定保留（B）は、その状態に対応した文を返す。 */
    const amountUnavailableReason = amountShown
      ? null
      : s.infoOnly
        ? "設備費の概算には含めません。"
        : bucket === "C"
          ? "この制度は今回の条件では対象外・受付終了のため、金額を出していません。理由は上の判定根拠をご覧ください。"
          : !investKnown
            ? "今回更新分の設備投資概算（万円・税抜）が未入力のため、補助額・実質負担を算定していません。金額を入れると算定します。"
            : amountEligible
              // 適格性・投資額は揃っているのに算定できない＝補助上限が未確認（P0-7）
              ? SUBSIDY_CAP_UNKNOWN_NOTE
              : bucket === "B"
                ? "判定に必要な確認が残っているため、まだ金額を出していません。対象外と決まったわけではありません。"
                : "適格性の判定に必要な情報が揃っていないため、金額は出していません。";

    return { subsidy: effectiveSubsidy, bucket, fit, reason, missing, amountShown, amountUnavailableReason, potentialManYen, outOfPocketManYen: amountShown ? Math.max(0, input.invest - potentialManYen) : 0, nextAction, timing: buildTiming(s, now), monitorNote: monitored?.note, coverageGap: monitored?.state === "coverage_gap" };
  }).sort((a, b) => a.bucket.localeCompare(b.bucket) || a.subsidy.name.localeCompare(b.subsidy.name, "ja"));
}

/* 2026-09-11 EHC-0038 第2便 4-D
   バケットの色をライトへ。ダーク時代は「半透明の色を黒に重ねて淡く光らせる」
   作りだったので、白地に置くと `bg-ehc-500/10` は白とほぼ同じ、
   `text-ehc-200` は白地で読めない（コントラスト 2 前後）。
   白地では「淡い塗り＋濃い文字」に反転させる。
   A=緑（brand）／B=琥珀／C=インク淡色。アクセントはこの3色だけに限る。 */
const BUCKETS: { key: ProgramBucket; title: string; note: string; icon: typeof CheckCircle2; tone: string }[] = [
  { key: "A", title: "いま申請可能性がある", note: "公式情報が確認済みで、入力条件に明確な矛盾がない制度", icon: CheckCircle2, tone: "border-brand/35 bg-[#edf6e8] text-brand-deep" },
  { key: "B", title: "条件確認で候補になる", note: "受付予定・要件不足・関連助成金など、追加確認が必要な制度", icon: HelpCircle, tone: "border-amber-500/45 bg-amber-50 text-amber-800" },
  { key: "C", title: "今回は対象外・受付終了", note: "対象外の理由または終了した受付回を確認できます", icon: XCircle, tone: "border-ink-line bg-paper-sub text-ink-soft" },
];

/* 2026-09-08 EHC-0028:
   画面の制度マッチングと、印刷専用の診断書（ReportPrintSheet）で
   同じ判定結果を使うためのフック。
   印刷側で assessPrograms を呼び直すと、更新監視の到着タイミング次第で
   画面と紙の A/B/C が食い違う。判定は1回だけ行い、その配列を両方へ配る。
   loadMonitor() はモジュールレベルで Promise を使い回すので、
   複数箇所から呼んでも /api/subsidies/monitor へのfetchは1回で済む。 */
export function useProgramAssessments(input: MatchInput, result: MatchResult, excludedKinds: FitGroupKind[] = []) {
  const [monitor, setMonitor] = useState<MonitorPayload | null>(null);
  useEffect(() => { let active = true; loadMonitor().then((data) => { if (active) setMonitor(data); }); return () => { active = false; }; }, []);
  /* 2026-09-16 EHC-0039 修正2:
     excludedKinds は呼び出し側で毎回作られる配列なので、そのまま依存配列に入れると
     参照が毎レンダー変わり、useMemo が無効になる。
     制度判定は全制度ぶん回るうえ、結果は onSimulationProgramsChange を通じて
     親の state 更新まで連鎖するので、無限再レンダーになりうる。
     中身から文字列の鍵を作って、値が変わったときだけ計算し直す。
     null は "?" に落とす（"unknown" と別物なので別の記号にする）。 */
  const excludedKey = excludedKinds.map((k) => k ?? "?").join(",");
  const assessments = useMemo(() => {
    const monitorStates = Object.fromEntries((monitor?.sources ?? []).map((s) => [s.id, s]));
    return assessPrograms(input, result, monitorStates, new Date(), excludedKinds);
    // excludedKinds は excludedKey で代表させる（上のコメント参照）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, result, monitor, excludedKey]);
  return { assessments, monitorCheckedAt: monitor?.checkedAt ?? null };
}

export function ProgramMatchBoard({ input, result, printable = false, onSimulationProgramsChange }: { input: MatchInput; result: MatchResult; printable?: boolean; onSimulationProgramsChange?: (programs: Subsidy[]) => void }) {
  const { assessments, monitorCheckedAt } = useProgramAssessments(input, result);
  const active = assessments.filter((a) => a.bucket === "A");
  const conditional = assessments.filter((a) => a.bucket === "B");
  /* 2026-08-27 監査で追加。
     監視できていない制度が何件あるかを、制度カードを開かなくても分かる位置に出す。
     「公式ページ更新確認：◯月◯日」とだけ書いて、実は一部の制度を見ていない、という状態にしない。 */
  const coverageGapItems = assessments.filter((a) => a.coverageGap);
  const simulationPrograms = useMemo(() => assessments
    .filter((a) =>
      (a.bucket === "A" || a.bucket === "B") &&
      !a.subsidy.infoOnly &&
      a.subsidy.programCategory === "equipment" &&
      a.subsidy.status !== "closed" &&
      a.subsidy.status !== "suspended" &&
      a.amountShown
    )
    .map((a) => a.subsidy), [assessments]);
  useEffect(() => {
    onSimulationProgramsChange?.(simulationPrograms);
  }, [onSimulationProgramsChange, simulationPrograms]);
  /* 2026-09-11 EHC-0038 第2便 4-D: 結論帯もライトへ（淡い塗り＋濃い文字）。 */
  const conclusion = active.length
    ? { label: "候補制度あり（条件診断へ）", reason: "所在地・事業規模・設備種別の基本条件とは矛盾しません。発注状況・指定機器・必要書類を確認すると該当見込みを絞れます。", tone: "border-brand/40 bg-[#edf6e8] text-brand-deep" }
    : conditional.length
      ? { label: "条件確認が必要", reason: conditional[0].reason, tone: "border-amber-500/50 bg-amber-50 text-amber-900" }
      : { label: "今回は対象外", reason: assessments[0]?.reason ?? "現在の入力条件で候補を確認できませんでした。", tone: "border-ink-line bg-paper-sub text-ink" };
  /* 2026-08-24 監査での修正:
       以前は bucket B（条件確認が必要）の制度も金額比較の根拠に採用していた。
       B は「適格かどうかまだ判定できていない」制度なので、
       その補助率で「採択された場合の概算」を出すのは根拠が無い。A判定のみを採る。 */
  /* 2026-09-11 EHC-0038 第2便 4-A:
     従来は最上位の1件だけを取り出して「補助金なし／採択された場合の概算」の2枚にしていた。
     しかし A判定が複数あるとき、2番目の制度は画面のどこにも金額が出ず、
     「4｜制度の詳細」を開かないと存在に気づけない。
     補助率・上限の違いは、並べないと比べられない。
     そこで【補助金なし＋制度①＋制度②】の最大3枚を並べる。
     3枚までにするのは、スマホで縦に積んだときに4枚以上は
     スクロールが長くなって比較ではなく閲覧になってしまうため。 */
  const comparisonCandidates = active
    .filter((a) => a.amountShown)
    .sort((a, b) => b.potentialManYen - a.potentialManYen)
    .slice(0, 2);
  const simulationCandidate = comparisonCandidates[0];
  /* 補助額は RoiSnapshot 側で持つので、ここで素の数値（potential）を作らない。
     0 を既定値にした変数を残すと、また未算定と0円が混ざる。 */
  const potentialUnavailable = !simulationCandidate;
  /* 2026-09-10 EHC-0031 UI-03:
     金額が出せないとき、その原因が「あと少し情報が足りない」のか
     「そもそも候補が無い」のかで、客がとるべき行動は正反対になる。
     前者は不足情報を埋めれば金額が出るので、何を答えればよいかを名指しで出す。 */
  const investState = resolveInvestState(input.invest);
  const missingForAmount = useMemo(() => {
    const seen = new Set<string>();
    /* 2026-09-10 EHC-0038 P0-2:
       投資額が未入力でも金額は出せない。ここに出さないと
       「何を答えれば金額が出るのか」の一覧から抜け落ちる。 */
    if (investState === "unknown") seen.add("今回更新分の設備投資概算（万円・税抜）");
    conditional.forEach((a) => a.missing.forEach((m) => seen.add(m)));
    return [...seen].slice(0, 4);
  }, [conditional, investState]);
  /* 2026-09-10 EHC-0038 P0-2:
     ここは input.invest / annualManYen を直接割っていた。
     投資額が未算定（0）だと 0 ÷ 年間削減 = 0 になり、
     「実質負担 0万円・回収 約0.0年」という、根拠のない好条件が出ていた。
     状態を持つ共通結果に一本化し、未算定は未算定のまま画面へ渡す。 */
  const roiWithoutSubsidy = useMemo(
    () => buildRoiSnapshot({ investManYen: input.invest, subsidyConfirmed: true, subsidyManYen: 0, saveYenPerYear: result.saveYenPerYear, investQuoted: input.investQuoted }),
    [input.invest, input.investQuoted, result.saveYenPerYear],
  );
  /* 2026-09-11 EHC-0038 第2便 4-A:
     制度ごとに RoiSnapshot を作る。制度をまたいで合算はしない
     （併用可否は公募要領ごとに違い、合算額には根拠が無い）。 */
  const roiByCandidate = useMemo(
    () => comparisonCandidates.map((a) => ({
      assessment: a,
      snapshot: buildRoiSnapshot({ investManYen: input.invest, subsidyConfirmed: true, subsidyManYen: a.potentialManYen, saveYenPerYear: result.saveYenPerYear, investQuoted: input.investQuoted }),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.invest, input.investQuoted, result.saveYenPerYear, comparisonCandidates.map((a) => `${a.subsidy.id}:${a.potentialManYen}`).join("|")],
  );
  const deadlineItems = [...active, ...conditional].slice(0, 3);
  /* 2026-09-11 EHC-0038 第2便 4-D / 4-I
     画面側の地を night-900（黒）から紙（paper-card）へ。
     角丸は狭幅24 / 広幅30（Card と同じ規則。ここは Card を使っていない素の section）。 */
  const shell = printable ? "border-slate-200 bg-white text-slate-800" : "border-ink-line bg-paper-card text-ink";
  return (
    <section className={`rounded-3xl lg:rounded-[30px] border p-4 md:p-6 ${shell}`}>
      <div className="flex items-start gap-3 mb-4">
        <CalendarClock className={`w-5 h-5 mt-0.5 ${printable ? "text-ehc-700" : "text-brand"}`} />
        <div><h2 className={`font-bold ${printable ? "text-slate-900" : "text-ink"}`}>制度マッチング結果</h2><p className={`text-xs mt-1 ${printable ? "text-slate-600" : "text-ink-soft"}`}>資格確定や採択見込みではありません。公式情報と不足条件を確認したうえで申請可否を判断します。{monitorCheckedAt ? ` 公式ページ更新確認：${new Date(monitorCheckedAt).toLocaleString("ja-JP")}` : " 公式ページの更新有無を確認中です。"}</p></div>
      </div>
      {coverageGapItems.length ? (
        <div className={`mb-4 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${printable ? "border-slate-200 bg-slate-50 text-slate-600" : "border-ink-line bg-paper-sub text-ink-soft"}`}>
          <strong className={printable ? "text-slate-800" : "text-ink"}>更新監視の範囲について：</strong>
          {coverageGapItems.length}件（{coverageGapItems.map((a) => a.subsidy.name).join("、")}）は、公式ポータルのトップページしか監視できていません。
          制度ページ単位のURLを登録するまで、これらの制度の改定は自動検知されません。申請前に公募要領を直接ご確認ください。
        </div>
      ) : null}
      <div className="space-y-4">
        <div className={`rounded-2xl border p-4 ${printable ? "border-slate-200 bg-slate-50 text-slate-900" : conclusion.tone}`}>
          <p className="text-xs opacity-80">1｜結論</p>
          <h3 className="mt-1 text-lg md:text-xl font-black">補助金を使える可能性：{conclusion.label}</h3>
          <p className="mt-2 text-xs leading-relaxed">{conclusion.reason}</p>
        </div>

        <div className={`rounded-2xl border p-4 ${printable ? "border-slate-200" : "border-ink-line bg-paper-sub"}`}>
          {/* 2026-09-11 EHC-0038 第2便 4-A
              「おすすめ」ではなく「比較中」を強調する。

              金額の大きい順に並べているだけなのに、先頭に置いた案は
              それだけで推薦に見える。実際には採択率・申請の手間・
              対象経費の当てはまりを一切評価していないので、
              こちらが薦めているのではないと見出しの段階で言う。
              「比較中」は状態の宣言であり、結論の先取りではない。 */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <WalletCards className="w-4 h-4 text-brand" />
            <h3 className={`text-sm font-bold ${printable ? "text-slate-900" : "text-ink"}`}>2｜金額比較</h3>
            {comparisonCandidates.length ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  printable ? "bg-slate-100 text-slate-700" : "bg-[#edf6e8] text-brand-deep"
                }`}
              >
                比較中（{comparisonCandidates.length + 1}案）
              </span>
            ) : null}
          </div>
          {comparisonCandidates.length ? (
            <p className={`-mt-1 mb-3 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-ink-soft"}`}>
              並び順は金額の大きい順です。当社が薦める順ではありません。
            </p>
          ) : null}
          {/* 2026-09-10 EHC-0031 UI-03
              SHINICHIさん指摘:「補助金が入らないと話にならなくない？
              該当する補助金がないならないで出さないと」

              従来は A判定が無いときも「採択された場合の概算」の枠を残し、
              中身を全て「未算定／算定不可」で埋めていた。
              空の枠は何も伝えないうえに、「本来は金額が出るはずなのに出せて
              いない」という印象だけを残す。読んだ人が次に何をすればよいかも
              分からない。

              A判定が無いときは枠自体を出さず、次のどちらであるかを言い切る。
                ・条件確認が残っている（B判定あり）→ 何を答えれば金額が出るか
                ・そもそも候補が無い（B判定も無い）→「該当する補助金はありません」
              金額を出す条件（A判定のみ・lib/eligibility.ts canShowAmount）は
              変えていない。変えたのは、出せないときの伝え方だけである。 */}
          {potentialUnavailable ? (
            <>
              <MoneyPanel title="補助金なし（今回の前提）" snapshot={roiWithoutSubsidy} printable={printable} />
              <div className={`mt-3 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${
                printable
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : conditional.length || investState === "unknown"
                    ? "border-amber-500/40 bg-amber-50 text-amber-900"
                    : "border-ink-line bg-paper-card text-ink"
              }`}>
                {/* 2026-09-10 EHC-0038 P0-2:
                    投資額が未算定のときに「該当する補助金はありません」と言うのは誤り。
                    制度が無いのではなく、こちらが金額を計算できていないだけである。
                    先にこの分岐を置く。 */}
                {investState === "unknown" ? (
                  <>
                    <strong className={printable ? "text-slate-900" : "text-amber-900"}>
                      金額は未算定です（該当なしとは限りません）。
                    </strong>
                    <p className="mt-1.5">
                      今回更新分の設備投資概算（万円・税抜）が未入力のため、補助額・実質負担・回収年数を算定していません。
                      未入力を0円や仮の金額として扱うと、根拠のない数字を出すことになるため算定していません。
                    </p>
                    <p className="mt-1.5">
                      下の「更新工事 見積シミュレーター」で概算するか、正式見積の金額を入力すると算定します。
                    </p>
                    {conditional.length ? (
                      <p className="mt-1.5 opacity-80">
                        なお、候補になり得る制度は現時点で{conditional.length}件あります。詳細は「4｜制度の詳細」をご確認ください。
                      </p>
                    ) : null}
                  </>
                ) : conditional.length ? (
                  <>
                    <strong className={printable ? "text-slate-900" : "text-amber-900"}>
                      補助金ありの金額は、まだ出せません（該当なしとは限りません）。
                    </strong>
                    <p className="mt-1.5">
                      候補になり得る制度が{conditional.length}件ありますが、適格かどうかの判定に必要な情報が揃っていません。
                      揃っていない状態で補助率を当てはめると、根拠のない金額を出すことになるため算定していません。
                    </p>
                    {missingForAmount.length ? (
                      <p className="mt-1.5">
                        次を確認できると金額を出せます：
                        <strong className={printable ? "text-slate-900" : "text-ink"}>{missingForAmount.join("／")}</strong>
                      </p>
                    ) : null}
                    <p className="mt-1.5 opacity-80">制度ごとの不足情報は「4｜制度の詳細」に記載しています。</p>
                  </>
                ) : (
                  <>
                    <strong className={printable ? "text-slate-900" : "text-ink"}>
                      現在の入力条件に該当する補助金はありません。
                    </strong>
                    <p className="mt-1.5">
                      確認した制度はいずれも対象外または受付終了で、比較できる「補助金あり」の案がありません。
                      上の金額が、今回そのまま判断材料になります。
                    </p>
                    <p className="mt-1.5 opacity-80">
                      所在地・事業規模・設備種別・導入時期のいずれかが変わると結果が変わることがあります。
                      次回公募の公式発表後にあらためて診断してください。
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 2026-09-11 EHC-0038 第2便 4-A
                  スマホは縦積み、【1024px以上（lg）かつカード幅280px以上】のときだけ横に並べる。

                  md:grid-cols-2 をやめた理由:
                    md は 768px。そこで2列にすると1枚あたり約360px、
                    内側の padding と 2列の dl（項目名＋金額）を差し引くと
                    金額欄に残るのは150px前後しかなく、「1,234万円」が折り返す。
                    金額が2行に割れた瞬間、比較表は読めなくなる。

                  repeat(auto-fit, minmax(280px,1fr)) にしている理由:
                    「1024px以上」と「カード280px以上」は別の条件で、
                    画面幅が広くてもこのブロックが narrow な親（印刷レイアウト・
                    サイドバー内）に置かれれば折り返さなければならない。
                    lg: が画面幅の条件、minmax(280px,1fr) が実際の入れ物の幅の条件を見る。
                    3枚が入らない幅では 2枚→1枚へ自動で落ちる。

                  比較の枚数は最大3（補助金なし＋制度①＋制度②）。 */}
              <div className="grid grid-cols-1 gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                <MoneyPanel title="補助金なし" snapshot={roiWithoutSubsidy} printable={printable} />
                {roiByCandidate.map(({ assessment, snapshot }, i) => (
                  <MoneyPanel
                    key={assessment.subsidy.id}
                    title={`制度${i === 0 ? "①" : "②"}を使う場合`}
                    snapshot={snapshot}
                    printable={printable}
                    accent
                    candidateName={assessment.subsidy.name}
                  />
                ))}
              </div>
              <p className={`mt-3 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-ink-soft"}`}>
                {`※${roiByCandidate.map((c, i) => `制度${i === 0 ? "①" : "②"}＝「${c.assessment.subsidy.name}」`).join("、")}の補助率・上限を仮置きした比較です（補助額は千円未満切捨て）。金額の大きい順に並べているだけで、申請しやすさ・採択率で順位づけしたものではありません。対象経費、申請区分、審査結果により補助額は変わり、採択・受給を保証しません。併用可否は各制度の公募要領によるため、複数制度の合算額は出していません。`}
              </p>
            </>
          )}
        </div>

        {/* 2026-09-11 EHC-0038 第2便 4-D / 4-J
            期限は「あと何日か」を伝える欄なので、暗色時代は amber-400 の細字で
            目立たせていた。白地の amber-400(#fbbf24) はコントラスト約1.8で、
            注意を引くどころかほとんど読めない。
            塗り（amber-50）＋濃い文字（amber-700/800）に反転させる。
            折りたたみの summary は min-h-[48px] を与えてタップ領域を確保する。 */}
        <div className={`rounded-2xl border p-4 ${printable ? "border-slate-200" : "border-ink-line bg-paper-card"}`}>
          <div className="flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-amber-700" /><h3 className={`text-sm font-bold ${printable ? "text-slate-900" : "text-ink"}`}>3｜期限</h3></div>
          <div className="space-y-2">{deadlineItems.length ? deadlineItems.map((a) => <div key={a.subsidy.id} className={`rounded-xl border p-3 text-xs ${printable ? "border-slate-200 text-slate-800" : "border-ink-line text-ink"}`}><div className="flex flex-wrap items-center gap-2"><strong>{a.subsidy.name}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${printable ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-800"}`}>{statusLabel(a.subsidy)}</span></div><p className="mt-1.5 leading-relaxed">{a.timing}</p></div>) : <p className={`text-xs ${printable ? "text-slate-500" : "text-ink-soft"}`}>受付中の候補はありません。次回公募の公式発表待ちです。</p>}</div>
          <p className={`mt-2 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-ink-soft"}`}>{PREP_DISCLAIMER}</p>
        </div>

        <details open={printable} className={`rounded-2xl border p-4 ${printable ? "border-slate-200" : "border-ink-line bg-paper-card"}`}>
          <summary className="cursor-pointer list-none min-h-[48px] flex items-center gap-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><HelpCircle className="w-4 h-4 text-brand" /><strong className={`text-sm ${printable ? "text-slate-900" : "text-ink"}`}>4｜制度の詳細・不足情報</strong><span className={`ml-auto text-xs ${printable ? "text-slate-500" : "text-ink-soft"}`}>開いて確認</span></summary>
          <div className="space-y-4 mt-4">{BUCKETS.map((group) => { const items = assessments.filter((a) => a.bucket === group.key); const Icon = group.icon; return <div key={group.key}><div className={`rounded-xl border px-3 py-2.5 flex items-start gap-2 ${printable ? "border-slate-200 bg-slate-50 text-slate-800" : group.tone}`}><Icon className="w-4 h-4 mt-0.5" /><div><h3 className="text-sm font-bold">{group.key}｜{group.title}（{items.length}件）</h3><p className="text-xs opacity-80">{group.note}</p></div></div><div className="space-y-3 mt-3">{items.length ? items.map((a) => <ProgramCard key={a.subsidy.id} assessment={a} printable={printable} />) : <p className={`text-xs ${printable ? "text-slate-500" : "text-ink-soft"}`}>該当なし</p>}</div></div>; })}</div>
        </details>
      </div>
    </section>
  );
}

function statusLabel(s: Subsidy) {
  if (s.status === "open") return "受付中";
  if (s.status === "upcoming") return "受付予定";
  if (s.status === "closed") return "受付終了";
  return "次回公募・受付時期を確認";
}

/* ───────── 2026-09-11 EHC-0038 第2便 4-B / 4-D / 4-H ─────────
   このパネルの金額欄には、性質の違う3つが同じ見た目で並んでいた。

     ① 未算定 …… "未算定" という 12px の細い文字。金額と同じ行の同じ位置に
                   同じ大きさで出るため、流し読みでは数字の一種に見える。
     ② 概算   …… 太字の数字
     ③ 見積確認済み …… ②と全く同じ太字の数字

   ①は「金額が入る場所に金額以外のものが入っている」ことを形で示す必要がある。
   そこで 28px / 600 の「—」にする。数字（12px 太字）より大きく、しかし
   数字ではない記号なので、読み間違えようがない。空文字や 0 にはしない
   （欄が消える／0円と読める）。

   ②③は snapshot.investBasis / subsidyBasis から出る小さなラベルで分ける。
   判定はこの関数では行わない（lib/roiState.ts が唯一の決定点）。

   色は暗色から明色へ。暗色時代の accent は bg-ehc-500/10（黒地に10%の緑）で、
   白地では白と見分けがつかない。明色では「淡い塗り＋濃い文字」に反転させる。 */
function AmountCell({
  label,
  basis,
  accent = false,
  printable,
}: {
  /** 算定できているときに出す文字列。null なら未算定として「—」を出す */
  label: string | null;
  basis: AmountBasis;
  accent?: boolean;
  printable: boolean;
}) {
  if (label == null) {
    return (
      <dd className="text-right">
        <span
          className={`block text-[28px] font-semibold leading-none ${printable ? "text-slate-400" : "text-ink-soft"}`}
          /* 読み上げでは「—」が無音になるため、意味を文字で持たせる */
          aria-label={AMOUNT_BASIS_LABEL.unset}
        >
          {AMOUNT_UNSET_MARK}
        </span>
        <span className={`mt-0.5 block text-xs ${printable ? "text-slate-500" : "text-ink-soft"}`}>
          {AMOUNT_BASIS_LABEL.unset}
        </span>
      </dd>
    );
  }
  return (
    <dd className="text-right">
      <span className={`block text-sm font-bold ${accent ? (printable ? "text-slate-900" : "text-brand-deep") : ""}`}>
        {label}
      </span>
      <span
        className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-xs font-semibold ${
          printable
            ? "bg-slate-100 text-slate-600"
            : basis === "quoted"
              ? "bg-[#edf6e8] text-brand-deep"
              : "bg-paper-sub text-ink-soft"
        }`}
      >
        {AMOUNT_BASIS_LABEL[basis]}
      </span>
    </dd>
  );
}

/* 2026-09-10 EHC-0038 P0-2:
   以前は invest / subsidy / recovery を素の数値で受け取り、
   投資額が未入力（0）でも「総費用 0万円・実質負担 0万円・回収 約0.0年」と
   算定済みの顔で表示していた。unavailable フラグも呼び出し側の判断に任されており、
   実際にはどの呼び出しも渡していなかった。
   判定は lib/roiState.ts の RoiSnapshot に一本化し、この関数は表示だけを行う。 */
function MoneyPanel({ title, snapshot, printable, accent = false, candidateName }: { title: string; snapshot: RoiSnapshot; printable: boolean; accent?: boolean; candidateName?: string }) {
  const manYen = (v: number | null) => (v == null ? null : `${Math.round(v).toLocaleString("ja-JP")}万円`);
  const investLabel = manYen(snapshot.investManYen);
  /* 補助額・実質負担は、要件未確認のときは「算定できていない」であって0円ではない。
     subsidyState の判定は roiState 側。ここでは null に落として「—」に流すだけ。 */
  const amountLabel = snapshot.subsidyState === "unconfirmed" ? null : manYen(snapshot.subsidyManYen);
  const outOfPocketLabel = snapshot.subsidyState === "unconfirmed" ? null : manYen(snapshot.netInvestManYen);
  const recoveryLabel = snapshot.recoveryYears == null ? RECOVERY_UNKNOWN_LABEL : `約${snapshot.recoveryYears.toFixed(1)}年`;
  const dim = printable ? "text-slate-500" : "text-ink-soft";
  /* 実質負担の出所は「設備費の出所」と「補助額の出所」の弱い方に従う。
     見積確認済みの設備費から概算の補助額を引いた差額は、概算である。 */
  const netBasis: AmountBasis =
    outOfPocketLabel == null
      ? "unset"
      : snapshot.investBasis === "quoted" && snapshot.subsidyBasis === "quoted"
        ? "quoted"
        : "estimate";
  return (
    <div
      className={`rounded-xl border p-4 ${
        printable ? "border-slate-200 bg-white" : accent ? "border-brand/40 bg-[#edf6e8]" : "border-ink-line bg-paper-card"
      }`}
    >
      <h4 className={`text-sm font-bold ${printable ? "text-slate-900" : "text-ink"}`}>{title}</h4>
      {candidateName ? (
        <p className={`mt-0.5 text-xs line-clamp-2 ${printable ? "text-slate-500" : "text-ink-soft"}`}>{candidateName}</p>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 items-baseline gap-x-3 gap-y-2.5 text-xs">
        <dt className={dim}>総費用</dt>
        <AmountCell label={investLabel} basis={snapshot.investBasis} printable={printable} />
        <dt className={dim}>想定補助額</dt>
        <AmountCell label={amountLabel} basis={snapshot.subsidyBasis} printable={printable} />
        <dt className={dim}>実質負担</dt>
        <AmountCell label={outOfPocketLabel} basis={netBasis} accent={accent} printable={printable} />
        <dt className={dim}>年間削減見込み</dt>
        <dd className="text-right text-sm font-bold">
          {Math.round(snapshot.saveYenPerYear / 10000).toLocaleString("ja-JP")}万円/年
        </dd>
        <dt className={dim}>回収目安</dt>
        <dd className="text-right text-sm font-bold">{recoveryLabel}</dd>
      </dl>
      {/* 出所の説明は1枚につき1行だけ。3欄それぞれに注記を付けると読まれない。
          弱い方（未算定 > 概算 > 見積確認済み）を代表として出す。 */}
      <p className={`mt-2.5 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-ink-soft"}`}>
        {AMOUNT_BASIS_NOTE[
          investLabel == null || amountLabel == null ? "unset" : netBasis
        ]}
      </p>
      {snapshot.recoveryYears == null && snapshot.recoveryUnavailableReason ? (
        <p className={`mt-1.5 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-ink-soft"}`}>
          {snapshot.recoveryUnavailableReason}
        </p>
      ) : null}
      {investLabel == null ? (
        <p className={`mt-1.5 text-xs leading-relaxed ${printable ? "text-slate-600" : "text-ink-soft"}`}>
          {INVEST_UNKNOWN_LABEL}のため、総費用と実質負担は空欄（—）にしています。
        </p>
      ) : null}
    </div>
  );
}

function ProgramCard({ assessment: a, printable }: { assessment: ProgramAssessment; printable: boolean }) {
  const s = a.subsidy;
  const amount = a.potentialManYen;
  return (
    <article className={`rounded-xl border p-4 text-xs leading-relaxed ${printable ? "border-slate-200 bg-white text-slate-800" : "border-ink-line bg-paper-card text-ink"}`}>
      <div className="flex flex-wrap items-start gap-2"><div className="flex-1 min-w-[220px]"><h4 className={`font-bold text-sm ${printable ? "text-slate-900" : "text-ink"}`}>{s.name}</h4><p className={`text-xs mt-0.5 ${printable ? "text-slate-500" : "text-ink-soft"}`}>{s.org}・{s.programKind === "grant" ? "助成金" : "補助金"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${printable ? "bg-slate-100 text-slate-700" : s.verificationState === "verified" ? "bg-[#edf6e8] text-brand-deep" : "bg-amber-50 text-amber-800"}`}>{s.verificationState === "verified" ? "公式確認済み" : "公式要件の再確認が必要"}</span></div>
      <dl className="mt-3 grid gap-2 leading-relaxed">
        <div><dt className="font-bold inline">候補理由：</dt><dd className="inline">{a.reason}</dd></div>
        <div><dt className="font-bold inline">期限・間に合う目安：</dt><dd className="inline">{a.timing}</dd></div>
        <div><dt className="font-bold inline">補助率・上限：</dt><dd className="inline">{s.rate}／{s.max}</dd></div>
        <div><dt className="font-bold inline">対象条件：</dt><dd className="inline">{s.requirement}</dd></div>
        <div><dt className="font-bold inline">今回の概算：</dt><dd className="inline">{a.amountShown
          ? `補助額 最大約${amount.toLocaleString("ja-JP")}万円、実質負担 約${a.outOfPocketManYen.toLocaleString("ja-JP")}万円（千円未満切捨て）`
          : `未算定。${a.amountUnavailableReason ?? ""}`}</dd></div>
        <div><dt className="font-bold inline">不足情報：</dt><dd className="inline">{a.missing.length ? a.missing.join("／") : "現時点なし（申請時の最終確認は必要）"}</dd></div>
        <div><dt className="font-bold inline">次の一手：</dt><dd className="inline">{a.nextAction}</dd></div>
      </dl>
      {/* 2026-09-11 EHC-0038 第2便 4-D / 4-J
          外部リンクは cobalt-500 だったが、紙面に青が1色も無いので
          ここだけ青が残ると別サイトの部品に見える。brand-deep の下線にする。
          タップ領域は 44px から 48px へ（4-J）。 */}
      <div className={`mt-3 pt-2 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${printable ? "border-slate-200 text-slate-500" : "border-ink-line text-ink-soft"}`}><span>公式確認：{checkedLabel(s.officialCheckedAt)}</span><a href={s.sourceUrl || s.url} target="_blank" rel="noreferrer" className={`min-h-[48px] inline-flex items-center gap-1 underline font-semibold focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${printable ? "text-slate-700" : "text-brand-deep"}`}>公式情報 <ExternalLink className="w-3 h-3" /></a>{s.verificationState !== "verified" ? <span className={`inline-flex items-center gap-1 ${printable ? "text-slate-600" : "text-amber-800"}`}><AlertCircle className="w-3 h-3" />未確認情報をA判定・金額反映していません</span> : null}</div>
      {a.monitorNote && (s.verificationState !== "verified" || a.coverageGap) ? <p className={`mt-2 text-xs ${printable ? "text-slate-600" : a.coverageGap ? "text-ink-soft" : "text-amber-800"}`}>更新監視：{a.monitorNote}</p> : null}
    </article>
  );
}
