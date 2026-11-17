import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const script = path.resolve('scripts/journal.mjs');
test('journal lifecycle, invalid mutations and PR coverage', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'onlyplans-journal-'));
  const run = (args, ok = true) => {
    const result = spawnSync(process.execPath, [script, ...args], {cwd, encoding:'utf8'});
    assert.equal(result.status === 0, ok, result.stderr);
    return result.stdout.trim();
  };
  const git = (...args) => {
    const result = spawnSync('git', args, {cwd, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git('init'); git('config','user.name','Test'); git('config','user.email','test@example.invalid');
    fs.writeFileSync(path.join(cwd, 'README.md'), 'Test\n');
    git('add','.'); git('commit','-m','base');
    const base = git('rev-parse','HEAD');
    run(['check',base]);
    fs.appendFileSync(path.join(cwd,'README.md'),'Change\n');
    git('add','.'); git('commit','-m','no log');
    run(['check',base],false);
    const id = run(['start','alice','Task','Test environment']);
    run(['use',id,'tool','node:test','Regression checks']);
    run(['decision',id,'Context','Choice','Alternative','Reason','Consequence']);
    run(['tokens',id,'reported','-1','Invalid'],false);
    run(['use',id,'invalid','name','purpose'],false);
    const file = path.join(cwd,'logs','work','alice',id+'.json');
    const open = fs.readFileSync(file,'utf8');
    git('add','.'); git('commit','-m','open log');
    run(['check',base],false);
    run(['tokens',id,'reported','42','Test fixture only']);
    run(['close',id,'Completed']);
    run(['close',id,'Duplicate'],false);
    git('add','.'); git('commit','-m','closed log');
    run(['check',base]);
    assert.match(run(['report']),/\| alice \| 1 \| .* \| 42 \| 0 \| 0 \|/);
    assert.ok(fs.existsSync(path.join(cwd,'logs','decisions','alice',id+'.json')));
    assert.ok(fs.existsSync(path.join(cwd,'logs','usage','alice',id+'.json')));
    assert.match(fs.readFileSync(path.join(cwd,'logs','decisions','alice','README.md'),'utf8'),/Choice/);
    const bob=run(['start','bob','Second participant','Test']);
    run(['use',bob,'model','test-model','Fixture']);
    run(['close',bob,'No decisions required']);
    assert.match(fs.readFileSync(path.join(cwd,'logs','work','README.md'),'utf8'),/bob/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(cwd,'logs','decisions','bob',bob+'.json'))).length,0);
    const closed = fs.readFileSync(file,'utf8');
    fs.writeFileSync(file,open);
    run(['check']);
    fs.writeFileSync(file,closed);
    const beforeDelete = git('rev-parse','HEAD');
    fs.renameSync(file,file.replace('.json','-renamed.json'));
    git('add','.'); git('commit','-m','renamed log');
    run(['check',beforeDelete],false);
    fs.rmSync(file.replace('.json','-renamed.json'));
    git('add','.'); git('commit','-m','deleted log');
    run(['check',beforeDelete],false);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const invalid = JSON.parse(closed); invalid.duration_sec = -1;
    fs.writeFileSync(file,JSON.stringify(invalid));
    run(['check'],false);
  } finally { fs.rmSync(cwd,{recursive:true,force:true}); }
});

test('migration preserves every source byte, merges linked pairs and keeps unpaired sessions',()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'onlyplans-migration-'));
 const put=(p,x)=>{const f=path.join(cwd,p);fs.mkdirSync(path.dirname(f),{recursive:true});const content=JSON.stringify(x,null,2)+'\r\n';fs.writeFileSync(f,content);return content;};
 const run=(file,args=[],ok=true)=>{const r=spawnSync(process.execPath,[path.resolve('scripts',file),...args],{cwd,encoding:'utf8'});assert.equal(r.status===0,ok,r.stderr);return r.stdout;};
 try{
 const start='2026-11-01T10:00:00.000Z',end='2026-11-01T10:01:00.000Z';
 const old={person:'alice',session_id:'old-1',started_at:start,ended_at:end,duration_seconds:60,task:'Legacy',summary:'Paired new-1',input_tokens:5,output_tokens:7,token_source:'fixture',custom_preserved:{value:123}};
 const originals=new Map();
 originals.set('logs/alice/old-1/work.json',put('logs/alice/old-1/work.json',old));
 originals.set('logs/alice/old-1/decisions.json',put('logs/alice/old-1/decisions.json',[{at:start,decision_and_context:'Legacy choice',alternatives:'Other',consequences:'Effect'}]));
 originals.set('logs/alice/old-1/usage.json',put('logs/alice/old-1/usage.json',[{at:start,kind:'model',name:'legacy-model',purpose:'Task'}]));
 originals.set('analytics/alice/sessions/new-1.json',put('analytics/alice/sessions/new-1.json',{schema_version:1,id:'new-1',participant:'alice',task:'New',environment:'test',started_at:start,ended_at:end,status:'closed',duration_sec:60,tokens:{source:'reported',total:12,evidence:'fixture'},decisions:[],capabilities:[],result:'Paired old-1',decisions_reviewed:true,capabilities_reviewed:true}));
 const unpaired={...old,person:'bob',session_id:'old-2',summary:'No pair',ended_at:null,duration_seconds:null};
 originals.set('logs/bob/old-2/work.json',put('logs/bob/old-2/work.json',unpaired));
 for(const n of ['decisions','usage'])originals.set(`logs/bob/old-2/${n}.json`,put(`logs/bob/old-2/${n}.json`,[]));
 run('migrate-journals.mjs');run('journal.mjs',['check']);
 const migrated=JSON.parse(fs.readFileSync(path.join(cwd,'logs/work/alice/new-1.json')));
 assert.deepEqual(migrated.source_ids,['old-1','new-1']);assert.equal(migrated.tokens.total,12);assert.equal(migrated.duration_sec,60);
 const bob=JSON.parse(fs.readFileSync(path.join(cwd,'logs/work/bob/old-2.json')));assert.equal(bob.status,'open');
 const restored=new Map([...migrated.original_sources,...bob.original_sources].map(s=>[s.path,s.content]));
 assert.deepEqual(restored,originals);for(const p of originals.keys())assert.ok(!fs.existsSync(path.join(cwd,p)));
 run('migrate-journals.mjs',[],false);
 migrated.original_sources[0].content+='tampered';fs.writeFileSync(path.join(cwd,'logs/work/alice/new-1.json'),JSON.stringify(migrated));run('journal.mjs',['check'],false);
 }finally{fs.rmSync(cwd,{recursive:true,force:true});}
});
