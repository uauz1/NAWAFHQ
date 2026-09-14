(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const staff=[
 {id:'sara',name:'سارة',role:'المدير العام AI',dept:'الإدارة العامة'},
 {id:'omar',name:'عمر',role:'التقنية والبحث',dept:'التقنية والبحث'},
 {id:'lian',name:'ليان',role:'المنتج والتجربة',dept:'المنتج والتجربة'},
 {id:'noura',name:'نورة',role:'الجودة والمراجعة',dept:'الجودة والمراجعة'}
];
const rooms=['الإدارة العامة','التقنية والبحث','المنتج والتجربة','الجودة والمراجعة','التحليلات','الأنظمة والبنية','البحث','العمليات'];
const statusAr={READY:'جاهز',IDLE:'متاح',WORKING:'يعمل',RESEARCHING:'يبحث',COLLABORATING:'يتعاون',REVIEWING:'يراجع',WAITING_FOR_NAWAF:'بانتظار نواف'};
function getState(){try{return JSON.parse(localStorage.getItem('nawaf-hq-v3')||'null')||{}}catch{return {}}}
function livePerson(id){const base=staff.find(x=>x.id===id);const e=(getState().employees||[]).find(x=>x.id===id)||{};return {...base,status:e.status||'READY',task:e.currentTask||e.task||''}}
function openPerson(id){if(typeof window.NawafHQ?.employeeView==='function')return window.NawafHQ.employeeView(id);const row=document.querySelector(`.employee[data-id="${id}"]`);row?.click()}
function openBoard(){if(window.NawafCompanyBoard?.open)return window.NawafCompanyBoard.open('company');const b=$$('button').find(x=>x.textContent.includes('مجلس الشركة'));b?.click()}
function boot(){
 const host=$('.office');if(!host){setTimeout(boot,180);return}if(host.dataset.interactiveLayer==='1')return;host.dataset.interactiveLayer='1';
 const layer=document.createElement('div');layer.className='hq-live-layer';
 layer.innerHTML=`
 <div class="hq-live-top">
  <div><b>NAWAF HQ • LIVE</b><small>اضغط على أي قسم أو موظف</small></div>
  <div class="hq-live-top-actions"><button type="button" data-live="board">مجلس الشركة</button><button type="button" data-live="reset">نظرة عامة</button></div>
 </div>
 <div class="hq-room-nav" aria-label="أقسام الشركة"></div>
 <aside class="hq-live-panel" aria-live="polite">
  <button type="button" class="hq-live-close" aria-label="إغلاق">×</button>
  <span>INTERACTIVE HQ</span><h3>المقر التفاعلي</h3><p>كل قسم وكل موظف قابل للتفاعل. اختر من الأقسام أو الموظفين لعرض التفاصيل.</p>
  <div class="hq-live-actions"></div>
 </aside>
 <div class="hq-staff-strip" aria-label="موظفو الذكاء الاصطناعي"></div>
 <div class="hq-live-toast" aria-live="polite"></div>`;
 host.appendChild(layer);
 const nav=$('.hq-room-nav',layer),strip=$('.hq-staff-strip',layer),panel=$('.hq-live-panel',layer),actions=$('.hq-live-actions',layer),toast=$('.hq-live-toast',layer);
 rooms.forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.className='hq-room-dot';b.innerHTML=`<i>${i+1}</i><span>${name}</span>`;b.onclick=()=>showRoom(i,name);nav.appendChild(b)});
 staff.forEach(s=>{const p=livePerson(s.id),b=document.createElement('button');b.type='button';b.className='hq-staff-pill';b.dataset.id=s.id;b.innerHTML=`<i></i><span><b>${p.name}</b><small>${statusAr[p.status]||p.status}</small></span>`;b.onclick=()=>showPerson(s.id);strip.appendChild(b)});
 function say(t){toast.textContent=t;toast.classList.add('show');clearTimeout(say.t);say.t=setTimeout(()=>toast.classList.remove('show'),1700)}
 function selectNav(i){$$('.hq-room-dot',layer).forEach((x,n)=>x.classList.toggle('active',n===i))}
 function openPanel(){panel.classList.add('open')}
 function closePanel(){panel.classList.remove('open');$$('.hq-room-dot',layer).forEach(x=>x.classList.remove('active'))}
 function showRoom(i,name){selectNav(i);openPanel();$('h3',panel).textContent=name;$('p',panel).textContent=`قسم ${name} داخل NAWAF HQ. يمكنك فتح مجلس الشركة أو اختيار أحد الموظفين المرتبطين بالقسم.`;actions.innerHTML='<button type="button" data-p="board">فتح مجلس الشركة</button><button type="button" data-p="close">العودة للمقر</button>';actions.querySelector('[data-p="board"]').onclick=openBoard;actions.querySelector('[data-p="close"]').onclick=closePanel;say(`تم تحديد ${name}`);host.dispatchEvent(new CustomEvent('hq:focus-room',{detail:{index:i,name}}))}
 function showPerson(id){const p=livePerson(id);openPanel();$('h3',panel).textContent=p.name;$('p',panel).textContent=`${p.role} • ${p.dept} • ${statusAr[p.status]||p.status}${p.task?` • ${p.task}`:''}`;actions.innerHTML='<button type="button" data-p="person">فتح مساحة الموظف</button><button type="button" data-p="close">العودة للمقر</button>';actions.querySelector('[data-p="person"]').onclick=()=>openPerson(id);actions.querySelector('[data-p="close"]').onclick=closePanel;say(`تم اختيار ${p.name}`);host.dispatchEvent(new CustomEvent('hq:focus-person',{detail:{id}}))}
 $('.hq-live-close',layer).onclick=closePanel;$('[data-live="board"]',layer).onclick=openBoard;$('[data-live="reset"]',layer).onclick=()=>{closePanel();host.dispatchEvent(new CustomEvent('hq:overview'));say('النظرة العامة')};
 host.addEventListener('dblclick',()=>{closePanel();host.dispatchEvent(new CustomEvent('hq:overview'))});
 setInterval(()=>{$$('.hq-staff-pill',layer).forEach(b=>{const p=livePerson(b.dataset.id);const s=$('small',b);if(s)s.textContent=statusAr[p.status]||p.status;b.className=`hq-staff-pill state-${String(p.status).toLowerCase()}`})},2500);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500)):setTimeout(boot,500);
})();