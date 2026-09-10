/* 準備期間と「申請の手間」の唯一の出所。
   2026-09-08 NEOレビュー差し戻し（EHC-0027 / B02）での確定事項:
     以前は準備期間の定義が3箇所に散っていた。
       - lib/subsidies.ts  … prepLeadDaysMin/Max（難易度高=35〜56日、それ以外=21〜42日）
       - lib/diagnosis.ts  … 「6〜10週間」（42〜70日）／判定閾値42日
       - components/JGrantsLive.tsx … 「標準準備期間（約5週間）」（35日）
     同じ制度でも画面ごとに違う日数が出ていたため、
     **subsidies.ts の制度別 prepLeadDaysMin/Max だけを正**とし、
     週表記と固定文言（「約5週間」等）は全画面から撤去する。
   ラベルも同時に整理した。lib/types.ts の difficulty は「申請の難易度（高＝大変）」だが、
   画面には「申請の進めやすさ：高」と出ており意味が反転していた。
   高／中／低ではなく「多い／標準／少なめ」に写し替え、採択の難易度とは区別する。 */

import { Subsidy } from "./types";

export type PrepLead = { min: number; max: number };

/** 制度別の準備日数。データが無ければ null（＝判定しない）。 */
export function prepLeadDays(s: Subsidy): PrepLead | null {
  const { prepLeadDaysMin: min, prepLeadDaysMax: max } = s;
  if (typeof min !== "number" || typeof max !== "number") return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return null;
  return { min, max };
}

/** 「準備30〜45日」のような日数表記。週表記は使わない。 */
export function prepLeadLabel(s: Subsidy): string | null {
  const lead = prepLeadDays(s);
  return lead ? `準備${lead.min}〜${lead.max}日` : null;
}

/** 申請にかかる手間・書類量。difficulty（難易度）をそのまま出さない。 */
export function effortLabel(s: Subsidy): "多い" | "標準" | "少なめ" | "要確認" {
  if (s.difficulty === "高") return "多い";
  if (s.difficulty === "中") return "標準";
  if (s.difficulty === "低") return "少なめ";
  return "要確認";
}

export type PrepVerdict = "enough" | "tight" | "short" | "unknown";

export type PrepJudgement = {
  verdict: PrepVerdict;
  /** 締切までの残日数（切上げ）。締切が無ければ null。 */
  daysLeft: number | null;
  lead: PrepLead | null;
  /** そのまま画面に出せる一文。 */
  text: string;
};

/* 判定の区切りは4通りだけ（2026-09-08 確定）。
     残日数 >= 最大日数           → 準備が間に合う可能性
     最小日数 <= 残日数 < 最大日数 → 早急な個別確認が必要
     残日数 < 最小日数            → 日程が厳しいため個別確認が必要
     期限または準備日数が不明      → 判定できません
   いずれも運用上の目安であり、公式期限や申請可能性を保証しない。 */
export function judgePrep(s: Subsidy, now: Date): PrepJudgement {
  const lead = prepLeadDays(s);
  const daysLeft = s.applyClose
    ? Math.ceil((new Date(`${s.applyClose}T23:59:59+09:00`).getTime() - now.getTime()) / 86400000)
    : null;

  if (daysLeft === null || lead === null) {
    return {
      verdict: "unknown",
      daysLeft,
      lead,
      text: "受付期限または準備日数が確認できないため、間に合うかは判定できません（公式要領での確認が必要です）。",
    };
  }

  const remain = Math.max(0, daysLeft);
  const head = `残り約${remain}日、準備${lead.min}〜${lead.max}日の目安に対し、`;
  if (remain >= lead.max) {
    return { verdict: "enough", daysLeft, lead, text: `${head}準備が間に合う可能性があります。` };
  }
  if (remain >= lead.min) {
    return { verdict: "tight", daysLeft, lead, text: `${head}早急な個別確認が必要です。` };
  }
  return { verdict: "short", daysLeft, lead, text: `${head}日程が厳しいため個別確認が必要です。` };
}

/** 全画面共通で添える留保。判定を出すところには必ず並べる。 */
export const PREP_DISCLAIMER =
  "準備日数は運用上の目安です。公式の受付期限や申請できることを保証するものではありません。";
