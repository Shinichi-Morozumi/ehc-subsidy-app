import { Subsidy, MatchInput, EquipGroup, EquipType } from "./types";
import { todayJst } from "./programClock";
/* 2026-09-16 EHC-0039 台帳#32:
   申請枠の読み出しは lib/targetProduct.ts の framesOf 1本に寄せる。
   ここで s.applicationFrames を直接見ると、枠の既定値の決め方が2箇所に分かれ、
   対象製品の照合（frame_undecided）と画面の確認事項がずれる。 */
import { framesOf } from "./targetProduct";

/* 2026-08-24 監査で新設。
   狙いは1つだけ ――「適格性が判定できていない制度の金額を、画面に出さない」。

   これまでの構造では、金額の可否判定は match.ts のフィルタ1本に閉じていた。
   フィルタは true/false しか返さないので、
     ・要件を満たさないから0円なのか
     ・こちらが情報を持っていないから0円なのか
   を呼び出し側が区別できず、UIは一律に「該当なし」と表示していた。
   実務ではこの2つは全く違う。前者は本当に対象外、後者は「聞けば対象かもしれない」。
   後者を「該当なし」と表示すると取れる補助金を取り逃がすし、
   逆に不明のまま金額を出すと、根拠のない数字を客に渡すことになる。

   そこで判定を3値にする:
     eligible    … 判定に必要な情報が揃い、要件を満たす → 金額を出してよい
     needs_check … 判定に必要な情報が欠けている         → 金額は出さず、不足事項を出す
     ineligible  … 要件を満たさないことが確定           → 対象外と明示する

   ここで重要なのは「不足事項」と「確認事項」を混ぜないこと。
   ・blockers / missing … 判定そのものが出来ない、または対象外が確定 → 金額を止める
   ・confirmations      … 判定は出来るが申請前に見ておくべき事      → 金額は止めない
   混ぜると、書類の話（法人か個人事業主か等）だけで全制度が0円になり、
   アプリが何も答えられなくなる。実際そうなりかけたので、明示的に分けている。

   このファイルは事実判定だけを行い、金額計算・表示文言は持たない。 */

export type EligibilityVerdict = "eligible" | "needs_check" | "ineligible";

export interface EligibilityResult {
  verdict: EligibilityVerdict;
  /** 対象外が確定した理由（そのまま画面に出してよい文言） */
  blockers: string[];
  /** 判定に必要なのに、こちらが情報を持っていない事項＝先に聞くべきこと */
  missing: string[];
  /** 判定は出来るが、申請前に確認しておく事項。金額表示は止めない */
  confirmations: string[];
  /* 2026-09-14 EHC-0039:
     missing のうち「お客様に質問しても解消しない」もの＝制度側が原因の不明。
     公募開始前・公募状況が未確認・制度情報が公式確認済みでない、の3系統。

     なぜ missing から切り出すか。C段の適合度を5段階にするとき、
       ・設置年や所在地のように「聞けば埋まる」不足   → 余地あり
       ・次回公募要領の公表待ちのように「待つしかない」不明 → 判定保留
     を同じ「余地あり」に入れると、営業側が今日アクションできる案件と
     できない案件が同じ列に並ぶ。逆に、公表待ちを「低い」に落とすと
     まだ何も分かっていない制度を否定的に見せることになる。

     重要: ここへ push する文言は missing にも同じものを push し続ける。
     programUnknowns は missing の部分集合であって置き換えではない。
     verdict の決定（blockers → missing → eligible）は一切変えない。
     変えると P0-8（開始前は needs_check）・P0-4 の回帰が崩れる。 */
  programUnknowns: string[];
  /* 2026-09-16 EHC-0039 修正2:
     confirmations のうち「制度が定める必須要件であって、まだ確認できていない」もの。

     切り出す理由。v19 の独立検収はこう指摘している ――
       「checkApplicationPrereq は対象製品型番の未確認を confirmations へ入れる。
         confirmations に残る申請条件は high を止めない。
         このため『high の不変条件184件合格』だけでは、
         型番等の必須条件を確認した証明にならない。」
     実際そのとおりで、型番も発注前かどうかも事業規模の裏付けも
     何ひとつ確認できていない案件に「適合は高い」と書けてしまっていた。

     直し方は2通りあった。
       (a) 未確認を missing へ移す → verdict が needs_check になり、全制度の金額が消える。
           このファイル冒頭に書いた「全制度が0円になり、アプリが何も答えられなくなる」道。
       (b) verdict は変えずに、high だけを止める。
     採るのは (b)。金額は「要件に矛盾が無い前提での目安」として出してよいが、
     「適合は高い」は確認できていない以上、言ってはならない。

     重要: ここへ push する文言は confirmations にも同じものを push し続ける。
     requiredUnconfirmed は confirmations の部分集合であって置き換えではない
     （programUnknowns ⊂ missing と同じ関係）。
     verdict の決定（blockers → missing → eligible）は一切変えない。 */
  requiredUnconfirmed: string[];
  /** 金額・回収年数の根拠として使ってよいか（infoOnly 制度はここで false） */
  amountUsable: boolean;
}

/** 金額を画面・提案書・メールに出してよいか。 */
export function canShowAmount(r: EligibilityResult): boolean {
  return r.verdict === "eligible" && r.amountUsable;
}

/* 制度側の状態（受付中か・公式確認済みか）。
   ここを通らないものは、要件以前に金額の根拠が無い。 */
