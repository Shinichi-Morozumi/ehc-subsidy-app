"use client";

/* ───────────────────────────────────────────────────────────
   対象製品の確認記録の入力フォーム（EHC-0039 v2 §2 / 2026-09-16 v1）

   ■ この画面が守ること
   　　1. 制度・年度・枠・設備群は選択にする。手で打たせるとキーがずれ、
   　　   ずれた記録は照合で効かない（stale）。効かない記録を作らせない。
   　　2. 出典・確認日・確認主体は必須。サーバが validateCheck で弾くが、
   　　   弾かれてから気づくのでは遅いので、ここでも先に言う。
   　　3. 「登録されていない」「判断できなかった」も同じ重さで記録させる。
   　　   確認済みだけを集めると、見た結果の半分が消える。
   　　4. 合言葉はこの画面に保存しない。入れた分はメモリに置くだけで、
   　　   再読み込みすれば消える。
   ─────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";

interface Option {
  id: string;
  name: string;
  /* 2026-09-16 台帳#32。枠は制度ごとに1件以上。2件以上ある制度
     （SII GX設備単位型のメーカー強化枠／トップ性能枠）では、
     担当者がどちらの一覧を見たのかを選ぶ。選ばせないと、
     片方の枠で見た記録が制度全体の確認済みへ繰り上がる。 */
  frames: string[];
  /* 2026-09-16 台帳#32。この制度の照合年度。
     「今日の年度」ではない（SII は令和7年度補正の事業で、
     3次公募の受付だけが翌年度に行われる）。 */
  fiscalYear: number;
  kinds: string[];
}

const KIND_LABEL: Record<string, string> = {
  room: "ルームエアコン",
  ac: "業務用パッケージエアコン",
  multi: "ビル用マルチエアコン",
};

const VERDICT_LABEL: Record<string, string> = {
  listed: "対象製品一覧に登録されていることを確認した",
  not_listed: "一覧を確認した結果、登録されていない",
  inconclusive: "一覧を確認したが判断できなかった",
};

