/* ───────────────────────────────────────────────────────────
   診断書PDFをサーバで作る（2026-09-25）

   ■ なぜ要るか
   　　これまで診断書PDFは、お客様の画面（html2canvas → jsPDF）でしか作れなかった。
   　　1) 画面でPDFを作れない端末（メモリの少ないスマートフォン等）から送ると、
   　　   サーバが「PDFを確認できない」で受付ごと止め、何度押しても相談が届かなかった。
   　　   → 画面のPDFが無い・壊れている・大きすぎるときは、ここで作ったPDFを担当者宛に付けて受け付ける。
   　　2) お客様宛の自動送付（DIAGNOSIS_MAIL_MODE=send）を再開するときに、
   　　   画面から来たPDFをそのまま EHC のメールで送ると、中身を検証できない添付を
   　　   第三者へ送る踏み台になり得る。→ お客様宛には、ここで作ったPDFだけを付ける。

   ■ 中身
   　　画面の診断書（components/ContactStage.tsx の DiagnosisSheet）と同じ章立て・同じ文言。
   　　数字はサーバが作り直したスナップショット（lib/diagnosisSnapshot.ts）だけから取る。
   　　ここで金額・日数を計算し直さない。
   　　補助金の候補と適合チェックは「お客様の画面に出た内容」（サーバで判定し直していない）。
   　　削減率の根拠（reductionBasis）はサーバでは組み立てられないので載せない（null のため）。

   ■ フォント
   　　BIZ UDPゴシック（SIL OFL 1.1・lib/fonts/OFL.txt）。jsPDF が使った字だけを埋め込む。
   　　Vercel の関数に入れるため next.config.mjs の outputFileTracingIncludes で同梱している。

   サーバ専用（fs を使う）。画面から import しないこと。
   ─────────────────────────────────────────────────────────── */

import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import type { DiagnosisSnapshot } from "./diagnosisSnapshot";
import { EQUIP_LABEL_JA, TIMING_LABEL_JA, pricedGroupsOf } from "./diagnosisSnapshot";
import { yenJP } from "./pricing";

export type ServerPdfCompany = {
  name: string;
  address: string;
  tel: string;
  hours: string;
  site?: string;
};

export type ServerPdfOptions = {
  company: ServerPdfCompany;
  /** 表紙の下に出す一言（例: 画面でPDFを作れなかったので担当者がお送りする旨）。省略可 */
  note?: string;
};

const FONT = "BIZUDPGothic";
let fontCache: { dir: string; regular: string; bold: string } | null = null;

/* フォントの置き場。EHC_PDF_FONT_DIR はテストで「フォントが無いとき」を作るためだけに使う。 */
function fontsBase64(): { regular: string; bold: string } {
  const dir = process.env.EHC_PDF_FONT_DIR || path.join(process.cwd(), "lib", "fonts");
  if (fontCache && fontCache.dir === dir) return fontCache;
  const read = (f: string) => fs.readFileSync(path.join(dir, f)).toString("base64");
  fontCache = { dir, regular: read("BIZUDPGothic-Regular.ttf"), bold: read("BIZUDPGothic-Bold.ttf") };
  return fontCache;
}

/* ───────── 版面 ───────── */
const PAGE_W = 210;
const PAGE_H = 297;
const M_L = 16;
const M_R = 16;
const M_T = 16;
const M_B = 20;
const CONTENT_W = PAGE_W - M_L - M_R;
const PT = 0.3528; // 1pt = 0.3528mm

type RGB = [number, number, number];
type Block = { text: string; bold?: boolean; color?: RGB; size?: number };
const INK: RGB = [20, 59, 45];
const SOFT: RGB = [74, 90, 65];
const BRAND: RGB = [40, 102, 68];
const RULE: RGB = [212, 221, 212];

/* 行頭に置かない字（句読点・閉じ括弧・小書きの仮名・長音）と、行末に置かない字（開き括弧） */
const NO_START = new Set(Array.from("、。，．,.・：；:;？！?!）)］]｝}〕〉》」』】ゝゞーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々〜～…%％"));
const NO_END = new Set(Array.from("（(［[｛{〔〈《「『【"));

/** 分けてはいけないひとまとまり（英数字の語・番号・メールアドレス・金額） */
function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /[A-Za-z0-9@._\-+/:#&=?¥$,%]+|./gsu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[0]);
  return out;
}

class Writer {
  readonly doc: jsPDF;
  y = M_T;
  private readonly headerNote: string;

  constructor(doc: jsPDF, headerNote: string) {
    this.doc = doc;
    this.headerNote = headerNote;
  }

