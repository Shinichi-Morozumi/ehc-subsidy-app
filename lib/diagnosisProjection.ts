/* ───────────────────────────────────────────────────────────
   診断入力（DiagnosisState）→ 計算入力（MatchInput）への投影
   （EHC-0039 第2片 / 2026-09-14 v1）

   ■ ここが持たないもの
   　　金額計算・適格性判定・制度時計は一切書かない。
   　　lib/match.ts / lib/pricing.ts / lib/eligibility.ts / lib/programClock.ts を
   　　import して使うだけで、式を写さない。
   　　（同じ式が2か所にあると、片方だけ直されて同じ案件に2つの数字が出る。
   　　　match.ts と ProgramMatchBoard.tsx で実際に起きたことなので繰り返さない。）

   ■ ここがやること
   　　「利用者が答えた形」を「計算に渡せる形」に落とし、
   　　落とせなかった群を理由付きで返す。落とせないものを既定値で埋めない。

   ■ 埋めない、ということの具体
   　　・台数が未入力の群を「1台」にしない
   　　・設置年が未入力の群を「15年前」にしない
   　　・ルームエアコンを業務用パッケージ("ac")に変換しない
   　　いずれも、埋めた瞬間に投資額・削減kWh・補助額の根拠になり、
   　　こちらが立てた仮定が相手には「診断結果」として見える。
   ─────────────────────────────────────────────────────────── */

import type {
  EquipGroup,
  EquipModelNos,
  EquipType,
  MatchInput,
  RefriType,
} from "./types";
import type { DiagnosisEquipGroup, DiagnosisState } from "./diagnosisState";
import type { FitGroupKind } from "./eligibility";

/** 計算に渡せなかった理由。画面はこの値から文言を作る（各画面で判定を書かない） */
export type UnresolvedReason =
  | "kind_unselected" // 設備の種類が未回答（まだ選んでいない）
  | "kind_unknown" // 「分からない」と答えた
  | "room_not_covered" // ルームエアコン。この診断の算定対象外
  | "units_missing" // 室内機の台数が未入力
  | "install_year_missing"; // 設置年が未入力

export const UNRESOLVED_REASON_LABEL: Record<UnresolvedReason, string> = {
  kind_unselected: "設備の種類が未選択です",
  kind_unknown: "設備の種類は現地調査で確認します",
  room_not_covered: "ルームエアコンのため、この診断では金額を算定しません",
  units_missing: "室内機の台数が未入力です",
  install_year_missing: "設置年が未入力です",
};

/** 画面に出す補足。「対象外」と「情報が足りない」を混ぜないための文言 */
export const UNRESOLVED_REASON_NOTE: Record<UnresolvedReason, string> = {
  kind_unselected:
    "種類が決まると、電力使用量の按分と対象制度の絞り込みができます。",
  /* 「分からない」は不備ではない。答えとして受け取ったうえで、
     こちらが現地で確認する、と返す。催促の文言にしない。 */
  kind_unknown:
    "銘板の型番を写真で送っていただくか、現地調査で確認します。推測で種類を決めて金額を出すことはしません。",
  room_not_covered:
    "業務用設備を対象とする制度の算定式をそのまま当てはめられないため、金額を出していません。対象外が確定したという意味ではなく、別途ご相談ください。",
  units_missing:
    "台数は室内機の数です（室外機の数・系統数とは別）。未入力を1台として計算していません。",
  install_year_missing:
    "設置年から経年劣化の見込みを置いています。未入力を「15年前」などで補っていません。",
};

export interface UnresolvedGroup {
  group: DiagnosisEquipGroup;
  /** 1つの群に複数当てはまることがある（種類も台数も未入力、など） */
  reasons: UnresolvedReason[];
}

export interface EquipProjection {
  /** 計算に渡せる群だけ。room・未入力の群はここに入らない */
  equipGroups: EquipGroup[];
  unresolvedGroups: UnresolvedGroup[];
  /* ───────── 2026-09-16 EHC-0039 修正2 で追加 ─────────
     計算に渡せなかった群の「種類」を、unresolvedGroups と同じ順で並べたもの。

     なぜ件数ではなく種類か。
     適合度の判定（lib/eligibility.ts の assessFit）は、案件全体の設備のうち
     何群がその制度の対象種別かを見る。ところが equipGroups には
     ルームエアコンも種類未選択も入っていないので、そこだけを見ると
     どの制度でも「すべて対象種別です」になってしまう。
     v19 の独立検収が「実画面から low が一度も出ない」と指摘したのはこれ。

     かといって件数だけを渡すと、
       ・ルームエアコン → 対象種別でないと分かっている
       ・種類未選択・不明 → 対象かどうか分かっていない
     の区別が消える。消えたまま判定すると、どちらへ倒しても事実と違う。
     だから種類をそのまま渡す。

     渡すのは判定のためだけで、金額計算へは戻さない。
     ルームエアコンを "ac" へ変換することも、ここでも下流でもしない。 */
  excludedKinds: FitGroupKind[];
  /* ───────── canCompute を必ず見ること ─────────
     lib/match.ts の matchSubsidies() は equipGroups が空のとき、
     「R410A・パッケージ・15年前・1台」という既定の群を内部で立てて計算を続ける。
     つまり、全部の群が未解決でも空配列を渡せば数字が返ってくる。
     その数字は誰も入力していない設備のものなので、画面に出してはならない。
     渡す前にここで止める。 */
  canCompute: boolean;
}

