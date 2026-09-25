import { COMPANY } from "@/lib/company";

/* 2026-09-25 UXレビュー No.22: 運営会社の所在地・電話・メールを、ホームと診断画面の両方に出す。
   値は lib/company.ts の1か所だけに置く（画面ごとに書き写さない）。
   外側の <footer> は置き場所ごとに違うので、ここでは中身だけを返す。
   診断画面から開くプライバシーポリシーは新しいタブで開く（診断の入力を消さないため）。 */
export function SiteFooter({ variant }: { variant: "home" | "workspace" }) {
  const year = 2026;
  const newTab = variant === "workspace";
  return (
    <div className={variant === "home" ? "site-footer-inner" : "ehc-site-footer"}>
      <p className="ehc-site-footer-lead">運営会社</p>
      <address className="ehc-site-footer-address">
        <strong>{COMPANY.name}</strong>
        <span>{COMPANY.address}</span>
        <span>
          電話 <a href={COMPANY.telHref}>{COMPANY.tel}</a>（受付 {COMPANY.hours}）
        </span>
        <span>
          メール <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </span>
        <span>
          <a href="/privacy" {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            プライバシーポリシー
            {newTab && <span className="sr-only">（新しいタブで開きます）</span>}
          </a>
        </span>
      </address>
      <p className="ehc-site-footer-copy">© {year} {COMPANY.name}</p>
    </div>
  );
}
