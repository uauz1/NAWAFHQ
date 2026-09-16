import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8'),css=await readFile(new URL('../web/styles.css',import.meta.url),'utf8'),js=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
test('core operational navigation exists',()=>{for(const route of ['command','employees','projects','tasks','approvals','connections','reports','finance','activity','health'])assert.match(js,new RegExp(`'${route}'`));});
test('mobile and tablet layout protections exist',()=>{assert.match(css,/@media\(max-width:800px\)/);assert.match(css,/bottom-nav/);assert.match(html,/viewport-fit=cover/);assert.doesNotMatch(css,/overflow-x:\s*auto/);});
test('accessibility essentials exist',()=>{assert.match(html,/class="skip"/);assert.match(html,/aria-label=/);assert.match(css,/prefers-reduced-motion/);});
test('no decorative 3D or mutation observers',()=>{assert.doesNotMatch(js,/MutationObserver|three\.js|WebGL/i);});
