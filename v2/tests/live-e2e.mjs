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
const requiredHealthy=['supabase','executionWorker','paperBroker','realtime','aiBackend','navMemory','render'];
for(const key of requiredHealthy){
  assert.equal(health.checks[key].status,'Healthy',`${key} is not healthy: ${health.checks[key].status}${health.checks[key].detail?` — ${health.checks[key].detail}`:''}`);
}
for(const key of ['projectExecutor','github','marketData']){
  assert.notEqual(health.checks[key].status,'Unavailable',`${key} is unavailable${health.checks[key].detail?` — ${health.checks[key].detail}`:''}`);
}
console.log('V2 health',Object.fromEntries(Object.entries(health.checks).map(([key,value])=>[key,value.status])));

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

  const navResponse=await page.goto(`${base}/nav.html`,{waitUntil:'domcontentloaded',timeout:60000});
  assert.ok(navResponse?.ok(),`Nav root failed: HTTP ${navResponse?.status()}`);
  assert.equal(await page.title(),'ناڤ · Nawaf');
  await page.locator('#messageInput').waitFor({state:'visible',timeout:15000});
  await page.locator('#voiceBtn').waitFor({state:'visible',timeout:15000});

  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  const mobileErrors=[];
  mobile.on('pageerror',error=>mobileErrors.push(String(error)));
  await mobile.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await mobile.locator('.mobile-head').waitFor({state:'visible',timeout:15000});
  await mobile.locator('.bottom-nav').waitFor({state:'visible',timeout:15000});

  assert.deepEqual(pageErrors,[],`Desktop/browser page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(mobileErrors,[],`Mobile page errors: ${mobileErrors.join(' | ')}`);
  console.log('NAWAF HQ V2 live E2E passed',health.version,health.timestamp);
} finally {
  await browser.close();
}
