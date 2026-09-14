(function(){
'use strict';
const KEY='nawaf-hq-v5';
const POLICY={version:'1.0',rules:[
'كل توجيه من نواف يتحول إلى مهمة واضحة قابلة للتتبع.',
'المهمة قد تكون مرتبطة بمشروع أو مستقلة خارج المشاريع الحالية.',
'يجب تقسيم العمل إلى فهم، تنفيذ، اختبار، ثم تقرير.',
'لا يتم اعتبار أي مهمة مكتملة بدون دليل محفوظ مثل رابط أو ملف أو commit أو نتيجة اختبار.',
'تستخدم الأدوات المتاحة والمصرح بها، وإذا احتاج العمل صلاحية خارجية غير متوفرة يتم تحديدها بوضوح.',
'لا يتم اختلاق نشاط أو تقدم أو نتيجة.',
'لا يتم إنشاء أي التزام مالي بدون موافقة نواف الصريحة.',
'يظل الموظف مركزًا على المطلوب ولا يغيّر نطاقه إلا إذا كان ذلك ضروريًا لإكمال المهمة.'
]};
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function pick(s,text){const q=String(text||'').toLowerCase(),by=id=>(s.employees||[]).find(e=>e.id===id);if(/تقن|برمج|كود|github|موقع|api|نشر|خطأ|bug/.test(q))return by('omar')||by('sara');if(/تصميم|واجهة|تجربة|ui|ux/.test(q))return by('lian')||by('sara');if(/فحص|راجع|جودة|اختبر|تقرير|qa/.test(q))return by('noura')||by('sara');return by('sara')||(s.employees||[])[0]}
function inferProject(s,text){const q=String(text||'');if(/مُعِين|معين|mueen/i.test(q))return (s.projects||[]).find(p=>p.id==='mueen');if(/قدّها|قدها|qaddha/i.test(q))return (s.projects||[]).find(p=>p.id==='qaddha');if(/ناڤ|ناف|nav/i.test(q))return (s.projects||[]).find(p=>p.id==='nav');return null}
function enrichTask(task){task.executionPlan=['فهم المطلوب ومعيار النجاح','تحديد الأدوات والسياق المطلوب','تنفيذ المهمة','اختبار النتيجة وإصلاح الأخطاء','رفع تقرير مع دليل التنفيذ'];task.evidence=task.evidence||[];task.policyVersion=POLICY.version;task.scope=task.projectId?'PROJECT':'INDEPENDENT';return task}
function normalize(){const s=load();s.tasks=Array.isArray(s.tasks)?s.tasks:[];s.tasks.forEach(enrichTask);save(s)}
function create(command,employeeId,projectId){const s=load();s.tasks=Array.isArray(s.tasks)?s.tasks:[];const project=projectId?(s.projects||[]).find(p=>p.id===projectId):inferProject(s,command);const emp=employeeId?(s.employees||[]).find(e=>e.id===employeeId):pick(s,command);const t=enrichTask({id:'t'+Date.now().toString(36),title:String(command).slice(0,90),details:String(command),projectId:project?.id||'',employeeId:emp?.id||'',status:'READY',progress:0,createdAt:new Date().toISOString()});s.tasks.unshift(t);if(emp){emp.task=t.title;emp.status='READY'}s.activity=Array.isArray(s.activity)?s.activity:[];s.activity.unshift({id:'a'+Date.now().toString(36),text:`${emp?.name||'موظف AI'} استلم ${project?`مهمة على ${project.name}`:'مهمة مستقلة'}: ${t.title}`,type:'REAL',at:new Date().toISOString()});save(s);return t}
function addEvidence(taskId,item){const s=load(),t=(s.tasks||[]).find(x=>x.id===taskId);if(!t)return false;t.evidence=Array.isArray(t.evidence)?t.evidence:[];t.evidence.push({text:String(item||''),at:new Date().toISOString()});save(s);return true}
function canComplete(taskId){const s=load(),t=(s.tasks||[]).find(x=>x.id===taskId);return !!(t&&Array.isArray(t.evidence)&&t.evidence.length)}
window.NawafWorkforce={POLICY,create,addEvidence,canComplete,normalize};
normalize();
})();