import { Subsidy } from "./types";
import { todayJst } from "./programClock";

// 補助金データの確認日（注記・鮮度表示に使用）。データ更新時はここも更新。
export const SUBSIDY_DATA_ASOF = "2026年8月27日";

const RAW_SUBSIDIES: Subsidy[] = [
  {
    id: "sii_iv",
    verificationState: "verified",
    /* 2026-08-27 監査での修正 ─ 3次公募の受付開始を検知できていなかった件
       監視先が syouenehojyokin.sii.or.jp/（ポータルのトップ）だったため、
       2026/8/20 に始まった3次公募をアプリが認識できず、
       2次の締切（2026/7/9）を根拠に「終了」と表示し続けていた。
       締切まで約1か月ある制度を「終了」と案内していたことになる。
       公募情報ページ（overview3.html）を直接見るように差し替える。
       出典: https://sii.or.jp/setsubi07r/overview3.html ＜令和8年8月20日（木）更新＞
             公募期間 2026年8月20日（木）〜2026年9月28日（月）※17:00必着／交付決定 11月下旬予定 */
    applyOpen: "2026-08-20",
    applyClose: "2026-09-28",
    scheduleNote: "3次公募 受付中（2026/8/20〜9/28 17:00必着）。交付決定は11月下旬予定。1次・2次は終了",
    name: "SII 省エネ・非化石転換補助金（設備単位型）",
    org: "一般社団法人 環境共創イニシアチブ（経済産業省）",
    period: "令和7年度補正 3次公募：2026/8/20〜2026/9/28（17:00必着）",
    rate: "1/3以内",
    max: "1億円（事業全体）",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme", "middle", "large"],
    pref: "all",
    requirement: "省エネルギー量の要件あり。指定設備（高効率空調等）導入。補助事業ポータル登録必須",
    docs: "事業計画書・見積書・省エネ計算書・設備カタログ・登記簿等",
    url: "https://sii.or.jp/setsubi07r/overview3.html",
    /* 設備単位型とGX設備単位型は同一公募の2類型で、公募情報ページを1枚で共有している。
       この共有は設計上正しく、ページが更新されれば両方を見直せばよいので監視も成立する。
       意図した共有であることを宣言し、coverage_gap の誤検知を止める。 */
    sourceSharedGroup: "sii_setsubi07r_kobo3",
    rateNum: 1 / 3, // 公募要領の「1/3以内」。0.33 と書くと補助額が数千円ずれる（2026-08-24 監査）
    capManYen: 10000,
    adoptionRate: "非公表（省エネ量・費用対効果で審査。要件充足で採択可能性）",
    difficulty: "高",
    difficultyNote: "省エネ計算書・事業計画・補助事業ポータル登録が必須。審査型で書類量が多い",
    useOfFunds: "SIIが指定する高効率空調の設備費（対象設備・対象経費は公募要領と型番リストで確認）",
    nextCheck: "3次公募要領（r7h_st_01_kouboyouryou_3.pdf）で対象設備・省エネ量要件を確認。9/28 17:00必着のため書類準備の逆算を先に行う。交付決定前の発注は対象外",
  },
  {
    id: "sii_gx",
    verificationState: "verified",
    // 2026-08-27 監査での修正。設備単位型と同一公募のため日程・出典は同じ（sii_iv のコメント参照）
    applyOpen: "2026-08-20",
    applyClose: "2026-09-28",
    scheduleNote: "3次公募 受付中（2026/8/20〜9/28 17:00必着）。交付決定は11月下旬予定。1次・2次は終了",
    name: "SII GX設備単位型（メーカー強化枠／トップ性能枠）",
    org: "一般社団法人 環境共創イニシアチブ",
    period: "令和7年度補正 3次公募：2026/8/20〜2026/9/28（17:00必着）",
    rate: "メーカー強化枠：1/3以内／トップ性能枠：更新1/2以内・新設1/5以内",
    max: "3億円",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme", "middle", "large"],
    pref: "all",
    requirement: "省エネ要件 10%/1kl/1kl千万円のいずれか達成。トップランナー水準機器",
    docs: "SII事業計画書・型番リスト・省エネ計算書",
    url: "https://sii.or.jp/setsubi07r/overview3.html",
    sourceSharedGroup: "sii_setsubi07r_kobo3", // sii_iv と同一公募の2類型。意図した共有（types.ts 参照）
    // どの区分に該当するか未確認の段階では、メーカー強化枠の1/3を安全側の概算に使う
    rateNum: 1 / 3, // 公募要領の「1/3以内」。0.33 と書くと補助額が数千円ずれる（2026-08-24 監査）
    capManYen: 30000,
    adoptionRate: "非公表（トップランナー水準機器で要件充足が前提）",
    difficulty: "高",
    difficultyNote: "トップランナー水準機器＋省エネ要件(10%/1kl等)の立証が必要",
    useOfFunds: "SIIが指定する高性能な空調設備の設備費（申請区分・対象型番により補助率が異なる）",
    nextCheck: "メーカー強化枠／トップ性能枠のどちらか、指定型番、省エネ要件を3次公募要領で確認。締切 9/28 17:00必着",
  },
  {
    id: "kanagawa",
    verificationState: "verified",
    applyOpen: "2026-06-01",
    applyClose: "2026-11-30",
    closed: true,
    /* 2026-08-27 最新化: 公式ページ（更新日 2026年8月18日）の新着情報で締切日が確定した。
       令和8年7月27日 予算額の70%到達 → 7月30日 80% → 8月3日 90% →
       **令和8年8月6日「申請額が予算額に到達したため、申請を締め切りました」**。
       当初予定の 11月30日 を待たず、受付開始から約2か月で枠が尽きたことになる。
       実績報告書の様式が8月18日に公開済み（令和8年度事業は令和9年3月31日までに完了、
       報告は完了から2か月以内または令和9年4月15日のいずれか早い日まで）。 */
    scheduleNote: "2026/8/6に申請額が予算額へ到達し受付終了（当初予定 11/30 を待たず終了）。次年度公募は未発表",
    name: "神奈川県 中小企業省エネルギー設備導入費等補助金",
    org: "神奈川県",
    period: "2026/6/1受付開始 → 2026/8/6 予算額到達により受付終了（当初予定は11/30まで）",
    rate: "1/3",
    // 上限600万円になるのは「かながわ再エネ電力利用認定事業者」または
    // 「かながわ脱炭素チャレンジ中小企業認証制度」の認証を受けた場合の2通り（2026-08-27 公式ページで確認）
    max: "500万円（再エネ電力利用認定または脱炭素チャレンジ認証で600万円）",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme"],
    pref: ["神奈川県"],
    requirement: "CO2削減量 3t/年以上。県内事業所。エアコン・LED・ボイラー等が対象",
    docs: "事業計画書・省エネ計算書・見積書・現況写真",
    url: "https://www.pref.kanagawa.jp/docs/ap4/cnt/f7226/shouenesetubihojokin.html",
    rateNum: 1 / 3, // 公募要領の「1/3以内」。0.33 と書くと補助額が数千円ずれる（2026-08-24 監査）
    capManYen: 500,
    adoptionRate: "先着順・予算枠方式（要件充足かつ枠内なら採択。前年度は早期終了）",
    difficulty: "中",
    difficultyNote: "CO2削減計算と見積が必要だが自治体先着型で審査は比較的シンプル。早期の枠確保がカギ",
    useOfFunds: "県内事業所の高効率空調など、省エネ設備の設備費・工事費（対象範囲は要領で確認）",
    nextCheck: "次年度公募の有無、県内事業所、年間CO2削減3t以上、発注前であることを確認",
  },
  {
    id: "hotel_sustainability",
    verificationState: "verified",
    closed: true,
    scheduleNote: "令和7年度は終了（追加公募なし）。令和8年度公募は未発表・ウォッチ中",
    name: "宿泊施設サステナビリティ強化支援事業",
    org: "観光庁",
    period: "令和7年度 終了（追加公募なし）。令和8年度の公募は未発表",
    rate: "1/2",
    max: "1,000万円（1事業者あたり最大3施設）",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme", "middle", "large"],
    pref: "all",
    requirement: "旅館業法の許可取得。高付加価値経営旅館等の登録（または申請中）。宿泊事業者と施工業者が同一会計でないこと。同一事業者で3施設以内。空調更新等が対象（採択率 約91%実績）",
    docs: "旅館業許可・図面/機器リスト・見積書・登録証・申請ポータル登録・実績報告書",
    /* 2026-08-27 監査での修正: 監視先が観光庁トップだったため、この制度が改定されても検知できなかった。
       制度ページ（最終更新 2025-03-24）に差し替える。
       あわせて観光庁「公募情報 2026年」一覧（kobo_2026_00003.html）を全件確認したが
       本事業の掲載は無く、令和8年度公募は未発表。closed: true のままで正しい。 */
    url: "https://www.mlit.go.jp/kankocho/kobo06_00025.html",
    rateNum: 0.5,
    capManYen: 1000,
    adoptionRate: "約91%（令和7年度実績・要件充足前提）",
    difficulty: "中",
    difficultyNote: "旅館業許可・高付加価値経営旅館の登録が前提だが、採択率が高く要件を満たせば通りやすい",
    useOfFunds: "宿泊施設の空調更新など、サステナビリティ向上に資する設備導入費",
    nextCheck: "令和8年度公募の有無、旅館業許可、高付加価値経営旅館等の登録状況を確認",
  },
  {
    id: "osaka",
    verificationState: "verified",
    applyOpen: "2026-04-13",
    applyClose: "2026-06-30",
    closed: true,
    scheduleNote: "2026/6/30で受付終了（2次募集なし）。申請1,201件に対し交付決定591件（49.2%・2026/8/21時点）",
    name: "大阪府 中小事業者高効率空調機導入支援事業（R8）",
    org: "大阪府",
    period: "2026/4/13〜6/30 受付終了（先着順・交付決定まで約4か月）",
    rate: "1/2",
    max: "500万円（下限20万円）",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme"],
    pref: ["大阪府"],
    requirement: "脱炭素経営宣言登録事業者。府内事業所。高効率空調機",
    docs: "宣言登録証・事業計画書・見積書・カタログ",
    /* 2026-08-27 監査での修正: 監視先が大阪府トップだったため改定を検知できなかった。
       制度ページに差し替え、あわせて交付決定件数を最新に更新。
       出典: https://www.pref.osaka.lg.jp/o120020/eneseisaku/sec/r08hojokin-pac.html
             （更新日 2026年8月21日）申請1,201件→交付決定591件（令和8年8月21日時点）。
       受付終了（2026/6/30）・補助率1/2・上限500万円・下限20万円・千円未満切捨ては変更なし。 */
    url: "https://www.pref.osaka.lg.jp/o120020/eneseisaku/sec/r08hojokin-pac.html",
    rateNum: 0.5,
    capManYen: 500,
    adoptionRate: "先着順・予算枠方式（R8は申請1,201件→交付決定591件・49.2%・2026/8/21時点）",
    difficulty: "中",
    difficultyNote: "脱炭素経営宣言の登録＋書類。先着型で審査自体は要件確認中心",
    useOfFunds: "府内事業所の高効率空調機の設備費・導入費",
    nextCheck: "次年度公募の有無、脱炭素経営宣言、府内事業所、未発注かを確認",
  },
  {
    id: "tokyo_zeroemi",
    verificationState: "verified",
    applyOpen: "2026-09-16",
    applyClose: "2026-10-02",
    scheduleNote: "第3回は8/14で終了。次回第4回は9/16〜10/2、第5回11/9〜11/20、第6回2027/1/18〜1/29。予算超過時は先着順ではなく抽選",
    name: "東京都 ゼロエミッション化に向けた省エネ設備導入・運用改善支援事業",
    org: "東京都地球温暖化防止活動推進センター（クール・ネット東京）",
    period: "令和8年度：第4回 2026/9/16〜10/2（以降、第5回11/9〜11/20、第6回2027/1/18〜1/29）",
    rate: "2/3（省エネ診断受診）※28t-CO2以上削減の区分は3/4",
    max: "2,500万円（診断受診2/3）／1,000万円（自己作成2/3）※28t-CO2以上削減の3/4区分は最大4,500万円。本ツールは安全側に 2/3・上限2,500万円 で試算",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme"],
    pref: ["東京都"],
    requirement: "都内の中小規模事業所。高効率空調等の指定省エネ設備。省エネ診断の受診または自己作成の省エネ計画。CO2/エネルギー削減の要件あり",
    docs: "交付申請書・省エネ診断書または省エネ計画・見積書・設備仕様書・現況写真",
    url: "https://www.tokyo-co2down.jp/subsidy/zeroemi-shoene/",
    rateNum: 2 / 3, // 公募要領の「2/3」。0.667 と書くと補助額が数千円ずれる（2026-08-24 監査）
    capManYen: 2500,
    adoptionRate: "予算枠方式（要件充足で交付。回次ごとの予算枠あり・早めの申請推奨）",
    difficulty: "中",
    difficultyNote: "省エネ診断の受診または自己作成の省エネ計画が必要。補助率2/3と高い分、書類はやや多め",
    useOfFunds: "都内中小規模事業所の高効率空調など、省エネ設備の設備費・工事費",
    nextCheck: "省エネ診断受診区分か自己計画区分か、CO2削減要件、対象事業所、第4回に必要書類が揃うかを確認",
  },
  {
    id: "saitama",
    verificationState: "verified",
    /* 2026-08-27 最新化 ─ 「受付終了」は誤りだった
       公式ページ（掲載日 2026年8月17日）の新着情報:
         令和8年7月6日 募集開始 → 7月24日 募集終了 → 8月7日 追加募集の申請期間を掲載
         → **令和8年8月17日 2次募集を開始**
       交付申請期間は 初回 7/6〜7/24 17時必着 ／ **2次 2026/8/17〜9/14 17時必着** ／
       3次 2026/10/13〜11/9 予定（予算残額に応じて実施）。先着順ではない。
       追加募集の予算額は約4,000万円（初回は8,983万円）。
       以前は「業務用空調が対象外だから」という理由で closed: true を立てていたが、
       それは受付状態の嘘であり、SII 3次公募を「終了」と表示していたのと同じ誤りである。
       対象外であることは target: [] が担保する（マッチングには一切入らない）ので、
       受付状態は事実どおり「2次募集 受付中」にする。 */
    applyOpen: "2026-08-17",
    applyClose: "2026-09-14",
    scheduleNote: "2次募集 受付中（2026/8/17〜9/14 17時必着・先着順ではない）。3次募集は2026/10/13〜11/9予定（予算残額に応じて実施）。※R8対象は太陽光・蓄電池・再エネ発電・熱利用・コージェネ・EMS等で、業務用空調（エアコン）は補助対象外のため本ツールの試算には含めません",
    name: "埼玉県 企業等における省エネ・再エネ活用設備導入補助金",
    org: "埼玉県",
    period: "令和8年度：初回 2026/7/6〜7/24（終了）／2次 2026/8/17〜9/14 17時必着／3次 10/13〜11/9予定（予算 初回8,983万円・追加約4,000万円）",
    rate: "1/2〜2/3（設備区分による）",
    max: "上限1,500〜2,500万円（設備区分による。コージェネ2,500万円等）※業務用空調は対象外",
    target: [], // 業務用空調（ac/multi）は R8 対象外
    biz: ["business"],
    size: ["sme"],
    pref: ["埼玉県"],
    requirement: "県内の事業所。あんしん事業者（企業等向け）認定業者との契約で導入。R8対象は太陽光・蓄電池・その他再エネ発電・熱利用・基盤インフラ（自営線/蓄熱/熱導管/EMS）・コージェネ。※業務用空調（エアコン）は対象外",
    docs: "交付申請書・事業計画・見積書・設備仕様書・現況写真・決算報告書等",
    url: "https://www.pref.saitama.lg.jp/a0503/datutanso.html",
    rateNum: 0.5,
    capManYen: 2500,
    adoptionRate: "予算枠方式（初回8,983万円・追加募集約4,000万円）。先着順ではなく、期間内に不備なく提出された申請を審査",
    difficulty: "中",
    difficultyNote: "あんしん事業者認定業者との契約が前提。R8は再エネ・コージェネ中心で空調は対象外の点に注意",
  },
  {
    id: "chiba",
    verificationState: "verified",
    closed: true,
    /* 2026-08-27 最新化: applyClose が 2026-10-07 で、同じ行の scheduleNote が言う
       「診断費のみは12/11まで」と食い違っていた。どちらが正なのか読み手に判断させる状態は危険なので、
       公式の期間に合わせる。省エネルギー診断受診費のみの交付申請は
       令和8年5月15日（金）〜**令和8年12月11日（金）**（期間内でも予算がなくなり次第終了）。
       設備導入分は予算額到達により 2026/8/14 に受付終了で、こちらは変更なし。
       いずれにせよ closed: true なので試算・締切バナーには出ない（情報として保持する日付）。 */
    applyClose: "2026-12-11",
    scheduleNote: "設備導入の申請は予算額到達により2026/8/14に受付終了。省エネ診断費のみの申請は2026/12/11まで（予算がなくなり次第終了）",
    name: "千葉県 業務用設備等脱炭素化促進事業補助金",
    org: "千葉県",
    period: "令和8年度：設備導入は予算額到達により2026/8/14受付終了（診断費のみは12/11まで）",
    rate: "1/2（省エネ診断あり）／1/4（簡易自己診断）",
    max: "1,000万円（省エネ診断あり）",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme"],
    pref: ["千葉県"],
    requirement: "県内の中小事業者等。省エネルギー診断の受診（または簡易自己診断）に基づく高効率空調等の脱炭素設備導入。CO2削減見込みに応じて対象",
    docs: "交付申請書・省エネ診断報告書・見積書・設備仕様書・現況写真",
    url: "https://www.pref.chiba.lg.jp/ontai/hojo/r8jigyousyahojo.html",
    rateNum: 0.5,
    capManYen: 1000,
    adoptionRate: "予算枠方式（2026/8/14に予算到達で設備導入申請を終了）",
    difficulty: "高",
    difficultyNote: "省エネ診断の受診が前提（補助率1/2）。簡易自己診断なら手間は減るが補助率1/4に低下",
    useOfFunds: "県内中小事業者の高効率空調など、脱炭素設備の設備費・工事費",
    nextCheck: "次年度公募の有無、省エネ診断区分、県内事業所、対象設備を確認",
  },
  {
    id: "jizokuka",
    verificationState: "verified",
    applyOpen: "2026-11-05",
    applyClose: "2026-12-15",
    name: "小規模事業者持続化補助金 第20回（一般型・通常枠）",
    org: "全国商工会連合会 / 日本商工会議所（中小企業庁）",
    period: "令和8年度：受付 2026/11/5〜12/15 17:00（電子申請のみ・GビズIDプライム必須。様式4の発行受付締切 12/4）",
    rate: "2/3（赤字賃上げは3/4）",
    max: "50万円（インボイス特例+50・賃上げ特例+150で最大250万円）",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme"],
    pref: "all",
    requirement: "小規模事業者のみ（商業・サービス業5人以下／製造業その他20人以下）。販路開拓・業務効率化の取組が対象で、商工会・商工会議所の支援を受け事業計画を作成。設備購入が補助対象経費に含まれるかは計画内容次第（単なる更新・修繕は対象外）。大企業・中堅は対象外。",
    docs: "経営計画書・補助事業計画書・事業支援計画書(様式4/商工会等発行)・GビズIDプライム・電子申請(Jグランツ)",
    url: "https://www.chusho.meti.go.jp/keiei/shokibo/jizoku/",
    rateNum: 2 / 3, // 公募要領の「2/3」。0.667 と書くと補助額が数千円ずれる（2026-08-24 監査）
    capManYen: 50,
    infoOnly: true,
    adoptionRate: "約48%（第18回 48.1%／通常枠・年度回次で変動）",
    difficulty: "中",
    difficultyNote: "商工会・商工会議所の支援を受け経営計画を作成。GビズID・電子申請。空調単純更新は対象外の点に注意",
    useOfFunds: "販路開拓・業務効率化の事業計画に必要な機械装置等費。空調の単純更新・修繕は対象外",
    /* 2026-08-27 最新化: 受付 11/5〜12/15 は変更なし（第20回公募要領・中小企業庁 2026-05-27 公開）。
       実務上の本当の締切は締切日ではなく、事業支援計画書（様式4）の発行受付締切 2026/12/4 である。
       ここを過ぎると商工会・商工会議所が様式4を出せず、12/15 まで日があっても申請できない。 */
    nextCheck: "小規模事業者の従業員要件、販路開拓との関連、GビズIDプライム（取得に数週間）、様式4の発行受付締切 2026/12/4 を確認",
  },
  {
    id: "mhlw_human_resources",
    name: "人材開発支援助成金（関連可能性の確認枠）",
    org: "厚生労働省",
    period: "コース・訓練計画により異なるため公式要件を個別確認",
    rate: "コース・企業規模・訓練内容により異なる",
    max: "コース・対象者数により異なる",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme", "middle", "large"],
    pref: "all",
    requirement: "雇用保険適用事業所であること等の共通要件に加え、訓練計画・対象労働者・実施時期など各コースの要件確認が必要。空調更新費そのものの助成制度ではありません",
    docs: "雇用保険関係書類・訓練計画・受講記録・賃金台帳等（コースにより異なる）",
    /* 2026-08-27 監査での修正: 監視先が分野トップ（jinzaikaihatsu/index.html）で、
       この助成金の改定を検知できなかった。制度の申請書類一覧ページに差し替える。
       様式の差し替えが最も頻繁に起きるページなので、改定の兆候を掴みやすい。
       出典: https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1_00011.html
             最新の申請書類は「令和8年8月3日以降に計画届を提出された方」向けの一式。 */
    url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1_00011.html",
    rateNum: 0,
    capManYen: 0,
    infoOnly: true,
    programKind: "grant",
    programCategory: "training",
    status: "unknown",
    verificationState: "needs_review",
    useOfFunds: "空調更新に伴う従業員研修・リスキリング等がある場合の関連制度。設備費には算入しません",
    nextCheck: "雇用保険の適用、訓練計画、対象者、訓練開始前の計画届期限を確認",
  },
  {
    id: "mhlw_workplace_support",
    name: "人材確保等支援助成金（関連可能性の確認枠）",
    org: "厚生労働省",
    period: "コース・取組内容により異なるため公式要件を個別確認",
    rate: "コース・取組内容により異なる",
    max: "コース・取組内容により異なる",
    target: ["ac", "multi"],
    biz: ["business"],
    size: ["sme", "middle", "large"],
    pref: "all",
    requirement: "雇用管理改善等の取組と各コース要件の確認が必要。空調設備の単純更新を対象とする制度ではありません",
    docs: "雇用管理制度計画・就業規則・賃金台帳等（コースにより異なる）",
    url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199292.html",
    rateNum: 0,
    capManYen: 0,
    infoOnly: true,
    programKind: "grant",
    programCategory: "employment",
    status: "unknown",
    verificationState: "needs_review",
    useOfFunds: "雇用管理改善や人材確保の取組に関連する可能性を確認する枠。設備費には算入しません",
    nextCheck: "該当コース、雇用保険、計画認定・提出期限、設備更新との関係を確認",
  },
];

