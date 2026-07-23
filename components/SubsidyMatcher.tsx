"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input, Button } from "./ui/Field";
import { MatchInput, BizType, SizeType, EquipType, RefriType, EquipGroup, KwhMode, Subsidy } from "@/lib/types";
import { matchSubsidies, MatchResult, GroupResult } from "@/lib/match";
import { ReportTeaser } from "./ReportTeaser";
import { CustomerReport } from "./CustomerReport";
import { SampleCases } from "./SampleCases";
import { HearingChat } from "./HearingChat";
import { SubsidyEligibilityChat } from "./SubsidyEligibilityChat";
import { SampleCase } from "@/lib/samples";
import { Sparkles, BarChart3, Target, Lightbulb, Building2, User, AlertTriangle, CheckCircle2, LineChart as LineChartIcon, PieChart, Plus, Trash2, Layers, Gauge, Link2, QrCode, Printer, Wallet, ClipboardCheck, Bot } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { RoiChart } from "./RoiChart";
import { GroupSavingsChart } from "./GroupSavingsChart";
import { useProject } from "./ProjectContext";
import { RoadmapView } from "./RoadmapView";
import { SubsidyDisclaimer } from "./SubsidyDisclaimer";
import { INDUSTRY_PROFILES } from "@/lib/industries";
import { estimateInvestManYenFromGroups } from "@/lib/pricing";

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

const PREFS = ["東京都", "神奈川県", "大阪府", "埼玉県", "千葉県", "愛知県", "北海道", "福岡県", "その他"];

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

// 住所文字列から都道府県を検出。ドロップダウン候補にあればその値、無ければ"その他"。未検出はnull
const prefFromAddress = (address: string): string | null => {
  const hit = ALL_PREFS.find((p) => address.includes(p));
  if (!hit) return null;
  return PREFS.includes(hit) ? hit : "その他";
};

const REFRI_SHORT: Record<RefriType, string> = { r22: "R22", r410a: "R410A", r32: "R32", unknown: "冷媒不明" };
const groupLabel = (g: EquipGroup, i: number) =>
  `設備${i + 1}：${REFRI_SHORT[g.refri]}・${g.equip === "multi" ? "マルチ" : "パッケージ"}・${g.units}台`;

// 共有リンク: 入力値をURLの ?d= に埋め込み、開いた側で同じ診断を自動再現する
const encodeInput = (i: MatchInput) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(i))));
const decodeInput = (s: string): MatchInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(s))));
    return parsed && Array.isArray(parsed.equipGroups) && parsed.equipGroups.length ? parsed : null;
  } catch {
    return null;
  }
};

const HELP = {
  customerCompany: "提案書のヘッダーに表示されるお客様の会社名（例: 株式会社○○）。提案書PDF出力には必須です。",
  customerContact: "提案書ヘッダーに表示されるご担当者様のお名前。未定・不明の場合は空欄のままでOKです。",
  customerEmail: "提案書の送付・ご連絡に使うお客様のメールアドレス。提案書PDF出力には必須です。",
  customerPhone: "ご連絡用のお客様の電話番号。提案書PDF出力には必須です。",
  customerAddress: "お客様の所在地（住所）。都道府県を自動判定し、一都三県など地域補助金の該当可否に反映します。提案書PDF出力には必須です。",
  ehcStaff: "提案書のフッターに表示されるEHC側の担当者名（例: 桝口、伊藤）。担当者が決まっていない場合は空欄のままでOKです。",
  bizType: "EHCソリューションズは業務用（法人・事業主）専用です。個人・家庭用の空調は対象外となります。",
  size: "中小企業 = 資本金3億円以下 もしくは 従業員300人以下。多くの補助金で中小企業が優遇されます。",
  pref: "都道府県別補助金（神奈川県・大阪府・東京都等）の適用判定に使用します。",
  building: "補助金の対象用途を判定。オフィス、店舗、飲食店、ホテル、医療施設など。",
  equip: "パッケージエアコン＝屋内機1台＋屋外機1台のセット。マルチエアコン＝1台の屋外機で複数室を冷暖房するビル用システム。",
  years: "業務用空調の法定耐用年数は15年。10年を超えると効率が20〜40%低下し、補助金活用の絶好のタイミングです。",
  refri: "R22は既に製造禁止（修理部品入手困難）。R410Aは2025年で製造規制完了（修理コスト2-3倍）。R32が現行最有力。",
  kwh: "直近1年間の電力会社請求書の合計kWh。複数事業所がある場合は、空調を更新する事業所分のみで結構です。",
  invest: "新空調機器の本体価格＋設置工事費の合計見積額。参考：業務用パッケージ50〜150万円/台、ビル用マルチ500〜3,000万円。",
  co2: "年間電力削減量(kWh) × 0.000438 で概算可能。神奈川県補助金は3t/年以上が必須条件です。",
};

