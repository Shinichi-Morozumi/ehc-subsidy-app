/* ───────────────────────────────────────────────────────────
   対象製品の確認記録を入れる画面（EHC担当者用）
   EHC-0039 v2 §2 / 2026-09-16 v1

   ここはお客様向けの画面ではない。公募要領・対象製品一覧を実際に見た
   担当者が、見た結果を残すための画面。制度・年度・枠・設備群は
   アプリ側の定義からそのまま渡すので、手入力でずれない。
   ─────────────────────────────────────────────────────────── */

import { getSubsidies } from "@/lib/subsidies";
import { fiscalYearOf, targetProductKeyOf } from "@/lib/targetProduct";
import { todayJst } from "@/lib/programClock";
import TargetProductAdmin from "./TargetProductAdmin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "対象製品の確認記録（EHC担当者用）",
  robots: { index: false, follow: false },
};

export default function Page() {
  const today = todayJst();
  const options = getSubsidies().map((s) => {
    /* 2026-09-16 台帳#32。年度と枠は制度ごとに決まる。
       照合の側（app/api/target-product・app/api/diagnosis-submit）と
       同じ targetProductKeyOf を使う。ここだけ「今日の年度」で記録すると、
       担当者が入れた記録が照合でキー不一致になって効かない。 */
    const key = targetProductKeyOf(s, today);
    return {
      id: s.id,
      name: s.name,
      /** 宣言されている申請枠。2件以上なら担当者がどの枠で見たかを選ぶ */
      frames: key.frames,
      /** この制度の照合年度（制度が宣言していればその年度） */
      fiscalYear: key.fiscalYear,
      /* この制度が対象とする設備群。ここに無い群を選ばせない
         （room を ac として記録させないため）。 */
      kinds: [...s.target] as string[],
    };
  });

  return (
    <TargetProductAdmin
      options={options}
      today={today}
      todayFiscalYear={fiscalYearOf(today)}
    />
  );
}
