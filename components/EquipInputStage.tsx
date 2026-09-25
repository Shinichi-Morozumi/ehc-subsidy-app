"use client";

import { useState } from "react";
import { Plus, Trash2, HelpCircle, Pencil, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, Input } from "./ui/Field";
import {
  DiagnosisEquipGroup,
  DiagnosisState,
  EquipKind,
  newEquipGroup,
  newEquipGroupId,
} from "@/lib/diagnosisState";
import { newPlannedUnit, type PlannedUnit } from "@/lib/targetProduct";
import {
  UNRESOLVED_REASON_LABEL,
  UNRESOLVED_REASON_NOTE,
  projectEquipGroups,
} from "@/lib/diagnosisProjection";

/* ───────────────────────────────────────────────────────────
   設備を入力する段（EHC-0039 第5片 / 2026-09-14 v1）
   段ナビでいう 2 / 4。

   ■ 何を聞くか（EHC-0044 / v1 / 2026-09-17）
   　　種類・台数・設置年・馬力を表に出す。
   　　馬力は工事費用の概算に必要なので、任意の詳細に隠さない。
   　　未回答でも候補診断には進めるが、その設備の概算金額は出さない。
   　　メーカー・型番だけを任意の補足情報として畳む。

   ■ 埋めない
   　　台数の初期値に 1 を入れない。設置年に「15年前」を入れない。
   　　種類の初期選択を作らない。
   　　入れた瞬間に、こちらの仮定が相手の入力として下流へ流れる。
   　　判定は lib/diagnosisProjection.ts に一本化してあるので、
   　　この画面は「足りない」と言うだけで、足りない分を埋めない。

   ■ 絵について（EHC-0038 素材PDF v2 §03）
   　　絵は形状の例であって、種別の定義ではない。
   　　壁掛けにも業務用機があり、天井カセットがマルチに繋がっていることもある。
   　　だから日本語の名前を表示し、「見分け方」を開いて確認できるようにして、
   　　「分からない」を同じ大きさで並べる。
   ─────────────────────────────────────────────────────────── */

type SelectableKind = Exclude<EquipKind, null>;

const KIND_OPTIONS: {
  value: SelectableKind;
  label: string;
  /** 見分け方。絵だけで選ばせない */
  hint: string;
  img?: { src: string; alt: string };
}[] = [
  {
    value: "room",
    label: "ルームエアコン",
    hint: "家庭用と同じ形。壁の上のほうに付いていて、リモコンで1台ずつ操作します。",
    img: { src: "/equip/ac-wall.png", alt: "壁掛けの室内機と小型の室外機" },
  },
  {
    value: "ac",
    label: "業務用パッケージ",
    hint: "天井に埋め込まれた四角い吹出口。室内機1台に室外機1台が対応します。",
    img: { src: "/equip/ac-cassette.png", alt: "天井カセット形の室内機と業務用の室外機" },
  },
  {
    value: "multi",
    label: "ビル用マルチ",
    hint: "大きな室外機に、複数の部屋の室内機がまとめてつながっています。",
    img: { src: "/equip/multi-vrf.png", alt: "大型の室外機2台と天井カセット形の室内機" },
  },
  {
    value: "unknown",
    label: "分からない",
    hint: "推測で選ばずこちらを選んでください。現地調査か銘板の写真で確認します。",
  },
];

const KIND_LABEL: Record<SelectableKind, string> = {
  room: "ルームエアコン",
  ac: "業務用パッケージ",
  multi: "ビル用マルチ",
  unknown: "種類は確認中",
};

/* 表示専用。未入力を「0」や「1」と書かない。 */
const summarize = (g: DiagnosisEquipGroup): string => {
  const kind = g.kind ? KIND_LABEL[g.kind] : "種類 未選択";
  const units = g.units == null ? "台数 未入力" : `${g.units}台`;
  const year = g.installYear == null ? "設置年 未入力" : `${g.installYear}年設置`;
  const hp = g.hp == null ? "馬力 未入力" : Number.isFinite(g.hp) && g.hp > 0 ? `${g.hp}HP/台` : "馬力 要確認";
  return `${kind}・${units}・${year}・${hp}`;
};

