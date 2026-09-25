/* ───────────────────────────────────────────────────────────
   空調更新診断の入力状態を1か所で定義する（EHC-0039 第1片 / 2026-09-14 v1）

   ■ このファイルが持つもの
   　　入力状態の「型」だけ。判定も計算も置かない。
   　　金額計算・適格性判定・制度時計は lib/pricing.ts / lib/eligibility.ts /
   　　lib/programClock.ts が唯一の持ち主で、ここへ複製しない。
   　　（複製すると同じ案件で2つの数字が出る。roiState.ts の F03 で
   　　　一度通った道なので繰り返さない。）

   ■ 既存 MatchInput との関係
   　　MatchInput（lib/types.ts）は「計算に渡せる形」であって、
   　　「利用者が画面で答えた形」ではない。両者を同じ型にすると、
   　　未入力を 0 や既定値で埋めない限り計算関数に渡せず、
   　　結果として「未入力＝0台」「未入力＝1台」が混入する。
   　　そこで入力状態はここで独立に持ち、計算へ渡すときに投影する
   　　（投影関数 toMatchInput は第2片）。

   ■ null の意味（全案件で統一）
   　　　null … 分からない・未回答（既定値で埋めない）
   　　　0    … 確認した結果ゼロ
   　　　負値 … 削減ではなく増加
   ─────────────────────────────────────────────────────────── */

import type { ContractStatus, DesiredTiming } from "./types";
import type { PlannedUnit } from "./targetProduct";

/* ───────── 設備の種類 ─────────
   既存の EquipType は "ac"（業務用パッケージ）と "multi"（ビル用マルチ）の
   2値しかなく、利用者が実際に持ち込む3つ目のケース——ルームエアコン——を
   表せなかった。表せないと、画面はどちらかに寄せるしかない。

   ルームエアコンを "ac" に寄せるのは誤りである。
   業務用の補助制度（SII 設備単位型など）は対象機器が業務用に限られ、
   台あたり単価・馬力の一般値も業務用のものだからで、
   寄せた瞬間に「対象になるはずのない設備に補助額が付いた画面」が出る。
   数字が出てしまうと、それが概算であっても相手は期待する。

   そこで "room" を別の値として持ち、業務用へ自動変換しない。
   room は対象外ではなく「この診断では金額を出さない・別導線で扱う」区分。

   ───── "unknown" と null を分ける理由 ─────
   選択肢には「分からない」を必ず置く（EHC-0038 素材PDF v2 §04）。
   分からないと答えた人に選択を強いると、当てずっぽうで押されるだけで、
   その当てずっぽうが単価と対象制度の根拠になる。

   その「分からない」を null で表すと、**まだ何も答えていない群**と
   区別が付かなくなる。区別が付かないと画面は2つの誤りのどちらかを犯す——
   初期表示で「分からない」に印が付いている（答えていない人の口に答えを入れる）か、
   答えたのに印が消える（押した操作が無かったことになる）か。
   RefriType が "unknown" を正規の値として持っているのと同じ理由で、
   ここでも「確認した結果わからない」と「未回答」を別の値にする。

   　　null      … まだ答えていない（どの選択肢にも印を付けない）
   　　"unknown" … 分からないと答えた（現地調査で確認する、へ送る） */
export type EquipKind = "room" | "ac" | "multi" | "unknown" | null;

/* ───────── 契約の進み具合 ─────────
   補助金は交付決定前に発注・契約・着工していると対象外になる制度が多い。
   つまりこれは「参考情報」ではなく、候補制度の出し方そのものを左右する。
   後段で聞くと、すでに契約済みの相手に補助額を見せてから
   取り下げることになるので、設備の入力と同じ段で持つ。 */
/* 2026-09-16 EHC-0039 修正2:
     型の定義は lib/types.ts へ移した。判定の入力（MatchInput）側にも同じ型が要るためで、
     ここに別に置くと同じ概念の型が2つになる。ここは再輸出だけを持つ。
     既存の `import type { ContractStatus } from "./diagnosisState"` はそのまま動く。

     再輸出（export type { … } from "./types"）は名前を外へ通すだけで、
     このファイルの中へは入ってこない。下の DiagnosisState が
     ContractStatus を書いているので、冒頭の import にも足してある。
     v24 の型検査が TS2304 で落ちたのはこれ。 */
