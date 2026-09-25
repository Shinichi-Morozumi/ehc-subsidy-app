import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

/* ───────────────────────────────────────────────────────────
   プライバシーポリシー（2026-09-25 制定）
   このサイト（空調更新と補助金の候補診断）で実際に行っている取扱いに合わせて書いている。
     ・入力を受け取る場所：診断の第5段階（お名前・メール・会社名・電話・相談内容）
       ／担当者が使う提案書の画面（ご担当者名・ご住所など）
     ・届け先：EHC の担当者宛メール（施工連携先の株式会社プロジェクトネオを CC）
     ・外部サービス：Vercel（サイト・米国）、Google（メール送信）、Notion（顧客管理・米国）、
       Vercel Web Analytics（閲覧状況の集計）
   取扱いを変えたとき（送り先・外部サービス・取得項目）は、このページも必ず直すこと。
   ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "プライバシーポリシー｜株式会社EHCソリューションズ",
  robots: { index: false, follow: false },
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-brand pl-3 text-[20px] font-bold leading-[1.6] text-ink">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[16px] leading-[1.9] text-ink">{children}</p>
);

export default function PrivacyPage() {
  return (
    <main id="privacy-main" className="mx-auto max-w-3xl px-5 pb-20 pt-8 text-ink sm:px-8">
      <p>
        <Link href="/" className="inline-flex min-h-[44px] items-center text-[16px] font-bold text-brand-deep underline underline-offset-4">
          ← EHC のトップへ
        </Link>
      </p>
      <h1 className="mt-4 text-[28px] font-bold leading-[1.5]">プライバシーポリシー</h1>
      <p className="mt-2 text-[14px] text-ink-soft">制定日：2026年9月25日</p>

      <P>
        {COMPANY.name}（以下「当社」）は、空調更新と補助金の候補診断（以下「本サービス」）をはじめとする事業でお預かりする個人情報を、
        個人情報の保護に関する法律その他の関係法令とガイドラインに従い、次のとおり取り扱います。
      </P>

      <H2>1. お預かりする情報</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[16px] leading-[1.9]">
        <li>ご相談の送信時に入力いただく情報：お名前、メールアドレス、会社名（任意）、電話番号（任意）</li>
        <li>
          診断のためにお答えいただく情報：更新の予定と時期、所在地（都道府県）、事業者区分・事業規模、建物の用途、空調設備の種類・台数・設置年・馬力・メーカー・型番、
          ご予算、適合チェックのご回答（契約・発注の状況、資本金と従業員数を書類で示せるか など）
        </li>
        <li>担当者がご提案書を作るときに伺う情報：ご担当者名、ご住所など</li>
        <li>閲覧の状況：ページの表示回数などの集計（下の「7. アクセス解析」をご覧ください）</li>
      </ul>

      <H2>2. 利用する目的</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[16px] leading-[1.9]">
        <li>診断書（PDF）の作成と、ご相談・お問い合わせへの回答</li>
        <li>現地確認・お見積り・工事・補助金の申請のご支援など、ご依頼いただいたサービスの提供</li>
        <li>お電話・メールでのご連絡</li>
        <li>お客様対応と診断の履歴の管理</li>
        <li>本サービスの改善（個人を特定しない集計として利用します）</li>
      </ul>

      <H2>3. 第三者への提供</H2>
      <P>
        法令に基づく場合などを除き、ご本人の同意なく第三者に提供しません。
        ただし、本サービスから送信いただいたご相談の内容（お名前・連絡先・診断の内容）は、送信前の同意欄でご同意いただいたうえで、
        施工を担う連携先の株式会社プロジェクトネオ（神奈川県川崎市）と共有し、現地確認や工事のご案内に使います。
      </P>

      <H2>4. 取扱いの委託</H2>
      <P>
        利用する目的の範囲で、個人情報の取扱いの一部を外部の事業者に委託することがあります（ウェブサイトの開発・運用、メールの送信、顧客管理など）。
        委託先は適切に選び、必要な監督を行います。
      </P>

      <H2>5. 安全管理のための措置</H2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[16px] leading-[1.9]">
        <li>取扱いの責任者を定め、取り扱う人と範囲を限っています。</li>
        <li>従業者に、個人情報の取扱いについて必要な教育を行います。</li>
        <li>書類と機器を適切に管理し、通信は暗号化（HTTPS）しています。</li>
        <li>
          外部の環境の把握：本サービスは、米国の事業者が提供するサービス（ウェブサイトの配信、メール、顧客管理）を利用しています。
          米国の個人情報の保護に関する制度を把握したうえで、上の措置を講じています。
        </li>
      </ul>

      <H2>6. 保存する期間</H2>
      <P>利用する目的に必要な期間保存し、不要になった情報は適切な方法で消去します。</P>

      <H2>7. アクセス解析</H2>
      <P>
        サイトの改善のため、Vercel Web Analytics で閲覧の状況（ページの表示回数など）を集計しています。
        この集計は Cookie を使わず、個人を特定する情報を集めません。
        なお、表示を速くするため、閲覧したページのデータをお使いの端末に一時的に保存することがあります。
      </P>

      <H2>8. 開示などのご請求</H2>
      <P>
        ご本人から、利用目的の通知、開示、訂正・追加・削除、利用の停止・消去、第三者への提供の停止、第三者提供の記録の開示のご請求があったときは、
        ご本人であることを確認したうえで、法令に従って対応します。下の窓口までご連絡ください。
      </P>

      <H2>9. お問い合わせ窓口</H2>
      <address className="mt-3 not-italic text-[16px] leading-[1.9]">
        {COMPANY.name}　個人情報のお問い合わせ窓口
        <br />
        {COMPANY.address}
        <br />
        電話 <a className="font-bold text-brand-deep underline underline-offset-4" href={COMPANY.telHref}>{COMPANY.tel}</a>（受付 {COMPANY.hours}）
        <br />
        メール <a className="font-bold text-brand-deep underline underline-offset-4" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        <br />
        代表者：{COMPANY.representative}
      </address>

      <H2>10. 改定</H2>
      <P>内容を改めるときは、このページでお知らせします。</P>
    </main>
  );
}