/* 群ごとの判定。ここに書いてよいのは「渡せるか否か」だけで、
   削減率・金額の話は一切しない。 */
function unresolvedReasonsFor(g: DiagnosisEquipGroup): UnresolvedReason[] {
  const reasons: UnresolvedReason[] = [];
  if (g.kind === null) reasons.push("kind_unselected");
  if (g.kind === "unknown") reasons.push("kind_unknown");
  if (g.kind === "room") reasons.push("room_not_covered");
  /* 0台・負数・小数・非有限は「答え」ではなく入力途中とみなす。
     0台は「0台ある」という回答としては成立しないため（群自体を消せばよい）、
     未入力と同じ扱いにする。 */
  if (!Number.isInteger(g.units) || (g.units as number) <= 0) reasons.push("units_missing");
  if (!Number.isInteger(g.installYear) || (g.installYear as number) <= 0) {
    reasons.push("install_year_missing");
  }
  return reasons;
}

/* 馬力。未入力（null）は undefined として落とす。
   EquipGroup.hp は任意項目で、match.ts 側は hp が無いとき重み1として按分する。
   ここで 1 や 一般値を入れてしまうと、こちらの仮定が
   「入力された馬力」として下流に伝わり、暫定値である印が消える。 */
function hpOrUndefined(hp: number | null): number | undefined {
  if (hp == null || !Number.isFinite(hp) || hp <= 0) return undefined;
  return hp;
}

/* 型番。2026-09-16 EHC-0039 v2 §4 作業3（台帳 #31）で追加。

   ここまで、この投影は型番3欄（modelSet / modelIndoor / modelOutdoor）を
   EquipGroup に渡していなかった。利用者が銘板を写して入力しても、
   計算には一切届かず、削減率は provisional な4係数だけで作られていた。

   渡すのは「入力された文字列を前後の空白だけ落としたもの」に限る。
   ・空文字は undefined にする（空文字は「入力された型番」ではない）
   ・大文字化・全角半角の変換・記号の除去はここでしない。
   　照合側（lib/equipmentPerformance.ts の normalizeModelNo）の仕事であり、
   　2か所で正規化すると片方だけ直されたときに照合結果が食い違う。
   ・一次資料に無い型番を近い型番へ寄せることは、ここでも照合側でもしない。 */
