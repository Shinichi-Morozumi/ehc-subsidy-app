/* ───────────────────────────────────────────────────────────
   本番の自動点検（2026-09-26 改善14）

   スマホ（390px）とパソコン（1440px）で、実際の画面を「トップ → 7問 → 設備 → 結果 → 概算 → 相談の手前」まで
   通して、止まり・崩れ・画面のエラーが無いかを確かめる。相談の送信はしない（メールも Notion も動かない）。
   あわせて、会社概要・旧URLの転送・robots.txt・sitemap.xml・日本語の404 を確かめる。

   使い方:
     SMOKE_BASE_URL=https://ehcjpn.com node tests/e2e/smoke.cjs
     （playwright が要る。package.json には入れていない。GitHub Actions では一時フォルダに入れて使う）
   結果: 1つでも失敗すれば終了コード 1。画面写真は tests/e2e/artifacts/ に残す。
   ─────────────────────────────────────────────────────────── */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = (process.env.SMOKE_BASE_URL || "https://ehcjpn.com").replace(/\/$/, "");
const OUT = path.join(__dirname, "artifacts");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "smartphone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
];

/* 本番では出ない（または実害のない）ものは数えない */
const IGNORE = [/_vercel\/insights/, /favicon/, /Failed to load resource.*404/];

const results = [];
const ok = (name) => { results.push({ name, ok: true }); console.log(`  ○ ${name}`); };
const ng = (name, detail) => { results.push({ name, ok: false, detail }); console.log(`  × ${name}: ${detail}`); };

async function step(name, fn) {
  try {
    await fn();
    ok(name);
    return true;
  } catch (e) {
    ng(name, e instanceof Error ? e.message.split("\n")[0] : String(e));
    return false;
  }
}

async function flow(browser, vp) {
  console.log(`■ ${vp.name}（${vp.viewport.width}px）`);
  const { name: _name, ...options } = vp;
  const ctx = await browser.newContext({ ...options, locale: "ja-JP" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`console: ${t}`);
  });
  const shot = (label) => page.screenshot({ path: path.join(OUT, `${vp.name}_${label}.png`), fullPage: false }).catch(() => {});
  const dialog = page.locator("[role=dialog]");

  const go = await step("トップが開く（題名・見出し）", async () => {
    const res = await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!res || res.status() !== 200) throw new Error(`HTTP ${res ? res.status() : "なし"}`);
    /* 2026-10-29 EHC-0102: トップを締切ボード＋3つの入口（HomeV18）に替えた */
    await page.getByRole("heading", { name: /締切の近い順に/ }).first().waitFor({ timeout: 20000 });
    await page.getByRole("heading", { name: "いま近い締切" }).first().waitFor({ timeout: 20000 });
    const title = await page.title();
    if (!title.includes("EHCソリューションズ")) throw new Error(`題名に会社名が無い: ${title}`);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
    if (robots && /noindex/.test(robots)) throw new Error(`検索に出ない設定のまま: ${robots}`);
    await shot("01_top");
  });
  if (!go) { await ctx.close(); return errors; }

  await step("7問に答えられる", async () => {
    /* 2026-10-29 EHC-0102: 7問はトップの「国の省エネ（SII）」の入口から開く */
    await page.getByRole("button", { name: /設備から詳しく計算する/ }).first().click();
    await dialog.waitFor({ timeout: 10000 });
    const restart = dialog.getByRole("button", { name: /最初から答え直す/ });
    if (await restart.count()) await restart.click();
    for (const pick of ["更新する予定がある", "6か月以内"]) {
      await dialog.locator("button", { hasText: pick }).first().click();
      await page.waitForTimeout(700);
    }
    await dialog.locator("select").first().selectOption({ label: "東京都" });
    await dialog.locator("button", { hasText: "次へ" }).first().click();
    await page.waitForTimeout(700);
    for (const pick of ["法人・団体", "中小企業", "オフィス"]) {
      await dialog.locator("button", { hasText: pick }).first().click();
      await page.waitForTimeout(700);
    }
    await dialog.locator("input").first().fill("500");
    await dialog.locator("button", { hasText: "制度候補を見る" }).first().click();
    await page.getByRole("heading", { name: "候補を見る" }).waitFor({ timeout: 15000 });
    await shot("02_find");
  });

  await step("設備を入れて結果が出る", async () => {
    await page.getByText("設備を入力へ進む").first().click();
    const kind = page.locator("label:has(input[type=radio][value=ac])").first();
    await kind.scrollIntoViewIfNeeded();
    await kind.click();
    await page.getByPlaceholder("例: 6").first().fill("3");
    await page.getByPlaceholder("例: 2011").first().fill("2012");
    await page.getByPlaceholder("例: 3").first().fill("5");
    await page.getByText("結果と根拠へ進む").first().click();
    await page.locator(".ehc-result-summary").first().waitFor({ timeout: 15000 });
    await page.getByText("次の公募が始まったら、お知らせします").first().waitFor({ timeout: 5000 });
    await shot("03_result");
  });

  await step("概算と相談の画面まで進める（送信はしない）", async () => {
    await page.getByText("概算費用と工事へ進む").first().click();
    await page.waitForTimeout(1200);
    const next = page.getByRole("button", { name: /診断書を受け取って相談/ });
    await (await next.count() ? next.last() : page.locator("button", { hasText: "診断書" }).last()).click();
    await page.locator("#contact-name").waitFor({ timeout: 10000 });
    await page.getByText("送信前にご確認ください").first().waitFor({ timeout: 5000 });
    await shot("04_contact");
  });

  await step("画面のエラーが出ていない", async () => {
    if (errors.length) throw new Error(errors.slice(0, 3).join(" ／ "));
  });

  await ctx.close();
  return errors;
}

