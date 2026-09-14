(function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const stateOf=()=>window.state||null;
  function clickText(text){const el=$$('button').find(b=>b.textContent.includes(text)); if(el){el.click();return true} return false;}
  function addCommandDock(){if($('#hq-command-dock'))return;const main=$('.main');if(!main)return;const dock=document.createElement('section');dock.id='hq-command-dock';dock.className='hq-command-dock card';dock.innerHTML='<div class="dock-copy"><span class="eyebrow">CEO COMMAND CENTER</span><b>وش تبغى الشركة تسوي الآن؟</b><small>أي نشاط يبدأ من توجيهك، وما يظهر إنجاز بدون دليل.</small></div><div class="dock-actions"><button id="hq-start-command" class="primary">✦ أعطِ توجيهًا للشركة</button><button id="hq-open-board">◎ افتح مجلس الشركة</button></div>';
    const greet=$('.greeting');greet?.insertAdjacentElement('afterend',dock);
    $('#hq-start-command').onclick=()=>{ if(typeof window.NawafHQ?.commandView==='function') window.NawafHQ.commandView(); else clickText('بسم الله')||clickText('توجيه الشركة')||$('#manager-core')?.click(); };
    $('#hq-open-board').onclick=()=>clickText('مجلس الشركة')||$('#manager-core')?.click();
  }
  function enrichOffice(){const office=$('.office');if(!office)return;office.classList.add('hq-office-v2');if(!$('.office-rail',office)){const rail=document.createElement('div');rail.className='office-rail';rail.innerHTML='<span><i class="pulse"></i> HQ LIVE</span><b>مركز عمليات الشركة</b><small>الموظفون والأقسام يعكسون حالة العمل المسجلة</small>';office.appendChild(rail)}
    $$('.robot',office).forEach((r,i)=>{r.style.setProperty('--delay',`${-i*.7}s`);r.title='فتح ملف الموظف وحالة عمله';});
    $$('.room',office).forEach(r=>r.title='فتح مساحة القسم');
  }
  function fixBrand(){const b=$('.brand');if(b)b.innerHTML='NAWAF <span>HQ</span><small>AI COMPANY OS</small>';document.title='NAWAF HQ — لوحة القيادة';}
  function addTruthStatus(){if($('#truth-status'))return;const top=$('.topbar');if(!top)return;const x=document.createElement('div');x.id='truth-status';x.className='truth-status';x.innerHTML='<i></i><span>وضع العمل الموثّق</span><small>لا نشاط وهمي</small>';top.appendChild(x)}
  function addQuickProjectLabels(){ $$('.project').forEach(p=>{const name=$('b',p)?.textContent?.trim();if(!name)return;if(!$('.project-kind',p)){const tag=document.createElement('small');tag.className='project-kind';tag.textContent=name==='قدّها'?'مشروع الألعاب':name==='مُعِين'?'التطبيق الإسلامي':'مشروع';p.querySelector('span')?.appendChild(tag)}}); }
  function boot(){fixBrand();addCommandDock();enrichOffice();addTruthStatus();addQuickProjectLabels();}
  const mo=new MutationObserver(()=>{clearTimeout(window.__hqEnhance);window.__hqEnhance=setTimeout(boot,40)});mo.observe(document.documentElement,{childList:true,subtree:true});document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();