/* 入力欄の値 → 状態。空欄は null（0 にしない）。
   Number("") は 0 を返すので、ここを通さずに Number() を直接使わないこと。 */
const toNumberOrNull = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const toTextOrNull = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

export interface EquipInputStageProps {
  state: DiagnosisState;
  onChange: (next: DiagnosisState) => void;
}

export function EquipInputStage({ state, onChange }: EquipInputStageProps) {
  /* 開いている群は1つだけ（アコーディオン）。
     入力済みの群を畳んで要約1行にしておかないと、
     3群目を足したあたりで画面が縦に伸びきって、
     いま触っている欄と「設備を追加」の距離が親指1本分を超える。 */
  const [expandedId, setExpandedId] = useState<string | null>(
    state.groups[state.groups.length - 1]?.id ?? null
  );
  // 選択値は共有stateに残し、4つのカードを見せるかだけをこの段で管理する。
  const [choosingKindId, setChoosingKindId] = useState<string | null>(null);

  const finishKindSelection = (id: string) => {
    setChoosingKindId(null);
    // 選んだradioが消えてもフォーカスを失わず、次の数字へ進める。
    window.requestAnimationFrame(() => document.getElementById(`equip-units-${id}`)?.focus());
  };

  const { unresolvedGroups } = projectEquipGroups(state);
  const reasonsFor = (id: string) =>
    unresolvedGroups.find((u) => u.group.id === id)?.reasons ?? [];

  const patch = (id: string, changes: Partial<DiagnosisEquipGroup>) => {
    onChange({
      ...state,
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...changes } : g)),
    });
  };

  const addGroup = () => {
    const g = newEquipGroup();
    onChange({ ...state, groups: [...state.groups, g] });
    setExpandedId(g.id);
    setChoosingKindId(null);
  };

  const removeGroup = (id: string) => {
    const rest = state.groups.filter((g) => g.id !== id);
    /* 群が0になると「設備が無い」のか「消しただけ」なのか分からなくなる。
       最後の1つは消させず、空欄の群を1つ残す。 */
    onChange({ ...state, groups: rest.length > 0 ? rest : [newEquipGroup()] });
    if (expandedId === id) setExpandedId(rest[rest.length - 1]?.id ?? null);
    if (choosingKindId === id) setChoosingKindId(null);
  };

  return (
    <section className="space-y-3">
      <div>
        {/* 2026-09-14 EHC-0039: v3§7「本文16pxを基本、根拠・不足理由14px以上、行高約1.7」
            この段だけ 12px(text-xs) / 13px を多用していて、実測で1章あたり
            300近い文字ノードが14px未満だった。見出し18px・本文16px・補足14pxへ揃える。
            Tailwind の名前付き階梯（text-xs/sm/base）は 12/14/16 と刻みが粗く、
            行高も 1.33〜1.5 が既定で付いてくるため、他の4段と同じく
            text-[NNpx] leading-[1.7] の明示指定に統一する。 */}
        <p className="text-[16px] leading-[1.7] text-ink-soft mt-1">
          種類と数字を入力します。分からない欄は空欄のまま、候補診断へ進めます。
        </p>
      </div>

      <ol className="space-y-3">
        {state.groups.map((g, i) => {
          const isOpen = expandedId === g.id;
          const selectedKind = KIND_OPTIONS.find((opt) => opt.value === g.kind);
          const choosingKind = !selectedKind || choosingKindId === g.id;
          const reasons = reasonsFor(g.id);
          const hpInvalid = g.hp != null && (!Number.isFinite(g.hp) || g.hp <= 0);
          const hpMissing = g.hp == null || hpInvalid;
          /* 「金額を出せない」ことと「入力が足りない」ことは別。
             ルームエアコン・分からない は入力が足りているのに算定しない群なので、
             未入力の催促（赤系）ではなく説明として出す。 */
          const blocking = reasons.filter(
            (r) => r === "units_missing" || r === "install_year_missing" || r === "kind_unselected"
          );

          return (
            <li
              key={g.id}
              className={cn(
                "rounded-3xl border bg-paper-card",
                isOpen ? "border-brand" : "border-ink-line"
              )}
            >
              {/* ── 見出し行（畳んでいるときは要約1行） ── */}
              <div className="flex items-start gap-2 p-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#d7e7ae] text-ink text-[14px] font-black flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold leading-[1.7] text-ink">設備 {i + 1}</p>
                  {!isOpen && (
                    <p className="text-[14px] leading-[1.7] text-ink-soft mt-0.5 break-words">
                      {summarize(g)}
                    </p>
                  )}
                </div>

                {!isOpen && (
                  <button
                    type="button"
                    onClick={() => { setExpandedId(g.id); setChoosingKindId(null); }}
                    className="min-h-[48px] px-3 inline-flex items-center gap-1.5 rounded-xl text-[14px] leading-[1.7] text-ink-soft hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    変更
                    <span className="sr-only">（設備 {i + 1}）</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeGroup(g.id)}
                  className="min-h-[48px] px-3 inline-flex items-center rounded-xl text-ink-soft hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">設備 {i + 1} を削除</span>
                </button>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {/* ── 種類（絵つき） ── */}
                  <fieldset>
                    <legend className="text-[16px] leading-[1.7] text-ink mb-2 font-semibold">
                      {choosingKind ? "種類を選ぶ" : "設備の種類"}
                      {g.kind === null && <span className="ml-2 text-[14px] font-normal text-ink-soft">未選択</span>}
                    </legend>
                    {choosingKind ? <>
                    <div className="ehc-equipment-options grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {KIND_OPTIONS.map((opt) => {
                        const checked = g.kind === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={cn(
                              "ehc-equipment-option relative grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-2xl border-[1.5px] p-3 cursor-pointer transition-colors",
                              /* 選択は色だけで示さない。枠の太さと、下の「選択中」文字を併記する。
                                 淡い緑と白の差は、白黒印刷でも色覚型によっても消えることがある。 */
                              checked
                                ? "border-brand bg-paper-tint"
                                : "border-[#57685e] bg-paper-card hover:border-brand",
                              "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand"
                            )}
                          >
                            <input
                              id={`kind-${g.id}-${opt.value}`}
                              type="radio"
                              name={`kind-${g.id}`}
                              value={opt.value}
                              checked={checked}
                              onChange={() => {
                                patch(g.id, { kind: opt.value });
                                finishKindSelection(g.id);
                              }}
                              onClick={() => { if (checked) finishKindSelection(g.id); }}
                              className="sr-only"
                            />
                            {opt.img ? (
                              <img
                                src={opt.img.src}
                                alt={opt.img.alt}
                                width={120}
                                height={120}
                                loading="lazy"
                                decoding="async"
                                className="row-span-2 w-full h-16 object-contain"
                              />
                            ) : (
                              <span className="row-span-2 w-full h-16 flex items-center justify-center">
                                <HelpCircle
                                  className="w-8 h-8 text-ink-soft"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[16px] leading-[1.5] text-left",
                                checked ? "font-bold text-ink" : "text-ink"
                              )}
                            >
                              {opt.label}
                            </span>
                            {checked && (
                              <span className="text-[14px] leading-[1.7] font-bold text-brand">
                                選択中
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <details className="mt-2">
                      <summary className="min-h-[48px] cursor-pointer text-[14px] leading-[1.7] text-ink-soft">種類の見分け方</summary>
                      <dl className="space-y-3 rounded-2xl bg-paper-sub p-3 text-[14px] leading-[1.7] text-ink-soft">
                        {KIND_OPTIONS.map((opt) => (
                          <div key={opt.value}>
                            <dt className="font-bold text-ink">{opt.label}</dt>
                            <dd>{opt.hint}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                    </> : (
                      <div className="flex items-center gap-3 rounded-2xl border border-ink-line bg-paper-sub p-3">
                        {selectedKind.img ? (
                          <img src={selectedKind.img.src} alt={selectedKind.img.alt} width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
                        ) : (
                          <HelpCircle className="h-8 w-12 shrink-0 text-ink-soft" aria-hidden="true" />
                        )}
                        <p className="min-w-0 flex-1 text-[16px] font-bold leading-[1.5] text-ink">{selectedKind.label}</p>
                        <button
                          type="button"
                          aria-expanded={false}
                          onClick={() => {
                            setChoosingKindId(g.id);
                            window.requestAnimationFrame(() => document.getElementById(`kind-${g.id}-${g.kind}`)?.focus());
                          }}
                          className="min-h-[48px] shrink-0 rounded-xl px-2 text-[14px] leading-[1.7] text-brand-deep underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                        >
                          種類を変更<span className="sr-only">（設備 {i + 1}）</span>
                        </button>
                      </div>
                    )}
                  </fieldset>

                  {/* ── 概算に必要な数字。馬力も折り畳まずに表示する ── */}
                  <p className="inline-flex rounded-full border border-brand/30 bg-paper-tint px-3 py-1 text-[14px] font-bold leading-[1.7] text-brand-deep">
                    工事費用の概算に必要
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field
                      labelSize="md"
                      label={`室内機の台数${blocking.includes("units_missing") ? g.units == null ? "（未入力）" : "（要確認）" : ""}`}
                    >
                      <Input
                        id={`equip-units-${g.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        placeholder="例: 6"
                        /* value に ?? "" を入れて null を空欄として保つ。
                           null を 0 に落とすと「0台」と入力したことになる。 */
                        value={g.units ?? ""}
                        onChange={(e) => patch(g.id, { units: toNumberOrNull(e.target.value) })}
                      />
                    </Field>
                    <Field
                      labelSize="md"
                      label={`設置年（西暦）${blocking.includes("install_year_missing") ? g.installYear == null ? "・未入力" : "・要確認" : ""}`}
                    >
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1970}
                        max={new Date().getFullYear()}
                        step={1}
                        placeholder="例: 2011"
                        value={g.installYear ?? ""}
                        onChange={(e) =>
                          patch(g.id, { installYear: toNumberOrNull(e.target.value) })
                        }
                      />
                    </Field>
                    <div className="sm:col-span-2 lg:col-span-1">
                      <Field labelSize="md" label={`1台あたりの馬力（HP）${g.hp == null ? "・未入力" : hpInvalid ? "・要確認" : ""}`}>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="例: 3"
                          value={g.hp ?? ""}
                          aria-invalid={hpInvalid || undefined}
                          aria-describedby={`hp-${g.id}-note${hpInvalid ? ` hp-${g.id}-error` : ""}`}
                          onChange={(e) => patch(g.id, { hp: toNumberOrNull(e.target.value) })}
                        />
                        <p id={`hp-${g.id}-note`} className="mt-2 text-[14px] leading-[1.7] text-ink-soft">
                          系統全体の能力やkWを、そのまま入力しないでください。
                        </p>
                        {hpInvalid && (
                          <p id={`hp-${g.id}-error`} role="status" className="mt-2 text-[14px] font-bold leading-[1.7] text-amber-800">
                            0以下は使えません。確認できなければ空欄にしてください。
                          </p>
                        )}
                      </Field>
                    </div>
                  </div>
                  {(reasons.length > 0 || hpMissing) && (
                    <div className="rounded-2xl border border-ink-line bg-paper-tint p-3">
                      <p className="flex items-start gap-2 text-[16px] font-bold leading-[1.7] text-ink">
                        <AlertCircle className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                        この設備の概算金額は未算定です
                      </p>
                      <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">
                        {g.kind === "room" ? "ルームエアコンは、この診断では金額を算定しません。"
                          : g.kind === "unknown" ? "種類不明のため、銘板や現地調査で確認します。"
                          : g.kind === null ? "設備の種類が未選択です。"
                          : "未入力・要確認の数字は、あとの概算画面でも補えます。"}
                      </p>
                    </div>
                  )}
                  <details className="rounded-2xl border border-ink-line">
                    <summary className="min-h-[48px] cursor-pointer px-4 text-[14px] leading-[1.7] text-ink-soft">
                      入力の確認方法{(reasons.length > 0 || hpMissing) && "・未算定の理由"}
                    </summary>
                    <div className="space-y-3 px-4 pb-4 text-[14px] leading-[1.7] text-ink-soft">
                      <dl className="space-y-3">
                        <div><dt className="font-bold text-ink">台数</dt><dd>部屋に付いている室内機の数です。室外機の数・系統数とは異なります。</dd></div>
                        <div><dt className="font-bold text-ink">設置年</dt><dd>銘板シールや設置・点検記録で確認します。分からなければ空欄で構いません。</dd></div>
                        <div><dt className="font-bold text-ink">馬力</dt><dd>銘板・見積書などで確認した、1台あたりのHPを入力します。0より大きい数字が必要です。空欄の設備は概算金額を出さず、あとの「概算費用と工事」で追加入力できます。</dd></div>
                        <div><dt className="font-bold text-ink">設備を分けるとき</dt><dd>種類や設置年が違う空調は分けて登録します。まとめると、古い設備の削減余地が新しい設備で薄まり、更新の優先順位が出せなくなります。</dd></div>
                      </dl>
                      {reasons.length > 0 && (
                        <ul className="space-y-3 border-t border-ink-line pt-3">
                          {reasons.map((r) => <li key={r}><span className="font-bold text-ink">{UNRESOLVED_REASON_LABEL[r]}</span>／{UNRESOLVED_REASON_NOTE[r]}</li>)}
                        </ul>
                      )}
                    </div>
                  </details>

                  {/* ── 任意の詳細 ── */}
                  <details className="rounded-2xl border border-ink-line bg-paper-tint">
                    <summary className="min-h-[48px] flex items-center px-4 text-[16px] leading-[1.7] font-semibold text-ink cursor-pointer">
                      メーカー・型番を入れる（任意）
                    </summary>
                    <div className="px-4 pb-4 pt-1 space-y-3">
                      <p className="text-[14px] leading-[1.7] text-ink-soft">
                        銘板で分かる範囲だけ入力してください。
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field labelSize="md" label="メーカー">
                          <Input
                            placeholder="例: ダイキン"
                            value={g.maker ?? ""}
                            onChange={(e) => patch(g.id, { maker: toTextOrNull(e.target.value) })}
                          />
                        </Field>
                        <Field labelSize="md" label="シリーズ・セット型番">
                          <Input
                            placeholder="例: FIVE STAR ZEAS"
                            value={g.modelSet ?? ""}
                            onChange={(e) =>
                              patch(g.id, { modelSet: toTextOrNull(e.target.value) })
                            }
                          />
                        </Field>
                        <Field labelSize="md" label="室内機の型番">
                          <Input
                            placeholder="例: SZRC80BYT"
                            value={g.modelIndoor ?? ""}
                            onChange={(e) =>
                              patch(g.id, { modelIndoor: toTextOrNull(e.target.value) })
                            }
                          />
                        </Field>
                        <Field labelSize="md" label="室外機の型番">
                          <Input
                            placeholder="例: RZRP80BYT"
                            value={g.modelOutdoor ?? ""}
                            onChange={(e) =>
                              patch(g.id, { modelOutdoor: toTextOrNull(e.target.value) })
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  </details>

                </div>
              )}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={addGroup}
        className="min-h-[48px] w-full flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[#57685e] bg-paper-card text-[16px] leading-[1.7] font-bold text-ink hover:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        設備を追加する
      </button>
      <p className="text-[14px] leading-[1.7] text-ink-soft">
        種類や設置年が違う空調は、設備を分けて入力してください。
      </p>

      <PlannedUnitsInput
        plans={state.plannedUnits}
        onChange={(plannedUnits) => onChange({ ...state, plannedUnits })}
      />
    </section>
  );
}

/* ───────────────────────────────────────────────────────────
   導入予定機器（EHC-0039 v2 §2 / 2026-09-16）

   ■ 上の「お使いの空調」と別に聞く理由
   　　上で聞いているのは**撤去する機械の銘板**である。
   　　補助の対象になるのは入れる機械のほうなので、
   　　上の型番が対象製品一覧に載っていても何の根拠にもならない。
   　　同じ欄に混ぜると、その取り違えがそのまま判定に入る。

   ■ ここはチェックボックスを置かない
   　　「対象製品一覧に載っています」を利用者に自己申告させない。
   　　利用者は一覧を見ていないし、見る義務もない。
   　　照合するのはEHC担当者で、その記録をサーバが持つ。
   　　この画面が聞くのは「何を入れる予定か」だけ。

   ■ 未定のまま進めること
   　　更新後の機種が決まっていないのは正常な状態である。
   　　未定を理由に先へ進めない作りにしない。
   ─────────────────────────────────────────────────────────── */

const PLAN_KIND_OPTIONS: { value: SelectableKind; label: string }[] = [
  { value: "room", label: "ルームエアコン" },
  { value: "ac", label: "業務用パッケージ" },
  { value: "multi", label: "ビル用マルチ" },
  { value: "unknown", label: "分からない" },
];

function PlannedUnitsInput({
  plans,
  onChange,
}: {
  plans: PlannedUnit[];
  onChange: (next: PlannedUnit[]) => void;
}) {
  const patch = (id: string, changes: Partial<PlannedUnit>) =>
    onChange(plans.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  return (
    <details className="rounded-3xl border border-ink-line bg-paper-tint">
      <summary className="min-h-[48px] flex items-center px-4 text-[16px] leading-[1.7] font-semibold text-ink cursor-pointer">
        入れ替える機種が決まっている場合（任意）
        {plans.length > 0 && (
          <span className="ml-2 text-[14px] font-normal text-ink-soft">{plans.length}台</span>
        )}
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-3">
        <p className="text-[14px] leading-[1.7] text-ink-soft">
          入れ替える機種が決まっていれば入力してください。未定でも進めます。
        </p>
        <details>
          <summary className="min-h-[48px] cursor-pointer text-[14px] leading-[1.7] text-ink-soft">対象製品の照合について</summary>
          <p className="pb-3 text-[14px] leading-[1.7] text-ink-soft">
            上で伺ったのは、いま付いている（撤去する）機械です。補助の対象になるのは
            <span className="font-bold text-ink">これから入れる機械</span>
            のほうなので、別に伺います。型番が分かると、EHCの担当者が公募要領の対象製品一覧と
            照合し、その出典と確認日を結果の画面に表示します。
          </p>
        </details>

        {plans.length > 0 && (
          <ol className="space-y-3">
            {plans.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-ink-line bg-paper-card p-3">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[16px] font-bold leading-[1.7] text-ink">
                    導入予定 {i + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => onChange(plans.filter((x) => x.id !== p.id))}
                    className="min-h-[48px] px-3 inline-flex items-center rounded-xl text-ink-soft hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">導入予定 {i + 1} を削除</span>
                  </button>
                </div>

                <fieldset className="mt-1">
                  <legend className="text-[14px] leading-[1.7] text-ink-soft mb-1">
                    入れる機械の種類
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {PLAN_KIND_OPTIONS.map((opt) => {
                      const checked = p.equipKind === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={cn(
                            "min-h-[48px] px-3 inline-flex items-center rounded-2xl border-[1.5px] text-[16px] leading-[1.7] cursor-pointer",
                            checked
                              ? "border-brand bg-paper-tint font-bold text-ink"
                              : "border-[#57685e] bg-paper-card text-ink hover:border-brand",
                            "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand"
                          )}
                        >
                          <input
                            type="radio"
                            name={`plan-kind-${p.id}`}
                            value={opt.value}
                            checked={checked}
                            onChange={() => patch(p.id, { equipKind: opt.value })}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field labelSize="md" label="メーカー">
                    <Input
                      placeholder="例: ダイキン"
                      value={p.maker ?? ""}
                      onChange={(e) => patch(p.id, { maker: toTextOrNull(e.target.value) })}
                    />
                  </Field>
                  <Field
                    labelSize="md"
                    label="導入予定の型番"
                    help="見積書やカタログに書かれている、これから入れる機械の型番です。"
                  >
                    <Input
                      placeholder="例: SZRC80BYT"
                      value={p.model ?? ""}
                      onChange={(e) => patch(p.id, { model: toTextOrNull(e.target.value) })}
                    />
                  </Field>
                </div>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={() => onChange([...plans, newPlannedUnit(newEquipGroupId())])}
          className="min-h-[48px] w-full flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[#57685e] bg-paper-card text-[16px] leading-[1.7] font-bold text-ink hover:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          導入予定の機種を追加する
        </button>
      </div>
    </details>
  );
}
