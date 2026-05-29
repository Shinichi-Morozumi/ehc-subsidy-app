import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtYen = (manYen: number) =>
  "¥" + (manYen * 10000).toLocaleString("ja-JP");

export const fmtMan = (manYen: number) =>
  manYen.toLocaleString("ja-JP") + "万円";
