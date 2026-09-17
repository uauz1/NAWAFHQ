import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=(process.env.HQ_V2_URL||'https://nawaf-hq-v2.onrender.com').replace(/\/$/,'');

const healthResponse=await fetch(`${base}/api/v2/health`,{headers:{Accept:'application/json'}});
assert.equal(healthResponse.status,200,'V2 health endpoint must return HTTP 200');
const health=await healthResponse.json();
assert.equal(health.service,'nawaf-hq-v2','Health endpoint is not V2');
assert.equal(health.authConfigured,true,'HQ_V2_ACCESS_TOKEN is not configured');
for(const key of ['supabase','executionWorker','projectExecutor','paperBroker','realtime','github','aiBackend','marketData','navMemory','render']){
  assert.ok(health.checks?.[key],`Missing health check: ${key}`);
}
assert.equal(health.checks.supabase.status,'Healthy','Supabase is not healthy');
assert.equal(health.checks.executionWorker.status,'Healthy','Execution worker is not healthy');
assert.notEqual(health.checks.projectExecutor.status,'Unavailable','Project executor is unavailable');
assert.notEqual(health.checks.github.status,'Unavailable','GitHub connectivity is unavailable');
assert.equal(health.checks.navMemory.status,'Healthy','Nav memory is not healthy');

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  assert.ok(response?.ok(),`V2 root failed: HTTP ${response?.status()}`);
  assert.equal(await page.title(),'NAWAF HQ V2');
  await page.locator('.brand').first().waitFor({state:'visible',timeout:15000});
  await page.locator('#main').waitFor({state:'visible',timeout:15000});
  await page.locator('#healthLabel').waitFor({state:'visible',timeout:15000});
  assert.match(await page.locator('body').innerText(),/NAWAF HQ/);

  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await mobile.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await mobile.locator('.mobile-head').waitFor({state:'visible',timeout:15000});
  await mobile.locator('.bottom-nav').waitFor({state:'visible',timeout:15000});

  assert.deepEqual(pageErrors,[],`Browser page errors: ${pageErrors.join(' | ')}`);
  console.log('NAWAF HQ V2 live E2E passed',health.version,health.timestamp);
} finally {
  await browser.close();
}