/* 人が公式ページを最後に確認した日時。これは「記録」なので固定リテラルのままで正しい。
   受付状態の判定には絶対に使わない（使うと時間が止まる）。 */
const OFFICIAL_CHECKED_AT = "2026-08-27T09:00:00+09:00";

/* 2026-08-24 監査での修正:
   以前は STATUS_REFERENCE_DATE = "2026-08-18" という固定リテラルで受付状態を判定していたため、
   ビルド後に時間が経つほど「締切を過ぎた制度を受付中と表示する」事故が起きていた。
   判定基準日は実行時のJSTの今日（lib/programClock.ts）に統一する。 */
function inferStatus(s: Subsidy, today: string): Subsidy["status"] {
  if (s.status) return s.status;
  if (s.closed) return "closed";
  if (s.applyOpen && s.applyOpen > today) return "upcoming";
  if (s.applyClose && s.applyClose < today) return "closed";
  if (s.applyClose && s.applyClose >= today) return "open";
  // 開始日だけ判明していて締切未定の回は、開始日を過ぎていれば受付中とみなす
  if (s.applyOpen && !s.applyClose && s.applyOpen <= today) return "open";
  return "unknown";
}

// 制度ごとに公式参照先・確認日時・受付状態を保持する。
// 更新監視で変更を検知した場合は verificationState を needs_review に落とし、A判定から除外する。
//
// 2026-08-24 監査での修正:
//   以前は module-level の `const SUBSIDIES` で、プロセス起動時に1回だけ status を確定していた。
//   ブラウザなら1セッションで済むが、Vercelのlambdaはプロセスが生き続けるため、
//   日付をまたぐと「昨日の判定」を返し続ける＝直したはずの時間停止バグが再発する。
//   そこで「JSTの今日」をキーにしたキャッシュ付き関数にして、日付が変われば必ず再計算させる。
let _subsidyCacheKey = "";
let _subsidyCache: Subsidy[] = [];

