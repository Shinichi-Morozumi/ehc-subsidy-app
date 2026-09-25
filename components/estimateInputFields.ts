// EHC-0043 / 2026-09-17: 概算段の不足入力。金額・適格性は判定しない。
import type { DiagnosisEquipGroup } from "@/lib/diagnosisState";
import type { EquipProjection } from "@/lib/diagnosisProjection";
import { pricedGroupsOf } from "@/lib/diagnosisSnapshot";

export type EstimateNumberField = "units" | "installYear" | "hp";
export type EstimateGroupPatch = { id: string; values: Partial<Pick<DiagnosisEquipGroup, EstimateNumberField>> };

export const ESTIMATE_FIELD_LABEL: Record<EstimateNumberField, string> = {
  units: "室内機の台数（台）",
  installYear: "設置年（西暦）",
  hp: "1台あたりの馬力（HP）",
};

export function missingEstimateInputs(groups: DiagnosisEquipGroup[], projection: EquipProjection) {
  const pricedIds = new Set(pricedGroupsOf(projection.equipGroups).map((g) => g.id));
  return groups.flatMap((group, index) => {
    // 家庭用・種類不明を、数字だけで業務用の試算へ変えない。
    if (group.kind !== "ac" && group.kind !== "multi") return [];
    const reasons = projection.unresolvedGroups.find((u) => u.group.id === group.id)?.reasons ?? [];
    const fields: EstimateNumberField[] = [];
    if (reasons.includes("units_missing")) fields.push("units");
    if (reasons.includes("install_year_missing")) fields.push("installYear");
    if (!pricedIds.has(group.id) && (group.hp == null || !Number.isFinite(group.hp) || group.hp <= 0)) fields.push("hp");
    return fields.length ? [{ group, index, fields }] : [];
  });
}

export function parseEstimateNumber(field: EstimateNumberField, raw: string, currentYear: number): { value: number | null; error?: string } {
  if (raw.trim() === "") return { value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { value: null, error: "0より大きい数字を入力してください。分からない場合は空欄にしてください。" };
  if (field === "units" && !Number.isInteger(value)) return { value: null, error: "台数は1以上の整数で入力してください。" };
  if (field === "installYear" && (!Number.isInteger(value) || value < 1970 || value > currentYear)) return { value: null, error: `設置年は1970〜${currentYear}年で入力してください。` };
  return { value };
}

export function applyEstimateGroupPatches(groups: DiagnosisEquipGroup[], patches: EstimateGroupPatch[]) {
  return groups.map((group) => {
    const patch = patches.find((p) => p.id === group.id);
    return patch ? { ...group, ...patch.values } : group;
  });
}
