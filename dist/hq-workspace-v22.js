(function(){'use strict';
const scenes=[['mountains','قمم هادئة'],['coast','ساحل مفتوح'],['workspace','مساحة عمل'],['forest','طبيعة عميقة']];
let index=0,timer;
const $=s=>document.querySelector(s);
function setScene(i,manual){index=(i+scenes.length)%scenes.length;document.documentElement.dataset.v22Scene=scenes[index][0];const hero=$('.v14-hero');if(hero){hero.querySelectorAll('.v22-scenes button').forEach((b,n)=>b.classList.toggle('active',n===index));const l=hero.querySelector('.v22-scene-label');if(l)l.textContent=scenes[index][1]}if(manual)restart()}
function copy(){const hero=$('.v14-hero');if(!hero)return;const h=hero.querySelector('h2');if(h&&!h.dataset.v22){h.dataset.v22='1';const hour=new Date().getHours();const greeting=hour<12?'صباح الخير يا نواف':hour<18?'مساء الخير يا نواف':'مساء الخير يا نواف';h.innerHTML=greeting+'<br><em>خل الشركة تتحرك معك.</em>';const p=hero.querySelector('p');if(p)p.textContent='واجهة قيادة أهدأ وأوضح، تعطيك الصورة كاملة وتخليك تنتقل من القرار إلى التنفيذ بدون زحمة بصرية.'}}
function decorate(){const hero=$('.v14-hero');if(!hero)return;copy();if(hero.dataset.v22Controls)return;hero.dataset.v22Controls='1';const label=document.createElement('div');label.className='v22-scene-label';const controls=document.createElement('div');controls.className='v22-scenes';controls.setAttribute('aria-label','تغيير خلفية لوحة القيادة');controls.innerHTML=scenes.map((s,i)=>'<button type="button" aria-label="'+s[1]+'" data-v22="'+i+'"></button>').join('');hero.append(label,controls);controls.querySelectorAll('button').forEach(b=>b.onclick=()=>setScene(Number(b.dataset.v22),true));setScene(index)}
function restart(){clearInterval(timer);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>setScene(index+1),18000)}
function enhance(){decorate()}
function boot(){setScene(Math.floor(Date.now()/86400000)%scenes.length);enhance();restart();new MutationObserver(()=>setTimeout(enhance,70)).observe(document.body,{childList:true,subtree:true});window.addEventListener('nawaf:state-updated',()=>setTimeout(enhance,90));document.addEventListener('click',e=>{if(e.target.closest('[data-view]'))setTimeout(enhance,120)})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
window.NawafHQV22={setScene:(i)=>setScene(i,true)};
})();