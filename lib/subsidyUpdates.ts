// ID: EHC-0095 / v1 / 2026-10-26. 公式本文・SII第4次要領を照合した差分。
// 公開ページの取得・制度確認・型番確認は別。金額や率の自動採用はしない。
import type { Subsidy } from "./types";
const checked = "2026-10-26T12:48:50+09:00";
const sii: Partial<Subsidy> = {
  officialCheckedAt: checked, applyOpen: "2026-10-05", applyClose: "2026-10-30",
  applyCloseAt: "2026-10-30T17:00:00+09:00",
  url: "https://sii.or.jp/setsubi07r/overview4.html",
  sourceSharedGroup: "sii_setsubi07r_kobo4",
  period: "令和7年度補正 4次公募：2026/10/5〜10/30 17:00必着",
  scheduleNote: "4次公募。交付決定は12月下旬予定。締切まで短く、未準備の案件は今回に間に合うとは限りません。",
  nextCheck: "第4次公募要領と対象型番を確認。交付決定前の契約・発注は対象外。設備費のみが対象で工事費等は除外。",
};
export const SUBSIDY_UPDATES: Readonly<Record<string, Partial<Subsidy>>> = {
  sii_iv: sii, sii_gx: sii,
  saitama: {
    officialCheckedAt: checked, applyOpen: "2026-10-13", applyClose: "2026-11-09",
    applyCloseAt: "2026-11-09T17:00:00+09:00",
    period: "令和8年度 3次募集：2026/10/13〜11/9 17時必着",
    scheduleNote: "3次募集開始を公式で確認。予算約1,500万円・先着順ではありません。業務用空調は対象外（本ツールの試算対象外）。",
    adoptionRate: "先着順ではなく期間内の申請を審査。3次予算約1,500万円。採択率とは別。",
  },
  chiba: {
    officialCheckedAt: checked, applyClose: "2026-08-14", closed: true,
    period: "設備補助は2026/8/14で受付終了。県指定省エネ診断も10/7で受付終了",
    scheduleNote: "公式10/7更新：設備補助は予算到達で終了。県指定省エネ診断の申込も終了。次年度実施は未定。診断費の旧申請期限を受付中の根拠にしません。",
  },
  kanagawa: { officialCheckedAt: checked },
  osaka: {
    officialCheckedAt: checked,
    scheduleNote: "6/30受付終了。10/23時点で申請1,201件・交付決定1,040件。審査進捗であり最終採択率ではありません。",
    adoptionRate: "最終採択率は未確定（10/23時点の交付決定進捗86.6％）",
  },
  hotel_sustainability: {
    officialCheckedAt: checked, closed: true,
    period: "令和7年度公募は2025/5/30で終了",
    scheduleNote: "旧公募の終了を公式で確認。令和8年度の新公募の有無は別途確認が必要（過年度条件で受付中にしません）。",
    adoptionRate: "本記録では採択率の裏付けを再確認していません",
    difficultyNote: "旅館業許可・登録等が前提。新公募は要領の再確認が必要。",
  },
  tokyo_zeroemi: {
    applyOpen: "2026-11-09", applyClose: "2026-11-20", verificationState: "unavailable",
    period: "既公表日程：第5回2026/11/9〜11/20、第6回2027/1/18〜1/29（公式本文の再確認が必要）",
    scheduleNote: "10/26は公式URLが404。既公表日程を参考表示しますが、現行本文が再確認できるまで公式確認済みの試算には使いません。",
    nextCheck: "公式ページの移設先・現行要項・第5回受付日程と区分別条件を確認。旧日程だけで申請可とは判断しません。",
  },
  jizokuka: {
    officialCheckedAt: "2026-10-26T13:05:00+09:00",
    url: "https://official.jizokukanb.com/shinsei",
    applyCloseAt: "2026-12-15T17:00:00+09:00",
    verificationState: "needs_review",
    scheduleNote: "現行の公式事務局で第20回11/5〜12/15 17時、様式4発行受付12/4を再確認。賃金引上げ等の特例条件は第8版要領で個別確認。空調の単純更新は対象外。",
  },
};
