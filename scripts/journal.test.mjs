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
    const file = path.join(cwd,'analytics','alice','sessions',id+'.json');
    const open = fs.readFileSync(file,'utf8');
    git('add','.'); git('commit','-m','open log');
    run(['check',base],false);
    run(['tokens',id,'reported','42','Test fixture only']);
    run(['close',id,'Completed']);
    run(['close',id,'Duplicate'],false);
    git('add','.'); git('commit','-m','closed log');
    run(['check',base]);
    assert.match(run(['report']),/\| alice \| 1 \| .* \| 42 \| 0 \| 0 \|/);
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
