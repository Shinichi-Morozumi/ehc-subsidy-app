// v1 / 2026-10-29 / EHC-0102 制度カードからの相談（lib/programLead.ts・app/api/program-lead）の検査。
// nodemailer と fetch は記録するだけの偽物に差し替える。実メール・実Notionには1件も出ない。
const sent = [];
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const loaded = new Map();
function loadTs(filename) {
  const absolute = path.resolve(root, filename);
  if (loaded.has(absolute)) return loaded.get(absolute).exports;
  const mod = { exports: {} };
  loaded.set(absolute, mod);
  const nativeRequire = createRequire(absolute);
  const localRequire = (specifier) => {
    const candidate = specifier.startsWith("@/")
      ? path.resolve(root, specifier.slice(2))
      : specifier.startsWith(".") ? path.resolve(path.dirname(absolute), specifier) : null;
    if (candidate) {
      if (candidate.endsWith(".ts") && fs.existsSync(candidate)) return loadTs(candidate);
      if (fs.existsSync(`${candidate}.ts`)) return loadTs(`${candidate}.ts`);
    }
    if (specifier === "nodemailer") {
      return { createTransport() { return { async sendMail(m) { sent.push(m); return { messageId: `test-${sent.length}` }; } }; } };
    }
    return nativeRequire(specifier);
  };
  const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: absolute,
  }).outputText;
  vm.runInThisContext(`(function(exports, require, module, __filename, __dirname) {\n${compiled}\n})`, { filename: absolute })(
    mod.exports, localRequire, mod, absolute, path.dirname(absolute),
  );
  return mod.exports;
}


const L = loadTs("lib/programLead.ts");
const A = loadTs("lib/adConsultation.ts");
const M = loadTs("lib/adMeasurement.ts");
const uuid = "a1b2c3d4-1234-4567-8901-123456789abc";
const future = ["2027-01-04T13:00", "2027-01-05T14:00", "2027-01-06T15:00"];
const ad = (variant="lp", o={}) => ({ variant, requestId: uuid, pref: "東京都", city: "中野区", industry: "工場・倉庫", budget: "1,500万〜3,000万円未満", campaign: A.AD_CAMPAIGN, test: true, consultation: { mode: "zoom", timezone: "Asia/Tokyo", preferredDates: future }, ...o });
const form = (a=ad()) => ({ company:"営業対象外・架空テスト",name:"公開確認",reach:"info@ehcjpn.com",consent:true,source:"tokyo",programIds:["tokyoZeroemi"],ad:a,hp:"",elapsedMs:8000 });
const req = body => new Request("https://ehcjpn.com/api/program-lead", {method:"POST",headers:{"Content-Type":"application/json","x-forwarded-for":"10.12.0.1"},body:JSON.stringify(body)});

