import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../core/router.mjs';

const cases = [
  ['سارة وش وضع الشركة؟','GENERAL','sara',null],
  ['فهد عطيني موجز عن قدها','PROJECT_STATUS','fahad','qaddha'],
  ['فهد وش صار على قدها ووش باقي؟','PROJECT_STATUS','fahad','qaddha'],
  ['فهد راجع قدها وتأكد أن البناء يعمل','QA','fahad','qaddha'],
  ['نورة راجعي مشروع معين وتأكدي من المشاكل المثبتة','QA','noura','mueen'],
  ['راكان وش ممكن نسوي عشان نجيب فلوس من قدها؟','BUSINESS','rakan','qaddha'],
  ['راكان حلل أرامكو','FINANCE_ANALYSIS','rakan',null],
  ['أحتاج محفظة رقمية للتطبيق','GENERAL','sara',null]
];

for (const [command,route,employeeId,projectId] of cases) {
  test(command, () => {
    const parsed = parseCommand(command);
    assert.equal(parsed.route, route);
    assert.equal(parsed.employeeId, employeeId);
    assert.equal(parsed.projectId, projectId);
  });
}