function checkProgramState(s: Subsidy, out: EligibilityResult): void {
  if (s.closed || s.status === "closed") {
    out.blockers.push("今年度の受付は終了しています。");
  } else if (s.status === "suspended") {
    out.blockers.push("現在、公募が停止されています。");
  } else if (s.status === "upcoming") {
    /* 2026-09-14 EHC-0039: 同じ文言を missing と programUnknowns の両方へ入れる。
       missing に入れ続けるのは verdict を変えないため（P0-8）。
       programUnknowns にも入れるのは、これがお客様への質問では解消しない不明だから。 */
    pushProgramUnknown(out, "公募開始前です。要件・補助率は次回公募要領の公表待ちです。");
  } else if (s.status !== "open") {
    pushProgramUnknown(out, "公募状況が未確認です。制度ページで受付中かご確認ください。");
  }

  if (s.verificationState !== "verified") {
    const label =
      s.verificationState === "needs_review"
        ? "内容の再確認が必要"
        : s.verificationState === "stale"
        ? "最終確認から時間が経過"
        : "公式情報を取得できていない";
    pushProgramUnknown(out, `制度情報が公式確認済みではありません（${label}）。`);
  }
}

/* 2026-09-14 EHC-0039:
   制度側が原因の不明を1件登録する。missing へ入れる動作は従来どおりで、
   programUnknowns へ同じ文言を控えるだけ。呼び出し側で2行書くと
   片方だけ足す取りこぼしが必ず起きるので、1関数に閉じる。 */
function pushProgramUnknown(out: EligibilityResult, text: string): void {
  out.missing.push(text);
  out.programUnknowns.push(text);
}

/* 2026-09-16 EHC-0039 修正2:
   制度の必須要件のうち、まだ確認できていないものを1件登録する。
   confirmations へ入れる動作は従来どおりで（＝verdict も金額ゲートも変わらない）、
   requiredUnconfirmed へ同じ文言を控えるだけ。
   pushProgramUnknown と同じく、呼び出し側で2行書くと片方だけ足す取りこぼしが起きるので
   1関数に閉じる。

   文言には必ず「何を見れば確認できるか」を書くこと。
   確認手段の無い未確認は、適合度を下げるだけで次の一手が生まれない。 */
function pushRequiredUnconfirmed(out: EligibilityResult, text: string): void {
  out.confirmations.push(text);
  out.requiredUnconfirmed.push(text);
}

/* 申請者側の属性要件。情報が「無い」のか「合わない」のかを必ず区別する。 */
function checkApplicant(s: Subsidy, input: MatchInput, out: EligibilityResult): void {
  if (!s.biz.includes(input.bizType)) {
    out.blockers.push("対象となる事業者区分に該当しません。");
  }
  if (!s.size.includes(input.size)) {
    out.blockers.push("対象となる企業規模に該当しません。");
  }
  if (s.pref !== "all") {
    if (!input.pref) {
      out.missing.push("所在地（都道府県）が未入力のため、地域要件を判定できません。");
    } else if (!s.pref.includes(input.pref)) {
      out.blockers.push("対象地域外です。");
    }
  }
  /* 法人か個人事業主かで提出書類が変わる（登記事項証明書 / 確定申告書）。
     ただし採否そのものを左右しないので、金額は止めない。 */
  if (!input.entityType) {
    out.confirmations.push("法人・個人事業主の別が未確認です（提出書類が変わります）。");
  }
}

/* 設備要件。1グループでも対象種別があれば満たす（match.ts と同じ考え方）。 */
function checkEquipment(s: Subsidy, groups: EquipGroup[], out: EligibilityResult): void {
  if (!groups.length) {
    out.missing.push("対象設備が未入力のため、設備要件を判定できません。");
    return;
  }
  if (!groups.some((g) => s.target.includes(g.equip))) {
    out.blockers.push("対象設備の種別に該当しません。");
  }
  if (groups.some((g) => !g.installYear)) {
    out.confirmations.push("設置年が未入力の設備があります（削減効果の根拠になります）。");
  }
}

/* 申請前提（対象製品・発注前・事業規模の裏付け・希望時期）。

   2026-09-10 EHC-0038 P0-4:
   これらの文言は ProgramMatchBoard.tsx の中で、判定とは無関係に
   直接 missing 配列へ push されていた。画面には「不足事項」として並ぶのに、
   バケット判定にも金額ゲートにも一切効いていない。
   つまり同じカードが「これが足りません」と言いながら、同じ枠内で確定額を出していた。
   必須条件の一覧と金額ゲートは、同じ判定結果から出さなければ意味がない。
   よって文言の作成場所をここへ移し、1件ずつ「金額を止めるか否か」を明示する。

   止めない側に置いた理由も必ず残す。ここを取り違えると、
   このファイル冒頭に書いたとおり「全制度が0円になり、アプリが何も答えられなくなる」。 */
