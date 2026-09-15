(function(){'use strict';
const PATHS={
 dashboard:'M3 3h7v7H3V3zm11 0h7v4h-7V3zM3 14h7v7H3v-7zm11-3h7v10h-7V11z',
 workforce:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87m-2-11.96a4 4 0 0 1 0 7.75',
 projects:'M3 5h7l2 2h9v12H3V5z',
 tasks:'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
 reports:'M5 3h14v18H5V3zm3 4h8M8 11h8M8 15h5',
 userPlus:'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6',
 command:'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zm7 13 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z',
 plus:'M12 5v14M5 12h14',
 external:'M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
 github:'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.33 1.08 2.9.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.9-1.3 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.76c0 .26.18.57.69.47A10 10 0 0 0 12 2z',
 edit:'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
 bolt:'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
 filter:'M4 5h16M7 12h10M10 19h4',
 sync:'M20 7h-6V1M4 17h6v6M5.1 9A8 8 0 0 1 18.5 5.5L20 7M4 17l1.5 1.5A8 8 0 0 0 18.9 15',
 close:'M6 6l12 12M18 6 6 18',
 play:'M8 5v14l11-7L8 5z',
 apps:'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z',
 settings:'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.17.37.5.74 1 .94.35.14.72.2 1.1.2h.1v4h-.1c-.38 0-.75.06-1.1.2-.5.2-.83.57-1 .94z'
};
function svg(name,cls='hq-icon'){const d=PATHS[name]||PATHS.command;return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`}
function prepend(el,name){if(!el||el.querySelector(':scope > .hq-icon'))return;el.insertAdjacentHTML('afterbegin',svg(name))}
function replaceLeadingSymbols(el){if(!el)return;for(const node of [...el.childNodes]){if(node.nodeType===3){node.nodeValue=node.nodeValue.replace(/^\s*[＋✦⚡◫▶▣×]+\s*/,'');break}}}
function enhance(){
 document.querySelectorAll('[data-view]').forEach(b=>prepend(b,b.dataset.view));
 document.querySelectorAll('[data-action="new-employee"]').forEach(b=>{replaceLeadingSymbols(b);prepend(b,'userPlus')});
 document.querySelectorAll('[data-action="new-task"]').forEach(b=>{replaceLeadingSymbols(b);prepend(b,'plus')});
 document.querySelectorAll('[data-action="company-command"]').forEach(b=>{replaceLeadingSymbols(b);prepend(b,'command')});
 document.querySelectorAll('.v8-project-actions a').forEach(a=>prepend(a,(a.textContent||'').includes('GitHub')?'github':'external'));
 document.querySelectorAll('.v8-project-actions button[data-project]').forEach(b=>prepend(b,'settings'));
 document.querySelectorAll('.v9-edit-employee').forEach(b=>prepend(b,'edit'));
 document.querySelectorAll('[data-v9-quick]').forEach(b=>{replaceLeadingSymbols(b);prepend(b,'bolt')});
 document.querySelectorAll('[data-v9-tasks]').forEach(b=>{replaceLeadingSymbols(b);prepend(b,'tasks')});
 document.querySelectorAll('.v9-task-filters button').forEach(b=>prepend(b,'filter'));
 document.querySelectorAll('[data-close],[data-v9-close],.v8-close').forEach(b=>{b.textContent='';b.innerHTML=svg('close');b.setAttribute('aria-label','إغلاق')});
 document.querySelectorAll('.v8-modal-actions button[type="submit"],.v9-actions button[type="submit"]').forEach(b=>{replaceLeadingSymbols(b);prepend(b,'play')});
 document.querySelectorAll('.apps-back').forEach(a=>prepend(a,'dashboard'));
 document.querySelectorAll('#command-form button[type="submit"]').forEach(b=>prepend(b,'play'));
 document.querySelectorAll('.connected-grid a').forEach(a=>prepend(a,(a.textContent||'').toLowerCase().includes('github')?'github':'external'));
 document.querySelectorAll('.mobile-apps-link').forEach(a=>{replaceLeadingSymbols(a);prepend(a,'apps')});
}
let timer;const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,50)});
function start(){obs.observe(document.body,{subtree:true,childList:true});enhance()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.HQIcons={svg,enhance};
})();