function trimmedOrUndefined(v: string | null): string | undefined {
  if (v == null) return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function modelsOrUndefined(g: DiagnosisEquipGroup): EquipModelNos | undefined {
  const set = trimmedOrUndefined(g.modelSet);
  const indoor = trimmedOrUndefined(g.modelIndoor);
  const outdoor = trimmedOrUndefined(g.modelOutdoor);
  /* 3欄すべて未入力なら models 自体を作らない。
     空の器を渡すと、下流が「型番は聞いたが無かった」と
     「そもそも聞いていない」を区別できなくなる。 */
  if (set === undefined && indoor === undefined && outdoor === undefined) {
    return undefined;
  }
  return { set, indoor, outdoor };
}

/**
 * 設備群の投影。
 * ac / multi で、台数と設置年が揃っている群だけを EquipGroup に落とす。
 *
 * 冷媒種別（refri）について:
 *   この入力画面では冷媒を聞いていない。聞いていないものを設置年から
 *   推定して r22 / r410a を立てると、根拠のない世代差が削減率に乗る。
 *   RefriType の "unknown" は「不明」を表す正規の値で、
 *   lib/coefficients.ts 側も不明時はR410A相当の安全側で暫定値として扱い、
 *   「現地調査で銘板を確認する」を needed に持っている。
 *   埋めるのではなく、不明のまま渡して暫定値として印を付けるのが正しい。
 */
export function projectEquipGroups(state: DiagnosisState): EquipProjection {
  const equipGroups: EquipGroup[] = [];
  const unresolvedGroups: UnresolvedGroup[] = [];
  const excludedKinds: FitGroupKind[] = [];

  state.groups.forEach((g) => {
    const reasons = unresolvedReasonsFor(g);
    if (reasons.length > 0) {
      unresolvedGroups.push({ group: g, reasons });
      /* 種類はそのまま渡す。null（未選択）も "unknown"（分からないと答えた）も
         "room" も、判定側がそれぞれ別の意味で扱う。ここで丸めない。
         EquipKind と FitGroupKind は同じ5値なので、変換は要らない。 */
      excludedKinds.push(g.kind);
      return;
    }
    equipGroups.push({
      id: g.id,
      refri: "unknown" as RefriType,
      equip: g.kind as EquipType, // reasons が空＝kind は "ac" | "multi" に確定している
      installYear: g.installYear as number,
      units: g.units as number,
      hp: hpOrUndefined(g.hp),
      models: modelsOrUndefined(g),
      maker: g.maker,
    });
  });

  return {
    equipGroups,
    unresolvedGroups,
    excludedKinds,
    canCompute: equipGroups.length > 0,
  };
}

export interface MatchInputProjection {
  /** canCompute が false のときは null。呼び出し側は matchSubsidies を呼ばない */
  input: MatchInput | null;
  projection: EquipProjection;
}

/**
 * 計算入力を組み立てる。
 *
 * base には、この画面が扱っていない項目（所在地・事業規模・建物用途・
 * 年間電力使用量・設備投資額・顧客情報など）が入った既存の MatchInput を渡す。
 * ここが上書きするのは、この画面が実際に聞いた項目だけに限る。
 *
 * 想定予算（customerBudgetYen）は invest に入れない。
 * 予算は「相手が出せる額」、invest は「工事にかかる額」で、別のものである。
 * 同一視すると、予算を入れただけで補助額（invest × 補助率）が動き、
 * 予算を低く答えた人ほど補助額が小さく見える画面になる。
 * 予算は提案の組み方に使う情報であって、算定の入力ではない。
 *
 * 契約の進み具合（contractStatus）は、2026-09-16 EHC-0039 修正2 から渡す。
 *
 * 以前ここには「MatchInput には渡さない。判定は lib/eligibility.ts の持ち物だから」
 * と書いてあった。前半が誤りで、後半は正しい。
 * 判定の持ち主が eligibility.ts であることと、その入力を渡すことは矛盾しない。
 * 渡さなかった結果、画面が聞いた「もう発注しましたか」の答えが
 * どこにも届かず、全案件が「着手前かどうか未確認」のまま判定されていた。
 *
 * ここでやってよいのは raw 値を素通しすることだけ。
 * 「contracted なら対象外」と書けば判定が2か所に分かれるので、書かない。
 */
/* ───────── 対象製品の照合結果 ─────────
   2026-09-16 EHC-0039 v2 §2。

   この値の作り手は **サーバ**（app/api/target-product）だけで、
   画面は受け取って素通しする。ここで組み立てない。
   組み立てられるようにすると、利用者の手元で true を作る道ができる。

   undefined（＝まだ問い合わせていない）と、
   全制度 false（＝問い合わせた結果どれも未確認）は別物である。
   undefined のとき lib/eligibility.ts は従来の単一 boolean へ落ちるので、
   受入テストの直接入力（targetProductChecked）は従来どおり効く。 */
export interface TargetProductProjection {
  checks: Record<string, boolean>;
  notes: Record<string, string>;
}

export function toMatchInput(
  state: DiagnosisState,
  base: MatchInput,
  targetProduct?: TargetProductProjection
): MatchInputProjection {
  const projection = projectEquipGroups(state);
  if (!projection.canCompute) return { input: null, projection };

  return {
    input: {
      ...base,
      equipGroups: projection.equipGroups,
      /* 未問い合わせは undefined のまま渡す（空オブジェクトにしない）。
         空オブジェクトを渡すと eligibility.ts は「問い合わせた結果すべて未確認」
         として扱い、受入テストの直接入力が効かなくなる。 */
      targetProductChecks: targetProduct?.checks,
      targetProductNotes: targetProduct?.notes,
      /* null（未回答）は undefined として落とす。
         MatchInput 側の desiredTiming は任意項目で、
         "undecided" は「決めていないと答えた」という別の回答である。 */
      desiredTiming: state.desiredTiming ?? undefined,
      /* null（未回答）はそのまま渡す。undefined に潰しても判定側は同じ扱いだが、
         「聞いたが答えなかった」と「そもそも聞いていない」を型の上で残しておく。 */
      contractStatus: state.contractStatus,
    },
    projection,
  };
}
