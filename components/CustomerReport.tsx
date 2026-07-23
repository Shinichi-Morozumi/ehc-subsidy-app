"use client";

import { useState, useRef } from "react";
import { Card, CardTitle } from "./ui/Card";
import { MatchInput, Subsidy } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { RoiChart } from "./RoiChart";
import { NextSteps } from "./NextSteps";
import { AchievementsSection } from "./AchievementsSection";
import { Printer, FileText, Handshake, Calendar, LineChart, Award, ClipboardList, Mail } from "lucide-react";
import { INDUSTRY_PROFILES } from "@/lib/industries";
import { QRCodeSVG } from "qrcode.react";

// ── 提案書の送付フロー（将来実装メモ）─────────────────────────
// 現状: 画面で「印刷 / PDF保存」して手動共有。
// 次段階: お問い合わせ受信 → お客様の会社情報（社名・担当・住所等）取得 →
//         本テンプレートに自動差し込み → PDF生成 → 自動メール送信。
//   ※メール自動送信は別途バックエンド/連携（要権限）。本コンポーネントは出力体裁のみ担当。
// ───────────────────────────────────────────────

const BUILDING_LABELS: Record<string, string> = {
  office: "オフィス・事務所", retail: "小売店舗", restaurant: "飲食店",
  hotel: "ホテル・宿泊", medical: "医療・福祉", school: "学校・教育", other: "その他事業所",
};
const REFRI_LABELS: Record<string, string> = {
  r22: "R22（HCFC・製造禁止）", r410a: "R410A（HFC・廃止進行中）", r32: "R32（GWP675）", unknown: "不明",
};