function normalize(s: Subsidy, today: string): Subsidy {
  return {
    ...s,
    programKind: s.programKind ?? "subsidy",
    programCategory: s.programCategory ?? "equipment",
    status: inferStatus(s, today),
    // verificationState は types.ts で必須にした。
    // 「未記入なら verified」という既定値は、制度を追加した人が確認を忘れただけで
    // 補助額の計算対象に入ってしまう設計だったので廃止した。
    officialCheckedAt: s.officialCheckedAt ?? OFFICIAL_CHECKED_AT,
    sourceType: s.sourceType ?? "official_page",
    sourceUrl: s.sourceUrl ?? s.url,
    fetchedAt: s.fetchedAt ?? OFFICIAL_CHECKED_AT,
    prepLeadDaysMin: s.prepLeadDaysMin ?? (s.difficulty === "高" ? 35 : 21),
    prepLeadDaysMax: s.prepLeadDaysMax ?? (s.difficulty === "高" ? 56 : 42),
  };
}

/** 正規化済みの制度一覧。受付状態は「呼んだ時点のJSTの今日」で判定される。 */
export function getSubsidies(now: Date = new Date()): Subsidy[] {
  const today = todayJst(now);
  if (today === _subsidyCacheKey) return _subsidyCache;
  _subsidyCacheKey = today;
  _subsidyCache = RAW_SUBSIDIES.map((s) => normalize(s, today));
  return _subsidyCache;
}

