"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardTitle, SectionLabel } from "./ui/Card";
import { Field, Select, Input, Button } from "./ui/Field";
import { MatchInput, BizType, SizeType, EquipType, RefriType, EquipGroup, KwhMode, Subsidy } from "@/lib/types";
import { matchSubsidies, MatchResult, GroupResult, co2TonLabel, REDUCTION_BASIS_LABEL } from "@/lib/match";
import { BUILDING_LABELS } from "@/lib/labels";
import { ReportTeaser } from "./ReportTeaser";
import { CustomerReport } from "./CustomerReport";
import { SampleCases } from "./SampleCases";
import { GuidedDiagnosis } from "./GuidedDiagnosis";
import { DiagnosisSummary } from "./DiagnosisSummary";
import { SubsidyEligibilityChat } from "./SubsidyEligibilityChat";
import { SubsidyScreeningChat, VerdictChip, ScreeningResult } from "./SubsidyScreeningChat";
import { SampleCase } from "@/lib/samples";
import { Sparkles, BarChart3, Target, Lightbulb, Building2, User, AlertTriangle, CheckCircle2, LineChart as LineChartIcon, PieChart, Plus, Trash2, Layers, Gauge, Link2, QrCode, Printer, Wallet, ClipboardCheck, Bot } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { RoiChart, RoiChartLegend } from "./RoiChart";
import {
  SubsidyState, RoiSnapshot, buildRoiSnapshot, resolveSubsidyState,
  SUBSIDY_STATE_NOTE, INVEST_UNKNOWN_LABEL, RECOVERY_UNKNOWN_LABEL,
  yenOrUnknown, yearsOrUnknown,
  AMOUNT_BASIS_LABEL, AMOUNT_BASIS_NOTE, AMOUNT_UNSET_MARK,
} from "@/lib/roiState";
import { canShowAmount, canCombine } from "@/lib/eligibility";
import { GroupSavingsChart } from "./GroupSavingsChart";
import { useProject } from "./ProjectContext";
import { legacyAccessFromSearch, NO_LEGACY_ACCESS, type LegacyAccess } from "@/lib/legacyAccess";
import { RoadmapView } from "./RoadmapView";
import { SubsidyDisclaimer } from "./SubsidyDisclaimer";
import { INDUSTRY_PROFILES } from "@/lib/industries";
import { PROVISIONAL_COEFFICIENT_NOTE } from "@/lib/coefficients";
import { estimateInvestManYenFromGroups, estimateAnnualKwhFromGroups, roundKwhForDisplay, kwhPerHpYear, siiBuildingUse, CO2_TON_PER_KWH, MACHINE, WORK, COST_CLASS, SITE_ACCESS, DEFAULT_KG_PER_UNIT, PRICING_SOURCE, ELECTRIC_PRICE_YEN_PER_KWH, ELECTRIC_PRICE_ESTIMATE_NOTE, subsidyAmountManYen as subsidyAmountFromRate, SUBSIDY_CAP_UNKNOWN_NOTE, SUBSIDY_AMOUNT_UNKNOWN_LABEL } from "@/lib/pricing";
import { ProgramMatchBoard } from "./ProgramMatchBoard";
import { UpdateEstimator } from "./UpdateEstimator";

let GID = 0;
const newGroup = (over: Partial<EquipGroup> = {}): EquipGroup => ({
  id: `g${++GID}_${Date.now()}`,
  refri: "r410a",
  equip: "ac",
  installYear: new Date().getFullYear() - 12,
  units: 1,
  hp: undefined,
  ...over,
});

// 全47都道府県（住所文字列からの判定用）
const ALL_PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];
const PREFS = ALL_PREFS;

// 住所文字列から都道府県を検出。ドロップダウン候補にあればその値、無ければ"その他"。未検出はnull
const prefFromAddress = (address: string): string | null => {
  const hit = ALL_PREFS.find((p) => address.includes(p));
  if (!hit) return null;
  return PREFS.includes(hit) ? hit : null;
};

const programStateKey = (programs: Subsidy[]) => programs
  .map((s) => [s.id, s.status, s.verificationState, s.fetchedAt, s.rateNum, s.capManYen].join(":"))
  .join(",");

const REFRI_SHORT: Record<RefriType, string> = { r22: "R22", r410a: "R410A", r32: "R32", unknown: "冷媒不明" };
const groupLabel = (g: EquipGroup, i: number) =>
  `設備${i + 1}：${REFRI_SHORT[g.refri]}・${g.equip === "multi" ? "マルチ" : "パッケージ"}・${g.units}台`;

// 共有リンク: 入力値をURLの ?d= に埋め込み、開いた側で同じ診断を自動再現する
const encodeInput = (i: MatchInput) => {
  // 共有URLには診断条件だけを含め、氏名・連絡先・住所などの個人情報を載せない。
  const safe: MatchInput = {
    ...i,
    customerCompany: "",
    customerContact: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    ehcStaff: "",
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(safe))));
};
const decodeInput = (s: string): MatchInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(s))));
    return parsed && Array.isArray(parsed.equipGroups) && parsed.equipGroups.length ? parsed : null;
  } catch {
    return null;
  }
};

const HELP = {
  customerCompany: "診断書のヘッダーに表示されるお客様の会社名（例: 株式会社○○）。診断書PDF出力には必須です。",
  customerContact: "診断書ヘッダーに表示されるご担当者様のお名前。未定・不明の場合は空欄のままでOKです。",
  customerEmail: "診断書の送付・ご連絡に使うお客様のメールアドレス。診断書PDF出力には必須です。",
  customerPhone: "ご連絡用のお客様の電話番号。診断書PDF出力には必須です。",
  customerAddress: "お客様の所在地（住所）。都道府県を自動判定し、一都三県など地域補助金の該当可否に反映します。診断書PDF出力には必須です。",
  ehcStaff: "診断書のフッターに表示されるEHC側の担当者名（例: 桝口、伊藤）。担当者が決まっていない場合は空欄のままでOKです。",
  bizType: "EHCソリューションズは業務用（法人・事業主）専用です。個人・家庭用の空調は対象外となります。",
  size: "中小企業 = 資本金3億円以下 もしくは 従業員300人以下。多くの補助金で中小企業が優遇されます。",
  pref: "都道府県別補助金（神奈川県・大阪府・東京都等）の適用判定に使用します。",
  building: "補助金の対象用途を判定。オフィス、店舗、飲食店、ホテル、医療施設など。",
  equip: "パッケージエアコン＝屋内機1台＋屋外機1台のセット。マルチエアコン＝1台の屋外機で複数室を冷暖房するビル用システム。",
  years: "業務用空調の法定耐用年数は15年。10年を超えた機器は効率低下が大きくなり、更新と補助金活用の検討時期です（本ツールが見込む低下幅20〜40%は出典未確定の暫定値です）。",
  refri: "R22は既に製造禁止（修理部品入手困難）。R410Aは2025年で製造規制完了（修理コスト2-3倍）。R32が現行最有力。",
  kwh: "直近1年間の電力会社請求書の合計kWh。複数事業所がある場合は、空調を更新する事業所分のみで結構です。",
  invest: "今回の更新範囲（今回入れ替える設備）に限った、新空調機器の本体価格＋設置工事費の合計見積額。将来のフェーズ分や他の設備は含めません。参考：業務用パッケージ50〜150万円/台、ビル用マルチ500〜3,000万円。",
  co2: `年間電力削減量(kWh) × ${CO2_TON_PER_KWH} で概算可能。神奈川県補助金は3t/年以上が必須条件です。`,
};

