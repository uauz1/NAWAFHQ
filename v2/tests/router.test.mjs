import test from 'node:test';import assert from 'node:assert/strict';import {parseCommand} from '../core/router.mjs';
const cases=[
 ['سارة وش وضع الشركة؟','GENERAL','sara',null],
 ['فهد راجع قدها وتأكد أن البناء يعمل','QA','fahad','qaddha'],
 ['نورة راجعي مشروع معين وتأكدي من المشاكل المثبتة','QA','noura','mueen'],
 ['راكان وش ممكن نسوي عشان نجيب فلوس من قدها؟','BUSINESS','rakan','qaddha'],
 ['راكان حلل أرامكو','FINANCE_ANALYSIS','rakan',null],
 ['راكان اشترِ AAPL بـ 250 دولار في المحفظة التجريبية','TRADING_PAPER','rakan',null],
 ['أحتاج محفظة رقمية للتطبيق','GENERAL','sara',null]
];
for(const [command,route,employeeId,projectId] of cases)test(command,()=>assert.deepEqual(parseCommand(command),assert.match?{...parseCommand(command),route,employeeId,projectId}:null));

