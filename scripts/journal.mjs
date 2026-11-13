import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), base=path.join(root,'analytics');
const fail=m=>{throw new Error(m)};
const now=()=>new Date().toISOString();
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const save=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const safe=x=>/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(x||'');
function locate(id){if(!safe(id))fail('Invalid session ID'); const hits=fs.readdirSync(base,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>path.join(base,x.name,'sessions',id+'.json')).filter(fs.existsSync);if(hits.length!==1)fail('Session not found or ambiguous');return hits[0]}
function validate(s){
 if(s.schema_version!==1||!safe(s.id)||!safe(s.participant)||!s.task||!s.environment)fail('Missing session identity/task/environment');
 if(!Number.isFinite(Date.parse(s.started_at)))fail('Invalid start');
 if(!['open','closed','interrupted'].includes(s.status))fail('Invalid status');
 if(s.status!=='open'&&(!Number.isFinite(Date.parse(s.ended_at))||Date.parse(s.ended_at)<Date.parse(s.started_at)||s.duration_sec!==Math.round((Date.parse(s.ended_at)-Date.parse(s.started_at))/1000)))fail('Invalid duration');
 if(!['reported','estimated','unavailable'].includes(s.tokens.source))fail('Invalid token source');
 if(s.tokens.source==='unavailable'){if(s.tokens.total!==null)fail('Unknown tokens must be null')}
 else if(!Number.isInteger(s.tokens.total)||s.tokens.total<0||!s.tokens.evidence)fail('Tokens need nonnegative integer and evidence/method');
 if(!Array.isArray(s.decisions)||!Array.isArray(s.capabilities))fail('Missing logs');
 for(const d of s.decisions)if(!d.context||!d.choice||!d.alternatives||!d.reason||!d.consequences)fail('Incomplete decision');
 for(const c of s.capabilities)if(!['mode','skill','plugin','mcp','tool'].includes(c.kind)||!c.name||!c.purpose||!c.ts)fail('Incomplete capability');
 if(s.status!=='open'&&(!s.result||!s.decisions_reviewed||!s.capabilities_reviewed))fail('Closing requires result and review of both logs');
}
const [cmd,...args]=process.argv.slice(2);
try {
 if(cmd==='start'){
 const [participant,task,environment]=args;if(!safe(participant)||!task||!environment)fail('start PARTICIPANT "TASK" "ENVIRONMENT/MODEL"');
 const id=new Date().toISOString().replace(/[-:.TZ]/g,'')+'-'+crypto.randomBytes(4).toString('hex');
 const dir=path.join(base,participant,'sessions');fs.mkdirSync(dir,{recursive:true});
 save(path.join(dir,id+'.json'),{schema_version:1,id,participant,task,environment,started_at:now(),ended_at:null,status:'open',duration_sec:null,tokens:{source:'unavailable',total:null,evidence:null},decisions:[],capabilities:[],decisions_reviewed:false,capabilities_reviewed:false,result:null});console.log(id);
 }else if(['decision','use','tokens','close'].includes(cmd)){
 const [id,...a]=args, f=locate(id),s=read(f);if(s.status!=='open')fail('Session already closed');
 if(cmd==='decision'){const [context,choice,alternatives,reason,consequences]=a;s.decisions.push({ts:now(),context,choice,alternatives,reason,consequences});}
 if(cmd==='use'){const [kind,name,purpose,version='unknown']=a;s.capabilities.push({ts:now(),kind,name,purpose,version});}
 if(cmd==='tokens'){const [source,total,evidence]=a;s.tokens={source,total:source==='unavailable'?null:Number(total),evidence:evidence||null};}
 if(cmd==='close'){const [result,status='closed']=a;if(!['closed','interrupted'].includes(status))fail('Invalid close status');s.status=status;s.result=result;s.ended_at=now();s.duration_sec=Math.round((Date.parse(s.ended_at)-Date.parse(s.started_at))/1000);s.decisions_reviewed=true;s.capabilities_reviewed=true;}
 validate(s);save(f,s);console.log(f);
 }else if(cmd==='check'||cmd==='report'){
 const files=fs.existsSync(base)?fs.readdirSync(base,{recursive:true}).filter(f=>/sessions[\\/].+\.json$/.test(f)).map(f=>path.join(base,f)):[];
 const sessions=files.map(f=>{const s=read(f);validate(s);if(path.relative(base,f).split(path.sep)[0]!==s.participant||path.basename(f)!==s.id+'.json')fail('Path/identity mismatch');return s});
 if(cmd==='check'){
 const ref=args[0];if(ref){const changed=execFileSync('git',['diff','--no-renames','--name-only','-z',ref,'HEAD'],{encoding:'utf8'}).split('\0').filter(Boolean);const logPaths=changed.filter(f=>/^analytics\/[^/]+\/sessions\/.*\.json$/.test(f));if(changed.length&&!logPaths.length)fail('PR must include a session log');for(const f of logPaths){if(!fs.existsSync(f))fail('Do not delete logs');if(read(f).status==='open')fail('Close changed sessions before PR');}}
 console.log(`Valid sessions: ${sessions.length}`);
 }else{console.log('| Participant | Sessions | Closed wall minutes | Reported tokens | Estimated tokens | Unknown token sessions |\n|---|---:|---:|---:|---:|---:|');for(const p of [...new Set(sessions.map(s=>s.participant))].sort()){const ss=sessions.filter(s=>s.participant===p),sum=fn=>ss.reduce((n,s)=>n+fn(s),0);console.log(`| ${p} | ${ss.length} | ${(sum(s=>s.duration_sec||0)/60).toFixed(1)} | ${sum(s=>s.tokens.source==='reported'?s.tokens.total:0)} | ${sum(s=>s.tokens.source==='estimated'?s.tokens.total:0)} | ${ss.filter(s=>s.tokens.source==='unavailable').length} |`);}}
 }else fail('Commands: start, decision, use, tokens, close, check, report');
}catch(e){console.error(e.message);process.exitCode=1}
