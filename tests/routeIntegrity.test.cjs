// EHC-0124. SMTP・Notion・Zoomはすべて差し替え。外部送信なし。
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
function harness(){const cache=new Map(),sent=[];let smtpFail=false;function load(file){const p=path.resolve(root,file);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);const native=createRequire(p);const req=s=>{if(s==='nodemailer')return{createTransport:()=>({sendMail:async mail=>{sent.push(mail);if(smtpFail)throw Error('uncertain');return{messageId:'mock'};}})};const q=s.startsWith('@/')?path.resolve(root,s.slice(2)):s.startsWith('.')?path.resolve(path.dirname(p),s):null;if(q&&fs.existsSync(q+'.ts'))return load(q+'.ts');return native(s)};const code=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInThisContext('(function(exports,require,module){'+code+'})',{filename:p})(m.exports,req,m);return m.exports;}return{load,sent,fail:()=>smtpFail=true};}
const dates=['2027-01-04T13:00','2027-01-05T14:00','2027-01-06T15:00'];
const consultation={mode:'zoom',timezone:'Asia/Tokyo',preferredDates:dates};
test('全通常入口：候補3日時・紹介元・広告入口・テスト除外を通知とCRMの同一受付へ運ぶ',()=>{
 const h=harness(),P=h.load('lib/programLead.ts');
 for(const source of ['top','tokyo','shindan','team','dropin']){
  const r=P.readProgramSubmit({company:'営業対象外',name:'試験',reach:'info@ehcjpn.com',source,consent:true,requestId:'a1b2c3d4-1234-4567-8901-123456789abc',consultation,context:{test:true,testRun:'QA124',variant:'lp',campaign:'ehc_zeroemi_flow_202611'},referral:{ref:'krh01-clinic',landedAt:new Date().toISOString(),landing:'/tokyo'}});
  assert.equal(r.ok,true,source);const lead=P.programLead(r.input,'EHC-test','2026-11-03'),mail=P.programStaffMail(r.input,'EHC-test','2026-11-03');
  for(const d of dates){assert.ok(lead.memo.includes(d.replace('T',' ')));assert.ok(mail.text.includes(d.replace('T',' ')));}
  assert.match(lead.memo,/営業対象外/);assert.match(lead.memo,/KRH01/);assert.match(lead.memo,/短いLP/);assert.match(mail.subject,/営業対象外/);
 }
 assert.equal(P.readProgramSubmit({company:'a',name:'b',reach:'x@example.com',source:'top',consent:true,requestId:'a1b2c3d4-1234-4567-8901-123456789abc'}).ok,false);
});
test('安定受付：同一IDの再要求・日付を跨ぐ表示変更でメールと行を増やさない。異なる内容は409、保存不明なら送らない',async()=>{
 const h=harness(),D=h.load('lib/leadDelivery.ts');let pages=[],creates=0;
 const oldFetch=global.fetch,oldEnv={...process.env};Object.assign(process.env,{NOTION_TOKEN:'mock',SMTP_USER:'info@neneweb.com',SMTP_PASS:'mock',DIAGNOSIS_MAIL_MODE:'staff',VERCEL_ENV:'production'});
 global.fetch=async(url,init)=>{if(String(url).endsWith('/query'))return Response.json({results:pages});const b=JSON.parse(init.body);if(init.method==='PATCH'){pages[0].properties=b.properties;return Response.json({id:'mock'});}creates++;pages=[{id:'mock',properties:b.properties}];return Response.json({id:'mock'});};
 const opts={receiptNo:'EHC-stable',identityData:{source:'team',consultation},lead:{company:'営業対象外',proposalNo:'EHC-stable',memo:'試験'},buildMail:()=>({subject:'試験',text:'候補日時'}),test:true,hasConsultation:true};
 try{
  const a=await D.deliverStableLead(opts);assert.equal(a.body.notified,true);assert.equal(a.body.cvEligible,false);
  const b=await D.deliverStableLead({...opts,lead:{...opts.lead,sentDate:'2026-11-04'},buildMail:()=>({subject:'日付更新',text:'新しい表示日'})});assert.equal(b.body.duplicate,true);assert.equal(creates,1);assert.equal(h.sent.length,1);
  const changed=await D.deliverStableLead({...opts,identityData:{changed:true}});assert.equal(changed.status,409);
  global.fetch=async()=>new Response('blocked',{status:403});assert.equal((await D.deliverStableLead({...opts,receiptNo:'EHC-other'})).status,503);assert.equal(h.sent.length,1);
 }finally{global.fetch=oldFetch;process.env=oldEnv;}
});
test('SMTP結果不明：同じ受付を再送せず、記録済み・通知未確認・CV対象外を返す',async()=>{
 const h=harness(),D=h.load('lib/leadDelivery.ts');h.fail();let pages=[];const old=global.fetch,env={...process.env};Object.assign(process.env,{NOTION_TOKEN:'mock',SMTP_USER:'info@neneweb.com',SMTP_PASS:'mock',DIAGNOSIS_MAIL_MODE:'staff',VERCEL_ENV:'production'});
 global.fetch=async(url,init)=>{if(String(url).endsWith('/query'))return Response.json({results:pages});const b=JSON.parse(init.body);pages=[{id:'mock',properties:b.properties}];return Response.json({id:'mock'});};
 const opts={receiptNo:'EHC-uncertain',identityData:{a:1},lead:{company:'test',proposalNo:'EHC-uncertain'},buildMail:()=>({subject:'test',text:'test'}),test:false,hasConsultation:true};
 try{for(let i=0;i<2;i++){const r=await D.deliverStableLead(opts);assert.equal(r.body.notified,false);assert.equal(r.body.cvEligible,false);assert.match(r.body.warning,/再送|受付番号/);}assert.equal(h.sent.length,1);}finally{global.fetch=old;process.env=env;}
});
test('Zoom予約：別ページ・メール不一致・取消・Zoom以外のURL・過去予約を拒否。画面申告の日時とURLは使わない',async()=>{
 const h=harness(),Z=h.load('lib/zoomBookingServer.ts'),B=h.load('lib/zoomBooking.ts');const old=global.fetch,env={...process.env};Object.assign(process.env,{ZOOM_ACCOUNT_ID:'a',ZOOM_CLIENT_ID:'b',ZOOM_CLIENT_SECRET:'c',ZOOM_EHC_SCHEDULE_ID:'EHC_PAGE'});
 const base={schedule_id:'EHC_PAGE',summary:B.ZOOM_BOOKING_TITLE,status:'confirmed',start_date_time:'2027-01-04T13:00:00+09:00',end_date_time:'2027-01-04T13:30:00+09:00',attendees:[{attendee_id:'attendee123',booker:true,email:'info@ehcjpn.com'}],external_location:{kind:'zoom',meeting_join_url:'https://zoom.us/j/12345'}};let event=base;
 global.fetch=async url=>Response.json(String(url).includes('/oauth/token')?{access_token:'mock',expires_in:3600}:event);
 try{const b={eventId:'event12345',attendeeId:'attendee123',joinUrl:'https://evil.example',start:'2028-01-01'};const ok=await Z.verifyZoomBooking(b,'info@ehcjpn.com');assert.equal(ok.start,base.start_date_time);assert.equal(ok.joinUrl,base.external_location.meeting_join_url);
 for(const change of [{schedule_id:'OTHER'},{status:'cancelled'},{summary:'another meeting'},{attendees:[{attendee_id:'attendee123',booker:true,email:'other@example.com'}]},{external_location:{meeting_join_url:'https://evil.example/j/123'}},{start_date_time:'2025-01-01T13:00:00+09:00'}]){event={...base,...change};await assert.rejects(Z.verifyZoomBooking(b,'info@ehcjpn.com'));}}
 finally{global.fetch=old;process.env=env;}
});
test('東京受付：第5回の締切17時で次の第6回へ切り替わる。期限後は終了、確認は日程と別に古くなる',()=>{const S=harness().load('lib/subsidies.ts');const at=t=>S.getSubsidies(new Date(t)).find(x=>x.id==='tokyo_zeroemi');assert.equal(at('2026-11-20T16:59:59+09:00').applyClose,'2026-11-20');assert.equal(at('2026-11-20T17:00:00+09:00').applyOpen,'2027-01-18');assert.equal(at('2027-01-29T17:00:00+09:00').status,'closed');assert.equal(at('2026-11-12T12:00:00+09:00').verificationState,'stale');});
test('CVと紹介計測：QAはページ移動しても広告成果にしない。通常の相談3形式は同意後に一度だけ、氏名・連絡先を渡さない',()=>{
 const h=harness(),C=h.load('lib/leadContextClient.ts'),M=h.load('lib/adMeasurement.ts'),T=h.load('lib/track.ts');const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};let appended=0,tracked=0;
 global.localStorage=storage;global.sessionStorage=storage;global.document={createElement:()=>({}),head:{appendChild:()=>appended++}};
 global.window={location:{href:'https://ehcjpn.com/tokyo?adflow=lp&qa=Q124',search:'?adflow=lp&qa=Q124'},va:()=>tracked++};
 try{
  C.captureLeadContext();window.location={href:'https://ehcjpn.com/team',search:''};M.chooseAdMeasurement('granted');
  for(const receipt of ['EHCAD-a1b2c3d4-1234-4567-8901-123456789abc','EHC-a1b2c3d4-1234-4567-8901-123456789abc','EHC-20261103-130000-AB12'])assert.equal(M.recordAdConversion(receipt),false);
  T.track('ref_submit',{ref:'krh01-clinic',ok:true});assert.equal(appended,0);assert.equal(tracked,0);
  const qr='EHC-a1b2c3d4-1234-4567-8901-123456789abc';assert.equal(M.recordQaConversion(qr),true);assert.equal(M.recordQaConversion(qr),false);
  const qe=window.dataLayer.filter(x=>x[0]==='event');assert.equal(qe.length,1);assert.equal(qe[0][2].send_to,M.GOOGLE_ADS_QA_SEND_TO);assert.notEqual(qe[0][2].send_to,M.GOOGLE_ADS_SEND_TO);
 }finally{delete global.window;delete global.document;delete global.localStorage;delete global.sessionStorage;}
 const h2=harness(),M2=h2.load('lib/adMeasurement.ts');data.clear();global.localStorage=storage;global.sessionStorage=storage;global.document={createElement:()=>({}),head:{appendChild:()=>appended++}};global.window={location:{href:'https://ehcjpn.com/team?email=private@example.com',search:''}};
 try{
  assert.equal(M2.recordAdConversion('EHC-20261103-130000-AB12'),false);M2.chooseAdMeasurement('granted');
  for(const r of ['EHCAD-a1b2c3d4-1234-4567-8901-123456789abc','EHC-a1b2c3d4-1234-4567-8901-123456789abc','EHC-20261103-130000-AB12']){assert.equal(M2.recordAdConversion(r),true);assert.equal(M2.recordAdConversion(r),false);}
  assert.equal(window.dataLayer.filter(x=>x[0]==='event').length,3);assert.doesNotMatch(JSON.stringify(window.dataLayer),/private|example.com/);
 }finally{delete global.window;delete global.document;delete global.localStorage;delete global.sessionStorage;}
});
test('追客リマインド：新しい受付形式も対象、営業対象外と公募通知は除外する',()=>{
 const R=harness().load('lib/leadReminder.ts');const page=(id,memo='')=>({id:'mock',properties:{会社名:{title:[{plain_text:'検証用会社'}]},提案No:{rich_text:[{plain_text:id}]},メモ:{rich_text:[{plain_text:memo}]}}});
 const rows=R.rowsFromNotion([page('EHC-a1b2c3d4-1234-4567-8901-123456789abc'),page('EHCAD-a1b2c3d4-1234-4567-8901-123456789abc'),page('EHC-20261103-130000-AB12','営業対象外'),page('EHC-N-a1b2c3d4-1234-4567-8901-123456789abc')]);assert.equal(rows.length,2);
});
