(function(){'use strict';
let savedY=0,locked=false,lastCommand='';
const get=()=>document.getElementById('smart-command-modal');
function isOpen(){return !!get()?.classList.contains('show')}
function lock(){if(locked)return;savedY=window.scrollY||0;locked=true;document.body.classList.add('hq-smart-command-open');document.body.style.position='fixed';document.body.style.top=(-savedY)+'px';document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%'}
function unlock(){if(!locked)return;locked=false;document.body.classList.remove('hq-smart-command-open');document.body.style.position='';document.body.style.top='';document.body.style.left='';document.body.style.right='';document.body.style.width='';window.scrollTo(0,savedY)}
function sync(){isOpen()?lock():unlock()}
new MutationObserver(sync).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
document.addEventListener('input',e=>{if(e.target?.id==='smart-command-text')lastCommand=e.target.value},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="company-command"],#company-command');if(!b)return;setTimeout(()=>{sync();const t=document.getElementById('smart-command-text');if(t){if(!t.value&&lastCommand)t.value=lastCommand;t.focus({preventScroll:true})}},30)},true);
document.addEventListener('submit',e=>{if(e.target?.id!=='smart-command-form')return;const t=document.getElementById('smart-command-text');if(t)lastCommand=t.value},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){e.preventDefault();get().querySelector('[data-smart-cancel],#smart-command-cancel')?.click()}},true);
window.addEventListener('pageshow',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
})();