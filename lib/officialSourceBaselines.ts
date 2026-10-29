// ID: EHC-0095 / v1 / 2026-10-26. 取得した公開本文・リンクのSHA256。
// 内容不変は制度適合や採択の保証ではない。404/403は基準を作らない。
export const OFFICIAL_SOURCE_BASELINES: Readonly<Record<string, string>> = {
  "https://sii.or.jp/setsubi07r/overview4.html": "46eef741d7dd7ad6757976a6e007b74eb2970584a3ae19b8734b8ec79cc0d268",
  "https://www.pref.saitama.lg.jp/a0503/datutanso.html": "8098930db6ab04b6e16fb03c7de4d0e5b58832c1bb9b6a8ae0babaabd68ced52",
  "https://www.pref.chiba.lg.jp/ontai/hojo/r8jigyousyahojo.html": "43b1572d813e54a6b3533b0fc892a653cfa000cc574b995654973ef14874df20",
  "https://www.pref.kanagawa.jp/docs/ap4/cnt/f7226/shouenesetubihojokin.html": "d1d5bcb3b0e76b00016c2071a49038c8550d52f13aa40811de8f5215294e6e30",
  "https://www.pref.osaka.lg.jp/o120020/eneseisaku/sec/r08hojokin-pac.html": "3d48d8c0f2672b4e1b7e773fa8302d0da9613948e5ca9b221240182e39b5630e",
  "https://www.mlit.go.jp/kankocho/kobo06_00025.html": "45a8d83d7b04954850ab7b4be6857593b2d9e8d5f50d8da41c774b5cc51b418f",
};
export const OFFICIAL_DISCOVERY_SOURCES = [{
  url: "https://sii.or.jp/setsubi07r/",
  ids: ["sii_iv", "sii_gx"],
  sha256: "65517476b1dd9f834d8aaf034c7b3ac19403bcad19cb53b69091069ed7c8e12f",
}];
