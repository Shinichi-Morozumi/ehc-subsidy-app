"use client";
import { useEffect } from "react";

// Service Worker登録（PWAインストール用）。UIは持たない。
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
