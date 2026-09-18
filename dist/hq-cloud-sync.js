(function(){'use strict';
const KEY='nawaf-hq-v5';
let cloud=false,pushing=false,pulling=false,dirty=false,lastRemote='',lastUpdatedAt=null,timer=null,initialPullDone=false;
const nativeSet=Storage.prototype.setItem;
function sanitize(s){
 if(!s||typeof s!=='object')return {};
 const has=x=>/QA-AUTO-/i.test(String(x||'')),bad=x=>has(x?.title)||has(x?.details)||has(x?.text)||has(x?.content)||has(x?.result),ids=new Set((s.tasks||[]).filter(bad).map(x=>String(x.id)));
 for(const k of ['tasks','reports','activity','secretaryBriefs'])if(Array.isArray(s[k]))s[k]=s[k].filter(x=>!bad(x));
 if(Array.isArray(s.secretarySeen))s.secretarySeen=s.secretarySeen.filter(x=>![...ids].some(id=>String(x).startsWith(id+':'))&&!has(x));
 for(const t of (s.tasks||[])){
   if(t?.status==='COMPLETED'){
     delete t.blockedReason;delete t.blockerType;delete t.requiredTools;delete t.connectionRequest;
     t.progress=100;
   }
 }
 const occupying=new Set(['WORKING','RESEARCHING','REVIEWING']);
 const activeByEmployee=new Map();
 for(const t of (s.tasks||[]))if(t?.employeeId&&occupying.has(t.status))activeByEmployee.set(t.employeeId,t);
 for(const e of (s.employees||[])){
   if(has(e?.task)){e.task='';e.status='READY'}
   const active=activeByEmployee.get(e.id);
   if(active){e.status=active.status;e.task=active.title||active.details||''}
   else if(e.status!=='READY'||e.task){e.status='READY';e.task=''}
 }
 for(const p of (s.projects||[]))if(p?.id==='nav'&&p.status==='PAUSED'){p.status='PLANNED';p.phase='مخطط لاحقًا'}
 return s;
}
function parse(v){try{return sanitize(JSON.parse(v||'{}')||{})}catch{return {}}}
function stamp(o){if(!o||typeof o!=='object')return 0;for(const k of ['updatedAt','lastRunAt','executionFinishedAt','executionStartedAt','createdAt']){const t=Date.parse(o[k]||'');if(Number.isFinite(t))return t}return 0}
function mergeList(remote=[],local=[]){const m=new Map();for(const x of Array.isArray(remote)?remote:[])if(x&&x.id)m.set(x.id,x);for(const x of Array.isArray(local)?local:[])if(x&&x.id){const r=m.get(x.id);if(!r)m.set(x.id,x);else{const rs=stamp(r),ls=stamp(x);m.set(x.id,ls>rs?{...r,...x}:{...x,...r})}}return [...m.values()]}
function mergeState(remote={},local={},preferRemoteScalars=false){const out=preferRemoteScalars?{...local,...remote}:{...remote,...local};for(const k of ['employees','projects','tasks','reports','activity','approvals','meetings','goals','connectionRequests','secretaryBriefs'])out[k]=mergeList(remote[k],local[k]);out.settings=preferRemoteScalars?{...(local.settings||{}),...(remote.settings||{})}:{...(remote.settings||{}),...(local.settings||{})};out.projectMemory=preferRemoteScalars?{...(local.projectMemory||{}),...(remote.projectMemory||{})}:{...(remote.projectMemory||{}),...(local.projectMemory||{})};out.secretarySeen=[...new Set([...(remote.secretarySeen||[]),...(local.secretarySeen||[])])].slice(0,250);out.trading=preferRemoteScalars?{...(local.trading||{}),...(remote.trading||{})}:{...(remote.trading||{}),...(local.trading||{})};out.finance=preferRemoteScalars?{...(local.finance||{}),...(remote.finance||{})}:{...(remote.finance||{}),...(local.finance||{})};if(remote.finance?.watchlist||local.finance?.watchlist){const w=new Map();for(const x of [...(remote.finance?.watchlist||[]),...(local.finance?.watchlist||[])])if(x?.symbol)w.set(String(x.symbol).toUpperCase(),x);out.finance.watchlist=[...w.values()]};return sanitize(out)}
function emit(){window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason:'cloud-sync'}}))}
function ensurePill(){let p=document.getElementById('hq-cloud-pill');if(p)return p;p=document.createElement('div');p.id='hq-cloud-pill';p.setAttribute('aria-live','polite');Object.assign(p.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'10000',padding:'8px 11px',borderRadius:'999px',font:'600 11px system-ui',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.10)',background:'rgba(10,15,22,.86)',color:'#d9e1ea',boxShadow:'0 8px 30px rgba(0,0,0,.22)',transition:'opacity .2s ease'});document.body.appendChild(p);return p}
function status(kind,text){const p=ensurePill();p.textContent=text;const map={ok:'#9fe7b2',busy:'#f0cf82',off:'#ff9d9d'};p.style.color=map[kind]||'#d9e1ea';p.style.opacity=kind==='ok'?'0.35':'1';document.documentElement.dataset.cloud=kind==='ok'?'1':'0'}
async function getRemote(){const r=await fetch('/api/state',{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||'CLOUD_READ_FAILED');return j}
async function pull(){if(pulling||pushing)return false;pulling=true;status('busy','↻ مزامنة');try{const j=await getRemote();cloud=true;const remoteState=j.state&&typeof j.state==='object'?sanitize(j.state):null;const local=parse(localStorage.getItem(KEY));if(remoteState&&Object.keys(remoteState).length){const remoteText=JSON.stringify(remoteState);if(!initialPullDone){const merged=mergeState(remoteState,local,true);nativeSet.call(localStorage,KEY,JSON.stringify(merged));lastRemote=remoteText;lastUpdatedAt=j.updatedAt;initialPullDone=true;dirty=JSON.stringify(merged)!==remoteText;emit();if(dirty)schedule(180)}else if(dirty&&lastUpdatedAt&&j.updatedAt!==lastUpdatedAt&&remoteText!==lastRemote){const merged=mergeState(remoteState,local,false);nativeSet.call(localStorage,KEY,JSON.stringify(merged));lastRemote=remoteText;lastUpdatedAt=j.updatedAt;dirty=true;emit();schedule(180)}else if(!dirty&&remoteText!==JSON.stringify(local)){nativeSet.call(localStorage,KEY,remoteText);lastRemote=remoteText;lastUpdatedAt=j.updatedAt;emit()}else{lastRemote=remoteText;lastUpdatedAt=j.updatedAt}}else if(!Object.keys(local).length){lastRemote='';lastUpdatedAt=j.updatedAt||null;initialPullDone=true}else if(!initialPullDone){initialPullDone=true;dirty=true;schedule(180)}else{dirty=true;schedule(180)}status('ok','✓ متزامن');return true}catch{cloud=false;status('off',navigator.onLine?'⚠ تعذر الحفظ':'● أوفلاين');return false}finally{pulling=false}}
async function push(retry=true){if(pushing||!initialPullDone)return false;if(!navigator.onLine){status('off','● أوفلاين');return false}pushing=true;status('busy','↑ جاري الحفظ');try{const state=parse(localStorage.getItem(KEY));const body=JSON.stringify(state);if(body===lastRemote&&!dirty){status('ok','✓ متزامن');return true}const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,baseUpdatedAt:lastUpdatedAt}),keepalive:true});const j=await r.json().catch(()=>({}));if(r.status===409&&retry&&j.state){const merged=mergeState(j.state,state,false);nativeSet.call(localStorage,KEY,JSON.stringify(merged));lastUpdatedAt=j.updatedAt||null;lastRemote=JSON.stringify(sanitize(j.state));dirty=true;emit();return await push(false)}if(!r.ok||!j.ok)throw new Error(j.error||'CLOUD_WRITE_FAILED');lastRemote=body;lastUpdatedAt=j.updatedAt||lastUpdatedAt;dirty=false;cloud=true;status('ok','✓ متزامن');return true}catch{cloud=false;status('off','⚠ غير متزامن');return false}finally{pushing=false}}
function schedule(ms=350){clearTimeout(timer);timer=setTimeout(()=>push(),ms)}
Storage.prototype.setItem=function(k,v){const clean=this===localStorage&&k===KEY?JSON.stringify(parse(v)):v;nativeSet.call(this,k,clean);if(this===localStorage&&k===KEY){dirty=true;status('busy','• تغييرات غير محفوظة');if(initialPullDone)schedule()}}
window.HQCloudReady=(async()=>{await pull();window.HQCloud={connected:()=>cloud,pull,push,flush:()=>push(),status:()=>({cloud,dirty,lastUpdatedAt,initialPullDone})};return cloud})();
setInterval(()=>{if(!document.hidden)pull()},8000);
window.addEventListener('online',()=>{pull();schedule(200)});
window.addEventListener('offline',()=>status('off','● أوفلاين'));
window.addEventListener('storage',e=>{if(e.key===KEY)emit()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull();else push()});
window.addEventListener('pagehide',()=>push());
})();
