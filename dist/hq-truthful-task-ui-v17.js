(function(){'use strict';
const KEY='nawaf-hq-v5';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
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
  const s=read(); const tasks=Array.isArray(s.tasks)?s.tasks:[];
  document.querySelectorAll('.v8-row[data-task]').forEach(row=>{
    const t=tasks.find(x=>String(x.id)===String(row.dataset.task)); if(!t)return;
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
    detail.textContent=t?`${t.title?.slice(0,52)||'مهمة نشطة'} • ${taskBadge(t)}`:(e.task?e.task:'بدون مهمة حالية');
  });
}
const style=document.createElement('style');style.textContent='.v17-work-detail{display:block!important;grid-column:2/-1;margin-top:4px;color:#8fa1b5!important;font-size:11px!important;line-height:1.45;white-space:normal}.v8-row[data-execution-truth="REVIEWING"] strong{color:#e8bd60!important}.v8-row[data-execution-truth="WORKING"] strong,.v8-row[data-execution-truth="RESEARCHING"] strong{color:#65d69e!important}.v8-row[data-execution-truth="WAITING_FOR_NAWAF"] strong{color:#f0a35a!important}';document.head.appendChild(style);
const obs=new MutationObserver(()=>requestAnimationFrame(enhance));obs.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('nawaf:state-updated',()=>setTimeout(enhance,50));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();