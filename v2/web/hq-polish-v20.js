(function(){'use strict';
const qs=s=>document.querySelector(s);
function setVisibility(){document.documentElement.classList.toggle('hq-background-paused',document.hidden)}
function focusCommand(){
  const input=qs('#commandInput');
  if(input){input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});return true}
  const commandRoute=document.querySelector('[data-route="command"]');
  if(commandRoute){commandRoute.click();setTimeout(()=>{const next=qs('#commandInput');if(next){next.focus();next.scrollIntoView({block:'center',behavior:'smooth'})}},80);return true}
  return false;
}
function addHint(){
  document.querySelectorAll('.hero').forEach(hero=>{
    if(hero.querySelector('.v20-shortcut'))return;
    const form=hero.querySelector('#commandForm');if(!form)return;
    const hint=document.createElement('div');hint.className='v20-shortcut';hint.innerHTML='<kbd>Ctrl</kbd><kbd>K</kbd><span>للأوامر السريعة</span>';form.insertAdjacentElement('afterend',hint);
  });
}
document.addEventListener('visibilitychange',setVisibility,{passive:true});
document.addEventListener('keydown',e=>{
  const tag=document.activeElement?.tagName;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();focusCommand();return}
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();focusCommand()}
});
window.addEventListener('online',()=>document.documentElement.dataset.network='online');
window.addEventListener('offline',()=>document.documentElement.dataset.network='offline');
document.documentElement.dataset.network=navigator.onLine?'online':'offline';
setVisibility();addHint();
const observer=new MutationObserver(()=>requestAnimationFrame(addHint));
observer.observe(document.body,{childList:true,subtree:true});
})();