  font(size: number, bold = false, color: RGB = INK): void {
    this.doc.setFont(FONT, bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  width(text: string): number {
    return this.doc.getTextWidth(text);
  }

  /** 幅に収まるように折り返す（字単位。英数字の語は分けない。行頭・行末の禁則を守る） */
  wrap(text: string, maxW: number): string[] {
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      const tokens = tokenize(para);
      let cur = "";
      for (const t of tokens) {
        if (this.width(cur + t) <= maxW) {
          cur += t;
          continue;
        }
        /* 行頭禁則: はみ出す字が句読点などなら、前の行にぶら下げる */
        if (cur && t.length === 1 && NO_START.has(t)) {
          cur += t;
          continue;
        }
        /* 1語だけで幅を超える（長いURL・メール）は字で切る */
        if (this.width(t) > maxW) {
          for (const ch of Array.from(t)) {
            if (cur && this.width(cur + ch) > maxW) {
              lines.push(cur);
              cur = "";
            }
            cur += ch;
          }
          continue;
        }
        /* 行末禁則: 開き括弧で終わる行は、その字を次の行へ送る */
        let carry = "";
        while (cur.length > 1 && NO_END.has(cur[cur.length - 1])) {
          carry = cur[cur.length - 1] + carry;
          cur = cur.slice(0, -1);
        }
        lines.push(cur);
        cur = carry;
        if (!cur && /^\s+$/.test(t)) continue; // 新しい行を空白から始めない
        cur += t;
      }
      lines.push(cur);
    }
    return lines;
  }

  /** 残りが h (mm) 無ければ改ページ */
  ensure(h: number): void {
    if (this.y + h <= PAGE_H - M_B) return;
    this.doc.addPage();
    this.y = M_T;
    this.font(8.5, false, SOFT);
    this.doc.text(this.headerNote, M_L, this.y + 3);
    this.y += 8;
  }

  /** 段落。size は pt。戻り値なし（y を進める） */
  para(
    text: string,
    opts: { size?: number; bold?: boolean; color?: RGB; indent?: number; hang?: number; gapAfter?: number; lineGap?: number } = {}
  ): void {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const hang = opts.hang ?? 0;
    const lh = size * PT * (opts.lineGap ?? 1.65);
    this.font(size, opts.bold, opts.color);
    const first = this.wrap(text, CONTENT_W - indent);
    /* 2行目以降をぶら下げる（箇条書きの「・」の後ろにそろえる） */
    const lines =
      hang > 0 && first.length > 1
        ? [first[0], ...this.wrap(first.slice(1).join(""), CONTENT_W - indent - hang)]
        : first;
    lines.forEach((ln, i) => {
      this.ensure(lh);
      this.font(size, opts.bold, opts.color);
      this.doc.text(ln, M_L + indent + (i > 0 ? hang : 0), this.y + size * PT * 0.9);
      this.y += lh;
    });
    this.y += opts.gapAfter ?? 0;
  }

  heading(text: string): void {
    this.ensure(14);
    this.y += 3;
    this.font(12, true, BRAND);
    this.doc.text(text, M_L, this.y + 12 * PT * 0.9);
    this.y += 12 * PT * 1.5;
    this.doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
    this.doc.setLineWidth(0.35);
    this.doc.line(M_L, this.y, PAGE_W - M_R, this.y);
    this.y += 2.5;
  }

  /** 2列の表の1行。left/right の幅は mm。rightAlign で右の欄を右寄せ（金額） */
  row(
    left: string,
    right: string,
    opts: { leftW?: number; bold?: boolean; rightAlign?: boolean; size?: number } = {}
  ): void {
    const b = { size: opts.size, bold: opts.bold };
    this.rowBlocks([{ text: left, ...b }], [{ text: right, ...b }], { leftW: opts.leftW, rightAlign: opts.rightAlign });
  }

  /** 2列の表の1行（欄の中で字の太さ・色・大きさを変えたいとき）。1ブロック＝1段落 */
  rowBlocks(left: Block[], right: Block[], opts: { leftW?: number; rightAlign?: boolean } = {}): void {
    const leftW = opts.leftW ?? CONTENT_W * 0.42;
    const gap = 3;
    const rightW = CONTENT_W - leftW - gap;
    type Line = { text: string; b: Block; lh: number };
    const lay = (blocks: Block[], maxW: number): Line[] =>
      blocks.flatMap((b) => {
        const size = b.size ?? 10;
        this.font(size, b.bold, b.color);
        return this.wrap(b.text, maxW).map((text) => ({ text, b, lh: size * PT * 1.55 }));
      });
    const l = lay(left, leftW);
    const r = lay(right, rightW);
    const hOf = (ls: Line[]) => ls.reduce((a, x) => a + x.lh, 0);
    const h = Math.max(hOf(l), hOf(r)) + 2.2;
    this.ensure(h);
    const top = this.y + 1.1;
    const draw = (ls: Line[], x0: number | null) => {
      let y = top;
      ls.forEach((ln) => {
        const size = ln.b.size ?? 10;
        this.font(size, ln.b.bold, ln.b.color);
        const x = x0 ?? PAGE_W - M_R - this.width(ln.text);
        this.doc.text(ln.text, x, y + size * PT * 0.9);
        y += ln.lh;
      });
    };
    draw(l, M_L);
    draw(r, opts.rightAlign ? null : M_L + leftW + gap);
    this.y += h;
    this.doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    this.doc.setLineWidth(0.2);
    this.doc.line(M_L, this.y, PAGE_W - M_R, this.y);
  }

  space(mm: number): void {
    this.y += mm;
  }
}

/** 診断書PDF（A4）を作る。戻り値は PDF のバイト列 */
export function buildServerDiagnosisPdf(s: DiagnosisSnapshot, opts: ServerPdfOptions): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const f = fontsBase64();
  doc.addFileToVFS(`${FONT}-Regular.ttf`, f.regular);
  doc.addFont(`${FONT}-Regular.ttf`, FONT, "normal");
  doc.addFileToVFS(`${FONT}-Bold.ttf`, f.bold);
  doc.addFont(`${FONT}-Bold.ttf`, FONT, "bold");
  doc.setProperties({
    title: `空調更新の診断書と概算見積（${s.receiptNo}）`,
    subject: "空調更新の診断書と概算見積",
    author: opts.company.name,
    creator: opts.company.name,
  });

