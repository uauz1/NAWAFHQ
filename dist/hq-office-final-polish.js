(function(){
  'use strict';
  function ready(){
    const office=document.querySelector('.office');
    if(!office){setTimeout(ready,200);return;}
    if(office.dataset.finalPolish==='1')return;
    office.dataset.finalPolish='1';
    office.style.borderRadius='18px';
    office.style.boxShadow='inset 0 0 0 1px rgba(214,170,79,.18),0 24px 80px rgba(0,0,0,.35)';
    office.style.minHeight='560px';

    const style=document.createElement('style');
    style.textContent=`
      .office[data-final-polish="1"] canvas{display:block;width:100%!important;height:100%!important;min-height:560px;cursor:grab;filter:saturate(1.08) contrast(1.03)}
      .office[data-final-polish="1"] canvas:active{cursor:grabbing}
      .office-hq-vignette{position:absolute;inset:0;pointer-events:none;z-index:4;background:radial-gradient(circle at 50% 42%,transparent 42%,rgba(3,7,13,.18) 72%,rgba(3,7,13,.48) 100%);box-shadow:inset 0 0 80px rgba(0,0,0,.28)}
      .office-hq-caption{position:absolute;left:16px;bottom:16px;z-index:6;pointer-events:none;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(95,132,255,.28);border-radius:11px;background:rgba(7,16,27,.76);backdrop-filter:blur(10px);color:#cbd8ff;font:600 10px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.05em}
      .office-hq-caption i{width:7px;height:7px;border-radius:50%;background:#71e49b;box-shadow:0 0 12px #71e49b;display:block}
      @media(max-width:900px){.office[data-final-polish="1"]{min-height:430px!important}.office[data-final-polish="1"] canvas{min-height:430px}.office-hq-caption{display:none}}
    `;
    document.head.appendChild(style);

    const vignette=document.createElement('div');
    vignette.className='office-hq-vignette';
    office.appendChild(vignette);

    const caption=document.createElement('div');
    caption.className='office-hq-caption';
    caption.innerHTML='<i></i><span>LIVE AI WORKFORCE • 8 DEPARTMENTS • COMMAND CORE</span>';
    office.appendChild(caption);

    const waitForCanvas=()=>{
      const canvas=office.querySelector('canvas');
      if(!canvas){setTimeout(waitForCanvas,120);return;}
      canvas.setAttribute('aria-label','المقر ثلاثي الأبعاد لشركة NAWAF HQ');
      canvas.setAttribute('role','img');
    };
    waitForCanvas();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
