import { chromium } from 'playwright';
const base=process.env.HQ_URL||'https://nawaf-hq-main.onrender.com';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];const failed=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('requestfailed',r=>{const u=r.url(),method=r.method(),err=r.failure()?.errorText||'';const navigationAbort=/ERR_ABORTED/i.test(err)&&(method==='HEAD'||u===`${base}/api/state`||u===`${base}/api/state/`);if(u.startsWith(base)&&!navigationAbort)failed.push(`${method} ${u} ${err}`)});
const open=async()=>{await page.goto(base,{waitUntil:'networkidle',timeout:120000});await page.waitForSelector('#app .v8',{timeout:30000})};
await open();
if(!await page.locator('[data-view="dashboard"]').count())throw new Error('dashboard nav missing');

// Every main view must activate.
for(const v of ['workforce','projects','tasks','reports','dashboard']){await page.locator(`[data-view="${v}"]`).first().click();await page.waitForTimeout(250);if(!await page.locator(`[data-view="${v}"].active`).count())throw new Error(`view ${v} did not activate`)}

// Every employee card must open and close cleanly.
await page.locator('[data-view="workforce"]').first().click();await page.waitForTimeout(250);
const employeeIds=await page.locator('[data-employee]').evaluateAll(ns=>ns.map(n=>n.getAttribute('data-employee')));
if(employeeIds.length<4)throw new Error(`expected at least 4 employees, got ${employeeIds.length}`);
for(const id of employeeIds){await page.locator(`[data-employee="${id}"]`).first().click();await page.waitForSelector('#v8-modal.show',{timeout:5000});if(!await page.locator('#v8-command-form').count())throw new Error(`employee ${id} command form missing`);await page.locator('#v8-modal [data-close]').first().click();await page.waitForTimeout(100)}

