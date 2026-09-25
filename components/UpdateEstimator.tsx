"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardTitle, SectionLabel } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Receipt, Link2, Link2Off, Lock, ArrowUp } from "lucide-react";
import {
  estimateUpdateBreakdownGroups, MachineGrade, CostClass, COST_CLASS, SITE_ACCESS, PRICING_SOURCE,
  yenJP, DEFAULT_KG_PER_UNIT,
  subsidyAmountYen, resolveSubsidyCapState,
  SUBSIDY_CAP_NONE, SUBSIDY_CAP_NONE_LABEL, SUBSIDY_AMOUNT_UNKNOWN_LABEL, SUBSIDY_CAP_UNKNOWN_NOTE,
} from "@/lib/pricing";
/* 2026-09-11 EHC-0038 第2便 4-B:
   「未算定」のときに金額欄へ出す記号は lib/roiState.ts で1か所に決める。
   ここで "—" を直書きすると、次に別の画面で「N/A」「-」と書かれて増える。 */
import { AMOUNT_UNSET_MARK } from "@/lib/roiState";
import { useProject } from "./ProjectContext";
import { Subsidy } from "@/lib/types";

interface RateOption {
  key: string;
  label: string;
  rate: number;
  capManYen: number;
  subsidy: Subsidy | null;
}

// 万円の数値を「3億円」「1億2,000万円」のような読みやすい表記にする
function okuLabel(manYen: number): string {
  const oku = Math.floor(manYen / 10000);
  const man = manYen % 10000;
  if (oku <= 0) return `${man.toLocaleString("ja-JP")}万円`;
  if (man === 0) return `${oku.toLocaleString("ja-JP")}億円`;
  return `${oku.toLocaleString("ja-JP")}億${man.toLocaleString("ja-JP")}万円`;
}

/* ───────── 2026-09-11 EHC-0038 第2便 4-B ─────────
   該当制度別シミュレーションのタイル内で「未算定」を出すための表示。

   この画面の大きい2枚（想定補助額・実質負担）では、未算定を 28px の「—」＋
   小さい注記で出している。数字が入るときと同じ字面の大きさで「—」を置くことで、
   欄が空なのではなく「まだ出せない」のだと判る。

   ただしこのタイルは 4行の dl が 280px 幅に収まっている密な表で、
   ここに 28px を持ち込むと行の高さが倍以上になり、4行のうち1行だけが
   極端に背が高い不揃いな表になる。比較のために横に並べているタイルなので、
   行の位置が揃わないことは読みにくさとして直接効く。
   そこでこの場所に限り 28px の規則を緩め、記号は本文と同じ大きさのまま
   太字にし、12px の「未算定」を添える。0円と読み違えないという目的は
   「—」という記号そのものが果たしているので、大きさは目的に必須ではない。

   aria-label に語を入れてあるので、読み上げでは「—」ではなく
   「未算定」と読まれる（記号だけでは音として意味を持たない）。 */
function TileUnset() {
  return (
    <span className="inline-flex items-baseline gap-1" aria-label={SUBSIDY_AMOUNT_UNKNOWN_LABEL}>
      <span className="font-bold" aria-hidden="true">{AMOUNT_UNSET_MARK}</span>
      <span className="text-xs font-semibold text-ink-soft">{SUBSIDY_AMOUNT_UNKNOWN_LABEL}</span>
    </span>
  );
}

