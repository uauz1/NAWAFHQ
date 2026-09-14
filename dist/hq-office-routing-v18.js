(function(){
'use strict';
const KEY='nawaf-hq-v5';
let last='';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function office(){return window.NawafHQ3D||null}
function sync(){
  const s=read();
  const snap=JSON.stringify((s.employees||[]).map(e=>[e.id,e.status,e.task]));
  if(snap===last)return;
  last=snap;
  const o=office();
  if(!o?.routeEmployee)return;
  (s.employees||[]).forEach(e=>o.routeEmployee(e.id,e.status||'READY'));
}
window.addEventListener('nawaf:state-updated',sync);
window.addEventListener('storage',e=>{if(e.key===KEY)sync()});
window.addEventListener('nawaf:office-ready',sync);
setInterval(sync,900);
window.NawafHQRouting={sync};
})();