import Link from "next/link";
import { COMPANY } from "@/lib/company";

/* ───────────────────────────────────────────────────────────
   ページが見つからないとき（2026-09-26 改善2）

   以前は Next.js 既定の英語の画面（404: This page could not be found.）だった。
   ehcjpn.com は以前 Wix のホームページだったので、検索結果やブックマークに古いURLが残っている。
   英語の行き止まりにせず、トップ（診断）・会社概要・連絡先へ案内する。
   検索エンジンには Next.js が自動で noindex を付ける。
   ─────────────────────────────────────────────────────────── */

const linkClass =
  "flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-ink-line bg-paper-card px-4 py-3 text-[16px] font-bold leading-[1.6] text-ink hover:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep";

export default function NotFound() {
  return (
    <main id="notfound-main" className="mx-auto max-w-3xl px-5 pb-20 pt-10 text-ink sm:px-8">
      <p className="text-[14px] font-bold text-brand-deep">ページが見つかりません（404）</p>
      <h1 className="mt-2 text-[28px] font-bold leading-[1.5]">お探しのページは見つかりませんでした</h1>
      <p className="mt-3 text-[16px] leading-[1.9]">
        ページの場所が変わったか、URLが間違っている可能性があります。
        以前のホームページでご覧になっていた内容は、下のページにまとめています。
      </p>
      <ul className="mt-6 space-y-3">
        <li>
          <Link href="/" className={linkClass}>
            <span>
              トップ：空調更新と補助金の無料診断
              <span className="mt-0.5 block text-[14px] font-normal text-ink-soft">7問で、使える可能性のある制度と期限がわかります</span>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
        <li>
          <Link href="/company" className={linkClass}>
            <span>会社概要</span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
        <li>
          <Link href="/privacy" className={linkClass}>
            <span>プライバシーポリシー</span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      </ul>
      <p className="mt-8 text-[16px] leading-[1.9]">
        お問い合わせは、お電話（<a className="font-bold text-brand-deep underline underline-offset-4" href={COMPANY.telHref}>{COMPANY.tel}</a>・受付 {COMPANY.hours}）
        またはメール（<a className="font-bold text-brand-deep underline underline-offset-4" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>）でどうぞ。
      </p>
    </main>
  );
}