export function UpdateEstimator({ eligiblePrograms = [], diagnosisComplete = false }: { eligiblePrograms?: Subsidy[]; diagnosisComplete?: boolean }) {
  const { input, result, setEstimateManYen } = useProject();

  /* 表示条件：上の「案件情報」で〈即答〉を押して判定が確定してから出す。
     （それ以前は何を入れる欄なのか分からない＝役割が伝わらないため） */
  const ready = !!input && !!result;

  // 案件情報で確定した設備グループ（＝この見積の台数・馬力の唯一の入力元）
  const projectGroups = useMemo(
    () => (input?.equipGroups ?? []).filter((g) => (g.units ?? 0) > 0).map((g) => ({
      id: g.id,
      units: g.units,
      hp: g.hp ?? 0,
      equip: g.equip,
      refri: g.refri,
      installYear: g.installYear,
    })),
    [input]
  );
  const hasProjectGroups = projectGroups.length > 0;

  // 馬力が未入力のグループ（機器費が最低単価で入るため注意喚起する）
  const noHpUnits = projectGroups.filter((g) => !g.hp).reduce((a, g) => a + g.units, 0);

  // 入力ソース: 案件情報に連動 / このカードだけで手入力
  const [manual, setManual] = useState(false);
  const useProjectGroups = hasProjectGroups && !manual;

  // 手入力モード用
  const [hp, setHp] = useState(4);
  const [units, setUnits] = useState(3);

  const groups = useProjectGroups ? projectGroups.map((g) => ({ units: g.units, hp: g.hp })) : [{ units, hp }];
  const totalUnits = groups.reduce((a, g) => a + g.units, 0);
  const autoSystems = useProjectGroups ? Math.max(1, projectGroups.length) : Math.max(1, Math.ceil(totalUnits / 2));
  const [systemsOverride, setSystemsOverride] = useState<number | null>(null);
  const systems = systemsOverride ?? autoSystems;

  const [grade, setGrade] = useState<MachineGrade>("standard");
  const [costClass, setCostClass] = useState<CostClass>("standard");

  const rateOptions = useMemo<RateOption[]>(() => [
    { key: "none", label: "補助金なし", rate: 0, capManYen: 0, subsidy: null },
    ...eligiblePrograms.map((s) => ({
      key: `program:${s.id}`,
      label: `${s.verificationState === "verified" ? "" : "【公式再確認】"}${s.rate}｜${s.name}`,
      rate: s.rateNum,
      capManYen: s.capManYen,
      subsidy: s,
    })),
  ], [eligiblePrograms]);

  /* 該当診断を通過した制度だけを選択肢へ出す。初期値は必ず補助金なし。 */
  const [rateKeyOverride, setRateKeyOverride] = useState<string | null>(null);
  const [capOverride, setCapOverride] = useState<number | null>(null);
  const rateKey = rateKeyOverride ?? "none";
  const selectedRate = rateOptions.find((r) => r.key === rateKey) ?? rateOptions[0];
  const capManYen = capOverride ?? selectedRate.capManYen;
  useEffect(() => {
    if (rateOptions.some((r) => r.key === rateKey)) return;
    setRateKeyOverride(null);
    setCapOverride(null);
  }, [rateKey, rateOptions]);

  const [ancillaryManYen, setAncillaryManYen] = useState(0); // 付帯工事(万円)
  const [aerialDays, setAerialDays] = useState(0); // 高所作業車(日)
  const [floor, setFloor] = useState(1); // 設置階（足場要否の暫定判定用）

  const kg = totalUnits * DEFAULT_KG_PER_UNIT; // 撤去1台あたりの想定回収冷媒量（共通定数）
  const est = estimateUpdateBreakdownGroups(groups, {
    grade, costClass, systems, kg, aerialDays, floor, ancillary: ancillaryManYen * 10000,
  });
  /* 2026-09-10 EHC-0038 P0-7:
     ここには floorToUnit という独自の丸めと、
     「capManYen が 0 なら Infinity（＝上限なし）」という独自の読み替えがあった。
     一方 lib/pricing.ts の共通関数は同じ 0 を「上限0円」と読んでいた。
     同じ数字が同じアプリの中で正反対の意味を持っていたことになる。
     計算は lib/pricing.ts の subsidyAmountYen 1本に寄せ、
     上限なし＝SUBSIDY_CAP_NONE／未確認＝null という形で明示する。
     未確認のとき補助額は null（＝「未算定」）であって 0円ではない。 */
  const rate = selectedRate.rate;
  const capState = resolveSubsidyCapState(capManYen);
  const rawSubsidy = est.subtotal * rate; // 税抜ベースで補助（丸めは共通関数で最後に一度だけ）
  const subsidy = subsidyAmountYen(est.subtotal, rate, capManYen); // number | null
  const capped = capState === "amount" && rawSubsidy > capManYen * 10000; // 上限に頭打ちされたか
  const netOut = subsidy == null ? null : est.total - subsidy; // 実質負担(税込−補助)
  const annualSavingsYen = result?.saveYenPerYear ?? 0;
  const scenarioRows = rateOptions.map((option) => {
    const optionSubsidy = subsidyAmountYen(est.subtotal, option.rate, option.capManYen);
    const optionNet = optionSubsidy == null ? null : est.total - optionSubsidy;
    return {
      ...option,
      subsidyYen: optionSubsidy,
      netYen: optionNet,
      recoveryYears: optionNet != null && annualSavingsYen > 0 ? optionNet / annualSavingsYen : null,
    };
  });

  // 小計(税抜・万円)を上の「設備投資概算」へ返す＝双方向連動。未表示のときは何も返さない。
  const subtotalManYen = Math.round(est.subtotal / 10000);
  useEffect(() => {
    setEstimateManYen(ready ? subtotalManYen : null);
  }, [ready, subtotalManYen, setEstimateManYen]);

  /* ── 即答前：ロック表示 ────────────────────────────── */
  if (!ready) {
    return (
      <Card>
        {/* 2026-09-10 EHC-0031 UI-02: 未入力のときも同じ見出しの型にする */}
        <SectionLabel>SIMULATION 02 ── 工事費の概算</SectionLabel>
        <CardTitle icon={<Receipt className="w-5 h-5" />} iconTone="ehc">
          更新工事 見積シミュレーター（お客様提示用の明細）
        </CardTitle>
        <div className="flex items-start gap-3 rounded-xl border border-ink-line bg-paper-sub px-4 py-4">
          <Lock className="w-5 h-5 text-ink-soft shrink-0 mt-0.5" />
          <div className="text-xs text-ink leading-relaxed">
            <div className="text-sm font-semibold text-ink mb-1 flex items-center gap-1.5">
              <ArrowUp className="w-4 h-4 text-brand-deep" />
              まず上の「案件情報」を入力して〈補助金＆ROIを即答〉を押してください。
            </div>
            案件情報の<strong className="text-ink">設備グループ（馬力・台数）</strong>を引き継いで、
            <strong className="text-brand-deep">お客様に出す内訳見積</strong>をここに作ります。
            補助率・上限はガイド式の要件確認後に手動で選び、未確認時は補助金なしで表示します。
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* 2026-09-10 EHC-0031 UI-02 */}
      <SectionLabel>SIMULATION 02 ── 工事費の概算</SectionLabel>
      <CardTitle icon={<Receipt className="w-5 h-5" />} iconTone="ehc">
        更新工事 見積シミュレーター（お客様提示用の明細）
      </CardTitle>
      {/* 2026-09-10 EHC-0031 UI-02: 補足説明の面を青で塗るのをやめる。
          この画面のアクセントは緑1色、橙は未算定の合図だけに限定する。 */}
      <p className="text-xs text-ink bg-paper-sub border border-ink-line rounded-lg px-3 py-2 mb-3">
        上のロードマップ内「投資額の妥当性チェック」が<strong>レンジ（金額の桁が妥当か）</strong>の確認なのに対し、ここは<strong>明細（お客様にそのまま出せる内訳）</strong>を作る欄です。
      </p>
      <p className="text-xs text-ink-soft mb-3">
        上の<strong className="text-ink">「案件情報」が補助金判定用の総額1本</strong>なのに対し、ここは
        <strong className="text-brand-deep">お客様に出す内訳（明細）</strong>を作る欄です。
        台数・馬力は<strong className="text-ink">上の入力から自動連動</strong>します。補助率・上限は未確認の制度を反映しないため、初期値は補助金なしです。
        現場条件（高所作業車・設置階・価格帯・付帯工事）だけここで入力します（{PRICING_SOURCE}）。
        実見積は機種グレード・搬入条件・配管長で変動する<strong className="text-ink">参考値</strong>です。
      </p>

      <details className="mb-3 rounded-xl border border-ink-line bg-paper-sub px-3 py-2.5">
        <summary className="cursor-pointer text-xs font-bold text-ink">入力サポート｜系統ごとに機器・年式が違う場合</summary>
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink">
          <p>室外機の系統ごとに1行作り、同じ型式・年式・馬力の機器だけを同じ行にまとめます。機種や設置年が違う場合は行を分けてください。</p>
          <p><strong className="text-ink">確認する場所：</strong>室外機側面の銘板で「型式・製造年・冷媒・能力」を確認します。分からない項目は不明のままでも仮診断できます。</p>
          <button type="button" onClick={() => {
            const details = document.getElementById("project-info-section") as HTMLDetailsElement | null;
            if (details) {
              details.open = true;
              details.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }} className="mt-1 min-h-[48px] inline-flex items-center justify-center rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-bold text-brand-deep hover:bg-[#edf6e8]">
            系統別の設備情報を入力・修正する
          </button>
        </div>
      </details>

      {/* 連動ステータス */}
      <div className={`flex flex-wrap items-center gap-2 mb-3 rounded-xl border px-3 py-2.5 text-xs ${useProjectGroups ? "border-brand/35 bg-[#edf6e8]" : "border-ink-line bg-paper-sub"}`}>
        {useProjectGroups ? (
          <>
            <Link2 className="w-4 h-4 text-brand-deep shrink-0" />
            <span className="text-brand-deep">
              上の案件情報と連動中：
              <strong className="text-brand-deep">
                {projectGroups.map((g, index) => `系統${index + 1} ${g.equip === "multi" ? "マルチ" : "パッケージ"}・${g.installYear}年・${g.hp || "?"}馬力×${g.units}台`).join(" ／ ")}
              </strong>
              （{projectGroups.length}系統・合計 {totalUnits}台）
            </span>
            <button type="button" onClick={() => setManual(true)}
              className="ml-auto min-h-[48px] inline-flex items-center justify-center px-2 py-1 rounded-lg border border-ink-line text-ink hover:bg-paper-sub">
              このカードだけ手入力にする
            </button>
          </>
        ) : (
          <>
            <Link2Off className="w-4 h-4 text-ink-soft shrink-0" />
            <span className="text-ink">
              {hasProjectGroups ? "手入力モード（上の案件情報とは連動していません）" : "上の「案件情報」に設備グループ（台数）を入力すると、自動でここに連動します"}
            </span>
            {hasProjectGroups && (
              <button type="button" onClick={() => { setManual(false); setSystemsOverride(null); }}
                className="ml-auto min-h-[48px] inline-flex items-center justify-center px-2 py-1 rounded-lg border border-brand/40 text-brand-deep hover:bg-[#edf6e8]">
                案件情報に連動させる
              </button>
            )}
          </>
        )}
      </div>

      {useProjectGroups && noHpUnits > 0 && (
        <div className="mb-4 text-xs text-amber-900 bg-amber-50 border border-amber-500/40 rounded-xl px-3 py-2">
          馬力が未入力のグループが <strong>{noHpUnits}台</strong> あります。機器費は
          <strong> 最低単価 ¥250,000/台</strong> で計上されるため、実勢より安く出ます。
          上の設備グループで馬力を入れると正確になります（馬力の「空欄でOK」は電力按分の話で、金額には効きます）。
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        {!useProjectGroups && (
          <>
            <Field label="馬力">
              <Input type="number" value={hp} onChange={(e) => setHp(Number(e.target.value))} />
            </Field>
            <Field label="台数（セット）">
              <Input type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
            </Field>
          </>
        )}
        <Field label="冷媒系統数（入力行と連動）">
          <Input type="number" value={systems} onChange={(e) => setSystemsOverride(Number(e.target.value))} />
          {systemsOverride != null && (
            <button type="button" onClick={() => setSystemsOverride(null)} className="min-h-[48px] inline-flex items-center text-xs text-brand-deep hover:underline mt-0.5">
              自動（{autoSystems}系統）に戻す
            </button>
          )}
        </Field>
        <Field label="機種グレード">
          <Select value={grade} onChange={(e) => setGrade(e.target.value as MachineGrade)}>
            <option value="standard">標準</option>
            <option value="subsidy">高効率(補助金グレード)</option>
          </Select>
        </Field>
        <Field label="価格帯（メーカー補正）">
          <Select value={costClass} onChange={(e) => setCostClass(e.target.value as CostClass)}>
            {(Object.keys(COST_CLASS) as CostClass[]).map((k) => (
              <option key={k} value={k}>{COST_CLASS[k].label}（×{COST_CLASS[k].factor}）</option>
            ))}
          </Select>
        </Field>
        <Field label="補助率">
          <Select value={rateKey} onChange={(e) => {
            setRateKeyOverride(e.target.value === "none" ? null : e.target.value);
            setCapOverride(null);
          }}>
            {rateOptions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
          {eligiblePrograms.length === 0 ? (
            <div className="text-xs text-amber-800 mt-0.5">{diagnosisComplete ? "該当見込みの制度なし" : "上の該当条件診断後に制度を表示"}</div>
          ) : rateKeyOverride == null ? (
            <div className="text-xs text-ink-soft mt-0.5">診断済み制度から選択できます</div>
          ) : (
            <button type="button" onClick={() => setRateKeyOverride(null)} className="min-h-[48px] inline-flex items-center text-xs text-brand-deep hover:underline mt-0.5">
              補助金なしに戻す
            </button>
          )}
        </Field>
        <Field label="高所作業車(日)">
          <Input type="number" value={aerialDays} onChange={(e) => setAerialDays(Number(e.target.value))} placeholder="0" />
        </Field>
        <Field label="設置階">
          <Input type="number" value={floor} onChange={(e) => setFloor(Number(e.target.value))} placeholder="1" />
        </Field>
        <Field label="付帯工事(万円・任意)">
          <Input type="number" value={ancillaryManYen} onChange={(e) => setAncillaryManYen(Number(e.target.value))} placeholder="0" />
        </Field>
      </div>

      <p className="text-xs text-ink-soft mb-3">
        高所作業車は<strong className="text-ink">¥{SITE_ACCESS.aerialLiftPerDay.toLocaleString()}/日</strong>で明細に独立計上。
        {est.scaffoldRequired ? (
          <span className="text-amber-800 font-semibold"> ／ {floor}階＝足場が必要な想定です（足場費用は現地条件で変動するため本概算に含みません。現地調査で確定）。</span>
        ) : (
          <span> ／ {floor}階＝足場は不要想定（{SITE_ACCESS.scaffoldFloorThreshold}階以上で要・暫定ルール）。</span>
        )}
      </p>

      <div className="mb-4 rounded-2xl border border-ink-line bg-paper-card p-3 md:p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-ink">該当制度別シミュレーション</h3>
            <p className="mt-1 text-xs text-ink-soft">補助金なしと、該当条件診断を通過した制度を同じ工事条件で比較します。制度が複数ある場合はすべて表示します。</p>
          </div>
          <span className="rounded-full border border-ink-line px-2 py-1 text-xs text-ink-soft">{eligiblePrograms.length}制度</span>
        </div>
        {/* 2026-09-11 EHC-0038 第2便 4-A
            ProgramMatchBoard の比較ブロックと同じ規則にする。
            md:grid-cols-2（768px）では1枚約360pxで、内側の2列 dl に入る
            「¥12,340,000」が折り返す。桁が2行に割れた金額は比較に使えない。
            画面幅 1024px 以上（lg）と、入れ物の幅 280px 以上の
            2つの条件を同時に満たすときだけ横に並べる。 */}
        <div className="grid grid-cols-1 gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {scenarioRows.map((scenario) => {
            const active = scenario.key === rateKey;
            return (
              <button
                key={scenario.key}
                type="button"
                onClick={() => {
                  setRateKeyOverride(scenario.key === "none" ? null : scenario.key);
                  setCapOverride(null);
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-brand bg-[#edf6e8]" : "border-ink-line bg-paper-card hover:border-brand/40"}`}
              >
                <div className="min-h-10 text-xs font-bold leading-snug text-ink">{scenario.label}</div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-ink-soft">総費用（税込）</dt><dd className="text-right font-semibold text-ink">{yenJP(est.total)}</dd>
                  {/* 2026-09-10 EHC-0038 P0-7: 算定できないときは 0円 と書かず「未算定」と出す
                      2026-09-11 第2便 4-B: 語だけでなく記号「—」を先に置く。
                      「未算定」という語は数字の位置に置かれると金額欄の一部として
                      流し読みされる。記号なら数字でないことが一目で判る。 */}
                  <dt className="text-ink-soft">想定補助額</dt><dd className="text-right font-semibold text-amber-800">{scenario.subsidyYen == null ? <TileUnset /> : yenJP(scenario.subsidyYen)}</dd>
                  <dt className="text-ink-soft">実質負担</dt><dd className="text-right font-bold text-brand-deep">{scenario.netYen == null ? <TileUnset /> : yenJP(scenario.netYen)}</dd>
                  <dt className="text-ink-soft">回収目安</dt><dd className="text-right font-semibold text-ink">{scenario.recoveryYears == null ? <TileUnset /> : `約${scenario.recoveryYears.toFixed(1)}年`}</dd>
                </dl>
                {scenario.subsidy && <p className="mt-2 text-xs text-ink-soft">上限 {scenario.subsidy.max}／{scenario.subsidy.verificationState === "verified" ? "" : "公式情報の再確認が必要／"}採択・受給を保証しません</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 明細 */}
      {/* 2026-08-24 監査での修正: 親が overflow-hidden だったため、
          この表（実測882px）がスマホ幅で右端から切れて金額列ごと読めなかった。
          同じアプリ内の他の表は overflow-x-auto で横スクロールできる。揃える。 */}
      <div className="border border-ink-line rounded-xl overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead className="bg-paper-sub text-ink-soft">
            <tr>
              <th className="text-left px-3 py-2 font-medium">項目</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">内訳</th>
              <th className="text-right px-3 py-2 font-medium">金額</th>
            </tr>
          </thead>
          <tbody>
            {est.lines.map((l, i) => (
              <tr key={i} className="border-t border-ink-line">
                <td className="px-3 py-1.5 text-ink">{l.label}</td>
                <td className="px-3 py-1.5 text-ink-soft hidden md:table-cell">{l.detail}</td>
                <td className="px-3 py-1.5 text-right text-ink tabular-nums">{yenJP(l.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-ink-line bg-paper-sub">
              <td className="px-3 py-1.5 text-ink font-semibold" colSpan={2}>小計（税抜）</td>
              <td className="px-3 py-1.5 text-right text-ink font-semibold tabular-nums">{yenJP(est.subtotal)}</td>
            </tr>
            <tr className="border-t border-ink-line">
              <td className="px-3 py-1.5 text-ink-soft" colSpan={2}>消費税（{Math.round(est.taxRate * 100)}%）</td>
              <td className="px-3 py-1.5 text-right text-ink tabular-nums">{yenJP(est.tax)}</td>
            </tr>
            <tr className="border-t border-ink-line bg-paper-sub">
              <td className="px-3 py-2 text-ink font-bold" colSpan={2}>合計（税込）</td>
              <td className="px-3 py-2 text-right text-brand-deep font-bold tabular-nums">{yenJP(est.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-4 text-xs text-ink-soft bg-paper-sub border border-ink-line rounded-xl px-3 py-2.5">
        この小計（税抜）＝<strong className="text-ink">{subtotalManYen.toLocaleString("ja-JP")}万円</strong>が、上の
        <strong className="text-brand-deep">「今回更新分の設備投資概算」</strong>に取り込める金額です。
        上の欄で「実勢で自動見積」を押した場合も<strong className="text-ink">同じ計算式</strong>を使うため、
        標準グレード・現場条件なしなら数字は一致します。
      </div>

      {/* 補助金・実質負担 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-paper-card border border-ink-line rounded-xl p-3">
          <div className="text-xs text-ink-soft mb-1">機器費 / 工事費</div>
          <div className="text-sm font-semibold text-ink">{yenJP(est.machine)}<span className="text-ink-soft"> / </span>{yenJP(est.work)}</div>
        </div>
        <div className="bg-paper-card border border-ink-line rounded-xl p-3">
          <div className="text-xs text-ink-soft mb-1">補助上限（この制度の上限額）</div>
          {/* 2026-09-10 EHC-0038 P0-7:
              以前は欄を空にすると 0 が入り、プレースホルダの「上限なし」どおり
              頭打ちなしとして計算していた。しかし共通関数は同じ 0 を「上限0円」と読む。
              空欄＝【未確認】（金額を算定しない）とし、
              「上限なし」は下の専用ボタンで明示的に選ぶ形へ改めた。 */}
          <div className="flex items-center gap-1">
            <input
              aria-label="補助上限（この制度の上限額・万円）"
              type="text"
              inputMode="numeric"
              value={capState === "amount" ? capManYen.toLocaleString("ja-JP") : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                // 空欄は「未確認」。0 を書き込んで上限なしの意味に流用しない
                setCapOverride(digits === "" ? 0 : Number(digits));
              }}
              className="min-h-[48px] w-full bg-paper-card border border-ink-line rounded px-2 py-1 text-sm text-ink text-right tabular-nums"
              placeholder={capState === "none" ? SUBSIDY_CAP_NONE_LABEL : "未入力＝未確認"}
              disabled={capState === "none"}
            />
            <span className="text-xs text-ink-soft shrink-0">万円</span>
          </div>
          {capState === "amount" && (
            <div className="text-xs text-ink mt-1 tabular-nums">＝ {okuLabel(capManYen)}</div>
          )}
          {capState === "none" && (
            <div className="text-xs text-ink mt-1">{SUBSIDY_CAP_NONE_LABEL}（頭打ちなしとして計算）</div>
          )}
          {capState === "unknown" && rate > 0 && (
            <div className="text-xs text-amber-800 mt-1 leading-tight">上限が未確認です。補助額は算定しません。</div>
          )}
          <div className="text-xs mt-1 leading-tight flex flex-wrap items-center gap-x-3">
            {capOverride != null ? (
              <button type="button" onClick={() => setCapOverride(null)} className="min-h-[48px] inline-flex items-center text-brand-deep hover:underline">
                診断制度の上限に戻す
              </button>
            ) : (
              <span className="text-ink-soft">{selectedRate.subsidy ? "選択制度の上限を自動反映" : "補助金なし"}</span>
            )}
            {capState !== "none" ? (
              <button type="button" onClick={() => setCapOverride(SUBSIDY_CAP_NONE)} className="min-h-[48px] inline-flex items-center text-ink-soft hover:underline">
                上限なしにする
              </button>
            ) : (
              <button type="button" onClick={() => setCapOverride(0)} className="min-h-[48px] inline-flex items-center text-ink-soft hover:underline">
                上限額を入力する
              </button>
            )}
          </div>
        </div>
        {/* 2026-09-11 EHC-0038 第2便 4-B / 4-D
            暗色時代は「黒へ向かうグラデーション＋10%の色」で面を作っていた。
            白地では from- 側の 10% だけが残り、to- 側が白に化けて
            グラデーションの向きが逆（下が明るい）に見える。
            方向のない単色の淡い塗りにする。

            金額が未算定のときは、金額と同じ 18px の文字で「未算定」と書くのをやめ、
            28px / 600 の「—」にする。数字が入る位置に数字ではない記号を置くことで、
            流し読みでも「ここには金額が無い」と判る。 */}
        <div className="bg-amber-50 border border-amber-500/40 rounded-xl p-3">
          <div className="text-xs text-amber-800 mb-1">補助金額（概算）</div>
          {subsidy == null ? (
            <div className="text-[28px] font-semibold leading-none text-amber-800" aria-label={SUBSIDY_AMOUNT_UNKNOWN_LABEL}>
              {AMOUNT_UNSET_MARK}
              <span className="ml-2 align-middle text-xs font-semibold">{SUBSIDY_AMOUNT_UNKNOWN_LABEL}</span>
            </div>
          ) : (
            <div className="text-lg font-bold text-amber-800">{yenJP(subsidy)}</div>
          )}
          <div className="text-xs text-ink-soft mt-0.5">
            {subsidy == null ? (
              <span className="text-amber-900">{SUBSIDY_CAP_UNKNOWN_NOTE}</span>
            ) : capped ? (
              <span className="text-amber-900">上限で頭打ち（{yenJP(Math.round(rawSubsidy))} → {yenJP(subsidy)}）</span>
            ) : (
              <>小計 {yenJP(est.subtotal)} × {selectedRate.subsidy ? selectedRate.subsidy.rate : "補助金なし"}</>
            )}
          </div>
        </div>
        <div className="bg-[#edf6e8] border border-brand/35 rounded-xl p-3">
          <div className="text-xs text-brand-deep mb-1">実質負担（税込−補助）</div>
          {netOut == null ? (
            <div className="text-[28px] font-semibold leading-none text-brand-deep" aria-label={SUBSIDY_AMOUNT_UNKNOWN_LABEL}>
              {AMOUNT_UNSET_MARK}
              <span className="ml-2 align-middle text-xs font-semibold">{SUBSIDY_AMOUNT_UNKNOWN_LABEL}</span>
            </div>
          ) : (
            <div className="text-lg font-bold text-brand-deep">{yenJP(netOut)}</div>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        ※ 補助金額は小計(税抜)×補助率の概算。消費税は補助対象外が一般的。上限・対象経費は各制度の公募要領で要確認。
        補助率・上限は初期状態では反映しません。上の該当条件診断を通過した制度だけを比較表示しますが、採択・受給・補助額を保証するものではありません。
      </p>
    </Card>
  );
}
