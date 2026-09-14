(function(){
'use strict';
const KEY='nawaf-hq-v5';
let busy=false,lastSnapshot='';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function write(s){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'office-agent-link'}}))}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function employee(s,id){return (s.employees||[]).find(e=>e.id===id)}
function activity(s,text,type='REAL'){s.activity=s.activity||[];s.activity.unshift({id:uid('a'),text,type,at:new Date().toISOString()});s.activity=s.activity.slice(0,100)}
function toast(text){const el=document.querySelector('.toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400)}
function findTask(s,employeeId,title){return (s.tasks||[]).find(t=>t.employeeId===employeeId&&t.status!=='COMPLETED'&&(title?t.title===title:true))}
function ensureTask(detail){const id=detail.employeeId;if(!id)return null;const s=read(),e=employee(s,id);if(!e)return null;const title=String(detail.taskType||detail.mode||e.task||'مهمة جديدة').trim();s.tasks=s.tasks||[];let t=findTask(s,id,title)||findTask(s,id,'');if(!t){t={id:uid('t'),title,details:title,projectId:'',employeeId:id,status:'READY',progress:0,createdAt:new Date().toISOString()};s.tasks.unshift(t)}t.title=title;t.details=t.details||title;t.status='READY';t.progress=0;e.status='READY';e.task=title;activity(s,e.name+' استلم مهمة من المقر: '+title,'REAL');write(s);return t}
function routeState(s){const o=window.NawafHQ3D;if(!o?.routeEmployee)return;(s.employees||[]).forEach(e=>o.routeEmployee(e.id,e.status||'READY'))}
function describe(task,s){const e=employee(s,task.employeeId),name=e?.name||'الموظف';if(task.status==='COMPLETED')toast(name+' أكمل المهمة ورجع لمكتبه');else if(task.status==='WAITING_FOR_NAWAF')toast(name+' يحتاج قرارك ويتجه لمكتب نواف');else if(task.status==='REVIEWING')toast(name+' انتقل إلى المراجعة');else toast(name+' حالته الآن: '+task.status)}
async function run(detail){if(busy)return;busy=true;try{const task=ensureTask(detail);if(!task)return;if(!window.NawafAgents?.runTask){toast('محرك الموظفين ما زال يتحمل');return}window.NawafHQ3D?.routeEmployee?.(task.employeeId,'WORKING');toast('بدأ الموظف AI تنفيذ المهمة');await window.NawafAgents.runTask(task.id);const s=read(),latest=(s.tasks||[]).find(t=>t.id===task.id)||task;routeState(s);describe(latest,s)}finally{busy=false}}
function sync(){const s=read(),raw=JSON.stringify((s.employees||[]).map(e=>[e.id,e.status,e.task]));if(raw===lastSnapshot)return;lastSnapshot=raw;routeState(s)}
window.addEventListener('hq:assign-task',e=>run(e.detail||{}));window.addEventListener('hq:run-task',e=>run(e.detail||{}));window.addEventListener('nawaf:state-updated',sync);window.addEventListener('storage',e=>{if(e.key===KEY)sync()});window.addEventListener('nawaf:office-ready',sync);setInterval(sync,900);document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,1200));window.NawafHQAgentLink={run,sync};
})();