  const w = new Writer(doc, `空調更新の診断書と概算見積（続き）　受付番号 ${s.receiptNo}`);
  let no = 0;
  const sec = (title: string) => w.heading(`${++no}. ${title}`);

  /* ───────── 表題 ───────── */
  w.para(`受付番号 ${s.receiptNo}　／　受付日時 ${s.issuedAtJst}`, { size: 9, color: SOFT });
  w.para("空調更新の診断書と概算見積", { size: 18, bold: true, lineGap: 1.4 });
  w.para(`${s.contact.company ? `${s.contact.company}　` : ""}${s.contact.name} 様`, { size: 11, color: SOFT, gapAfter: 1 });
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(0.7);
  doc.line(M_L, w.y, PAGE_W - M_R, w.y);
  w.space(3);
  if (opts.note) w.para(opts.note, { size: 9.5, color: SOFT, gapAfter: 1 });

  /* ───────── 1. ご入力の設備 ───────── */
  sec("ご入力の設備");
  const priced = pricedGroupsOf(s.equipGroups);
  const hpMissing = s.equipGroups.filter((g) => !priced.includes(g));
  priced.forEach((g) => w.row(`${EQUIP_LABEL_JA[g.equip]}／${g.hp}馬力／室内機${g.units}台`, `${g.installYear}年設置`));
  hpMissing.forEach((g) =>
    w.row(`${EQUIP_LABEL_JA[g.equip]}／室内機${g.units}台`, `${g.installYear}年設置　— 未算定（馬力が未入力）`)
  );
  s.unpriced.forEach((u) => w.row(u.label, `未算定（${u.reason}）`));
  if (s.equipGroups.length === 0 && s.unpriced.length === 0) w.row("（入力なし）", "—");

  /* ───────── 補助金の候補と、ご自身での確認 ───────── */
  const c = s.subsidyCheck;
  if (c && (c.programs.length > 0 || c.answers.length > 0)) {
    sec("補助金の候補と、ご自身での確認");
    c.programs.forEach((p) => {
      const right: Block[] = [
        ...(p.timing ? [{ text: `申請時期：${p.timing}` }] : []),
        ...(p.amount ? [{ text: `補助額の目安：${p.amount}` }] : []),
        ...(p.selfCheck ? [{ text: `適合チェック：${p.selfCheck}`, bold: true }] : []),
        ...(p.ehcItems.length ? [{ text: `EHC が確認すること：${p.ehcItems.join("／")}`, size: 9, color: SOFT }] : []),
      ];
      w.rowBlocks(
        [
          { text: p.name, bold: true },
          { text: `${p.group}／${p.fit}`, size: 9, color: SOFT },
        ],
        right.length ? right : [{ text: "—" }],
        { leftW: CONTENT_W * 0.36 }
      );
    });
    if (c.answers.length > 0) {
      w.space(1.5);
      w.para("適合チェックのご回答", { size: 10, bold: true });
      c.answers.forEach((a) => w.para(`・${a.question} → ${a.answer}`, { size: 10, indent: 2, hang: 3.5 }));
    }
    w.space(1);
    w.para(
      "適合チェックは、ご回答にもとづく目安です。申請できることや採択を保証するものではありません。対象製品の型番・省エネ量の計算などは、EHC が公募要領と照らして確認します。",
      { size: 9, color: SOFT }
    );
  }

