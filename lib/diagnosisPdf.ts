/* ───────────────────────────────────────────────────────────
   診断書PDFの生成（EHC-0039 第5片 / 2026-09-14 v1）

   ■ なぜ別ファイルにするか
   　　PDFを作る手順（html2canvas → jsPDF → A4へページ送り）は、
   　　いま components/CustomerReport.tsx の中に関数として埋まっている。
   　　E段（診断書を受け取って相談）でも同じ手順が要るが、
   　　CustomerReport は提案書の巨大なUIと一体で、そこから呼ぶと
   　　E段が提案書の描画・状態・propsに引きずられる。
   　　かといって同じ処理をE段のコンポーネント内へ書き写すと、
   　　「片方だけ直してPDFの体裁が食い違う」という事故に必ずなる。
   　　そこでDOM要素を受け取るだけの関数として切り出す。

   ■ このファイルが持たないもの
   　　・何を印刷するか（文面・数値・レイアウト）は持たない。呼び出し側のDOMがすべて。
   　　・送信は持たない。base64を返すところで終わる。送るのはAPI側の責務。
   　　・番号の発行も持たない。受付番号は呼び出し側が1回だけ発行して渡す
   　　　（ここで発行すると、画面に出ている番号とPDFの番号がずれる）。

   ■ CustomerReport.tsx の buildProposalPdf との関係
   　　手順は意図的に同一にしてある（scale:2 / JPEG品質0.92 / A4縦 / 画像の縦送り）。
   　　こちらへ寄せて CustomerReport 側を書き換えることはしない。
   　　提案書は既に本番で出ている紙で、体裁が1pxでも動くと過去の版と比較できなくなる。
   　　EHC-0039 の作業範囲は新規5段であって、既存の提案書PDFではない。
   ─────────────────────────────────────────────────────────── */

import { documentFileName } from "@/lib/docNumber";

export interface DiagnosisPdfResult {
  /** data URI 形式（data:application/pdf;...;base64,XXXX）。APIはカンマ以降を取る実装。 */
  base64: string;
  filename: string;
  /** A4で何ページになったか。画面に「◯ページのPDF」と出すために返す。 */
  pages: number;
  /** base64の文字数。APIの上限（約14,000,000文字）に触れていないか呼び出し側で見るため。 */
  base64Length: number;
}

/** APIの受け入れ上限と同じ値。ここで先に弾いて、通信してから413で落ちるのを避ける。 */
export const MAX_PDF_BASE64_CHARS = 14_000_000;

/**
 * 渡されたDOM要素を、そのままA4縦のPDFにする。
 *
 * 注意:
 *  - `el` は **画面上で幅を持っていること**。display:none の要素は
 *    html2canvas が幅0で描画し、真っ白のPDFが1ページだけできる。
 *    隠したい場合は `position:absolute; left:-10000px` のように
 *    「画面外に置く」方法を使う（E段の隠しシートはこの方式）。
 *  - html2canvas / jspdf は動的importにしてある。
 *    最初の表示でこの2つを読み込むと初期バンドルが数百KB増えるが、
 *    PDFを作るのは送信ボタンを押した人だけなので、その時に読めばよい。
 */
export async function buildDiagnosisPdf(
  el: HTMLElement,
  receiptNo: string
): Promise<DiagnosisPdfResult> {
  if (!el) throw new Error("PDFにする内容が見つかりませんでした。");
  if (!el.scrollWidth || !el.scrollHeight) {
    /* 幅も高さも0 = 画面に出ていない。ここで止めないと
       「送信は成功したが中身が白紙のPDFが届く」という、
       一番気づかれにくい失敗になる。 */
    throw new Error("PDFにする内容が画面に描画されていません。");
  }

  const [{ default: html2canvas }, jsPDFmod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const JsPDF =
    (jsPDFmod as { jsPDF?: typeof import("jspdf").jsPDF }).jsPDF ??
    (jsPDFmod as unknown as { default: typeof import("jspdf").jsPDF }).default;

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: el.scrollWidth,
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let heightLeft = imgH;
  let position = 0;
  let pages = 1;
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    pages += 1;
    /* 保険。レイアウトが壊れて imgH が異常値になったとき、
       ここが無いと addPage が止まらずブラウザごと固まる。 */
    if (pages > 60) break;
  }

  const base64 = pdf.output("datauristring");
  return {
    base64,
    filename: documentFileName(receiptNo),
    pages,
    base64Length: base64.length,
  };
}
