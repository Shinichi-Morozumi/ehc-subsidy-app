/* ───────────────────────────────────────────────────────────
   対象製品の確認経路（EHC-0039 v2 §2 / 2026-09-16 v1）

   ■ 直している事故
   　　`MatchInput.targetProductChecked` は宣言（lib/types.ts:188）と
   　　読み出し（lib/eligibility.ts:201）しか無く、true にする書き手が
   　　リポジトリ内に1つも無かった。
   　　そのため「適合は高い」は受入テストの直接入力では出るが、
   　　実画面では**永久に0件**にしかならない。
   　　v2 §2 はこれを「経路そのものが無い」FAIL として差し戻している。

   ■ 作ってはいけなかった近道（全部やらない）
   　　1. 画面にチェックボックスを置いて顧客に自己申告させる
   　　　　→ types.ts の明文（照合の主体はEHC担当者）に反する。
   　　　　　顧客は対象製品一覧を見ていないし、見る義務も無い。
   　　2. 診断入力の型番（DiagnosisEquipGroup.model*）を根拠に true にする
   　　　　→ あれは**既設機の銘板**。補助対象になるのは導入予定機器であって、
   　　　　　撤去する機械の型番が登録されていても何の意味も無い。
   　　3. クライアントが送ってきた true をサーバがそのまま信じる
   　　　　→ 判定の根拠が利用者の手元にある。検証していない。
   　　4. room を ac に読み替えて「低い」を作る
   　　　　→ AGENTS §2-4 の禁止事項。対象種別でない事実を消してはならない。

   ■ 代わりに置くもの
   　　確認を1個の boolean ではなく、**確認記録**として構造化して持つ。
   　　　制度ID / 年度 / 申請枠 / 対象設備群 / 導入予定型番 /
   　　　公式出典 / 確認日 / 確認結果 / 確認主体
   　　照合は「文脈（今どの制度・年度・枠を見ていて、何を入れる予定か）」と
   　　記録の**全キーが一致したときだけ**成立する。
   　　どれか1つでもずれれば記録は自動的に効かなくなる（＝無効化）。
   　　型番を変えた・別制度へ切り替えた・年度が変わった、のいずれでも
   　　「前に確認したから大丈夫」が続かない。

   ■ 保存先
   　　既定は「未接続」。空の記録集合を返し、connected=false を表に出す。
   　　嘘の確認済みを作らないため、ここにダミーデータを置かない。
   　　接続先（EHC担当者の照合記録）は setTargetProductStore() で差し込む。
   ─────────────────────────────────────────────────────────── */

import type { EquipKind } from "./diagnosisState";

/* ───────── 確認結果 ─────────
   「見て、載っていなかった」と「探したが見つけられなかった」を分ける。
   前者は対象外の根拠になるが、後者は未確認であって対象外ではない。 */
export type TargetProductVerdict =
  /** 当該年度の対象製品一覧に登録されていることを確認した */
  | "listed"
  /** 一覧を確認した結果、登録されていない */
  | "not_listed"
  /** 一覧を確認したが判断できなかった（型番の表記揺れ・掲載保留など） */
  | "inconclusive";

/** EHC担当者が公募要領・対象製品一覧と突き合わせた記録1件。 */
export interface TargetProductCheck {
  /** 制度ID（lib/subsidies.ts の Subsidy.id） */
  subsidyId: string;
  /** 年度（日本の会計年度。4月開始）。年度が変われば一覧も入れ替わる */
  fiscalYear: number;
  /** 申請枠。同じ制度でも枠が違えば対象製品一覧が違う */
  frame: string;
  /** 対象設備群。room / ac / multi のどれとして照合したか */
  equipKind: Exclude<EquipKind, null | "unknown">;
  /** 導入予定型番（原文）。既設機の銘板ではない */
  plannedModel: string;
  /** 公式出典。公募要領のURL・対象製品検索の結果URL・PDF名＋版のいずれか */
  officialSource: string;
  /** 確認日（YYYY-MM-DD） */
  checkedOn: string;
  /** 確認結果 */
  verdict: TargetProductVerdict;
  /** 確認主体（EHC担当者の氏名・部署）。「システム」「自動」は入れない */
  checkedBy: string;
  /** 補足（任意） */
  note?: string;
}

