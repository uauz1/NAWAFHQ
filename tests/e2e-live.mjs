import { chromium } from 'playwright';
const base=process.env.HQ_URL||'https://nawaf-hq-main.onrender.com';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];const failed=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
page.on('requestfailed',r=>{const u=r.url(),method=r.method(),err=r.failure()?.errorText||'';if(u.startsWith(base)&&!(method==='HEAD'&&/ERR_ABORTED/i.test(err)))failed.push(`${method} ${u} ${err}`)});
await page.goto(base,{waitUntil:'networkidle',timeout:90000});
await page.waitForSelector('#app .v8',{timeout:30000});
if(!await page.locator('[data-view="dashboard"]').count())throw new Error('dashboard nav missing');
for(const v of ['workforce','projects','tasks','reports','dashboard']){await page.locator(`[data-view="${v}"]`).first().click();await page.waitForTimeout(250);if(!await page.locator(`[data-view="${v}"].active`).count())throw new Error(`view ${v} did not activate`)}
await page.locator('[data-view="workforce"]').first().click();await page.waitForTimeout(200);if(await page.locator('[data-employee]').count()){await page.locator('[data-employee]').first().click();await page.waitForSelector('#v8-modal.show',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click()}
await page.locator('[data-view="projects"]').first().click();await page.waitForTimeout(200);if(await page.locator('[data-project]').count()){await page.locator('[data-project]').first().click();await page.waitForSelector('#v8-modal.show',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click()}
await page.locator('[data-view="tasks"]').first().click();await page.waitForTimeout(200);await page.locator('[data-action="new-task"]').first().click();await page.waitForSelector('#v8-modal.show',{timeout:5000});await page.locator('#v8-modal [data-close]').first().click();
await page.locator('[data-view="dashboard"]').first().click();await page.waitForTimeout(500);if(await page.locator('[data-v14-action="decisions"]').count()){await page.locator('[data-v14-action="decisions"]').first().click();await page.waitForTimeout(250);if(!await page.locator('.v13-center.show').count())throw new Error('CEO decisions center did not open');await page.locator('.v13-center [data-v13-close]').click()}
if(await page.locator('[data-finance-open]').count()){await page.locator('[data-finance-open]').first().click();await page.waitForTimeout(250);if(!await page.locator('#finance-modal.show').count())throw new Error('finance modal did not open');await page.locator('#finance-modal [data-fin-close]').first().click()}
const health=await page.evaluate(async()=>{const r=await fetch('/api/health',{cache:'no-store'});return {status:r.status,json:await r.json().catch(()=>null)}});
const state=await page.evaluate(async()=>{const r=await fetch('/api/state',{cache:'no-store'});return {status:r.status,json:await r.json().catch(()=>null)}});
if(health.status!==200||!health.json?.ok)throw new Error(`health API failed: ${JSON.stringify(health)}`);
if(state.status!==200||!state.json?.ok)throw new Error(`state API failed: ${JSON.stringify(state)}`);
if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);
if(failed.length)throw new Error(`failed production requests: ${failed.join(' | ')}`);
console.log(JSON.stringify({ok:true,url:base,employees:await page.locator('[data-employee]').count(),projects:await page.locator('[data-project]').count(),health:health.status,state:state.status},null,2));
await browser.close();