export function SubsidyMatcher() {
  const [input, setInput] = useState<MatchInput>({
    bizType: "business",
    size: "sme",
    pref: "東京都",
    building: "office",
    equipGroups: [newGroup({ refri: "r410a", equip: "ac", installYear: new Date().getFullYear() - 12, units: 5 })],
    kwhMode: "auto",
    kwh: 80000,
    invest: 500,
    customerCompany: "",
    customerContact: "",
    customerEmail: "",
    customerPhone: "",
    customerAddress: "",
    ehcStaff: "",
  });
  const [result, setResult] = useState<MatchResult | null>(null);
  // 一度でも「即答」を押したら、以降は入力変更に結果を自動連動させる
  const [hasRun, setHasRun] = useState(false);
  const [eligTrigger, setEligTrigger] = useState(0);
  const { setProject } = useProject();
  const [agreed, setAgreed] = useState(false);
  // プランナー②③で確定した補助金額・ご希望の補助金（提案書PDFへ反映）
  const [appliedSubsidyManYen, setAppliedSubsidyManYen] = useState<number>(0);
  const [appliedSubsidy, setAppliedSubsidy] = useState<Subsidy | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const toastTimer = useRef<number | null>(null);

  const set = <K extends keyof MatchInput>(key: K, val: MatchInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: val }));

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
      { val: input.customerCompany, label: "会社名", id: "customer-company-input" },
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
    if (!agreed) {
      setToast("下部の同意チェックを入れると、お客様提案書を印刷できます");
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

  const run = (checkEligibility?: boolean) => {
    if (input.bizType === "personal") {
      alert("EHCは業務用専門です。法人・事業者としてご検討ください。");
      return;
    }
    setHasRun(true);
    setResult(matchSubsidies(input));
    if (checkEligibility) setEligTrigger((n) => n + 1);
    setTimeout(() => {
      document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ehc-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lift flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}
      <ReportTeaser />

      <div className="no-print">
      <HearingChat input={input} setInput={setInput} onComplete={run} />
      </div>

      <div className="no-print">
      <SampleCases onPick={applySample} selectedId={selectedSampleId} />
      </div>

      <div className="no-print" id="customer-info-section">
      <Card>
        <CardTitle icon={<User className="w-5 h-5" />}>お客様情報（提案書ヘッダー用）</CardTitle>
        <p className="text-[11px] text-slate-500 -mt-2 mb-3">
          <strong className="text-amber-400">*</strong> の付いた<strong className="text-slate-300">会社名・メール・電話・住所</strong>は提案書PDF出力に必須です。担当者名・EHC担当は任意。住所からは都道府県を自動判定し、一都三県など地域補助金の該当可否に反映します。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="お客様会社名 *" help={HELP.customerCompany}>
            <Input
              id="customer-company-input"
              value={input.customerCompany}
              onChange={(e) => set("customerCompany", e.target.value)}
              placeholder="例: 株式会社○○"
            />
          </Field>
          <Field label="メールアドレス *" help={HELP.customerEmail}>
            <Input
              id="customer-email-input"
              type="email"
              value={input.customerEmail ?? ""}
              onChange={(e) => set("customerEmail", e.target.value)}
              placeholder="例: info@example.co.jp"
            />
          </Field>
          <Field label="電話番号 *" help={HELP.customerPhone}>
            <Input
              id="customer-phone-input"
              type="tel"
              value={input.customerPhone ?? ""}
              onChange={(e) => set("customerPhone", e.target.value)}
              placeholder="例: 03-1234-5678"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="住所 *" help={HELP.customerAddress}>
              <Input
                id="customer-address-input"
                value={input.customerAddress ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const p = prefFromAddress(v);
                  setInput((prev) => ({ ...prev, customerAddress: v, ...(p ? { pref: p } : {}) }));
                }}
                placeholder="例: 東京都新宿区西新宿1-1-1 ○○ビル3F"
              />
            </Field>
            {(input.customerAddress ?? "").trim() &&
              (prefFromAddress(input.customerAddress) ? (
                <p className="text-[11px] text-ehc-300 mt-1">
                  住所から「{prefFromAddress(input.customerAddress)}」と判定 → 地域補助金の該当判定に反映しました。
                </p>
              ) : (
                <p className="text-[11px] text-amber-500 mt-1">
                  住所から都道府県を判定できませんでした。下の「所在地（都道府県）」で選択してください。
                </p>
              ))}
          </div>
          <Field label="ご担当者名" help={HELP.customerContact}>
            <Input
              value={input.customerContact}
              onChange={(e) => set("customerContact", e.target.value)}
              placeholder="例: 田中"
            />
          </Field>
          <Field label="EHC担当" help={HELP.ehcStaff}>
            <Input
              value={input.ehcStaff}
              onChange={(e) => set("ehcStaff", e.target.value)}
              placeholder="例: 桝口"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>案件情報入力</CardTitle>
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
          <Field label="所在地（都道府県）" help={HELP.pref}>
            <Select value={input.pref} onChange={(e) => set("pref", e.target.value)}>
              {PREFS.map((p) => (
                <option key={p}>{p}</option>
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

        {/* 設備グループ（複数機種対応） */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cobalt-300" /> 設備グループ（冷媒・台数・設置年が異なる機種を行で追加）
            </div>
            <button onClick={addGroup} type="button" className="text-[11px] px-2.5 py-1 rounded-md border border-cobalt-500/40 text-cobalt-200 hover:bg-cobalt-600/15 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> 設備グループ追加
            </button>
          </div>
          <div className="text-[10px] text-slate-500 bg-white/5 border border-white/10 rounded-lg p-2 mb-2 leading-relaxed">
            <strong className="text-slate-400">冷媒</strong>＝室外機側面の銘板シールに記載（R22/R410A/R32）。分からなければ「不明」でOK。
            <strong className="text-slate-400 ml-1.5">設置年</strong>＝おおよそで結構です。
            <strong className="text-slate-400 ml-1.5">馬力</strong>＝室外機の能力（例: 3馬力）。不明なら空欄のままでOK（台数のみで按分します）。
          </div>
          <div className="space-y-2">
            {input.equipGroups.map((g) => (
              <GroupRow
                key={g.id}
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
          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-cobalt-300" /> 年間電力使用量(kWh)の入力方法
          </div>
          <div className="flex gap-1 p-1 bg-night-800 border border-white/10 rounded-lg w-fit mb-3">
            {([["auto", "総量を自動按分"], ["measured", "実測値を入力(エニマス等)"]] as [KwhMode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => set("kwhMode", m)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${input.kwhMode === m ? "bg-cobalt-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {input.kwhMode === "auto" ? (
            <Field label="年間総電力使用量 (kWh)" help={HELP.kwh}>
              <Input type="number" value={input.kwh} onChange={(e) => set("kwh", Number(e.target.value))} />
              <div className="text-[10px] text-slate-500 mt-1">各設備グループへ「台数×馬力」で自動按分します（馬力未入力は台数で按分）。</div>
            </Field>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-400 bg-white/5 border border-white/10 rounded-lg p-2.5">
                各設備グループのエニマス等デマンド実測値（kWh/年）を下の欄に入力してください。合計が年間総使用量になります。
              </div>
              <div className="space-y-1.5">
                {input.equipGroups.map((g, i) => (
                  <div key={g.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
                    <div className="text-[11px] text-slate-300 flex-1 min-w-0 truncate">{groupLabel(g, i)}</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={g.kwh ?? ""}
                      placeholder="実測kWh/年"
                      onChange={(e) => updateGroup(g.id, { kwh: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-40 px-2 py-1.5 border border-cobalt-500/40 rounded-md text-xs bg-night-800 text-white focus:outline-none focus:border-cobalt-500"
                    />
                    <span className="text-[10px] text-slate-500 w-8">kWh</span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 text-right pr-1">
                合計:{" "}
                <span className="text-cobalt-200 font-semibold">
                  {input.equipGroups.reduce((a, g) => a + (g.kwh || 0), 0).toLocaleString("ja-JP")}
                </span>{" "}
                kWh/年
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="設備投資概算 (万円)" help={HELP.invest}>
            <div className="flex gap-2">
              <Input type="number" value={input.invest} onChange={(e) => set("invest", Number(e.target.value))} />
              <button
                type="button"
                onClick={() => set("invest", estimateInvestManYenFromGroups(input.equipGroups))}
                className="whitespace-nowrap text-[11px] px-2.5 rounded-lg border border-ehc-500/40 text-ehc-300 hover:bg-ehc-500/10"
                title="設備の馬力×台数からPN実勢単価で自動概算"
              >
                実勢で自動見積
              </button>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">「自動見積」=設備群の馬力×台数からPN見積実勢（標準グレード）で概算します。</div>
          </Field>
          <div className="flex items-end">
            <div className="text-[11px] text-slate-500 bg-white/5 border border-white/10 rounded-lg p-2.5 w-full">
              CO2削減量は削減kWhから自動計算されます（排出係数 0.000438 t-CO₂/kWh・省エネ効果レポートと同一係数）。神奈川県補助金の3t/年要件も自動判定。
            </div>
          </div>
        </div>
        {input.bizType === "personal" && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-4 rounded-xl text-sm mt-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              EHCソリューションズは <strong>業務用専用</strong> です。個人・家庭用空調は対象外となります。
            </div>
          </div>
        )}
        <Button onClick={() => run()} className="mt-5">
          <Sparkles className="w-5 h-5" />
          {hasRun ? "再計算（最新の入力で更新）" : "即答（マッチング & 提案書生成）"}
        </Button>
        {hasRun && (
          <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-cobalt-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cobalt-400 animate-pulse" />
              ライブ更新中：各項目を変更すると結果・ROI・提案書が自動で再計算されます
            </div>
            <button
              type="button"
              onClick={copyShareLink}
              className="text-[11px] px-2.5 py-1 rounded-md border border-ehc-500/40 text-ehc-300 hover:bg-ehc-500/10 flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" /> この診断の共有リンクをコピー
            </button>
            <button
              type="button"
              onClick={toggleQr}
              className={`text-[11px] px-2.5 py-1 rounded-md border flex items-center gap-1 ${showQr ? "border-ehc-400 bg-ehc-500/15 text-ehc-200" : "border-ehc-500/40 text-ehc-300 hover:bg-ehc-500/10"}`}
            >
              <QrCode className="w-3.5 h-3.5" /> QRでスマホに送る
            </button>
            <button
              type="button"
              onClick={printReport}
              className="text-[11px] px-2.5 py-1 rounded-md border border-cobalt-500/40 text-cobalt-200 hover:bg-cobalt-600/15 flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> 提案書を印刷 / PDF
            </button>
          </div>
        )}
        {hasRun && showQr && shareUrl && (
          <div className="mt-3 flex flex-col items-center gap-2 animate-fade-in">
            <div className="bg-white p-3 rounded-xl shadow-lift">
              <QRCodeSVG value={shareUrl} size={168} level="M" fgColor="#0a0a0a" bgColor="#ffffff" />
            </div>
            <div className="text-[10px] text-slate-500 text-center">
              お客様のスマホカメラで読み取ると、この診断結果がそのまま開きます
              <br />（入力を変えた場合は一度閉じて再表示してください）
            </div>
          </div>
        )}
      </Card>
      </div>

      {result && (
        <div id="result-section" className="space-y-5">
          <ResultView
            result={result}
            input={input}
            eligTrigger={eligTrigger}
            onApplied={(manYen, subsidy) => {
              setAppliedSubsidyManYen(manYen);
              setAppliedSubsidy(subsidy);
            }}
          />
          <div className="no-print">
            <RoadmapView input={input} result={result} compact />
          </div>
          <div className="no-print">
            <SubsidyDisclaimer />
          </div>
          <div id="agree-section" className="no-print">
          <Card className={!agreed ? "border-2 border-amber-400/70 ring-2 ring-amber-400/20" : ""}>
            <label className="flex items-start gap-2.5 text-sm text-slate-200 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 accent-amber-400 flex-shrink-0" />
              <span>上記の補助金情報が<strong className="text-white">あくまで目安</strong>であり、公募内容・締切は予告なく変更されるため、最新条件は公募要領／当社で要確認であることを理解しました。（お客様提案書の表示・PDF出力に同意します）</span>
            </label>
          </Card>
          </div>
          {agreed && (
            <CustomerReport
              input={input}
              result={result}
              appliedSubsidyManYen={appliedSubsidyManYen}
              appliedSubsidy={appliedSubsidy}
            />
          )}

          {/* 同意するまで画面下に固定するバー（見落とし防止）。押すと同意→提案書表示へ */}
          {!agreed && (
            <div className="fixed bottom-0 left-0 right-0 z-40 no-print px-3 pb-3 pt-0 pointer-events-none">
              <div className="pointer-events-auto max-w-3xl mx-auto bg-night-800/95 backdrop-blur border-2 border-amber-400/80 shadow-lift rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="relative flex h-3 w-3 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400"></span>
                </span>
                <p className="text-[13px] text-slate-200 leading-snug flex-1">
                  <strong className="text-white">あと1ステップ。</strong> 内容に同意すると<strong className="text-amber-300">お客様提案書（PDF出力可）</strong>が表示されます。
                </p>
                <button
                  onClick={() => {
                    setAgreed(true);
                    setTimeout(() => document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                  }}
                  className="flex-shrink-0 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-night-900 font-bold text-sm px-4 py-2.5 rounded-xl shadow-card transition-all whitespace-nowrap"
                >
                  同意して提案書を表示
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 設備グループ1行の編集UI
function GroupRow({
  g,
  canRemove,
  onChange,
  onRemove,
}: {
  g: EquipGroup;
  canRemove: boolean;
  onChange: (p: Partial<EquipGroup>) => void;
  onRemove: () => void;
}) {
  const cls = "px-2 py-1.5 border border-white/15 rounded-md text-xs bg-night-800 text-white focus:outline-none focus:border-cobalt-500 w-full";
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-3">
          <label className="text-[10px] text-slate-500">冷媒</label>
          <select className={cls} value={g.refri} onChange={(e) => onChange({ refri: e.target.value as RefriType })}>
            <option value="r22">R22（最旧・製造禁止）</option>
            <option value="r410a">R410A（1世代前）</option>
            <option value="r32">R32（現行）</option>
            <option value="unknown">不明</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="text-[10px] text-slate-500">種別</label>
          <select className={cls} value={g.equip} onChange={(e) => onChange({ equip: e.target.value as EquipType })}>
            <option value="ac">パッケージ</option>
            <option value="multi">マルチ(ビル用)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-slate-500">設置年(西暦)</label>
          <input type="number" className={cls} value={g.installYear} onChange={(e) => onChange({ installYear: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-1">
          <label className="text-[10px] text-slate-500">台数</label>
          <input type="number" className={cls} value={g.units} onChange={(e) => onChange({ units: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-slate-500">馬力</label>
          <input type="number" className={cls} value={g.hp ?? ""} placeholder="任意" onChange={(e) => onChange({ hp: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div className="md:col-span-1 flex justify-end">
          <button type="button" onClick={onRemove} disabled={!canRemove} className={`p-1.5 rounded-md ${canRemove ? "text-red-300 hover:bg-red-500/10" : "text-slate-600 cursor-not-allowed"}`} title="削除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 補助金の想定交付額(万円)＝補助率×投資、上限でクリップ。情報提供のみ(infoOnly)は資金化しない
function subsidyAmountManYen(s: Subsidy, invest: number): number {
  if (s.infoOnly) return 0;
  return Math.min(invest * s.rateNum, s.capManYen);
}
// 要件文（。区切り）をチェックリスト項目に分割
function splitRequirements(req: string): string[] {
  return req.split("。").map((t) => t.trim()).filter((t) => t.length > 0);
}

function ResultView({ result, input, eligTrigger = 0, onApplied }: { result: MatchResult; input: MatchInput; eligTrigger?: number; onApplied?: (manYen: number, subsidy: Subsidy | null) => void }) {
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

  // マッチ結果が変わったら、選択を最適補助金へ同期＆要件チェックを初期化（全クリア＝true）
  useEffect(() => {
    setSelectedId((prev) => (fundable.some((s) => s.id === prev) ? prev : bestId));
    setReqChecks((prev) => {
      const next = { ...prev };
      fundable.forEach((s) => {
        const n = splitRequirements(s.requirement).length;
        if (!next[s.id] || next[s.id].length !== n) next[s.id] = Array(n).fill(true);
      });
      return next;
    });
  }, [fundable, bestId]);

  // ヒアリングAIから「補助金の該当もチェック」を選んだら、最有力補助金で自動的に該当チェックを開く
  useEffect(() => {
    if (eligTrigger > 0 && bestId) {
      setWantSubsidy(true);
      setSelectedId(bestId);
      setEligChatOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligTrigger]);

  const selected = fundable.find((s) => s.id === selectedId) || null;
  // 要件チェックが全て満たされていれば「該当」。未初期化(undefined)や要件0件は該当扱い
  const isEligible = (s: Subsidy) => (reqChecks[s.id] ?? []).every(Boolean);
  // ②のリストは「該当するもの」だけ表示。ただし操作中(選択中)のものは消さない
  const visibleFundable = fundable.filter((s) => isEligible(s) || s.id === selectedId);
  const hiddenCount = fundable.length - visibleFundable.length;
  const selectedReqs = selected ? splitRequirements(selected.requirement) : [];
  const selectedChecks = (selected && reqChecks[selected.id]) || [];
  const allReqMet = selectedChecks.length > 0 && selectedChecks.every(Boolean);
  const selectedAmountManYen = selected ? subsidyAmountManYen(selected, input.invest) : 0;
  // 実際にROI・グラフへ反映する補助金額
  const appliedSubsidyManYen = wantSubsidy && selected && allReqMet ? selectedAmountManYen : 0;
  // 確定した補助金額・ご希望の補助金を親（提案書PDF）へ反映
  const appliedSubsidyForReport = wantSubsidy && selected && allReqMet ? selected : null;
  useEffect(() => {
    onApplied?.(appliedSubsidyManYen, appliedSubsidyForReport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSubsidyManYen, appliedSubsidyForReport]);

  const toggleReq = (i: number) => {
    if (!selected) return;
    setReqChecks((prev) => {
      const arr = [...(prev[selected.id] || [])];
      arr[i] = !arr[i];
      return { ...prev, [selected.id]: arr };
    });
  };

  const netInvestYen = Math.max(0, input.invest - appliedSubsidyManYen) * 10000;
  const horizons = [5, 10, 15].map((y) => {
    const cum = result.saveYenPerYear * y;
    return { y, cum, net: cum - netInvestYen };
  });
  const totalKwhForChart = result.totalKwh || input.kwh;
  // ①実質負担額の即答: 補助なし回収年数との比較
  const investYen = input.invest * 10000;
  const subsidyYen = appliedSubsidyManYen * 10000;
  const yearsNoSubsidy = result.saveYenPerYear > 0 ? Math.round((investYen / result.saveYenPerYear) * 10) / 10 : null;
  const appliedYearsToRecover =
    result.saveYenPerYear > 0
      ? Math.round(((input.invest - appliedSubsidyManYen) / (result.saveYenPerYear / 10000)) * 10) / 10
      : null;
  const yearsShortened =
    yearsNoSubsidy !== null && appliedYearsToRecover !== null
      ? Math.round((yearsNoSubsidy - appliedYearsToRecover) * 10) / 10
      : null;
  return (
    <div className="space-y-5 no-print">
      {/* 実質負担額ヒーロー（即答の主役） */}
      <div className="relative overflow-hidden rounded-2xl border border-ehc-500/40 bg-gradient-to-br from-ehc-600/20 via-night-900 to-night-900 p-5 md:p-6 shadow-lift">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-ehc-500/15 blur-3xl" />
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div>
            <div className="text-[11px] tracking-widest text-ehc-300 font-semibold mb-1">補助金適用後の実質負担額</div>
            <div className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              ¥{netInvestYen.toLocaleString("ja-JP")}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              設備投資 ¥{investYen.toLocaleString("ja-JP")} − 想定補助金{" "}
              <span className="text-ehc-300 font-semibold">¥{subsidyYen.toLocaleString("ja-JP")}</span>
              {subsidyYen > 0 && (
                <span className="ml-1.5 text-ehc-300 font-semibold">
                  （{Math.round((subsidyYen / investYen) * 100)}%オフ）
                </span>
              )}
            </div>
            {appliedSubsidyManYen > 0 && selected ? (
              <div className="mt-2 inline-flex items-start gap-1.5 bg-ehc-500/15 border border-ehc-500/40 rounded-lg px-2.5 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-ehc-400 flex-shrink-0 mt-0.5" />
                <span className="text-[11px] text-ehc-200 font-semibold leading-snug">
                  適用中の補助金：{selected.name}（補助率 {selected.rate}）
                </span>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-amber-300/90">
                {wantSubsidy
                  ? "補助金は未反映（下の「補助金プランを選ぶ」で補助金を選び、要件にチェックを入れてください）"
                  : "補助金なし（自己負担）で試算中"}
              </div>
            )}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            {appliedSubsidyManYen > 0 ? (
              <>
                <div className="text-[11px] text-slate-400 mb-2">投資回収年数の比較</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <div className="text-[10px] text-slate-500">補助金なし</div>
                    <div className="text-xl font-bold text-slate-300 line-through decoration-red-400/60">
                      {yearsNoSubsidy !== null ? `${yearsNoSubsidy}年` : "—"}
                    </div>
                  </div>
                  <div className="text-ehc-400 text-xl font-bold">→</div>
                  <div>
                    <div className="text-[10px] text-ehc-300">補助金あり</div>
                    <div className="text-3xl font-bold text-ehc-300">
                      {appliedYearsToRecover !== null ? `${appliedYearsToRecover}年` : "—"}
                    </div>
                  </div>
                  {yearsShortened !== null && yearsShortened > 0 && (
                    <div className="ml-auto bg-ehc-500/15 border border-ehc-500/40 text-ehc-200 text-xs font-bold px-2.5 py-1.5 rounded-lg">
                      {yearsShortened}年 短縮
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] text-slate-400 mb-2">
                  投資回収年数{wantSubsidy ? "（補助金なしで試算中）" : "（自己負担）"}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-slate-200">
                    {yearsNoSubsidy !== null ? `${yearsNoSubsidy}年` : "—"}
                  </div>
                  <div className="text-[10px] text-slate-500">電気代削減で回収</div>
                </div>
                {wantSubsidy && (
                  <div className="text-[10px] text-amber-300/90 mt-2">
                    補助金を反映すると回収年数が短縮されます（下で補助金を選択）
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 補助金プランナー：希望有無 → 補助金選択 → 要件クリア可否 でグラフ連動 */}
      <Card>
        <CardTitle icon={<Wallet className="w-5 h-5" />}>補助金プランを選ぶ</CardTitle>
        <p className="text-xs text-slate-400 -mt-1 mb-3">
          希望の有無・使いたい補助金・要件クリア可否を切り替えると、下のグラフ・実質負担額・回収年数が自動で連動します。
        </p>

        {/* ① 希望しますか */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-slate-300 mb-1.5">① 今回は補助金を希望しますか？</div>
          <div className="flex gap-1 p-1 bg-night-800 border border-white/10 rounded-lg w-fit flex-wrap">
            {([[true, "希望する"], [false, "希望しない（自己負担で更新）"]] as [boolean, string][]).map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setWantSubsidy(v)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${wantSubsidy === v ? "bg-ehc-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {wantSubsidy ? (
          fundable.length ? (
            <>
              {/* ② どの補助金 */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-slate-300 mb-1.5">② どの補助金を希望しますか？</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {visibleFundable.map((s) => {
                    const amt = subsidyAmountManYen(s, input.invest);
                    const active = s.id === selectedId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={`text-left rounded-xl border p-3 transition-colors ${active ? "border-ehc-400 bg-ehc-500/10" : "border-white/10 bg-night-900 hover:border-ehc-500/40"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100 leading-snug">{s.name}</div>
                          {active && <CheckCircle2 className="w-4 h-4 text-ehc-400 flex-shrink-0" />}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">補助率 {s.rate} ／ 上限 {s.max}</div>
                        <div className="text-sm font-bold text-ehc-300 mt-1">想定 ¥{(amt * 10000).toLocaleString("ja-JP")}</div>
                      </button>
                    );
                  })}
                </div>
                {hiddenCount > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    ※ 要件を満たさない補助金 {hiddenCount} 件は非表示にしています（③のチェックを戻すと再表示されます）。
                  </p>
                )}
              </div>

              {/* ③ 要件クリア可否 */}
              {selected && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4 text-cobalt-300" />
                      ③ これらの要件はクリアできますか？（外すと非該当として計算）
                    </div>
                    <button
                      type="button"
                      onClick={() => setEligChatOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-ehc-600 to-ehc-500 text-white text-[11px] font-bold hover:from-ehc-500 hover:to-ehc-400 transition-colors shadow-glow"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      チャットで該当を確認
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {selectedReqs.map((r, i) => (
                      <label key={i} className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedChecks[i] ?? true}
                          onChange={() => toggleReq(i)}
                          className="mt-0.5 w-4 h-4 accent-ehc-400 flex-shrink-0"
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                  <div
                    className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${allReqMet ? "bg-ehc-500/15 border border-ehc-500/40 text-ehc-200" : "bg-amber-500/10 border border-amber-500/30 text-amber-300"}`}
                  >
                    {allReqMet
                      ? `全要件クリア → この補助金 ¥${(selectedAmountManYen * 10000).toLocaleString("ja-JP")} をグラフに反映中`
                      : "未クリアの要件があります → 補助金なし（自己負担）で試算中。クリアできる場合はチェックを入れてください"}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">必要書類: {selected.docs}</p>
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
            <p className="text-sm text-slate-500">
              現在の条件でマッチする資金化可能な補助金がありません。所在地・規模・建物用途を変更するか、「希望しない」で自己負担の試算ができます。
            </p>
          )
        ) : (
          <p className="text-sm text-slate-400">
            補助金なし（自己負担）で試算します。下のグラフの「更新（補助金あり）」線は補助金なしと同じ位置になります。
          </p>
        )}
      </Card>

      <Card>
        <CardTitle icon={<BarChart3 className="w-5 h-5" />}>ROI シミュレーション</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <RoiBox label="想定補助金" value={`¥${(appliedSubsidyManYen * 10000).toLocaleString("ja-JP")}`} accent="green" />
          <RoiBox label="損益分岐(投資回収)" value={appliedYearsToRecover !== null ? `${appliedYearsToRecover} 年` : "計算不能"} accent="amber" />
          <RoiBox label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} accent="blue" />
          <RoiBox label="15年間累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} accent="purple" />
          <RoiBox label="CO₂削減(自動)" value={`${result.co2ReductionTon} t/年`} accent="green" />
        </div>

        {/* 投資効果 比較表（5/10/15年・損益分岐） */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-cobalt-300" /> 投資効果 比較表（実質投資 ¥{netInvestYen.toLocaleString("ja-JP")}＝設備投資−補助金）
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-1.5 pr-2">期間</th>
                  <th className="text-right py-1.5 px-2">累計電気代削減</th>
                  <th className="text-right py-1.5 px-2">純便益（削減−実質投資）</th>
                  <th className="text-right py-1.5 pl-2">投資対効果</th>
                </tr>
              </thead>
              <tbody>
                {horizons.map((h) => (
                  <tr key={h.y} className="border-b border-white/5">
                    <td className="py-1.5 pr-2 text-slate-200 font-semibold">{h.y}年</td>
                    <td className="py-1.5 px-2 text-right text-slate-200">¥{h.cum.toLocaleString("ja-JP")}</td>
                    <td className={`py-1.5 px-2 text-right font-bold ${h.net >= 0 ? "text-ehc-300" : "text-red-300"}`}>
                      {h.net >= 0 ? "+" : "−"}¥{Math.abs(h.net).toLocaleString("ja-JP")}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-cobalt-200">
                      {netInvestYen > 0 ? `${(h.cum / netInvestYen).toFixed(1)}倍` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            損益分岐点 = {appliedYearsToRecover !== null ? `約${appliedYearsToRecover}年` : "—"}。純便益がプラスに転じる時点。電気単価27円/kWhで試算。
          </div>
        </div>

        <IndustryBasis building={input.building} result={result} />
      </Card>

      {/* 全体 / 設備グループ別 タブ */}
      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <CardTitle icon={<LineChartIcon className="w-5 h-5" />} className="border-b-0 pb-0 mb-0">
            削減シミュレーション
          </CardTitle>
          <div className="flex gap-1 p-1 bg-night-800 border border-white/10 rounded-lg">
            {([["overall", "全体"], ["groups", "設備グループ別"]] as ["overall" | "groups", string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${view === v ? "bg-cobalt-600 text-white" : "text-slate-400 hover:text-white"}`}
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
              saveYenPerYear={result.saveYenPerYear}
              kwhPerYear={totalKwhForChart}
              reductionRate={result.effectiveReductionRate}
            />
            <div className="text-[11px] text-slate-400 grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1.5">
                <strong className="text-red-300">赤線:</strong> 何もしない（旧機器維持）
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                <strong className="text-amber-300">橙線:</strong> 更新（補助金なし）
              </div>
              <div className="bg-ehc-500/10 border border-ehc-500/30 rounded-md px-2 py-1.5">
                <strong className="text-ehc-300">緑線:</strong> 更新（補助金あり）← ベスト
              </div>
            </div>
            {result.groups.length > 1 && (
              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-300 mb-1.5">設備グループ別 年間削減額の内訳</div>
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
              <div className="text-xs font-semibold text-slate-300 mb-1.5">設備グループ別 年間削減額の比較</div>
              <GroupSavingsChart groups={result.groups} />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Target className="w-5 h-5" />}>適用可能な補助金</CardTitle>
        {result.matched.length ? (
          <div className="space-y-3">
            {result.matched.map((s) => (
              <div key={s.id} className="border border-ehc-500/30 bg-gradient-to-br from-ehc-500/10 to-night-900 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-ehc-300">
                  <CheckCircle2 className="w-4 h-4 text-ehc-400 flex-shrink-0" />
                  {s.name}
                </h3>
                <div className="text-xs text-slate-400 mb-2.5 flex flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md font-medium ${s.infoOnly ? "bg-amber-500/15 text-amber-300" : "bg-ehc-500/15 text-ehc-300"}`}>{s.infoOnly ? "情報提供（要確認）" : "適用可能"}</span>
                  <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">期間: {s.period}</span>
                  <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">補助率: {s.rate}</span>
                  <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">上限: {s.max}</span>
                </div>
                <div className="text-xs text-slate-300">
                  <p><strong className="text-white">要件:</strong> {s.requirement}</p>
                  <p className="mt-1"><strong className="text-white">必要書類:</strong> {s.docs}</p>
                  {s.infoOnly && (
                    <p className="mt-1 text-amber-300/90">※ 販路開拓・業務効率化が主目的の制度です。設備費が補助対象経費になるかは事業計画次第のため、想定補助金・投資回収には含めていません。</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">条件に合致する補助金が見つかりません。条件を変更してください。</p>
        )}
      </Card>

      <Card>
        <CardTitle icon={<Lightbulb className="w-5 h-5" />}>今やるべき5つの理由</CardTitle>
        <ul className="space-y-2.5">
          {result.reasons.map((r, i) => (
            <li key={i} className="bg-gradient-to-r from-amber-500/10 to-night-900 border border-amber-500/20 px-4 py-3 rounded-xl text-sm text-slate-100 flex items-start gap-3">
              <span className="bg-amber-500/20 text-amber-300 font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
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

const ACCENT_COLORS = {
  green: "from-ehc-500/10 to-ehc-500/10 text-ehc-300",
  amber: "from-amber-500/10 to-amber-500/10 text-amber-300",
  blue: "from-sky-500/10 to-sky-500/10 text-sky-300",
  purple: "from-violet-500/10 to-violet-500/10 text-violet-300",
};

function RoiBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "green" | "amber" | "blue" | "purple";
}) {
  return (
    <div className={`bg-gradient-to-br ${ACCENT_COLORS[accent]} p-4 rounded-xl shadow-soft`}>
      <div className="text-[11px] text-slate-400 font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
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
  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
        <PieChart className="w-3.5 h-3.5 text-ehc-400" />
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
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 mb-3">
        {profile.electricBreakdown.map((b) => (
          <span key={b.category} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: b.color }} />
            {b.category} {b.pct}%
          </span>
        ))}
      </div>
      {/* 削減率の内訳: 業種＋冷媒世代＋設備制御＋経年回復 = 実効 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center mb-2.5">
        <div className="bg-night-900 border border-white/10 rounded-md p-2">
          <div className="text-[10px] text-slate-500">業種・高効率化</div>
          <div className="text-sm font-bold text-slate-200">{basePct}%</div>
        </div>
        <div className="bg-night-900 border border-white/10 rounded-md p-2">
          <div className="text-[10px] text-slate-500">冷媒世代</div>
          <div className="text-sm font-bold text-ehc-300">+{refriPct}%</div>
        </div>
        <div className="bg-night-900 border border-white/10 rounded-md p-2">
          <div className="text-[10px] text-slate-500">設備制御</div>
          <div className="text-sm font-bold text-ehc-300">+{equipPct}%</div>
        </div>
        <div className="bg-night-900 border border-white/10 rounded-md p-2">
          <div className="text-[10px] text-slate-500">経年劣化(加重平均)</div>
          <div className="text-sm font-bold text-amber-300">+{agePct}%</div>
        </div>
        <div className="bg-cobalt-600/15 border border-cobalt-500/40 rounded-md p-2">
          <div className="text-[10px] text-cobalt-200">実効削減率</div>
          <div className="text-sm font-bold text-cobalt-200">{effPct}%</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {profile.label}は冷媒設備（空調{ac ? `${ac.pct}%` : ""}{fridge ? `＋冷凍冷蔵${fridge.pct}%` : ""}）が電力の約{refrigerantPct}%。
        高効率化{basePct}%に、冷媒世代差+{refriPct}%（R22/R410A→R32）・設備制御+{equipPct}%（マルチ部分負荷）・経年劣化回復+{agePct}%（設備グループの加重平均・年約2%）を合成し、
        <strong className="text-cobalt-200">実効{effPct}%</strong>として試算（出典: 資源エネルギー庁／メーカー資料／業界資料「10〜15年で20〜40%低下」「R22機は最新比で消費電力大」／EHC施工実績）。設備グループ別の内訳は「設備グループ別」タブをご覧ください。
      </p>
    </div>
  );
}

// 設備グループ1件の結果カード
function GroupCard({ g }: { g: GroupResult }) {
  const refriColor = g.refri === "r22" ? "text-red-300 bg-red-500/15" : g.refri === "r410a" ? "text-amber-300 bg-amber-500/15" : "text-ehc-300 bg-ehc-500/15";
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${refriColor}`}>{g.refri.toUpperCase()}</span>
          <span className="text-xs text-slate-300">{g.equip === "multi" ? "マルチ" : "パッケージ"} ・ {g.units}台</span>
        </div>
        <span className="text-[10px] text-slate-500">{g.installYear}年設置 / 築{g.age}年</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] text-slate-500">実効削減率</div>
          <div className="text-2xl font-bold text-cobalt-200">{Math.round(g.effectiveReductionRate * 100)}%</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">年間削減</div>
          <div className="text-lg font-bold text-ehc-300">¥{g.saveYenPerYear.toLocaleString("ja-JP")}</div>
          <div className="text-[10px] text-slate-500">{g.kwh.toLocaleString("ja-JP")} kWh/年</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">
        <span className="bg-night-900 border border-white/10 rounded px-1.5 py-0.5">冷媒世代 +{Math.round(g.refriGenRate * 100)}%</span>
        <span className="bg-night-900 border border-white/10 rounded px-1.5 py-0.5">経年 +{Math.round(g.ageDegradationRate * 100)}%</span>
        {g.equipBonusRate > 0 && <span className="bg-night-900 border border-white/10 rounded px-1.5 py-0.5">制御 +{Math.round(g.equipBonusRate * 100)}%</span>}
      </div>
    </div>
  );
}