/* ───────── 導入予定機器 ─────────
   既設群（DiagnosisEquipGroup）とは別に持つ。
   既設は「撤去するもの」、こちらは「入れるもの」で、
   補助対象になるのは後者だから同じ配列に混ぜてはならない。 */
export interface PlannedUnit {
  /** 安定ID（配列indexを識別子にしない） */
  id: string;
  /** 入れる予定の設備群。未選択は null、分からないと答えたなら "unknown" */
  equipKind: EquipKind;
  /** 導入予定型番。未入力は null */
  model: string | null;
  /** メーカー。未入力は null */
  maker: string | null;
}

export function newPlannedUnit(id: string): PlannedUnit {
  return { id, equipKind: null, model: null, maker: null };
}

/* ───────── 照合の文脈 ───────── */
export interface TargetProductContext {
  subsidyId: string;
  fiscalYear: number;
  frame: string;
  plans: PlannedUnit[];
}

/* ───────── 1台ぶんの状態 ─────────
   「確認できた」以外を全部 unchecked に潰さない。
   潰すと、画面に出す次の一手（何をすれば進むか）が書けなくなる。 */
export type PlannedUnitStatus =
  /** 型番が未入力。まず選定が要る */
  | "model_missing"
  /** 設備群が未選択・不明。どの一覧を見ればよいか決まらない */
  | "kind_unknown"
  /** この制度の対象種別ではない群（room 等）。照合の対象にしない */
  | "kind_not_covered"
  /** 型番はあるが、この制度・年度・枠での確認記録が無い */
  | "unchecked"
  /** 記録はあるが、制度・年度・枠・群・型番のどれかがずれている（無効） */
  | "stale"
  /** 確認した結果、登録されていない */
  | "not_listed"
  /** 確認したが判断できなかった */
  | "inconclusive"
  /** 当該年度の対象製品一覧に登録されていることを確認済み */
  | "listed";

export interface PlannedUnitAssessment {
  unitId: string;
  model: string | null;
  equipKind: EquipKind;
  status: PlannedUnitStatus;
  /** 根拠として採用した記録（無ければ null） */
  check: TargetProductCheck | null;
  /** ずれていて採用しなかった記録があれば、その理由 */
  staleReason: string | null;
}

export type TargetProductStatus =
  /** 導入予定機器そのものが未選定（1台も型番が無い） */
  | "no_plan"
  /** 選定済みだが、この制度・年度・枠での確認が済んでいない台がある */
  | "unchecked"
  /** 確認した結果、登録されていない台がある */
  | "not_listed"
  /** 対象となる全台が登録済みと確認された */
  | "listed"
  /* 2026-09-16 EHC-0039 台帳#32 で追加。
     申請枠が2つ以上あり、どの枠で申請するかが決まっていない。
     枠が決まらないと見るべき対象製品一覧そのものが決まらないので、
     照合は「まだできない」。片方の枠で取った記録を制度全体へ繰り上げない。
     unchecked と分ける理由は、次の一手が違うから
     （unchecked＝担当者が一覧と突き合わせる／frame_undecided＝先に枠を決める）。 */
  | "frame_undecided";

export interface TargetProductAssessment {
  status: TargetProductStatus;
  /** eligibility.ts の `targetProductChecked` へ渡してよい値。
      listed 以外は true にしない。 */
  checked: boolean;
  units: PlannedUnitAssessment[];
  /** 画面・PDFにそのまま出せる事実の説明 */
  reason: string;
  /** 次に何をすれば進むか。未確認を出して次の一手を書かないことをしない */
  nextAction: string;
  /** 採用した記録の出典・確認日・主体（確認済みのときだけ中身が入る） */
  evidence: Array<{ model: string; officialSource: string; checkedOn: string; checkedBy: string }>;
}

/* ───────── サーバの返す形 ─────────
   app/api/target-product が返し、画面が受け取る形をここに置く。
   route.ts 側に置くと、画面（クライアント）が route を import することになり、
   サーバ専用の import が巻き込まれる。型の置き場はライブラリ側にする。 */