function checkApplicationPrereq(s: Subsidy, input: MatchInput, out: EligibilityResult): void {
  const category = s.programCategory ?? "equipment";

  if (category === "equipment") {
    /* ───── 対象製品リストへの登録（型番） ─────
       2026-09-16 修正2 で扱いを変えた。
       従来はただの confirmations で、high を一切止めなかった。
       だが対象製品リストに無い機種は、他の要件を全て満たしていても補助されない。
       これは「申請前に見ておくとよい事」ではなく、制度が定める必須要件である。

       missing へは入れない（入れると全設備制度が needs_check で固定され金額が消える）。
       requiredUnconfirmed へ入れて、適合度の「高い」だけを止める。

       true にしてよいのは、EHC担当者が実際に公募要領・対象製品一覧と
       突き合わせたときだけ。診断入力の型番は**既設機**の銘板であって
       導入予定機器ではないので、それを根拠に true にしない（lib/types.ts 参照）。 */
    /* 2026-09-16 v2 §2:
       読む先を「制度IDごとの確認結果」へ移した。
       単一の targetProductChecked は制度を区別しないので、
       A制度で確認した型番がB制度でも確認済みになってしまう。
       targetProductChecks が渡されている場合は、その制度の値だけを見る
       （他制度の true は一切効かない）。渡されていない場合だけ、
       受入テスト用の直接入力口として従来の boolean を見る。 */
    const checkedForThisProgram =
      input.targetProductChecks !== undefined
        ? input.targetProductChecks[s.id] === true
        : input.targetProductChecked === true;

    if (!checkedForThisProgram) {
      /* 文言は lib/targetProduct.ts が作った説明（未確認の理由＋次の一手）を優先する。
         あちらは「型番が未入力」「設備群が未選択」「以前の記録が別年度」など
         状態ごとに違う文を返す。ここで1文に潰すと、画面を見た人は
         何をすれば進むのか分からない。 */
      const note = input.targetProductNotes?.[s.id];
      pushRequiredUnconfirmed(
        out,
        note ??
          "導入予定機器の型番が、当該年度の対象製品リストに登録されているかを確認できていません（公募要領の対象製品一覧、またはSIIの補助対象製品検索でご確認ください）。"
      );
    }

    /* ───── 交付決定前の着手 ─────
       交付決定前に契約・発注・着工していると対象外にする制度が多い。
       従来は「尋ねる設問が無く、判定材料が存在しない」ことを理由に
       confirmations へ置いていたが、v19 で設問（DiagnosisState.contractStatus）を作った。
       設問があるのに判定へ渡していなかったので、答えを使う。

       契約済み … 対象外の可能性が高いが、交付決定日との前後は個別確認が要る。
                  こちらで「対象外」と断定はしない。判定できない事実として missing。
       見積中／未発注 … 着手前と答えている。確認事項として残すが high は止めない。
       未回答     … 必須要件が未確認。requiredUnconfirmed。 */
    if (input.contractStatus === "contracted") {
      out.missing.push(
        "すでに契約・発注済みとのご回答です。交付決定前に着手した工事は対象外になる制度が多く、交付決定日との前後を確認しないと判定できません。"
      );
    } else if (input.contractStatus === "not_yet" || input.contractStatus === "quoting") {
      out.confirmations.push(
        "着手前とのご回答です。交付決定の通知を受けるまでは契約・発注・着工を行わないでください（行うと対象外になります）。"
      );
    } else {
      pushRequiredUnconfirmed(
        out,
        "契約・発注・着工の状況が未回答です。交付決定前に着手した工事を対象外とする制度が多いため、契約書・注文書の日付をご確認ください。"
      );
    }

    /* ───── 事業規模の裏付け ─────
       事業規模は自己申告。checkApplicant() は同じ自己申告を根拠に「対象外」を確定させている。
       除外の根拠に使っている以上、採る側でも裏付けの有無を適合度に反映させる。 */
    /* 2026-09-25 適合チェック: 「資本金・従業員数を書類で示せるか」の回答を使う。
       はい … お客様の自己申告として受け取り、必須要件の未確認からは外す（申請時に書類を出す）。
              「使える見込みが高い」は、対象製品の型番（EHC が確認）が別に止めているので、
              自己申告だけで high に届くことはない。
       いいえ … 区分を示せないと申請できないことがある。未確認のまま、理由を書き換える。
       分からない・未回答 … 従来どおり。 */
    if (!input.employeeCount) {
      if (input.sizeDocs === "yes") {
        out.confirmations.push(
          "資本金・従業員数は、決算書・登記事項証明書などで示せるとのご回答です（申請時に提出します）。"
        );
      } else if (input.sizeDocs === "no") {
        pushRequiredUnconfirmed(
          out,
          "資本金・従業員数を書類で示せないとのご回答です。中小企業などの区分を書類で示せないと、申請できない場合があります。"
        );
      } else {
        pushRequiredUnconfirmed(
          out,
          "企業規模の裏付けを確認できていません（登記事項証明書・決算書の資本金と、賃金台帳等の常時使用する従業員数でご確認ください）。"
        );
      }
    }
  } else {
    /* 雇用・研修・レジリエンス系は空調設備費の補助制度ではない。
       設問（雇用保険・採用研修計画）に答えが無ければ関連可否そのものを判定できないので、
       ここは missing でよい。設備側の金額は amountUsable の区分ゲートで別に止めているため、
       「全制度が0円になる」副作用は起きない。 */
    if (!input.employeeCount) {
      out.missing.push("従業員数が未確認のため、この制度の要件を判定できません。");
    }
    if (!input.employmentInsurance || input.employmentInsurance === "unknown") {
      out.missing.push("雇用保険の適用状況が未確認のため、この制度の要件を判定できません。");
    }
    if (!input.hiringOrTrainingPlan || input.hiringOrTrainingPlan === "unknown") {
      out.missing.push("採用・研修・雇用管理改善の計画が未確認のため、この制度の要件を判定できません。");
    }
  }

  /* 希望時期。「まだ決めていない」は回答であって不明ではない。
     発注済みかどうかを判別できる設問でもないので、金額は止めない。 */
  if (!input.desiredTiming || input.desiredTiming === "undecided") {
    out.confirmations.push(
      "契約・発注・導入の希望時期が未定です。受付期限に間に合うかは、時期が決まってからの判定になります。"
    );
  }
}

