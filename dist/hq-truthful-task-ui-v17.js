(function(){'use strict';
const KEY='nawaf-hq-v5';
let repairing=false;
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
function repairFullInstructions(){
  if(repairing)return;const s=read();let changed=false;const tasks=Array.isArray(s.tasks)?s.tasks:[];
  for(const t of tasks){
    if(t?.details&&t?.title&&t.details!==t.title&&String(t.details).startsWith(String(t.title))){t.title=t.details;changed=true}
  }
  for(const e of (s.employees||[])){
    if(!e?.task)continue;const t=tasks.find(x=>x.employeeId===e.id&&!['COMPLETED'].includes(x.status));
    if(t?.details&&e.task!==t.details&&String(t.details).startsWith(String(e.task))){e.task=t.details;changed=true}
  }
  if(changed){repairing=true;localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'preserve-full-task-instructions'}}));setTimeout(()=>{repairing=false},120)}
}
function taskBadge(t){
  const evidence=Array.isArray(t?.evidence)?t.evidence.length:0;
  if(t?.status==='COMPLETED') return evidence?`مكتمل • ${evidence} أدلة ✓`:'مكتمل ✓';
  if(t?.status==='REVIEWING') return evidence?`${evidence} أدلة ✓`:'مراجعة النتائج';
  if(t?.status==='WORKING') return 'جاري التنفيذ';
  if(t?.status==='RESEARCHING') return 'بحث فعلي جاري';
  if(t?.status==='WAITING_FOR_NAWAF') return 'بانتظارك';
  if(t?.status==='READY') return 'جاهز للتنفيذ';
  return t?.status||'—';
}
function enhance(){
  repairFullInstructions();
  const s=read(); const tasks=Array.isArray(s.tasks)?s.tasks:[];
  document.querySelectorAll('.v8-row[data-task]').forEach(row=>{
    const t=tasks.find(x=>String(x.id)===String(row.dataset.task)); if(!t)return;
    const title=row.querySelector('div b');if(title&&t.details)title.textContent=t.details;
    const strong=row.querySelector('strong'); if(strong) strong.textContent=taskBadge(t);
    row.dataset.executionTruth=t.status||'';
    const info=row.querySelector('div small');
    if(info&&t.status==='REVIEWING'&&Array.isArray(t.evidence)&&t.evidence.length){
      const latest=t.evidence[t.evidence.length-1]?.text||'';
      if(latest&&!info.dataset.truthEnhanced){info.textContent+=` • آخر تحقق: ${latest}`;info.dataset.truthEnhanced='1'}
    }
  });
  document.querySelectorAll('[data-employee]').forEach(card=>{
    const id=card.dataset.employee; const e=(s.employees||[]).find(x=>String(x.id)===String(id)); if(!e)return;
    let detail=card.querySelector('.v17-work-detail');
    if(!detail){detail=document.createElement('small');detail.className='v17-work-detail';card.appendChild(detail)}
    const t=tasks.find(x=>x.employeeId===id&&!['COMPLETED'].includes(x.status));
    detail.textContent=t?`${t.details||t.title||'مهمة نشطة'} • ${taskBadge(t)}`:(e.task?e.task:'بدون مهمة حالية');
  });
}
const style=document.createElement('style');style.textContent='.v17-work-detail{display:block!important;grid-column:2/-1;margin-top:4px;color:#8fa1b5!important;font-size:11px!important;line-height:1.45;white-space:normal;display:-webkit-box!important;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.v8-row[data-task] div b{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.55}.v8-row[data-execution-truth="REVIEWING"] strong{color:#e8bd60!important}.v8-row[data-execution-truth="WORKING"] strong,.v8-row[data-execution-truth="RESEARCHING"] strong{color:#65d69e!important}.v8-row[data-execution-truth="WAITING_FOR_NAWAF"] strong{color:#f0a35a!important}';document.head.appendChild(style);
const obs=new MutationObserver(()=>requestAnimationFrame(enhance));obs.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('nawaf:state-updated',()=>setTimeout(enhance,50));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();