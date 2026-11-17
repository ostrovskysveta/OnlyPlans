import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {read,save,file,render,validate,sessions} from './journal.mjs';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const list=root=>fs.existsSync(root)?fs.readdirSync(root,{recursive:true}).map(f=>path.join(root,f)).filter(f=>fs.statSync(f).isFile()):[];
export function migrate(extraPairs=[]){
 if(fs.existsSync('logs/migration.json'))throw Error('Migration already completed; refusing to repeat');
 const sourceFiles=[...list('logs').filter(f=>/[/\\](work|decisions|usage)\.json$/.test(f)),...list('analytics').filter(f=>f.endsWith('.json'))];
 const originals=new Map(sourceFiles.map(f=>{const content=fs.readFileSync(f,'utf8');return [f.replaceAll('\\','/'),{path:f.replaceAll('\\','/'),sha256:sha(content),content}];}));
 const records=[];
 for(const f of sourceFiles.filter(f=>/[/\\]work\.json$/.test(f))){const w=read(f),dir=path.dirname(f),ds=read(path.join(dir,'decisions.json')),us=read(path.join(dir,'usage.json'));records.push({id:w.session_id,p:w.person,legacy:true,w,ds,us,paths:['work','decisions','usage'].map(n=>path.join(dir,n+'.json').replaceAll('\\','/'))});}
 for(const f of sourceFiles.filter(f=>f.startsWith('analytics'))){const w=read(f);records.push({id:w.id,p:w.participant,legacy:false,w,ds:w.decisions,us:w.capabilities,paths:[f.replaceAll('\\','/')]});}
 const parents=new Map(records.map(r=>[r.id,r.id]));const find=id=>parents.get(id)===id?id:find(parents.get(id));
 function union(a,b){const x=records.find(r=>r.id===a),y=records.find(r=>r.id===b);if(!x||!y||x.p!==y.p)throw Error('Invalid cross-participant/missing pair');parents.set(find(a),find(b));}
 for(const a of records)for(const b of records)if(a.legacy!==b.legacy&&a.p===b.p&&JSON.stringify(a.w).includes(b.id))union(a.id,b.id);
 for(let i=0;i<extraPairs.length;i+=2)union(extraPairs[i],extraPairs[i+1]);
 const groups=new Map();for(const r of records){const k=find(r.id);groups.set(k,[...(groups.get(k)||[]),r]);}
 const output=[];
 for(const group of groups.values()){
 const primary=group.find(r=>!r.legacy)||group[0],w=primary.w,id=primary.id,p=primary.p;
 const starts=group.map(r=>r.w.started_at),ends=group.map(r=>r.w.ended_at).filter(Boolean),start=starts.sort((a,b)=>Date.parse(a)-Date.parse(b))[0],end=ends.sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
 const measured=group.map(r=>r.legacy?{source:r.w.input_tokens!==null&&r.w.output_tokens!==null?'reported':'unavailable',total:r.w.input_tokens!==null&&r.w.output_tokens!==null?r.w.input_tokens+r.w.output_tokens:null,evidence:r.w.token_source||null}:r.w.tokens);
 const tokens=measured.find(t=>t.source==='reported')||measured.find(t=>t.source==='estimated')||{source:'unavailable',total:null,evidence:null};
 const originalsForGroup=group.flatMap(r=>r.paths.map(f=>originals.get(f)));
 const s={schema_version:2,id,participant:p,task:w.task,environment:w.environment||'unknown (legacy)',started_at:start,ended_at:end,status:end?'closed':'open',duration_sec:end?(Date.parse(end)-Date.parse(start))/1000:null,tokens,decisions_reviewed:!!w.decisions_reviewed,capabilities_reviewed:!!w.capabilities_reviewed,result:group.map(r=>r.w.result||r.w.summary).filter(Boolean).join('\n')||null,imported:true,source_ids:group.map(r=>r.id),migration_note:'Explicitly linked records merged; time is the union of their interval, tokens chosen once (reported preferred). All original fields and texts retained below. Missing legacy decision fields marked unknown, not invented.',original_sources:originalsForGroup};
 const ds=[],us=[];
 for(const r of group){for(const e of r.ds)ds.push({...e,ts:e.ts||e.at,session_id:id,participant:p,context:e.context||'Контекст и выбор объединены в старой записи',choice:e.choice||e.decision_and_context,alternatives:e.alternatives,reason:e.reason||'Не указана в исходной записи',consequences:e.consequences,source_session_id:r.id});for(const e of r.us)us.push({...e,ts:e.ts||e.at,session_id:id,participant:p,version:e.version||'unknown',source_session_id:r.id});}
 for(const section of ['work','decisions','usage'])if(fs.existsSync(file(section,p,id)))throw Error('Destination exists');
 output.push({s,ds,us});}
 // Write all targets and verify every original byte before removing any old source.
 for(const {s,ds,us} of output){save(file('work',s.participant,s.id),s);save(file('decisions',s.participant,s.id),ds);save(file('usage',s.participant,s.id),us);validate(s);}
 const recovered=new Map(sessions().flatMap(s=>(s.original_sources||[]).map(x=>[x.path,x])));
 for(const [f,o] of originals){const copy=recovered.get(f);if(!copy||copy.content!==o.content||sha(copy.content)!==o.sha256)throw Error('Source preservation failed: '+f);}
 save('logs/migration.json',{schema_version:1,source_files:originals.size,source_sessions:records.length,unified_sessions:output.length,files:[...originals.values()].map(({path,sha256})=>({path,sha256})),sessions:output.map(({s})=>({participant:s.participant,id:s.id,source_ids:s.source_ids}))});
 const root=path.resolve('.');for(const f of sourceFiles){const absolute=path.resolve(f);if(!absolute.startsWith(root+path.sep))throw Error('Source outside workspace');fs.unlinkSync(absolute);}
 render();console.log(`Migrated ${records.length} records -> ${output.length} sessions; ${originals.size} source files preserved byte-for-byte`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){try{migrate(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