/* 制度ごとの個別要件。match.ts に散っていた id 判定をここへ集約する。
   ここに挙げていない制度は「本アプリで個別要件を自動判定していない」だけで、
   要件が無いという意味ではない。だから確認事項として必ず出す。

   2026-09-10 EHC-0038 P0-4:
   以前はこの集合に8件が入っていたが、下の checkProgramSpecific() に実際の分岐があるのは
   kanagawa と hotel_sustainability の2件だけだった。
   残る6件（sii_iv / sii_gx / osaka / tokyo_zeroemi / saitama / chiba）は
   何も判定していないのに「自動判定済み」として扱われ、
   「公募要領でご確認ください」の確認事項が画面から消えていた。
   自動判定していない制度を判定済みに見せるのは、判定していないことより悪い。
   この集合は「分岐を書いた制度」だけを載せる。分岐を足したらここにも足すこと。 */
const PROGRAM_SPECIFIC_HANDLED = new Set([
  "kanagawa",
  "hotel_sustainability",
  /* 2026-09-16 EHC-0039 台帳#32 で追加。
     下の checkProgramSpecific() に、この2制度の分岐を実際に書いた
     （省エネ量要件・補助事業ポータル登録・GXの申請枠）。
     分岐を書いたのでここへ載せる。逆に、ここへ載せるだけで分岐を書かないのは
     P0-4 で直した事故そのものなので、絶対にしない。 */
  "sii_iv",
  "sii_gx",
]);

/* 2026-09-11 EHC-0038 P0-10:
   制度が定める CO2削減量のしきい値。ここに挙げた値は、
   「判定に使うしきい値」であると同時に「表示を丸めてまたいではいけない境界」でもある。
   2.96t を 3.0t と表示しながら「3t未満で対象外」と言えば、画面が自分の判定を否定する。
   表示側（lib/match.ts の displayCo2Ton）がこの配列を読んで境界だけ桁を増やすので、
   CO2のしきい値を持つ制度を足すときは、必ずここにも足すこと。 */
export const KANAGAWA_CO2_MIN_TON = 3;
export const CO2_REQUIREMENT_THRESHOLDS_TON: readonly number[] = [KANAGAWA_CO2_MIN_TON];

function checkProgramSpecific(
  s: Subsidy,
  input: MatchInput,
  ctx: { co2ReductionTon: number | null },
  out: EligibilityResult
): void {
  if (s.id === "kanagawa") {
    /* 2026-09-11 EHC-0038 P0-10:
         以前ここは値の falsy 判定で分岐していた。そのため
         算定できていない（null）場合と、算定して0tだった場合が同じ枝に入った。
         結果、削減0t＝要件未達が確定している案件が
         「CO2削減量を算定できていない」＝needs_check になり、
         「聞けば対象かもしれない制度」としてバケットBに並んでいた。
         算定できていない（null）と、算定した値（0・負値を含む）は別物として扱う。 */
    if (ctx.co2ReductionTon == null) {
      out.missing.push("CO2削減量を算定できていないため、県の削減要件を判定できません。");
    } else if (ctx.co2ReductionTon < KANAGAWA_CO2_MIN_TON) {
      out.blockers.push(
        `CO2削減量が要件（${KANAGAWA_CO2_MIN_TON}t/年以上）に達していません。`
      );
    }
  }
  if (s.id === "hotel_sustainability" && input.building !== "hotel") {
    out.blockers.push("宿泊施設が対象の制度です。");
  }

  /* ───── SII 設備単位型 / GX設備単位型（2026-09-16 EHC-0039 台帳#32）─────
     この2制度は本アプリの主力提案先なのに、個別要件の分岐が1つも無く
     「公募要領でご確認ください」の一般文言しか出ていなかった。
     一般文言は「何を確認すればよいか」を含まないので、営業側の次の一手が生まれない。

     ここで出す3件は、いずれも**制度が定める必須要件**であって、
     満たさなければ他の要件を全て満たしても交付されない。
     したがって confirmations だけでなく requiredUnconfirmed へ入れ（＝適合度の「高い」を止め）、
     missing へは入れない（入れれば needs_check になり、主力2制度の金額が常に消える。
     このファイル冒頭に書いた「アプリが何も答えられなくなる」道）。

     省エネ量の要件を blockers / missing にしない理由:
     本アプリは削減量をCO2換算（t/年）でしか持っておらず、
     制度が見る原油換算（kl/年）と投資回収効率（kl/千万円）を算定していない。
     算定していない値で「未達」とも「達成」とも言えないので、
     確認すべき必須要件として出すのが事実に合う。 */
  if (s.id === "sii_iv" || s.id === "sii_gx") {
    pushRequiredUnconfirmed(
      out,
      "省エネルギー量の要件を満たすかを確認できていません。本アプリの概算はCO2削減量（t/年）で、制度が見る原油換算（kl/年）・投資回収効率（kl/千万円）を算定していません。3次公募要領（r7h_st_01_kouboyouryou_3.pdf）の省エネ量要件（省エネ率10%以上／省エネ量1kl以上／投資回収効率1kl per 千万円以上のいずれか）と、SII指定の省エネ計算書でご確認ください。"
    );
    /* 2026-09-25 適合チェック: 登録の有無はお客様が答えられる。
       はい … 自己申告として受け取り、必須要件の未確認からは外す。
       いいえ … 未確認のまま、「申請前に登録が必要」という次の一手に書き換える。 */
    if (input.siiPortal === "yes") {
      out.confirmations.push("補助事業ポータルに事業者登録済みとのご回答です。");
    } else if (input.siiPortal === "no") {
      pushRequiredUnconfirmed(
        out,
        "補助事業ポータルに未登録とのご回答です。この制度は申請書類をポータル上で作成するため、申請前に事業者登録（ID発行）が必要です。登録は即日で完了しない前提で、締切から逆算して進めてください。"
      );
    } else {
      pushRequiredUnconfirmed(
        out,
        "補助事業ポータルの事業者登録（ID発行）が済んでいるかを確認できていません。この制度は申請書類をポータル上で作成するため、登録が無いと申請自体ができません。登録は即日で完了しない前提で、締切（2026/9/28 17:00必着）から逆算してご確認ください。"
      );
    }
  }

  /* GXは枠で補助率も対象製品一覧も変わる。枠が決まらないうちは
     「この制度は適合が高い」と言える状態にならない。
     枠の件数は lib/targetProduct.ts の framesOf に合わせる（対象製品側の
     frame_undecided と同じ根拠で出す。片方だけ直すと画面の言うことが食い違う）。 */
  if (s.id === "sii_gx") {
    const frames = framesOf(s);
    if (frames.length > 1) {
      pushRequiredUnconfirmed(
        out,
        `どの申請枠（${frames.join("／")}）で申請するかが決まっていません。枠によって補助率（メーカー強化枠 1/3以内／トップ性能枠 更新1/2以内・新設1/5以内）と対象製品一覧が変わるため、枠が決まるまで補助額は安全側（1/3）の概算です。導入予定機器の性能値と3次公募要領の指定型番でどちらの枠に載るかをご確認ください。`
      );
    }
  }

  if (!PROGRAM_SPECIFIC_HANDLED.has(s.id)) {
    out.confirmations.push(
      "この制度は個別要件を本アプリで自動判定していません。公募要領でご確認ください。"
    );
  }
}

