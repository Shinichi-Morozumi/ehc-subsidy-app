"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Receipt, Link2, Link2Off, Lock, ArrowUp } from "lucide-react";
import { estimateUpdateBreakdownGroups, MachineGrade, CostClass, COST_CLASS, SITE_ACCESS, PRICING_SOURCE, yenJP, DEFAULT_KG_PER_UNIT } from "@/lib/pricing";
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
  const rate = selectedRate.rate;
  const rawSubsidy = Math.round(est.subtotal * rate); // 税抜ベースで補助
  const capYen = capManYen > 0 ? capManYen * 10000 : Infinity;
  const subsidy = Math.min(rawSubsidy, capYen);
  const capped = rawSubsidy > capYen; // 上限に頭打ちされたか
  const netOut = est.total - subsidy; // 実質負担(税込−補助)
  const annualSavingsYen = result?.saveYenPerYear ?? 0;
  const scenarioRows = rateOptions.map((option) => {
    const optionRaw = Math.round(est.subtotal * option.rate);
    const optionCapYen = option.capManYen > 0 ? option.capManYen * 10000 : Infinity;
    const optionSubsidy = Math.min(optionRaw, optionCapYen);
    const optionNet = est.total - optionSubsidy;
    return {
      ...option,
      subsidyYen: optionSubsidy,
      netYen: optionNet,
      recoveryYears: annualSavingsYen > 0 ? optionNet / annualSavingsYen : null,
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
        <CardTitle icon={<Receipt className="w-5 h-5" />}>更新工事 見積シミュレーター（お客様提示用の明細）</CardTitle>
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <Lock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <div className="text-sm font-semibold text-slate-100 mb-1 flex items-center gap-1.5">
              <ArrowUp className="w-4 h-4 text-ehc-300" />
              まず上の「案件情報」を入力して〈補助金＆ROIを即答〉を押してください。
            </div>
            案件情報の<strong className="text-slate-200">設備グループ（馬力・台数）</strong>を引き継いで、
            <strong className="text-ehc-300">お客様に出す内訳見積</strong>をここに作ります。
            補助率・上限はガイド式の要件確認後に手動で選び、未確認時は補助金なしで表示します。
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle icon={<Receipt className="w-5 h-5" />}>更新工事 見積シミュレーター（お客様提示用の明細）</CardTitle>
      <p className="text-[11px] text-cobalt-200 bg-cobalt-600/10 border border-cobalt-500/30 rounded-lg px-3 py-2 mb-3">
        上のロードマップ内「投資額の妥当性チェック」が<strong>レンジ（金額の桁が妥当か）</strong>の確認なのに対し、ここは<strong>明細（お客様にそのまま出せる内訳）</strong>を作る欄です。
      </p>
      <p className="text-xs text-slate-400 mb-3">
        上の<strong className="text-slate-200">「案件情報」が補助金判定用の総額1本</strong>なのに対し、ここは
        <strong className="text-ehc-300">お客様に出す内訳（明細）</strong>を作る欄です。
        台数・馬力は<strong className="text-slate-200">上の入力から自動連動</strong>します。補助率・上限は未確認の制度を反映しないため、初期値は補助金なしです。
        現場条件（高所作業車・設置階・価格帯・付帯工事）だけここで入力します（{PRICING_SOURCE}）。
        実見積は機種グレード・搬入条件・配管長で変動する<strong className="text-slate-200">参考値</strong>です。
      </p>

      <details className="mb-3 rounded-xl border border-cobalt-500/30 bg-cobalt-600/10 px-3 py-2.5">
        <summary className="cursor-pointer text-xs font-bold text-cobalt-200">入力サポート｜系統ごとに機器・年式が違う場合</summary>
        <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-300">
          <p>室外機の系統ごとに1行作り、同じ型式・年式・馬力の機器だけを同じ行にまとめます。機種や設置年が違う場合は行を分けてください。</p>
          <p><strong className="text-white">確認する場所：</strong>室外機側面の銘板で「型式・製造年・冷媒・能力」を確認します。分からない項目は不明のままでも仮診断できます。</p>
          <button type="button" onClick={() => {
            const details = document.getElementById("project-info-section") as HTMLDetailsElement | null;
            if (details) {
              details.open = true;
              details.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }} className="mt-1 inline-flex rounded-lg border border-cobalt-500/40 px-3 py-1.5 text-[11px] font-bold text-cobalt-200 hover:bg-cobalt-500/10">
            系統別の設備情報を入力・修正する
          </button>
        </div>
      </details>

      {/* 連動ステータス */}
      <div className={`flex flex-wrap items-center gap-2 mb-3 rounded-xl border px-3 py-2.5 text-[11px] ${useProjectGroups ? "border-ehc-500/30 bg-ehc-500/10" : "border-white/10 bg-white/5"}`}>
        {useProjectGroups ? (
          <>
            <Link2 className="w-4 h-4 text-ehc-300 shrink-0" />
            <span className="text-ehc-200">
              上の案件情報と連動中：
              <strong className="text-ehc-100">
                {projectGroups.map((g, index) => `系統${index + 1} ${g.equip === "multi" ? "マルチ" : "パッケージ"}・${g.installYear}年・${g.hp || "?"}馬力×${g.units}台`).join(" ／ ")}
              </strong>
              （{projectGroups.length}系統・合計 {totalUnits}台）
            </span>
            <button type="button" onClick={() => setManual(true)}
              className="ml-auto px-2 py-1 rounded-lg border border-white/15 text-slate-300 hover:bg-white/10">
              このカードだけ手入力にする
            </button>
          </>
        ) : (
          <>
            <Link2Off className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-300">
              {hasProjectGroups ? "手入力モード（上の案件情報とは連動していません）" : "上の「案件情報」に設備グループ（台数）を入力すると、自動でここに連動します"}
            </span>
            {hasProjectGroups && (
              <button type="button" onClick={() => { setManual(false); setSystemsOverride(null); }}
                className="ml-auto px-2 py-1 rounded-lg border border-ehc-500/40 text-ehc-300 hover:bg-ehc-500/10">
                案件情報に連動させる
              </button>
            )}
          </>
        )}
      </div>

      {useProjectGroups && noHpUnits > 0 && (
        <div className="mb-4 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
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
            <button type="button" onClick={() => setSystemsOverride(null)} className="text-[10px] text-ehc-300 hover:underline mt-0.5">
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
            <div className="text-[10px] text-amber-300 mt-0.5">{diagnosisComplete ? "該当見込みの制度なし" : "上の該当条件診断後に制度を表示"}</div>
          ) : rateKeyOverride == null ? (
            <div className="text-[10px] text-slate-500 mt-0.5">診断済み制度から選択できます</div>
          ) : (
            <button type="button" onClick={() => setRateKeyOverride(null)} className="text-[10px] text-ehc-300 hover:underline mt-0.5">
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

      <p className="text-[11px] text-slate-400 mb-3">
        高所作業車は<strong className="text-slate-200">¥{SITE_ACCESS.aerialLiftPerDay.toLocaleString()}/日</strong>で明細に独立計上。
        {est.scaffoldRequired ? (
          <span className="text-amber-300 font-semibold"> ／ {floor}階＝足場が必要な想定です（足場費用は現地条件で変動するため本概算に含みません。現地調査で確定）。</span>
        ) : (
          <span> ／ {floor}階＝足場は不要想定（{SITE_ACCESS.scaffoldFloorThreshold}階以上で要・暫定ルール）。</span>
        )}
      </p>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-white">該当制度別シミュレーション</h3>
            <p className="mt-1 text-[10px] text-slate-500">補助金なしと、該当条件診断を通過した制度を同じ工事条件で比較します。制度が複数ある場合はすべて表示します。</p>
          </div>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">{eligiblePrograms.length}制度</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-ehc-400 bg-ehc-500/10" : "border-white/10 bg-night-900 hover:border-ehc-500/35"}`}
              >
                <div className="min-h-10 text-xs font-bold leading-snug text-slate-100">{scenario.label}</div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <dt className="text-slate-500">総費用（税込）</dt><dd className="text-right font-semibold text-slate-200">{yenJP(est.total)}</dd>
                  <dt className="text-slate-500">想定補助額</dt><dd className="text-right font-semibold text-amber-300">{yenJP(scenario.subsidyYen)}</dd>
                  <dt className="text-slate-500">実質負担</dt><dd className="text-right font-bold text-ehc-300">{yenJP(scenario.netYen)}</dd>
                  <dt className="text-slate-500">回収目安</dt><dd className="text-right font-semibold text-slate-200">{scenario.recoveryYears == null ? "算定不可" : `約${scenario.recoveryYears.toFixed(1)}年`}</dd>
                </dl>
                {scenario.subsidy && <p className="mt-2 text-[10px] text-slate-500">上限 {scenario.subsidy.max}／{scenario.subsidy.verificationState === "verified" ? "" : "公式情報の再確認が必要／"}採択・受給を保証しません</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 明細 */}
      <div className="border border-white/10 rounded-xl overflow-hidden mb-4">
        <table className="w-full text-[11px]">
          <thead className="bg-night-900/80 text-slate-400">
            <tr>
              <th className="text-left px-3 py-2 font-medium">項目</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">内訳</th>
              <th className="text-right px-3 py-2 font-medium">金額</th>
            </tr>
          </thead>
          <tbody>
            {est.lines.map((l, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-3 py-1.5 text-slate-200">{l.label}</td>
                <td className="px-3 py-1.5 text-slate-500 hidden md:table-cell">{l.detail}</td>
                <td className="px-3 py-1.5 text-right text-slate-200 tabular-nums">{yenJP(l.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/15 bg-white/5">
              <td className="px-3 py-1.5 text-slate-300 font-semibold" colSpan={2}>小計（税抜）</td>
              <td className="px-3 py-1.5 text-right text-slate-100 font-semibold tabular-nums">{yenJP(est.subtotal)}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="px-3 py-1.5 text-slate-400" colSpan={2}>消費税（{Math.round(est.taxRate * 100)}%）</td>
              <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">{yenJP(est.tax)}</td>
            </tr>
            <tr className="border-t border-white/15 bg-white/5">
              <td className="px-3 py-2 text-slate-200 font-bold" colSpan={2}>合計（税込）</td>
              <td className="px-3 py-2 text-right text-ehc-300 font-bold tabular-nums">{yenJP(est.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-4 text-[11px] text-slate-400 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
        この小計（税抜）＝<strong className="text-slate-200">{subtotalManYen.toLocaleString("ja-JP")}万円</strong>が、上の
        <strong className="text-ehc-300">「今回更新分の設備投資概算」</strong>に取り込める金額です。
        上の欄で「実勢で自動見積」を押した場合も<strong className="text-slate-200">同じ計算式</strong>を使うため、
        標準グレード・現場条件なしなら数字は一致します。
      </div>

      {/* 補助金・実質負担 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-night-900 border border-white/10 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 mb-1">機器費 / 工事費</div>
          <div className="text-sm font-semibold text-slate-200">{yenJP(est.machine)}<span className="text-slate-500"> / </span>{yenJP(est.work)}</div>
        </div>
        <div className="bg-night-900 border border-white/10 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 mb-1">補助上限（この制度の上限額）</div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={capManYen > 0 ? capManYen.toLocaleString("ja-JP") : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setCapOverride(digits === "" ? 0 : Number(digits));
              }}
              className="w-full bg-night-900 border border-white/15 rounded px-2 py-1 text-sm text-slate-100 text-right tabular-nums"
              placeholder="上限なし"
            />
            <span className="text-[11px] text-slate-400 shrink-0">万円</span>
          </div>
          {capManYen > 0 && (
            <div className="text-[11px] text-slate-300 mt-1 tabular-nums">＝ {okuLabel(capManYen)}</div>
          )}
          <div className="text-[10px] mt-1 leading-tight">
            {capOverride != null ? (
              <button type="button" onClick={() => setCapOverride(null)} className="text-ehc-300 hover:underline">
                診断制度の上限に戻す
              </button>
            ) : (
              <span className="text-slate-500">{selectedRate.subsidy ? "選択制度の上限を自動反映" : "補助金なし"}</span>
            )}
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-night-900 border border-amber-500/30 rounded-xl p-3">
          <div className="text-[11px] text-amber-300 mb-1">補助金額（概算）</div>
          <div className="text-lg font-bold text-amber-300">{yenJP(subsidy)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {capped ? (
              <span className="text-amber-200">上限で頭打ち（{yenJP(rawSubsidy)} → {yenJP(subsidy)}）</span>
            ) : (
              <>小計 {yenJP(est.subtotal)} × {selectedRate.subsidy ? selectedRate.subsidy.rate : "補助金なし"}</>
            )}
          </div>
        </div>
        <div className="bg-gradient-to-br from-ehc-500/10 to-night-900 border border-ehc-500/30 rounded-xl p-3">
          <div className="text-[11px] text-ehc-300 mb-1">実質負担（税込−補助）</div>
          <div className="text-lg font-bold text-ehc-300">{yenJP(netOut)}</div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        ※ 補助金額は小計(税抜)×補助率の概算。消費税は補助対象外が一般的。上限・対象経費は各制度の公募要領で要確認。
        補助率・上限は初期状態では反映しません。上の該当条件診断を通過した制度だけを比較表示しますが、採択・受給・補助額を保証するものではありません。
      </p>
    </Card>
  );
}