export function CustomerReport({
  input,
  result,
  appliedSubsidyManYen,
  appliedSubsidy,
}: {
  input: MatchInput;
  result: MatchResult;
  // プランナー②で選択し、③該当チェックで確定した補助金額（万円）。渡された場合はこちらを優先表示。
  appliedSubsidyManYen?: number;
  // 上記に対応する「ご希望の補助金」。提案書の補助金一覧で強調表示する。
  appliedSubsidy?: Subsidy | null;
}) {
  const now = new Date();
  const today = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const proposalNo = `EHC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  // 表示する補助金額: プランナーで確定した額があればそれを、なければ自動計算の最有力額を使う
  const displaySubsidyManYen = appliedSubsidyManYen ?? result.bestSubsidyManYen;
  const displaySubsidyYen = Math.round(displaySubsidyManYen * 10000);
  const rewardYen = Math.round(displaySubsidyManYen * 10000 * 0.1);
  const industryLabel = (INDUSTRY_PROFILES[input.building] ?? INDUSTRY_PROFILES.other).label;

  // 会社名・メール・電話・住所を必須にする
  const requiredFields = [
    { val: input.customerCompany, id: "customer-company-input", label: "会社名" },
    { val: input.customerEmail, id: "customer-email-input", label: "メールアドレス" },
    { val: input.customerPhone, id: "customer-phone-input", label: "電話番号" },
    { val: input.customerAddress, id: "customer-address-input", label: "住所" },
  ];
  const firstMissing = requiredFields.find((f) => !(f.val ?? "").trim());
  const customerReady = !firstMissing;
  // クリック時の注意メッセージ（一定時間で自動的に消える）
  const [reqNotice, setReqNotice] = useState<string | null>(null);
  // 印刷/PDF後の「EHC・PNへ自動送信」確認パネルの表示制御と送信状態
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // PDF化する提案書本体（この要素をそのままキャプチャして添付）
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (firstMissing) {
      // 未入力の必須項目があれば、印刷を止めてクリック時にメッセージを表示し、該当欄まで自動スクロール＆フォーカスして誘導
      setReqNotice(
        `PDFを取得するには必要情報（会社名・メール・電話・住所）の記入が必要です。未入力の「${firstMissing.label}」欄へご案内しました。`
      );
      window.setTimeout(() => setReqNotice(null), 6000);
      const section = document.getElementById("customer-info-section");
      const field = document.getElementById(firstMissing.id) as HTMLInputElement | null;
      (section ?? field)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (field) {
        window.setTimeout(() => {
          field.focus();
          field.classList.add("ring-2", "ring-amber-400", "border-amber-400");
          window.setTimeout(
            () => field.classList.remove("ring-2", "ring-amber-400", "border-amber-400"),
            2000
          );
        }, 400);
      }
      return;
    }
    setReqNotice(null);
    // 印刷/PDF保存が終わったら、確認を挟まずEHC（+PN cc）へPDF添付で即自動送信する
    const onAfterPrint = () => {
      window.removeEventListener("afterprint", onAfterPrint);
      setSendResult(null);
      setShowSend(true); // 送信状況（送信中／結果）を表示
      void handleAutoSend(); // 確認なしで即送信
    };
    window.addEventListener("afterprint", onAfterPrint);
    window.print();
  };

  // 提案書本体を画面のままPDF化して base64 を返す
  const buildProposalPdf = async (): Promise<{ base64: string; filename: string }> => {
    const [{ default: html2canvas }, jsPDFmod] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const JsPDF = (jsPDFmod as { jsPDF?: typeof import("jspdf").jsPDF }).jsPDF ?? (jsPDFmod as unknown as { default: typeof import("jspdf").jsPDF }).default;
    const node = reportRef.current;
    if (!node) throw new Error("提案書の描画が見つかりません。");
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: node.scrollWidth,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    return { base64: pdf.output("datauristring"), filename: `提案書_${proposalNo}.pdf` };
  };

  // 確認パネルの「送信する」= PDF生成 → /api/send-proposal で EHC(+PN cc) へ自動送信
  const handleAutoSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const { base64, filename } = await buildProposalPdf();
      const res = await fetch("/api/send-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: base64,
          filename,
          subject: `【提案書 ${proposalNo}】現地調査・お見積りのご依頼（${input.customerCompany || "御社名"}）`,
          text: inquiryBody,
          replyTo: input.customerEmail || undefined,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "応答の解析に失敗しました。" }));
      if (res.ok && data.ok) {
        setSendResult({ ok: true, msg: "送信しました。EHC（info@ehcjpn.com）とPNにPDF付きで届きます。" });
      } else {
        setSendResult({
          ok: false,
          msg: (data && data.error) || "送信に失敗しました。下の「メーラーで送る」からお送りください。",
        });
      }
    } catch {
      setSendResult({
        ok: false,
        msg: "PDF生成または送信でエラーが発生しました。下の「メーラーで送る」からお送りください。",
      });
    } finally {
      setSending(false);
    }
  };

  // 問い合わせ内容が一目で分かるよう、会社情報・設備台数・試算サマリーを本文に差し込む
  const totalUnits = result.groups.reduce((s, g) => s + g.units, 0);
  const groupsText = result.groups
    .map(
      (g) =>
        `・${g.refri.toUpperCase()} ${g.equip === "multi" ? "マルチ" : "パッケージ"} / 設置${g.installYear}年 / ${g.units}台`
    )
    .join("\n");
  const inquiryBody = `EHC 補助金・空調更新のお問い合わせです。以下の内容でご確認をお願いします。

■ 提案書番号: ${proposalNo}
■ 発行日: ${today}

【お客様情報】
会社名: ${input.customerCompany || "（未入力）"}
ご担当: ${input.customerContact || "（未入力）"}
メール: ${input.customerEmail || "（未入力）"}
電話: ${input.customerPhone || "（未入力）"}
住所: ${input.customerAddress || "（未入力）"}

【ヒアリング内容】
業種・用途: ${BUILDING_LABELS[input.building] ?? "—"}（${industryLabel}）
対象設備: 合計 ${totalUnits}台
${groupsText}
年間電力使用量: ${result.totalKwh.toLocaleString("ja-JP")} kWh（${input.kwhMode === "measured" ? "実測" : "自動按分"}）
設備投資概算: ${input.invest.toLocaleString("ja-JP")} 万円

【試算サマリー】
想定補助金額: ¥${displaySubsidyYen.toLocaleString("ja-JP")}
損益分岐(回収): ${result.yearsToRecover !== null ? `${result.yearsToRecover}年` : "—"}
年間電気代削減: ¥${result.saveYenPerYear.toLocaleString("ja-JP")}
15年累計削減: ¥${result.total15YearsYen.toLocaleString("ja-JP")}
CO₂削減/年: ${result.co2ReductionTon} t

【EHC担当】${input.ehcStaff || "—"}

※このメールは提案書PDFの内容を要約したものです。PDFを保存済みの場合は添付してください。`;

  // 保存(PDF)後もお問い合わせが届くよう、宛先(EHC)＋cc(PN)・件名・本文（会社情報/台数/試算）を仕込んだmailtoリンク
  const inquiryMailto = `mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent(
    `【提案書 ${proposalNo}】現地調査・お見積りのご依頼（${input.customerCompany || "御社名"}）`
  )}&body=${encodeURIComponent(inquiryBody)}`;

  // QRコード用は本文を含めない短いmailto（本文入りだとQRの容量上限を超えてクラッシュするため）。
  const inquiryMailtoShort = `mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent(
    `【提案書 ${proposalNo}】現地調査・お見積りのご依頼（${input.customerCompany || "御社名"}）`
  )}`;

  return (
    <Card className="border-2 border-ehc-200 customer-report">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
        <CardTitle icon={<FileText className="w-5 h-5" />} className="border-b-0 pb-0 mb-0">
          お客様向け提案書
        </CardTitle>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={handlePrint}
            title={customerReady ? "" : "押すと未入力の必須項目（会社名・メール・電話・住所）へご案内します"}
            className="bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-card hover:shadow-lift transition-all"
          >
            <Printer className="w-4 h-4" />
            印刷 / PDF保存
          </button>
          {!customerReady && (
            <span className="text-[11px] text-amber-600 font-medium">
              PDF出力には会社名・メール・電話・住所の入力が必要です
            </span>
          )}
          {reqNotice && (
            <div
              role="alert"
              className="max-w-[280px] text-right text-[12px] leading-snug text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 shadow-card"
            >
              {reqNotice}
            </div>
          )}
          {showSend && (
            <div className="max-w-[320px] text-right text-[12px] leading-snug text-ehc-900 bg-ehc-50 border border-ehc-300 rounded-lg px-3 py-2.5 shadow-card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-left flex items-center gap-1.5">
                  {sending ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-ehc-300 border-t-ehc-700 rounded-full animate-spin" />
                      EHC（info@ehcjpn.com）と PN へ PDF添付で自動送信中…
                    </>
                  ) : sendResult ? (
                    sendResult.ok ? "送信が完了しました。" : "自動送信に失敗しました。"
                  ) : (
                    "EHC と PN へ自動送信します…"
                  )}
                </p>
                {!sending && (
                  <button
                    onClick={() => setShowSend(false)}
                    className="px-2.5 py-1 rounded-md text-[12px] font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 flex-shrink-0"
                  >
                    閉じる
                  </button>
                )}
              </div>
              {!sending && sendResult && !sendResult.ok && (
                <button
                  onClick={handleAutoSend}
                  className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700"
                >
                  再送信する
                </button>
              )}
              {sendResult && (
                <p
                  className={`text-left text-[12px] ${
                    sendResult.ok ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {sendResult.msg}
                </p>
              )}
              <p className="text-left text-[11px] text-slate-500">
                うまくいかない場合は
                <a href={inquiryMailto} className="text-ehc-700 underline font-medium">
                  メーラーで送る
                </a>
                （PDFはご自身で添付）。
              </p>
            </div>
          )}
        </div>
      </div>

      <div
        ref={reportRef}
        className="report-sheet relative overflow-hidden border-2 border-slate-200 rounded-xl p-6 bg-white select-none"
      >
        {/* 透かし（画面＋全印刷ページ）: コピー・スクショ・無断転載の抑止 */}
        <div className="watermark-layer" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i}>EHC SOLUTIONS ｜ 社外秘 ｜ 無断複製・転載禁止 ｜ {proposalNo}</div>
          ))}
        </div>
        <div className="text-center border-b-2 border-ehc-700 pb-4 mb-5">
          <div className="text-xs text-slate-500 mb-1">業務用空調 更新工事 ご提案書</div>
          <h1 className="text-2xl font-bold text-ehc-900 mb-2">
            {input.customerCompany || "お客様"} 御中
          </h1>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {today}
            </span>
            {input.customerContact && <span>ご担当: {input.customerContact} 様</span>}
            <span className="text-slate-400">提案書番号: {proposalNo}</span>
          </div>
          {(input.customerAddress || input.customerPhone || input.customerEmail) && (
            <div className="flex items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 flex-wrap mt-1.5">
              {input.customerAddress && <span>{input.customerAddress}</span>}
              {input.customerPhone && <span>TEL: {input.customerPhone}</span>}
              {input.customerEmail && <span>{input.customerEmail}</span>}
            </div>
          )}
        </div>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            1. ご確認条件（ヒアリング内容）
          </h2>
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 mb-3">
              <CondCell label="業種・用途" value={`${BUILDING_LABELS[input.building] ?? "—"}（${industryLabel}）`} />
              <CondCell label="年間電力使用量" value={`${result.totalKwh.toLocaleString("ja-JP")} kWh${input.kwhMode === "measured" ? "（実測）" : "（自動按分）"}`} />
              <CondCell label="設備投資概算" value={`${input.invest.toLocaleString("ja-JP")} 万円`} />
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-left py-1">冷媒</th>
                  <th className="text-left py-1">種別</th>
                  <th className="text-right py-1">設置年</th>
                  <th className="text-right py-1">築年</th>
                  <th className="text-right py-1">台数</th>
                  <th className="text-right py-1">年間kWh</th>
                </tr>
              </thead>
              <tbody>
                {result.groups.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100">
                    <td className="py-1 font-semibold text-slate-800">{g.refri.toUpperCase()}</td>
                    <td className="py-1 text-slate-700">{g.equip === "multi" ? "マルチ" : "パッケージ"}</td>
                    <td className="py-1 text-right text-slate-700">{g.installYear}</td>
                    <td className="py-1 text-right text-slate-700">築{g.age}年</td>
                    <td className="py-1 text-right text-slate-700">{g.units}台</td>
                    <td className="py-1 text-right text-slate-700">{g.kwh.toLocaleString("ja-JP")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            ※ 上記は御社からのヒアリング値に基づく試算条件です。正式見積は現地調査後にご提示します。
          </p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            2. ご提案サマリー
          </h2>
          <p className="text-[11px] text-slate-600 mb-2">
            {industryLabel}は冷媒設備が電力の多くを占め、設置年・冷媒世代に応じた経年劣化（年約2%）も加味すると、
            高効率化＋経年回復で<strong className="text-ehc-700">全体の実効削減率 {(result.effectiveReductionRate * 100).toFixed(0)}%</strong>
            （出典: 資源エネルギー庁／業界資料／EHC施工実績）で試算しています。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCell label="想定補助金額" value={`¥${displaySubsidyYen.toLocaleString("ja-JP")}`} color="green" />
            <SummaryCell label="損益分岐(回収)" value={result.yearsToRecover !== null ? `${result.yearsToRecover} 年` : "—"} color="amber" />
            <SummaryCell label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} color="blue" />
            <SummaryCell label="15年累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} color="purple" />
            <SummaryCell label="CO₂削減/年" value={`${result.co2ReductionTon} t`} color="green" />
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            3. 15年累計コスト 比較シミュレーション
          </h2>
          <div className="bg-slate-50 rounded-xl p-3 mb-2">
            <RoiChart
              invest={input.invest}
              bestSubsidyManYen={displaySubsidyManYen}
              saveYenPerYear={result.saveYenPerYear}
              kwhPerYear={result.totalKwh || input.kwh}
              reductionRate={result.effectiveReductionRate}
            />
          </div>
          <div className="text-[11px] text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-2">
            <div className="bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
              <strong className="text-red-700">赤線:</strong> 何もしない（旧機器維持・効率低下＆修理費）
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
              <strong className="text-amber-700">橙線:</strong> 更新（補助金なし）
            </div>
            <div className="bg-ehc-50 border border-ehc-200 rounded-md px-2 py-1.5">
              <strong className="text-ehc-700">緑線:</strong> 更新（補助金あり）← ベスト
            </div>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            4. 適用可能な補助金制度
          </h2>
          {result.matched.length ? (
            <ul className="space-y-2">
              {result.matched.map((s) => {
                const isChosen = !!appliedSubsidy && s.id === appliedSubsidy.id;
                return (
                <li key={s.id} className={`text-xs border rounded-lg p-3 ${isChosen ? "border-ehc-400 bg-ehc-100/70 ring-1 ring-ehc-300" : "border-slate-200 bg-ehc-50/40"}`}>
                  <div className="font-semibold text-ehc-900 mb-1 flex items-center gap-2">
                    <span>◆ {s.name}</span>
                    {isChosen && (
                      <span className="text-[10px] font-bold text-white bg-ehc-600 rounded-full px-2 py-0.5">ご希望</span>
                    )}
                  </div>
                  <div className="text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-1">
                    <span>主催: {s.org}</span>
                    <span>補助率: {s.rate}</span>
                    <span>上限: {s.max}</span>
                  </div>
                  <div className="text-slate-600 mt-1">公募期間: {s.period}</div>
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">条件に該当する補助金が現在見当たりません。個別ヒアリングにてご相談ください。</p>
          )}
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            5. 今、更新をご検討いただきたい理由
          </h2>
          <ol className="space-y-1.5 text-xs text-slate-700 list-decimal list-inside">
            {result.reasons.map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ol>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            6. EHC 推奨プラン
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">{result.ehcPlan}</p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" />
            7. EHC 導入実績（御社業種マッチ）
          </h2>
          <AchievementsSection building={input.building} equip={result.representativeEquip} />
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3 flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            8. 補助金獲得サポートと報酬体系
          </h2>
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-xs space-y-2">
            <p className="text-slate-800 leading-relaxed">
              EHCソリューションズは、補助金の<strong>適用判定・申請書類作成・実績報告まで一気通貫</strong>でサポートいたします。
            </p>
            <div className="bg-white border border-amber-300 rounded-md p-3 mt-2">
              <div className="text-amber-900 font-bold mb-1">■ 成功報酬</div>
              <div className="text-slate-800">
                獲得補助金額の <span className="text-2xl font-bold text-amber-700">10%</span>
              </div>
              {displaySubsidyManYen > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200 text-slate-700">
                  本ケース想定: 補助金 ¥{displaySubsidyYen.toLocaleString("ja-JP")} → サポート報酬{" "}
                  <strong className="text-amber-800">¥{rewardYen.toLocaleString("ja-JP")}</strong>
                </div>
              )}
            </div>
            <p className="text-slate-600 text-[11px]">
              ※ 不採択の場合、サポート報酬は発生しません（完全成功報酬制）。
              <br />
              ※ 設備費・工事費は別途お見積りいたします。
            </p>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            9. 次のステップ（より詳細なシミュレーションへ）
          </h2>
          <NextSteps />
        </section>

        {/* お問い合わせ導線（印刷/PDF保存後も残る・QRから件名入りメールが起動） */}
        <div className="mt-6 border-2 border-ehc-600 rounded-lg p-4 bg-ehc-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-bold text-ehc-900 text-sm mb-1 flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              お見積り・現地調査（無料）のお申し込み
            </div>
            <div className="text-slate-700 text-xs">
              メール:{" "}
              <a href={inquiryMailto} className="font-semibold text-ehc-800 underline">
                info@ehcjpn.com
              </a>
              （件名に提案書番号 <strong>{proposalNo}</strong> をご記載ください）
            </div>
            <div className="text-slate-500 text-[10px] mt-1">
              右のQRコードをスマホのカメラで読み取ると、宛先・件名入りのお問い合わせメールがそのまま開きます。
            </div>
          </div>
          <div className="bg-white p-2 rounded-md border border-slate-200 flex-shrink-0">
            <QRCodeSVG value={inquiryMailtoShort} size={84} level="M" fgColor="#0a0a0a" bgColor="#ffffff" />
          </div>
        </div>

        <footer className="border-t-2 border-slate-200 pt-4 mt-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-bold text-ehc-900 mb-1">株式会社EHCソリューションズ</div>
              <div className="text-slate-600">業務用空調・GX・補助金 専門</div>
              {input.ehcStaff && <div className="text-slate-700 mt-1">担当: {input.ehcStaff}</div>}
            </div>
            <div className="text-right text-slate-500 text-[11px]">
              本提案書は試算値に基づくものであり、実際の補助金採択・補助額・電気代削減効果を保証するものではありません。
            </div>
          </div>
          {/* 無断利用に関する法的注意（著作権法・不正競争防止法に基づく警告） */}
          <div className="mt-3 border border-slate-300 rounded-md p-3 bg-slate-50 text-[10px] text-slate-600 leading-relaxed">
            <strong className="text-slate-800">【本提案書の取り扱いについて】</strong>
            <br />
            本提案書および記載内容（試算結果・提案プラン・施工実績データ・価格情報等）に関する著作権その他一切の権利は、株式会社EHCソリューションズに帰属し、著作権法により保護されています。
            当社の書面による事前承諾なく、本提案書の全部または一部を複製・転載・改変・撮影・第三者への開示もしくは提供（相見積り取得を目的とした他社への提示を含む）することを固く禁じます。
            これらに違反した場合、著作権法に基づく差止請求・損害賠償請求、および不正競争防止法（営業秘密の不正使用）に基づく法的措置の対象となることがあります。
            本提案書は宛先のお客様に限りご利用いただけます（提案書番号 {proposalNo} にて交付先を管理しています）。
            <br />
            © {now.getFullYear()} EHC Solutions Co., Ltd. All Rights Reserved.
          </div>
        </footer>
      </div>
    </Card>
  );
}

const SUMMARY_COLORS = {
  green: "bg-ehc-50 border-ehc-200 text-ehc-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
  blue: "bg-sky-50 border-sky-200 text-sky-900",
  purple: "bg-violet-50 border-violet-200 text-violet-900",
};

function CondCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "amber" | "blue" | "purple";
}) {
  return (
    <div className={`border rounded-lg p-3 ${SUMMARY_COLORS[color]}`}>
      <div className="text-[10px] opacity-80 mb-1">{label}</div>
      <div className="text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}
