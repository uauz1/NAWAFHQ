import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const copilot = read('hq-company-copilot.js');
const css = read('hq-company-copilot.css');

new Script(copilot);

for (const asset of ['hq-company-copilot.js', 'hq-company-copilot.css']) {
  if (!html.includes(asset)) throw new Error(`Missing copilot asset ${asset}`);
}

for (const feature of ['/api/health', 'COMPANY_COPILOT', 'SpeechRecognition', 'speechSynthesis', 'NawafAgents.runTask', 'probeHealth', 'data-health']) {
  if (!copilot.includes(feature) && !css.includes(feature)) throw new Error(`Missing copilot feature ${feature}`);
}

if (copilot.includes('class="hq-copilot-live"><i></i><span>متصل بمحرك التنفيذ</span>')) {
  throw new Error('Copilot execution connection is still hard-coded as online');
}

for (const healthState of ['online', 'checking', 'degraded', 'offline']) {
  if (!css.includes(`data-health="${healthState}"`)) throw new Error(`Missing copilot health style ${healthState}`);
}

console.log('Company copilot truthful health checks passed');
