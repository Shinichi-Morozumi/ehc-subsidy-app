// ID: EHC-0095 / v1 / 2026-10-26. ローカル締めだけ。通信・メール・Drive書込なし。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){const p=path.resolve(root,file);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);const native=createRequire(p);const req=s=>s.startsWith('.')?load(path.resolve(path.dirname(p),s+'.ts')):native(s);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(exports,require,module){${js}\n})`,{filename:p})(m.exports,req,m);return m.exports;}
const [inputFile,outDir]=process.argv.slice(2);if(!inputFile||!outDir)throw new Error('入力JSONと保存先を指定してください。');
const result=load('lib/agencyMonthly.ts').closeAgencyMonth(JSON.parse(fs.readFileSync(inputFile,'utf8')));
if(result.status!=='final'){console.log(JSON.stringify(result,null,2));process.exitCode=2;}
else{
 fs.mkdirSync(outDir,{recursive:true});const file=path.join(outDir,`v1_${result.month}_EHC_KRH01_月次確定.json`),content=JSON.stringify(result,null,2)+'\n';
 if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==content)throw new Error('保存済み確定版と異なります。自動上書きせず改版を確認してください。');console.log('保存済み。同一内容なので再発行しません。');}
 else{fs.writeFileSync(file,content,{flag:'wx'});console.log('確定版を保存しました。外部送信はしていません。');}
}