export type { ContractStatus } from "./types";

/* ───────── 設備グループ1件 ─────────
   「同じ種類・同じ設置年の機器のまとまり」を1件とする。
   冷媒・設置年・台数がバラバラな現場を1案件で扱うため、群を複数持つ。 */
export interface DiagnosisEquipGroup {
  /** 安定ID。並べ替え・削除しても行の同一性を保つために使う（配列indexは使わない） */
  id: string;

  kind: EquipKind;

  /** 室内機の台数。室外機の数・系統数とは別物なので取り違えない。
      未入力は null。1 を初期値として置かない——
      「1台」は利用者が答えた値ではなく、こちらが勝手に立てた仮定だからで、
      そのまま投資額と補助額の根拠になってしまう。 */
  units: number | null;

  /** 設置年（西暦）。未入力は null（「不明」を今年や15年前で埋めない） */
  installYear: number | null;

  /** 馬力。未入力は null。null のときは一般値で概算する旨を画面に明示する */
  hp: number | null;

  /** メーカー名。分からなければ null */
  maker: string | null;

  /** 型番の系列・シリーズ名（銘板に1つだけ書かれている場合のここ） */
  modelSet: string | null;

  /** 室内機の型番 */
  modelIndoor: string | null;

  /** 室外機の型番 */
  modelOutdoor: string | null;
}

/* ───────── 案件全体 ─────────
   群ごとではなく案件に1つだけ付く項目。 */
export interface DiagnosisState {
  groups: DiagnosisEquipGroup[];

  /* ───────── 導入予定機器 ─────────
     2026-09-16 EHC-0039 v2 §2。

     groups（既設機）とは**別の配列**で持つ。同じ配列に混ぜてはならない。
     groups は撤去する機械の銘板で、補助対象になるのは入れる機械の方だから、
     混ぜると「撤去する機種が対象製品一覧に載っているから補助対象」という
     成立しない判定が通ってしまう。

     空配列は「まだ決めていない」であって「入れない」ではない。
     更新後の機種が未定でも診断は進む（候補提示と相談導線へ送る）。
     未定であることを理由に金額や適合度を下げない — ただし
     「対象製品一覧で確認済み」とも言わない。 */
  plannedUnits: PlannedUnit[];

  /** 想定予算（円。万円ではない）。未回答は null。
      0 は「予算ゼロ」＝費用を出せないという回答であって、未回答ではない。 */
  customerBudgetYen: number | null;

  /** 希望時期。既存の選択肢（lib/types.ts）をそのまま使う。未回答は null */
  desiredTiming: DesiredTiming | null;

  contractStatus: ContractStatus;
}

/* ───────── 初期値 ─────────
   ここで作る群は「空欄が1行ある」状態であって、「1台ある」ではない。
   すべて null で始める。 */

let fallbackSeq = 0;

/** 群のID。配列のindexを識別子に使わないための唯一の発行口。 */
export function newEquipGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackSeq += 1;
  return `eq-${Date.now().toString(36)}-${fallbackSeq}`;
}

export function newEquipGroup(): DiagnosisEquipGroup {
  return {
    id: newEquipGroupId(),
    kind: null,
    units: null,
    installYear: null,
    hp: null,
    maker: null,
    modelSet: null,
    modelIndoor: null,
    modelOutdoor: null,
  };
}

export function newDiagnosisState(): DiagnosisState {
  return {
    groups: [newEquipGroup()],
    /* 空で始める。空行を1つ置くと「入れる機械を1台答えた」ように見え、
       型番欄が空のまま「未確認」の行が最初から立つ。
       更新後の機種が未定であることは正常な状態なので、そう扱う。 */
    plannedUnits: [],
    customerBudgetYen: null,
    desiredTiming: null,
    contractStatus: null,
  };
}
