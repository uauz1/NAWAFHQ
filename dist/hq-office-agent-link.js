(function(){
'use strict';
const KEY='nawaf-hq-v5';
let busy=false;
let lastSnapshot='';

function read(){
  try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}
}
function write(s){
  localStorage.setItem(KEY,JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'office-agent-link'}}));
}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function employee(s,id){return (s.employees||[]).find(e=>e.id===id)}
function activity(s,text,type='REAL'){
  s.activity=s.activity||[];
  s.activity.unshift({id:uid('a'),text,type,at:new Date().toISOString()});
  s.activity=s.activity.slice(0,100);
}
function toast(text){
  const el=document.querySelector('.toast');
  if(!el)return;
  el.textContent=text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>el.classList.remove('show'),2200);
}
function findRunnableTask(s,employeeId,title){
  const tasks=s.tasks||[];
  return tasks.find(t=>t.employeeId===employeeId&&t.status!=='COMPLETED'&&(title?t.title===title:true));
}
function ensureTaskFromOffice(detail){
  const id=detail.employeeId;
  if(!id)return null;
  const s=read();
  const e=employee(s,id);
  if(!e)return null;
  const title=String(detail.taskType||detail.mode||e.task||'مهمة جديدة').trim();
  s.tasks=s.tasks||[];
  let t=findRunnableTask(s,id,title)||findRunnableTask(s,id,'');
  if(!t){
    t={id:uid('t'),title,details:title,projectId:'',employeeId:id,status:'READY',progress:0,createdAt:new Date().toISOString()};
    s.tasks.unshift(t);
  }
  t.title=title;
  t.details=t.details||title;
  t.status='READY';
  t.progress=0;
  e.status='READY';
  e.task=title;
  activity(s,e.name+' استلم مهمة من المقر: '+title,'REAL');
  write(s);
  return t;
}
async function runOfficeTask(detail){
  if(busy)return;
  busy=true;
  try{
    const task=ensureTaskFromOffice(detail);
    if(!task)return;
    if(!window.NawafAgents?.runTask){
      toast('محرك الموظفين ما زال يتحمل');
      return;
    }
    toast('تم إرسال المهمة إلى الموظف AI');
    await window.NawafAgents.runTask(task.id);
  }finally{
    busy=false;
  }
}
function syncVisualState(){
  const s=read();
  const raw=JSON.stringify((s.employees||[]).map(e=>[e.id,e.status,e.task]));
  if(raw===lastSnapshot)return;
  lastSnapshot=raw;
  const office=window.NawafHQ3D;
  if(!office)return;
  (s.employees||[]).forEach(e=>{
    if(['WORKING','RESEARCHING','REVIEWING'].includes(e.status)){
      office.assignTask?.(e.id,e.task||e.status);
    }
  });
  const waiting=(s.employees||[]).filter(e=>e.status==='WAITING_FOR_NAWAF');
  if(waiting.length)office.meeting?.();
  else if((s.tasks||[]).some(t=>t.status==='REVIEWING'))office.review?.();
}
window.addEventListener('hq:assign-task',e=>runOfficeTask(e.detail||{}));
window.addEventListener('hq:run-task',e=>runOfficeTask(e.detail||{}));
window.addEventListener('nawaf:state-updated',syncVisualState);
window.addEventListener('storage',e=>{if(e.key===KEY)syncVisualState()});
setInterval(syncVisualState,900);
document.addEventListener('DOMContentLoaded',()=>setTimeout(syncVisualState,1200));
window.NawafHQAgentLink={run:runOfficeTask,sync:syncVisualState};
})();