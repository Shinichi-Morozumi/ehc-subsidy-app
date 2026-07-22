"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Radio, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { JGrantsSubsidy, assessPrep, PrepVerdict } from "@/lib/jgrants";

const ALL_PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const VERDICT_STYLE: Record<PrepVerdict, string> = {
  ample: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  rush: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  tight: "bg-red-500/15 text-red-300 border-red-400/30",
  closed: "bg-slate-500/15 text-slate-400 border-white/10",
};

function yen(n: number | null): string {
  if (n == null) return "要確認";
  if (n >= 100000000) return `${(n / 100000000).toFixed(n % 100000000 === 0 ? 0 : 1)}億円`;
  if (n >= 10000) return `${(n / 10000).toLocaleString()}万円`;
  return `${n.toLocaleString()}円`;
}

interface ApiResponse {
  updatedAt: string;
  count: number;
  items: JGrantsSubsidy[];
  error?: string;
}

export function JGrantsLive() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pref, setPref] = useState<string>("すべて");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/subsidies/live");
        const json = (await res.json()) as ApiResponse;
        if (!alive) return;
        setData(json);
        setFailed(!!json.error || json.items.length === 0);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (pref === "すべて") return items;
    return items.filter((it) => it.area === "全国" || it.area.includes(pref));
  }, [data, pref]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <CardTitle icon={<Radio className="w-5 h-5" />}>
          Jグランツ 最新公募（受付中・自動取得）
        </CardTitle>
        <span className="text-[10px] px-2 py-1 rounded-md bg-ehc-500/15 text-ehc-300 border border-ehc-400/30 font-semibold flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> 常に最新
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        デジタル庁「Jグランツ」公開APIから、空調設備が対象になり得る受付中補助金を自動取得しています。
        締切までの残日数から、EHCの標準準備期間（約5週間）で申請が間に合うかを判定します。
      </p>

      <div className="flex items-center gap-2 mb-4 no-print">
        <label className="text-xs text-slate-400">対象地域:</label>
        <select
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          className="text-xs bg-night-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200"
        >
          <option value="すべて">すべて（全国＋各都道府県）</option>
          {ALL_PREFS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-xs text-slate-400 py-6 text-center flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> 最新の公募情報を取得中…
        </div>
      )}

      {!loading && failed && (
        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            現在Jグランツから最新情報を取得できませんでした。下の補助金データベース（EHC精査済み）をご覧ください。
          </span>
        </div>
      )}

      {!loading && !failed && (
        <>
          {filtered.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              選択した地域で受付中の該当公募はありません。「すべて」または他の地域をお試しください。
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((it) => {
                const prep = assessPrep(it.acceptanceEnd);
                return (
                  <div
                    key={it.id}
                    className="border border-white/10 rounded-xl p-4 bg-gradient-to-br from-cobalt-600/10 to-night-900 hover:shadow-card transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-cobalt-200 leading-snug">{it.title}</h3>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-md border font-semibold whitespace-nowrap ${VERDICT_STYLE[prep.verdict]}`}
                      >
                        {prep.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-1.5">
                      <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">地域: {it.area}</span>
                      <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">上限: {yen(it.maxLimit)}</span>
                      <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">従業員: {it.employees}</span>
                      {it.acceptanceEnd && (
                        <span className="bg-night-900 border border-white/10 px-2 py-0.5 rounded-md">
                          締切: {new Date(it.acceptanceEnd).toLocaleDateString("ja-JP")}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">{prep.note}</p>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-print inline-flex items-center gap-1 text-[11px] text-ehc-300 hover:text-ehc-200 mt-2 font-medium"
                    >
                      Jグランツで詳細・申請要件を見る <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
          {data?.updatedAt && (
            <p className="text-[10px] text-slate-600 mt-3">
              取得日時: {new Date(data.updatedAt).toLocaleString("ja-JP")}（最大6時間キャッシュ）／出典: デジタル庁 Jグランツ公開API
            </p>
          )}
        </>
      )}
    </Card>
  );
}
