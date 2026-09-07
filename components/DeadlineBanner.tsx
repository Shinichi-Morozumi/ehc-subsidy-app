"use client";
import { useEffect, useState } from "react";
import { getSubsidies } from "@/lib/subsidies";
import { AlarmClock } from "lucide-react";

// 公募中で締切が最も近い補助金を自動表示するカウントダウンバナー。
// 締切を過ぎたものは自動で消えるため、手動メンテ不要。
export function DeadlineBanner() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!now) return null;

  // 締切がまだ来ていないものを対象にする。公募開始前（applyOpen が未来）も
  // 「開始まであとN日」として表示する（見落とし防止）。
  const upcoming = getSubsidies(now).filter((s) => {
    if (s.closed || !s.applyClose) return false;
    /* 対象設備に空調が1つも含まれない制度（target が空）は、このツールのどの試算にも入らない。
       締切バナーは「この案件で使える枠の残り時間」を伝えるものなので、
       使えない制度の締切を並べると本当に効く制度の締切が埋もれる。
       （例: 埼玉県 R8 は太陽光・再エネ・コージェネが対象で業務用空調は対象外。
         2次募集は実際に受付中だが、空調更新の案件では使えない。）
       受付状態そのものは制度データ側で事実どおり持ち、ここでは表示範囲だけを絞る。 */
    if (!s.target || s.target.length === 0) return false;
    const close = new Date(`${s.applyClose}T23:59:59+09:00`);
    return close >= now;
  }).sort((a, b) => (a.applyClose! < b.applyClose! ? -1 : 1));

  if (!upcoming.length) return null;
  const withDays = upcoming.map((s) => {
    const open = s.applyOpen ? new Date(`${s.applyOpen}T00:00:00+09:00`) : null;
    const notOpenYet = !!open && open > now;
    return {
      s,
      notOpenYet,
      daysToOpen: open ? Math.ceil((open.getTime() - now.getTime()) / 86400000) : 0,
      days: Math.ceil((new Date(`${s.applyClose}T23:59:59+09:00`).getTime() - now.getTime()) / 86400000),
    };
  });
  // 締切14日以内はすべて列挙して強調。なければ最も近い1件のみ表示。
  const urgentList = withDays.filter((x) => !x.notOpenYet && x.days <= 14);
  const urgent = urgentList.length > 0;
  const shown = urgent ? urgentList : withDays.slice(0, 1);
  const fmt = (d: string) => d.replace(/^\d{4}-0?(\d+)-0?(\d+)$/, "$1/$2");

  return (
    <div
      className={`px-4 py-3 rounded-xl text-xs mb-5 flex items-start gap-2.5 no-print border ${
        urgent ? "bg-red-500/10 border-red-500/40" : "bg-ehc-500/10 border-ehc-500/30"
      }`}
    >
      <AlarmClock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${urgent ? "text-red-300" : "text-ehc-300"}`} />
      <div className="text-slate-300 space-y-1">
        {shown.map(({ s, days, notOpenYet, daysToOpen }) => (
          <div key={s.id ?? s.name}>
            <strong className={urgent ? "text-red-300" : "text-ehc-300"}>
              {notOpenYet ? "次回公募：" : "締切間近："}
            </strong>{" "}
            <strong className="text-white">{s.name}</strong> —{" "}
            {notOpenYet ? (
              <>
                受付 <strong className="text-white">{fmt(s.applyOpen!)}〜{fmt(s.applyClose!)}</strong>
                （開始まであと<strong className="text-white">{daysToOpen}日</strong>）
              </>
            ) : (
              <>
                申請締切 <strong className="text-white">{fmt(s.applyClose!)}</strong>
                （あと<strong className={urgent ? "text-red-300 text-sm" : "text-white"}>{days}日</strong>）
              </>
            )}
          </div>
        ))}
        {upcoming.length > shown.length && (
          <div className="text-slate-500">他 {upcoming.length - shown.length} 件が公募中／公募予定</div>
        )}
      </div>
    </div>
  );
}
