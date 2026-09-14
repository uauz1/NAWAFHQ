(function(){
'use strict';
const KEY='nawaf-hq-v5';
let lastRaw='';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function write(s){localStorage.setItem(KEY,JSON.stringify(s))}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function addActivity(s,text,type='REAL'){s.activity=s.activity||[];s.activity.unshift({id:uid('a'),text,type,at:new Date().toISOString()});s.activity=s.activity.slice(0,100)}
function office(){return window.NawafHQ3D||null}
function mode(name){const o=office();if(!o)return;if(name==='meeting')o.meeting?.();else if(name==='review')o.review?.();else if(name==='collab')o.collab?.();else if(name==='work')o.work?.();else o.mode?.(name);document.querySelectorAll('[data-hq-mode]').forEach(b=>b.classList.toggle('active',b.dataset.hqMode===name))}
function controls(){const host=document.querySelector('.command-top');if(!host||host.querySelector('.hq-live-actions'))return;const box=document.createElement('div');box.className='hq-live-actions';box.innerHTML='<button data-hq-mode="work">▶ تشغيل الفريق</button><button data-hq-mode="meeting">◎ اجتماع</button><button data-hq-mode="review">✓ مراجعة</button><button data-hq-mode="collab">⇄ تعاون</button><button data-hq-mode="overview" class="active">◈ عرض كامل</button>';box.querySelectorAll('button').forEach(b=>b.onclick=()=>mode(b.dataset.hqMode));host.appendChild(box)}
function styles(){if(document.getElementById('hq-bridge-style-v18'))return;const s=document.createElement('style');s.id='hq-bridge-style-v18';s.textContent='.hq-live-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}.hq-live-actions button{border:1px solid rgba(255,255,255,.12);background:#121a24;color:#e8edf2;border-radius:9px;padding:7px 10px;font:600 10px system-ui;cursor:pointer}.hq-live-actions button:hover,.hq-live-actions button.active{border-color:rgba(215,170,75,.55);background:linear-gradient(135deg,#dcb45e,#9d7230);color:#111}.team-chip.hq-working{box-shadow:0 0 0 1px rgba(99,209,157,.35),0 0 22px rgba(99,209,157,.08)}';document.head.appendChild(s)}
function paint(){const s=read();(s.employees||[]).forEach(e=>document.querySelectorAll('[data-employee="'+CSS.escape(e.id)+'"]').forEach(el=>el.classList.toggle('hq-working',['WORKING','RESEARCHING','REVIEWING'].includes(e.status))))}
function sync(force){const raw=localStorage.getItem(KEY)||'';if(!force&&raw===lastRaw)return;let before={};try{before=lastRaw?JSON.parse(lastRaw):{}}catch{}const next=read();lastRaw=raw;paint();if((before.employees||[]).length!==(next.employees||[]).length){const w=document.querySelector('.hq-3d-stage');if(w)w.dataset.forceOfficeReload='1';window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'workforce-size'}}));return}const o=office();(next.employees||[]).forEach(e=>o?.routeEmployee?.(e.id,e.status||'READY'))}
function logArrival(detail){const s=read(),e=(s.employees||[]).find(x=>x.id===detail.employeeId);if(!e)return;addActivity(s,e.name+' وصل إلى وجهته داخل المقر');write(s);lastRaw=localStorage.getItem(KEY)||''}
window.addEventListener('hq:employee-arrived',e=>logArrival(e.detail||{}));
window.addEventListener('nawaf:office-ready',()=>sync(true));
window.addEventListener('storage',e=>{if(e.key===KEY)sync(true)});
function tick(){styles();controls();paint();sync(false)}
new MutationObserver(()=>{controls();paint()}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(tick,800);document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{lastRaw=localStorage.getItem(KEY)||'';tick()},900));
window.NawafHQBridge={mode,sync:()=>sync(true)};
})();