  /* ───────── 概算費用 ───────── */
  sec("概算費用");
  if (s.estimate) {
    const e = s.estimate;
    const amountW = CONTENT_W - 42;
    e.lines.forEach((l) => w.row(`${l.label}　${l.detail}`, yenJP(l.amount), { leftW: amountW, rightAlign: true }));
    w.row("小計（税抜）", yenJP(e.subtotal), { leftW: amountW, rightAlign: true, bold: true });
    w.row(`消費税（${Math.round(e.taxRate * 100)}%）`, yenJP(e.tax), { leftW: amountW, rightAlign: true });
    w.row("合計（税込）", yenJP(e.total), { leftW: amountW, rightAlign: true, bold: true, size: 11 });
    w.space(1.5);
    w.para(
      `機種グレードによる幅：${yenJP(e.lowTotal)} 〜 ${yenJP(e.highTotal)}　／　系統数 ${e.systems} 系統・回収フロン ${e.kg}kg として計算（いずれも現地確認前の仮定）`,
      { size: 9, color: SOFT }
    );
    w.para(
      "補助額の算定に使うのは税抜の小計です。消費税は含みません。制度ごとに対象外の費目があるため、実際の補助対象経費はこれより小さくなることがあります。",
      { size: 9, color: SOFT }
    );
  } else {
    w.para(`未算定　${s.estimateUnavailable ?? ""}`, { size: 10 });
  }

  /* ───────── 工事の目安 ───────── */
  sec("工事の目安");
  w.para(
    s.workDays != null
      ? `実働 約${s.workDays}日（室内機${s.pricedUnits}台）。連続した日数とは限らず、総工期ではありません。日程は現地確認と機器の納期で決まります。`
      : "金額を算定した設備がないため、日数の目安を出していません。",
    { size: 10 }
  );

  /* ───────── 伺っているご希望 ───────── */
  if (s.customerBudgetYen != null || s.desiredTiming != null) {
    sec("伺っているご希望（概算には反映していません）");
    w.para(
      [
        s.customerBudgetYen != null ? `ご予算：${yenJP(s.customerBudgetYen)}` : "",
        s.desiredTiming != null ? `ご希望の時期：${TIMING_LABEL_JA[s.desiredTiming]}` : "",
      ]
        .filter(Boolean)
        .join("　"),
      { size: 10 }
    );
  }

  /* ───────── ご確認ください ───────── */
  sec("ご確認ください");
  [
    "この金額は概算です。足場・高所作業車・既存配管の更新・電源容量の増設・夜間割増は含みません。",
    "系統数と回収フロン量は仮定です。銘板の確認後に置き換わります。",
    "実働日数は目安で、総工期ではありません。",
    "補助制度によっては、交付決定より前の発注・契約・着工が対象外になります。該当するかは制度ごとに異なるため、着工前に確認します。",
  ].forEach((t) => w.para(`・${t}`, { size: 9.5, color: SOFT, indent: 1, hang: 3.3 }));

  /* ───────── この後の進め方 ───────── */
  sec("この後の進め方");
  w.para("1. 現地確認の日程をご相談させてください。系統数・冷媒の種類・搬入経路などを拝見し、仮置きの前提を置き換えます。", {
    size: 10,
    hang: 4,
  });
  w.para("2. 現地確認のあと、正式なお見積りと、補助金を使う場合の進め方（申請の時期・必要な書類）をご案内します。", {
    size: 10,
    hang: 4,
  });

  /* ───────── 発行者 ───────── */
  w.ensure(26);
  w.space(5);
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.3);
  doc.line(M_L, w.y, PAGE_W - M_R, w.y);
  w.space(2.5);
  w.para(opts.company.name, { size: 10.5, bold: true });
  w.para(opts.company.address, { size: 9.5, color: SOFT });
  w.para(`TEL ${opts.company.tel}（${opts.company.hours}）${opts.company.site ? `　${opts.company.site}` : ""}`, {
    size: 9.5,
    color: SOFT,
  });

  /* ───────── ページ番号（全ページを作ったあとで入れる） ───────── */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(SOFT[0], SOFT[1], SOFT[2]);
    const footer = `${opts.company.name}　／　受付番号 ${s.receiptNo}　／　${i} / ${pages}`;
    doc.text(footer, PAGE_W / 2 - doc.getTextWidth(footer) / 2, PAGE_H - 10);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
