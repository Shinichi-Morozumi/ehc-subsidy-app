"use client";

import { useEffect, useRef, useState } from "react";
import { MatchInput, SizeType, EquipType, RefriType } from "@/lib/types";
import { estimateInvestManYenFromGroups } from "@/lib/pricing";
import { MessageCircle, Send, Sparkles, X, RotateCcw, Wand2, CheckCircle2, CornerUpLeft } from "lucide-react";

/* ───────────────────────────────────────────────────────────
   会話型AIヒアリング
   ・ITに不慣れなお客様／営業担当のどちらでも、チャットで答えるだけで
     既存フォーム（MatchInput）の各項目が自動で埋まる。
   ・「わからない」は3段階で処理：
       ① 言い換え（かんたんな代わりの質問／ざっくり選択肢）
       ② それでも不明なら アプリ既定値／実勢から自動補完
       ③ 補完した項目は「AIの概算」として最後にまとめて確認
   ・エアコンが複数の時期・系統に分かれて導入されたケースは、
     設備群を追加して系統ごとに（冷媒・設置年・台数）を登録できる。
   ・LLM APIには依存しない（オフラインでも即時・確実にフォームを充足）。
   ─────────────────────────────────────────────────────────── */

const CY = new Date().getFullYear();
const UNKNOWN = "__unknown__";
// 自由入力で「わからない」系の言葉が来たら、わからないボタンと同じ扱いにする
const UNKNOWN_WORDS = /^(わからない|分からない|わかりません|分かりません|わかんない|不明|しらない|知らない|おまかせ|お任せ|特になし|なし)$/;

// 設備群ステップの範囲（この間だけ「N系統目」を頭に付ける）
const GROUP_START = 7; // refri
const GROUP_END = 11; // hp
const MORE_STEP = 12; // moreEquip

let HGID = 0;
const newGroup = (): MatchInput["equipGroups"][number] => ({
  id: `hc${++HGID}_${Date.now()}`,
  refri: "unknown",
  equip: "ac",
  installYear: CY - 10,
  units: 1,
  hp: undefined,
});

const ALL_PREFS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];
const PREFS_IN_SELECT = ["東京都", "神奈川県", "大阪府", "埼玉県", "千葉県", "愛知県", "北海道", "福岡県", "その他"];
const prefFromAddress = (address: string): string | null => {
  const hit = ALL_PREFS.find((p) => address.includes(p));
  if (!hit) return null;
  return PREFS_IN_SELECT.includes(hit) ? hit : "その他";
};

type Tone = "sales" | "customer";
type Msg = { role: "bot" | "user"; text: string };
type Chip = { label: string; value: string; display?: string };

// 「1つ戻る」用のスナップショット
type Snap = {
  idx: number;
  phase: "ask" | "rephrase";
  messages: Msg[];
  assumed: string[];
  input: MatchInput;
  gi: number;
};

type Ctx = {
  input: MatchInput;
  setInput: React.Dispatch<React.SetStateAction<MatchInput>>;
  patchGroup: (patch: Partial<MatchInput["equipGroups"][number]>) => void;
};

type Step = {
  id: string;
  ask: (t: Tone) => string;
  chips?: Chip[];
  freeInput?: "text" | "number" | "email" | "tel" | "none";
  placeholder?: string;
  allowUnknown?: boolean; // default true
  // 自由入力の解釈。null=読み取れず → 再質問
  parse?: (raw: string) => string | null;
  apply: (value: string, ctx: Ctx) => void;
  // ① 言い換え（1回目の「わからない」で提示）
  rephrase?: { ask: (t: Tone) => string; chips?: Chip[]; freeInput?: "text" | "number" | "none"; placeholder?: string };
  // ②③ 既定値で自動補完し、AI概算として記録（noteがnullなら記録しない）
  fallback?: (ctx: Ctx) => { note: string | null };
};

// 数値抽出（カンマ・全角・単位を除去）
const toNum = (raw: string): number | null => {
  const z = raw.replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)));
  const m = z.replace(/[,，\s]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const parseYear = (raw: string): string | null => {
  const z = raw.replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)));
  let m = z.match(/(\d+)\s*年\s*(前|くらい前|ほど前)/);
  if (m) return String(CY - Number(m[1]));
  m = z.match(/令和\s*(\d+)/); if (m) return String(2018 + Number(m[1]));
  m = z.match(/平成\s*(\d+)/); if (m) return String(1988 + Number(m[1]));
  m = z.match(/(19|20)\d{2}/); if (m) return m[0];
  const n = toNum(z);
  if (n != null && n >= 1 && n <= 60) return String(CY - n); // 「12」→12年前とみなす
  return null;
};

