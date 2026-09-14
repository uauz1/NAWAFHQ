(function(){'use strict';
const KEY='nawaf-hq-v5';let cloud=false,pushing=false,lastRemote='';
function parse(v){try{return JSON.parse(v||'{}')||{}}catch{return {}}}
function emit(){window.dispatchEvent(new CustomEvent('nawaf:state-updated'))}
async function pull(){
 try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)return false;const j=await r.json();if(!j.ok)return false;cloud=true;document.documentElement.dataset.cloud='1';
 if(j.state&&Object.keys(j.state).length){const remote=JSON.stringify(j.state);lastRemote=remote;const local=localStorage.getItem(KEY)||'';if(remote!==local){localStorage.setItem(KEY,remote);emit()}}
 else {lastRemote='';await push()}
 return true}catch{return false}}
let timer;
async function push(){
 if(!cloud||pushing)return false;pushing=true;
 try{const state=parse(localStorage.getItem(KEY));const body=JSON.stringify(state);if(body===lastRemote)return true;const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state}),keepalive:true});if(!r.ok)return false;lastRemote=body;return true}catch{return false}finally{pushing=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{push()},250)}
const nativeSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(k,v){nativeSet.call(this,k,v);if(this===localStorage&&k===KEY)schedule()}
window.HQCloudReady=(async()=>{await pull();window.HQCloud={connected:()=>cloud,pull,push,flush:push};return cloud})();
setInterval(()=>{if(!document.hidden)pull()},10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull();else push()});
window.addEventListener('pagehide',()=>{push()});
})();