test("広告2経路：候補3日時・所在地・Bの回答はサーバでも必須。過去・重複・壊れた日付・不正値を拒否",()=>{
  const now = new Date("2026-11-03T09:00:00+09:00");
  for (const variant of ["lp","diagnosis"]) assert.equal(A.readAdConsultation(ad(variant),now).error,null);
  for(const bad of [ {consultation:null}, {city:""}, {variant:"unknown"}, {requestId:"123"}, {pref:"<script>"},
    {consultation:{mode:"zoom",timezone:"Asia/Tokyo",preferredDates:[future[0],future[0],future[2]]}},
    {consultation:{mode:"zoom",timezone:"Asia/Tokyo",preferredDates:["2026-02-30T13:00",future[1],future[2]]}},
    {consultation:{mode:"zoom",timezone:"Asia/Tokyo",preferredDates:["2026-11-01T13:00",future[1],future[2]]}}]) assert.ok(A.readAdConsultation(ad("lp",bad),now).error,JSON.stringify(bad));
  assert.ok(A.readAdConsultation(ad("diagnosis",{budget:null}),now).error);
  assert.equal(A.readAdConsultation(ad("lp",{industry:null,budget:null}),now).error,null);
  assert.equal(A.readAdConsultation(null,now).error,null,"通常フォームを壊さない");
});
test("3項目の結果は相談目安。都外・低予算・未定で補助額や適合の断定を作らない",()=>{
  assert.match(A.adGuidance("神奈川県",A.AD_BUDGETS[2]).reason,/都内の事業所向け/);
  assert.match(A.adGuidance("東京都",A.AD_BUDGETS[0]).reason,/800万円を超える/);
  assert.match(A.adGuidance("東京都",A.AD_BUDGETS[4]).reason,/採択や金額は決まっていません/);
});
test("メール・CRM：同じ受付にA/B・3日時・市区町村・試験除外・紹介元を保持、金額は未確定",()=>{
  for(const variant of ["lp","diagnosis"]){
    const body=form(ad(variant)); body.referral={ref:"krh01-clinic",landedAt:new Date().toISOString(),landing:"/tokyo"};
    const r=L.readProgramSubmit(body);assert.equal(r.ok,true);
    const lead=L.programLead(r.input,`EHCAD-${uuid}`,"2026-11-03"); const mail=L.programStaffMail(r.input,`EHCAD-${uuid}`,"2026-11-03");
    assert.equal(lead.address,"東京都 中野区");assert.equal(lead.subsidyYen,undefined);
    for(const d of future){assert.ok(lead.memo.includes(d.replace("T"," ")));assert.ok(mail.text.includes(d.replace("T"," ")));}
    assert.match(lead.memo,/営業対象外/);assert.match(mail.subject,/Zoom候補日時/);assert.match(mail.subject,/営業対象外/);
    assert.match(lead.memo,/紹介元 KRH01/);assert.match(lead.memo,/未確定/);
  }
});
test("広告受付：同じIDの再試行はNotionを確認し、二重保存・二重メールをしない。不明時は閉じる",async()=>{
  const {POST}=loadTs("app/api/program-lead/route.ts");
  const oldFetch=global.fetch;let exists=false, creates=0;
  process.env.NOTION_TOKEN="unit-test-only";process.env.SMTP_USER="info@ehcjpn.com";process.env.SMTP_PASS="unit-test-only";process.env.DIAGNOSIS_MAIL_MODE="staff";process.env.VERCEL_ENV="production";
  global.fetch=async(url,init)=>{
    if(String(url).endsWith("/query")) return Response.json({results:exists?[{id:"mock"}]:[]});
    creates++;exists=true;return Response.json({id:"mock"});
  };
  const before=sent.length;
  try {
    const first=await POST(req(form()));assert.equal(first.status,200);assert.equal((await first.json()).notified,true);
    const second=await POST(req(form()));assert.equal(second.status,200);assert.equal((await second.json()).duplicate,true);
    assert.equal(creates,1);assert.equal(sent.length,before+1);assert.deepEqual(sent.at(-1).to,["info@ehcjpn.com"]);assert.deepEqual(sent.at(-1).cc,["info@project-neo.co.jp"]);
    global.fetch=async()=>new Response("blocked",{status:403});
    const fail=await POST(req(form(ad("diagnosis",{requestId:"b1b2c3d4-1234-4567-8901-123456789abc"}))));assert.equal(fail.status,503);assert.equal(sent.length,before+1);
  } finally {global.fetch=oldFetch;for(const k of ["NOTION_TOKEN","SMTP_USER","SMTP_PASS","DIAGNOSIS_MAIL_MODE","VERCEL_ENV"]) delete process.env[k];}
});
test("CV：無同意・不正IDは送らず、成功受付IDだけ一度。Googleへ氏名・連絡先・日時を渡さない",()=>{
  const store=new Map();const mockStore={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  global.localStorage=mockStore;global.sessionStorage=mockStore;let appended=0;
  global.window={location:{href:"https://ehcjpn.com/tokyo?adflow=lp&email=secret%40example.com&note=secret"}};
  global.document={createElement:()=>({}),head:{appendChild:()=>appended++}};
  try {
    assert.equal(M.recordAdConversion(`EHCAD-${uuid}`),false);assert.equal(appended,0);
    M.chooseAdMeasurement("granted");assert.equal(appended,1);
    assert.equal(M.recordAdConversion(`EHCAD-${uuid}`),true);assert.equal(M.recordAdConversion(`EHCAD-${uuid}`),false);
    assert.equal(M.recordAdConversion("not-a-receipt"),false);
    const events=window.dataLayer.filter(x=>x[0]==="event");assert.equal(events.length,1);
    assert.equal(events[0][2].send_to,"AW-18553105590/GRbPCNyYjLEdELbZ545F");
    assert.equal(events[0][2].transaction_id,`EHCAD-${uuid}`);
    assert.ok(!JSON.stringify(window.dataLayer).includes("secret"));
    M.chooseAdMeasurement("denied");assert.equal(M.recordAdConversion("EHCAD-b1b2c3d4-1234-4567-8901-123456789abc"),false);
  } finally {delete global.window;delete global.document;delete global.localStorage;delete global.sessionStorage;}
});
