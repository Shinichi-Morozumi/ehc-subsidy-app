"use client";
import { useState, useEffect, useMemo } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input } from "./ui/Field";
import { Receipt, Link2, Link2Off, Lock, ArrowUp } from "lucide-react";
import { estimateUpdateBreakdownGroups, MachineGrade, CostClass, COST_CLASS, SITE_ACCESS, PRICING_SOURCE, yenJP, DEFAULT_KG_PER_UNIT } from "@/lib/pricing";
import { SUBSIDY_RATE_PRESETS, DEFAULT_SUBSIDY_RATE_KEY } from "@/lib/subsidies";
import { Subsidy } from "@/lib/types";
import { useProject } from "./ProjectContext";

// 補助率プリセットは lib/subsidies.ts の実データに対応（制度名と補助率の食い違いを防ぐ）
const RATES = SUBSIDY_RATE_PRESETS;

// 制度の補助率(rateNum) に一番近いプリセットkeyを返す（表示と計算の食い違いを防ぐ）
function rateKeyFor(rateNum: number): string {
  return RATES.reduce((best, r) =>
    Math.abs(r.rate - rateNum) < Math.abs(best.rate - rateNum) ? r : best
  , RATES[0]).key;
}

// 万円の数値を「3億円」「1億2,000万円」のような読みやすい表記にする
function okuLabel(manYen: number): string {
  const oku = Math.floor(manYen / 10000);
  const man = manYen % 10000;
  if (oku <= 0) return `${man.toLocaleString("ja-JP")}万円`;
  if (man === 0) return `${oku.toLocaleString("ja-JP")}億円`;
  return `${oku.toLocaleString("ja-JP")}億${man.toLocaleString("ja-JP")}万円`;
}

