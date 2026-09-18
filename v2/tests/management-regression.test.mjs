import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('../server/index.mjs',import.meta.url),'utf8');
const management=await readFile(new URL('../server/management.mjs',import.meta.url),'utf8');
const app=await readFile(new URL('../web/app.js',import.meta.url),'utf8');

test('mutable web assets are revalidated instead of staying stale for an hour',()=>{
  assert.match(index,/\['\.html','\.css','\.js'\]\.includes\(extname\(file\)\)\?'no-cache'/);
});

test('employee rename keeps active employee names unique',()=>{
  assert.match(management,/EMPLOYEE_NAME_EXISTS/);
  assert.match(management,/duplicate&&duplicate\.id!==id/);
});

test('employee project and task management routes remain available',()=>{
  assert.match(management,/\/api\/v2\/employees/);
  assert.match(management,/projectControl/);
  assert.match(management,/discussionMatch/);
  assert.match(management,/continueMatch/);
  assert.match(management,/archiveMatch/);
});

test('UI keeps click handlers for employees projects and tasks',()=>{
  assert.match(app,/\[data-task\]/);
  assert.match(app,/\[data-employee\]/);
  assert.match(app,/\[data-project-control\]/);
  assert.match(app,/openTask\(/);
  assert.match(app,/openEmployee\(/);
  assert.match(app,/openProjectControl\(/);
});
