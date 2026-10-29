// ID: EHC-0095 / v1 / 2026-10-26. 公開公式ページの読み取り・証跡のみ。
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const ts = require('typescript');
const Module = require('node:module');
const mod = new Module(path.resolve('lib/sourceFingerprint.ts'));
mod.filename = path.resolve('lib/sourceFingerprint.ts');
mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync('lib/sourceFingerprint.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,mod.filename);
const urls = {
  sii:'https://sii.or.jp/setsubi07r/overview4.html',
  sii_discovery:'https://sii.or.jp/setsubi07r/',
  tokyo:'https://www.tokyo-co2down.jp/subsidy/zeroemi-shoene/',
  saitama:'https://www.pref.saitama.lg.jp/a0503/datutanso.html',
  chiba:'https://www.pref.chiba.lg.jp/ontai/hojo/r8jigyousyahojo.html',
  kanagawa:'https://www.pref.kanagawa.jp/docs/ap4/cnt/f7226/shouenesetubihojokin.html',
  osaka:'https://www.pref.osaka.lg.jp/o120020/eneseisaku/sec/r08hojokin-pac.html',
  hotel:'https://www.mlit.go.jp/kankocho/kobo06_00025.html',
  jizokuka:'https://www.chusho.meti.go.jp/keiei/shokibo/jizoku/',
  mhlw_training:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/kyufukin/d01-1_00011.html',
  mhlw_employment:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000199292.html',
};
const out = path.resolve('../81_検証証跡/official'); fs.mkdirSync(out,{recursive:true});
const records = [];
for(const [id,url] of Object.entries(urls)) {
  const file=path.join(out,id+'.html');
  try {
    const result=execFileSync('curl',['-fLsS','--max-time','20','-o',file,'-w','%{url_effective}',url],{encoding:'utf8'});
    const html=fs.readFileSync(file,'utf8');
    const text=mod.exports.officialContent(html);
    fs.writeFileSync(path.join(out,id+'.txt'),text);
    records.push({id,url,finalUrl:result,fetchedAt:new Date().toISOString(),sha256:mod.exports.sourceFingerprint(html),bytes:Buffer.byteLength(html)});
  } catch(e) {records.push({id,url,fetchedAt:new Date().toISOString(),error:'取得失敗。人による再確認が必要'});}
  console.log(id,records.at(-1).error??records.at(-1).sha256);
}
fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify(records,null,2));
