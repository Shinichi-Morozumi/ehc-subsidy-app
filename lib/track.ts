/* ───────────────────────────────────────────────────────────
   利用の流れの計測（2026-09-26 改善12）

   ■ なぜ
   　　これまで分かったのは「トップが何回表示されたか」だけだった（2026-08-27〜09-26：約40人・62回）。
   　　7問を始めた人・終えた人・設備を入れた人・相談を送った人がそれぞれ何人かが分からず、
   　　どこで離れているのかを数字で確かめられなかった。

   ■ 仕組み
   　　Vercel Web Analytics の「カスタムイベント」（Pro プランで使える）。
   　　@vercel/analytics の track() と同じ呼び方（window.va("event", {...})）を、パッケージを入れずに使う
   　　（パッケージを足すと package-lock.json とずれて Vercel の npm ci が落ちたことがあるため。app/layout.tsx 参照）。
   　　window.va は layout の先頭で「計測スクリプトが読み込まれるまで貯めておく」形で用意してある。

   ■ 送らないもの
   　　お名前・メール・電話・会社名・自由記述は絶対に送らない。送るのは段の名前などの決まった値だけ。
   　　1回の記録に付ける値は2つまで（Vercel の上限の内側に収める）。
   　　計測が失敗しても画面の動きは変えない。
   ─────────────────────────────────────────────────────────── */

export type TrackValue = string | number | boolean | null;

/** 記録するイベントの名前。ここに無い名前は使わない（ダッシュボードで読み違えないため）。 */
export type TrackEvent =
  | "diagnosis_open" // 7問のダイアログを開いた
  | "diagnosis_answered" // 7問を最後まで答えた（候補を見る）
  | "stage_view" // 5段のどれかを開いた（stage）
  | "bill_entered" // 電気料金の明細を入れた（period）
  | "photo_read" // 写真から読み取った（kind, ok）
  | "resume_offer" // 途中保存の続きを案内した
  | "resume_used" // 続きから再開した
  | "resume_discarded" // 保存した続きを消した
  | "submit_ok" // 相談の送信を受け付けた（customer）
  | "submit_error" // 相談の送信で失敗した（kind）
  | "pdf_saved" // 診断書PDFを保存した
  | "notify_signup" // 公募のお知らせに登録した（ok）
  | "booking_click" // 予約ページを開いた（place）
  /* 2026-10-01 EHC-0056: 介護施設向けの事前確認（/kaigo）。紹介コード（ref）は紙のQRの番号で、個人を指さない */
  | "kaigo_open" // /kaigo を開いた（ref）
  | "kaigo_step" // 質問の何問目を出したか（step）
  | "kaigo_result" // 目安の結果を出した（ref）
  | "kaigo_submit" // 相談を送った（ok, ref）
  | "kaigo_call" // 電話のリンクを押した（place）
  /* 2026-10-14 PJ-20261013-EHC-0070: 紹介代理店の専用リンク（?ref=）。訪問と相談の送信を数える（成約・紹介料は数えない） */
  | "ref_open" // 表にある紹介リンクでトップを開いた（ref, material）
  | "ref_submit"; // 紹介リンク付きで相談を送った（ref, ok）

type VaFunction = (command: "event", payload: { name: string; data?: Record<string, TrackValue> }) => void;

export function track(name: TrackEvent, data?: Record<string, TrackValue>): void {
  if (typeof window === "undefined") return;
  try {
    const va = (window as unknown as { va?: VaFunction }).va;
    if (typeof va !== "function") return;
    const entries = data ? Object.entries(data).slice(0, 2) : [];
    va("event", entries.length ? { name, data: Object.fromEntries(entries) } : { name });
  } catch {
    /* 計測の失敗で画面を止めない */
  }
}