/* 申請期間。締切超過は対象外が確定するので blockers。
   期間が未確定なだけなら確認事項に留める（制度自体は生きている）。

   2026-09-10 EHC-0038 P0-8（その1・時刻）:
     ここは `now.toISOString().slice(0, 10)` で「今日」を作っていた。
     toISOString() は必ずUTCを返すので、JSTで 9/11 00:00〜08:59 の9時間は
     today が 9/10 のままになる。制度の公募要領はJSTで書かれているから、
     この9時間は「締切当日を過ぎているのに受付中」「開始当日なのに開始前」と
     判定が丸一日ずれる。しかも毎朝必ず起きるので、気付いたときには
     何件その状態で提案書を出したか分からない。
     日付の出どころは lib/programClock.ts の todayJst() 1本に寄せる
     （lib/subsidies.ts の inferStatus も同じ関数の today を使っている）。

   2026-09-10 EHC-0038 P0-8（その2・開始前の扱い）:
     公募開始前を confirmations に入れていた。confirmations は
     「判定はできるが申請前に見ておく事」であって金額を止めない。
     つまり開始前の制度が verdict=eligible のままバケットAへ入り、
     canShowAmount() が true になって補助額・実質負担・回収年数まで出ていた。
     次回公募の要件・補助率・上限は公表前で、いまの数字を当てる根拠がない。
     開始前は missing に入れる（→ needs_check → バケットB）。
     lib/subsidies.ts の inferStatus が status を upcoming にする経路では
     checkProgramState() が既に missing へ入れているが、
     制度データが status を明示している場合はその推論を通らない。
     日付から直接判定するここでも同じ結論を出しておく。 */
function checkWindow(s: Subsidy, now: Date, out: EligibilityResult): void {
  const today = todayJst(now);
  if (s.applyClose && s.applyClose < today) {
    out.blockers.push(`申請締切（${s.applyClose}）を過ぎています。`);
    return;
  }
  if (s.applyOpen && s.applyOpen > today && s.status !== "upcoming") {
    // status が upcoming の制度は checkProgramState() が同じ趣旨を1件入れている。
    // 同じ画面に同じ意味の行を2つ並べない（不足事項は「次の一手」の一覧なので、重複は雑音になる）。
    pushProgramUnknown(
      out,
      `公募開始（${s.applyOpen}）前です。次回公募の要件・補助率・上限は公表前のため、補助額は算定できません。`
    );
  }
  if (!s.applyOpen && !s.applyClose) {
    out.confirmations.push("公募期間が未確定です。制度ページで最新の受付期間をご確認ください。");
  }
}

/* 2026-09-11 EHC-0038 P0-10:
   ctx.co2ReductionTon は「表示用に丸めた値」ではなく「丸める前の値」を渡すこと。
   小数第1位で丸めた値を渡すと、2.96t が 3.0t になって
   3t要件の制度が対象外→適合に反転する（再現済み: 2.96／2.99 の2件）。
   null は「算定できていない」を表す。0 は「算定した結果が0t」であって不明ではない。 */
