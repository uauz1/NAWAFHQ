(function(){'use strict';
function enhanceV21(){
  const secretary=document.querySelector('.secretary .section-head h2');
  if(secretary && !secretary.dataset.v21){secretary.dataset.v21='1';secretary.textContent='سارة · المكتب التنفيذي';}
  const hero=document.querySelector('.v4-hero');
  if(hero && !hero.dataset.v21){hero.dataset.v21='1';hero.setAttribute('aria-label','مركز قيادة NAWAF HQ');}
  document.querySelectorAll('.v4-project').forEach(card=>{
    if(card.dataset.v21)return;card.dataset.v21='1';
    const h=card.querySelector('h3')?.textContent?.trim()||'';
    if(/معين|مُعين|mueen/i.test(h))card.classList.add('mueen');
    else if(/قدها|قدّها|qaddha/i.test(h))card.classList.add('qaddha');
    else if(/ناف|ناڤ|nav/i.test(h))card.classList.add('nav');
  });
}
let raf=0;
const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(enhanceV21)};
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',schedule);
window.addEventListener('hashchange',schedule);
schedule();
})();