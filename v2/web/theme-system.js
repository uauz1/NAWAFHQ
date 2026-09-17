const STORAGE_KEY='nawaf_hq_theme';
const themes=[
  {id:'mountain',name:'Cinematic Mountain',desc:'سينمائي · جبل · ذهبي'},
  {id:'aurora',name:'Executive Aurora',desc:'زجاجي · بنفسجي · أزرق'},
  {id:'command',name:'Command Center',desc:'عمليات · داكن · سماوي'}
];
const valid=new Set(themes.map(x=>x.id));
const saved=localStorage.getItem(STORAGE_KEY);
let current=valid.has(saved)?saved:'mountain';

document.documentElement.dataset.hqTheme=current;

function applyTheme(id,{announce=true}={}){
  if(!valid.has(id))return;
  current=id;document.documentElement.dataset.hqTheme=id;localStorage.setItem(STORAGE_KEY,id);
  document.querySelectorAll('[data-hq-theme-option]').forEach(b=>b.classList.toggle('active',b.dataset.hqThemeOption===id));
  if(announce){document.dispatchEvent(new CustomEvent('hq:theme-changed',{detail:{theme:id}}));}
}

function ensureSwitcher(){
  if(document.querySelector('.hq-theme-trigger'))return;
  const top=document.querySelector('.top-actions');if(!top)return;
  const trigger=document.createElement('button');trigger.type='button';trigger.className='hq-theme-trigger';trigger.setAttribute('aria-label','تغيير التصميم');trigger.title='تغيير التصميم';trigger.textContent='◐';
  top.prepend(trigger);
  const pop=document.createElement('div');pop.className='hq-theme-popover';pop.hidden=true;pop.innerHTML=`<div class="hq-theme-title"><div><strong>تصميم NAWAF HQ</strong><small>غيّره متى ما بغيت</small></div><button class="icon-btn" type="button" data-theme-close>×</button></div><div class="hq-theme-list">${themes.map(t=>`<button type="button" class="hq-theme-option ${t.id===current?'active':''}" data-hq-theme-option="${t.id}"><div class="hq-theme-preview ${t.id}"></div><strong>${t.name}</strong><span>${t.desc}</span></button>`).join('')}</div>`;
  document.body.append(pop);
  trigger.onclick=()=>{pop.hidden=!pop.hidden};
  pop.querySelector('[data-theme-close]').onclick=()=>pop.hidden=true;
  pop.querySelectorAll('[data-hq-theme-option]').forEach(btn=>btn.onclick=()=>{applyTheme(btn.dataset.hqThemeOption);pop.hidden=true});
  document.addEventListener('click',e=>{if(pop.hidden)return;if(!pop.contains(e.target)&&e.target!==trigger)pop.hidden=true});
}

function animateView(){const view=document.querySelector('#view');if(!view)return;view.classList.remove('page-enter');requestAnimationFrame(()=>view.classList.add('page-enter'));setTimeout(()=>view.classList.remove('page-enter'),420)}

new MutationObserver(()=>ensureSwitcher()).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',animateView);
document.addEventListener('DOMContentLoaded',()=>{ensureSwitcher();applyTheme(current,{announce:false});animateView()});
window.HQThemes={apply:applyTheme,current:()=>current,list:()=>themes.map(x=>({...x}))};
