"use client";

/* v1 / 2026-10-29 / EHC-0102 /tokyo・/shindan でも紹介リンク（?ref=）を端末に覚える（トップ・/kaigo と同じ lib/referralClient.ts）。
   画面には何も出さない。計測は「表にある紹介リンクで開いた」ことだけ。 */

import { useEffect } from "react";
import { captureReferral } from "@/lib/referralClient";
import { referralLinkOf } from "@/lib/referral";
import { track } from "@/lib/track";

export function ReferralCapture({ pathname }: { pathname: "/tokyo" | "/shindan" }) {
  useEffect(() => {
    const params = window.location.search;
    const claim = captureReferral(params, pathname);
    const fromUrl = new URLSearchParams(params).get("ref");
    const link = claim ? referralLinkOf(claim.ref) : null;
    if (fromUrl && claim && link) track("ref_open", { ref: claim.ref, material: link.material });
  }, [pathname]);
  return null;
}
