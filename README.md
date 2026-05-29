# EHC 補助金マッチング & ROI 即答ツール

業務用空調（パッケージ・マルチ）／ドロップイン更新工事 専用の補助金マッチング & ROI シミュレーター。
株式会社EHCソリューションズ 公式ツール。

**スタック:** Next.js 14 (App Router) + TypeScript + Tailwind CSS / デプロイ: Vercel

## 機能

1. **補助金マッチング** — 顧客条件から適用可能補助金を即判定 + ROI/回収期間試算
2. **補助金DB** — 2026年度 業務用空調向け補助金一覧 (SII / 神奈川 / 大阪)
3. **メーカー機器** — ダイキン / 三菱 / パナソニック / 日立 / 東芝の R32 業務用ラインナップ
4. **営業武器** — 2027年フロン法改正、R410A製造規制、キガリ改正等
5. **競合差別化** — EHCならではの強み

---

## Cursor で開いて開発する

```bash
cd "/Users/shinichi/Desktop/A8_EHC_GX炭化水素冷媒 ⛽️/ehc-subsidy-app"
cursor .
```

Cursor 起動後、ターミナルを開いて:

```bash
npm install
npm run dev
```

→ ブラウザで http://localhost:3000

---

## GitHub に新リポジトリ作成 → push

### 1. GitHub で新リポジトリ作成

- リポジトリ名: `ehc-subsidy-app`
- 公開: Public (Vercel無料枠を活用)
- README/`.gitignore`/Licenseは **追加しない**（このプロジェクト側にあるため）

### 2. ローカルから push

```bash
cd "/Users/shinichi/Desktop/A8_EHC_GX炭化水素冷媒 ⛽️/ehc-subsidy-app"
git init
git add .
git commit -m "feat: EHC補助金マッチング v1.0 初版（業務用空調・ドロップイン特化）"
git branch -M main
git remote add origin git@github.com:<YOUR_GH_USER>/ehc-subsidy-app.git
git push -u origin main
```

---

## Vercel にデプロイ

1. https://vercel.com にログイン（GitHub連携）
2. **「New Project」→ `ehc-subsidy-app` をImport**
3. Framework は自動検出 (Next.js) → そのまま **Deploy** クリック
4. 30秒程度で完了。`https://ehc-subsidy-app.vercel.app` のような URL が発行される

### 独自ドメイン設定（推奨）

Vercel ダッシュボード → Project → Settings → Domains:
- `subsidy.ehc-sol.co.jp` 等を追加
- DNS の CNAME を `cname.vercel-dns.com` に設定

---

## データ更新（補助金/メーカー追加・修正）

すべてのデータは `lib/` 配下の TypeScript ファイルです:

- `lib/subsidies.ts` — 補助金DB
- `lib/vendors.ts` — メーカー機器
- `lib/weapons.ts` — 営業武器
- `lib/diffs.ts` — 競合差別化

編集 → `git commit` → `git push` するだけで Vercel が自動再デプロイ。

---

## 今後の拡張案 (v1.x)

- [ ] 営業ログイン（NextAuth.js）→ 顧客履歴保存
- [ ] 提案書PDF自動生成（pdf-lib）
- [ ] 補助金DBを Notion or Supabase 連携で動的更新
- [ ] お問い合わせフォーム → Slack/LINE 通知（GAS Phase B 流用）
- [ ] OG画像生成（next/og）
- [ ] 機器型番カタログPDF アップロード診断
- [ ] 業種別事例集

---

## 関連

- v0 Artifact (HTML単体版): Cowork Artifacts `ehc-subsidy-matcher-mvp`
- EHC LINE Bot: `_GAS実装/ehc_line_notifier.gs` (v2.5)
- EHC Zoom自動化: `_GAS実装/ehc_zoom_extractor.gs` (Phase B)
