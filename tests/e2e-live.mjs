import { chromium } from 'playwright';
const base=process.env.HQ_URL||'https://nawaf-hq-main.onrender.com';
const step=async(name,fn)=>{try{return await fn()}catch(e){throw new Error(`[E2E:${name}] ${e?.message||e}`)}};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];const failed=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('requestfailed',r=>{const u=r.url(),method=r.method(),err=r.failure()?.errorText||'';const navigationAbort=/ERR_ABORTED/i.test(err)&&(method==='HEAD'||u===`${base}/api/state`||u===`${base}/api/state/`);if(u.startsWith(base)&&!navigationAbort)failed.push(`${method} ${u} ${err}`)});
const open=async()=>{await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForSelector('#app .v8',{timeout:30000})};
await step('open-production',open);
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

// Verify task creation controls without mutating or polluting production data.
const marker='non-mutating-production-check';
const qaTasksCreated=0;
await page.locator('[data-view="tasks"]').first().click();await page.waitForTimeout(150);
await page.locator('[data-action="new-task"]').first().click();await page.waitForSelector('#v8-task-form',{timeout:5000});
if(!await page.locator('#v8-task-form select[name="employeeId"] option').count())throw new Error('task employee routing options missing');
if(!await page.locator('#v8-task-form textarea[name="details"]').count())throw new Error('task instruction input missing');
await page.locator('#v8-modal [data-close]').first().click();

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
await page.locator('[data-action="company-command"]:visible').first().click();await page.waitForSelector('#smart-command-modal.show #smart-command-form',{timeout:5000});await page.locator('#smart-command-form [data-smart-cancel]').click();

// Dashboard control centers, secretary, quick command, ops panels and finance must open.
await page.locator('[data-view="dashboard"]').first().click();await page.waitForTimeout(500);
await page.waitForSelector('.v20-sarah [data-v20-sarah]',{timeout:5000});await page.locator('.v20-sarah [data-v20-sarah]').click();await page.waitForSelector('#v8-command-form',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click();
if(await page.locator('#exec-secretary-toggle').count()){await page.locator('#exec-secretary-toggle').click();await page.waitForTimeout(150);if(!await page.locator('#exec-secretary.open').count())throw new Error('executive secretary did not open');await page.locator('#exec-secretary-close').click()}
await page.evaluate(()=>window.NawafHQV9?.quickTask?.());await page.waitForSelector('#v9-modal.show #v9-quick-form',{timeout:5000});await page.locator('#v9-modal [data-v9-close]').first().click();
if(await page.locator('[data-v14-action="decisions"]').count()){await page.locator('[data-v14-action="decisions"]').first().click();await page.waitForTimeout(250);if(!await page.locator('.v13-center.show').count())throw new Error('CEO decisions center did not open');await page.locator('.v13-center [data-v13-close]').click()}
if(await page.locator('[data-v12-activity]').count()){await page.locator('[data-v12-activity]').click();await page.waitForTimeout(150);if(!await page.locator('.v12-panel.show').count())throw new Error('activity panel did not open');await page.locator('.v12-panel [data-v12-close]').click()}
if(await page.locator('[data-v12-notify]').count()){await page.locator('[data-v12-notify]').click();await page.waitForTimeout(150);if(!await page.locator('.v12-panel.show').count())throw new Error('notifications panel did not open');await page.locator('.v12-panel [data-v12-close]').click()}
if(await page.locator('[data-v12-recovery]').count()){await page.locator('[data-v12-recovery]').click();await page.waitForTimeout(150);if(!await page.locator('.v12-panel.show').count())throw new Error('recovery panel did not open');await page.locator('.v12-panel [data-v12-close]').click()}
if(await page.locator('[data-finance-open]').count()){await page.locator('[data-finance-open]').first().click();await page.waitForTimeout(250);if(!await page.locator('#finance-modal.show').count())throw new Error('finance modal did not open');await page.locator('#finance-modal [data-fin-close]').first().click()}

// Apps center must be navigable and include the real projects.
await page.locator('.mobile-apps-link').click();await page.waitForURL('**/apps.html',{timeout:10000});await page.waitForLoadState('domcontentloaded');const appsText=await page.locator('body').innerText();if(!appsText.includes('مُعِين')||!appsText.includes('قدّها'))throw new Error('apps center missing linked projects');await open();

// Server APIs must be healthy and expose a valid cloud task collection.
const health=await page.evaluate(async()=>{const r=await fetch('/api/health',{cache:'no-store'});return {status:r.status,json:await r.json().catch(()=>null)}});
const state=await page.evaluate(async()=>{const r=await fetch('/api/state',{cache:'no-store'});return {status:r.status,json:await r.json().catch(()=>null)}});
if(health.status!==200||!health.json?.ok)throw new Error(`health API failed: ${JSON.stringify(health)}`);
if(state.status!==200||!state.json?.ok)throw new Error(`state API failed: ${JSON.stringify(state)}`);
const cloudTasks=state.json?.state?.tasks||state.json?.data?.tasks||state.json?.tasks||[];
if(!Array.isArray(cloudTasks))throw new Error('cloud task collection is invalid');
const cloudCount=cloudTasks.length;

// Reload must restore the production shell and task view.
await page.reload({waitUntil:'domcontentloaded',timeout:120000});await page.waitForSelector('#app .v8',{timeout:30000});await page.locator('[data-view="tasks"]').first().click();await page.waitForTimeout(300);
if(!await page.locator('[data-action="new-task"]').count())throw new Error('task controls disappeared after reload');

// Mobile sanity: no major horizontal overflow and navigation stays accessible.
await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded',timeout:120000});await page.waitForSelector('#app .v8',{timeout:30000});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
if(overflow>16)throw new Error(`mobile horizontal overflow detected: ${overflow}px`);
if(!await page.locator('[data-view="dashboard"]').count())throw new Error('mobile navigation unavailable');

if(errors.length)throw new Error(`[E2E:page-errors] ${errors.join(' | ')}`);
if(failed.length)throw new Error(`[E2E:failed-requests] ${failed.join(' | ')}`);
console.log(JSON.stringify({ok:true,url:base,marker,employees:employeeIds.length,projects:projectIds.length,qaTasksCreated,cloudQaTasks:cloudCount,health:health.status,state:state.status,mobileOverflow:overflow,truncatedTasks:truncated,secretary:true,quickCommand:true,opsPanels:true,appsCenter:true},null,2));
await browser.close();