// 設備群から年間電力使用量(kWh)をざっくり概算（台数×馬力×2.8kW×稼働2000h×稼働率0.6）
const estKwhFromGroups = (input: MatchInput): number => {
  const kwh = input.equipGroups.reduce(
    (a, g) => a + (g.units || 0) * (g.hp || 3) * 2.8 * 2000 * 0.6,
    0
  );
  return Math.max(10000, Math.round(kwh / 1000) * 1000);
};

const BUILDINGS: Chip[] = [
  { label: "オフィス・事務所", value: "office" },
  { label: "小売店舗", value: "retail" },
  { label: "飲食店", value: "restaurant" },
  { label: "ホテル・宿泊", value: "hotel" },
  { label: "医療・福祉", value: "medical" },
  { label: "学校・教育", value: "school" },
  { label: "その他", value: "other" },
];
const buildingFromText = (raw: string): string => {
  const s = raw.toLowerCase();
  if (/オフィス|事務所|office/.test(s)) return "office";
  if (/飲食|レストラン|カフェ|居酒屋|食堂|restaurant/.test(s)) return "restaurant";
  if (/小売|店舗|ショップ|物販|retail|shop|store/.test(s)) return "retail";
  if (/ホテル|旅館|宿泊|hotel/.test(s)) return "hotel";
  if (/病院|医療|クリニック|福祉|介護|medical/.test(s)) return "medical";
  if (/学校|教育|塾|school/.test(s)) return "school";
  return "";
};

