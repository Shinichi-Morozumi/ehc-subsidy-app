"use client";

import { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";

// 簡易パスコード入力画面（EHC_PASSCODE 設定時のみ middleware がここへ誘導）
export default function UnlockPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next") || "/";
        window.location.href = next.startsWith("/") ? next : "/";
        return;
      }
      setError(true);
    } catch {
      setError(true);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-night-900 border border-white/10 rounded-3xl p-8 shadow-lift">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-ehc-400 to-ehc-700" />
          <span className="text-[11px] tracking-[0.25em] text-slate-300 font-medium uppercase">
            EHC Solutions
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2 text-white">
          <Lock className="w-5 h-5 text-ehc-400" />
          <h1 className="text-lg font-bold">関係者限定ツール</h1>
        </div>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          このツールはEHCソリューションズの営業支援用です。
          お渡ししている合言葉を入力してください（30日間有効）。
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="合言葉"
            autoFocus
            className="w-full px-4 py-3 bg-night-800 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-ehc-500"
          />
          {error && (
            <p className="text-xs text-red-300">合言葉が一致しません。もう一度お試しください。</p>
          )}
          <button
            type="submit"
            disabled={busy || !code}
            className="w-full bg-gradient-to-r from-ehc-700 to-ehc-500 hover:from-ehc-800 hover:to-ehc-600 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {busy ? "確認中..." : "開く"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-600 mt-6">
          合言葉がご不明の場合は、EHC担当者までお問い合わせください。
        </p>
      </div>
    </div>
  );
}
