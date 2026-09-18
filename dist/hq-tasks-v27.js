(function(){
  'use strict';

  const KEY='nawaf-hq-v5';
  const ACTIVE=new Set(['WORKING','RESEARCHING','REVIEWING']);
  const ROUTES={tasks:'tasks',projects:'projects',workforce:'workforce',reports:'reports'};
  let syncing=false;
  let routeTimer=0;
  let selectedPreset=sessionStorage.getItem('nawaf-task-preset-v27')||'ALL';

  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
  const now=()=>new Date().toISOString();
  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
  const ts=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0};
  const evidence=t=>Array.isArray(t?.evidence)?t.evidence:[];
  const commit=t=>t?.executionCommit||t?.applyEvidence?.commitSha||t?.aiResult?.applyEvidence?.commitSha||t?.aiResult?.projectExecution?.commitSha||'';

  function fingerprint(t){
    return [norm(t?.title),norm(t?.details),String(t?.employeeId||''),String(t?.projectId||''),String(t?.kind||'')].join('|');
  }

  function score(t){
    let n=0;
    if(t?.status==='COMPLETED')n+=500;
    if(ACTIVE.has(t?.status))n+=350;
    if(t?.status==='READY')n+=260;
    if(t?.status==='WAITING_FOR_NAWAF')n+=200;
    if(t?.status==='WAITING_FOR_CONNECTION')n+=180;
    if(t?.status==='BLOCKED_BY_TOOL'||t?.status==='BLOCKED')n+=120;
    if(commit(t))n+=220;
    n+=Math.min(100,evidence(t).length*18);
    if(t?.aiResult?.summary||t?.aiResult?.deliverable)n+=45;
    return n;
  }

  function dedupeTasks(reason='v27-auto'){
    if(syncing)return false;
    const s=read();
    if(!Array.isArray(s.tasks)||s.tasks.length<2)return false;

    const groups=new Map();
    for(const t of s.tasks){
      if(!t||t.archivedAt||t.allowDuplicate===true)continue;
      const key=fingerprint(t);
      if(!key.replace(/\|/g,''))continue;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(t);
    }

    let changed=0;
    const at=now();
    const WINDOW=90*60*1000;

    for(const group of groups.values()){
      if(group.length<2)continue;
      group.sort((a,b)=>ts(a.createdAt)-ts(b.createdAt));

      const clusters=[];
      let current=[];
      for(const t of group){
        if(!current.length){current=[t];continue;}
        const first=current[0];
        const sameBurst=Math.abs(ts(t.createdAt)-ts(first.createdAt))<=WINDOW;
        if(sameBurst)current.push(t);
        else{clusters.push(current);current=[t];}
      }
      if(current.length)clusters.push(current);

      for(const cluster of clusters){
        if(cluster.length<2)continue;
        const canonical=[...cluster].sort((a,b)=>{
          const ds=score(b)-score(a);
          if(ds)return ds;
          const de=evidence(b).length-evidence(a).length;
          if(de)return de;
          return ts(a.createdAt)-ts(b.createdAt);
        })[0];

        for(const t of cluster){
          if(t.id===canonical.id)continue;
          t.archivedAt=t.archivedAt||at;
          t.updatedAt=at;
          t.duplicateOf=canonical.id;
          t.deduplicatedBy='HQ_TASKS_V27';
          t.deduplicatedReason='exact-nearby-duplicate';
          changed++;
        }
      }
    }

    if(!changed)return false;
    syncing=true;
    s.activity=Array.isArray(s.activity)?s.activity:[];
    s.activity.unshift({id:'a'+Date.now().toString(36),text:`تم تنظيف ${changed} مهمة مكررة مع حفظها في الأرشيف`,type:'TASK_CLEANUP',at});
    s.activity=s.activity.slice(0,250);
    s.companyUpdatedAt=at;
    localStorage.setItem(KEY,JSON.stringify(s));
    window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'task-dedup-v27',source:reason,count:changed}}));
    setTimeout(()=>{syncing=false;window.HQCloud?.flush?.().catch?.(()=>{})},0);
    return true;
  }

  function taskHash(){
    const raw=(location.hash||'').replace(/^#\/?/,'').split(/[?&]/)[0].toLowerCase();
    return raw==='tasks';
  }

  function syncDirectTaskRoute(){
    clearTimeout(routeTimer);
    routeTimer=setTimeout(()=>{
      if(!taskHash())return;
      const main=document.querySelector('.v8-main');
      if(main?.dataset?.v24Page==='tasks')return;
      const btn=document.querySelector('.v8-side [data-view="tasks"]');
      if(btn){btn.click();setTimeout(enhance,80)}
    },60);
  }

  function markPreset(){
    document.querySelectorAll('[data-v24-task-preset]').forEach(b=>b.classList.toggle('active',(b.dataset.v24TaskPreset||'ALL')===selectedPreset));
  }

  function enhance(){
    const main=document.querySelector('.v8-main');
    const isTasks=main?.dataset?.v24Page==='tasks';
    document.body.classList.toggle('v27-task-page',Boolean(isTasks));
    if(!isTasks)return;

    markPreset();
    const title=main.querySelector('.v24-top h1');
    const kicker=main.querySelector('.v24-top>div>span');
    const sub=main.querySelector('.v24-top p');
    if(title)title.textContent='المهام';
    if(kicker)kicker.textContent='التنفيذ الحقيقي';
    if(sub)sub.textContent='تابع ما يعمل الآن، ما يحتاج تدخلك، وما اكتمل مع الأدلة — بدوَ تكرار أو زحمة.';

    const table=main.querySelector('.v24-task-table');
    if(table&&!table.dataset.v27Ready){
      table.dataset.v27Ready='1';
      table.setAttribute('aria-label','قائمة مهام الشركة');
    }
    main.querySelectorAll('.v24-task-row').forEach(row=>{
      row.setAttribute('aria-label','فتح تفاصيل المهمة');
      const more=row.querySelector('.v24-more');
      if(more)more.textContent='التفاصيل';
    });
  }

  document.addEventListener('click',e=>{
    const p=e.target.closest('[data-v24-task-preset]');
    if(p){selectedPreset=p.dataset.v24TaskPreset||'ALL';sessionStorage.setItem('nawaf-task-preset-v27',selectedPreseti}
  },true);

  window.addEventListener('hashchange',()=>{syncDirectTaskRoute();setTimeout(enhance,120)});
  window.addEventListener('nawaf:state-updated',e=>{
    if(e?.detail?.reason!=='task-dedup-v27')dedupeTasks(e?.detail?.reason||'state-update');
    setTimeout(enhance,90);
  });

  const observer=new MutationObserver(()=>enhance());
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-v24-page']});

  function boot(){
    dedupeTasks('boot');
    syncDirectTaskRoute();
    setTimeout(syncDirectTaskRoute,300);
    setTimeout(syncDirectTaskRoute,900);
    setTimeout(enhance,120);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
