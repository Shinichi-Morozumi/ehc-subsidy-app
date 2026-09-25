/* ───────────────────────────────────────────────────────────
   対象製品の確認記録の保存先（EHC-0039 v2 §2 / 2026-09-16 v1）

   ■ なぜ保存先が要るのか
   　　lib/targetProduct.ts の既定は notConnectedStore で、list() は必ず
   　　空配列を返す。だから照合結果は必ず unchecked になり、実画面から
   　　「登録済みを確認しました」へは到達できない。到達できないこと自体は
   　　正しい（根拠が無いのだから）。足りないのは**根拠を入れる場所**。
   　　ここがその場所。

   ■ 中身は人が入れた記録だけ
   　　この保存先は読み書きするだけで、何も判定しない。
   　　書けるのは app/api/admin/target-product 経由で、
   　　addCheck() → validateCheck() を通った記録に限る
   　　（出典・確認日・確認主体が揃っていない記録は入らない）。

   ■ 追記だけにする理由
   　　1行1件の JSONL で追記のみ。上書き・削除をしない。
   　　「いつ誰が何を見てそう判断したか」は後から書き換えられては困る。
   　　同じ鍵で新しい記録を足せば、照合側（assessOne）が確認日の新しい方を
   　　採るので、訂正は「新しい記録を足す」で行う。

   ■ 接続とみなす条件
   　　置き場所に実際に書けることを、接続時に1回確かめる。
   　　書けない環境（Vercel の関数のように実行ごとに消える場所を含む）で
   　　connected=true にすると、「保存したのに消える」＝
   　　「確認したはずが未確認に戻る」が起きる。それは未接続より悪い。
   　　書けなければ接続せず、理由を残す。

   ■ Vercel のような書き込みが残らない環境について
   　　EHC_TARGET_PRODUCT_DIR に永続ボリューム（または将来 Notion / DB）を
   　　指していない限り、本番では接続しない方が正しい。既定の .data は
   　　開発機での運用と受入確認のための置き場であって、本番の台帳ではない。
   ─────────────────────────────────────────────────────────── */

import fs from "node:fs";
import path from "node:path";
import {
  describeTargetProductStore,
  setTargetProductStore,
  type TargetProductCheck,
  type TargetProductStore,
} from "./targetProduct";

/** 接続を試みた結果。画面と検証ログに、そのまま出せる言葉で残す。 */
export interface TargetProductStoreStatus {
  connected: boolean;
  name: string;
  /** 置き場所（接続できなかったときも、どこを見に行ったかを残す） */
  file: string;
  /** 接続しなかった理由。接続できたときは null */
  reason: string | null;
}

let status: TargetProductStoreStatus | null = null;

function resolveFile(): string {
  const dir = process.env.EHC_TARGET_PRODUCT_DIR?.trim() || path.join(process.cwd(), ".data");
  return path.join(dir, "target-product-checks.jsonl");
}

/* 1行1件。壊れた行が混ざっても、その行だけ落として残りは読む。
   全部読めなくなる方が被害が大きい。 */
function readAll(file: string): TargetProductCheck[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out: TargetProductCheck[] = [];
  for (const line of raw.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s) as TargetProductCheck);
    } catch {
      /* 読めない行は採用しない。採用しないことは未確認であって、
         登録されている根拠にも、登録されていない根拠にもならない。 */
    }
  }
  return out;
}

function createFileStore(file: string): TargetProductStore {
  return {
    name: `file:${file}`,
    connected: true,
    async list(subsidyId: string, fiscalYear: number) {
      return readAll(file).filter(
        (c) => c.subsidyId === subsidyId && c.fiscalYear === fiscalYear
      );
    },
    async add(check: TargetProductCheck) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${JSON.stringify(check)}\n`, "utf8");
    },
  };
}

/* 何度呼ばれても1回しか接続しない。API の入口ごとに呼んで構わない。
   モジュール読み込み時の副作用にしないのは、接続したかどうかを
   呼び出し側が受け取れるようにするため。 */
export function ensureTargetProductStore(): TargetProductStoreStatus {
  if (status) return status;

  const file = resolveFile();
  const dir = path.dirname(file);

  try {
    fs.mkdirSync(dir, { recursive: true });
    /* 実際に書けることを確かめる。存在確認だけでは足りない
       （読み取り専用の場所でもディレクトリは見える）。 */
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "1", "utf8");
    fs.unlinkSync(probe);
  } catch (e) {
    status = {
      connected: false,
      name: describeTargetProductStore().name,
      file,
      reason: `確認記録の置き場所に書き込めないため接続しませんでした（${dir} ／ ${
        e instanceof Error ? e.message : "原因不明"
      }）。保存できない場所へ接続すると、確認済みが後で未確認へ戻ります。`,
    };
    return status;
  }

  const s = createFileStore(file);
  setTargetProductStore(s);
  status = { connected: true, name: s.name, file, reason: null };
  return status;
}

export function targetProductStoreStatus(): TargetProductStoreStatus | null {
  return status;
}

/* 試験用。接続の判定をやり直せるようにするだけで、
   lib/targetProduct.ts 側の保存先は戻さない（resetTargetProductStore を使う）。 */
export function forgetTargetProductStoreStatus(): void {
  status = null;
}
