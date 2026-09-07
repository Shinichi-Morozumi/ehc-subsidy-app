import { MatchResult } from "./match";
import { MatchInput, Subsidy } from "./types";
import { subsidyAmountManYen } from "./pricing";

export type CandidateDiagnosis = {
  subsidy: Subsidy;
  potentialManYen: number;
  outOfPocketManYen: number;
  deadline: string;
  timing: "open" | "upcoming" | "closed" | "unknown";
  preparation: string;
  inTime: string;
  ease: string;
};

/* 「聞けば対象になりうる制度」を落とさないための枠。
   result.matched（適格が確定した制度）だけを表示すると、
   こちらが情報を持っていないだけの制度が「該当なし」に見えてしまう。 */
export type PendingDiagnosis = {
  subsidy: Subsidy;
  missing: string[];
  deadline: string;
  timing: CandidateDiagnosis["timing"];
};

export type DiagnosisDetails = {
  issues: string[];
  recommendation: string;
  candidates: CandidateDiagnosis[];
  pending: PendingDiagnosis[];
  nextChecks: string[];
};

const jpDate = (iso?: string) => {
  if (!iso) return "未定";
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
};

const preparationFor = (s: Subsidy) => {
  if (s.difficulty === "高") return "6〜10週間（書類量：多い）";
  if (s.difficulty === "低") return "1〜2週間（書類量：少なめ）";
  return "3〜6週間（書類量：標準〜やや多い）";
};

const timingFor = (s: Subsidy, now: Date) => {
  const open = s.applyOpen ? new Date(`${s.applyOpen}T00:00:00+09:00`) : null;
  const close = s.applyClose ? new Date(`${s.applyClose}T23:59:59+09:00`) : null;
  if (s.closed) {
    return { timing: "closed" as const, deadline: `受付終了。${s.scheduleNote || "次回日程は未定"}` };
  }
  if (close && now > close) {
    return { timing: "closed" as const, deadline: `確認済みの回は${jpDate(s.applyClose)}で終了。${s.scheduleNote || "次回日程は未定"}` };
  }
  if (open && now < open) {
    return { timing: "upcoming" as const, deadline: `${jpDate(s.applyOpen)}〜${jpDate(s.applyClose)}（公式日程）` };
  }
  if (close) {
    return { timing: "open" as const, deadline: `${jpDate(s.applyClose)}締切（公式日付）` };
  }
  return { timing: "unknown" as const, deadline: `受付期限は未定。${s.scheduleNote || "公式発表待ち"}` };
};

const inTimeFor = (s: Subsidy, timing: CandidateDiagnosis["timing"], now: Date) => {
  if (timing === "closed") return "この回には間に合いません。次回公募を待ちながら準備する目安です。";
  if (timing === "unknown") return "日程未定のため断定できません。GビズID・見積・既設機器一覧を先に揃える目安です。";
  if (timing === "upcoming") return "今から準備開始すれば間に合う可能性があります（目安）。";
  const close = s.applyClose ? new Date(`${s.applyClose}T23:59:59+09:00`) : null;
  const days = close ? Math.ceil((close.getTime() - now.getTime()) / 86400000) : 0;
  const needed = s.difficulty === "高" ? 42 : s.difficulty === "低" ? 14 : 21;
  return days >= needed
    ? `残り約${days}日。今から準備すれば間に合う可能性があります（目安）。`
    : `残り約${days}日。標準準備期間を下回るため、至急の個別確認が必要です（目安）。`;
};

/* 2026-08-24 監査での修正:
     以前は Math.round(… * 10) / 10 で「四捨五入して0.1万円単位」にしていた。
     match.ts 側は丸めなしだったため、同じ入力でも
     「該当制度別シミュレーション」と「金額比較」で補助額が食い違っていた。
     交付申請の実務にあわせ、両者とも**千円未満切捨て**に統一する。 */
export function potentialSubsidyManYen(s: Subsidy, investManYen: number) {
  if (s.infoOnly) return 0;
  // 丸めの実装は lib/pricing.ts に一本化した（同じ式が4箇所に散っていた）
  return subsidyAmountManYen(investManYen, s.rateNum, s.capManYen);
}

export function buildDiagnosisDetails(
  input: MatchInput,
  result: MatchResult,
  now = new Date()
): DiagnosisDetails {
  const oldest = result.groups.reduce((max, g) => (g.age > max.age ? g : max), result.groups[0]);
  const issues: string[] = [];
  if (oldest?.age >= 15) issues.push(`最古の設備は設置後${oldest.age}年で、故障・効率低下リスクの確認が必要です。`);
  else if (oldest) issues.push(`最古の設備は設置後${oldest.age}年です。更新時期と保守履歴を確認してください。`);
  if (result.groups.some((g) => g.refri === "r22")) issues.push("R22機を含むため、修理用冷媒・部品の調達リスクがあります。");
  else if (result.groups.some((g) => g.refri === "r410a")) issues.push("R410A機を含むため、今後の冷媒・修理コストを含めた比較が必要です。");
  if (result.groups.some((g) => !input.equipGroups.find((x) => x.id === g.id)?.hp)) {
    issues.push("馬力が未確認の設備があり、電力使用量と投資額は一般値を含む概算です。");
  }

  const candidates = result.matched.map((subsidy) => {
    const potentialManYen = potentialSubsidyManYen(subsidy, input.invest);
    const t = timingFor(subsidy, now);
    return {
      subsidy,
      potentialManYen,
      outOfPocketManYen: Math.max(0, Math.round((input.invest - potentialManYen) * 10) / 10),
      deadline: t.deadline,
      timing: t.timing,
      preparation: preparationFor(subsidy),
      inTime: inTimeFor(subsidy, t.timing, now),
      ease: `申請の進めやすさ：${subsidy.difficulty || "要確認"}。${subsidy.difficultyNote || "必要書類と審査方法を確認してください。"}`,
    };
  });

  /* 判定不能（needs_check）の制度は「該当なし」ではない。
     不足している情報を出して、営業が次の一手を打てるようにする。 */
  const pending: PendingDiagnosis[] = (result.needsCheck || []).map((subsidy) => {
    const t = timingFor(subsidy, now);
    const e = result.eligibility?.[subsidy.id];
    return {
      subsidy,
      missing: e ? e.missing : ["適格性の判定に必要な情報が不足しています。"],
      deadline: t.deadline,
      timing: t.timing,
    };
  });

  const recommendation =
    "高効率空調への更新を基準案とし、現地調査で型番・能力・配管状態を確認して、全更新／段階更新／既存設備活用を比較します。";
  const nextChecks = Array.from(
    new Set([
      "交付決定前に発注・契約・着工していないか",
      "直近1年の電気料金明細、既設機器の型番・台数、見積書を用意できるか",
      ...candidates.map((c) => c.subsidy.nextCheck).filter((v): v is string => Boolean(v)),
      // 判定に足りない情報も「次に確認すること」に合流させる
      ...pending.flatMap((p) => p.missing),
    ])
  );

  return { issues, recommendation, candidates, pending, nextChecks };
}