export interface TargetProductApiResponse {
  /** 既定の照合年度（今日＝JSTの会計年度）。
      2026-09-16 台帳#32 以降、制度が programFiscalYear を宣言していれば
      その制度はここではなく details[id].fiscalYear の年度で照合されている。
      画面に「この制度の照合年度」を出すときは details 側を使うこと。 */
  fiscalYear: number;
  checkedAt: string;
  /* reason は接続しなかったときだけ入る。「未接続です」で終わらせず、
     なぜ繋がっていないのかを画面まで運ぶ（置き場所に書けない等）。 */
  store: { name: string; connected: boolean; reason?: string };
  /** 制度ID → 対象製品一覧への登録を確認できたか（listed のときだけ true） */
  checks: Record<string, boolean>;
  /** 制度ID → 状態の説明（未確認の理由）。eligibility.ts がそのまま文言に使う */
  notes: Record<string, string>;
  /** 制度ID → 次の一手・台ごとの内訳・出典。画面の確認経路の表示に使う */
  details: Record<string, TargetProductDetail>;
}

export interface TargetProductDetail {
  status: TargetProductStatus;
  /** 照合に使った枠。枠が2つ以上あって未確定なら FRAME_UNDECIDED_LABEL */
  frame: string;
  /** 2026-09-16 台帳#32: この制度の照合年度（制度が宣言していればその年度） */
  fiscalYear: number;
  /** 2026-09-16 台帳#32: 宣言されている申請枠の全部（1件以上） */
  frames: string[];
  reason: string;
  nextAction: string;
  units: PlannedUnitAssessment[];
  evidence: TargetProductAssessment["evidence"];
}

/* ───────── 型番の正規化 ─────────
   全角→半角、英字は大文字、空白は除去。
   ハイフンは残す。RXUP335DAE と RX-UP335DAE を同じ物とみなす根拠が無い
   （メーカーによってハイフンが型番の一部）。 */
export function normalizeModel(raw: string): string {
  return raw
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\u3000\s]/g, "")
    .toUpperCase();
}

/* ───────── 申請枠 ─────────
   同じ制度でも枠が違えば対象製品一覧が違う（SII GX設備単位型の
   メーカー強化枠／トップ性能枠など）。だから枠は照合キーに要る。

   ところが現在の制度データ（lib/subsidies.ts）は枠を項目として持っていない。
   持っていないものを「無い」ことにして照合キーから外すと、
   枠をまたいで確認済みが伝播する。そこで、枠の宣言が無い制度は
   NO_FRAME_LABEL という**ひとつの明示的な枠**として扱う。

   後日 applicationFrame を宣言すれば、NO_FRAME_LABEL で取った記録は
   キー不一致になって自動的に効かなくなる（stale として理由が出る）。
   黙って通り続けるより、そのほうが正しい。 */
export const NO_FRAME_LABEL = "（枠の区分なし）";

/** 枠が2つ以上あり、まだどれで申請するか決まっていないことの表示用ラベル。
    照合キーには使わない（キーは null になり、照合そのものが止まる）。 */
export const FRAME_UNDECIDED_LABEL = "（申請枠が未確定）";

export function frameOf(s: { applicationFrame?: string }): string {
  const v = s.applicationFrame?.trim();
  return v ? v : NO_FRAME_LABEL;
}

