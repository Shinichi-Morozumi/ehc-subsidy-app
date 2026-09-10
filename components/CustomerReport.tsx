"use client";

import { useState, useRef } from "react";
import { Card, CardTitle } from "./ui/Card";
import { MatchInput, Subsidy, INTEREST_LABELS } from "@/lib/types";
import { MatchResult } from "@/lib/match";
import { RoiChart, RoiChartLegend } from "./RoiChart";
import {
  SubsidyState, SUBSIDY_STATE_NOTE, INVEST_UNKNOWN_LABEL, resolveInvestState, yearsOrUnknown,
} from "@/lib/roiState";
import { NextSteps } from "./NextSteps";
import { AchievementsSection } from "./AchievementsSection";
import { Printer, FileText, Handshake, Calendar, LineChart, Award, ClipboardList, Mail } from "lucide-react";
import { INDUSTRY_PROFILES } from "@/lib/industries";
import { PROVISIONAL_COEFFICIENT_NOTE } from "@/lib/coefficients";
import { QRCodeSVG } from "qrcode.react";
import { DiagnosisSummary } from "./DiagnosisSummary";
import { ProgramMatchBoard, useProgramAssessments } from "./ProgramMatchBoard";
import { ReportPrintSheet } from "./ReportPrintSheet";
import { BUILDING_LABELS } from "@/lib/labels";
import { issueDocumentNumber, documentFileName } from "@/lib/docNumber";
import { useModalA11y } from "./ui/useModalA11y";

// ── 提案書の送付フロー（将来実装メモ）─────────────────────────
// 現状: 画面で「印刷 / PDF保存」して手動共有。
// 次段階: お問い合わせ受信 → お客様の会社情報（社名・担当・住所等）取得 →
//         本テンプレートに自動差し込み → PDF生成 → 自動メール送信。
//   ※メール自動送信は別途バックエンド/連携（要権限）。本コンポーネントは出力体裁のみ担当。
// ───────────────────────────────────────────────

/* 2026-09-08 EHC-0028:
   BUILDING_LABELS / REFRI_LABELS はここに直書きされていたが、
   印刷専用シート（ReportPrintSheet.tsx）でも同じ表示名を使うため lib/labels.ts へ移した。 */

