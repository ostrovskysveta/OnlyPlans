import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const now=()=>new Date().toISOString(), fail=m=>{throw Error(m)};
export const safe=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(x);
export const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
export function save(f,x){fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');}
export const file=(section,p,id)=>`logs/${section}/${p}/${id}.json`;
const sections=['work','decisions','usage'];
export function sessions(){return fs.existsSync('logs/work')?fs.readdirSync('logs/work',{recursive:true}).filter(f=>f.endsWith('.json')).map(f=>read(path.join('logs/work',f))):[];}
function checkMigration(ss){
 if(!fs.existsSync('logs/migration.json'))return;
 const manifest=read('logs/migration.json'), sources=ss.flatMap(s=>s.original_sources||[]);
 if(sources.length!==manifest.source_files||new Set(sources.map(s=>s.path)).size!==sources.length)fail('Migration source count/uniqueness mismatch');
 for(const source of manifest.files){const copy=sources.find(s=>s.path===source.path);if(!copy||copy.sha256!==source.sha256||crypto.createHash('sha256').update(copy.content).digest('hex')!==source.sha256)fail('Migration integrity failed: '+source.path);}
 for(const g of manifest.sessions){const s=ss.find(s=>s.id===g.id&&s.participant===g.participant);if(!s||JSON.stringify(s.source_ids)!==JSON.stringify(g.source_ids))fail('Migration session mapping changed');}
}
function locate(id){if(!safe(id))fail('Invalid ID');const a=sessions().filter(s=>s.id===id);if(a.length!==1)fail('Session missing or ambiguous');return a[0];}
export function validate(s){
 if(s.schema_version!==2||!safe(s.id)||!safe(s.participant)||!s.task)fail('Invalid identity/task');
 if(!Number.isFinite(Date.parse(s.started_at))||!['open','closed','interrupted'].includes(s.status))fail('Invalid time/status');
 if(s.status==='open'){if(s.ended_at!==null||s.duration_sec!==null)fail('Open session has end');}
 else if(!Number.isFinite(Date.parse(s.ended_at))||Date.parse(s.ended_at)<Date.parse(s.started_at)||!Number.isFinite(s.duration_sec)||Math.abs(s.duration_sec-(Date.parse(s.ended_at)-Date.parse(s.started_at))/1000)>1.01||!s.result)fail('Invalid closed session');
 if(!['reported','estimated','unavailable'].includes(s.tokens?.source))fail('Invalid token source');
 if(s.tokens.source==='unavailable'){if(s.tokens.total!==null)fail('Unknown tokens must be null');}
 else if(!Number.isSafeInteger(s.tokens.total)||s.tokens.total<0||!s.tokens.evidence)fail('Tokens need evidence');
 for(const section of ['decisions','usage']){const p=file(section,s.participant,s.id);if(!fs.existsSync(p))fail('Missing subjournal '+p);const a=read(p);if(!Array.isArray(a))fail('Expected array');for(const e of a){if(e.session_id!==s.id||e.participant!==s.participant||!Number.isFinite(Date.parse(e.ts)))fail('Entry identity/time mismatch');if(section==='decisions'){if(!e.context||!e.choice||!e.alternatives||!e.reason||!e.consequences)fail('Incomplete decision');}else if(!['mode','model','skill','plugin','mcp','tool'].includes(e.kind)||!e.name||!e.purpose)fail('Incomplete usage');}}
 if(s.status==='closed'&&!s.imported&&(!s.decisions_reviewed||!s.capabilities_reviewed))fail('Review subjournals');
}
const text=x=>String(x??'неизвестно').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
export function render(){
 const ss=sessions().sort((a,b)=>a.started_at.localeCompare(b.started_at)),people=[...new Set(ss.map(s=>s.participant))].sort();
 let index='# Журналы команды\n\nОдна сессия — три связанных поджурнала. Выберите раздел, затем участника. Время включает ожидание; неизвестные токены не равны нулю.\n\n';
 for(const section of sections){const title={work:'Работа',decisions:'Решения',usage:'Моды, скиллы, плагины и инструменты'}[section];index+=`- [${title}](${section}/README.md)\n`;let home=`# ${title}\n\n`;
 for(const p of people){home+=`- [${p}](${p}/README.md)\n`;let md=`# ${title} — ${p}\n\n[Все участники](../README.md) · [Все журналы](../../README.md)\n\n`;
 for(const s of ss.filter(s=>s.participant===p)){md+=`## ${s.started_at} — ${s.id}\n\n${text(s.task)}\n\n[Работа](../../work/${p}/${s.id}.json) · [Решения](../../decisions/${p}/${s.id}.json) · [Инструменты](../../usage/${p}/${s.id}.json)\n\n`;
 if(section==='work'){md+=`Статус: **${s.status}**. Время: ${s.duration_sec??'неизвестно'} сек. Токены: ${s.tokens.total??'неизвестно'} (${s.tokens.source}).\n\nРезультат: ${text(s.result)}\n\n`;if(s.imported)md+='Перенесено из старого журнала; исходные данные и происхождение сохранены в JSON работы.\n\n';}
 else{const a=read(file(section,p,s.id));if(!a.length)md+='Записей нет.\n\n';for(const e of a)md+=section==='decisions'?`- **${text(e.choice)}** (${e.ts})\n  - Контекст: ${text(e.context)}\n  - Альтернативы: ${text(e.alternatives)}\n  - Причина: ${text(e.reason)}\n  - Последствия: ${text(e.consequences)}\n\n`:`- **${text(e.kind)}: ${text(e.name)}** — ${text(e.purpose)} (${e.ts}; версия: ${text(e.version)})\n`;}}
 fs.mkdirSync(`logs/${section}/${p}`,{recursive:true});fs.writeFileSync(`logs/${section}/${p}/README.md`,md);}
 fs.mkdirSync('logs/'+section,{recursive:true});fs.writeFileSync(`logs/${section}/README.md`,home);}
 fs.mkdirSync('logs',{recursive:true});fs.writeFileSync('logs/README.md',index+'\n[Как вести журналы](../docs/logging.md) · [Перенос старой истории](migration.json)\n');
}
export function main([cmd,...args]){
 if(cmd==='start'){const [participant,task,environment='unknown']=args;if(!safe(participant)||!task)fail('start HANDLE TASK ENVIRONMENT');const id=now().replace(/[-:.TZ]/g,'')+'-'+crypto.randomBytes(4).toString('hex');save(file('work',participant,id),{schema_version:2,id,participant,task,environment,started_at:now(),ended_at:null,status:'open',duration_sec:null,tokens:{source:'unavailable',total:null,evidence:null},decisions_reviewed:false,capabilities_reviewed:false,result:null});for(const section of ['decisions','usage'])save(file(section,participant,id),[]);render();console.log(id);return;}
 if(['decision','use','tokens','close'].includes(cmd)){const [id,...a]=args,s=locate(id);if(s.status!=='open')fail('Session already closed');let section,entry;
 if(cmd==='decision'){const [context,choice,alternatives,reason,consequences]=a;if(a.length!==5||a.some(x=>!x))fail('Five decision fields required');section='decisions';entry={ts:now(),session_id:id,participant:s.participant,context,choice,alternatives,reason,consequences};}
 if(cmd==='use'){const [kind,name,purpose,version='unknown']=a;if(!['mode','model','skill','plugin','mcp','tool'].includes(kind)||!name||!purpose)fail('Invalid usage');section='usage';entry={ts:now(),session_id:id,participant:s.participant,kind,name,purpose,version};}
 if(cmd==='tokens'){const [source,total,evidence]=a;if(!['reported','estimated','unavailable'].includes(source)||source!=='unavailable'&&(!total||!Number.isSafeInteger(Number(total))||Number(total)<0||!evidence))fail('Invalid tokens');s.tokens={source,total:source==='unavailable'?null:Number(total),evidence:evidence||null};}
 if(cmd==='close'){const [result,status='closed']=a;if(!result||!['closed','interrupted'].includes(status))fail('Result/status required');s.status=status;s.result=result;s.ended_at=now();s.duration_sec=Math.round((Date.parse(s.ended_at)-Date.parse(s.started_at))/1000);s.decisions_reviewed=true;s.capabilities_reviewed=true;}
 validate(s);if(section){const f=file(section,s.participant,id);save(f,[...read(f),entry]);}save(file('work',s.participant,id),s);render();console.log(id);return;}
 if(cmd==='render'){render();return;}
 if(cmd==='check'||cmd==='report'){const ss=sessions();checkMigration(ss);if(new Set(ss.map(s=>s.id)).size!==ss.length)fail('Duplicate session ID');for(const s of ss){validate(s);if(!fs.existsSync(file('work',s.participant,s.id)))fail('Path mismatch');}const expected=new Set(ss.flatMap(s=>sections.map(section=>file(section,s.participant,s.id))));for(const section of sections)if(fs.existsSync('logs/'+section))for(const f of fs.readdirSync('logs/'+section,{recursive:true}).filter(f=>f.endsWith('.json')))if(!expected.has(`logs/${section}/${f.split(path.sep).join('/')}`))fail('Orphan subjournal');
 if(cmd==='check'){if(args[0]){const changed=execFileSync('git',['diff','--no-renames','--name-only','-z',args[0],'HEAD'],{encoding:'utf8'}).split('\0').filter(Boolean),works=changed.filter(f=>/^logs\/work\/[^/]+\/[^/]+\.json$/.test(f));if(changed.length&&!works.some(f=>fs.existsSync(f)&&!read(f).imported&&read(f).status==='closed'))fail('PR needs a closed working session');for(const f of changed.filter(f=>/^logs\/(work|decisions|usage)\/[^/]+\/[^/]+\.json$/.test(f))){if(!fs.existsSync(f))fail('Do not delete journals');const [,,p,name]=f.split('/');if(read(`logs/work/${p}/${name}`).status==='open')fail('Close changed sessions before PR');}}console.log(`Valid sessions: ${ss.length}`);}
 else{console.log('| Participant | Sessions | Wall minutes | Reported tokens | Estimated tokens | Unknown token sessions |\n|---|---:|---:|---:|---:|---:|');for(const p of [...new Set(ss.map(s=>s.participant))].sort()){const a=ss.filter(s=>s.participant===p),sum=f=>a.reduce((n,s)=>n+f(s),0);console.log(`| ${p} | ${a.length} | ${(sum(s=>s.duration_sec||0)/60).toFixed(1)} | ${sum(s=>s.tokens.source==='reported'?s.tokens.total:0)} | ${sum(s=>s.tokens.source==='estimated'?s.tokens.total:0)} | ${a.filter(s=>s.tokens.source==='unavailable').length} |`);}}return;}
 fail('Commands: start, decision, use, tokens, close, check, report, render');
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