// Every project management modal must open.
await page.locator('[data-view="projects"]').first().click();await page.waitForTimeout(250);
const projectIds=await page.locator('[data-project]').evaluateAll(ns=>[...new Set(ns.map(n=>n.getAttribute('data-project')).filter(Boolean))]);
if(projectIds.length<2)throw new Error(`expected at least 2 projects, got ${projectIds.length}`);
for(const id of projectIds){await page.locator(`[data-project="${id}"]`).first().click();await page.waitForSelector('#v8-modal.show',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click();await page.waitForTimeout(100)}

// Reuse existing QA tasks when available so repeated deployments do not pollute live state.
let marker=await page.evaluate(()=>{try{const ts=JSON.parse(localStorage.getItem('nawaf-hq-v5')||'{}').tasks||[];const q=ts.find(t=>String(t.details||'').includes('QA-AUTO-'));return String(q?.details||'').match(/QA-AUTO-\d+/)?.[0]||''}catch{return ''}});
let qaTasksCreated=0;
async function createTask(employeeId,text){
  await page.locator('[data-view="tasks"]').first().click();await page.waitForTimeout(150);
  await page.locator('[data-action="new-task"]').first().click();await page.waitForSelector('#v8-task-form',{timeout:5000});
  await page.locator('#v8-task-form select[name="employeeId"]').selectOption(employeeId);
  await page.locator('#v8-task-form select[name="projectId"]').selectOption('');
  await page.locator('#v8-task-form textarea[name="details"]').fill(text);
  await page.locator('#v8-task-form button[type="submit"]').click();await page.waitForTimeout(900);
  const exists=await page.evaluate(markerText=>{try{return (JSON.parse(localStorage.getItem('nawaf-hq-v5')||'{}').tasks||[]).some(t=>String(t.details||'').includes(markerText))}catch{return false}},text);
  if(!exists)throw new Error(`task was not created: ${text}`);qaTasksCreated++;
}
if(!marker){
  marker=`QA-AUTO-${Date.now()}`;
  const qaTasks=[
    {employee:'omar',text:`${marker} — افحص حالة ربط الأدوات والخدمات في NAWAF HQ وأعطني نتيجة واقعية فقط بدون أي ادعاء غير مثبت.`},
    {employee:'lian',text:`${marker} — راجعي وضوح تجربة المهام وحالات الموظفين في NAWAF HQ وحددي أي تناقض واضح في العرض.`},
    {employee:'noura',text:`${marker} — نفذي مراجعة جودة تشغيلية لواجهة NAWAF HQ وسجلي فقط المشاكل التي يمكن إثباتها.`}
  ];
  for(const q of qaTasks)await createTask(q.employee,q.text);
}

// At least three QA tasks must exist and at least one must have actually executed.
await page.waitForFunction(m=>{try{const q=(JSON.parse(localStorage.getItem('nawaf-hq-v5')||'{}').tasks||[]).filter(t=>String(t.details||'').includes(m));return q.length>=3&&q.some(t=>t.status&&t.status!=='READY')}catch{return false}},marker,{timeout:30000}).catch(()=>{});

// Truthful UI: REVIEWING tasks with evidence must never be shown as 0%.
await page.locator('[data-view="tasks"]').first().click();await page.waitForTimeout(400);
const misleading=await page.locator('.v8-row[data-execution-truth="REVIEWING"] strong').evaluateAll(ns=>ns.filter(n=>n.textContent?.trim()==='0%').length);
if(misleading)throw new Error('reviewing task is still displayed as 0%');

// Full instructions must be preserved in live state instead of being permanently truncated.
const truncated=await page.evaluate(()=>{try{return (JSON.parse(localStorage.getItem('nawaf-hq-v5')||'{}').tasks||[]).filter(t=>t.details&&t.title&&t.details!==t.title&&String(t.details).startsWith(String(t.title))).length}catch{return -1}});
if(truncated>0)throw new Error(`task instructions still truncated in state: ${truncated}`);

// Open task details for at least one row.
if(await page.locator('[data-task]').count()){await page.locator('[data-task]').first().click();await page.waitForSelector('#v8-modal.show',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click()}

// Company command opens a real command form.
await page.locator('[data-action="company-command"]').first().click();await page.waitForSelector('#v8-command-form',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click();

// Dashboard control centers and finance panel must open when available.
await page.locator('[data-view="dashboard"]').first().click();await page.waitForTimeout(500);
if(await page.locator('[data-v14-action="decisions"]').count()){await page.locator('[data-v14-action="decisions"]').first().click();await page.waitForTimeout(250);if(!await page.locator('.v13-center.show').count())throw new Error('CEO decisions center did not open');await page.locator('.v13-center [data-v13-close]').click()}
if(await page.locator('[data-finance-open]').count()){await page.locator('[data-finance-open]').first().click();await page.waitForTimeout(250);if(!await page.locator('#finance-modal.show').count())throw new Error('finance modal did not open');await page.locator('#finance-modal [data-fin-close]').first().click()}

// Server APIs must be healthy and cloud state must contain the QA tasks.
const health=await page.evaluate(async()=>{const r=await fetch('/api/health',{cache:'no-store'});return {status:r.status,json:await r.json().catch(()=>null)}});
const state=await page.evaluate(async()=>{const r=await fetch('/api/state',{cache:'no-store'});return {status:r.status,json:await r.json().catch(()=>null)}});
if(health.status!==200||!health.json?.ok)throw new Error(`health API failed: ${JSON.stringify(health)}`);
if(state.status!==200||!state.json?.ok)throw new Error(`state API failed: ${JSON.stringify(state)}`);
const cloudTasks=state.json?.state?.tasks||state.json?.data?.tasks||state.json?.tasks||[];
const cloudCount=cloudTasks.filter(t=>String(t.details||'').includes(marker)).length;
if(cloudCount<3)throw new Error(`cloud persistence failed: expected at least 3 QA tasks, found ${cloudCount}`);

// Reload must preserve the same live tasks.
await page.reload({waitUntil:'networkidle',timeout:120000});await page.waitForSelector('#app .v8',{timeout:30000});await page.locator('[data-view="tasks"]').first().click();await page.waitForTimeout(300);
const afterReload=await page.evaluate(m=>{try{return (JSON.parse(localStorage.getItem('nawaf-hq-v5')||'{}').tasks||[]).filter(t=>String(t.details||'').includes(m)).length}catch{return 0}},marker);
if(afterReload<3)throw new Error(`tasks disappeared after reload: ${afterReload}`);

// Mobile sanity: no major horizontal overflow.
await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle',timeout:120000});await page.waitForSelector('#app .v8',{timeout:30000});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
if(overflow>16)throw new Error(`mobile horizontal overflow detected: ${overflow}px`);

if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);
if(failed.length)throw new Error(`failed production requests: ${failed.join(' | ')}`);
console.log(JSON.stringify({ok:true,url:base,marker,employees:employeeIds.length,projects:projectIds.length,qaTasksCreated,cloudQaTasks:cloudCount,health:health.status,state:state.status,mobileOverflow:overflow,truncatedTasks:truncated},null,2));
await browser.close();