export function SubsidyMatcher({ workspaceMode = false }: { workspaceMode?: boolean }) {
  const [legacyOpen, setLegacyOpen] = useState(false);
  /* 2026-09-25 UXレビュー No.3: お客様向けの画面（workspaceMode）では旧シミュレーターを出さない。
     担当者用の入口（?staff=1）と共有リンク（?d=）のときだけ出す。判定は lib/legacyAccess.ts。
     workspaceMode でない呼び出し（単体の旧画面）は従来どおり常に出す。 */
  const [legacyAccess, setLegacyAccess] = useState<LegacyAccess>(NO_LEGACY_ACCESS);
  useEffect(() => {
    const access = legacyAccessFromSearch(window.location.search);
    setLegacyAccess(access);
    if (access.sharedLink) setLegacyOpen(true);
  }, []);
  const showLegacy = !workspaceMode || legacyAccess.showLegacy;
  const [input, setInput] = useState<MatchInput>({
    bizType: "business",
    size: "sme",
    // 既定は未選択。既定値を持たせると「聞いていない条件で該当と表示する」ことになる（P0-D）
    pref: "",
    building: "office",
    equipGroups: [newGroup({ refri: "r410a", equip: "ac", installYear: new Date().getFullYear() - 12, units: 5 })],
    kwhMode: "auto",
    kwh: 80000,
    /* 2026-09-10 EHC-0038 P0-1:
       既定 500 は「聞いていない見積額を既知の500万円として扱う」ことになり、
       補助額・実質負担・回収年がそのまま出てしまっていた。
       0 は resolveInvestState() で "unknown"（未算定）として扱われるので、
       未入力のまま制度候補の診断だけを進め、金額は未算定と表示する。 */
    invest: 0,
    customerCompany: "",
    customerContact: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    ehcStaff: "",
    customerKind: "company",
    entityType: "corporation",
    updatePlan: "considering",
    desiredTiming: "undecided",
    employmentInsurance: "unknown",
    hiringOrTrainingPlan: "unknown",
    resilienceNeed: "unknown",
  });
  const [result, setResult] = useState<MatchResult | null>(null);
  // 一度でも「即答」を押したら、以降は入力変更に結果を自動連動させる
  const [hasRun, setHasRun] = useState(false);
  const [eligTrigger, setEligTrigger] = useState(0);
  const { setProject, setDraft, estimateManYen } = useProject();
  const [agreed, setAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  // プランナー②③で確定した補助金額・ご希望の補助金（提案書PDFへ反映）
  const [appliedSubsidyManYen, setAppliedSubsidyManYen] = useState<number>(0);
  const [appliedSubsidy, setAppliedSubsidy] = useState<Subsidy | null>(null);
  /* 2026-09-10 EHC-0031 F03:
     補助額の状態（未確認 / 0円 / 算定済み）も画面とPDFで共有する。
     金額だけを渡していたため、PDF側が「0円＝対象外」と自前で解釈し、
     同じ案件で画面と紙が違うことを言う状態になっていた。 */
  const [appliedSubsidyState, setAppliedSubsidyState] = useState<SubsidyState>("unconfirmed");
  const [simulationPrograms, setSimulationPrograms] = useState<Subsidy[]>([]);
  const [eligibilityScreening, setEligibilityScreening] = useState<ScreeningResult | null>(null);
  const [eligibilityScreenOpen, setEligibilityScreenOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const toastTimer = useRef<number | null>(null);

  const handleSimulationProgramsChange = useCallback((programs: Subsidy[]) => {
    setSimulationPrograms((previous) => {
      const previousKey = programStateKey(previous);
      const nextKey = programStateKey(programs);
      return previousKey === nextKey ? previous : programs;
    });
  }, []);
  const simulationProgramKey = programStateKey(simulationPrograms);
  useEffect(() => {
    setEligibilityScreening(null);
  }, [simulationProgramKey]);
  const eligibleSimulationPrograms = useMemo(() => {
    if (!eligibilityScreening || eligibilityScreening.overall !== "yes") return [];
    return simulationPrograms.filter((s) =>
      eligibilityScreening.verdictById[s.id] === "yes" &&
      eligibilityScreening.timingById[s.id]?.key !== "closed"
    );
  }, [eligibilityScreening, simulationPrograms]);

  const set = <K extends keyof MatchInput>(key: K, val: MatchInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: val }));

  /* ───────── 2026-09-11 EHC-0038 第2便 4-B ─────────
     設備投資額と「正式見積で確認済みか」は必ず同時に決める。

     別々に更新できるようにすると、次の事故が起きる。
     ① 正式見積の金額を入れて「見積確認済み」にチェック
     ② あとで金額だけを書き換える／「実勢で自動見積」を押す
     → 中身は自動概算なのに「見積確認済み」のラベルが残る
     ラベルが残った側の方が強い主張をするので、これは危ない向きの誤りである。

     そこで金額を触る経路は必ずここを通し、
     ・quoted を渡さない（＝自動見積・手入力）→ 概算へ落とす
     ・未算定（0）に戻した → 申告も消す
     を強制する。逆に「概算→見積確認済み」へ上げるのは
     利用者の明示的なチェックだけ（setInvestQuoted）。 */
  const setInvest = (manYen: number, opts?: { quoted?: boolean }) =>
    setInput((prev) => ({
      ...prev,
      invest: manYen,
      investQuoted: manYen > 0 ? (opts?.quoted ?? false) : false,
    }));

  /** 「この金額は正式見積で確認済み」の申告。金額が未算定なら立てられない */
  const setInvestQuoted = (quoted: boolean) =>
    setInput((prev) => ({ ...prev, investQuoted: prev.invest > 0 ? quoted : false }));

  // 設備グループ操作
  const addGroup = () =>
    setInput((prev) => ({ ...prev, equipGroups: [...prev.equipGroups, newGroup()] }));
  const removeGroup = (id: string) =>
    setInput((prev) => ({
      ...prev,
      equipGroups: prev.equipGroups.length > 1 ? prev.equipGroups.filter((g) => g.id !== id) : prev.equipGroups,
    }));
  const updateGroup = (id: string, patch: Partial<EquipGroup>) =>
    setInput((prev) => ({
      ...prev,
      equipGroups: prev.equipGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));

  const applySample = (sample: SampleCase) => {
    setInput((prev) => ({ ...prev, ...sample.data }));
    setSelectedSampleId(sample.id);
    setToast(`「${sample.label}」を入力欄に反映しました`);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
    // hasRun中はuseEffectが新しい入力で自動再計算する
  };

  // 共有リンク(?d=)から入力を復元し、自動で診断を再現
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("d");
    if (!d) return;
    const restored = decodeInput(d);
    if (restored) {
      setInput(restored);
      setHasRun(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildShareUrl = () =>
    `${window.location.origin}${window.location.pathname}?d=${encodeInput(input)}`;

  // ②QRコード表示（商談中にお客様のスマホで読み取り）
  const toggleQr = () => {
    if (!showQr) setShareUrl(buildShareUrl());
    setShowQr((v) => !v);
  };

  // ③提案書の印刷ビュー（顧客情報→同意の順に確認してから印刷）
  const printReport = () => {
    const required: { val: string; label: string; id: string }[] = [
      { val: input.customerCompany, label: input.customerKind === "individual" ? "お名前または屋号" : "会社名", id: "customer-company-input" },
      { val: input.customerEmail, label: "メールアドレス", id: "customer-email-input" },
      { val: input.customerPhone, label: "電話番号", id: "customer-phone-input" },
      { val: input.customerAddress, label: "住所", id: "customer-address-input" },
    ];
    const missing = required.find((r) => !(r.val ?? "").trim());
    if (missing) {
      setToast(`印刷前にお客様情報（${missing.label}）を入力してください`);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 3000);
      document.getElementById("customer-info-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      const el = document.getElementById(missing.id) as HTMLInputElement | null;
      if (el) window.setTimeout(() => el.focus(), 400);
      return;
    }
    if (!privacyAgreed) {
      setToast("個人情報の利用目的を確認し、同意後に診断書PDFを出力できます");
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 3000);
      document.getElementById("customer-info-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!agreed) {
      setToast("制度情報が概算であることを確認し、同意後に診断書PDFを出力できます");
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 3000);
      document.getElementById("agree-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    window.print();
  };

  const copyShareLink = async () => {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setToast("共有リンクをコピーしました。開くと同じ条件で診断が再現されます");
    } catch {
      window.prompt("このURLをコピーしてください:", url);
    }
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  };

  // 入力が変わるたびに結果・ROI・提案書をライブ再計算（初回即答後）
  useEffect(() => {
    if (!hasRun) return;
    if (input.bizType === "personal") {
      setResult(null);
      return;
    }
    setResult(matchSubsidies(input));
  }, [input, hasRun]);

  useEffect(() => {
    if (result) setProject(input, result);
  }, [result, input, setProject]);

  /* 「即答」前でも入力中の案件情報を下流（更新工事 見積シミュレーター）へ流す。
     これで設備群を二重入力せずに済む。確定値(input/result)は上のuseEffectのまま。 */
  useEffect(() => {
    setDraft(input);
  }, [input, setDraft]);

  const run = (checkEligibility?: boolean) => {
    if (input.bizType === "personal") {
      alert("EHCは業務用専門です。法人・事業者としてご検討ください。");
      return;
    }
    setHasRun(true);
    setResult(matchSubsidies(input));
    if (checkEligibility) setEligTrigger((n) => n + 1);
    setTimeout(() => {
      const target = workspaceMode && !legacyOpen ? "diagnosis-workspace" : "result-section";
      document.getElementById(target)?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 100);
  };

  /* ───────── 2026-09-11 EHC-0038 第2便 #14 ─────────
     3段に畳んだフォームの、畳んだままでも読める要約。
     「入っているか」を段の外から判るようにするためだけの文字列で、
     計算・判定には一切使わない。
     未入力は必ず AMOUNT_UNSET_MARK（＝「—」）にする。
     ここで 0 や "未入力" と書くと、4-B で切り分けた
     「未算定」と「算定して0」が別の場所でまた混ざる。 */
  const stepBasicFilled = input.pref !== "";
  const stepBasicSummary = stepBasicFilled
    ? `${input.pref}／${BUILDING_LABELS[input.building] ?? AMOUNT_UNSET_MARK}`
    : `所在地 ${AMOUNT_UNSET_MARK}`;

  const stepEquipUnits = input.equipGroups.reduce((a, g) => a + (g.units || 0), 0);
  /* 実測モードのときは各群の kWh 合計、自動按分モードのときは総量欄が入力の実体。
     モードによって「どこを見れば入力済みか」が違うので、要約もモードで分ける。 */
  const stepEquipKwh =
    input.kwhMode === "measured"
      ? input.equipGroups.reduce((a, g) => a + (g.kwh || 0), 0)
      : input.kwh;
  const stepEquipFilled = stepEquipUnits > 0 && stepEquipKwh > 0;
  const stepEquipSummary = `${input.equipGroups.length}系統・${stepEquipUnits}台／${
    stepEquipKwh > 0 ? `${stepEquipKwh.toLocaleString("ja-JP")}kWh` : `kWh ${AMOUNT_UNSET_MARK}`
  }`;

  const stepInvestFilled = input.invest > 0;
  const stepInvestSummary = stepInvestFilled
    ? `${input.invest.toLocaleString("ja-JP")}万円（${
        input.investQuoted ? AMOUNT_BASIS_LABEL.quoted : AMOUNT_BASIS_LABEL.estimate
      }）`
    : `${AMOUNT_UNSET_MARK}（${AMOUNT_BASIS_LABEL.unset}）`;

  return (
    <div className="space-y-5">
      {/* 画面下部は同意固定バー(bottom-0/z-40)が表示されるため、
          トーストはそれらより上（bottom-24）に出して重なりを避ける */}
      {/* 2026-08-24 監査での修正: トーストも診断結果も aria-live が無く、
          画面を見ていない人には「押したのに何も起きない」状態だった。
          トーストは role="status"、診断完了は下の読み上げ専用領域で通知する。 */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-brand-deep text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lift flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          {toast}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {result
          ? workspaceMode ? "基本条件を確認しました。候補を見る画面から、設備・結果・概算・相談の順に進めます。" : `診断が完了しました。入力条件から抽出した候補は ${result.matched.length} 件、追加確認が必要な候補は ${result.needsCheck.length} 件です。資格確定や採択を保証するものではありません。`
          : ""}
      </p>
      <div className="no-print">
      <GuidedDiagnosis input={input} setInput={setInput} onComplete={run} />
      </div>

      {workspaceMode && showLegacy && (
        <button type="button" className="ehc-legacy-toggle no-print" aria-expanded={legacyOpen} aria-controls="legacy-simulation-tools" onClick={() => setLegacyOpen((value) => !value)}>
          <span><strong>担当者用｜詳細シミュレーター・従来の帳票</strong><span>{legacyAccess.sharedLink && !legacyAccess.staff ? "共有リンクの診断内容を表示しています" : "提案書の作成・送付や、細かな条件の調整に使います（お客様向けの画面には表示されません）"}</span></span>
          <span aria-hidden="true">{legacyOpen ? "−" : "＋"}</span>
        </button>
      )}
      {/* 画面だけ畳む。ガイドはこの外に常時マウント、既存印刷DOMは保持する。 */}
      {showLegacy && (
      <div id="legacy-simulation-tools" className={workspaceMode ? "ehc-legacy-body" : undefined} data-open={legacyOpen}>

      {/* 入力順は「設備 → 診断結果 → 必要な場合だけ連絡先」。
          着地直後にいきなり必須の個人情報を求めない。お客様情報カードは診断ボタンの下にある。 */}
      <details className="no-print scroll-mt-4 rounded-2xl border border-ink-line bg-paper-card p-4" id="project-info-section">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold text-ink">
        <Building2 className="w-4 h-4 text-brand" />
        詳しい設備情報を入力する（任意）
        <span className="ml-auto text-xs font-normal text-ink-soft">精度を上げたい方向け</span>
      </summary>
      <div className="mt-4">
      <Card>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>案件情報入力</CardTitle>
        {/* 2026-09-11 EHC-0038 第2便 #14: 以下は FormStep 3段に畳む。並び順は変えない
            （①事業者・所在地 → ②設備と電力 → ③設備投資額。この順でしか後段の判定が埋まらない） */}
        <div className="space-y-2.5">
        <FormStep n="1" title="事業者・所在地" summary={stepBasicSummary} filled={stepBasicFilled} defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="事業者区分" help={HELP.bizType}>
            <Select value={input.bizType} onChange={(e) => set("bizType", e.target.value as BizType)}>
              <option value="business">法人・事業主（業務用）</option>
              <option value="personal">個人・家庭用</option>
            </Select>
          </Field>
          <Field label="企業規模" help={HELP.size}>
            <Select value={input.size} onChange={(e) => set("size", e.target.value as SizeType)}>
              <option value="sme">中小企業（資本3億円以下 or 従業員300人以下）</option>
              <option value="middle">中堅企業</option>
              <option value="large">大企業</option>
            </Select>
          </Field>
          {/* 2026-09-10 EHC-0031 P0-D:
              既定が「東京都」だったため、所在地を一度も聞いていない案件でも
              東京都の地域制度が「該当」として金額付きで並んでいた。
              未選択を既定にして、lib/eligibility.ts の
              「所在地（都道府県）が未入力のため、地域要件を判定できません。」
              を正しく通らせる。 */}
          <Field label="所在地（都道府県）" help={HELP.pref}>
            <Select value={input.pref} onChange={(e) => set("pref", e.target.value)}>
              <option value="">選択してください</option>
              {PREFS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="建物用途" help={HELP.building}>
            <Select value={input.building} onChange={(e) => set("building", e.target.value)}>
              <option value="office">オフィス・事務所</option>
              <option value="retail">小売店舗</option>
              <option value="restaurant">飲食店</option>
              <option value="hotel">ホテル・宿泊</option>
              <option value="medical">医療・福祉</option>
              <option value="school">学校・教育</option>
              <option value="other">その他事業所</option>
            </Select>
          </Field>
        </div>
        </FormStep>

        <FormStep n="2" title="空調設備と電力使用量" summary={stepEquipSummary} filled={stepEquipFilled}>
        {/* 設備系統／同一仕様グループ（複数機種対応） */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand" /> 設備系統／同一仕様グループ
            </div>
            <button onClick={addGroup} type="button" className="min-h-[48px] text-xs px-2.5 py-1 rounded-md border border-brand/40 text-brand-deep hover:bg-[#edf6e8] flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 別の系統・機種を追加
            </button>
          </div>
          <details className="text-xs text-ink-soft bg-paper-sub border border-ink-line rounded-lg p-2.5 mb-2 leading-relaxed">
            <summary className="cursor-pointer font-bold text-brand-deep">入力方法を見る｜年式・機器が系統ごとに違う場合</summary>
            <div className="mt-2 space-y-1.5">
              <p><strong className="text-ink">1行の単位：</strong>同じ系統、または型式・設置年・馬力が同じ機器だけをまとめます。どれかが違えば「別の系統・機種を追加」で行を分けます。</p>
              <p><strong className="text-ink">確認場所：</strong>室外機側面の銘板にある「型式・製造年・冷媒・能力」を確認します。室外機全体と銘板をスマホで撮っておくと、EHC担当が後から補完できます。</p>
              <p><strong className="text-ink">分からない場合：</strong>冷媒は「不明」、馬力は空欄、設置年はおおよそで仮診断できます。正式な補助金判定・見積前に現地調査で確定します。</p>
            </div>
          </details>
          <div className="space-y-2">
            {input.equipGroups.map((g, index) => (
              <GroupRow
                key={g.id}
                index={index}
                g={g}
                canRemove={input.equipGroups.length > 1}
                onChange={(p) => updateGroup(g.id, p)}
                onRemove={() => removeGroup(g.id)}
              />
            ))}
          </div>
        </div>

        {/* 年間電力使用量の入力方法 */}
        <div className="mt-5">
          <div className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-brand" /> 年間電力使用量(kWh)の入力方法
          </div>
          <div className="flex gap-1 p-1 bg-paper-sub border border-ink-line rounded-lg w-fit mb-3">
            {([["auto", "総量を自動按分"], ["measured", "実測値を入力(エニマス等)"]] as [KwhMode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => set("kwhMode", m)}
                className={`min-h-[48px] inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md transition-colors ${input.kwhMode === m ? "bg-brand-deep text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {input.kwhMode === "auto" ? (
            <Field label="年間総電力使用量 (kWh)" help={HELP.kwh}>
              <div className="flex gap-2">
                <Input type="number" value={input.kwh} onChange={(e) => set("kwh", Number(e.target.value))} />
                <button
                  type="button"
                  /* 2026-09-11 EHC-0038 P0-9:
                     estimateAnnualKwhFromGroups は馬力が未入力の設備群があると null を返す
                     （以前は 4馬力と仮置きして数字を出していた）。null のときは欄を書き換えず、
                     ボタン自体も押せないようにして、下に理由を出す。 */
                  onClick={() => {
                    const v = estimateAnnualKwhFromGroups(input.equipGroups, input.building);
                    if (v != null) set("kwh", roundKwhForDisplay(v));
                  }}
                  disabled={estimateAnnualKwhFromGroups(input.equipGroups, input.building) == null}
                  className="min-h-[48px] whitespace-nowrap text-xs px-2.5 rounded-lg border border-brand/40 text-brand-deep hover:bg-[#edf6e8] disabled:opacity-40 disabled:cursor-not-allowed"
                  title="電気代の請求書が手元にないときの目安値を、設備グループの馬力×台数から自動で入れます（SII省エネ量計算 指定計算より試算）。馬力が未入力の設備群があるときは算定しません。"
                >
                  一般値で自動計算
                </button>
              </div>
              {input.equipGroups.some((g) => (g.units ?? 0) > 0) &&
                estimateAnnualKwhFromGroups(input.equipGroups, input.building) == null && (
                  <p className="mt-2 text-xs text-amber-800">
                    馬力が未入力の設備群があるため自動計算できません。馬力を入れるか、請求書の実数値を手入力してください（分からない馬力を仮置きして試算することはしません）。
                  </p>
                )}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-brand/35 bg-[#edf6e8] px-3 py-2 text-ink">
                  <strong className="block text-brand-deep mb-0.5">請求書・実測値がある</strong>
                  直近1年のkWhを手入力してください。こちらを優先します。
                </div>
                <div className="rounded-lg border border-ink-line bg-paper-sub px-3 py-2 text-ink">
                  <strong className="block text-brand-deep mb-0.5">数値が分からない</strong>
                  「一般値で自動計算」で設備情報から目安を入れられます。
                </div>
              </div>
              <details className="mt-2 rounded-lg border border-ink-line bg-paper-sub px-3 py-2 text-xs text-ink-soft">
                <summary className="cursor-pointer font-semibold text-ink">自動計算の方法・根拠を見る</summary>
                <div className="mt-2 space-y-1.5 leading-relaxed">
                  <p>入力値は各設備系統へ「台数×馬力」で按分します。馬力未入力の場合は台数で按分します。</p>
                  <p>自動計算は、建物用途「{siiBuildingUse(input.building) === "office" ? "事務所" : "店舗"}」で、1馬力あたり約<strong className="text-ink">{roundKwhForDisplay(kwhPerHpYear(input.building)).toLocaleString()}kWh/年</strong>を使用します（表示は1kWh単位に丸めた値で、計算はSIIの算出値のまま行います）。馬力が未入力の設備群があるときは、馬力を仮置きせず自動計算を行いません。</p>
                  <p>根拠：SII「省エネルギー量計算の手引き【電気式パッケージエアコン】」の指定計算、既存設備参考値、JIS B 8616 東京の平均負荷率・稼働変換率、SII既定運転時間を使用。平均COP比は1.0の安全側です。</p>
                </div>
              </details>
            </Field>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-ink-soft bg-paper-sub border border-ink-line rounded-lg p-2.5">
                各設備グループのエニマス等デマンド実測値（kWh/年）を下の欄に入力してください。合計が年間総使用量になります。
              </div>
              <div className="space-y-1.5">
                {input.equipGroups.map((g, i) => (
                  <div key={g.id} className="flex items-center gap-2 bg-paper-sub border border-ink-line rounded-lg px-2.5 py-2">
                    <div className="text-xs text-ink flex-1 min-w-0 truncate">{groupLabel(g, i)}</div>
                    <input
                      aria-label={`${groupLabel(g, i)} の実測電力量(kWh/年)`}
                      type="number"
                      inputMode="numeric"
                      value={g.kwh ?? ""}
                      placeholder="実測kWh/年"
                      onChange={(e) => updateGroup(g.id, { kwh: e.target.value ? Number(e.target.value) : undefined })}
                      className="min-h-[48px] w-40 px-2 py-1.5 border border-brand/40 rounded-md text-xs bg-paper-card text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                    />
                    <span className="text-xs text-ink-soft w-8">kWh</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-ink-soft text-right pr-1">
                合計:{" "}
                <span className="text-brand-deep font-semibold">
                  {input.equipGroups.reduce((a, g) => a + (g.kwh || 0), 0).toLocaleString("ja-JP")}
                </span>{" "}
                kWh/年
              </div>
            </div>
          )}
        </div>

        </FormStep>

        <FormStep n="3" title="設備投資額（見積）" summary={stepInvestSummary} filled={stepInvestFilled}>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="今回更新分の設備投資概算 (万円・税抜)" help={HELP.invest}>
            {/* 2026-09-10 EHC-0038 P0-1:
                未算定（0）のときに value=0 を出すと「0万円と見積もった」ように読める。
                未算定は空欄で表す。空欄・非数値も 0（=未算定）へ戻す。 */}
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="未入力（未算定）"
                value={input.invest > 0 ? input.invest : ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setInvest(e.target.value === "" || !Number.isFinite(n) || n <= 0 ? 0 : n);
                }}
              />
              <button
                type="button"
                onClick={() => setInvest(estimateInvestManYenFromGroups(input.equipGroups))}
                disabled={!input.equipGroups.some((g) => (g.units ?? 0) > 0)}
                className="min-h-[48px] whitespace-nowrap text-xs px-2.5 rounded-lg border border-brand/40 text-brand-deep hover:bg-[#edf6e8] disabled:opacity-40 disabled:cursor-not-allowed"
                title="設備グループの馬力×台数から、PN実勢単価（機器費＋撤去・据付・配管・電気・産廃・諸経費）で総額を自動概算します"
              >
                実勢で自動見積
              </button>
            </div>
            {/* ───────── 2026-09-11 EHC-0038 第2便 4-B ─────────
                金額の出所（未算定／概算／見積確認済み）を画面・PDFへ出す仕組みは
                lib/roiState.ts に入れていたが、「見積確認済み」へ上げる入口が
                どこにも無く、実際には到達できない状態だった。
                入れる場所はここしかない ─ 金額を入れた直後、その金額を見ながら
                答えられる位置である。別セクションに置くと、金額と申告が離れて
                「どの金額のことか」が分からなくなる。

                この値は計算に一切使わない。ラベルだけを変える。
                だからこそ迷ったら外す（＝概算）側に倒す。 */}
            <label className="mt-2 flex items-start gap-2.5 rounded-lg border border-ink-line bg-paper-sub px-3 py-2.5 cursor-pointer has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
              <input
                type="checkbox"
                checked={input.investQuoted === true && input.invest > 0}
                disabled={!(input.invest > 0)}
                onChange={(e) => setInvestQuoted(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-brand flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
              />
              <span className="text-xs leading-relaxed text-ink">
                <strong className="block text-ink mb-0.5">
                  {AMOUNT_BASIS_LABEL.quoted}（この金額は業者の正式見積で確認しています）
                </strong>
                <span className="text-ink-soft">
                  {input.invest > 0
                    ? `外したままだと「${AMOUNT_BASIS_LABEL.estimate}」として表示します。${AMOUNT_BASIS_NOTE.quoted}`
                    : "設備投資額を入力すると選べます。"}
                </span>
              </span>
            </label>
            <div className="mt-2 rounded-lg border border-brand/35 bg-[#edf6e8] px-3 py-2.5 text-xs leading-relaxed text-ink">
              <strong className="block text-brand-deep mb-0.5">ここに入れる金額</strong>
              今回入れ替える設備だけの総額を<strong className="text-ink">万円・税抜</strong>で入力します。正式見積があれば手入力、なければ「実勢で自動見積」を使います。
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-ink-line bg-paper-sub px-3 py-2 text-ink-soft">
                <strong className="block text-ink mb-0.5">この金額から計算</strong>
                補助額・実質負担・回収年数・PDFへ共通反映
              </div>
              <div className="rounded-lg border border-amber-500/45 bg-amber-50 px-3 py-2 text-amber-900">
                <strong className="block text-amber-900 mb-0.5">含めないもの</strong>
                将来分・別棟・別会社分。正式見積がある場合は自動見積より優先
              </div>
            </div>
            <details className="mt-2 rounded-lg border border-ink-line bg-paper-sub px-3 py-2 text-xs text-ink-soft">
              <summary className="cursor-pointer font-semibold text-ink">自動見積の内訳・単価根拠を見る</summary>
              <div className="mt-2 space-y-1.5 leading-relaxed">
                <p>設備系統の馬力×台数から、機器費、撤去、据付、配管、電気、フロン回収・破壊、産廃、諸経費を積算します。明細は下の「更新工事 見積シミュレーター」で確認できます。</p>
                <p>機器費：基礎{MACHINE.base.standard.toLocaleString()}円＋{MACHINE.perHp.standard.toLocaleString()}円/馬力。{MACHINE.highHpThreshold}馬力超は+{MACHINE.highHpPerHp.standard.toLocaleString()}円/馬力、最低{MACHINE.min.toLocaleString()}円/台。</p>
                <p>工事：撤去 室内{(WORK.removeIndoorPerUnit / 10000).toFixed(1)}万＋室外{(WORK.removeOutdoorPerUnit / 10000).toFixed(1)}万/台、据付 室内{(WORK.installIndoorPerUnit / 10000).toFixed(1)}万＋室外{(WORK.installOutdoorPerUnit / 10000).toFixed(1)}万/台、配管{(WORK.pipingPerUnit / 10000).toFixed(1)}万/台、電気{(WORK.electricPerUnit / 10000).toFixed(1)}万/台。</p>
                <p>フロン回収{(WORK.gasRecoverPerSystem / 10000).toFixed(1)}万/系統、破壊{WORK.gasDestroyPerKg.toLocaleString()}円/kg（{DEFAULT_KG_PER_UNIT}kg/台）、産廃{(WORK.wastePerCubicMeter / 10000).toFixed(1)}万/㎥（{WORK.wasteVolPerUnit}㎥/台）、諸経費は工事小計×{Math.round(WORK.overheadRate * 100)}%（下限{(WORK.overheadMin / 10000).toFixed(0)}万円）。</p>
                <p>根拠：{PRICING_SOURCE}。工事明細の中央値と碓井さんの校正（2026-07）を反映し、機器費は下位25%水準の安全側です。標準グレード（{COST_CLASS.standard.label}・係数{COST_CLASS.standard.factor}）で計算します。</p>
              </div>
            </details>
            <details className="mt-2 rounded-lg border border-amber-500/45 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <summary className="cursor-pointer font-semibold text-amber-900">自動見積に含まれない費用を見る</summary>
              <p className="mt-2 leading-relaxed">足場（{SITE_ACCESS.scaffoldFloorThreshold}階以上は原則必要）、高所作業車（{(SITE_ACCESS.aerialLiftPerDay / 10000).toFixed(0)}万円/日）、配管更新・リモコン・養生・夜間休日割増、アスベスト、電源増設、キュービクル等。現地調査で確定します。</p>
            </details>
            {estimateManYen != null && (
              estimateManYen === input.invest ? (
                <div className="mt-1.5 text-xs text-brand-deep bg-[#edf6e8] border border-brand/35 rounded-lg px-2 py-1.5">
                  ✓ 下の見積シミュレーターの小計（{estimateManYen.toLocaleString("ja-JP")}万円・税抜）と一致しています。
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInvest(estimateManYen)}
                  className="min-h-[48px] mt-1.5 w-full text-left text-xs text-amber-900 bg-amber-50 border border-amber-500/45 rounded-lg px-2 py-1.5 hover:bg-amber-100"
                >
                  ↑ 下の見積シミュレーターの小計は <strong>{estimateManYen.toLocaleString("ja-JP")}万円（税抜）</strong> です。クリックでこの欄に取り込む
                </button>
              )
            )}
          </Field>
          <div className="flex items-end">
            <div className="text-xs text-ink-soft bg-paper-sub border border-ink-line rounded-lg p-2.5 w-full">
              CO2削減量は削減kWhから自動計算されます（排出係数 {CO2_TON_PER_KWH} t-CO₂/kWh・省エネ効果レポートと同一係数）。神奈川県補助金の3t/年要件も自動判定。
            </div>
          </div>
        </div>
        </FormStep>
        </div>
        {/* ↑ 3段の畳み。以下（業務用の注意・即答ボタン・共有/印刷）は
            畳まない。押せるボタンが畳みの中に隠れると、開かなかった人が
            そもそも診断を実行できない。 */}
        {input.bizType === "personal" && (
          <div className="bg-amber-50 border border-amber-500/45 text-amber-800 p-4 rounded-xl text-sm mt-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              EHCソリューションズは <strong>業務用専用</strong> です。個人・家庭用空調は対象外となります。
            </div>
          </div>
        )}
        <Button onClick={() => run()} className="mt-5">
          <Sparkles className="w-5 h-5" />
          {hasRun ? "再計算（最新の入力で更新）" : "即答（マッチング & 診断書生成）"}
        </Button>
        {hasRun && (
          <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              ライブ更新中：各項目を変更すると結果・ROI・診断書が自動で再計算されます
            </div>
            <button
              type="button"
              onClick={copyShareLink}
              className="min-h-[48px] text-xs px-2.5 py-1 rounded-md border border-brand/40 text-brand-deep hover:bg-[#edf6e8] flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" /> この診断の共有リンクをコピー
            </button>
            <button
              type="button"
              onClick={toggleQr}
              className={`min-h-[48px] text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 ${showQr ? "border-brand bg-[#edf6e8] text-brand-deep" : "border-brand/40 text-brand-deep hover:bg-[#edf6e8]"}`}
            >
              <QrCode className="w-3.5 h-3.5" /> QRでスマホに送る
            </button>
            <button
              type="button"
              onClick={printReport}
              className="min-h-[48px] text-xs px-2.5 py-1 rounded-md border border-brand/40 text-brand-deep hover:bg-[#edf6e8] flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> 診断書を印刷 / PDF
            </button>
          </div>
        )}
        {hasRun && showQr && shareUrl && (
          <div className="mt-3 flex flex-col items-center gap-2 animate-fade-in">
            <div className="bg-white p-3 rounded-xl shadow-lift">
              <QRCodeSVG value={shareUrl} size={168} level="M" fgColor="#0a0a0a" bgColor="#ffffff" />
            </div>
            <div className="text-xs text-ink-soft text-center">
              お客様のスマホカメラで読み取ると、この診断結果がそのまま開きます
              <br />（入力を変えた場合は一度閉じて再表示してください）
            </div>
          </div>
        )}
      </Card>
      </div>
      </details>

      {result && (
        <div id="result-section" className="space-y-5">
          {/* 2026-09-08 NEOレビュー差し戻しでの修正:
              ここだけ no-print が抜けており、印刷すると画面用のダークな「制度マッチング結果」が
              1ページ目に出て、診断書内の同じセクション（CustomerReport の printable 版）と二重になっていた。 */}
          <div className="no-print">
            <ProgramMatchBoard input={input} result={result} onSimulationProgramsChange={handleSimulationProgramsChange} />
          </div>
          <div className="no-print rounded-2xl border border-ink-line bg-paper-card p-4 md:p-5">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="w-5 h-5 text-brand-deep mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-ink">該当条件診断</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  基本条件で絞った制度について、発注・着工前か、指定機器、必要書類、GビズIDなどを5問で確認します。
                  診断を通過した制度だけを下の補助率欄とシミュレーションに表示します。
                </p>
                {simulationPrograms.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-ink-line bg-paper-sub px-3 py-2.5 text-xs text-ink-soft">
                    現在の入力条件で、受付中または受付予定かつ公式確認済みの設備補助制度はありません。
                  </div>
                ) : eligibilityScreening ? (
                  <div className={`mt-3 rounded-xl border px-3 py-3 ${eligibilityScreening.overall === "yes" ? "border-brand/40 bg-[#edf6e8]" : eligibilityScreening.overall === "maybe" ? "border-amber-500/45 bg-amber-50" : "border-red-600/45 bg-red-50"}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className={`text-xs font-bold ${eligibilityScreening.overall === "yes" ? "text-brand-deep" : eligibilityScreening.overall === "maybe" ? "text-amber-900" : "text-red-800"}`}>
                        {eligibilityScreening.overall === "yes"
                          ? `該当見込み ${eligibleSimulationPrograms.length}件をシミュレーションへ反映`
                          : eligibilityScreening.overall === "maybe"
                            ? "不足情報があるため、補助金はまだ自動反映しません"
                            : "現在の回答では対象外の可能性が高いため、補助金は反映しません"}
                      </div>
                      <button type="button" onClick={() => setEligibilityScreenOpen(true)} className="min-h-[48px] inline-flex items-center text-xs text-brand-deep underline underline-offset-2">診断をやり直す</button>
                    </div>
                    {eligibleSimulationPrograms.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-ink">
                        {eligibleSimulationPrograms.map((s) => <li key={s.id}>・{s.name}（{s.rate}）{s.verificationState === "verified" ? "" : "／公式情報の再確認が必要"}</li>)}
                      </ul>
                    )}
                  </div>
                ) : (
                  <button type="button" onClick={() => setEligibilityScreenOpen(true)} className="mt-3 min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-bold text-white hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
                    <ClipboardCheck className="w-4 h-4" /> 該当するか5問で診断する
                  </button>
                )}
              </div>
            </div>
          </div>
          {eligibilityScreenOpen && simulationPrograms.length > 0 && (
            <SubsidyScreeningChat
              input={input}
              candidates={simulationPrograms}
              onDone={(screeningResult) => {
                setEligibilityScreening(screeningResult);
                setEligibilityScreenOpen(false);
              }}
              onClose={() => setEligibilityScreenOpen(false)}
            />
          )}
          <div className="no-print">
            <UpdateEstimator
              eligiblePrograms={eligibleSimulationPrograms}
              diagnosisComplete={Boolean(eligibilityScreening)}
            />
          </div>
          <details className="no-print overflow-hidden rounded-2xl border border-ink-line bg-paper-card p-4">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold text-ink">
              <LineChartIcon className="w-4 h-4 text-brand" />
              実質負担・ROI・設備診断を詳しく見る
              <span className="ml-auto text-xs font-normal text-ink-soft">制度確認の後に利用</span>
            </summary>
            <div className="mt-4 space-y-5">
          <DiagnosisSummary
            input={input}
            result={result}
            appliedSubsidyManYen={appliedSubsidyManYen}
            appliedSubsidy={appliedSubsidy}
            subsidyState={appliedSubsidyState}
          />
          <ResultView
            result={result}
            input={input}
            eligTrigger={eligTrigger}
            onApplied={(manYen, subsidy, state) => {
              setAppliedSubsidyManYen(manYen);
              setAppliedSubsidy(subsidy);
              setAppliedSubsidyState(state);
            }}
          />
          <div className="no-print">
            {/* 独立タブを廃止し、入力完了＝結果表示と同時にフル版ロードマップを出す。
                appliedSubsidy を渡すことで、選択中の制度とタイムラインが一致する。 */}
            <RoadmapView input={input} result={result} appliedSubsidy={appliedSubsidy} />
          </div>
          <div className="no-print">
            <SubsidyDisclaimer />
          </div>
            </div>
          </details>

          {/* 診断結果を先に見せ、PDF作成・送付・相談を希望する人だけ連絡先を入力する。 */}
          <div className="no-print" id="customer-info-section">
          <Card className={!privacyAgreed ? "border-2 border-brand/50" : ""}>
            <CardTitle icon={<User className="w-5 h-5" />}>診断書PDF・相談（任意）</CardTitle>
            <p className="text-xs text-ink-soft -mt-2 mb-4 leading-relaxed">
              匿名の診断結果はここまでで確認できます。PDF診断書の作成・送付やEHCへの相談を希望する場合だけ入力してください。
              <strong className="text-amber-800">*</strong> はPDF作成に必要です。
            </p>
            <div className="mb-4">
              <div className="text-xs font-semibold text-ink mb-1.5">診断書の宛名</div>
              <div className="flex gap-1 p-1 bg-paper-sub border border-ink-line rounded-lg w-fit">
                {([ ["company", "法人・団体"], ["individual", "個人事業主"] ] as const).map(([kind, label]) => (
                  <button key={kind} type="button" onClick={() => set("customerKind", kind)} className={`min-h-[48px] inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md ${input.customerKind === kind ? "bg-brand-deep text-white" : "text-ink-soft"}`}>{label}</button>
                ))}
              </div>
              {input.customerKind === "individual" && <p className="text-xs text-amber-800 mt-1.5">個人事業主の事業用空調が対象です。家庭用空調は対象外です。</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label={`${input.customerKind === "individual" ? "お名前または屋号" : "お客様会社名"} *`} help={HELP.customerCompany}>
                <Input id="customer-company-input" value={input.customerCompany} onChange={(e) => set("customerCompany", e.target.value)} placeholder={input.customerKind === "individual" ? "例: 山田 太郎 / 山田商店" : "例: 株式会社○○"} />
              </Field>
              <Field label="メールアドレス *" help={HELP.customerEmail}>
                <Input id="customer-email-input" type="email" value={input.customerEmail ?? ""} onChange={(e) => set("customerEmail", e.target.value)} placeholder="例: info@example.co.jp" />
              </Field>
              <Field label="電話番号 *" help={HELP.customerPhone}>
                <Input id="customer-phone-input" type="tel" value={input.customerPhone ?? ""} onChange={(e) => set("customerPhone", e.target.value)} placeholder="例: 03-1234-5678" />
              </Field>
              <div className="md:col-span-2">
                <Field label="住所 *" help={HELP.customerAddress}>
                  <Input id="customer-address-input" value={input.customerAddress ?? ""} onChange={(e) => { const v = e.target.value; const p = prefFromAddress(v); setInput((prev) => ({ ...prev, customerAddress: v, ...(p ? { pref: p } : {}) })); }} placeholder="例: 東京都新宿区西新宿1-1-1 ○○ビル3F" />
                </Field>
                {(input.customerAddress ?? "").trim() && (prefFromAddress(input.customerAddress) ? <p className="text-xs text-brand-deep mt-1">住所から「{prefFromAddress(input.customerAddress)}」と判定し、地域制度に反映しました。</p> : <p className="text-xs text-amber-800 mt-1">都道府県を判定できません。所在地欄で選択してください。</p>)}
              </div>
              <Field label="ご担当者名" help={HELP.customerContact}><Input value={input.customerContact} onChange={(e) => set("customerContact", e.target.value)} placeholder="例: 田中" /></Field>
              <Field label="EHC担当" help={HELP.ehcStaff}><Input value={input.ehcStaff} onChange={(e) => set("ehcStaff", e.target.value)} placeholder="例: 桝口" /></Field>
            </div>
            <div className="mt-4 rounded-xl border border-ink-line bg-paper-sub p-4 text-xs text-ink leading-relaxed">
              <p><strong className="text-ink">取得目的：</strong>入力情報と診断結果を、宛名入りPDFの作成・送付、相談への回答、EHCおよび施工連携先PNでの顧客対応・診断履歴の管理に使用します。</p>
              <p className="mt-1"><strong className="text-ink">送信範囲：</strong>PDF出力だけでは自動送信しません。出力後に「相談記録として送信」を選んだ場合のみ、EHC・PNへ送信し管理記録へ追加します。</p>
              <p className="mt-1"><strong className="text-ink">注意：</strong>制度の採択・受給・補助額、削減効果を保証するものではありません。</p>
              <label className="mt-3 min-h-[48px] flex items-start gap-2.5 cursor-pointer text-sm text-ink">
                <input type="checkbox" checked={privacyAgreed} onChange={(e) => setPrivacyAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 accent-brand flex-shrink-0" />
                <span>上記の取得目的・利用範囲・送信条件を確認し、PDF作成と、私が送信を選んだ場合の相談記録への登録に同意します。</span>
              </label>
            </div>
            <a href="mailto:info@ehcjpn.com?subject=EHC%20補助金診断の相談" className="mt-4 inline-flex items-center justify-center w-full rounded-xl border border-brand/40 bg-[#edf6e8] px-4 py-3 text-sm font-bold text-brand-deep hover:bg-[#dfeed6]">入力せず、まずEHCへ相談する</a>
          </Card>
          </div>

          <div id="agree-section" className="no-print">
          <Card className={!agreed ? "border-2 border-amber-400/70 ring-2 ring-amber-400/20" : ""}>
            <label className="min-h-[48px] flex items-start gap-2.5 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  if (e.target.checked && privacyAgreed) {
                    setTimeout(() => document.getElementById("customer-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
                  }
                }}
                className="mt-0.5 w-5 h-5 accent-amber-400 flex-shrink-0"
              />
              <span>上記の補助金情報・実質負担・準備期間・「間に合うか」が<strong className="text-ink">あくまで目安</strong>であり、採択・受給を保証せず、最新条件は公式の公募要領で確認する必要があることを理解しました。</span>
            </label>
          </Card>
          </div>
          {agreed && privacyAgreed && (
            <div id="customer-report" className="scroll-mt-4">
              <CustomerReport
                input={input}
                result={result}
                appliedSubsidyManYen={appliedSubsidyManYen}
                appliedSubsidy={appliedSubsidy}
                subsidyState={appliedSubsidyState}
              />
            </div>
          )}

          {/* 同意するまで画面下に固定するバー（見落とし防止）。押すと同意→提案書表示へ */}
          {(!agreed || !privacyAgreed) && (
            <div className="no-print">
              <div className="bg-paper-sub border border-amber-400/50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="relative flex h-3 w-3 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
                </span>
                <p className="text-[13px] text-ink leading-snug flex-1">
                  <strong className="text-ink">PDF診断書を希望する方へ。</strong> 利用目的と概算条件の2つを確認してください。
                </p>
                <button
                  onClick={() => {
                    setTimeout(() => {
                      const el = document.getElementById(!privacyAgreed ? "customer-info-section" : "agree-section");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 150);
                  }}
                  className="min-h-[48px] flex-shrink-0 bg-amber-400 hover:bg-amber-500 text-ink font-bold text-sm px-4 py-2.5 rounded-xl shadow-card transition-all whitespace-nowrap"
                >
                  同意内容を確認
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      )}
    </div>
  );
}

/* ───────── 2026-09-11 EHC-0038 第2便 #14 ─────────
   詳細フォームを3段に畳む。

   直前の状態は「詳しい設備情報を入力する（任意）」という1枚の <details> の中に
   ・事業者区分／企業規模／所在地／建物用途
   ・設備系統グループ（可変行）＋ 年間電力使用量（2モード）
   ・設備投資額（手入力／自動見積／見積確認済みの申告／内訳3つ）
   が連続で並んでいた。開いた瞬間に入力欄が20個以上出てくるので、
   初めて触る人には「どこから書けばいいのか」が分からない。
   どこまで書いたかも見えないため、途中でやめた人が戻ってこられない。

   そこで3段に分け、各段の見出しに【いま何が入っているか】を出す。
   開かずに充足状況が読めるようにするのが目的なので、summary の右側に
   要約を必ず出す（未入力なら AMOUNT_UNSET_MARK ＝「—」）。
   ここで「未入力」を 0 や空文字で表すと、4-B で分けたばかりの
   「未算定」と「算定して0」が画面の別の場所でまた混ざる。

   既定の開閉は ①だけ開く。②③を既定で開くと畳んだ意味が無くなり、
   全部閉じると外側を開いた人がもう一度3回押すことになる。
   ①は選択肢を選ぶだけで済み、ここを埋めると地域制度の判定が動き出すので
   最初に目に入るべき段である。

   計算・丸め・null・適格性ゲートには一切触らない（表示の入れ物だけ）。 */
function FormStep({
  n,
  title,
  summary,
  filled,
  defaultOpen = false,
  children,
}: {
  n: string;
  title: string;
  /** 畳んだままでも読める要約。未入力は「—」を渡す */
  summary: string;
  /** 要約が「入力済み」を指しているか。色分けにのみ使う */
  filled: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-ink-line bg-paper-sub">
      <summary className="cursor-pointer list-none min-h-[48px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex-shrink-0">
          {n}
        </span>
        <span className="text-sm font-bold text-ink">{title}</span>
        {/* 4-B: 未入力は「—」。0 と書くと「0と見積もった」と読まれる */}
        <span
          className={`ml-auto text-xs text-right ${filled ? "text-brand-deep font-semibold" : "text-ink-soft"}`}
        >
          {summary}
        </span>
      </summary>
      <div className="px-3 pb-3.5 pt-1 border-t border-ink-line">{children}</div>
    </details>
  );
}

// 設備グループ1行の編集UI
function GroupRow({
  index,
  g,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  g: EquipGroup;
  canRemove: boolean;
  onChange: (p: Partial<EquipGroup>) => void;
  onRemove: () => void;
}) {
  const cls = "min-h-[48px] px-2 py-1.5 border border-ink-line rounded-md text-xs bg-paper-card text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep w-full";
  return (
    <div className="bg-paper-sub border border-ink-line rounded-lg p-2.5">
      <div className="mb-2 text-xs font-bold text-brand-deep">系統・機種 {index + 1}</div>
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
        {/* 2026-08-24 監査での修正: 項目名の <label> が入力欄の「兄弟」で、
            htmlFor も無かったため支援技術からは名前のない入力欄に見えていた。
            <label> で入力欄を包み込む（暗黙の関連付け）方式に変える。
            また同じ行が「系統・機種 1」「系統・機種 2」と複数並ぶので、
            項目名だけでは何番目のものか分からない。aria-label に系統番号を足す。
            見た目は変わらない。 */}
        <div className="md:col-span-3">
          <label className="block">
            <span className="text-xs text-ink-soft">冷媒</span>
            <select aria-label={`系統・機種 ${index + 1} の冷媒`} className={cls} value={g.refri} onChange={(e) => onChange({ refri: e.target.value as RefriType })}>
              <option value="r22">R22（最旧・製造禁止）</option>
              <option value="r410a">R410A（1世代前）</option>
              <option value="r32">R32（現行）</option>
              <option value="unknown">不明</option>
            </select>
          </label>
        </div>
        <div className="md:col-span-3">
          <label className="block">
            <span className="text-xs text-ink-soft">種別</span>
            <select aria-label={`系統・機種 ${index + 1} の種別`} className={cls} value={g.equip} onChange={(e) => onChange({ equip: e.target.value as EquipType })}>
              <option value="ac">パッケージ</option>
              <option value="multi">マルチ(ビル用)</option>
            </select>
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="block">
            <span className="text-xs text-ink-soft">設置年(西暦)</span>
            <input aria-label={`系統・機種 ${index + 1} の設置年(西暦)`} type="number" className={cls} value={g.installYear} onChange={(e) => onChange({ installYear: Number(e.target.value) })} />
          </label>
        </div>
        <div className="md:col-span-1">
          <label className="block">
            <span className="text-xs text-ink-soft">台数</span>
            <input aria-label={`系統・機種 ${index + 1} の台数`} type="number" className={cls} value={g.units} onChange={(e) => onChange({ units: Number(e.target.value) })} />
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="block">
            <span className="text-xs text-ink-soft">馬力</span>
            <input aria-label={`系統・機種 ${index + 1} の馬力（任意）`} type="number" className={cls} value={g.hp ?? ""} placeholder="任意" onChange={(e) => onChange({ hp: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
        </div>
        <div className="md:col-span-1 flex justify-end">
          <button type="button" onClick={onRemove} disabled={!canRemove} aria-label={`系統・機種 ${index + 1} を削除`} className={`min-h-[48px] min-w-[48px] inline-flex items-center justify-center p-1.5 rounded-md ${canRemove ? "text-red-700 hover:bg-red-50" : "text-ink-line cursor-not-allowed"}`} title="削除">
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* 補助金の想定交付額(万円)。情報提供のみ(infoOnly)は資金化しない。
   2026-08-24 監査での修正:
     ここに `Math.min(invest * s.rateNum, s.capManYen)` という3つ目の実装があり、
     千円未満切捨てをしていなかった。同じ制度の金額が
     診断結果・制度マッチング・シミュレーションで別々の値になっていた原因。
     計算は lib/pricing.ts の1本に統一する。 */
/* 2026-09-10 EHC-0038 P0-7:
     算定できないとき（投資額が未算定／補助上限が未確認）は null を返す。
     0 を返すと「補助額0円と算定できた制度」と区別が付かなくなる。 */
function subsidyAmountManYen(s: Subsidy, invest: number): number | null {
  if (s.infoOnly) return null;
  return subsidyAmountFromRate(invest, s.rateNum, s.capManYen);
}
// 要件文（。区切り）をチェックリスト項目に分割
function splitRequirements(req: string): string[] {
  return req.split("。").map((t) => t.trim()).filter((t) => t.length > 0);
}

/* ───────────────────────────────────────────────────────────
   2026-09-10 EHC-0031 UI-01
   「補助金を適用しない」「①の補助金」「②の補助金」の3列比較。

   設計上の約束（崩すと数字が嘘になる）:
   ・①② は該当見込みの制度を補助額の大きい順に上位2件まで。
     3件目以降を並べない理由は情報量ではなく、選ぶのが客の仕事だから。
   ・**合算しない。** 併用可否は各制度の公募要領の定めで、こちらでは
     断定できない（lib/eligibility.ts canSumAmounts / canCombine）。
     3列は「どれか1つを選ぶ」ための比較であって、足し算のためではない。
   ・金額・回収年数はすべて buildRoiSnapshot() から受け取る。
     このコンポーネントでは一切割り算をしない（F03: 画面とPDFで
     別々に再計算した結果、同じ案件で違う数字が出た事故の再発防止）。
   ・設備投資額が未算定なら金額欄を作らない。¥0 と書くと
     「無償で更新できる」と読まれる（F01）。
   ─────────────────────────────────────────────────────────── */
type ScenarioTone = "none" | "first" | "second";

interface ScenarioRow {
  /** 制度ID。補助金なしの行は "no-subsidy" */
  key: string;
  badge: string;
  title: string;
  sub: string;
  tone: ScenarioTone;
  /** ガイド診断の結果。未診断と「該当見込み」を同じ見え方にしない */
  screened: "yes" | "maybe" | "unscreened";
  snapshot: RoiSnapshot;
}

const SCENARIO_TONE: Record<ScenarioTone, { wrap: string; badge: string; amount: string; sub: string }> = {
  none: {
    wrap: "border-ink-line bg-paper-sub",
    badge: "bg-paper-pill text-ink border border-ink-line",
    amount: "text-ink",
    sub: "text-ink-soft",
  },
  first: {
    /* 2026-09-11 EHC-0038 第2便 4-G:
       ダーク時代は「緑のグラデーション＋発光」で①を前に出していた。
       白い紙の上ではグラデーションは単に汚れとして見えるので、
       HomeV17 の結論面と同じ淡いセージ（paper-tint）の単色にする。 */
    wrap: "border-brand/45 bg-paper-tint shadow-soft",
    badge: "bg-brand-deep text-white border border-brand-deep",
    amount: "text-brand-deep",
    sub: "text-ink-soft",
  },
  second: {
    /* 2026-09-10 EHC-0031 UI-02:
       ②は当初コバルト（青）で塗っていた。色を変えると別の性質のもののように
       見えるが、①②はどちらも「使えるかもしれない補助金」で性質は同じである。
       違いは金額の大小だけなので、色は変えず、面を塗るか塗らないかで区別する。
       ①=塗る（金額が大きい） ②=枠線だけ。 */
    wrap: "border-brand/35 bg-paper-card shadow-soft",
    badge: "bg-[#edf6e8] text-brand-deep border border-brand/35",
    amount: "text-brand-deep",
    sub: "text-ink-soft",
  },
};

function ScenarioColumn({ row }: { row: ScenarioRow }) {
  const t = SCENARIO_TONE[row.tone];
  const s = row.snapshot;
  return (
    <div className={`rounded-xl border p-4 ${t.wrap}`}>
      <div className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tracking-wide ${t.badge}`}>
        {row.badge}
      </div>
      <div className="mt-2 text-xs font-semibold text-ink leading-snug min-h-[2.5rem]">{row.title}</div>
      <div className={`text-xs ${t.sub}`}>{row.sub}</div>

      <div className="mt-3 pt-3 border-t border-ink-line space-y-2.5">
        <div>
          <div className="text-xs text-ink-soft">想定補助金</div>
          <div className={`text-sm font-bold ${row.tone === "none" ? "text-ink-soft" : t.amount}`}>
            {row.tone === "none" ? "なし（¥0）" : yenOrUnknown(s.subsidyManYen)}
          </div>
        </div>
        <div>
          <div className="text-xs text-ink-soft">実質負担額</div>
          <div className={`text-2xl font-bold tracking-tight ${t.amount}`}>{yenOrUnknown(s.netInvestManYen)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-soft">投資回収年数</div>
          <div className={`text-sm font-bold ${row.tone === "none" ? "text-ink" : t.amount}`}>
            {yearsOrUnknown(s.recoveryYears)}
          </div>
        </div>
      </div>

      {row.tone !== "none" && (
        <div
          className={`mt-3 text-xs leading-snug ${row.screened === "yes" ? "text-brand-deep" : "text-amber-800"}`}
        >
          {row.screened === "yes"
            ? "ガイド診断: 該当見込み"
            : row.screened === "maybe"
            ? "ガイド診断: 要確認（EHCが実態を確認します）"
            : "ガイド診断前（該当可否は未確認）"}
        </div>
      )}
    </div>
  );
}

function ScenarioCompare({
  rows,
  combineNote,
  screeningDone,
}: {
  rows: ScenarioRow[];
  combineNote: string | null;
  /* 2026-09-10 EHC-0031 UI-03:
     ガイド診断を通したかどうか。①②が0件のとき、
     「まだ診断していない」のか「診断した結果、該当が無い」のかで
     客がとるべき行動が正反対になるため、両者を同じ文面にしない。 */
  screeningDone: boolean;
}) {
  const investUnknown = rows[0].snapshot.investState === "unknown";
  const subsidyRows = rows.length - 1;
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold text-ink mb-1 flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5 text-brand" />
        補助金を適用しない場合 / 適用できた場合
      </div>
      <p className="text-xs text-ink-soft mb-3">
        該当見込みの制度を補助額の大きい順に並べています。数字はいずれも概算で、交付決定を保証するものではありません。
      </p>

      {investUnknown ? (
        <div className="rounded-xl border border-amber-500/45 bg-amber-50 p-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            「今回更新分の設備投資概算」が未入力のため、比較する金額を算定していません。
            投資額を入力するか、下の「更新工事 見積シミュレーター」で概算を作ると、3つの場合の実質負担額と回収年数が並びます。
          </p>
        </div>
      ) : (
        /* 2026-09-11 EHC-0038 第2便 4-A:
           列数を md:grid-cols-3 で数えていたため、768px では1列 240px 前後になり
           「¥12,340,000」が2行に割れていた。桁が折り返した金額は比較に使えない。
           列数を数えるのをやめ、入れ物の幅 280px を下限にして
           入る数だけ並べる（auto-fit）。①②が0〜2件で変動するので
           固定列数より素直に効く。横に並べ始めるのは lg 以上に限る。 */
        <div className="grid grid-cols-1 gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {rows.map((r) => (
            <ScenarioColumn key={r.key} row={r} />
          ))}
        </div>
      )}

      {!investUnknown && subsidyRows === 0 && (
        /* 2026-09-10 EHC-0031 UI-03 SHINICHIさん指摘:
           「該当する補助金がないならないで出さないと」
           空欄や未算定だけを並べて終わらせず、どちらの状態かを言い切る。 */
        screeningDone ? (
          <div className="mt-2.5 rounded-xl border border-ink-line bg-paper-sub px-3.5 py-3">
            <p className="text-xs font-bold text-ink">現在の条件に該当する補助金はありません。</p>
            <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
              ガイド診断の結果、金額の根拠を出せる制度がありませんでした。
              上の「補助金を適用しない場合」が、今回そのまま判断材料になります。
              所在地・事業規模・設備種別・導入時期が変わると結果が変わることがあるため、次回公募の発表後に再診断してください。
            </p>
          </div>
        ) : (
          <p className="text-xs text-amber-800 mt-2 leading-relaxed">
            いま比較できるのは自己負担の場合だけです。上の「補助金プランを選ぶ」で①希望の有無 →
            ②ガイド診断まで進めると、①②の補助金の金額が入ります。
          </p>
        )
      )}
      {!investUnknown && subsidyRows === 1 && (
        <p className="text-xs text-ink-soft mt-2 leading-relaxed">
          現在の条件では、金額の根拠を出せる制度が1件です（②はありません）。
        </p>
      )}
      {subsidyRows >= 2 && (
        <p className="text-xs text-ink-soft mt-2.5 leading-relaxed">
          ①②は<strong className="text-ink">どちらか一方を選ぶ前提</strong>で並べています。金額は足し合わせていません。
          {combineNote ? `　${combineNote}` : ""}
        </p>
      )}
    </div>
  );
}

function ResultView({ result, input, eligTrigger = 0, onApplied }: { result: MatchResult; input: MatchInput; eligTrigger?: number; onApplied?: (manYen: number, subsidy: Subsidy | null, subsidyState: SubsidyState) => void }) {
  const [view, setView] = useState<"overall" | "groups">("overall");

  // ===== 補助金プランナー（希望有無 / 希望する補助金 / 要件クリア可否 で ROI に連動） =====
  const fundable = useMemo(
    () => result.matched.filter((s) => !s.infoOnly),
    [result.matched]
  );
  const bestId = useMemo(() => {
    let id = "";
    let best = -1;
    fundable.forEach((s) => {
      const a = subsidyAmountManYen(s, input.invest);
      if (a == null) return; // 算定できない制度は「最大額」の候補にしない（P0-7）
      if (a > best) {
        best = a;
        id = s.id;
      }
    });
    return id;
  }, [fundable, input.invest]);

  const [wantSubsidy, setWantSubsidy] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reqChecks, setReqChecks] = useState<Record<string, boolean[]>>({});
  const [eligChatOpen, setEligChatOpen] = useState(false);
  // ② 全制度まとめての該当診断（これを終えるまで「適用可能な補助金」は出さない）
  const [screenOpen, setScreenOpen] = useState(false);
  const [screening, setScreening] = useState<ScreeningResult | null>(null);

  // マッチ結果が変わったら、選択を最適補助金へ同期。要件は未確認(false)から始める。
  useEffect(() => {
    setSelectedId((prev) => (fundable.some((s) => s.id === prev) ? prev : bestId));
    setReqChecks((prev) => {
      const next = { ...prev };
      fundable.forEach((s) => {
        const n = splitRequirements(s.requirement).length;
        if (!next[s.id] || next[s.id].length !== n) next[s.id] = Array(n).fill(false);
      });
      return next;
    });
  }, [fundable, bestId]);

  // マッチする制度の顔ぶれが変わったら診断結果は無効化（前提が変わっているため）
  const matchedKey = result.matched.map((s) => s.id).join(",");
  useEffect(() => {
    setScreening(null);
  }, [matchedKey]);

  // ガイド診断から該当チェックを指定された場合は、最有力候補の個別要件を開く
  useEffect(() => {
    if (eligTrigger > 0 && bestId) {
      setWantSubsidy(true);
      setSelectedId(bestId);
      setEligChatOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligTrigger]);

  const selected = fundable.find((s) => s.id === selectedId) || null;
  // 候補は要件確認前にも比較できるよう全件を表示する
  const visibleFundable = fundable;
  const selectedReqs = selected ? splitRequirements(selected.requirement) : [];
  const selectedChecks = (selected && reqChecks[selected.id]) || [];
  const allReqMet = selectedChecks.length > 0 && selectedChecks.every(Boolean);
  const selectedScreeningOk = Boolean(
    selected &&
    screening &&
    screening.verdictById[selected.id] === "yes" &&
    screening.timingById[selected.id]?.key !== "closed"
  );
  /* 2026-09-10 EHC-0038 P0-7:
     補助額が算定できないとき（補助上限が未確認・投資額が未算定）は null。
     要件を満たしていても「確認済みの0円」にはしない＝未確認のまま扱う。 */
  const selectedAmountManYen = selected ? subsidyAmountManYen(selected, input.invest) : null;
  // 実際にROI・グラフへ反映する補助金額
  const appliedSubsidyManYen =
    wantSubsidy && selected && selectedScreeningOk && allReqMet && selectedAmountManYen != null
      ? selectedAmountManYen
      : 0;
  /* 2026-09-10 EHC-0031 F02: 補助額の「確認が済んでいるか」を金額と別に持つ。
     ・補助金を希望しない＝自己負担で進めるという確定した判断 → 算定0円
     ・希望しているが要件・受付状況が未確認 → 未確認（0円ではない）
     金額が 0 かどうかでこの区別を付けてはいけない。 */
  const subsidyConfirmed =
    !wantSubsidy || Boolean(selected && selectedScreeningOk && allReqMet && selectedAmountManYen != null);
  // 確定した補助金額・ご希望の補助金を親（提案書PDF）へ反映
  const appliedSubsidyForReport = wantSubsidy && selected && selectedScreeningOk && allReqMet ? selected : null;
  const subsidyState = resolveSubsidyState({ confirmed: subsidyConfirmed, amountManYen: appliedSubsidyManYen });
  useEffect(() => {
    onApplied?.(appliedSubsidyManYen, appliedSubsidyForReport, subsidyState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSubsidyManYen, appliedSubsidyForReport, subsidyState]);

  const toggleReq = (i: number) => {
    if (!selected) return;
    setReqChecks((prev) => {
      const arr = [...(prev[selected.id] || [])];
      arr[i] = !arr[i];
      return { ...prev, [selected.id]: arr };
    });
  };

  /* 2026-09-10 EHC-0031 F01/F03:
     実質負担額・回収年数・比較表は、この1つのスナップショットだけを読む。
     設備投資額が未算定（空欄→Number("")=0 を含む）のときは 0 ではなく null に
     なるので、「¥0」「0年」という誤った即答が構造的に出せない。
     提案書PDFにも同じ判定を渡す（PDF側で再判定・再計算しない）。 */
  const roi = buildRoiSnapshot({
    investManYen: input.invest,
    subsidyConfirmed,
    subsidyManYen: appliedSubsidyManYen,
    saveYenPerYear: result.saveYenPerYear,
    /* 2026-09-11 EHC-0038 第2便 4-B:
       渡すのは表示ラベル（概算／見積確認済み）のためだけ。
       渡し忘れると常に「概算」になる＝控えめな側へ倒れるので安全だが、
       それでは申告しても画面が変わらないので、ここで必ず渡す。 */
    investQuoted: input.investQuoted,
  });
  const netInvestYen = roi.netInvestManYen == null ? null : roi.netInvestManYen * 10000;
  const horizons = [5, 10, 15].map((y) => {
    const cum = result.saveYenPerYear * y;
    return { y, cum, net: netInvestYen == null ? null : cum - netInvestYen };
  });
  const totalKwhForChart = result.totalKwh || input.kwh;
  // ①実質負担額の即答: 補助なし回収年数との比較
  const investYen = roi.investManYen == null ? null : roi.investManYen * 10000;
  const subsidyYen = roi.subsidyManYen == null ? null : roi.subsidyManYen * 10000;
  const yearsNoSubsidy = roi.recoveryYearsNoSubsidy;
  const appliedYearsToRecover = roi.recoveryYears;
  const yearsShortened =
    yearsNoSubsidy !== null && appliedYearsToRecover !== null
      ? Math.round((yearsNoSubsidy - appliedYearsToRecover) * 10) / 10
      : null;

  /* 2026-09-10 EHC-0031 UI-01: 「補助金なし」「①」「②」の3列比較データ。
     ①② の選び方:
       1. 金額の根拠を出してよい制度だけ（canShowAmount。infoOnly・needs_check は除外）
       2. 受付終了・対象外と診断された制度を落とす
       3. 該当見込み(yes) → 要確認(maybe) の順、同順位内は補助額の大きい順
       4. 上位2件まで
     ガイド診断前は 2 で落とせないので「診断前」と明示して並べる。
     金額を隠すと比較の目的を果たさず、確定と見せると嘘になる。 */
  const scenarioRows = useMemo<ScenarioRow[]>(() => {
    const snap = (subsidyManYen: number) =>
      buildRoiSnapshot({
        investManYen: input.invest,
        subsidyConfirmed: true,
        subsidyManYen,
        saveYenPerYear: result.saveYenPerYear,
        investQuoted: input.investQuoted,
      });
    const base: ScenarioRow = {
      key: "no-subsidy",
      badge: "補助金を適用しない",
      title: "自己負担で更新する場合",
      sub: "補助金の申請なし",
      tone: "none",
      screened: "unscreened",
      snapshot: snap(0),
    };
    const EXCLUDE = 9;
    const priority = (id: string): number => {
      if (!screening) return 1;
      if (screening.timingById[id]?.key === "closed") return EXCLUDE;
      const v = screening.verdictById[id];
      return v === "yes" ? 0 : v === "maybe" ? 1 : EXCLUDE;
    };
    const picked = fundable
      .filter((s) => canShowAmount(result.eligibility[s.id]))
      .map((s) => ({ s, amt: subsidyAmountManYen(s, input.invest), p: priority(s.id) }))
      /* 2026-09-10 EHC-0038 P0-7: amt が null＝算定できていない。比較列に並べない */
      .filter((x): x is { s: Subsidy; amt: number; p: number } => x.amt != null && x.amt > 0 && x.p < EXCLUDE)
      .sort((a, b) => a.p - b.p || b.amt - a.amt)
      .slice(0, 2);
    return [
      base,
      ...picked.map<ScenarioRow>((x, i) => ({
        key: x.s.id,
        badge: i === 0 ? "① の補助金" : "② の補助金",
        title: x.s.name,
        sub: `補助率 ${x.s.rate} ／ 上限 ${x.s.max}`,
        tone: i === 0 ? "first" : "second",
        screened: !screening ? "unscreened" : screening.verdictById[x.s.id] === "yes" ? "yes" : "maybe",
        snapshot: snap(x.amt),
      })),
    ];
    /* 2026-09-14 EHC-0039: input.investQuoted が依存配列に無かった。
       snap() はこの値を buildRoiSnapshot に渡していて、
       「概算」か「見積確認済み」かの表示（AMOUNT_BASIS_LABEL）を左右する。
       依存が欠けていると、利用者が「正式見積で確認済み」に切り替えても
       比較表の行だけ古い snapshot を保持し、同じ画面の中で
       ヒーロー側は「見積確認済み」、比較表は「概算」と表示が食い違う。
       lint 抑制ではなく依存を足して直す（抑制するとこの食い違いが残る）。 */
  }, [fundable, result.eligibility, result.saveYenPerYear, input.invest, input.investQuoted, screening]);

  /* ①②の併用可否はこちらで断定しない。断定できないものを「併用可」と
     表示すると返還リスクを客に負わせる（lib/eligibility.ts canCombine）。 */
  const combineNote = useMemo(() => {
    const ids = scenarioRows.filter((r) => r.tone !== "none").map((r) => r.key);
    return ids.length >= 2 ? canCombine(ids[0], ids[1]).reason : null;
  }, [scenarioRows]);

  return (
    <div className="space-y-5 no-print">
      {/* 実質負担額ヒーロー（即答の主役） */}
      {/* 2026-09-11 EHC-0038 第2便 4-G:
          ここは「緑のグラデーション＋右上の発光ブロブ＋落ち影」で作られていた。
          いずれも黒地から面を浮かせるための道具で、白い紙の上では
          汚れた緑の帯と灰色の滲みとして見える。淡いセージの単色に置き換え、
          ブロブは要素ごと削除する（装飾であって意味を持たないため）。
          文字寄せのために付いていた relative / overflow-hidden も不要になる。 */}
      <div className="rounded-2xl border border-brand/40 bg-paper-tint p-5 md:p-6 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div>
            {/* 4-H: tracking-widest（0.1em）は日本語だと字が離れて読みにくい。詰める */}
            <div className="text-xs text-brand font-semibold mb-1">補助金適用後の実質負担額</div>
            {/* F01: 未算定は金額として表示しない。¥0 と書けば「無償で更新できる」と読まれる */}
            <div className={roi.investState === "known" ? "text-4xl md:text-5xl font-bold text-ink tracking-tight" : "text-2xl md:text-3xl font-bold text-amber-800 tracking-tight"}>
              {roi.investState === "known" ? yenOrUnknown(roi.netInvestManYen) : INVEST_UNKNOWN_LABEL}
            </div>
            {/* ───────── 2026-09-11 EHC-0038 第2便 4-B ─────────
                この数字が「概算」か「見積確認済み」かを数字のすぐ下に出す。
                同じ「¥8,600,000」が、こちらの一般値試算でも業者見積でも
                まったく同じ見た目をしていた。数日後に画面を見た人は
                どちらだったか思い出せない。
                「比較中」「未算定」とは別の軸なので、位置も見た目も分ける
                （こちらは金額の出所、あちらは算定できたか否か）。 */}
            {roi.investState === "known" && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                    roi.investBasis === "quoted"
                      ? "bg-[#edf6e8] text-brand-deep border-brand/40"
                      : "bg-paper-pill text-ink-soft border-ink-line"
                  }`}
                >
                  設備投資額：{AMOUNT_BASIS_LABEL[roi.investBasis]}
                </span>
                <span className="text-xs text-ink-soft">{AMOUNT_BASIS_NOTE[roi.investBasis]}</span>
              </div>
            )}
            <div className="text-xs text-ink-soft mt-2">
              {roi.investState === "known" ? (
                <>
                  設備投資 {yenOrUnknown(roi.investManYen)} − 想定補助金{" "}
                  <span className="text-brand-deep font-semibold">
                    {roi.subsidyState === "unconfirmed" ? "未確認" : yenOrUnknown(roi.subsidyManYen)}
                  </span>
                  {subsidyYen !== null && subsidyYen > 0 && investYen !== null && investYen > 0 && (
                    <span className="ml-1.5 text-brand-deep font-semibold">
                      （{Math.round((subsidyYen / investYen) * 100)}%オフ）
                    </span>
                  )}
                </>
              ) : (
                <>「今回更新分の設備投資概算」が未入力です。金額を入れるか、更新工事の概算見積を反映すると実質負担額を算定します。</>
              )}
            </div>
            <div className="text-xs text-ink-soft mt-1.5 leading-relaxed">{SUBSIDY_STATE_NOTE[roi.subsidyState]}</div>
            {roi.subsidyState === "positive" && selected ? (
              <div className="mt-2 inline-flex items-start gap-1.5 bg-[#edf6e8] border border-brand/40 rounded-lg px-2.5 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand flex-shrink-0 mt-0.5" />
                <span className="text-xs text-brand-deep font-semibold leading-snug">
                  適用中の補助金：{selected.name}（補助率 {selected.rate}）
                </span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-amber-800">
                {roi.subsidyState === "unconfirmed"
                  ? "補助金は未反映（下の「補助金プランを選ぶ」で補助金を選び、要件にチェックを入れてください）"
                  : "補助金なし（自己負担）で試算中"}
              </div>
            )}
          </div>
          <div className="bg-paper-sub border border-ink-line rounded-xl p-4">
            {/* 2026-09-10 EHC-0031 F01/F02:
                回収年数が出せないときは「—」で終わらせず理由を出す。
                また分岐条件は金額の正負ではなく補助額の状態で判定する
                （0.5万円の補助を「補助金なし」側に落とさない）。 */}
            {roi.subsidyState === "positive" ? (
              <>
                <div className="text-xs text-ink-soft mb-2">投資回収年数の比較</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-ink-soft">補助金なし</div>
                    <div className="text-xl font-bold text-ink line-through decoration-red-400/60">
                      {yearsOrUnknown(yearsNoSubsidy)}
                    </div>
                  </div>
                  <div className="text-brand text-xl font-bold">→</div>
                  <div>
                    <div className="text-xs text-brand-deep">補助金あり</div>
                    <div className="text-3xl font-bold text-brand-deep">{yearsOrUnknown(appliedYearsToRecover)}</div>
                  </div>
                  {yearsShortened !== null && yearsShortened > 0 && (
                    <div className="ml-auto bg-[#edf6e8] border border-brand/40 text-brand-deep text-xs font-bold px-2.5 py-1.5 rounded-lg">
                      {yearsShortened}年 短縮
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-ink-soft mb-2">
                  投資回収年数
                  {roi.subsidyState === "unconfirmed" ? "（補助金は未確認のため未反映）" : "（自己負担）"}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-ink">{yearsOrUnknown(yearsNoSubsidy)}</div>
                  <div className="text-xs text-ink-soft">電気代削減で回収</div>
                </div>
                {wantSubsidy && (
                  <div className="text-xs text-amber-800 mt-2">
                    補助金を反映すると回収年数が短縮されます（下で補助金を選択）
                  </div>
                )}
              </>
            )}
            {roi.recoveryUnavailableReason && (
              <p className="text-xs text-amber-800 mt-2 leading-relaxed">{roi.recoveryUnavailableReason}</p>
            )}
          </div>
        </div>
      </div>

      {/* 補助金プランナー：希望有無 → 補助金選択 → 要件クリア可否 でグラフ連動 */}
      <Card>
        <CardTitle icon={<Wallet className="w-5 h-5" />}>補助金プランを選ぶ</CardTitle>
        <p className="text-xs text-ink-soft -mt-1 mb-3">
          ①希望の有無 → ②ガイド式診断（該当可否＋公募時期）→ ③どの補助金 → ④要件クリア可否 の順に進みます。
          切り替えると下のグラフ・実質負担額・回収年数、および「候補となる補助金」が自動で連動します。
        </p>

        {/* ① 希望しますか */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-ink mb-1.5">① 今回は補助金を希望しますか？</div>
          <div className="flex gap-1 p-1 bg-paper-sub border border-ink-line rounded-lg w-fit flex-wrap">
            {([[true, "希望する"], [false, "希望しない（自己負担で更新）"]] as [boolean, string][]).map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setWantSubsidy(v)}
                className={`min-h-[48px] inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md transition-colors ${wantSubsidy === v ? "bg-brand-deep text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {wantSubsidy ? (
          fundable.length ? (
            <>
              {/* ② 全制度まとめてガイド式診断（可否＋公募時期） */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-ink mb-1.5">② まず、補助金に該当するかガイド式で確認します</div>
                {screening ? (
                  <div className="rounded-xl border border-ink-line bg-paper-card p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {screening.overall === "yes" ? (
                          <span className="text-brand-deep flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> 診断済み：該当見込み
                          </span>
                        ) : screening.overall === "maybe" ? (
                          <span className="text-amber-800 flex items-center gap-1.5">
                            <ClipboardCheck className="w-4 h-4" /> 診断済み：要確認
                          </span>
                        ) : (
                          <span className="text-red-700 flex items-center gap-1.5">
                            <ClipboardCheck className="w-4 h-4" /> 診断済み：対象外の可能性
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setScreenOpen(true)}
                        className="min-h-[48px] inline-flex items-center text-xs text-brand-deep hover:underline"
                      >
                        診断をやり直す
                      </button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {result.matched.map((s) => {
                        const t = screening.timingById[s.id];
                        return (
                          <div key={s.id} className="flex items-start justify-between gap-2 text-xs">
                            <span className="text-ink leading-snug">{s.name}</span>
                            <span className="text-ink-soft flex-shrink-0">{t ? t.label : "日程未定"}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-ink-soft mt-2">
                      導入予定時期のご回答：{screening.planHorizon}。詳細は下の「候補となる補助金」でご確認ください。
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-brand/35 bg-[#f4faf0] p-3">
                    {/* 2026-09-10 EHC-0031 P0-A: 「判定済み」という断定をやめる。
                        判定できるのは入力済みの項目だけで、未入力の項目は判定していない。 */}
                    <p className="text-xs text-ink leading-relaxed mb-2.5">
                      所在地・事業規模・対象設備は、入力済みの内容から判定できる範囲を反映しています。
                      <strong className="text-brand-deep">共通の前提条件（発注前か・機種・書類・GビズID等）と公募時期</strong>
                      を5問のガイドで確認し、該当見込みをまとめて判定します。
                    </p>
                    <button
                      type="button"
                      onClick={() => setScreenOpen(true)}
                      className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-deep text-white text-xs font-bold hover:bg-brand transition-colors"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      補助金に該当するかガイド診断する
                    </button>
                  </div>
                )}
              </div>

              {screenOpen && (
                <SubsidyScreeningChat
                  input={input}
                  candidates={result.matched}
                  onDone={(r) => {
                    setScreening(r);
                    setScreenOpen(false);
                  }}
                  onClose={() => setScreenOpen(false)}
                />
              )}

              {/* ③ どの補助金（②のガイド診断を終えてから表示） */}
              <div className={`mb-4 ${screening ? "" : "hidden"}`}>
                <div className="text-xs font-semibold text-ink mb-1.5">③ どの補助金を希望しますか？</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {visibleFundable.map((s) => {
                    const amt = subsidyAmountManYen(s, input.invest);
                    const active = s.id === selectedId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={`text-left rounded-xl border p-3 transition-colors ${active ? "border-brand bg-[#edf6e8]" : "border-ink-line bg-paper-card hover:border-brand/40"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-ink leading-snug">{s.name}</div>
                          {active && <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-ink-soft mt-1">補助率 {s.rate} ／ 上限 {s.max}</div>
                        {/* 2026-09-10 EHC-0038 P0-7: 算定できないときは ¥0 と書かない */}
                        <div className="text-sm font-bold text-brand-deep mt-1">
                          {amt == null ? `想定 ${SUBSIDY_AMOUNT_UNKNOWN_LABEL}` : `想定 ¥${(amt * 10000).toLocaleString("ja-JP")}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ④ 要件クリア可否（②のガイド診断を終えてから表示） */}
              {screening && selected && (
                <div className="bg-paper-sub border border-ink-line rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4 text-brand" />
                      ④ これらの要件はクリアできますか？（外すと非該当として計算）
                    </div>
                    <button
                      type="button"
                      onClick={() => setEligChatOpen(true)}
                      className="min-h-[48px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-deep text-white text-xs font-bold hover:bg-brand transition-colors"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      チャットで該当を確認
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {selectedReqs.map((r, i) => (
                      <label key={i} className="min-h-[48px] flex items-start gap-2 text-xs text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedChecks[i] ?? false}
                          onChange={() => toggleReq(i)}
                          className="mt-0.5 w-4 h-4 accent-brand flex-shrink-0"
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                  <div
                    className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${allReqMet ? "bg-[#edf6e8] border border-brand/40 text-brand-deep" : "bg-amber-50 border border-amber-500/45 text-amber-800"}`}
                  >
                    {allReqMet && selectedScreeningOk && selectedAmountManYen != null
                      ? `共通診断と個別要件を確認済み → この補助金 ¥${(selectedAmountManYen * 10000).toLocaleString("ja-JP")} を概算として反映中`
                      : allReqMet && selectedScreeningOk
                      ? `共通診断と個別要件は確認済みですが、${SUBSIDY_CAP_UNKNOWN_NOTE}`
                      : allReqMet
                      ? "個別要件はチェック済みですが、共通診断が「要確認／対象外」または受付終了のため、補助金は反映していません。"
                      : "未確認の個別要件があります → 補助金なし（自己負担）で試算中。確認できた項目だけチェックしてください。"}
                  </div>
                  <p className="text-xs text-ink-soft mt-2">必要書類: {selected.docs}</p>
                </div>
              )}

              {selected && eligChatOpen && (
                <SubsidyEligibilityChat
                  subsidy={selected}
                  input={input}
                  reqs={selectedReqs}
                  onApply={(checks) => {
                    setReqChecks((prev) => ({ ...prev, [selected.id]: checks }));
                    setEligChatOpen(false);
                  }}
                  onClose={() => setEligChatOpen(false)}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              現在の条件でマッチする資金化可能な補助金がありません。所在地・規模・建物用途を変更するか、「希望しない」で自己負担の試算ができます。
            </p>
          )
        ) : (
          /* 2026-09-10 EHC-0031 F02:
             緑線は「補助金あり」が算定できたときだけ描く実装に変えたため、
             「補助金なしと同じ位置になります」という説明は事実と合わなくなった。
             状態の説明は lib/roiState.ts の SUBSIDY_STATE_NOTE に一本化する。 */
          <p className="text-sm text-ink-soft leading-relaxed">{SUBSIDY_STATE_NOTE[subsidyState]}</p>
        )}
      </Card>

      <Card>
        {/* 2026-09-10 EHC-0031 UI-02: メインページと同じ見出しの型で並び順を示す */}
        <SectionLabel>SIMULATION 01 ── 投資回収</SectionLabel>
        <CardTitle icon={<BarChart3 className="w-5 h-5" />} iconTone="ehc">
          ROI シミュレーション
        </CardTitle>

        {/* 2026-09-10 EHC-0031 UI-01: 補助金なし／①／② の3列比較を最上部に置く。
            「補助金を使うと何がどう変わるか」が、この画面で最初に読みたい情報。 */}
        <ScenarioCompare rows={scenarioRows} combineNote={combineNote} screeningDone={!!screening} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-4">
          {/* 2026-09-10 EHC-0031 F02: 「未確認」を¥0と書かない。
              金額が0円であることと、まだ算定していないことは別の情報。
              2026-09-10 UI-02: 未確認・未算定のときだけ橙にする。 */}
          <RoiBox
            label="想定補助金"
            value={roi.subsidyState === "unconfirmed" ? "未確認" : yenOrUnknown(roi.subsidyManYen)}
            tone="green"
            unavailable={roi.subsidyState === "unconfirmed" || roi.subsidyManYen == null}
          />
          {/* F01: 算定できないときは「計算不能」で終わらせず、理由を下段に必ず出す（§後述の注記） */}
          <RoiBox
            label="損益分岐(投資回収)"
            value={yearsOrUnknown(appliedYearsToRecover)}
            tone="green"
            unavailable={appliedYearsToRecover === null}
          />
          <RoiBox label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} />
          <RoiBox label="15年間累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} />
          {/* 2026-09-11 EHC-0038 P0-10:
              未算定を「0 t/年」と書かない。3t境界は丸めずに桁を増やして出す
              （2.96tを3.0tと表示したまま「3t未満で対象外」と言わないため）。 */}
          <RoiBox
            label="CO₂削減(自動)"
            value={co2TonLabel(result.co2ReductionTon, "t/年")}
            tone="green"
            unavailable={result.co2ReductionTon === null}
          />
        </div>

        {/* 投資効果 比較表（5/10/15年・損益分岐） */}
        <div className="mt-4 bg-paper-sub border border-ink-line rounded-xl p-4">
          <div className="text-xs font-semibold text-ink mb-2.5 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-brand" /> 投資効果 比較表（実質投資{" "}
            {roi.netInvestManYen == null ? INVEST_UNKNOWN_LABEL : yenOrUnknown(roi.netInvestManYen)}＝設備投資−補助金）
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-soft border-b border-ink-line">
                  <th className="text-left py-1.5 pr-2">期間</th>
                  <th className="text-right py-1.5 px-2">累計電気代削減</th>
                  <th className="text-right py-1.5 px-2">純便益（削減−実質投資）</th>
                  <th className="text-right py-1.5 pl-2">投資対効果</th>
                </tr>
              </thead>
              <tbody>
                {horizons.map((h) => (
                  <tr key={h.y} className="border-b border-ink-line">
                    <td className="py-1.5 pr-2 text-ink font-semibold">{h.y}年</td>
                    <td className="py-1.5 px-2 text-right text-ink">¥{h.cum.toLocaleString("ja-JP")}</td>
                    {/* 2026-09-10 EHC-0031 F01:
                        実質投資が未算定のとき、従来は net=cum（投資0円）として
                        「全額が純便益」という表になっていた。算定できない欄は空にする。 */}
                    {h.net == null ? (
                      <td className="py-1.5 px-2 text-right text-amber-800 font-semibold">{RECOVERY_UNKNOWN_LABEL}</td>
                    ) : (
                      <td className={`py-1.5 px-2 text-right font-bold ${h.net >= 0 ? "text-brand-deep" : "text-red-700"}`}>
                        {h.net >= 0 ? "+" : "−"}¥{Math.abs(h.net).toLocaleString("ja-JP")}
                      </td>
                    )}
                    {/* 2026-09-10 EHC-0031 UI-02: アクセントは緑1色に寄せる。
                        補助情報の列を青で塗ると、緑（良い）橙（未算定）の対比が薄まる。 */}
                    <td className="py-1.5 pl-2 text-right text-ink">
                      {netInvestYen !== null && netInvestYen > 0 ? `${(h.cum / netInvestYen).toFixed(1)}倍` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-ink-soft mt-2">
            損益分岐点 ={" "}
            {appliedYearsToRecover !== null
              ? `約${appliedYearsToRecover}年`
              : RECOVERY_UNKNOWN_LABEL}
            。純便益がプラスに転じる時点。電気単価{ELECTRIC_PRICE_YEN_PER_KWH}円/kWh（推計）で試算。
          </div>
          {/* 2026-09-10 EHC-0038 P0-5:
              上の単価は契約区分の平均販売単価（基本料金込み）＋再エネ賦課金から置いた推計で、
              削減kWhに掛けて実際に回避できる従量単価ではない。
              円と回収年数を出す以上、その根拠の限界を同じ場所に置く。 */}
          <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">{ELECTRIC_PRICE_ESTIMATE_NOTE}</p>
          {/* 算定できなかったときは必ず理由を出す。「—」だけで終わらせない（F01） */}
          {roi.recoveryUnavailableReason && (
            <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">{roi.recoveryUnavailableReason}</p>
          )}
        </div>

        <IndustryBasis building={input.building} result={result} />
      </Card>

      {/* 全体 / 設備グループ別 タブ */}
      <Card>
        {/* 2026-09-10 EHC-0031 UI-02 */}
        <SectionLabel>SIMULATION 03 ── 電気代とCO₂</SectionLabel>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <CardTitle icon={<LineChartIcon className="w-5 h-5" />} iconTone="ehc" className="border-b-0 pb-0 mb-0">
            削減シミュレーション
          </CardTitle>
          <div className="flex gap-1 p-1 bg-paper-sub border border-ink-line rounded-lg">
            {([["overall", "全体"], ["groups", "設備グループ別"]] as ["overall" | "groups", string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`min-h-[48px] px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${view === v ? "bg-brand-deep text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {v === "groups" && <Layers className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === "overall" ? (
          <>
            <RoiChart
              invest={input.invest}
              bestSubsidyManYen={appliedSubsidyManYen}
              subsidyState={subsidyState}
              saveYenPerYear={result.saveYenPerYear}
              kwhPerYear={totalKwhForChart}
              reductionRate={result.effectiveReductionRate}
            />
            {/* 2026-09-10 EHC-0031 F02:
                凡例を手書きしていたため、緑線を描かない状態でも
                「緑線: 更新（補助金あり）← ベスト」が残っていた。
                描く線と凡例を lib/roiState.ts の roiSeriesFor() 一箇所から出す。 */}
            <RoiChartLegend
              subsidyState={subsidyState}
              className="text-xs text-ink-soft grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-3 [&>div]:rounded-md [&>div]:border [&>div]:border-ink-line [&>div]:bg-paper-sub [&>div]:px-2 [&>div]:py-1.5"
            />
            {result.groups.length > 1 && (
              <div className="mt-5">
                <div className="text-xs font-semibold text-ink mb-1.5">設備グループ別 年間削減額の内訳</div>
                <GroupSavingsChart groups={result.groups} />
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.groups.map((g) => (
                <GroupCard key={g.id} g={g} />
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold text-ink mb-1.5">設備グループ別 年間削減額の比較</div>
              <GroupSavingsChart groups={result.groups} />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Target className="w-5 h-5" />}>候補となる補助金</CardTitle>
        {wantSubsidy && fundable.length > 0 && !screening ? (
          /* 診断前は制度の詳細を出さない：まず該当見込みと公募時期をガイドで確認する */
          <div className="rounded-xl border border-brand/35 bg-[#f4faf0] p-4">
            <p className="text-xs text-ink leading-relaxed mb-3">
              先に<strong className="text-brand-deep">「補助金に該当するかガイド診断」</strong>（該当見込み＋公募時期）を行ってください。
              診断が終わると、ここに<strong className="text-ink">該当する制度の要件・必要書類・申請時期</strong>が表示されます。
            </p>
            <button
              type="button"
              onClick={() => setScreenOpen(true)}
              className="min-h-[48px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-deep text-white text-xs font-bold hover:bg-brand transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              補助金に該当するかガイド診断する
            </button>
            <p className="text-xs text-ink-soft mt-2">
              所要 約30秒・5問。回答内容はこの画面の試算にのみ使用します。
            </p>
          </div>
        ) : result.matched.length ? (
          <div className="space-y-3">
            {result.matched.map((s) => {
              const timing = screening?.timingById[s.id];
              const verdict = screening?.verdictById[s.id];
              return (
              <div key={s.id} className="border border-brand/35 bg-paper-sub rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-brand-deep">
                  <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0" />
                  {s.name}
                </h3>
                <div className="text-xs text-ink-soft mb-2.5 flex flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md font-medium ${s.infoOnly ? "bg-amber-50 text-amber-800" : "bg-[#edf6e8] text-brand-deep"}`}>{s.infoOnly ? "情報提供（要確認）" : "候補（要件確認前）"}</span>
                  {verdict && (
                    <span
                      className={`px-2 py-0.5 rounded-md font-medium ${
                        verdict === "yes"
                          ? "bg-[#edf6e8] text-brand-deep"
                          : verdict === "maybe"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      ガイド診断: {verdict === "yes" ? "該当見込み" : verdict === "maybe" ? "要確認" : "対象外の可能性"}
                    </span>
                  )}
                  {timing && (
                    <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">申請時期: {timing.label}</span>
                  )}
                  <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">期間: {s.period}</span>
                  <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">補助率: {s.rate}</span>
                  <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">上限: {s.max}</span>
                </div>
                <div className="text-xs text-ink">
                  <p><strong className="text-ink">要件:</strong> {s.requirement}</p>
                  <p className="mt-1"><strong className="text-ink">必要書類:</strong> {s.docs}</p>
                  {timing && timing.detail && (
                    <p className="mt-1 text-ink-soft">※ {timing.detail}</p>
                  )}
                  {s.infoOnly && (
                    <p className="mt-1 text-amber-800">※ 販路開拓・業務効率化が主目的の制度です。設備費が補助対象経費になるかは事業計画次第のため、想定補助金・投資回収には含めていません。</p>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            入力済みの条件だけで適格性が確定した制度はありません。下の「確認すれば候補になりうる制度」をご覧ください。
          </p>
        )}

        {/* 判定不能（needs_check）を「該当なし」に混ぜない。
            不足情報を出せば、あと一問で候補に戻る制度を落とさずに済む。 */}
        {result.needsCheck.length > 0 && (
          <div className="mt-4 pt-4 border-t border-ink-line">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">
              確認すれば候補になりうる制度（{result.needsCheck.length}件）
            </h3>
            <div className="space-y-3">
              {result.needsCheck.map((s) => (
                <div key={s.id} className="border border-dashed border-amber-500/45 bg-amber-50 rounded-xl p-4">
                  <div className="text-sm font-semibold text-amber-900 mb-1.5">{s.name}</div>
                  <div className="text-xs text-ink-soft mb-2 flex flex-wrap gap-1.5">
                    <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">補助率: {s.rate}</span>
                    <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">上限: {s.max}</span>
                    <span className="bg-paper-card border border-ink-line px-2 py-0.5 rounded-md">期間: {s.period}</span>
                  </div>
                  <p className="text-xs text-ink font-semibold mb-1">判定に不足している情報</p>
                  <ul className="text-xs text-ink list-disc pl-4 space-y-0.5">
                    {(result.eligibility[s.id]?.missing ?? []).map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-soft mt-2">
              対象外が確定したという意味ではありません。判定に必要な情報が未取得のため、補助額は「未算定」としています（0円ではありません）。
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Lightbulb className="w-5 h-5" />}>更新を検討する理由</CardTitle>
        <ul className="space-y-2.5">
          {result.reasons.map((r, i) => (
            <li key={i} className="bg-amber-50 border border-amber-500/45 px-4 py-3 rounded-xl text-sm text-ink flex items-start gap-3">
              <span className="bg-amber-200 text-amber-900 font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                {i + 1}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   2026-09-10 EHC-0031 UI-02
   メインページ（HomeV17）の .benefit-card と同じ型に寄せた数値セル。

   変更前は5つの数字に緑・橙・水色・紫の4色グラデーションを敷いていた。
   これをやめた理由は見た目の好みではない。同じ画面の中で色が4つあると、
   「橙は注意、緑は良い」という色の意味が読めなくなる。実際に
   「損益分岐(投資回収)」が常に橙だったため、算定できていない状態と
   ただの項目色の区別がつかなかった。

   決めごと:
   ・面の色は使わず、HomeV17 と同じ 1px のヘアラインで区切る
   ・アクセントは緑1色（brand-deep）に限定する
   ・橙（amber-800）は「未算定・未確認」の合図として**だけ**使う

   2026-09-11 EHC-0038 第2便 4-G:
   白地に変えたので、旧トークン ehc-300 / amber-300 のままでは
   本文（ink）より薄く、注意色のはずの橙が最も読みにくい文字になっていた。
   紙の上で意味が伝わる濃さ（brand-deep / amber-800）へ振り直した。
   役割の割り当て（緑=結論、橙=未算定のみ）は変えていない。
   ─────────────────────────────────────────────────────────── */
const ROI_TONE = {
  green: "text-brand-deep",
  neutral: "text-ink",
} as const;

function RoiBox({
  label,
  value,
  tone = "neutral",
  unavailable = false,
}: {
  label: string;
  value: string;
  tone?: keyof typeof ROI_TONE;
  /** 未算定・未確認。true のときだけ橙になる */
  unavailable?: boolean;
}) {
  return (
    <div className="border-t border-ink-line pt-3">
      <div className="text-xs text-ink-soft font-medium mb-1 leading-snug">{label}</div>
      <div className={`text-2xl font-bold tracking-tight ${unavailable ? "text-amber-800" : ROI_TONE[tone]}`}>
        {value}
      </div>
    </div>
  );
}

// 業種別の電力消費内訳＋経年劣化補正による実効削減率の根拠を表示
function IndustryBasis({ building, result }: { building: string; result: MatchResult }) {
  const profile = INDUSTRY_PROFILES[building] ?? INDUSTRY_PROFILES.other;
  const ac = profile.electricBreakdown.find((b) => b.category === "空調");
  const fridge = profile.electricBreakdown.find((b) => b.category === "冷凍冷蔵");
  const refrigerantPct = (ac?.pct ?? 0) + (fridge?.pct ?? 0);
  const basePct = Math.round(result.industryReductionRate * 100);
  const agePct = Math.round(result.ageDegradationRate * 100);
  const refriPct = Math.round(result.refriGenRate * 100);
  const equipPct = Math.round(result.equipBonusRate * 100);
  const effPct = Math.round(result.effectiveReductionRate * 100);
  const audit = result.coefficientAudit;
  return (
    <div className="mt-4 bg-paper-sub border border-ink-line rounded-xl p-4">
      <div className="text-xs font-semibold text-ink mb-2.5 flex items-center gap-1.5">
        <PieChart className="w-3.5 h-3.5 text-brand" />
        実効削減率 {effPct}% の根拠 — {profile.label}の電力消費内訳＋経年劣化
      </div>
      <div className="flex w-full h-5 rounded-md overflow-hidden mb-2">
        {profile.electricBreakdown.map((b) => (
          <div
            key={b.category}
            style={{ width: `${b.pct}%`, backgroundColor: b.color }}
            title={`${b.category} ${b.pct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft mb-3">
        {profile.electricBreakdown.map((b) => (
          <span key={b.category} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: b.color }} />
            {b.category} {b.pct}%
          </span>
        ))}
      </div>
      {/* 削減率の内訳: 業種＋冷媒世代＋設備制御＋経年回復 = 実効 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center mb-2.5">
        <div className="bg-paper-card border border-ink-line rounded-md p-2">
          <div className="text-xs text-ink-soft">業種・高効率化</div>
          <div className="text-sm font-bold text-ink">{basePct}%</div>
        </div>
        <div className="bg-paper-card border border-ink-line rounded-md p-2">
          <div className="text-xs text-ink-soft">冷媒世代</div>
          <div className="text-sm font-bold text-brand-deep">+{refriPct}%</div>
        </div>
        <div className="bg-paper-card border border-ink-line rounded-md p-2">
          <div className="text-xs text-ink-soft">設備制御</div>
          <div className="text-sm font-bold text-brand-deep">+{equipPct}%</div>
        </div>
        <div className="bg-paper-card border border-ink-line rounded-md p-2">
          <div className="text-xs text-ink-soft">経年劣化(加重平均)</div>
          <div className="text-sm font-bold text-amber-800">+{agePct}%</div>
        </div>
        {/* 2026-09-10 EHC-0031 UI-02: 合計にあたる欄は緑で締める。
            内訳（+%）と合計（実効%）の区別は色ではなく面の強さで付ける。 */}
        <div className="bg-[#edf6e8] border border-brand/40 rounded-md p-2">
          <div className="text-xs text-brand-deep">実効削減率</div>
          <div className="text-sm font-bold text-brand-deep">{effPct}%</div>
        </div>
      </div>
      <p className="text-xs text-ink-soft leading-relaxed">
        {profile.label}は冷媒設備（空調{ac ? `${ac.pct}%` : ""}{fridge ? `＋冷凍冷蔵${fridge.pct}%` : ""}）が電力の約{refrigerantPct}%。
        高効率化{basePct}%に、冷媒世代差+{refriPct}%（R22/R410A→R32）・設備制御+{equipPct}%（マルチ部分負荷）・経年劣化回復+{agePct}%（設備グループの加重平均）を合成し、
        <strong className="text-brand-deep">実効{effPct}%</strong>として試算。設備グループ別の内訳は「設備グループ別」タブをご覧ください。
      </p>
      {/* 2026-08-27 監査での修正:
            ここには以前「出典: 資源エネルギー庁／メーカー資料／業界資料『10〜15年で20〜40%低下』」と
            書いてあったが、どの資料の何ページかを誰も辿れなかった。
            出典らしき文言があるほうが、無いより危ない。読んだ人は確認済みだと思うからである。
            実態は出典未確定なので、出典未確定と書き、何を取れば確定するかまで出す。 */}
      {audit.provisional.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/45 bg-amber-50 p-3">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            この削減率には出典未確定の暫定値が {audit.provisional.length} 項目含まれます
          </div>
          <p className="mt-1.5 text-xs text-amber-900 leading-relaxed">{PROVISIONAL_COEFFICIENT_NOTE}</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {audit.provisional.map((c) => (
              <li key={c.label}>
                <span className="font-semibold">{c.label} {Math.round(c.value * 100)}%</span>
                <span className="opacity-80">（暫定値・{c.basis}）</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 設備グループ1件の結果カード
function GroupCard({ g }: { g: GroupResult }) {
  const refriColor = g.refri === "r22" ? "text-red-700 bg-red-50" : g.refri === "r410a" ? "text-amber-800 bg-amber-50" : "text-brand-deep bg-[#edf6e8]";
  return (
    <div className="bg-paper-sub border border-ink-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-bold ${refriColor}`}>{g.refri.toUpperCase()}</span>
          <span className="text-xs text-ink">{g.equip === "multi" ? "マルチ" : "パッケージ"} ・ {g.units}台</span>
        </div>
        <span className="text-xs text-ink-soft">{g.installYear}年設置 / 築{g.age}年</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-ink-soft">実効削減率</div>
          <div className="text-2xl font-bold text-brand-deep">{Math.round(g.effectiveReductionRate * 100)}%</div>
          {/* 2026-08-27 監査での追加: 出典未確定の係数を含む削減率は、数字の隣で暫定と分かるようにする */}
          {g.ratesAreProvisional && <div className="text-xs text-amber-800">暫定値（出典確定前）</div>}
          {/* 2026-09-16 EHC-0039（台帳 #31）: 何から出した％かを数字の隣に書く */}
          <div className="text-xs text-ink-soft">{REDUCTION_BASIS_LABEL[g.reductionBasis]}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-ink-soft">年間削減</div>
          <div className="text-lg font-bold text-brand-deep">¥{g.saveYenPerYear.toLocaleString("ja-JP")}</div>
          <div className="text-xs text-ink-soft">{g.kwh.toLocaleString("ja-JP")} kWh/年</div>
        </div>
      </div>
      {/* 2026-09-16 EHC-0039（台帳 #31）:
          この行は上の％の内訳である。実機比較（measured）を採った群では
          係数を1つも使っていないので、内訳として係数を並べると
          「この3つを足してこの％になった」という嘘になる。
          measured の群には、代わりに実際に照合した型番と効率値を出す。 */}
      {g.reductionBasis === "coefficient" ? (
        <div className="mt-2 flex flex-wrap gap-1 text-xs text-ink-soft">
          <span className="bg-paper-card border border-ink-line rounded px-1.5 py-0.5">冷媒世代 +{Math.round(g.refriGenRate * 100)}%</span>
          <span className="bg-paper-card border border-ink-line rounded px-1.5 py-0.5">経年 +{Math.round(g.ageDegradationRate * 100)}%</span>
          {g.equipBonusRate > 0 && <span className="bg-paper-card border border-ink-line rounded px-1.5 py-0.5">制御 +{Math.round(g.equipBonusRate * 100)}%</span>}
        </div>
      ) : (
        g.measuredComparison?.status === "measured" && (
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-ink-soft">
            <span className="bg-paper-card border border-ink-line rounded px-1.5 py-0.5">
              既設 {g.measuredComparison.from.modelNo}（{g.measuredComparison.fromEfficiency}）
            </span>
            <span className="bg-paper-card border border-ink-line rounded px-1.5 py-0.5">
              更新候補 {g.measuredComparison.to.modelNo}（{g.measuredComparison.toEfficiency}）
            </span>
            <span className="bg-paper-card border border-ink-line rounded px-1.5 py-0.5">
              {g.measuredComparison.index === "apf2015" ? "APF(2015)" : g.measuredComparison.indexLabel}
            </span>
          </div>
        )
      )}
    </div>
  );
}