async function pages(browser) {
  console.log("■ ページとURL");
  const ctx = await browser.newContext({ locale: "ja-JP" });
  const page = await ctx.newPage();
  await step("東京都の制度と6問の診断が開く（/tokyo・/shindan）", async () => {
    const t = await page.goto(`${BASE}/tokyo`, { waitUntil: "domcontentloaded" });
    if (!t || t.status() !== 200) throw new Error(`/tokyo HTTP ${t ? t.status() : "なし"}`);
    await page.getByRole("heading", { name: "制度カード（締切の近い順）" }).waitFor({ timeout: 10000 });
    const s = await page.goto(`${BASE}/shindan`, { waitUntil: "domcontentloaded" });
    if (!s || s.status() !== 200) throw new Error(`/shindan HTTP ${s ? s.status() : "なし"}`);
    await page.getByRole("heading", { name: "施設・事業所の所在地は？" }).waitFor({ timeout: 10000 });
    await shot("06_shindan");
  });

  await step("会社概要が開く", async () => {
    const res = await page.goto(`${BASE}/company`, { waitUntil: "domcontentloaded" });
    if (!res || res.status() !== 200) throw new Error(`HTTP ${res ? res.status() : "なし"}`);
    await page.getByRole("heading", { name: "会社概要" }).waitFor({ timeout: 10000 });
  });
  await step("旧URL（/privacy-policy）がプライバシーポリシーへ転送される", async () => {
    await page.goto(`${BASE}/privacy-policy`, { waitUntil: "domcontentloaded" });
    if (!page.url().endsWith("/privacy")) throw new Error(`転送先: ${page.url()}`);
  });
  await step("見つからないページが日本語の案内になる", async () => {
    const res = await page.goto(`${BASE}/no-such-page-smoke-check`, { waitUntil: "domcontentloaded" });
    if (!res || res.status() !== 404) throw new Error(`HTTP ${res ? res.status() : "なし"}（404 のはず）`);
    await page.getByText("お探しのページは見つかりませんでした").first().waitFor({ timeout: 10000 });
  });
  const text = async (url) => {
    const r = await ctx.request.get(url);
    if (r.status() !== 200) throw new Error(`HTTP ${r.status()}`);
    return r.text();
  };
  await step("robots.txt にサイトの地図の場所がある", async () => {
    const t = await text(`${BASE}/robots.txt`);
    if (!/Sitemap:\s*https:\/\/ehcjpn\.com\/sitemap\.xml/i.test(t)) throw new Error(t.slice(0, 200));
  });
  await step("sitemap.xml に会社概要がある", async () => {
    const t = await text(`${BASE}/sitemap.xml`);
    if (!t.includes("https://ehcjpn.com/company")) throw new Error(t.slice(0, 200));
  });
  await ctx.close();
}

(async () => {
  console.log(`点検するURL: ${BASE}`);
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) await flow(browser, vp);
    await pages(browser);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
  console.log(`\n結果: ${results.length - failed.length}/${results.length} 件 合格`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
