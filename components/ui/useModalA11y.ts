"use client";

import { useEffect, useRef } from "react";

/* 2026-08-24 監査での新設:
     このアプリのモーダル（該当診断ガイド／適格性チャット／補助金DBチャット／
     ガイド付き診断）は、見た目はダイアログだが実装は素の <div> だった。そのため、
       ・Escape で閉じられない
       ・Tab キーがモーダルの外（背後の入力欄）まで抜けていく
       ・開いた瞬間に読み上げが始まらず、盲目ユーザーは開いたことに気付けない
       ・閉じた後にフォーカスが body へ飛び、元のボタンに戻らない
       ・背後の本文がスクロールできてしまう
     という状態だった（WCAG 2.1 AA の 2.1.2 / 2.4.3 / 4.1.2 に該当）。
     この4つのモーダルで同じ処理を4回書くとズレるので、フックに一本化する。

   使い方:
     const panelRef = useModalA11y(onClose);
     <div role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
*/

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * @param onClose 閉じる処理
 * @param enabled モーダルが開いている間だけ true にする。
 *   開閉をフラグで持つコンポーネント（GuidedDiagnosis）は、閉じている間に
 *   body のスクロールを止めてしまわないよう false を渡すこと。
 *   条件付きでマウントされるコンポーネントは省略してよい（既定 true）。
 */
export function useModalA11y(onClose: () => void, enabled = true) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // onClose が毎レンダリング新しい関数でも effect を貼り直さないよう ref 経由で読む
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 開いた直後にダイアログ自身へフォーカスを移す（読み上げの起点になる）
    panel?.focus({ preventScroll: true });

    // 背後の本文がスクロールしないようにする
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === panel
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      // 閉じたら開く前に触っていた要素へフォーカスを戻す
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [enabled]);

  return panelRef;
}