export function CustomerReport({
  input,
  result,
  appliedSubsidyManYen,
  appliedSubsidy,
  subsidyState,
}: {
  input: MatchInput;
  result: MatchResult;
  // プランナー②で選択し、③該当チェックで確定した補助金額（万円）。渡された場合はこちらを優先表示。
  appliedSubsidyManYen?: number;
  // 上記に対応する「ご希望の補助金」。提案書の補助金一覧で強調表示する。
  appliedSubsidy?: Subsidy | null;
  /* 2026-09-10 EHC-0031 F03:
     補助額の状態（未確認 / 算定0円 / 算定済み）は画面側の判定をそのまま受け取る。
     提案書側で金額から作り直すと、同じ案件で画面と紙が違うことを言う。 */
  subsidyState?: SubsidyState;
}) {
  const now = new Date();
  const today = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  /* 2026-08-24 監査での修正:
       以前は `EHC-${年}${月}${日}` と日付だけで、同日発行の診断書は
       顧客が違っても番号もPDFファイル名も同一だった。
     useState の初期化関数で1回だけ発行し、再レンダーで番号が変わらないようにする
     （毎レンダーで new Date() すると、印刷前後で番号が変わってしまう）。 */
  const [proposalNo] = useState(() => issueDocumentNumber());

  /* 2026-09-08 EHC-0028 §6A:
     制度の A/B/C 判定は1回だけ行い、画面（ProgramMatchBoard）と
     印刷専用シート（ReportPrintSheet）へ同じ配列を配る。
     印刷側で判定や補助額を再計算すると、紙と画面が食い違う。 */
  const { assessments, monitorCheckedAt } = useProgramAssessments(input, result);

  // 補助金は共通診断＋個別要件を確認した後だけ反映する。未確認時は0円。
  const displaySubsidyManYen = appliedSubsidyManYen ?? 0;
  /* 未指定時は従来互換。正額なら算定済み、0なら未確認とみなす（F03） */
  const reportSubsidyState: SubsidyState = subsidyState ?? (displaySubsidyManYen > 0 ? "positive" : "unconfirmed");
  const reportInvestState = resolveInvestState(input.invest);
  const displaySubsidyYen = Math.round(displaySubsidyManYen * 10000);
  const rewardYen = Math.round(displaySubsidyManYen * 10000 * 0.1);
  const industryLabel = (INDUSTRY_PROFILES[input.building] ?? INDUSTRY_PROFILES.other).label;
  // AIヒアリング冒頭で伺った「今日のご関心」。メール本文・Notionのメモに残して営業のフォローに使う
  const interestLabel = input.interest ? INTEREST_LABELS[input.interest] : null;

  // 会社名・メール・電話・住所を必須にする
  const requiredFields = [
    { val: input.customerCompany, id: "customer-company-input", label: input.customerKind === "individual" ? "お名前または屋号" : "会社名" },
    { val: input.customerEmail, id: "customer-email-input", label: "メールアドレス" },
    { val: input.customerPhone, id: "customer-phone-input", label: "電話番号" },
    { val: input.customerAddress, id: "customer-address-input", label: "住所" },
  ];
  const missingFields = requiredFields.filter((f) => !(f.val ?? "").trim());
  const firstMissing = missingFields[0];
  const customerReady = !firstMissing;
  const missingLabels = missingFields.map((f) => f.label).join("・");
  // 未入力のままPDFボタンを押したときに出すライトボックス（モーダル）の表示制御
  const [showReqModal, setShowReqModal] = useState(false);
  // 印刷/PDF後の「相談記録として送信」確認パネルの表示制御と送信状態
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // PDF化する提案書本体（この要素をそのままキャプチャして添付）
  const reportRef = useRef<HTMLDivElement>(null);

  /* 2026-08-24 監査での修正: Escape で閉じる処理だけは書かれていたが、
     Tab が背後のフォームまで抜ける・背後がスクロールする・閉じてもフォーカスが
     PDFボタンに戻らない、が残っていた。他のモーダルと同じフックに寄せる。 */
  const reqModalRef = useModalA11y(() => setShowReqModal(false), showReqModal && !customerReady);

  // 未入力の必須欄まで画面を送ってフォーカス＆ハイライトする（PDFボタン／案内パネル／モーダルから呼ぶ）
  const goToFirstMissing = () => {
    setShowReqModal(false);
    if (!firstMissing) return;
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
  };

  const handlePrint = () => {
    if (firstMissing) {
      // 未入力の必須項目があれば、印刷を止めてライトボックス（モーダル）で理由と手順を伝える
      setShowReqModal(true);
      return;
    }
    setShowReqModal(false);
    // 印刷/PDF保存後に送信パネルを表示する。ユーザーが明示選択するまで外部送信しない。
    const onAfterPrint = () => {
      window.removeEventListener("afterprint", onAfterPrint);
      setSendResult(null);
      setShowSend(true);
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
    return { base64: pdf.output("datauristring"), filename: documentFileName(proposalNo) };
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
          subject: `【診断書 ${proposalNo}】補助金・空調更新のご相談（${input.customerCompany || "お客様"}）`,
          text: inquiryBody,
          replyTo: input.customerEmail || undefined,
          // Notionアタックリスト自動追記用の構造化リード（送信APIが best-effort で追記）
          lead: {
            company: input.customerCompany || "",
            contact: input.customerContact || "",
            email: input.customerEmail || "",
            phone: input.customerPhone || "",
            address: input.customerAddress || "",
            /* 2026-09-10 EHC-0031 F01/F02:
               未確認・未算定を 0 として送らない。Notionのアタックリストに
               「補助金額(概算) 0円」「投資0万円」で記録されると、後で見た人が
               「算定して0だった案件」と読み違える（送信APIは undefined の
               プロパティを書き込まない実装なので、欄が空のまま残る）。 */
            subsidyYen: reportSubsidyState === "unconfirmed" ? undefined : displaySubsidyYen,
            yearsToRecover:
              typeof result.yearsToRecover === "number" ? result.yearsToRecover : null,
            wishSubsidy: appliedSubsidy ? appliedSubsidy.name : null,
            proposalNo,
            sentDate: new Date().toISOString().slice(0, 10),
            memo: `${industryLabel} / 投資${reportInvestState === "known" ? `${input.invest}万円` : INVEST_UNKNOWN_LABEL} / ご関心:${interestLabel ?? "-"} / EHC担当:${input.ehcStaff || "-"} / 個人情報利用同意:画面で取得済み`,
          },
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "応答の解析に失敗しました。" }));
      if (res.ok && data.ok) {
        /* 2026-08-24 監査での修正:
           以前は Notion（社内アタックリスト）への追記が失敗しても、
           常に「送信しました」とだけ表示していた。メールは届くがリード情報だけが消え、
           営業側は追記されていないことに気づけない状態だった。
           サーバが leadPersisted:false を返したら、その旨を必ず画面に出す。 */
        setSendResult({
          ok: true,
          msg:
            data.leadPersisted === false
              ? "送信しました。EHC（info@ehcjpn.com）とPNにPDF付きで届きます。※社内リストへの自動登録は失敗しました。担当者へ診断書番号をお伝えください。"
              : "送信しました。EHC（info@ehcjpn.com）とPNにPDF付きで届きます。",
        });
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
        `・${g.refri.toUpperCase()} ${g.equip === "multi" ? "マルチ" : "パッケージ"} / 設置${g.installYear}年 / 築${g.age}年 / ${g.units}台 / 年間${g.kwh.toLocaleString("ja-JP")}kWh`
    )
    .join("\n");
  // 印刷物（提案書）と同じ内容をメール本文にも入れ、電話口でそのまま案内できるようにする
  const chosenSubsidyName = appliedSubsidy ? appliedSubsidy.name : null;
  const subsidyListText = result.matched.length
    ? result.matched
        .map(
          (s) =>
            `・${s.name}（主催: ${s.org} / 補助率: ${s.rate} / 上限: ${s.max} / 公募: ${s.period}）${
              appliedSubsidy && s.id === appliedSubsidy.id ? "  ★ご希望" : ""
            }`
        )
        .join("\n")
    : "・現時点の情報だけで適格性が確定した制度はありません（下記の確認事項をご確認ください）。";
  // 判定不能の制度は「該当なし」ではないので、メール本文にも不足情報つきで載せる
  const pendingListText = result.needsCheck.length
    ? "\n\n【ご確認いただければ候補になりうる制度】\n" +
      result.needsCheck
        .map((s) => {
          const miss = (result.eligibility[s.id]?.missing ?? []).map((m) => `    - ${m}`).join("\n");
          return `・${s.name}（主催: ${s.org} / 補助率: ${s.rate} / 上限: ${s.max}）\n${miss}`;
        })
        .join("\n") +
      "\n※対象外が確定したという意味ではありません。判定に必要な情報が未取得のため、補助額は算定していません。"
    : "";
  const reasonsText = result.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const inquiryBody = `EHC 補助金・空調更新の診断結果（印刷物と同一内容）です。お電話でのご案内にそのままご利用ください。

■ 診断書番号: ${proposalNo}
■ 発行日: ${today}

【お客様情報】
会社名: ${input.customerCompany || "（未入力）"}
ご担当: ${input.customerContact || "（未入力）"}
メール: ${input.customerEmail || "（未入力）"}
電話: ${input.customerPhone || "（未入力）"}
住所: ${input.customerAddress || "（未入力）"}
${interestLabel ? `ご関心: ${interestLabel}\n` : ""}
【1. ご確認条件（ヒアリング内容）】
業種・用途: ${BUILDING_LABELS[input.building] ?? "—"}（${industryLabel}）
対象設備: 合計 ${totalUnits}台
${groupsText}
年間電力使用量: ${result.totalKwh.toLocaleString("ja-JP")} kWh（${input.kwhMode === "measured" ? "実測" : "自動按分"}）
今回更新分の設備投資概算: ${reportInvestState === "known" ? `${input.invest.toLocaleString("ja-JP")} 万円` : INVEST_UNKNOWN_LABEL}

【2. ご提案サマリー】（全体の実効削減率 約${(result.effectiveReductionRate * 100).toFixed(0)}%${result.coefficientAudit.allSourced ? "" : "・暫定値"}）${result.coefficientAudit.allSourced ? "" : `\n※${PROVISIONAL_COEFFICIENT_NOTE}`}
想定補助金額: ${reportSubsidyState === "unconfirmed" ? "未確認（要件確認前。0円という判定ではありません）" : `¥${displaySubsidyYen.toLocaleString("ja-JP")}`}
回収年数(補助金適用前・税抜): ${yearsOrUnknown(result.yearsToRecover)}
年間電気代削減: ¥${result.saveYenPerYear.toLocaleString("ja-JP")}
15年累計削減: ¥${result.total15YearsYen.toLocaleString("ja-JP")}
CO₂削減/年: ${result.co2ReductionTon} t

【3. ご希望の補助金】${chosenSubsidyName ?? "（未確定 / 最有力で試算中）"}

【4. 候補となる補助金制度】
${subsidyListText}${pendingListText}

【5. 今、更新をご検討いただきたい理由】
${reasonsText}

【6. EHC 推奨プラン】
${result.ehcPlan}

【7. 補助金サポート・成功報酬】
獲得補助金額の10%（本ケース想定: 補助金 ¥${displaySubsidyYen.toLocaleString("ja-JP")} → サポート報酬 ¥${rewardYen.toLocaleString("ja-JP")}）
※不採択の場合、サポート報酬は発生しません（完全成功報酬制）。設備費・工事費は別途お見積り。

【EHC担当】${input.ehcStaff || "—"}

※本メールは提案書（印刷物）と同一内容です。詳細レイアウト版は添付PDFをご覧ください。`;

  // 保存(PDF)後もお問い合わせが届くよう、宛先(EHC)＋cc(PN)・件名・本文（会社情報/台数/試算）を仕込んだmailtoリンク
  const inquiryMailto = `mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent(
    `【診断書 ${proposalNo}】補助金・空調更新のご相談（${input.customerCompany || "お客様"}）`
  )}&body=${encodeURIComponent(inquiryBody)}`;

  // QRコード用は本文を含めない短いmailto（本文入りだとQRの容量上限を超えてクラッシュするため）。
  const inquiryMailtoShort = `mailto:info@ehcjpn.com?cc=info@project-neo.co.jp&subject=${encodeURIComponent(
    `【診断書 ${proposalNo}】補助金・空調更新のご相談（${input.customerCompany || "お客様"}）`
  )}`;

  return (
    <Card className="border-2 border-ehc-200 customer-report">
      {/* 未入力のままPDFボタンを押したときのライトボックス（印刷には出さない） */}
      {showReqModal && !customerReady && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center p-4 bg-night-900/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-req-modal-title"
          onClick={() => setShowReqModal(false)}
        >
          <div
            ref={reqModalRef}
            tabIndex={-1}
            className="w-full max-w-md bg-white rounded-2xl shadow-lift border border-ehc-200 overflow-hidden focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-3.5 flex items-start gap-2.5">
              <ClipboardList className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 id="pdf-req-modal-title" className="font-bold text-amber-900 leading-tight">
                  PDF出力まであと1ステップ
                </h3>
                <p className="text-[12px] text-amber-800 mt-0.5">
                  診断書PDFのお名前・宛先の記載に必要な項目が未入力です。
                </p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-800">
              <div>
                <p className="text-[12px] font-semibold text-gray-500 mb-1.5">未入力の項目</p>
                <ul className="space-y-1">
                  {missingFields.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-[13px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="font-semibold">{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[13px] leading-relaxed bg-ehc-50 border border-ehc-200 rounded-lg px-3 py-2.5">
                画面上部の<strong>「お客様情報」</strong>に上記をご入力ください。入力後、この
                <strong>「印刷 / PDF保存」</strong>ボタンを押すとPDFが出力できます。
              </p>
            </div>
            <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={goToFirstMissing}
                className="flex-1 bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm shadow-card transition-all"
              >
                「{firstMissing?.label}」の入力欄へ移動
              </button>
              <button
                type="button"
                onClick={() => setShowReqModal(false)}
                className="sm:w-28 border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
        <CardTitle icon={<FileText className="w-5 h-5" />} className="border-b-0 pb-0 mb-0">
          お客様向け補助金・省エネ診断書
        </CardTitle>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={handlePrint}
            title={customerReady ? "" : `お客様情報の ${missingLabels} が未入力です。押すと入力欄へご案内します`}
            className="bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-card hover:shadow-lift transition-all"
          >
            <Printer className="w-4 h-4" />
            印刷 / PDF保存
          </button>
          {!customerReady && (
            <div className="max-w-[320px] text-left text-[12px] leading-snug text-amber-100 bg-amber-500/10 border border-amber-400/60 rounded-lg px-3 py-2.5 shadow-card space-y-2">
              <p className="font-bold text-amber-300">PDF出力まであと1ステップ</p>
              <p>
                画面上部の<strong className="text-white">「お客様情報」</strong>にご入力ください。未入力：
                <strong className="text-white">{missingLabels}</strong>
              </p>
              <p className="text-amber-200/90">
                入力後、この<strong className="text-white">「印刷 / PDF保存」</strong>ボタンからPDFを保存できます。
              </p>
              <button
                type="button"
                onClick={goToFirstMissing}
                className="w-full bg-amber-400 hover:bg-amber-300 text-night-900 font-bold px-3 py-1.5 rounded-md transition-colors"
              >
                お客様情報の入力欄へ移動
              </button>
            </div>
          )}
          {showSend && (
            <div className="max-w-[320px] text-right text-[12px] leading-snug text-ehc-900 bg-ehc-50 border border-ehc-300 rounded-lg px-3 py-2.5 shadow-card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-left flex items-center gap-1.5">
                  {sending ? (
                    <>
                      <span className="inline-block w-3 h-3 border-2 border-ehc-300 border-t-ehc-700 rounded-full animate-spin" />
                      EHC（info@ehcjpn.com）と PN へ PDF添付で送信中…
                    </>
                  ) : sendResult ? (
                    sendResult.ok ? "送信と相談記録への登録が完了しました。" : "送信に失敗しました。"
                  ) : (
                    "PDFを相談記録としてEHC・PNへ送信しますか？"
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
              {!sending && !sendResult && (
                <button
                  onClick={handleAutoSend}
                  className="w-full px-3 py-2 rounded-md text-[12px] font-semibold text-white bg-gradient-to-r from-ehc-700 to-ehc-600 hover:from-ehc-800 hover:to-ehc-700"
                >
                  相談記録として送信する
                </button>
              )}
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
        className="report-sheet screen-report relative overflow-hidden border-2 border-slate-200 rounded-xl p-6 bg-white select-none"
      >
        {/* 透かし（画面＋全印刷ページ）: コピー・スクショ・無断転載の抑止 */}
        <div className="watermark-layer" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i}>EHC SOLUTIONS ｜ 社外秘 ｜ 無断複製・転載禁止 ｜ {proposalNo}</div>
          ))}
        </div>
        <div className="text-center border-b-2 border-ehc-700 pb-4 mb-5">
          <div className="text-xs text-slate-500 mb-1">業務用空調 補助金・省エネ診断書</div>
          <h1 className="text-2xl font-bold text-ehc-900 mb-2">
            {input.customerCompany || "お客様"} {input.customerKind === "individual" ? "様" : "御中"}
          </h1>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {today}
            </span>
            {input.customerContact && <span>ご担当: {input.customerContact} 様</span>}
            <span className="text-slate-400">診断書番号: {proposalNo}</span>
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
              {/* F01: 未入力（空欄→0）を「0 万円」と書かない */}
              <CondCell
                label="今回更新分の設備投資概算"
                value={reportInvestState === "known" ? `${input.invest.toLocaleString("ja-JP")} 万円` : INVEST_UNKNOWN_LABEL}
              />
              {interestLabel && <CondCell label="ご関心" value={interestLabel} />}
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

        <div className="mb-5">
          <ProgramMatchBoard input={input} result={result} printable />
        </div>

        <DiagnosisSummary
          input={input}
          result={result}
          appliedSubsidyManYen={displaySubsidyManYen}
          appliedSubsidy={appliedSubsidy}
          subsidyState={reportSubsidyState}
          printable
        />

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            2. ご提案サマリー
          </h2>
          {/* 2026-08-27 監査での修正:
                ここには「（出典: 資源エネルギー庁／業界資料／EHC施工実績）」と書かれていた。
                客先に出す書面で、辿れない出典を出典として書いてはいけない。
                読んだ人は確認済みの数字だと受け取るからである（大塚倉庫の「6658」と同じ経路）。
                削減率の係数は現時点で一次資料を特定できていないので、暫定値と明記する。 */}
          <p className="text-[11px] text-slate-600 mb-2">
            {industryLabel}は冷媒設備が電力の多くを占め、設置年・冷媒世代に応じた経年劣化も加味すると、
            高効率化＋経年回復で<strong className="text-ehc-700">全体の実効削減率 {(result.effectiveReductionRate * 100).toFixed(0)}%</strong>
            で試算しています。
          </p>
          {!result.coefficientAudit.allSourced && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mb-2">
              <strong>削減率は暫定値です。</strong>{PROVISIONAL_COEFFICIENT_NOTE}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* F02: 未確認を¥0と書かない。0円と未算定は違う情報 */}
            <SummaryCell
              label="想定補助金額"
              value={reportSubsidyState === "unconfirmed" ? "未確認" : `¥${displaySubsidyYen.toLocaleString("ja-JP")}`}
              color="green"
            />
            {/* 2026-08-24 監査での修正: 「損益分岐(回収)」とだけ書かれており、
                補助金を引く前か後か、税抜か税込かが読み手に分からなかった。
                実装は「税抜の工事費 ÷ 年間電気代削減額」＝補助金を引く前の値なので、
                そのとおりにラベルへ明記する（数式は変えない）。 */}
            <SummaryCell label="回収年数(補助金適用前・税抜)" value={yearsOrUnknown(result.yearsToRecover)} color="amber" />
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
              subsidyState={reportSubsidyState}
              saveYenPerYear={result.saveYenPerYear}
              kwhPerYear={result.totalKwh || input.kwh}
              reductionRate={result.effectiveReductionRate}
            />
          </div>
          {/* 2026-09-10 EHC-0031 F02:
              凡例を手書きしていたため、緑線を描かない状態でも
              「緑線: 更新（補助金あり）← ベスト」が客先の書面に残っていた。
              描く線と凡例を roiSeriesFor() 一箇所から出す。 */}
          <RoiChartLegend
            subsidyState={reportSubsidyState}
            className="text-[11px] text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-2 [&>div]:rounded-md [&>div]:border [&>div]:border-slate-200 [&>div]:bg-slate-50 [&>div]:px-2 [&>div]:py-1.5"
          />
          <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">補助金: {SUBSIDY_STATE_NOTE[reportSubsidyState]}</p>
        </section>

        <section className="mb-5">
          <h2 className="text-sm font-bold text-ehc-800 border-l-4 border-ehc-600 pl-3 mb-3">
            4. 候補となる補助金制度
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
            <p className="text-xs text-slate-500">現時点の情報だけで適格性が確定した制度はありません。下記の確認事項が埋まり次第、改めて判定いたします。</p>
          )}

          {/* 判定不能を「該当なし」として消さない。確認すれば候補になりうる制度を必ず載せる。 */}
          {result.needsCheck.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-bold text-slate-700 mb-1.5">
                ご確認いただければ候補になりうる制度（{result.needsCheck.length}件）
              </div>
              <ul className="space-y-2">
                {result.needsCheck.map((s) => (
                  <li key={s.id} className="text-xs border border-slate-200 border-dashed rounded-lg p-3 bg-slate-50">
                    <div className="font-semibold text-slate-800 mb-1">○ {s.name}</div>
                    <div className="text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-1">
                      <span>主催: {s.org}</span>
                      <span>補助率: {s.rate}</span>
                      <span>上限: {s.max}</span>
                    </div>
                    <ul className="text-slate-600 mt-1 list-disc list-inside">
                      {(result.eligibility[s.id]?.missing ?? []).map((m) => <li key={m}>{m}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-slate-500 mt-1.5">
                対象外が確定したという意味ではありません。判定に必要な情報が未取得のため、補助額は算定していません。
              </p>
            </div>
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
              （件名に診断書番号 <strong>{proposalNo}</strong> をご記載ください）
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
              本診断書は試算値に基づくものであり、実際の補助金採択・補助額・電気代削減効果を保証するものではありません。
            </div>
          </div>
          {/* 無断利用に関する法的注意（著作権法・不正競争防止法に基づく警告） */}
          <div className="mt-3 border border-slate-300 rounded-md p-3 bg-slate-50 text-[10px] text-slate-600 leading-relaxed">
            <strong className="text-slate-800">【本診断書の取り扱いについて】</strong>
            <br />
            本診断書および記載内容（試算結果・提案プラン・施工実績データ・価格情報等）に関する著作権その他一切の権利は、株式会社EHCソリューションズに帰属し、著作権法により保護されています。
            当社の書面による事前承諾なく、本診断書の全部または一部を複製・転載・改変・撮影・第三者への開示もしくは提供（相見積り取得を目的とした他社への提示を含む）することを固く禁じます。
            これらに違反した場合、著作権法に基づく差止請求・損害賠償請求、および不正競争防止法（営業秘密の不正使用）に基づく法的措置の対象となることがあります。
            本診断書は宛先のお客様に限りご利用いただけます（診断書番号 {proposalNo} にて交付先を管理しています）。
            <br />
            © {now.getFullYear()} EHC Solutions Co., Ltd. All Rights Reserved.
          </div>
        </footer>
      </div>

      {/* 2026-09-08 EHC-0028 §6A:
          紙は画面DOMの流し込みではなく、同じ診断スナップショットを受け取る
          印刷専用の構成で出す。画面では display:none（globals.css の .print-report）。
          画面側の reportRef / html2canvas の対象（.screen-report）は一切変えない。 */}
      <div className="print-report" aria-hidden>
        <ReportPrintSheet
          input={input}
          result={result}
          assessments={assessments}
          monitorCheckedAt={monitorCheckedAt}
          proposalNo={proposalNo}
          today={today}
          issuedYear={now.getFullYear()}
          displaySubsidyManYen={displaySubsidyManYen}
          subsidyState={reportSubsidyState}
          appliedSubsidy={appliedSubsidy}
          inquiryMailtoShort={inquiryMailtoShort}
        />
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
