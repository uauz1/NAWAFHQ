(function(){'use strict';
const KEY='nawaf-hq-v5';
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
function write(s,reason='company-copilot'){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('nawaf:state-updated',{detail:{reason}}));window.dispatchEvent(new CustomEvent('nawaf:activity-updated'))}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function statusLabel(v){return({READY:'جاهز',IDLE:'جاهز',WORKING:'ينفذ الآن',RESEARCHING:'يبحث الآن',REVIEWING:'يراجع الآن',WAITING_FOR_CONNECTION:'ينتظر ربط أداة',WAITING_FOR_NAWAF:'ينتظر قرارك',BLOCKED_BY_TOOL:'المهمة تحتاج أداة',BLOCKED:'تعذر التنفيذ',PAUSED:'المهمة متوقفة',COMPLETED:'اكتمل'})[v]||v||'جاهز'}
function busy(v){return ['WORKING','RESEARCHING','REVIEWING'].includes(v)}
async function push(){try{if(window.HQCloudReady)await window.HQCloudReady;if(window.HQCloud?.push)await window.HQCloud.push()}catch{}}
function ensureCopilot(){
 const main=document.querySelector('.v8-main'); if(!main)return null;
 let box=document.getElementById('hq-company-copilot');
 if(!box){
   box=document.createElement('section'); box.id='hq-company-copilot'; box.className='hq-copilot';
   const stats=main.querySelector('.v8-stats'); if(stats)main.insertBefore(box,stats); else main.prepend(box);
   box.innerHTML=`<div class="hq-copilot-head"><div><span class="hq-copilot-kicker">LIVE COMPANY COPILOT</span><b>تكلم مع شركتك</b><small id="hq-copilot-sub">أمر واحد → موظف مناسب → تنفيذ حقيقي → نتيجة موثقة</small></div><div class="hq-copilot-live"><i></i><span>متصل بمحرك التنفيذ</span></div></div><div class="hq-copilot-command"><button type="button" id="hq-copilot-mic" class="hq-copilot-mic" aria-label="تحدث">🎙</button><textarea id="hq-copilot-input" rows="2" placeholder="مثال: فهد راجع مُعين وحل أي خطأ مثبت، أو راكان حلل أرامكو"></textarea><button type="button" id="hq-copilot-send" class="hq-copilot-send">نفّذ</button></div><div class="hq-copilot-result"><div id="hq-copilot-state" class="hq-copilot-state">جاهز لاستقبال أمر جديد</div><div id="hq-copilot-task" class="hq-copilot-task"></div></div>`;
   box.querySelector('#hq-copilot-send').onclick=submit;
   box.querySelector('#hq-copilot-input').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();submit()}});
   box.querySelector('#hq-copilot-mic').onclick=listen;
 }
 return box;
}
function choose(state,text){
 if(window.NawafSmartCommand?.chooseEmployee)return window.NawafSmartCommand.chooseEmployee(state,text,'');
 const q=String(text||'').toLowerCase();
 const names=[['finance',['راكان','rakan']],['fahad',['فهد','fahad']],['noura',['نورة','نورا','noura']],['omar',['عمر','omar']],['lian',['ليان','lian']],['sara',['سارة','سارا','sara']]];
 for(const [id,a] of names)if(a.some(n=>q.includes(n)))return (state.employees||[]).find(e=>e.id===id);
 if(/سهم|مالي|استثمار|أرامكو|ارامكو|محفظة|شراء|بيع/.test(q))return (state.employees||[]).find(e=>e.id==='finance');
 if(/اصلح|أصلح|كود|تقني|موقع|تطبيق|github|api|bug|خطأ/.test(q))return (state.employees||[]).find(e=>e.id==='fahad')||(state.employees||[]).find(e=>e.id==='omar');
 if(/مراجعة|اختبار|جودة|qa|تأكد|تاكد/.test(q))return (state.employees||[]).find(e=>e.id==='noura');
 if(/تصميم|واجهة|ux|ui|تجربة/.test(q))return (state.employees||[]).find(e=>e.id==='lian');
 return (state.employees||[]).find(e=>e.id==='sara')||(state.employees||[])[0];
}
function project(text){if(window.NawafSmartCommand?.detectProject)return window.NawafSmartCommand.detectProject(text,'');const q=String(text||'').toLowerCase();if(/معين|مُعِين|mueen/.test(q))return'mueen';if(/قدها|قدّها|qaddha/.test(q))return'qaddha';return''}
async function submit(){
 const input=document.getElementById('hq-copilot-input'); if(!input)return;
 const command=String(input.value||'').trim(); if(!command)return;
 const state=read(); state.employees=Array.isArray(state.employees)?state.employees:[]; state.tasks=Array.isArray(state.tasks)?state.tasks:[]; state.activity=Array.isArray(state.activity)?state.activity:[];
 const emp=choose(state,command); if(!emp){show('ما فيه موظف متاح لهذا الأمر.','');return}
 const projectId=project(command),ts=new Date().toISOString(),isFinance=emp.id==='finance';
 const task={id:uid('voice'),title:command,details:command,projectId,employeeId:emp.id,status:'READY',progress:0,createdAt:ts,updatedAt:ts,kind:isFinance?'RESEARCH':'CEO_COMMAND',domain:isFinance?'FINANCE':projectId?'PROJECT':'GENERAL',routing:{employee:emp.id,project:projectId||null,route:isFinance?'FINANCE':projectId?'PROJECT_EXECUTION':'GENERAL_AI',decidedAt:ts,source:'COMPANY_COPILOT'}};
 state.tasks.unshift(task); emp.status='READY'; emp.task=command; emp.updatedAt=ts;
 state.activity.unshift({id:uid('a'),text:`نواف وجّه ${emp.name}: ${command}`,type:'REAL',at:ts,updatedAt:ts}); state.activity=state.activity.slice(0,150);
 write(state,'copilot-command'); await push(); input.value=''; show(`تم توجيه الأمر إلى ${emp.name} — يبدأ التنفيذ الآن`,task.id);
 if(window.NawafAgents?.runTask)setTimeout(()=>window.NawafAgents.runTask(task.id),180); else document.querySelector('[data-view="tasks"]')?.click();
 decorate();
}
function show(text,taskId){const s=document.getElementById('hq-copilot-state'),t=document.getElementById('hq-copilot-task');if(s)s.textContent=text;if(t)t.dataset.taskId=taskId||''}
function latestTask(state){return (state.tasks||[]).slice().sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0))[0]}
function refresh(){
 const box=ensureCopilot(); if(!box)return;
 const state=read(),taskId=box.querySelector('#hq-copilot-task')?.dataset.taskId||'',task=(state.tasks||[]).find(t=>t.id===taskId)||latestTask(state);
 const line=box.querySelector('#hq-copilot-state'),detail=box.querySelector('#hq-copilot-task');
 if(task&&line&&detail){const emp=(state.employees||[]).find(e=>e.id===task.employeeId);line.textContent=`${emp?.name||'الموظف'} • ${statusLabel(task.status)}`;detail.innerHTML=`<b>${esc(task.title)}</b>${task.aiResult?.summary?`<small>${esc(task.aiResult.summary)}</small>`:task.blockedReason?`<small>${esc(task.blockedReason)}</small>`:''}`;detail.dataset.taskId=task.id}
 decorate();
}
function decorate(){
 const state=read();
 document.querySelectorAll('.v8-person[data-employee]').forEach(card=>{const e=(state.employees||[]).find(x=>x.id===card.dataset.employee);const st=e?.status||'READY';card.dataset.aiState=st;card.classList.toggle('is-busy',busy(st));const av=card.querySelector('.v8-avatar');if(av)av.setAttribute('title',statusLabel(st));});
}
let recognition=null,listening=false;
function listen(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition,btn=document.getElementById('hq-copilot-mic'),input=document.getElementById('hq-copilot-input');
 if(!SR){show('الميكروفون الصوتي غير مدعوم في هذا المتصفح — استخدم الكتابة.','');return}
 if(listening&&recognition){recognition.stop();return}
 recognition=new SR(); recognition.lang='ar-SA'; recognition.interimResults=true; recognition.continuous=false;
 recognition.onstart=()=>{listening=true;if(btn)btn.classList.add('listening');show('أسمعك… قل الأمر بشكل طبيعي.','')};
 recognition.onresult=e=>{let text='';for(let i=e.resultIndex;i<e.results.length;i++)text+=e.results[i][0].transcript;if(input)input.value=text.trim()};
 recognition.onerror=()=>show('تعذر التقاط الصوت، جرّب مرة ثانية أو اكتب الأمر.','');
 recognition.onend=()=>{listening=false;if(btn)btn.classList.remove('listening');if(input?.value.trim())show('وصلني الأمر — راجعه واضغط نفّذ.','')};
 recognition.start();
}
window.addEventListener('nawaf:state-updated',()=>setTimeout(refresh,60));window.addEventListener('storage',e=>{if(e.key===KEY)refresh()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{ensureCopilot();refresh()},2500);
setTimeout(refresh,350);
window.NawafCompanyCopilot={submit,listen,refresh};
})();
