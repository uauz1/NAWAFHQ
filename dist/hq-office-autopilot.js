(function(){
'use strict';
const KEY='nawaf-hq-v5';
let lastTasks=new Map();
let lastEmployees=new Map();
let booted=false;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function write(s){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'office-autopilot'}}))}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function addActivity(s,text,type='REAL'){
  s.activity=Array.isArray(s.activity)?s.activity:[];
  s.activity.unshift({id:uid('a'),text,type,at:new Date().toISOString()});
  s.activity=s.activity.slice(0,120);
}
function routeEmployee(id,status){window.NawafHQ3D?.routeEmployee?.(id,status)}
function taskLabel(t){return String(t?.title||'المهمة')}
function employeeName(s,id){return (s.employees||[]).find(e=>e.id===id)?.name||'الموظف'}
function handleTaskChange(s,t,prev){
  if(!prev||prev.status===t.status)return;
  const name=employeeName(s,t.employeeId);
  if(['WORKING','RESEARCHING'].includes(t.status)){
    routeEmployee(t.employeeId,t.status);
    window.NawafHQ3D?.assignTask?.(t.employeeId,t.title||t.status);
    addActivity(s,name+' بدأ العمل داخل مكتبه على: '+taskLabel(t),'REAL');
  }else if(t.status==='REVIEWING'){
    routeEmployee(t.employeeId,'REVIEWING');
    addActivity(s,name+' انتقل إلى منطقة المراجعة: '+taskLabel(t),'REAL');
  }else if(t.status==='WAITING_FOR_NAWAF'){
    routeEmployee(t.employeeId,'WAITING_FOR_NAWAF');
    addActivity(s,name+' توجه إلى مكتب نواف ويحتاج قرارًا: '+taskLabel(t),'APPROVAL');
  }else if(t.status==='COMPLETED'){
    routeEmployee(t.employeeId,'READY');
    addActivity(s,name+' أنهى المهمة ورجع إلى مكتبه: '+taskLabel(t),'REAL');
  }else if(['READY','IDLE'].includes(t.status)){
    routeEmployee(t.employeeId,'READY');
  }
}
function handleEmployeeChange(s,e,prev){
  if(!prev||prev.status===e.status)return;
  if(['WORKING','RESEARCHING','REVIEWING','WAITING_FOR_NAWAF','READY','IDLE','COMPLETED'].includes(e.status))routeEmployee(e.id,e.status);
}
function sync(){
  const s=read();
  let changed=false;
  const nextTasks=new Map((s.tasks||[]).map(t=>[t.id,{status:t.status,title:t.title,employeeId:t.employeeId}]));
  const nextEmployees=new Map((s.employees||[]).map(e=>[e.id,{status:e.status,task:e.task}]));
  if(booted){
    for(const t of (s.tasks||[])){
      const before=lastTasks.get(t.id);
      const count=(s.activity||[]).length;
      handleTaskChange(s,t,before);
      if((s.activity||[]).length!==count)changed=true;
    }
    for(const e of (s.employees||[]))handleEmployeeChange(s,e,lastEmployees.get(e.id));
  }
  lastTasks=nextTasks;
  lastEmployees=nextEmployees;
  booted=true;
  if(changed){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('nawaf:activity-updated'))}
}
window.addEventListener('nawaf:state-updated',()=>setTimeout(sync,80));
window.addEventListener('storage',e=>{if(e.key===KEY)sync()});
window.addEventListener('nawaf:office-ready',sync);
setInterval(sync,850);
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,1000)):setTimeout(sync,1000);
window.NawafHQAutopilot={sync};
})();