export function checkEligibility(
  s: Subsidy,
  input: MatchInput,
  ctx: { co2ReductionTon: number | null; now?: Date }
): EligibilityResult {
  const out: EligibilityResult = {
    verdict: "needs_check",
    blockers: [],
    missing: [],
    confirmations: [],
    programUnknowns: [],
    requiredUnconfirmed: [],
    /* 2026-09-10 EHC-0038 P0-4:
       以前は infoOnly だけを見ていた。本アプリの金額は「設備投資額 × 補助率」で計算しており、
       雇用・研修系の助成金にこの式を当てると、設備費と無関係な額が
       実質負担・回収年数へ流れ込む。いまは該当制度が全て infoOnly なので表には出ていないが、
       それはデータ側のたまたまの一致でしかなく、infoOnly を付け忘れた制度を1件足せば破れる。
       構造として「設備区分でない制度」と「補助率を持たない制度」は金額の根拠にしない。
       （補助上限0の扱い＝上限なし／未確認／0 の区別は P0-7 で別途扱う。ここでは触らない） */
    amountUsable:
      !s.infoOnly &&
      (s.programCategory ?? "equipment") === "equipment" &&
      Number.isFinite(s.rateNum) &&
      s.rateNum > 0,
  };

  checkProgramState(s, out);
  checkApplicant(s, input, out);
  checkApplicationPrereq(s, input, out);
  checkEquipment(s, input.equipGroups, out);
  checkProgramSpecific(s, input, ctx, out);
  checkWindow(s, ctx.now ?? new Date(), out);

  if (s.infoOnly) {
    out.confirmations.push(
      "情報提供のみの制度です。補助額・回収年数の計算には含めていません。"
    );
  }

  out.verdict = out.blockers.length
    ? "ineligible"
    : out.missing.length
    ? "needs_check"
    : "eligible";
  return out;
}

/* ───────────── 適合度（C段の5段階） ─────────────

   2026-09-14 EHC-0039 v3指示 §C段:
     適合度は「不可／低い／余地あり／高い／判定保留」の5段階とする。
     判定はこのファイルに集約し、ResultStage.tsx の中に条件を足さない。

   禁止事項を先に書く。実装中に迷ったらここへ戻ること。
     ・不明件数による加点をしない。
       「不足が2件だから低い、1件だから高い」は、不足の中身を見ていない。
       所在地1件の不足と、公募要領の公表待ち1件は、意味も次の一手も違う。
     ・A→高い の一律変換をしない。
       バケットAは「blockersが無く公式確認済みの設備制度」でしかなく、
       入力した設備のうち何群が対象かを見ていない。
       3群入れて1群しか対象でない制度をAだからと「高い」に置くと、
       客は全設備が対象だと読む。
     ・採択確率を作らない。
       本アプリは審査基準も競争倍率も持っていない。
       「70%」「可能性が高い」は、持っていない情報を出すこと。
       ここが返すのは事実の分類だけで、確率ではない。

   段階の決め方は「次に誰が何をするか」で分ける。順序に意味がある。
     1. 不可     … 要件と矛盾が確定（blockers）。誰が何をしても今回は変わらない。
     2. 判定保留 … 制度側が原因の不明（programUnknowns）。
                   公表・公式確認を待つしかなく、お客様に質問しても解消しない。
     3. 余地あり … お客様に聞けば埋まる不足（missing）。こちらの次の一手がある。
     4. 低い／高い … 不足も不明も無い。ここで初めて、事実だけで濃淡を付ける。

   2 を 3 より先に見るのは、programUnknowns が missing の部分集合だから。
   順序を入れ替えると、公表待ちの制度が全部「余地あり」に落ちる。 */
export type FitLevel5 = "not_possible" | "low" | "possible" | "high" | "on_hold";

/* ───── 2026-09-16 EHC-0039 修正2：2つの軸を分ける ─────

   v19 の独立検収の2点目はこうだった ――
     「現行 low は一部対象種別の不一致だけでなく、アプリが補助額を出せない
       情報提供制度にも付く。アプリの算定能力と制度適合性は別であり、
       算定できないという理由だけで『適合は低い』としない。」

   そのとおりで、たとえば小規模事業者持続化補助金は infoOnly として
   金額計算から外してあるだけで、制度への適合が低いわけではない。
   「適合は低い」と表示すれば、営業は候補から落とす。落としてよい根拠が無い。

   よって軸を2本にする。
     level  … 制度の要件に合うか（＝申請できそうか）
     amount … 本アプリがこの制度で金額を出せるか（＝画面に数字が並ぶか）
   amount.calculable が false であることは、level を下げる理由にしない。 */
export interface FitAmountAxis {
  /** 本アプリで補助額・回収年数を算定する対象か */
  calculable: boolean;
  /** 算定しない場合の理由。calculable が true のときは null */
  note: string | null;
}

/* 設備群の種類。input.equipGroups に入らなかった群も含めて数えるため、
   EquipType（ac / multi）に加えてルームエアコンと未確定を表せるようにする。

   "room" を "ac" へ変換しないこと（修正2 の明文の禁止事項）。
   業務用の補助制度は対象機器が業務用に限られるので、変換した瞬間に
   対象になるはずのない設備へ補助額が付いた画面が出る。 */
export type FitGroupKind = EquipType | "room" | "unknown" | null;

export interface FitContext {
  /* 試算に含めなかった群の「種類」。lib/diagnosisProjection.ts の
     unresolvedGroups から、群の kind をそのまま並べて渡す。

     件数（数）ではなく種類（何だったか）を渡すのは、
     　・ルームエアコン    → 種別として対象外であることが分かっている
     　・種類未選択／不明  → 対象かどうかが分かっていない
     　・ac/multi だが台数や設置年が未入力 → 種別は対象。試算に入れていないだけ
     の3つが、適合度に対して別々の意味を持つため。
     件数だけでは「対象外が確定した群」と「まだ何も分かっていない群」を区別できず、
     区別できないと、どちらへ倒しても嘘になる。 */
  excludedKinds?: FitGroupKind[];
}

