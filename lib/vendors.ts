import { Vendor } from "./types";

/* 機種情報はメーカー公表資料をもとにした参考値です。発売時期・性能値は改定されることがあるため、
   提案書に転記する際は必ず各メーカーの最新カタログ／技術資料で裏取りしてください。 */
export const VENDORS_DISCLAIMER =
  "機種・発売時期・性能値はメーカー公表資料に基づく参考情報です。提案・見積時は最新カタログでご確認ください。";

export const VENDORS: Vendor[] = [
  { maker: "ダイキン工業", series: "FIVE STAR ZEAS", refri: "R32", use: "店舗・オフィス（業務用パッケージ）", note: "省エネフラッグシップ。猛暑対応を強化した上位シリーズ（能力・APFは機種により異なる）" },
  { maker: "ダイキン工業", series: "SkyAir 全シリーズ", refri: "R32", use: "業務用空調全般", note: "認定特工店経由で補助金申請代行サービスあり" },
  { maker: "ダイキン工業", series: "VRV / ビル用マルチ", refri: "R32", use: "ビル用マルチエアコン", note: "大型ビル・複数フロア対応" },
  { maker: "三菱電機", series: "スリムZR", refri: "R32", use: "店舗・事務所パッケージ", note: "SiCパワー半導体を採用した高効率モデル。広い外気温レンジに対応（数値はメーカー資料参照）" },
  { maker: "三菱電機", series: "スリムER", refri: "R32", use: "店舗・事務所", note: "高APFでランニングコスト削減、コンパクト設計" },
  { maker: "三菱電機", series: "シティマルチ", refri: "R32", use: "ビル用マルチエアコン", note: "省エネ・大容量対応" },
  { maker: "三菱電機", series: "中温パッケージ", refri: "R32", use: "低温倉庫・特殊用途", note: "" },
  { maker: "パナソニック", series: "ECONAVI 業務用エアコン", refri: "R32", use: "店舗・オフィス", note: "人感センサー搭載・省エネ運転" },
  { maker: "日立", series: "省エネの達人 / セットフリー", refri: "R32", use: "店舗・ビル用マルチ", note: "部分負荷効率優秀" },
  { maker: "東芝キヤリア", series: "スーパーパワーエコ", refri: "R32", use: "業務用パッケージ", note: "高効率・コストパフォーマンス◎" },
];