/* 見積シミュレーター用の代表補助率プリセット。
   ラベルは上の SUBSIDIES に実在する制度（rateNum）に対応させること。
   ※以前は「1/2＝SII先進等」「1/3＝自治体等」と実態と食い違うラベルで、
     顧客前の説明で誤解を招く状態だった（SIIの設備単位型は1/3、GX設備単位型が1/2）。 */
export const SUBSIDY_RATE_PRESETS: { key: string; label: string; rate: number }[] = [
  { key: "none", label: "補助金なし", rate: 0 },
  /* 2026-08-24 監査での修正: 0.667 / 0.33 という丸めた小数を使っていた。
     公募要領の補助率は 2/3・1/3 という分数であって 0.667・0.33 ではない。
     500万円に対して 0.667 は 3,335,000円、正しい 2/3 は 3,333,333円で、
     1,667円ずれる。この誤差が「見積書と診断書で補助額が数百円合わない」の正体。
     以後、補助率は必ず分数のまま持ち、丸めは最後の1回だけ行う。 */
  { key: "two_thirds", label: "2/3（東京ゼロエミ等・制度確認後）", rate: 2 / 3 },
  { key: "half", label: "1/2（GXトップ性能枠・大阪/千葉ほか）", rate: 1 / 2 },
  { key: "third", label: "1/3（SII 設備単位型・GXメーカー強化枠・神奈川）", rate: 1 / 3 },
];
