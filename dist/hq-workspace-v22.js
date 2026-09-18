(function(){'use strict';
const scenes=[
 {id:'mountains',label:'قمم هادئة'},
 {id:'coast',label:'ساحل مفتوح'},
 {id:'city',label:'مساحة عمل'},
 {id:'forest',label:'طبيعة عميقة'}
];
let index=0,timer=null;
const $=s=>document.querySelector(s);
function setScene(i,user=false){index=(i+scenes.length)%scenes.length;const s=scenes[index];document.documentElement.dataset.v22Scene=s.id;const hero=$('.v14-hero');if(hero){hero.querySelectorAll('.v22-scene-controls button').forEach((b,n)=>b.classList.toggle('active',n===index));const l=hero.querySelector('.v22-scene-label');if(l)l.textContent=s.label}if(user)restart()}
function controls(){const hero=$('.v14-hero');if(!hero||hero.dataset.v22Ready)return;hero.dataset.v22Ready='1';const c=document.createElement('div');c.className='v22-scene-controls';c.setAttribute('aria-label','تغيير خلفية الواجهة');c.innerHTML=scenes.map((s,i)=>'<button type="button" aria-label="'+s.label+'" data-v22-scene="'+i+'"></button>').join('');const l=document.createElement('div');l.className='v22-scene-label';hero.append(l,c);c.querySelectorAll('button').forEach(b=>b.onclick=()=>setScene(Number(b.dataset.v22Scene),true));setScene(index)}
function restart(){clearInterval(timer);const motion=document.documentElement.dataset.v21Motion!=='off';if(motion)timer=setInterval(()=>setScene(index+1),18000)}
function refineHero(){const h=$('.v14-hero h2');if(h&&!h.dataset.v22Copy){h.dataset.v22Copy='1';const hour=new Date().getHours();const hello=hour<12?'صباح الخير يا نواف':hour<18?'مساء الخير يا نواف':'مساء الخير يا نواف';h.innerHTML=hello+'<br><em>خل الشركة تتحرك معك.</em>';const p=$('.v14-hero p');if(p)p.textContent='واجهة قيادة أوضح، أهدأ، وأقرب لمساحة عمل حقيقية — من القرار إلى التنفيذ بدون ضجيج بصري.'}}
function enhance(){refineHero();controls()}
function boot(){setScene(Math.floor(Date.now()/86400000)%scenes.length);enhance();restart();const app=$('#app');if(app)new MutationObserver(()=>setTimeout(enhance,60)).observe(app,{childList:true,subtree:true});window.addEventListener('nawaf:state-updated',()=>setTimeout(enhance,80));document.addEventListener('click',e=>{if(e.target.closest('[data-view]'))setTimeout(enhance,100)});window.addEventListener('storage',restart)}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
window.NawafHQV22={setScene:(i)=>setScene(i,true)};
})();