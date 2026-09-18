(function(){'use strict';
const modalSelectors=['#v8-modal','#v23-modal','#v24-modal'];
let lastFocus=null;
function visibleModal(){return modalSelectors.map(s=>document.querySelector(s)).find(m=>m&&m.classList.contains('show'))||null}
function syncViewport(){
  const vv=window.visualViewport;
  document.documentElement.style.setProperty('--hq-vv-height',Math.max(320,Math.round(vv?.height||window.innerHeight))+'px');
}
function syncModalState(){
  const m=visibleModal();
  document.body.classList.toggle('hq-form-open',!!m);
  if(m){
    m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
    if(!lastFocus)lastFocus=document.activeElement;
  }else if(lastFocus){
    const f=lastFocus;lastFocus=null;
    if(f&&document.contains(f)&&typeof f.focus==='function')setTimeout(()=>f.focus({preventScroll:true}),0);
  }
}
syncViewport();
window.addEventListener('resize',syncViewport,{passive:true});
window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',syncViewport,{passive:true});
new MutationObserver(syncModalState).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class'],childList:true});
document.addEventListener('submit',function(e){
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||!form.closest('#v8-modal,#v23-modal,#v24-modal'))return;
  const btn=e.submitter||form.querySelector('button[type="submit"],button:not([type])');
  if(btn?.dataset.hqSubmitting==='1'){e.preventDefault();e.stopImmediatePropagation();return}
  if(btn){btn.dataset.hqSubmitting='1';btn.dataset.hqOriginalText=btn.textContent||'';btn.disabled=true;btn.textContent='جاري التنفيذ…'}
  setTimeout(()=>{if(btn&&document.contains(btn)){btn.disabled=false;delete btn.dataset.hqSubmitting;if(btn.dataset.hqOriginalText)btn.textContent=btn.dataset.hqOriginalText;delete btn.dataset.hqOriginalText}},3500);
},true);
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;const m=visibleModal();if(!m)return;
  const close=m.querySelector('[data-close],[data-v24-close],header button,.v8-close');
  if(close){e.preventDefault();close.click()}
},true);
document.addEventListener('click',function(e){
  const trigger=e.target.closest('[data-action="new-task"],[data-action="company-command"],[data-smart-command],[data-v8-command],[data-v24-page="tasks"]');
  if(trigger)setTimeout(()=>{syncViewport();syncModalState()},0);
},true);
window.addEventListener('pageshow',()=>{syncViewport();syncModalState()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncViewport();syncModalState()}});
})();