export default function TargetProductAdmin({
  options,
  today,
  todayFiscalYear,
}: {
  options: Option[];
  today: string;
  /** 今日（JST）の会計年度。制度が年度を宣言していないときの既定値。
      表示にだけ使う（記録に入る年度は制度ごとの current.fiscalYear）。 */
  todayFiscalYear: number;
}) {
  const [adminKey, setAdminKey] = useState("");
  const [subsidyId, setSubsidyId] = useState(options[0]?.id ?? "");
  const [frame, setFrame] = useState(options[0]?.frames[0] ?? "");
  const [equipKind, setEquipKind] = useState(options[0]?.kinds[0] ?? "ac");
  const [plannedModel, setPlannedModel] = useState("");
  const [officialSource, setOfficialSource] = useState("");
  const [checkedOn, setCheckedOn] = useState(today);
  const [verdict, setVerdict] = useState("listed");
  const [checkedBy, setCheckedBy] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [records, setRecords] = useState<
    Array<{ plannedModel: string; verdict: string; checkedOn: string; checkedBy: string }>
  >([]);

  const current = useMemo(
    () => options.find((o) => o.id === subsidyId) ?? options[0],
    [options, subsidyId]
  );
  /* 記録に入る年度は制度ごとに決まる。画面が「今日の年度」で記録すると、
     照合側（targetProductKeyOf）とキーが一致せず、入れた記録が効かない。 */
  const fiscalYear = current?.fiscalYear ?? todayFiscalYear;

  /* 制度を変えたら設備群も枠も、その制度のものへ入れ直す。
     残しておくと「この制度の対象ではない群」「他制度の枠」の記録ができる。 */
  function chooseSubsidy(id: string) {
    setSubsidyId(id);
    const o = options.find((x) => x.id === id);
    if (o && !o.kinds.includes(equipKind)) setEquipKind(o.kinds[0] ?? "ac");
    if (o && !o.frames.includes(frame)) setFrame(o.frames[0] ?? "");
  }

  function localProblems(): string[] {
    const bad: string[] = [];
    if (!adminKey.trim()) bad.push("担当者用の合言葉が空です");
    if (!frame.trim()) bad.push("申請枠が選ばれていません");
    if (current && !current.frames.includes(frame)) {
      bad.push("選ばれている申請枠が、この制度の枠ではありません");
    }
    if (!plannedModel.trim()) bad.push("導入予定型番が空です（既設機の型番ではありません）");
    if (!officialSource.trim()) bad.push("公式出典が空です（一覧のURL・PDF名と版）");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) bad.push("確認日が YYYY-MM-DD ではありません");
    if (!checkedBy.trim()) bad.push("確認した方の氏名・部署が空です");
    return bad;
  }

  async function submit() {
    const bad = localProblems();
    setProblems(bad);
    setMessage(null);
    if (bad.length) return;

    setBusy(true);
    try {
      const r = await fetch("/api/admin/target-product", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ehc-admin-key": adminKey },
        body: JSON.stringify({
          subsidyId,
          fiscalYear,
          frame,
          equipKind,
          plannedModel,
          officialSource,
          checkedOn,
          verdict,
          checkedBy,
          note,
        }),
      });
      const json = (await r.json()) as {
        error?: string;
        problems?: string[];
        count?: number;
      };
      if (!r.ok) {
        setMessage(json.error ?? `保存できませんでした（HTTP ${r.status}）。`);
        setProblems(json.problems ?? []);
        return;
      }
      setMessage(
        `保存しました。この制度・${fiscalYear}年度の記録は ${json.count ?? "?"} 件になりました。`
      );
      setPlannedModel("");
      setNote("");
      await load();
    } catch (e) {
      setMessage(`保存できませんでした（${e instanceof Error ? e.message : "原因不明"}）。`);
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    if (!adminKey.trim()) {
      setMessage("担当者用の合言葉を入れてください。");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(
        `/api/admin/target-product?subsidyId=${encodeURIComponent(
          subsidyId
        )}&fiscalYear=${fiscalYear}`,
        { headers: { "x-ehc-admin-key": adminKey } }
      );
      const json = (await r.json()) as {
        error?: string;
        checks?: Array<{
          plannedModel: string;
          verdict: string;
          checkedOn: string;
          checkedBy: string;
        }>;
      };
      if (!r.ok) {
        setMessage(json.error ?? `読み出せませんでした（HTTP ${r.status}）。`);
        setRecords([]);
        return;
      }
      setRecords(json.checks ?? []);
      setMessage(null);
    } catch (e) {
      setMessage(`読み出せませんでした（${e instanceof Error ? e.message : "原因不明"}）。`);
    } finally {
      setBusy(false);
    }
  }

  /* 罫線の色トークンは tailwind.config.ts では ink.line。したがって正しい
     クラス名は border-ink-line。ink を抜いた名前は存在せず、書いても枠線が
     出ない（Tailwind は未定義クラスを黙って無視する）。v31 の GUARD は
     app / components を生のまま走査するので、ここに誤った字面を例として
     書くとコメントでも拾われる。だから例は書かない。 */
  const field = "w-full min-h-[48px] rounded-2xl border border-ink-line px-4 py-3 text-base";
  const label = "block text-base font-bold text-ink mb-1.5";
  const help = "text-sm/[1.7] text-ink-soft leading-[1.7] mb-2";

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">対象製品の確認記録</h1>
      <p className="mt-2 text-base leading-[1.8] text-ink-soft">
        公募要領と対象製品一覧を実際にご覧になった結果を、1台ぶんずつ残す画面です。
        ここに入った記録だけが、診断画面の「登録済みを確認しました」の根拠になります。
        お客様側から確認済みにする経路はありません。
      </p>
      <p className="mt-2 text-sm/[1.7] leading-[1.7] text-ink-soft">
        照合する年度：<span className="font-bold text-ink tabular-nums">{fiscalYear}年度</span>
        {fiscalYear === todayFiscalYear
          ? `（本日 ${today} から算出。年度が変われば一覧も入れ替わるため、前年度の記録は自動では効きません）`
          : `（この制度が属する年度です。本日 ${today} の年度は ${todayFiscalYear}年度ですが、この制度は補正予算の事業で、公募の受付だけが翌年度に行われます。見る一覧は ${fiscalYear}年度のものです）`}
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <label className={label} htmlFor="k">
            担当者用の合言葉
          </label>
          <p className={help}>
            この画面には保存しません。再読み込みすると消えます。
          </p>
          <input
            id="k"
            type="password"
            className={field}
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
        </div>

        <div>
          <label className={label} htmlFor="s">
            制度
          </label>
          <select
            id="s"
            className={field}
            value={subsidyId}
            onChange={(e) => chooseSubsidy(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          {(current?.frames.length ?? 0) > 1 ? (
            <>
              <label className={label} htmlFor="f">
                申請枠
              </label>
              <p className={help}>
                この制度は枠ごとに補助率も対象製品一覧も違います。
                ご覧になった一覧の枠をお選びください。選び違えると、その記録は照合で効きません。
                枠が確定していない案件では、診断画面は「枠未確定」のままになります。
              </p>
              <select
                id="f"
                className={field}
                value={frame}
                onChange={(e) => setFrame(e.target.value)}
              >
                {(current?.frames ?? []).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <p className={label}>申請枠</p>
              <p className="text-base leading-[1.8] text-ink">{frame}</p>
            </>
          )}
        </div>

        <div>
          <label className={label} htmlFor="e">
            どの設備群として照合したか
          </label>
          <p className={help}>
            この制度が対象とする群だけを選べます。一覧が別なので、
            別の群の記録として残すと照合で効きません。
          </p>
          <select
            id="e"
            className={field}
            value={equipKind}
            onChange={(e) => setEquipKind(e.target.value)}
          >
            {(current?.kinds ?? []).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k] ?? k}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="m">
            導入予定の型番
          </label>
          <p className={help}>
            これから入れる機械の型番です。いま付いている機械の型番ではありません。
          </p>
          <input
            id="m"
            className={field}
            value={plannedModel}
            onChange={(e) => setPlannedModel(e.target.value)}
            placeholder="例）RXUP335DAE"
          />
        </div>

        <div>
          <label className={label} htmlFor="o">
            公式出典
          </label>
          <p className={help}>
            対象製品検索の結果URL、または公募要領のPDF名と版。
            「一覧で見た」だけでは、後から同じ物を確かめられません。
          </p>
          <input
            id="o"
            className={field}
            value={officialSource}
            onChange={(e) => setOfficialSource(e.target.value)}
          />
        </div>

        <div>
          <label className={label} htmlFor="d">
            確認日
          </label>
          <input
            id="d"
            type="date"
            className={field}
            value={checkedOn}
            onChange={(e) => setCheckedOn(e.target.value)}
          />
        </div>

        <div>
          <label className={label} htmlFor="v">
            確認結果
          </label>
          <p className={help}>
            登録されていなかった場合・判断できなかった場合も残してください。
            確認済みだけを集めると、見た結果の半分が消えます。
          </p>
          <select
            id="v"
            className={field}
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
          >
            {Object.entries(VERDICT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label} htmlFor="b">
            確認した方の氏名・部署
          </label>
          <p className={help}>
            「システム」「自動」は入りません。一覧を見たのは人だからです。
          </p>
          <input
            id="b"
            className={field}
            value={checkedBy}
            onChange={(e) => setCheckedBy(e.target.value)}
          />
        </div>

        <div>
          <label className={label} htmlFor="n">
            補足（任意）
          </label>
          <input id="n" className={field} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {problems.length > 0 && (
        <div className="mt-6 rounded-3xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-base font-bold text-ink">このままでは記録になりません</p>
          <ul className="mt-2 space-y-1">
            {problems.map((p) => (
              <li key={p} className="text-sm/[1.7] leading-[1.7] text-ink-soft">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && (
        <p className="mt-6 text-base leading-[1.8] text-ink">{message}</p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-[48px] rounded-2xl bg-ink px-6 text-base font-bold text-white disabled:opacity-50"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "処理中…" : "この内容で記録する"}
        </button>
        <button
          type="button"
          className="min-h-[48px] rounded-2xl border border-ink-line px-6 text-base font-bold text-ink disabled:opacity-50"
          onClick={load}
          disabled={busy}
        >
          この制度・年度の記録を表示
        </button>
      </div>

      {records.length > 0 && (
        <div className="mt-8">
          <p className="text-base font-bold text-ink">
            {current?.name}／{fiscalYear}年度の記録（{records.length}件）
          </p>
          <ul className="mt-2 space-y-1">
            {records.map((r, i) => (
              <li
                key={`${r.plannedModel}-${r.checkedOn}-${i}`}
                className="text-sm/[1.7] leading-[1.7] text-ink-soft break-words"
              >
                {r.plannedModel}：{VERDICT_LABEL[r.verdict] ?? r.verdict}（確認日 {r.checkedOn}／
                {r.checkedBy}）
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
