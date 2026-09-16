import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../../supabase/migrations/20260916221243_hq_v2_initial_schema.sql',import.meta.url),'utf8');
test('normalized V2 schema includes critical tables',()=>{for(const name of ['employees','projects','tasks','task_events','task_evidence','connection_requests','approvals','tool_connections','secretary_briefs','paper_accounts','paper_orders','paper_positions'])assert.match(sql,new RegExp(`hq_v2_${name}`));});
test('RLS and realtime are configured',()=>{assert.match(sql,/enable row level security/);assert.match(sql,/alter publication supabase_realtime add table public\.hq_v2_tasks/);});
test('paper execution is atomic',()=>assert.match(sql,/function public\.hq_v2_execute_paper_order/));

