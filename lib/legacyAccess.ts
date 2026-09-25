/* ───────────────────────────────────────────────────────────
   旧シミュレーター（詳細シミュレーター・従来の帳票）の出し分け
   2026-09-25 UXレビュー No.3

   お客様向けの画面では、5段の診断の下に旧シミュレーターの入口が常に出ていた。
   旧側は電力 80,000kWh・5台などの既定値で削減額や回収年数を計算するため、
   同じページの中で新しい診断の概算と食い違う数字が並んでいた。
   そこでお客様向けの画面からは外し、次のどちらかのときだけ出す。

     ?staff=1 … 担当者用の入口（提案書の作成・送付に使う）
     ?d=…     … 旧シミュレーターが発行した共有リンク（QR）。内容を再現して見せる

   これは画面の出し分けであって、アクセス制御ではない。
   URL を知っていれば誰でも開ける。秘密の情報はここに置かないこと。
   ─────────────────────────────────────────────────────────── */

export interface LegacyAccess {
  /** ?staff=1 で開いた（担当者用の入口） */
  staff: boolean;
  /** ?d= の共有リンクで開いた */
  sharedLink: boolean;
  /** 旧シミュレーターを表示してよいか */
  showLegacy: boolean;
}

export const NO_LEGACY_ACCESS: LegacyAccess = { staff: false, sharedLink: false, showLegacy: false };

export function legacyAccessFromSearch(search: string): LegacyAccess {
  const q = new URLSearchParams(search);
  const staff = q.get("staff") === "1";
  const sharedLink = (q.get("d") ?? "") !== "";
  return { staff, sharedLink, showLegacy: staff || sharedLink };
}
