(function(){
'use strict';
const KEY='nawaf-hq-v5';
const activeStates=new Set(['WORKING','RESEARCHING','REVIEWING']);
const statusLabel={READY:'جاهز',IDLE:'متاح',WORKING:'يعمل',RESEARCHING:'يبحث',REVIEWING:'يراجع',WAITING_FOR_NAWAF:'بانتظار نواف',COMPLETED:'مكتمل',PAUSED:'متوقف'};
let last='';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function projectName(s,id){return (s.projects||[]).find(p=>p.id===id)?.name||'بدون مشروع'}
function employee(s,id){return (s.employees||[]).find(e=>e.id===id)}
function taskResult(t){const r=t?.aiResult;if(!r)return '';return String(r.summary||r.deliverable||r.result||r.text||'').trim()}
function ensureStyle(){
 if(document.getElementById('hq-live-ops-style'))return;
 const x=document.createElement('style');x.id='hq-live-ops-style';x.textContent=`
 .live-ops{margin:16px 0;border:1px solid rgba(215,170,75,.18);background:linear-gradient(180deg,rgba(17,24,33,.96),rgba(9,14,20,.96));border-radius:18px;padding:16px;box-shadow:0 20px 55px rgba(0,0,0,.18)}
 .live-ops-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.live-ops-head h2{margin:0;font-size:17px}.live-ops-head p{margin:5px 0 0;color:var(--muted);font-size:11px}.live-ops-actions{display:flex;gap:7px;flex-wrap:wrap}.live-ops-actions button{border:1px solid rgba(255,255,255,.12);background:#121a24;color:#edf2f6;border-radius:10px;padding:8px 11px;font:650 10px system-ui;cursor:pointer}.live-ops-actions button.primary{background:linear-gradient(135deg,#deb75f,#9b702e);color:#111;border-color:#d9ac52}.live-ops-grid{display:grid;grid-template-columns:1.4fr .9fr;gap:12px;margin-top:14px}.live-ops-card{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);border-radius:14px;padding:12px}.live-ops-card h3{font-size:11px;margin:0 0 10px;color:#d8b465;letter-spacing:.05em}.agent-live{display:grid;grid-template-columns:36px 1fr auto;gap:9px;align-items:center;padding:9px;border-radius:11px;background:#0d141d;margin-top:7px}.agent-live .avatar{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:#1c2631;color:#e7c574;font-weight:800}.agent-live b,.agent-live small{display:block}.agent-live small{color:var(--muted);font-size:10px;margin-top:2px}.agent-live .state{font-size:9px;border:1px solid rgba(100,210,155,.28);color:#79dbaa;border-radius:999px;padding:4px 7px}.ops-progress{height:4px;background:#1b2631;border-radius:999px;overflow:hidden;margin-top:6px}.ops-progress i{display:block;height:100%;background:linear-gradient(90deg,#b88837,#efc86d)}.ops-metric-row{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.ops-metric{background:#0d141d;border-radius:10px;padding:10px}.ops-metric b{display:block;font-size:17px;color:#e7c574}.ops-metric span{font-size:9px;color:var(--muted)}.result-live{padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}.result-live:first-child{border-top:0}.result-live b{font-size:11px}.result-live p{font-size:10px;color:#b6c0c9;margin:5px 0;line-height:1.7}.result-live button{border:0;background:transparent;color:#e3ba62;font:650 10px system-ui;cursor:pointer;padding:0}.ops-empty{color:var(--muted);font-size:10px;padding:12px;text-align:center}@media(max-width:900px){.live-ops-grid{grid-template-columns:1fr}.ops-metric-row{grid-template-columns:repeat(2,1fr)}}`;
 document.head.appendChild(x);
}
function openTask(id){
 const nav=document.querySelector('[data-view="tasks"]');if(nav)nav.click();
 setTimeout(()=>{const b=document.querySelector('[data-task="'+CSS.escape(id)+'"]');if(b)b.click()},180);
}
function runAll(){if(window.NawafAgents?.runNext)window.NawafAgents.runNext()}
function mode(name){if(name==='meeting')window.NawafHQ3D?.meeting?.();else if(name==='review')window.NawafHQ3D?.review?.();else if(name==='work')window.NawafHQ3D?.work?.();}
function markup(s){
 const tasks=s.tasks||[],emps=s.employees||[],active=tasks.filter(t=>activeStates.has(t.status)),ready=tasks.filter(t=>t.status==='READY'),waiting=tasks.filter(t=>t.status==='WAITING_FOR_NAWAF'),done=tasks.filter(t=>t.status==='COMPLETED');
 const results=done.filter(taskResult).slice(0,4);
 return `<section class="live-ops" id="live-ops"><div class="live-ops-head"><div><h2>غرفة العمليات الحية</h2><p>الحالة الفعلية للموظفين والمهام والنتائج — مرتبطة مباشرة بالمقر ومحرك AI.</p></div><div class="live-ops-actions"><button class="primary" id="ops-run">⚡ تشغيل المهام الجاهزة (${ready.length})</button><button id="ops-meeting">◎ اجتماع</button><button id="ops-review">✓ مراجعة</button><button id="ops-work">↩ عودة للعمل</button></div></div><div class="ops-metric-row" style="margin-top:12px"><div class="ops-metric"><b>${active.length}</b><span>يعمل الآن</span></div><div class="ops-metric"><b>${ready.length}</b><span>جاهز للتشغيل</span></div><div class="ops-metric"><b>${waiting.length}</b><span>ينتظر قرارك</span></div><div class="ops-metric"><b>${done.length}</b><span>مكتمل</span></div></div><div class="live-ops-grid"><div class="live-ops-card"><h3>الموظفون النشطون</h3>${active.length?active.slice(0,8).map(t=>{const e=employee(s,t.employeeId);return `<div class="agent-live"><div class="avatar">${esc((e?.name||'AI').slice(0,1))}</div><div><b>${esc(e?.name||'موظف AI')} — ${esc(t.title||'مهمة')}</b><small>${esc(e?.role||'')} • ${esc(projectName(s,t.projectId))}</small><div class="ops-progress"><i style="width:${Math.max(0,Math.min(100,Number(t.progress)||0))}%"></i></div></div><span class="state">${esc(statusLabel[t.status]||t.status)}</span></div>`}).join(''):'<div class="ops-empty">لا يوجد موظف يعمل الآن.</div>'}</div><div class="live-ops-card"><h3>آخر النتائج</h3>${results.length?results.map(t=>`<div class="result-live"><b>${esc(t.title)}</b><p>${esc(taskResult(t).slice(0,180))}</p><button data-live-task="${esc(t.id)}">فتح المهمة ←</button></div>`).join(''):'<div class="ops-empty">لا توجد نتائج AI مكتملة بعد.</div>'}</div></div></section>`;
}
function bind(node){
 node.querySelector('#ops-run')?.addEventListener('click',runAll);
 node.querySelector('#ops-meeting')?.addEventListener('click',()=>mode('meeting'));
 node.querySelector('#ops-review')?.addEventListener('click',()=>mode('review'));
 node.querySelector('#ops-work')?.addEventListener('click',()=>mode('work'));
 node.querySelectorAll('[data-live-task]').forEach(b=>b.addEventListener('click',()=>openTask(b.dataset.liveTask)));
}
function render(force=false){
 ensureStyle();const raw=localStorage.getItem(KEY)||'';if(!force&&raw===last)return;last=raw;
 const title=document.getElementById('page-title')?.textContent||'';if(!['لوحة القيادة','المقر التفاعلي'].includes(title))return;
 const content=document.getElementById('content');if(!content)return;
 let node=document.getElementById('live-ops');const html=markup(read());
 if(node){const wrap=document.createElement('div');wrap.innerHTML=html;const fresh=wrap.firstElementChild;node.replaceWith(fresh);bind(fresh)}else{const target=content.querySelector('.workspace')||content.lastElementChild;const wrap=document.createElement('div');wrap.innerHTML=html;const fresh=wrap.firstElementChild;if(target)content.insertBefore(fresh,target);else content.appendChild(fresh);bind(fresh)}
}
['nawaf:state-updated','nawaf:activity-updated','hq:assign-task','hq:employee-arrived','hq:office-ready'].forEach(name=>window.addEventListener(name,()=>setTimeout(()=>render(true),80)));
window.addEventListener('storage',e=>{if(e.key===KEY)render(true)});
new MutationObserver(()=>render(false)).observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>render(false),1000);
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>render(true),1200)):setTimeout(()=>render(true),1200);
window.NawafLiveOps={render:()=>render(true)};
})();
