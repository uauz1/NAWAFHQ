(function(){
'use strict';
const KEY='nawaf-hq-v5';
let lastRaw='';
let syncing=false;

function read(){
  try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}
}
function write(s){localStorage.setItem(KEY,JSON.stringify(s))}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function addActivity(s,text,type='REAL'){
  s.activity=s.activity||[];
  s.activity.unshift({id:uid('a'),text,type,at:new Date().toISOString()});
  s.activity=s.activity.slice(0,100);
}
function office(){return window.NawafHQ3D||null}
function toast(text){
  const t=document.querySelector('.toast');
  if(!t)return;
  t.textContent=text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>t.classList.remove('show'),1800);
}
function mode(name){
  const o=office();
  if(!o)return toast('المقر ما زال يتحمل');
  if(name==='meeting'&&o.meeting)o.meeting();
  else if(name==='review'&&o.review)o.review();
  else if(name==='collab'&&o.collab)o.collab();
  else if(name==='work'&&o.work)o.work();
  else if(o.mode)o.mode(name);
  document.querySelectorAll('[data-hq-mode]').forEach(b=>b.classList.toggle('active',b.dataset.hqMode===name));
}
function injectControls(){
  const host=document.querySelector('.command-top');
  if(!host||host.querySelector('.hq-live-actions'))return;
  const box=document.createElement('div');
  box.className='hq-live-actions';
  box.innerHTML='<button type="button" data-hq-mode="work">▶ تشغيل الفريق</button><button type="button" data-hq-mode="meeting">◎ اجتماع</button><button type="button" data-hq-mode="review">✓ مراجعة</button><button type="button" data-hq-mode="collab">⇄ تعاون</button><button type="button" data-hq-mode="overview" class="active">◈ عرض كامل</button>';
  box.querySelectorAll('[data-hq-mode]').forEach(b=>b.onclick=()=>mode(b.dataset.hqMode));
  host.appendChild(box);
}
function injectStyles(){
  if(document.getElementById('hq-bridge-style'))return;
  const s=document.createElement('style');
  s.id='hq-bridge-style';
  s.textContent='.hq-live-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}.hq-live-actions button{border:1px solid rgba(255,255,255,.12);background:#121a24;color:#e8edf2;border-radius:9px;padding:7px 10px;font:600 10px system-ui;cursor:pointer}.hq-live-actions button:hover,.hq-live-actions button.active{border-color:rgba(215,170,75,.55);background:linear-gradient(135deg,#dcb45e,#9d7230);color:#111}.team-chip.hq-working{box-shadow:0 0 0 1px rgba(99,209,157,.35),0 0 22px rgba(99,209,157,.08)}';
  document.head.appendChild(s);
}
function paintTeam(){
  const s=read();
  (s.employees||[]).forEach(e=>{
    document.querySelectorAll('[data-employee="'+CSS.escape(e.id)+'"]').forEach(el=>{
      el.classList.toggle('hq-working',['WORKING','RESEARCHING','REVIEWING'].includes(e.status));
    });
  });
}
function syncOfficeFromState(force){
  const raw=localStorage.getItem(KEY)||'';
  if(!force&&raw===lastRaw)return;
  let prev={};
  try{prev=lastRaw?JSON.parse(lastRaw):{}}catch{}
  let next={};
  try{next=raw?JSON.parse(raw):{}}catch{}
  lastRaw=raw;
  paintTeam();
  const before=new Map((prev.employees||[]).map(e=>[e.id,e]));
  const after=next.employees||[];
  if((prev.employees||[]).length!==after.length&&office()?.boot){
    window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'workforce-size'}}));
    return;
  }
  after.forEach(e=>{
    const old=before.get(e.id)||{};
    if(e.status!==old.status||e.task!==old.task){
      if(['WORKING','RESEARCHING','REVIEWING'].includes(e.status)){
        office()?.assignTask?.(e.id,e.task||({RESEARCHING:'بحث',REVIEWING:'مراجعة'}[e.status]||'تنفيذ'));
      }
      if(['READY','IDLE','COMPLETED'].includes(e.status)) office()?.work?.();
    }
  });
}
function updateFromOffice(detail){
  if(syncing)return;
  const id=detail.employeeId;
  if(!id)return;
  const s=read();
  const e=(s.employees||[]).find(x=>x.id===id);
  if(!e)return;
  const type=detail.taskType||detail.mode||'تنفيذ';
  e.status='WORKING';
  e.task=type;
  s.tasks=s.tasks||[];
  let t=s.tasks.find(x=>x.employeeId===id&&x.status!=='COMPLETED');
  if(!t){
    t={id:uid('t'),title:type,details:type,projectId:'',employeeId:id,status:'WORKING',progress:0,createdAt:new Date().toISOString()};
    s.tasks.unshift(t);
  }else{
    t.title=type;
    t.status='WORKING';
  }
  addActivity(s,e.name+' بدأ: '+type,'REAL');
  syncing=true;
  write(s);
  lastRaw=localStorage.getItem(KEY)||'';
  syncing=false;
  toast('تم تحديث '+e.name+' وربط المهمة بالمقر');
  setTimeout(()=>location.reload(),450);
}
function eventLog(text){
  const s=read();
  addActivity(s,text,'REAL');
  write(s);
  lastRaw=localStorage.getItem(KEY)||'';
}
window.addEventListener('hq:assign-task',e=>updateFromOffice(e.detail||{}));
window.addEventListener('hq:employee-arrived',e=>{
  const d=e.detail||{},s=read(),emp=(s.employees||[]).find(x=>x.id===d.employeeId);
  if(emp)eventLog(emp.name+' وصل إلى وجهته داخل المقر');
});
window.addEventListener('hq:employee-meeting',e=>{
  const d=e.detail||{},s=read(),emp=(s.employees||[]).find(x=>x.id===d.employeeId);
  if(emp)eventLog(emp.name+' انضم إلى الاجتماع');
});
window.addEventListener('nawaf:office-ready',()=>syncOfficeFromState(true));
window.addEventListener('storage',e=>{if(e.key===KEY)syncOfficeFromState(true)});

function tick(){injectStyles();injectControls();paintTeam();syncOfficeFromState(false)}
new MutationObserver(()=>{injectControls();paintTeam()}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(tick,700);
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{lastRaw=localStorage.getItem(KEY)||'';tick()},900));
window.NawafHQBridge={mode,sync:()=>syncOfficeFromState(true),assign:function(employeeId,taskType){office()?.assignTask?.(employeeId,taskType)}};
})();