export interface FitAssessment {
  level: FitLevel5;
  /** その段階になった事実。推測・確率は入れない。画面にそのまま出してよい */
  why: string[];
  /** 算定可否の軸。level とは独立。画面はこれを別の行として出す */
  amount: FitAmountAxis;
}

/* 算定可否の軸を作る。level には一切触れない。 */
function amountAxisOf(s: Subsidy, r: EligibilityResult): FitAmountAxis {
  if (r.amountUsable) return { calculable: true, note: null };
  if (s.infoOnly) {
    return {
      calculable: false,
      note: "この制度は情報提供のみの扱いとしており、本アプリでは補助額・回収年数を算定していません（制度への適合が低いという意味ではありません）。",
    };
  }
  if ((s.programCategory ?? "equipment") !== "equipment") {
    return {
      calculable: false,
      note: "この制度は設備投資への補助ではないため、本アプリの「投資額×補助率」では金額を算定していません（制度への適合が低いという意味ではありません）。",
    };
  }
  return {
    calculable: false,
    note: "この制度は補助率が確認できていないため、本アプリでは補助額を算定していません（制度への適合が低いという意味ではありません）。",
  };
}

interface FitCoverage {
  /** 適合度を下げる事実（対象種別でない群がある） */
  facts: string[];
  /** 下げないが伝える注記（試算に含めていない群がある等） */
  notes: string[];
  /** 種別が分からないため、対象かどうかを判定できない群がある */
  undetermined: string[];
  /** 「すべて対象種別です」と言い切ってよいか */
  allMatched: boolean;
  total: number;
  matched: number;
}

/* 案件全体の設備群を、この制度の対象種別と突き合わせる。

   突き合わせる対象は input.equipGroups だけではない。
   試算に含めなかった群（ルームエアコン等）も「お客様が持っている設備」であり、
   そこを見ないまま「すべて対象種別です」と書くと、
   お客様は全設備が対象だと読む。これは assessFit 冒頭の禁止事項そのもの。

   一方で、ここで数えた群を金額計算へ戻すことはしない。
   数えるのは対象種別の突き合わせと、分母の提示のためだけ。 */
function buildCoverage(
  s: Subsidy,
  included: EquipGroup[],
  excludedKinds: FitGroupKind[]
): FitCoverage {
  const includedMatched = included.filter((g) => s.target.includes(g.equip)).length;
  const includedUnmatched = included.length - includedMatched;

  let excludedMatched = 0; // 対象種別だが、台数・設置年が未入力で試算に入れていない
  let excludedRoom = 0; // ルームエアコン。業務用の制度では対象種別でない
  let excludedOther = 0; // 対象種別でない業務用機（target に無い equip）
  let excludedUnknown = 0; // 種類未選択・不明

  for (const k of excludedKinds) {
    if (k === "room") excludedRoom += 1;
    else if (k == null || k === "unknown") excludedUnknown += 1;
    else if (s.target.includes(k)) excludedMatched += 1;
    else excludedOther += 1;
  }

  const total = included.length + excludedKinds.length;
  const matched = includedMatched + excludedMatched;

  const facts: string[] = [];
  const notes: string[] = [];
  const undetermined: string[] = [];

  if (includedUnmatched > 0) {
    facts.push(
      `試算に含めた設備${included.length}群のうち、この制度の対象種別は${includedMatched}群です。残る${includedUnmatched}群はこの制度の対象種別ではありません。`
    );
  }
  if (excludedRoom > 0) {
    facts.push(
      `ご入力のうち${excludedRoom}群はルームエアコンです。この制度は業務用設備が対象のため、ルームエアコンは対象種別に含まれません（別の制度・別のご提案でお取り扱いします）。`
    );
  }
  if (excludedOther > 0) {
    facts.push(
      `ご入力のうち${excludedOther}群は、この制度の対象種別ではありません。`
    );
  }
  if (excludedUnknown > 0) {
    undetermined.push(
      `設備の種類が未選択・不明の群が${excludedUnknown}群あります。種類が分かるまで、この制度の対象になるかどうかを判定できません（対象外が確定したという意味ではありません）。`
    );
  }
  if (excludedMatched > 0) {
    notes.push(
      `このほかに、この制度の対象種別ではあるものの、台数または設置年が未入力のため試算に含めていない設備が${excludedMatched}群あります。`
    );
  }

  return {
    facts,
    notes,
    undetermined,
    allMatched: total > 0 && matched === total,
    total,
    matched,
  };
}