/** 日本の会計年度（4月開始）。2026-03-31 は 2025年度、2026-04-01 は 2026年度。 */
export function fiscalYearOf(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) throw new Error(`fiscalYearOf: 日付の形式が YYYY-MM-DD ではない: ${isoDate}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 4 ? year : year - 1;
}

/* ───────── 照合キー（制度ごと） ─────────
   2026-09-16 EHC-0039 台帳#32。

   ■ 直している事故その1 ── 年度を「今日」から出していた
   　　app/api/target-product も担当者画面も fiscalYearOf(todayJst()) を使っていた。
   　　だが SII の設備単位型／GX設備単位型は**令和7年度補正予算**の事業で、
   　　3次公募の受付は 2026-08-20〜09-28（＝2026年度）に行われる。
   　　担当者が見る対象製品一覧は令和7年度補正のものなのに、
   　　記録には 2026 という年度キーが付く。
   　　実態と1年ずれたキーで保存すると、
   　　(a) 年度が替わっても記録が自動失効せず「前に確認したから大丈夫」が続く
   　　(b) 制度側が本来の年度を宣言した瞬間、全記録がキー不一致で消える
   　　のどちらかが起きる。制度が自分の年度を宣言できるようにする。

   ■ 直している事故その2 ── 複数枠が1つの枠に潰れていた
   　　sii_gx は「メーカー強化枠（1/3以内）」と
   　　「トップ性能枠（更新1/2以内・新設1/5以内）」の2枠を持つのに、
   　　制度データは1行で applicationFrame 未宣言、つまり NO_FRAME_LABEL 1枠として
   　　扱われていた。この状態でどちらか一方の枠の一覧で確認した記録を入れると、
   　　制度全体が確認済みに繰り上がる。補助率も対象製品一覧も枠ごとに別物なので、
   　　これは「A枠で確認した型番がB枠でも確認済み」という嘘になる。

   　　枠が2つ以上あるあいだは frame（照合キー）を null にし、
   　　照合そのものを frame_undecided で止める。
   　　枠が決まっていないのだから、確認できていないのが事実である。 */
export function framesOf(s: { applicationFrame?: string; applicationFrames?: string[] }): string[] {
  const many = (s.applicationFrames ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
  if (many.length) return many;
  return [frameOf(s)];
}

export interface TargetProductKey {
  /** この制度の対象製品一覧・公募要領が属する年度 */
  fiscalYear: number;
  /** 宣言されている申請枠（1件以上。宣言が無ければ NO_FRAME_LABEL 1件） */
  frames: string[];
  /** 照合キーに使う枠。枠が1つに決まるときだけ文字列、2つ以上あるあいだは null */
  frame: string | null;
}

export function targetProductKeyOf(
  s: { applicationFrame?: string; applicationFrames?: string[]; programFiscalYear?: number },
  todayIso: string
): TargetProductKey {
  const frames = framesOf(s);
  return {
    /* 宣言の無い制度は従来どおり今日の年度。
       ここで既定を「今年度」にしているのは、宣言していない制度の挙動を
       #32 以前から変えないため。宣言した制度だけが正しい年度で引かれる。 */
    fiscalYear: s.programFiscalYear ?? fiscalYearOf(todayIso),
    frames,
    frame: frames.length === 1 ? frames[0] : null,
  };
}

/** 枠が決まらないので照合できない、という結果を作る。checked は必ず false。 */
export function frameUndecidedAssessment(
  frames: string[],
  plans: PlannedUnit[]
): TargetProductAssessment {
  const units: PlannedUnitAssessment[] = plans.map((p) => {
    const base = { unitId: p.id, model: p.model, equipKind: p.equipKind, check: null, staleReason: null };
    if (!p.model || !p.model.trim()) return { ...base, status: "model_missing" as PlannedUnitStatus };
    if (p.equipKind === null || p.equipKind === "unknown") {
      return { ...base, status: "kind_unknown" as PlannedUnitStatus };
    }
    return { ...base, status: "unchecked" as PlannedUnitStatus };
  });

  return {
    status: "frame_undecided",
    checked: false,
    units,
    reason: `この制度には申請枠が${frames.length}つ（${frames.join("／")}）あり、どの枠で申請するかが決まっていません。枠によって補助率も対象製品一覧も異なるため、枠を決めないと型番の照合ができません。片方の枠で確認できた型番を、制度全体の確認済みとして扱うことはしません。`,
    nextAction: `EHC担当者が、設備の性能値と工事内容から申請枠（${frames.join("／")}）を確定します。枠が決まりしだい、その枠の対象製品一覧と導入予定型番を照合し、出典・確認日つきで表示します。`,
    evidence: [],
  };
}

/* ───────── 保存先 ─────────
   submitLedger.ts と同じ理由で非同期インターフェースにする
   （Notion / DB へ差し替えたときに呼び出し側を書き換えない）。 */
export interface TargetProductStore {
  /** その制度・年度の確認記録を全部返す。無ければ空配列 */
  list(subsidyId: string, fiscalYear: number): Promise<TargetProductCheck[]>;
  /** 記録を1件追加する。未接続の既定ストアは受け付けない */
  add(check: TargetProductCheck): Promise<void>;
  readonly name: string;
  /** 実際の確認記録に接続されているか。false の間は必ず未確認になる */
  readonly connected: boolean;
}

const notConnectedStore: TargetProductStore = {
  name: "not_connected",
  connected: false,
  async list() {
    return [];
  },
  async add() {
    throw new Error(
      "対象製品の確認記録の保存先が接続されていません。setTargetProductStore() で接続してください。"
    );
  },
};

let store: TargetProductStore = notConnectedStore;

export function setTargetProductStore(next: TargetProductStore): void {
  store = next;
}

export function resetTargetProductStore(): void {
  store = notConnectedStore;
}

export function describeTargetProductStore(): { name: string; connected: boolean } {
  return { name: store.name, connected: store.connected };
}

export async function listChecks(
  subsidyId: string,
  fiscalYear: number
): Promise<TargetProductCheck[]> {
  return store.list(subsidyId, fiscalYear);
}

export async function addCheck(check: TargetProductCheck): Promise<void> {
  const bad = validateCheck(check);
  if (bad.length) throw new Error(`確認記録が不完全です: ${bad.join(" / ")}`);
  await store.add(check);
}

/** 記録として成立しているか。空欄のまま「確認済み」を作らせない。 */
export function validateCheck(c: TargetProductCheck): string[] {
  const bad: string[] = [];
  if (!c.subsidyId?.trim()) bad.push("制度IDが空です");
  if (!Number.isInteger(c.fiscalYear)) bad.push("年度が整数ではありません");
  if (!c.frame?.trim()) bad.push("申請枠が空です");
  if (c.equipKind !== "room" && c.equipKind !== "ac" && c.equipKind !== "multi") {
    bad.push("対象設備群が room / ac / multi のいずれでもありません");
  }
  if (!c.plannedModel?.trim()) bad.push("導入予定型番が空です");
  if (!c.officialSource?.trim()) bad.push("公式出典が空です");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.checkedOn ?? "")) bad.push("確認日が YYYY-MM-DD ではありません");
  if (c.verdict !== "listed" && c.verdict !== "not_listed" && c.verdict !== "inconclusive") {
    bad.push("確認結果が listed / not_listed / inconclusive のいずれでもありません");
  }
  if (!c.checkedBy?.trim()) bad.push("確認主体が空です");
  if (/^(システム|自動|auto|system)$/i.test((c.checkedBy ?? "").trim())) {
    bad.push("確認主体が人ではありません（照合の主体はEHC担当者です）");
  }
  return bad;
}

/* ───────── 照合 ─────────
   純関数。ここに保存先も画面も持ち込まない。 */
export function assessTargetProduct(
  ctx: TargetProductContext,
  checks: TargetProductCheck[],
  /** この制度が対象とする設備群。ここに無い群は照合の対象にしない（変換もしない） */
  coveredKinds: Array<Exclude<EquipKind, null | "unknown">>
): TargetProductAssessment {
  const units: PlannedUnitAssessment[] = ctx.plans.map((p) =>
    assessOne(ctx, p, checks, coveredKinds)
  );

  const typed = units.filter((u) => u.model !== null);
  const covered = typed.filter((u) => u.status !== "kind_not_covered" && u.status !== "kind_unknown");

  let status: TargetProductStatus;
  if (!typed.length) {
    status = "no_plan";
  } else if (covered.some((u) => u.status === "not_listed")) {
    status = "not_listed";
  } else if (covered.length > 0 && covered.every((u) => u.status === "listed")) {
    status = "listed";
  } else {
    status = "unchecked";
  }

  return {
    status,
    checked: status === "listed",
    units,
    reason: reasonOf(status, units, ctx),
    nextAction: nextActionOf(status, units),
    evidence:
      status === "listed"
        ? covered
            .filter((u) => u.check)
            .map((u) => ({
              model: u.model as string,
              officialSource: (u.check as TargetProductCheck).officialSource,
              checkedOn: (u.check as TargetProductCheck).checkedOn,
              checkedBy: (u.check as TargetProductCheck).checkedBy,
            }))
        : [],
  };
}

function assessOne(
  ctx: TargetProductContext,
  p: PlannedUnit,
  checks: TargetProductCheck[],
  coveredKinds: Array<Exclude<EquipKind, null | "unknown">>
): PlannedUnitAssessment {
  const base = { unitId: p.id, model: p.model, equipKind: p.equipKind };

  if (!p.model || !p.model.trim()) {
    return { ...base, status: "model_missing", check: null, staleReason: null };
  }
  if (p.equipKind === null || p.equipKind === "unknown") {
    return { ...base, status: "kind_unknown", check: null, staleReason: null };
  }
  /* 対象種別でない群（例: この制度が業務用のみを対象とするときの room）。
     ここで ac へ読み替えない。読み替えると対象外の設備に補助額が付く。 */
  if (!coveredKinds.includes(p.equipKind)) {
    return { ...base, status: "kind_not_covered", check: null, staleReason: null };
  }

  const wantModel = normalizeModel(p.model);

  /* 型番だけ一致する記録を先に拾う。全キー一致が無かったときに
     「何がずれているのか」を書くために使う（黙って未確認にしない）。 */
  const sameModel = checks.filter((c) => normalizeModel(c.plannedModel) === wantModel);
  const exact = sameModel.filter(
    (c) =>
      c.subsidyId === ctx.subsidyId &&
      c.fiscalYear === ctx.fiscalYear &&
      c.frame === ctx.frame &&
      c.equipKind === p.equipKind
  );

  if (!exact.length) {
    if (!sameModel.length) {
      return { ...base, status: "unchecked", check: null, staleReason: null };
    }
    const s = sameModel[0];
    const diffs: string[] = [];
    if (s.subsidyId !== ctx.subsidyId) diffs.push(`制度が違います（記録: ${s.subsidyId}）`);
    if (s.fiscalYear !== ctx.fiscalYear) diffs.push(`年度が違います（記録: ${s.fiscalYear}年度）`);
    if (s.frame !== ctx.frame) diffs.push(`申請枠が違います（記録: ${s.frame}）`);
    if (s.equipKind !== p.equipKind) diffs.push(`設備群が違います（記録: ${s.equipKind}）`);
    return {
      ...base,
      status: "stale",
      check: null,
      staleReason: diffs.join("、"),
    };
  }

  /* 同じキーで複数あるときは確認日が新しいものを採る。
     古い記録で新しい否定を上書きしない。 */
  const latest = [...exact].sort((a, b) => (a.checkedOn < b.checkedOn ? 1 : -1))[0];
  const status: PlannedUnitStatus =
    latest.verdict === "listed"
      ? "listed"
      : latest.verdict === "not_listed"
      ? "not_listed"
      : "inconclusive";
  return { ...base, status, check: latest, staleReason: null };
}

function reasonOf(
  status: TargetProductStatus,
  units: PlannedUnitAssessment[],
  ctx: TargetProductContext
): string {
  const notCovered = units.filter((u) => u.status === "kind_not_covered").length;
  const tail = notCovered
    ? `（うち${notCovered}台はこの制度の対象種別ではないため、照合の対象にしていません）`
    : "";

  switch (status) {
    case "no_plan":
      return "導入予定の機器がまだ決まっていないため、対象製品一覧との照合を行っていません。既設機の型番は撤去する機械のものなので、照合の根拠にはなりません。";
    case "listed": {
      const n = units.filter((u) => u.status === "listed").length;
      return `導入予定${n}台の型番が、${ctx.fiscalYear}年度の対象製品一覧に登録されていることをEHC担当者が確認済みです${tail}。`;
    }
    case "not_listed": {
      const n = units.filter((u) => u.status === "not_listed").length;
      return `導入予定のうち${n}台が、${ctx.fiscalYear}年度の対象製品一覧に登録されていません。この型番のままでは、他の要件を満たしても補助の対象になりません${tail}。`;
    }
    default: {
      const stale = units.filter((u) => u.status === "stale");
      if (stale.length) {
        return `以前の確認記録はありますが、今回の制度・年度・枠・設備群と一致しないため使えません（${stale[0].staleReason}）。あらためて照合が必要です${tail}。`;
      }
      const incon = units.filter((u) => u.status === "inconclusive").length;
      if (incon) {
        return `対象製品一覧を確認しましたが、${incon}台については登録の有無を判断できませんでした（型番の表記揺れ等）。メーカーへの確認が必要です${tail}。`;
      }
      const unknownKind = units.filter((u) => u.status === "kind_unknown").length;
      if (unknownKind) {
        return `導入予定${unknownKind}台の設備種別が決まっていないため、どの対象製品一覧を見ればよいかが確定しません${tail}。`;
      }
      return `導入予定機器の型番が、${ctx.fiscalYear}年度の対象製品一覧に登録されているかを、まだ確認できていません${tail}。`;
    }
  }
}

function nextActionOf(status: TargetProductStatus, units: PlannedUnitAssessment[]): string {
  switch (status) {
    case "no_plan":
      return "更新後の機種が未定でも診断は進められます。候補の絞り込みから、EHCへご相談ください。";
    case "listed":
      return "この条件での照合は済んでいます。型番・制度・年度・枠を変更した場合は、あらためて照合が必要です。";
    case "not_listed":
      return "登録されている代替機種への変更をご検討ください。EHCで候補をお出しできます。";
    default: {
      if (units.some((u) => u.status === "model_missing")) {
        return "導入予定の型番が決まりましたら、EHC担当者が公募要領の対象製品一覧（またはSIIの補助対象製品検索）と照合します。";
      }
      if (units.some((u) => u.status === "kind_unknown")) {
        return "導入予定機器の種類（ルームエアコン／業務用パッケージ／ビル用マルチ）をお選びいただくか、現地調査でこちらが確認します。";
      }
      return "EHC担当者が公募要領の対象製品一覧（またはSIIの補助対象製品検索）と照合します。照合の結果は、出典・確認日つきでこの画面に表示されます。";
    }
  }
}

/* ───────────────────────────────────────────────────────────
   担当者宛メールに載せる形（EHC-0039 v2 §2 / 2026-09-16 v2・台帳 #65）

   ■ なぜ送信の口にも要るのか
   　　画面の口（app/api/target-product）が保存先から引き直しても、
   　　その結果はブラウザの中にしか無い。送信の時点で担当者が受け取る
   　　書類に対象製品の確認状態が1行も無ければ、
   　　「照合していない案件」と「照合して登録が確認できた案件」が
   　　担当者の手元で区別できない。
   　　だから送信の口でも**もう一度サーバが保存先から引き直し**、
   　　その結果だけを担当者宛メールと応答に載せる。

   ■ ここに顧客宛の文面は作らない
   　　確認主体・出典・確認日は社内の照合記録である。
   　　customerMailText に混ぜない（lib/diagnosisSnapshot.ts の原則）。
   ─────────────────────────────────────────────────────────── */

export interface TargetProductSubmitSubsidy {
  subsidyId: string;
  /** 制度名（担当者が読む。IDだけだと社内で通じない） */
  subsidyName: string;
  frame: string;
  /* 2026-09-16 台帳#32。制度ごとの照合年度。
     summary.fiscalYear（既定＝今日の年度）と一致しない制度がある
     （SII は令和7年度補正の事業で、公募だけが翌年度に行われる）。
     担当者が「どの年度の一覧を見た記録か」を取り違えないため、制度ごとに持つ。 */
  fiscalYear: number;
  /** 宣言されている申請枠の全部（1件以上）。2件以上なら status は frame_undecided */
  frames: string[];
  status: TargetProductStatus;
  checked: boolean;
  reason: string;
  nextAction: string;
  evidence: TargetProductAssessment["evidence"];
}

export interface TargetProductSubmitSummary {
  /** 既定の照合年度（今日＝JSTの会計年度）。
      制度が programFiscalYear を宣言していればその制度は別の年度で照合されており、
      実際に使った年度は subsidies[].fiscalYear にある（2026-09-16 台帳#32）。 */
  fiscalYear: number;
  /** 引き直した日（JST・YYYY-MM-DD） */
  checkedAt: string;
  store: { name: string; connected: boolean; reason?: string };
  plans: PlannedUnit[];
  /** 制度ごとの結果。listed の制度が先に来る（担当者が読む順） */
  subsidies: TargetProductSubmitSubsidy[];
}

const EQUIP_KIND_LABEL_JA: Record<string, string> = {
  room: "ルームエアコン",
  ac: "業務用パッケージ",
  multi: "ビル用マルチ",
  unknown: "種類不明",
};

function planLine(p: PlannedUnit): string {
  const kind = p.equipKind ? EQUIP_KIND_LABEL_JA[p.equipKind] ?? p.equipKind : "種類未選択";
  const model = p.model ? p.model : "型番未入力";
  const maker = p.maker ? `${p.maker} ` : "";
  return `　・${kind}／${maker}${model}`;
}

/** 担当者宛メールに差し込む行。段落ごと省略しないで、未確認なら未確認と書く。 */
export function targetProductStaffLines(summary: TargetProductSubmitSummary): string[] {
  const lines: string[] = ["■ 対象製品の確認（サーバが保存先から引き直した結果）"];

  lines.push(`　照合年度: ${summary.fiscalYear}年度（引き直した日: ${summary.checkedAt}）`);
  /* 2026-09-16 台帳#32。制度が自分の年度を宣言している場合、上の既定年度とは違う年度で
     照合している。1行に丸めると担当者が「どの年度の一覧を見た記録か」を取り違える。
     違う制度だけを名前と年度つきで出す（違いが無ければこの行は出ない）。 */
  const otherYears = summary.subsidies.filter((s) => s.fiscalYear !== summary.fiscalYear);
  if (otherYears.length) {
    const seen = new Map<number, string[]>();
    for (const s of otherYears) {
      const names = seen.get(s.fiscalYear) ?? [];
      names.push(s.subsidyName);
      seen.set(s.fiscalYear, names);
    }
    for (const [year, names] of seen) {
      lines.push(`　　うち${year}年度で照合した制度: ${names.join("、")}`);
    }
  }
  lines.push(
    `　確認記録の保存先: ${summary.store.name}（${summary.store.connected ? "接続済み" : "未接続"}）`
  );
  if (!summary.store.connected) {
    /* 未接続なら、この案件は必ず未確認になる。その事実を黙らない。
       「確認できていない」と「対象ではない」を担当者が取り違えないため。 */
    lines.push(
      `　※ 保存先が未接続のため、どの制度も未確認のままです${
        summary.store.reason ? `（${summary.store.reason}）` : ""
      }。`
    );
  }

  lines.push("", "　導入予定機器（お客様が申告した、入れる予定のもの）");
  if (!summary.plans.length) {
    lines.push("　・未選定（既設機の型番は撤去する機械のものなので、照合の根拠になりません）");
  } else {
    summary.plans.forEach((p) => lines.push(planLine(p)));
  }

  const listed = summary.subsidies.filter((s) => s.status === "listed");
  const notListed = summary.subsidies.filter((s) => s.status === "not_listed");
  /* 2026-09-16 台帳#32。枠未確定は「未確認」の中に埋めない。
     担当者が先にやることが違う（一覧と突き合わせる前に、枠を決める）。 */
  const frameUndecided = summary.subsidies.filter((s) => s.status === "frame_undecided");

  lines.push("", `　登録を確認できた制度: ${listed.length}件 / ${summary.subsidies.length}件`);

  if (listed.length) {
    for (const s of listed) {
      lines.push(`　【確認済み】${s.subsidyName}（${s.fiscalYear}年度・枠: ${s.frame}）`);
      for (const e of s.evidence) {
        lines.push(`　　${e.model} … 出典 ${e.officialSource} ／ ${e.checkedOn} ${e.checkedBy}`);
      }
    }
  }
  if (notListed.length) {
    for (const s of notListed) {
      lines.push(`　【登録なし】${s.subsidyName}（${s.fiscalYear}年度・枠: ${s.frame}）`);
      lines.push(`　　${s.reason}`);
    }
  }
  if (frameUndecided.length) {
    for (const s of frameUndecided) {
      lines.push(`　【枠未確定】${s.subsidyName}`);
      lines.push(`　　${s.reason}`);
      lines.push(`　　次の一手: ${s.nextAction}`);
    }
  }
  if (!listed.length && !notListed.length && !frameUndecided.length) {
    /* 制度を1つずつ並べると読み切れないので、代表1件の理由と次の一手を出す。
       件数は上に出してあるので、何件が未確認かは分かる。 */
    const head = summary.subsidies[0];
    lines.push("　【未確認】いずれの制度も、導入予定型番の登録を確認できていません。");
    if (head) {
      lines.push(`　　${head.reason}`);
      lines.push(`　　次の一手: ${head.nextAction}`);
    }
  }

  return lines;
}
