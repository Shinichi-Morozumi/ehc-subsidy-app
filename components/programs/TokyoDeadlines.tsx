"use client";

/* v1 / 2026-10-29 / EHC-0102 /tokyo の締切ボード（東京都の3制度だけ）。今日は開いた端末で取り直す。 */

import { useTodayJst } from "@/lib/useToday";
import { DeadlineBoard } from "./DeadlineBoard";

export function TokyoDeadlines({ initialToday }: { initialToday: string }) {
  const today = useTodayJst(initialToday);
  return <DeadlineBoard today={today} ids={["tokyoZeroemi", "tokyoChiiki", "tokyoKaishu"]} title="東京都の締切" />;
}
