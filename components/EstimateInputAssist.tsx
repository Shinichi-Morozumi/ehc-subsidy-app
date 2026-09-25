"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, PencilLine } from "lucide-react";
import type { DiagnosisEquipGroup } from "@/lib/diagnosisState";
import type { EquipProjection } from "@/lib/diagnosisProjection";
import { Input } from "./ui/Field";
import { ESTIMATE_FIELD_LABEL, missingEstimateInputs, parseEstimateNumber, type EstimateGroupPatch } from "./estimateInputFields";

const PRIMARY = "min-h-[48px] rounded-2xl bg-brand px-4 py-3 text-[16px] font-bold leading-[1.7] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep";
const SECONDARY = "min-h-[48px] rounded-2xl border border-ink-line bg-paper-card px-4 py-3 text-[16px] font-bold leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep";

export function EstimateInputAssist({ groups, projection, onApply, onEditEquipment, onConsult }: {
  groups: DiagnosisEquipGroup[];
  projection: EquipProjection;
  onApply: (patches: EstimateGroupPatch[]) => void;
  onEditEquipment: () => void;
  onConsult?: () => void;
}) {
  const id = useId();
  const statusRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const missing = missingEstimateInputs(groups, projection);
  const needsKind = projection.unresolvedGroups.some((u) => u.reasons.includes("kind_unselected") || u.reasons.includes("kind_unknown"));
  const count = missing.reduce((n, item) => n + item.fields.length, 0);
  const currentYear = new Date().getFullYear();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    let entered = 0;
    const patches = missing.map(({ group, fields }) => {
      const patch: EstimateGroupPatch = { id: group.id, values: {} };
      fields.forEach((field) => {
        const key = `${group.id}-${field}`;
        const result = parseEstimateNumber(field, values[key] ?? "", currentYear);
        if (result.error) nextErrors[key] = result.error;
        else {
          patch.values[field] = result.value;
          if (result.value != null) entered += 1;
        }
      });
      return patch;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => document.getElementById(`${id}-${Object.keys(nextErrors)[0]}`)?.focus());
      return;
    }
    if (!entered) {
      setMessage("入力できる数字がなければ、空欄のまま相談へ進めます。仮の数字は入れません。");
      return;
    }
    onApply(patches);
    setEditing(false);
    setMessage(`${entered}項目を設備情報に反映しました。概算と診断書も同じ入力を使います。未入力の設備は、引き続き概算に含めません。`);
    requestAnimationFrame(() => {
      statusRef.current?.focus({ preventScroll: true });
      statusRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }

  if (!count && !needsKind && !message) return null;

  return (
    <div className="ehc-estimate-assist space-y-4">
      <div ref={statusRef} tabIndex={-1} role="status" className={message ? "scroll-mt-24 rounded-2xl border border-ink-line bg-paper-tint p-4 text-[14px] leading-[1.7] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" : ""}>
        {message && <span className="flex items-start gap-2"><CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />{message}</span>}
      </div>
      {count > 0 ? (
        <section aria-labelledby={`${id}-heading`} className="rounded-2xl border border-brand/40 bg-paper-tint p-4 sm:p-5">
          <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-brand-deep"><PencilLine aria-hidden className="h-4 w-4" />概算に必要・あと{count}項目</p>
          <h3 id={`${id}-heading`} className="text-[20px] font-bold leading-[1.5] text-ink">不足している数字を<br className="sm:hidden" />入力しますか？</h3>
          <p className="mt-2 text-[16px] leading-[1.7] text-ink-soft">ここで追加できます。未入力の設備は金額に含めません。</p>
          {!editing ? (
            <>
              <ul className="my-4 space-y-2 text-[14px] leading-[1.7] text-ink">
                {missing.map(({ group, index, fields }) => <li key={group.id}>設備{index + 1}：{fields.map((field) => ESTIMATE_FIELD_LABEL[field]).join("・")}</li>)}
              </ul>
              <button type="button" className={`${PRIMARY} flex w-full items-center justify-center gap-2`} aria-expanded={false} aria-controls={`${id}-form`} onClick={() => { setValues({}); setErrors({}); setMessage(""); setEditing(true); }}>数字を入力して概算を出す<ArrowRight aria-hidden className="h-5 w-5 shrink-0" /></button>
            </>
          ) : (
            <form id={`${id}-form`} onSubmit={submit} noValidate className="mt-4 space-y-4">
              {missing.map(({ group, index, fields }, groupIndex) => (
                <fieldset key={group.id} className="min-w-0 rounded-2xl border border-ink-line bg-paper-card p-4">
                  <legend className="px-1 text-[16px] font-bold text-ink">設備{index + 1}：{group.kind === "multi" ? "ビル用マルチ" : "業務用パッケージ"}</legend>
                  <p className="mb-3 text-[14px] leading-[1.7] text-ink-soft">{group.units != null && group.units > 0 ? `室内機${group.units}台` : "台数 未入力"} ／ {group.installYear != null ? `${group.installYear}年設置` : "設置年 未入力"}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field, fieldIndex) => {
                      const key = `${group.id}-${field}`;
                      const fieldId = `${id}-${key}`;
                      return <div key={field}>
                        <label htmlFor={fieldId} className="mb-2 block text-[16px] font-bold leading-[1.7] text-ink">{ESTIMATE_FIELD_LABEL[field]}</label>
                        <Input className="w-full min-w-0" id={fieldId} aria-describedby={`${fieldId}-hint${errors[key] ? ` ${fieldId}-error` : ""}`} aria-invalid={!!errors[key]} autoFocus={groupIndex === 0 && fieldIndex === 0} type="number" inputMode={field === "hp" ? "decimal" : "numeric"} min={field === "installYear" ? 1970 : field === "units" ? 1 : 0} max={field === "installYear" ? currentYear : undefined} step={field === "hp" ? "any" : 1} placeholder="分からなければ空欄" value={values[key] ?? ""} onChange={(e) => { setValues((prev) => ({ ...prev, [key]: e.target.value })); setErrors((prev) => ({ ...prev, [key]: "" })); }} />
                        <p id={`${fieldId}-hint`} className="mt-2 text-[14px] leading-[1.7] text-ink-soft">{field === "hp" ? "銘板・見積書で確認できます。kWや系統全体の能力を、そのまま入力しないでください。" : field === "units" ? "部屋に付いている室内機の数です。室外機の数・系統数とは別です。" : "設置記録などで確認した年を入力してください。分からない場合は空欄で構いません。"}</p>
                        {errors[key] && <p id={`${fieldId}-error`} className="mt-2 text-[14px] font-bold leading-[1.7] text-amber-800">{errors[key]}</p>}
                      </div>;
                    })}
                  </div>
                </fieldset>
              ))}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" className={`${PRIMARY} flex-1`}>入力を反映して概算を見る</button>
                <button type="button" className={SECONDARY} onClick={() => { setEditing(false); setMessage(""); }}>入力せず閉じる</button>
              </div>
            </form>
          )}
          {onConsult && <button type="button" className="mt-2 min-h-[48px] w-full rounded-xl px-2 py-3 text-[14px] font-bold leading-[1.7] text-ink underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" onClick={onConsult}>分からないので、このまま相談へ</button>}
          <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">空欄を仮の数字や0円に置き換えて計算しません。</p>
        </section>
      ) : null}
      {needsKind && <div className="rounded-2xl border border-ink-line bg-paper-sub p-4">
        <p className="text-[16px] font-bold leading-[1.7] text-ink">設備の種類が分かれば、追加で確認できます</p>
        <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">種類が未選択・不明の設備は、数字だけでは概算を出せません。分からないまま相談へ進んでも大丈夫です。</p>
        <button type="button" className={`${SECONDARY} mt-3 w-full`} onClick={onEditEquipment}>設備の種類を確認する</button>
        {!count && onConsult && <button type="button" className={`${SECONDARY} mt-2 w-full`} onClick={onConsult}>分からないので、このまま相談へ</button>}
      </div>}
    </div>
  );
}
