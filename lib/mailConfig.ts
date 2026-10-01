/* ───────────────────────────────────────────────────────────
   診断まわりのメールの送信設定（2026-09-26）

   app/api/diagnosis-submit と同じ環境変数を、新しく足した送信口（公募のお知らせ登録・未着手の通知）でも使う。
   値の決め方は diagnosis-submit と同じにしてある（あちらを変えたら、ここも合わせる）。
   　送信アカウント … DIAGNOSIS_SMTP_USER＋DIAGNOSIS_SMTP_PASS が両方あればそれ、無ければ SMTP_USER＋SMTP_PASS
   　差出人         … DIAGNOSIS_FROM_EMAIL → PROPOSAL_FROM_EMAIL → 「EHCソリューションズ <送信アカウント>」
   　社内の宛先     … DIAGNOSIS_STAFF_TO_EMAIL → PROPOSAL_TO_EMAIL → info@ehcjpn.com
   　社内のCC       … DIAGNOSIS_STAFF_CC_EMAIL → PROPOSAL_CC_EMAIL → info@project-neo.co.jp
   　送るかどうか   … DIAGNOSIS_MAIL_MODE（"staff"＝社内宛だけ、"send"＝お客様宛も。それ以外は送らない）
   ─────────────────────────────────────────────────────────── */

export interface MailConfig {
  user: string | null;
  pass: string | null;
  host: string;
  port: number;
  secure: boolean;
  from: string;
  staffTo: string[];
  staffCc: string[];
  /** 社内宛を実際に送る設定か */
  liveStaff: boolean;
  /** お客様宛も実際に送る設定か */
  liveCustomer: boolean;
}

const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

export function mailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const own = !!(env.DIAGNOSIS_SMTP_USER && env.DIAGNOSIS_SMTP_PASS);
  const user = (own ? env.DIAGNOSIS_SMTP_USER : env.SMTP_USER) || null;
  const pass = (own ? env.DIAGNOSIS_SMTP_PASS : env.SMTP_PASS) || null;
  const port = Number(env.SMTP_PORT || "465");
  const mode = (env.DIAGNOSIS_MAIL_MODE || "").toLowerCase();
  return {
    user,
    pass,
    host: env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    from: env.DIAGNOSIS_FROM_EMAIL || env.PROPOSAL_FROM_EMAIL || (user ? `EHCソリューションズ <${user}>` : ""),
    staffTo: list(env.DIAGNOSIS_STAFF_TO_EMAIL || env.PROPOSAL_TO_EMAIL || "info@ehcjpn.com"),
    staffCc: list(env.DIAGNOSIS_STAFF_CC_EMAIL || env.PROPOSAL_CC_EMAIL || "info@project-neo.co.jp"),
    liveStaff: mode === "staff" || mode === "send",
    liveCustomer: mode === "send",
  };
}