const STEPS: Step[] = [
  {
    id: "company",
    ask: (t) => (t === "sales" ? "お客様の会社名を教えてください。（提案書のヘッダーに載ります）" : "御社名を教えてください。（提案書のヘッダーに表示されます）"),
    freeInput: "text",
    placeholder: "例: 株式会社○○",
    apply: (v, { setInput }) => setInput((p) => ({ ...p, customerCompany: v.trim() })),
    fallback: () => ({ note: "会社名：未入力（あとでフォームに入力してください）" }),
  },
  {
    id: "contact",
    ask: () => "ご担当者様のお名前は？（任意。なければ「わからない」でOK）",
    freeInput: "text",
    placeholder: "例: 田中",
    apply: (v, { setInput }) => setInput((p) => ({ ...p, customerContact: v.trim() })),
    fallback: () => ({ note: null }),
  },
  {
    id: "email",
    ask: () => "ご連絡用のメールアドレスを教えてください。",
    freeInput: "email",
    placeholder: "例: info@example.co.jp",
    parse: (raw) => (/\S+@\S+\.\S+/.test(raw) ? raw.trim() : null),
    apply: (v, { setInput }) => setInput((p) => ({ ...p, customerEmail: v })),
    fallback: () => ({ note: "メール：未入力（提案書PDFの送付に必要です）" }),
  },
  {
    id: "phone",
    ask: () => "お電話番号を教えてください。",
    freeInput: "tel",
    placeholder: "例: 03-1234-5678",
    parse: (raw) => {
      const digits = raw.replace(/[^\d]/g, "");
      return digits.length >= 9 ? raw.trim() : null;
    },
    apply: (v, { setInput }) => setInput((p) => ({ ...p, customerPhone: v })),
    fallback: () => ({ note: "電話：未入力（提案書PDFに必要です）" }),
  },
  {
    id: "address",
    ask: () => "所在地（ご住所）を教えてください。都道府県から地域の補助金も自動で判定します。",
    freeInput: "text",
    placeholder: "例: 東京都新宿区西新宿1-1-1 ○○ビル3F",
    apply: (v, { setInput }) => {
      const addr = v.trim();
      const pref = prefFromAddress(addr);
      setInput((p) => ({ ...p, customerAddress: addr, ...(pref ? { pref } : {}) }));
    },
    fallback: () => ({ note: "住所：未入力（提案書PDFに必要です）" }),
  },
  {
    id: "building",
    ask: () => "建物の用途はどれに近いですか？",
    chips: BUILDINGS,
    freeInput: "text",
    placeholder: "自由入力でもOK（例: 本社オフィス）",
    parse: (raw) => buildingFromText(raw) || null,
    apply: (v, { setInput }) => setInput((p) => ({ ...p, building: v })),
    fallback: ({ setInput }) => {
      setInput((p) => ({ ...p, building: "office" }));
      return { note: "建物用途：オフィスとして概算" };
    },
  },
  {
    id: "size",
    ask: () => "企業の規模はどれですか？（資本金3億円以下 or 従業員300人以下＝中小企業）",
    chips: [
      { label: "中小企業", value: "sme" },
      { label: "中堅企業", value: "middle" },
      { label: "大企業", value: "large" },
    ],
    allowUnknown: true,
    apply: (v, { setInput }) => setInput((p) => ({ ...p, size: v as SizeType })),
    fallback: ({ setInput }) => {
      setInput((p) => ({ ...p, size: "sme" }));
      return { note: "企業規模：中小企業として概算" };
    },
  },
  {
    id: "refri",
    ask: () => "エアコン（室外機）の冷媒はどれですか？室外機の側面シールに R22 / R410A / R32 と書かれています。",
    chips: [
      { label: "R22（最も古い）", value: "r22" },
      { label: "R410A（1世代前）", value: "r410a" },
      { label: "R32（現行）", value: "r32" },
      { label: "わからない / 不明", value: "unknown" },
    ],
    allowUnknown: false, // 「不明」チップが実値なので3段階処理は不要
    apply: (v, { patchGroup }) => patchGroup({ refri: v as RefriType }),
  },
  {
    id: "equip",
    ask: () => "エアコンの種類は？（パッケージ＝室内機＋室外機のセット／マルチ＝1台の室外機で複数室を空調するビル用）",
    chips: [
      { label: "パッケージ", value: "ac" },
      { label: "マルチ（ビル用）", value: "multi" },
    ],
    apply: (v, { patchGroup }) => patchGroup({ equip: v as EquipType }),
    fallback: ({ patchGroup }) => {
      patchGroup({ equip: "ac" });
      return { note: "エアコン種別：パッケージとして概算" };
    },
  },
  {
    id: "installYear",
    ask: () => "そのエアコンは、だいたい何年に設置しましたか？（西暦でも「12年前」でもOK）",
    freeInput: "text",
    placeholder: "例: 2012 / 12年前",
    parse: parseYear,
    apply: (v, { patchGroup }) => patchGroup({ installYear: Number(v) }),
    rephrase: {
      ask: () => "だいたいで大丈夫です。新しめ・普通・古い、どれに近いですか？",
      chips: [
        { label: "新しめ（5年以内）", value: String(CY - 3) },
        { label: "普通（10年前後）", value: String(CY - 10) },
        { label: "古い（15年以上）", value: String(CY - 18) },
      ],
      freeInput: "none",
    },
    fallback: ({ patchGroup }) => {
      patchGroup({ installYear: CY - 12 });
      return { note: `設置年：約${CY - 12}年（12年前想定）で概算` };
    },
  },
  {
    id: "units",
    ask: () => "そのエアコンは何台ありますか？",
    freeInput: "number",
    placeholder: "例: 5",
    parse: (raw) => {
      const n = toNum(raw);
      return n != null && n >= 1 ? String(Math.round(n)) : null;
    },
    apply: (v, { patchGroup }) => patchGroup({ units: Number(v) }),
    rephrase: {
      ask: () => "ざっくりで大丈夫です。台数の目安を選んでください。",
      chips: [
        { label: "1〜3台", value: "2" },
        { label: "4〜9台", value: "6" },
        { label: "10台以上", value: "12" },
      ],
      freeInput: "none",
    },
    fallback: ({ patchGroup }) => {
      patchGroup({ units: 5 });
      return { note: "台数：5台として概算" };
    },
  },
  {
    id: "hp",
    ask: () => "エアコンの馬力（室外機の能力）はわかりますか？わからなければ「わからない」でOK（台数で自動按分します）。",
    freeInput: "number",
    placeholder: "例: 5（馬力）",
    parse: (raw) => {
      const n = toNum(raw);
      return n != null && n > 0 ? String(n) : null;
    },
    apply: (v, { patchGroup }) => patchGroup({ hp: Number(v) }),
    fallback: ({ patchGroup }) => {
      patchGroup({ hp: undefined });
      return { note: null }; // 馬力未入力はアプリが台数で按分するため概算フラグ不要
    },
  },
  {
    id: "moreEquip",
    ask: () =>
      "他にも、別の時期や別系統で導入したエアコンはありますか？冷媒・設置年・台数が違うものは分けて登録すると、補助金・回収年数の診断精度が上がります。",
    chips: [
      { label: "いいえ、これで全部", value: "__no_more__" },
      { label: "はい、別系統を追加", value: "__more__" },
    ],
    allowUnknown: false,
    apply: () => {}, // 実処理は answer() 側で分岐
  },
  {
    id: "kwh",
    ask: () => "1年間の電力使用量（kWh）はわかりますか？電力会社の請求書の合計です。",
    freeInput: "number",
    placeholder: "例: 80000",
    parse: (raw) => {
      const n = toNum(raw);
      return n != null && n > 0 ? String(Math.round(n)) : null;
    },
    apply: (v, { setInput }) => setInput((p) => ({ ...p, kwhMode: "auto", kwh: Number(v) })),
    rephrase: {
      ask: () => "では、1ヶ月の電気代（円）はだいたいいくらですか？12ヶ月分に掛けて年間を概算します。",
      freeInput: "number",
      placeholder: "例: 120000（円/月）",
    },
    fallback: ({ input, setInput }) => {
      const est = estKwhFromGroups(input);
      setInput((p) => ({ ...p, kwhMode: "auto", kwh: est }));
      return { note: `年間電力：約${est.toLocaleString("ja-JP")}kWh（設備から概算）` };
    },
  },
  {
    id: "invest",
    ask: () => "設備投資の概算（万円）はありますか？なければ「わからない」を押すと、設備内容から自動で見積ります。",
    freeInput: "number",
    placeholder: "例: 500（万円）",
    parse: (raw) => {
      const n = toNum(raw);
      return n != null && n > 0 ? String(Math.round(n)) : null;
    },
    apply: (v, { setInput }) => setInput((p) => ({ ...p, invest: Number(v) })),
    rephrase: {
      ask: () => "自動で見積りますか？設備の台数・馬力から実勢単価で概算します。",
      chips: [{ label: "自動で見積る", value: "__auto__" }],
      freeInput: "number",
      placeholder: "金額（万円）を直接入れてもOK",
    },
    fallback: ({ input, setInput }) => {
      const est = Math.max(50, estimateInvestManYenFromGroups(input.equipGroups));
      setInput((p) => ({ ...p, invest: est }));
      return { note: `設備投資：約${est.toLocaleString("ja-JP")}万円（実勢単価で自動見積）` };
    },
  },
];