export function UpdateEstimator() {
  const { input, result, setEstimateManYen } = useProject();

  /* 表示条件：上の「案件情報」で〈即答〉を押して判定が確定してから出す。
     （それ以前は何を入れる欄なのか分からない＝役割が伝わらないため） */
  const ready = !!input && !!result;

  // 案件情報で確定した設備グループ（＝この見積の台数・馬力の唯一の入力元）
  const projectGroups = useMemo(
    () => (input?.equipGroups ?? []).filter((g) => (g.units ?? 0) > 0).map((g) => ({ units: g.units, hp: g.hp ?? 0 })),
    [input]
  );
  const hasProjectGroups = projectGroups.length > 0;

  // 馬力が未入力のグループ（機器費が最低単価で入るため注意喚起する）
  const noHpUnits = projectGroups.filter((g) => !g.hp).reduce((a, g) => a + g.units, 0);

  // 判定で最有力の制度（補助率・補助上限をここから自動で引き継ぐ＝全連動）
  const bestSubsidy: Subsidy | null = useMemo(() => {
    if (!input || !result) return null;
    const cands = result.matched.filter((s) => !s.infoOnly && !s.closed);
    if (!cands.length) return null;
    return cands.reduce((best, s) =>
      Math.min(input.invest * s.rateNum, s.capManYen) > Math.min(input.invest * best.rateNum, best.capManYen) ? s : best
    );
  }, [input, result]);

  // 入力ソース: 案件情報に連動 / このカードだけで手入力
  const [manual, setManual] = useState(false);
  const useProjectGroups = hasProjectGroups && !manual;

  // 手入力モード用
  const [hp, setHp] = useState(4);
  const [units, setUnits] = useState(3);

  const groups = useProjectGroups ? projectGroups : [{ units, hp }];
  const totalUnits = groups.reduce((a, g) => a + g.units, 0);
  const autoSystems = Math.max(1, Math.ceil(totalUnits / 2));
  const [systemsOverride, setSystemsOverride] = useState<number | null>(null);
  const systems = systemsOverride ?? autoSystems;

  const [grade, setGrade] = useState<MachineGrade>("standard");
  const [costClass, setCostClass] = useState<CostClass>("standard");

  /* 補助率・補助上限は「判定で最有力の制度」から自動。手で触ったときだけ上書き値を使う。
     0 という数字だけを置くと意味が伝わらないため、未設定は空欄＋説明文で表す。 */
  const autoRateKey = bestSubsidy ? rateKeyFor(bestSubsidy.rateNum) : DEFAULT_SUBSIDY_RATE_KEY;
  const autoCapManYen = bestSubsidy ? bestSubsidy.capManYen : 0;
  const [rateKeyOverride, setRateKeyOverride] = useState<string | null>(null);
  const [capOverride, setCapOverride] = useState<number | null>(null);
  const rateKey = rateKeyOverride ?? autoRateKey;
  const capManYen = capOverride ?? autoCapManYen;

  const [ancillaryManYen, setAncillaryManYen] = useState(0); // 付帯工事(万円)
  const [aerialDays, setAerialDays] = useState(0); // 高所作業車(日)
  const [floor, setFloor] = useState(1); // 設置階（足場要否の暫定判定用）

  const kg = totalUnits * DEFAULT_KG_PER_UNIT; // 撤去1台あたりの想定回収冷媒量（共通定数）
  const est = estimateUpdateBreakdownGroups(groups, {
    grade, costClass, systems, kg, aerialDays, floor, ancillary: ancillaryManYen * 10000,
  });
  const rate = RATES.find((r) => r.key === rateKey)?.rate ?? 0;
  const rawSubsidy = Math.round(est.subtotal * rate); // 税抜ベースで補助
  const capYen = capManYen > 0 ? capManYen * 10000 : Infinity;
  const subsidy = Math.min(rawSubsidy, capYen);
  const capped = rawSubsidy > capYen; // 上限に頭打ちされたか
  const netOut = est.total - subsidy; // 実質負担(税込−補助)

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
            案件情報の<strong className="text-slate-200">設備グループ（馬力・台数）</strong>と
            <strong className="text-slate-200">判定された制度の補助率・補助上限</strong>をそのまま引き継いで、
            <strong className="text-ehc-300">お客様に出す内訳見積</strong>をここに作ります。
            二重入力は不要です。
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
        台数・馬力・補助率・補助上限は<strong className="text-slate-200">上の判定結果から自動で入ります</strong>。
        現場条件（高所作業車・設置階・価格帯・付帯工事）だけここで入力します（{PRICING_SOURCE}）。
        実見積は機種グレード・搬入条件・配管長で変動する<strong className="text-slate-200">参考値</strong>です。
      </p>

      {/* 連動ステータス */}
      <div className={`flex flex-wrap items-center gap-2 mb-3 rounded-xl border px-3 py-2.5 text-[11px] ${useProjectGroups ? "border-ehc-500/30 bg-ehc-500/10" : "border-white/10 bg-white/5"}`}>
        {useProjectGroups ? (
          <>
            <Link2 className="w-4 h-4 text-ehc-300 shrink-0" />
            <span className="text-ehc-200">
              上の案件情報と連動中：
              <strong className="text-ehc-100">
                {projectGroups.map((g) => `${g.hp || "?"}馬力×${g.units}台`).join(" ／ ")}
              </strong>
              （合計 {totalUnits}台）
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
        <Field label="冷媒系統数">
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
          <Select value={rateKey} onChange={(e) => setRateKeyOverride(e.target.value)}>
            {RATES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
          {rateKeyOverride == null ? (
            bestSubsidy && <div className="text-[10px] text-ehc-300 mt-0.5">自動：{bestSubsidy.name}</div>
          ) : (
            <button type="button" onClick={() => setRateKeyOverride(null)} className="text-[10px] text-ehc-300 hover:underline mt-0.5">
              判定結果の補助率に戻す
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
                判定結果の上限に戻す
              </button>
            ) : bestSubsidy && autoCapManYen > 0 ? (
              <span className="text-ehc-300">自動：{bestSubsidy.name} の上限</span>
            ) : (
              <span className="text-slate-500">空欄＝上限なしで計算</span>
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
              <>小計 {yenJP(est.subtotal)} × {RATES.find((r) => r.key === rateKey)?.label.split("（")[0]}</>
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
        補助率・上限は上の「即答」で最有力と判定された制度から自動で入ります（制度名と補助率は lib/subsidies.ts の実データに対応）。
      </p>
    </Card>
  );
}
