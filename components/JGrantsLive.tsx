"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Radio, ExternalLink, RefreshCw, AlertCircle } from "lucide-react";
import { JGrantsSubsidy, assessPrep, PrepVerdict } from "@/lib/jgrants";
import { ChatTriggerButton, EligibilityChatModal, EligQuestion } from "./SubsidyDBChat";

// Jグランツ項目は要件が構造化されていないため、取得できる項目＋一般要件を質問化する
function buildJGrantsQuestions(it: JGrantsSubsidy): EligQuestion[] {
  const qs: EligQuestion[] = [];
  if (it.area && it.area !== "全国") {
    qs.push({
      key: "area",
      text: `貴社の事業所（設置場所）は「${it.area}」にありますか？`,
      help: "エアコンを設置する建物の住所で判断します（本社の場所ではありません）。対象エリア外だと、この補助金は使えません。",
      choices: [
        { label: "対象エリア内に設置する", answer: "yes" },
        { label: "対象エリア外に設置する", answer: "no" },
        { label: "住所を確認していない", answer: "unknown" },
      ],
    });
  }
  if (it.employees && !/なし|制限なし|不問/.test(it.employees)) {
    qs.push({
      key: "emp",
      text: `従業員規模の条件「${it.employees}」に当てはまりますか？`,
      help: "会社の従業員数の条件です。パート・アルバイトを除いた常時使用する従業員の人数が目安になります。判断に迷う場合は「わからない」で大丈夫です。",
      choices: [
        { label: "条件の人数に収まっている", answer: "yes" },
        { label: "条件を超えている", answer: "no" },
        { label: "わからない（EHCが確認）", answer: "unknown" },
      ],
    });
  }
  qs.push({
    key: "equip",
    text: "導入予定の設備は、本補助金の対象（高効率空調など）に該当しますか？",
    help: "省エネ性能の高い業務用エアコンなどが対象です。カタログの省エネ基準達成率やAPFで判断しますが、EHCが対象機種を選定できます。",
    choices: [
      { label: "高効率の業務用空調を入れる", answer: "yes" },
      { label: "対象外の設備かもしれない", answer: "no" },
      { label: "わからない（EHCが選定）", answer: "unknown" },
    ],
  });
  qs.push({
    key: "plan",
    text: "補助対象経費の見積書・事業計画を準備できますか？",
    help: "申請には設備の見積書と、簡単な省エネ計画書が必要です。作成はEHCが代行できますので、今なくても問題ありません。",
    choices: [
      { label: "用意できる／EHCに任せる", answer: "yes" },
      { label: "用意が難しい", answer: "no" },
      { label: "わからない", answer: "unknown" },
    ],
  });
  return qs;
}

function JGrantsChat({ it }: { it: JGrantsSubsidy }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ChatTriggerButton onClick={() => setOpen(true)} />
      {open && (
        <EligibilityChatModal
          title={it.title}
          questions={buildJGrantsQuestions(it)}
          footerNote="※ 詳細な要件・対象経費は公募要領で異なります。「Jグランツで詳細を見る」で最新の要件を必ずご確認ください。"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

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
      <p className="text-[11px] text-slate-500 mb-2">
        デジタル庁「Jグランツ」公開APIから、空調設備が対象になり得る受付中補助金を自動取得しています。
        締切までの残日数から、EHCの標準準備期間（約5週間）で申請が間に合うかを判定します。
      </p>
      <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          ※ SII省エネ補助金・先進的省エネ投資促進支援などの主要補助金はJグランツ非掲載（SII独自ポータルで公募）のため、ここには表示されません。
          これらは下の<strong className="text-amber-200">「業務用空調向け 補助金データベース（EHC精査済み）」</strong>でご確認ください。
        </span>
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
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <JGrantsChat it={it} />
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-print inline-flex items-center gap-1 text-[11px] text-ehc-300 hover:text-ehc-200 font-medium"
                      >
                        Jグランツで詳細・申請要件を見る <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
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