export function HearingChat({
  input,
  setInput,
  onComplete,
}: {
  input: MatchInput;
  setInput: React.Dispatch<React.SetStateAction<MatchInput>>;
  onComplete: (checkEligibility?: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tone, setTone] = useState<Tone | null>(null);
  const [idx, setIdx] = useState(0);
  const [gi, setGi] = useState(0); // 現在編集中の設備群インデックス
  const [phase, setPhase] = useState<"ask" | "rephrase">("ask");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [assumed, setAssumed] = useState<string[]>([]);
  const [history, setHistory] = useState<Snap[]>([]);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const giRef = useRef(gi);
  giRef.current = gi;

  const patchGroup = (patch: Partial<MatchInput["equipGroups"][number]>) =>
    setInput((p) => ({
      ...p,
      equipGroups: p.equipGroups.length
        ? p.equipGroups.map((g, i) => (i === giRef.current ? { ...g, ...patch } : g))
        : p.equipGroups,
    }));
  const ctx = (): Ctx => ({ input: inputRef.current, setInput, patchGroup });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, done]);

  const pushBot = (text: string) => setMessages((m) => [...m, { role: "bot", text }]);
  const pushUser = (text: string) => setMessages((m) => [...m, { role: "user", text }]);

  // 設備群ステップだけ「N系統目」を頭に付ける
  const askText = (i: number, t: Tone) =>
    (giRef.current > 0 && i >= GROUP_START && i <= GROUP_END ? `【${giRef.current + 1}系統目】` : "") + STEPS[i].ask(t);

  const start = (t: Tone) => {
    setTone(t);
    setIdx(0);
    setGi(0);
    giRef.current = 0;
    setPhase("ask");
    setAssumed([]);
    setHistory([]);
    setDone(false);
    setMessages([
      {
        role: "bot",
        text:
          t === "sales"
            ? "承知しました。営業担当モードで進めます。お客様に聞きながら、順番に答えてください。「わからない」を押せば、こちらで概算して補完します。入力ミスは「1つ戻る」でいつでも直せます。"
            : "ありがとうございます。かんたんな質問に答えるだけで、お見積り・補助金診断ができます。わからない項目は「わからない」を押せば、こちらで概算します。入力ミスは「1つ戻る」でいつでも直せます。",
      },
      { role: "bot", text: STEPS[0].ask(t) },
    ]);
  };

  const currentStep = STEPS[idx];
  const activeChips: Chip[] | undefined =
    phase === "rephrase" && currentStep?.rephrase?.chips ? currentStep.rephrase.chips : currentStep?.chips;
  const activeFree =
    phase === "rephrase" ? currentStep?.rephrase?.freeInput ?? "none" : currentStep?.freeInput ?? "none";
  const activePlaceholder =
    phase === "rephrase" ? currentStep?.rephrase?.placeholder : currentStep?.placeholder;

  const advance = (t: Tone) => {
    const next = idx + 1;
    if (next >= STEPS.length) {
      setDone(true);
      pushBot("以上で入力はそろいました。内容を確認して、提案書を作成しましょう。");
      return;
    }
    setIdx(next);
    setPhase("ask");
    pushBot(askText(next, t));
  };

  // 回答直前に状態をスナップショット（「1つ戻る」用）
  const snapshot = () =>
    setHistory((h) => [
      ...h,
      { idx, phase, messages, assumed, input: inputRef.current, gi: giRef.current },
    ]);

  const goBack = () => {
    if (!history.length) return;
    const last = history[history.length - 1];
    setIdx(last.idx);
    setPhase(last.phase);
    setMessages(last.messages);
    setAssumed(last.assumed);
    setInput(last.input);
    inputRef.current = last.input;
    setGi(last.gi);
    giRef.current = last.gi;
    setDone(false);
    setDraft("");
    setHistory((h) => h.slice(0, -1));
  };

  const answer = (value: string, display: string, isUnknown: boolean) => {
    if (!tone || done) return;
    const step = currentStep;
    snapshot();
    pushUser(display);

    if (isUnknown) {
      // ① 1回目 & 言い換えあり → 言い換えを提示（同じステップに留まる）
      if (phase === "ask" && step.rephrase) {
        setPhase("rephrase");
        pushBot(step.rephrase.ask(tone));
        return;
      }
      // ②③ 既定値で補完し、概算として記録
      const fb = step.fallback?.(ctx());
      if (fb?.note) setAssumed((a) => [...a, fb.note as string]);
      advance(tone);
      return;
    }

    // 設備群の追加ループ（別の時期・別系統）
    if (step.id === "moreEquip") {
      if (value === "__more__") {
        setInput((p) => ({ ...p, equipGroups: [...p.equipGroups, newGroup()] }));
        const nextGi = giRef.current + 1;
        giRef.current = nextGi;
        setGi(nextGi);
        setIdx(GROUP_START);
        setPhase("ask");
        pushBot(`了解です。${nextGi + 1}系統目のエアコンを伺います。`);
        pushBot(askText(GROUP_START, tone));
        return;
      }
      advance(tone); // __no_more__
      return;
    }

    // invest の「自動で見積る」
    if (value === "__auto__") {
      const est = Math.max(50, estimateInvestManYenFromGroups(inputRef.current.equipGroups));
      setInput((p) => ({ ...p, invest: est }));
      setAssumed((a) => [...a, `設備投資：約${est.toLocaleString("ja-JP")}万円（実勢単価で自動見積）`]);
      pushBot(`設備内容から約${est.toLocaleString("ja-JP")}万円と見積りました。`);
      advance(tone);
      return;
    }

    // kwh 言い換え（月額円→年間kWh概算：12倍して単価17円/kWhで割る）
    if (step.id === "kwh" && phase === "rephrase") {
      const monthly = toNum(value);
      if (monthly == null || monthly <= 0) {
        pushBot("すみません、金額を数字で教えてください（例: 120000）。");
        return;
      }
      const estKwh = Math.max(10000, Math.round((monthly * 12) / 17 / 1000) * 1000); // 概算単価17円/kWh
      setInput((p) => ({ ...p, kwhMode: "auto", kwh: estKwh }));
      setAssumed((a) => [...a, `年間電力：約${estKwh.toLocaleString("ja-JP")}kWh（電気代から概算）`]);
      pushBot(`月${monthly.toLocaleString("ja-JP")}円 × 12ヶ月で、年間 約${estKwh.toLocaleString("ja-JP")}kWh と概算しました。`);
      advance(tone);
      return;
    }

    // 自由入力の解釈
    let applied = value;
    if (!activeChips?.some((c) => c.value === value)) {
      if (step.parse) {
        const parsed = step.parse(value);
        if (parsed == null) {
          pushBot("うまく読み取れませんでした。もう一度、例のように入力してください。（わからなければ「わからない」でOKです）");
          return;
        }
        applied = parsed;
      } else {
        applied = value.trim();
        if (!applied) {
          pushBot("もう一度入力してください。");
          return;
        }
      }
    }
    step.apply(applied, ctx());
    advance(tone);
  };

  const onSubmitText = () => {
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    // 「わからない」等を打ち込んだ場合は、わからないボタンと同じ扱いにする
    const canUnk = !done && (currentStep?.allowUnknown ?? true);
    if (canUnk && UNKNOWN_WORDS.test(v.replace(/[\s　]/g, ""))) {
      answer(UNKNOWN, "わからない", true);
      return;
    }
    answer(v, v, false);
  };

  const restart = () => {
    setTone(null);
    setMessages([]);
    setIdx(0);
    setGi(0);
    giRef.current = 0;
    setPhase("ask");
    setAssumed([]);
    setHistory([]);
    setDone(false);
    setDraft("");
  };

  const canUnknown = tone && !done && (currentStep?.allowUnknown ?? true);
  const canGoBack = tone && history.length > 0;

  return (
    <>
      {/* ランチャー（閉じている時／右下固定） */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="AIヒアリングを開く"
          className="no-print fixed bottom-28 right-4 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-full bg-gradient-to-br from-ehc-500 to-ehc-700 text-white shadow-[0_10px_35px_-8px_rgba(0,166,81,0.7)] hover:from-ehc-400 hover:to-ehc-600 transition-all active:scale-95"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/15 flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
            </span>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-black">AIで入力</span>
            <span className="block text-[10px] text-white/80">会話でかんたん・最短30秒</span>
          </span>
        </button>
      )}

      {/* パネル（開いている時／右下固定） */}
      {open && (
        <div className="no-print fixed bottom-28 right-4 sm:bottom-5 sm:right-5 z-50 w-[min(380px,calc(100vw-2rem))] max-h-[70vh] sm:max-h-[76vh] flex flex-col rounded-2xl border-2 border-ehc-400/50 bg-gradient-to-br from-ehc-900/40 via-night-900 to-night-800 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.85)] ring-1 ring-ehc-400/20 overflow-hidden animate-fade-in">
          {/* ヘッダー */}
          <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-white/10 flex-shrink-0 bg-white/[0.02]">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-ehc-400 to-ehc-700 flex-shrink-0 shadow-lg shadow-ehc-600/30">
              <MessageCircle className="w-5 h-5 text-white" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="text-[14px] font-black text-white">AIヒアリング</span>
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-night-900 text-[9px] font-black">最短30秒</span>
              </span>
              <span className="block text-[10.5px] text-slate-300">会話で答えるだけ・AIが概算補完</span>
            </span>
            {tone && (
              <button
                type="button"
                onClick={restart}
                aria-label="担当モードの選択に戻る"
                className="flex items-center gap-1 px-2 h-8 rounded-lg text-[11px] text-slate-300 hover:text-white border border-white/15 hover:bg-white/10 flex-shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 戻る
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 本体 */}
          <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 pt-3">
          {!tone ? (
            <div className="text-center py-6 my-auto">
              <p className="text-sm text-slate-300 mb-3">どちらの立場で入力しますか？</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => start("sales")}
                  className="px-4 py-2.5 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white text-sm font-semibold"
                >
                  営業担当として入力
                </button>
                <button
                  type="button"
                  onClick={() => start("customer")}
                  className="px-4 py-2.5 rounded-xl bg-ehc-600 hover:bg-ehc-500 text-white text-sm font-semibold"
                >
                  お客様として入力
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 mb-3"
              >
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-cobalt-600 text-white rounded-br-sm"
                          : "bg-white/8 text-slate-100 rounded-bl-sm border border-white/10"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {/* 完了：AI概算のまとめ＋確定 */}
                {done && (
                  <div className="bg-white/5 border border-ehc-500/30 rounded-xl p-3 mt-1">
                    {assumed.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span className="text-[12px] font-bold text-amber-300">AIが概算で補完した項目</span>
                        </div>
                        <ul className="space-y-1 mb-3">
                          {assumed.map((a, i) => (
                            <li key={i} className="text-[12px] text-slate-300 flex gap-1.5">
                              <span className="text-amber-400 flex-shrink-0">•</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-slate-400 mb-3">
                          ※ 補助金額・回収年数はこれらの数値に基づく<strong className="text-slate-300">目安</strong>です。正確な金額が分かる場合は、下の入力フォームでいつでも修正できます。
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] text-slate-300 mb-3 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-ehc-400" /> すべて入力いただけました。
                      </p>
                    )}
                    <div className="mb-3 rounded-lg border border-cobalt-500/30 bg-cobalt-600/10 px-3 py-2.5">
                      <p className="text-[12px] text-slate-200 font-semibold mb-0.5">続けて、補助金の該当もチェックしますか？</p>
                      <p className="text-[11px] text-slate-400">「はい」を選ぶと、提案書作成後に最有力の補助金について要件を1問ずつ確認し、結果を要件チェック（実質負担額・回収年数）に自動反映します。</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onComplete(true);
                          setOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-ehc-500 to-ehc-600 hover:from-ehc-400 hover:to-ehc-500 text-white text-sm font-bold"
                      >
                        <Sparkles className="w-4 h-4" /> 提案書＋補助金の該当チェック
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onComplete(false);
                          setOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-ehc-500/40 text-ehc-200 hover:bg-ehc-500/10 text-sm font-bold"
                      >
                        提案書のみ作成
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setTimeout(
                            () => document.getElementById("customer-info-section")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            80
                          );
                        }}
                        className="px-3 py-2.5 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 text-sm"
                      >
                        フォームで確認・修正
                      </button>
                      <button
                        type="button"
                        onClick={goBack}
                        disabled={history.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" /> 1つ戻る
                      </button>
                      <button
                        type="button"
                        onClick={restart}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/15 text-slate-400 hover:bg-white/5 text-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> 最初から
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 回答エリア */}
              {!done && (
                <div className="space-y-2">
                  {activeChips && activeChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {activeChips.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => answer(c.value, c.display ?? c.label, false)}
                          className="px-3 py-1.5 rounded-full text-[12px] border border-cobalt-500/40 text-cobalt-100 bg-cobalt-600/10 hover:bg-cobalt-600/25"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeFree !== "none" && (
                    <div className="flex items-center gap-2">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onSubmitText();
                          }
                        }}
                        inputMode={activeFree === "number" ? "numeric" : activeFree === "tel" ? "tel" : "text"}
                        type={activeFree === "email" ? "email" : activeFree === "tel" ? "tel" : "text"}
                        placeholder={activePlaceholder ?? "入力してEnterまたはSend"}
                        className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-night-900 border border-white/15 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cobalt-500"
                      />
                      <button
                        type="button"
                        onClick={onSubmitText}
                        className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-cobalt-600 hover:bg-cobalt-500 text-white"
                        aria-label="送信"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canUnknown && (
                        <button
                          type="button"
                          onClick={() => answer(UNKNOWN, "わからない", true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border border-amber-400/40 text-amber-300 bg-amber-400/5 hover:bg-amber-400/15"
                        >
                          <Wand2 className="w-3.5 h-3.5" /> わからない / おまかせ
                        </button>
                      )}
                      {canGoBack && (
                        <button
                          type="button"
                          onClick={goBack}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] border border-white/15 text-slate-300 hover:bg-white/10"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" /> 1つ戻る
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 flex-shrink-0">
                      {giRef.current > 0 && <span className="mr-1.5 text-cobalt-300">設備{giRef.current + 1}系統目</span>}
                      {idx + 1} / {STEPS.length}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}
    </>
  );
}
