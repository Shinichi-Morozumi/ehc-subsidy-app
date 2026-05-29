"use client";

import { useState } from "react";
import { Card, CardTitle } from "./ui/Card";
import { Field, Select, Input, Button } from "./ui/Field";
import { MatchInput, BizType, SizeType, EquipType, RefriType } from "@/lib/types";
import { matchSubsidies, MatchResult } from "@/lib/match";

const PREFS = ["東京都", "神奈川県", "大阪府", "埼玉県", "千葉県", "愛知県", "北海道", "福岡県", "その他"];

export function SubsidyMatcher() {
  const [input, setInput] = useState<MatchInput>({
    bizType: "business",
    size: "sme",
    pref: "東京都",
    building: "office",
    equip: "ac",
    years: 15,
    refri: "r410a",
    kwh: 80000,
    invest: 500,
    co2: 5,
  });
  const [result, setResult] = useState<MatchResult | null>(null);

  const set = <K extends keyof MatchInput>(key: K, val: MatchInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: val }));

  const run = () => {
    if (input.bizType === "personal") {
      alert("EHCは業務用専門です。法人・事業者としてご検討ください。");
      return;
    }
    setResult(matchSubsidies(input));
  };

  return (
    <div>
      <Card>
        <CardTitle>顧客情報入力</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <Field label="事業者区分">
            <Select value={input.bizType} onChange={(e) => set("bizType", e.target.value as BizType)}>
              <option value="business">法人・事業主（業務用）</option>
              <option value="personal">個人・家庭用</option>
            </Select>
          </Field>
          <Field label="企業規模">
            <Select value={input.size} onChange={(e) => set("size", e.target.value as SizeType)}>
              <option value="sme">中小企業（資本3億以下 or 従業員300人以下）</option>
              <option value="middle">中堅企業</option>
              <option value="large">大企業</option>
            </Select>
          </Field>
          <Field label="所在地（都道府県）">
            <Select value={input.pref} onChange={(e) => set("pref", e.target.value)}>
              {PREFS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="建物用途">
            <Select value={input.building} onChange={(e) => set("building", e.target.value)}>
              <option value="office">オフィス・事務所</option>
              <option value="retail">小売店舗</option>
              <option value="restaurant">飲食店</option>
              <option value="hotel">ホテル・宿泊</option>
              <option value="medical">医療・福祉</option>
              <option value="school">学校・教育</option>
              <option value="other">その他事業所</option>
            </Select>
          </Field>
          <Field label="既存設備">
            <Select value={input.equip} onChange={(e) => set("equip", e.target.value as EquipType)}>
              <option value="ac">業務用エアコン（パッケージ）</option>
              <option value="multi">マルチエアコン（ビル用）</option>
            </Select>
          </Field>
          <Field label="設置からの年数">
            <Select value={input.years} onChange={(e) => set("years", Number(e.target.value))}>
              <option value={5}>5年未満</option>
              <option value={10}>5〜10年</option>
              <option value={15}>10〜15年（更新推奨ゾーン）</option>
              <option value={20}>15〜20年（要更新）</option>
              <option value={25}>20年以上（緊急更新）</option>
            </Select>
          </Field>
          <Field label="現在の冷媒">
            <Select value={input.refri} onChange={(e) => set("refri", e.target.value as RefriType)}>
              <option value="r22">R22（HCFC・既に製造禁止）</option>
              <option value="r410a">R410A（HFC・段階的廃止中）</option>
              <option value="r32">R32（現行HFC・GWP675）</option>
              <option value="unknown">不明</option>
            </Select>
          </Field>
          <Field label="年間電力使用量(kWh)">
            <Input type="number" value={input.kwh} onChange={(e) => set("kwh", Number(e.target.value))} />
          </Field>
          <Field label="設備投資概算(万円)">
            <Input type="number" value={input.invest} onChange={(e) => set("invest", Number(e.target.value))} />
          </Field>
          <Field label="CO2削減量(t/年・想定)">
            <Input type="number" value={input.co2} onChange={(e) => set("co2", Number(e.target.value))} />
          </Field>
        </div>
        {input.bizType === "personal" && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mt-3">
            ⚠️ EHCソリューションズは <strong>業務用専用</strong> です。個人・家庭用空調は対象外となります。
          </div>
        )}
        <Button onClick={run} className="mt-3">即答（マッチング & ROI 計算）</Button>
      </Card>

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: MatchResult }) {
  return (
    <>
      <Card className="mt-5">
        <CardTitle>📊 ROI シミュレーション</CardTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <RoiBox label="想定補助金" value={`¥${(result.bestSubsidyManYen * 10000).toLocaleString("ja-JP")}`} />
          <RoiBox label="投資回収期間" value={result.yearsToRecover !== null ? `${result.yearsToRecover} 年` : "計算不能"} />
          <RoiBox label="年間電気代削減" value={`¥${result.saveYenPerYear.toLocaleString("ja-JP")}`} />
          <RoiBox label="15年間累計削減" value={`¥${result.total15YearsYen.toLocaleString("ja-JP")}`} />
        </div>
      </Card>

      <Card className="mt-5">
        <CardTitle>🎯 適用可能な補助金</CardTitle>
        {result.matched.length ? (
          result.matched.map((s) => (
            <div key={s.id} className="border border-gray-200 border-l-4 border-l-ehc-accent bg-green-50 rounded-lg p-3.5 mb-3">
              <h3 className="text-sm font-semibold mb-1.5">✅ {s.name}</h3>
              <div className="text-xs text-gray-600 mb-2 flex flex-wrap gap-1">
                <span className="bg-ehc-light text-ehc-primary border border-ehc-accent px-1.5 py-0.5 rounded">適用可能</span>
                <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">期間: {s.period}</span>
                <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">補助率: {s.rate}</span>
                <span className="bg-white border border-gray-300 px-1.5 py-0.5 rounded">上限: {s.max}</span>
              </div>
              <div className="text-xs">
                <strong>要件:</strong> {s.requirement}<br />
                <strong>必要書類:</strong> {s.docs}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">条件に合致する補助金が見つかりません。条件を変更してください。</p>
        )}
      </Card>

      <Card className="mt-5">
        <CardTitle>💡 今やるべき5つの理由</CardTitle>
        <ul className="space-y-2">
          {result.reasons.map((r, i) => (
            <li key={i} className="bg-green-50 border-l-[3px] border-ehc-accent px-3 py-2.5 rounded text-sm">
              {r}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-5">
        <CardTitle>🏗 EHC 推奨プラン</CardTitle>
        <p className="text-sm">{result.ehcPlan}</p>
      </Card>
    </>
  );
}

function RoiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gradient-to-br from-yellow-50 to-amber-200 p-4 rounded-lg">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-bold text-ehc-warning mt-1">{value}</div>
    </div>
  );
}