export function assessFit(
  s: Subsidy,
  input: MatchInput,
  r: EligibilityResult,
  /* 第4引数は 2026-09-16 修正2 で数値からオブジェクトへ変えた。
     従来は「試算に含めなかった群の件数」だけを受け取り、注記の1行にしか使っていなかった。
     件数だけでは、ルームエアコン（対象種別でないと分かっている）と
     種類未選択（何も分かっていない）を区別できない。
     区別できないので、どちらへ倒しても嘘になる ―― これが
     「実入口から low が一度も出ない」状態の原因でもあった。
     既定値 {} で、projection を持たない呼び出し側（CustomerReport.tsx 等）は従来どおり。 */
  ctx: FitContext = {}
): FitAssessment {
  const amount = amountAxisOf(s, r);
  const cov = buildCoverage(s, input.equipGroups ?? [], ctx.excludedKinds ?? []);

  if (r.blockers.length) {
    return { level: "not_possible", why: r.blockers, amount };
  }
  if (r.programUnknowns.length) {
    return { level: "on_hold", why: [...r.programUnknowns, ...cov.undetermined, ...cov.facts], amount };
  }
  /* 更新監視（/api/subsidies/monitor）で公式ページの変化・取得失敗が出ている制度は、
     checkEligibility() を回した時点では verified だった可能性がある。
     監視結果はビルド時点の制度データより新しいので、こちらを優先して判定保留に落とす。
     呼び出し側は監視結果を反映した Subsidy（effectiveSubsidy）を渡すこと。
     r 側で既に拾えている場合は上の programUnknowns で返っているので、二重にはならない。 */
  if (s.verificationState !== "verified") {
    return {
      level: "on_hold",
      why: [
        "公式ページの更新監視で変化または取得失敗が出ています。最新の公募要領で要件をご確認ください。",
        ...cov.undetermined,
        ...cov.facts,
      ],
      amount,
    };
  }

  /* 「余地あり」に入るのは3系統。いずれも**次の一手がある**という点で同じ。
       ・r.missing            … お客様に聞けば埋まる不足
       ・r.requiredUnconfirmed … こちらが公募要領・書類を確認すれば埋まる必須要件（修正2）
       ・cov.undetermined     … 設備の種類が分からず、対象かどうかを判定できない群

     requiredUnconfirmed をここで見ることが修正2の核心。
     これがある限り high へは進まないので、
     型番・着手前・企業規模の裏付けが未確認の案件に「適合は高い」とは出ない。
     一方 verdict は eligible のままなので、金額と回収年数は従来どおり出る
     （＝「全制度が0円になる」副作用を起こさない）。 */
  if (r.missing.length || r.requiredUnconfirmed.length || cov.undetermined.length) {
    return {
      level: "possible",
      why: [
        ...r.missing,
        ...r.requiredUnconfirmed,
        ...cov.undetermined,
        ...cov.facts,
        ...cov.notes,
      ],
      amount,
    };
  }

  /* ここから先は verdict === "eligible" かつ必須要件も確認済み。
     残る濃淡は「持っている設備のうち、何群がこの制度の対象種別か」だけ。

     2026-09-16 修正2:
       以前はここで !r.amountUsable も low の根拠にしていた。やめた。
       算定できないことは制度への不適合ではない（amount 軸へ分離済み）。
       結果、算定対象でない制度は「余地あり」または「高い」として残り、
       金額が出ないことは amount.note として別行で伝わる。 */
  if (cov.facts.length) {
    return { level: "low", why: [...cov.facts, ...cov.notes], amount };
  }

  /* 「入力した設備」と書かない。ここで言い切れるのは cov が
     試算に含めた群と含めなかった群の両方を突き合わせた結果、
     対象外の群が1つも無かったときだけ（cov.allMatched）。 */
  const whyHigh: string[] = [];
  if (cov.allMatched) {
    whyHigh.push(`ご入力の設備${cov.total}群は、すべてこの制度の対象種別です。`);
  } else if (cov.total > 0) {
    whyHigh.push(`ご入力の設備${cov.total}群のうち${cov.matched}群が、この制度の対象種別です。`);
  }
  whyHigh.push("事業者区分・企業規模・地域・申請期間のいずれにも矛盾は見つかりませんでした。");
  whyHigh.push("制度情報は公式確認済みで、現在受付中です。");
  whyHigh.push("対象製品リストへの登録・着手前であること・企業規模の裏付けも確認済みです。");
  return { level: "high", why: [...whyHigh, ...cov.notes], amount };
}

/* ───────────── 併用（重複受給）の可否 ─────────────

   併用可否は各制度の公募要領に書かれた事項であり、こちらで断定できない。
   断定できないものを「併用可」と表示すると、返還リスクを客に負わせる。
   なので返り値に「併用可」は用意しない。不可が確定しているか、要確認かの2値。 */
export type CombineVerdict = "not_allowed" | "needs_confirmation";

export interface CombineResult {
  verdict: CombineVerdict;
  reason: string;
}

/** 同一の設備・経費に対して重ねて申請できない組み合わせ。 */
const EXCLUSIVE_PAIRS: Array<[string, string]> = [
  ["sii_iv", "sii_gx"], // 同一SII内の枠違い。同じ設備で両枠には出せない
];

export function canCombine(aId: string, bId: string): CombineResult {
  if (aId === bId) {
    return { verdict: "not_allowed", reason: "同一制度への二重申請はできません。" };
  }
  const hit = EXCLUSIVE_PAIRS.some(
    ([x, y]) => (x === aId && y === bId) || (x === bId && y === aId)
  );
  if (hit) {
    return {
      verdict: "not_allowed",
      reason: "同一の設備・経費に対して、この2制度を重ねて申請することはできません。",
    };
  }
  return {
    verdict: "needs_confirmation",
    reason:
      "同一経費への重複受給の可否は各制度の公募要領に定めがあります。併用を前提とした金額は提示せず、申請前に双方の事務局へご確認ください。",
  };
}

/* 複数制度の合算額を出してよいか。
   併用可を断定できない以上、2件以上の合算は出さない（安全側）。
   本アプリが「最大額1件」を採用しているのは、この判断による。 */
export function canSumAmounts(ids: string[]): boolean {
  return ids.length <= 1;
}
