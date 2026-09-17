import { parseCommand } from '../core/router.mjs';
import { assertTransition } from '../core/state-machine.mjs';
import { classifyError } from '../core/adapters.mjs';
import { db } from './db.mjs';
import { registry } from './tool-adapters.mjs';
import { executeProjectStatus } from './project-status.mjs';

const capabilityFor = route => ({GENERAL:'general',PROJECT_STATUS:'repository_status',PROJECT_EXECUTION:'project_execution',RESEARCH:'research',QA:'qa',DESIGN:'research',BUSINESS:'business',FINANCE_ANALYSIS:'finance_analysis',TRADING_PAPER:'paper_trade'}[route]);
const employeeStatusFor = route => route==='RESEARCH'?'RESEARCHING':['QA','PROJECT_STATUS'].includes(route)?'REVIEWING':'WORKING';
const normalizeText=value=>String(value||'').toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();

async function event(taskId,stage,message,metadata={}) { await db.insert('hq_v2_task_events',{task_id:taskId,stage,message,metadata},false); }
async function setTask(task,to,extra={}) { assertTransition(task.status,to); const rows=await db.update('hq_v2_tasks',`id=eq.${task.id}`,{status:to,updated_at:new Date().toISOString(),...extra}); Object.assign(task,rows[0]); await event(task.id,to,extra.message||to); }
async function releaseEmployee(task,status='READY') { if(task.employee_id)await db.update('hq_v2_employees',`id=eq.${task.employee_id}`,{status,current_task_id:null,last_active_at:new Date().toISOString(),updated_at:new Date().toISOString()},false); }

async function resolveEmployee(command,fallback){
  const text=normalizeText(command);const employees=await db.list('hq_v2_employees','order=created_at.asc');
  const explicit=employees.find(e=>[e.name_ar,e.name_en].filter(Boolean).some(name=>text.includes(normalizeText(name))));
  return explicit?.id||fallback;
}

async function employeeContext(task){
  const [employee,messages]=await Promise.all([
    task.employee_id?db.one('hq_v2_employees',`id=eq.${encodeURIComponent(task.employee_id)}`):null,
    db.list('hq_v2_task_messages',`task_id=eq.${task.id}&order=created_at.asc&limit=40`)
  ]);
  return {employee,messages};
}

async function geminiText(prompt,maxOutputTokens=1200){
  if(!process.env.GEMINI_API_KEY)throw new Error('MISSING_CONNECTION:GEMINI_API_KEY');
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.35,maxOutputTokens}}),signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(!r.ok){const error=new Error(`GEMINI_${r.status}:${d?.error?.message||'error'}`);error.status=r.status;throw error;}
  const text=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!text)throw new Error('VALIDATION:EMPTY_EMPLOYEE_RESPONSE');
  return {text,model};
}

async function executeSmartEmployee({task}){
  const {employee,messages}=await employeeContext(task);
  const discussion=messages.map(m=>`${m.author_type==='owner'?'نواف':employee?.name_ar||'الموظف'}: ${m.content}`).join('\n')||'لا يوجد نقاش سابق.';
  const profile=`الاسم: ${employee?.name_ar||task.employee_id||'موظف'}\nالمنصب: ${employee?.role||'موظف عام'}\nالقسم: ${employee?.department||'عام'}\nالخبرات: ${(employee?.expertise||[]).join('، ')||'غير محددة'}\nالصلاحيات: ${(employee?.permissions||[]).join('، ')||'حسب المهمة'}\nتعليمات خاصة من نواف: ${employee?.custom_instructions||'لا توجد'}`;
  const prompt=`أنت موظف حقيقي داخل NAWAF HQ وترد بصفتك المهنية المحددة أدناه.\n\nملفك:\n${profile}\n\nالمهمة الحالية:\n${task.command}\nالمسار: ${task.route}\nالمشروع: ${task.project_id||'الشركة'}\n\nالنقاش السابق على نفس المهمة:\n${discussion}\n\nقواعد:\n- تعامل مع كلام نواف كمديرك المباشر.\n- لا تعط ردًا عامًا؛ استخدم منصبك وخبرتك وتعليماته الخاصة.\n- إذا المطلوب فكرة أو نقاش، اقترح شيئًا محددًا قابلًا للتطوير واذكر منطقك باختصار.\n- إذا المطلوب تنفيذ خارجي لا تملكه، لا تدّعِ التنفيذ.\n- لا تختلق أرقامًا أو أدلة أو مصادر.\n- اكتب بالعربية السعودية الواضحة والمهنية.\nأعط النتيجة مباشرة.`;
  const reply=await geminiText(prompt,1400);
  return {summary:reply.text,validated:true,evidence:[{kind:'AI_PROVIDER_RESPONSE',label:`${employee?.name_ar||'Employee'} · ${employee?.role||'role'} · Gemini ${reply.model}`,data:{provider:'Google Gemini',model:reply.model,employeeId:employee?.id||task.employee_id,employeeName:employee?.name_ar||null,role:employee?.role||null,discussionMessages:messages.length,completedAt:new Date().toISOString()}}]};
}

export async function discussTask(taskId,content){
  const task=await db.one('hq_v2_tasks',`id=eq.${taskId}`);if(!task)throw new Error('TASK_NOT_FOUND');
  const clean=String(content||'').trim();if(!clean)throw new Error('MESSAGE_REQUIRED');
  await db.insert('hq_v2_task_messages',{task_id:task.id,author_type:'owner',content:clean,message_type:'discussion'},false);
  const {employee,messages}=await employeeContext(task);
  const history=messages.map(m=>`${m.author_type==='owner'?'نواف':employee?.name_ar||'الموظف'}: ${m.content}`).join('\n');
  const prompt=`أنت ${employee?.name_ar||'موظف'} في NAWAF HQ. منصبك: ${employee?.role||'موظف عام'}. قسمك: ${employee?.department||'عام'}. تعليمات نواف الخاصة لك: ${employee?.custom_instructions||'لا توجد'}.\nالمهمة الأصلية: ${task.command}\nالنتيجة السابقة إن وجدت: ${task.result?.summary||'لا توجد نتيجة نهائية بعد'}\n\nالنقاش حتى الآن:\n${history}\n\nرد على آخر رسالة من نواف كنقاش عمل حقيقي. ناقشه، اسأله أو اقترح تعديلًا عند الحاجة، ولا تدّع تنفيذ شيء لم تنفذه. كن مختصرًا ومفيدًا.`;
  const reply=await geminiText(prompt,900);
  const [message]=await db.insert('hq_v2_task_messages',{task_id:task.id,author_type:'employee',employee_id:task.employee_id,content:reply.text,message_type:'discussion'});
  return {message,employee,model:reply.model};
}

export async function createTask(command,idempotencyKey) {
  const route=parseCommand(command), title=String(command).trim().slice(0,140);
  const existing=idempotencyKey?await db.one('hq_v2_tasks',`idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`):null;
  if(existing)return existing;
  const employeeId=await resolveEmployee(command,route.employeeId);
  const [task]=await db.insert('hq_v2_tasks',{command,title,route:route.route,status:'QUEUED',employee_id:employeeId,project_id:route.projectId,idempotency_key:idempotencyKey||null});
  await event(task.id,'RECEIVED','تم استلام الأمر',{route:{...route,employeeId}}); return task;
}

export async function executeTask(taskId) {
  const task=await db.one('hq_v2_tasks',`id=eq.${taskId}`); if(!task)throw new Error('TASK_NOT_FOUND');
  if(task.status!=='QUEUED')return task;
  try {
    await setTask(task,'ROUTING',{started_at:task.started_at||new Date().toISOString(),next_retry_at:null});
    const parsed=parseCommand(task.command); const capability=capabilityFor(parsed.route);
    if(parsed.requiresApproval){const approved=await db.one('hq_v2_approvals',`task_id=eq.${task.id}&status=eq.APPROVED`);if(approved){await setTask(task,'BLOCKED',{error_class:'UNSUPPORTED_HIGH_IMPACT_ACTION',error_message:'تمت الموافقة، لكن لا يوجد محول آمن متصل لهذا الإجراء. لم يُنفذ أي تغيير.'});await db.insert('hq_v2_secretary_briefs',{task_id:task.id,title:`لم يُنفذ: ${task.title}`,body:'الموافقة مسجلة، لكن لا يوجد محول آمن متصل. لم يحدث أي تغيير خارجي.',severity:'WARNING'},false);await releaseEmployee(task);return task;}await setTask(task,'WAITING_FOR_APPROVAL');await db.insert('hq_v2_approvals',{task_id:task.id,employee_id:task.employee_id,action:task.command,reason:'إجراء عالي التأثير',impact:'قد يغيّر بيانات أو ينفذ إجراءً حقيقيًا',tool_id:null});await releaseEmployee(task);return task;}
    const smartRoutes=['GENERAL','RESEARCH','DESIGN'];
    const adapter=parsed.route==='PROJECT_STATUS'?{id:'project_status',execute:executeProjectStatus}:smartRoutes.includes(parsed.route)?{id:'smart_employee',execute:executeSmartEmployee}:registry.resolve(capability);
    if(!adapter){await setTask(task,'WAITING_FOR_CONNECTION',{adapter_id:null});const existing=await db.one('hq_v2_connection_requests',`task_id=eq.${task.id}&provider=eq.${encodeURIComponent(capability)}&status=in.(PENDING,APPROVED)`);if(!existing)await db.insert('hq_v2_connection_requests',{task_id:task.id,employee_id:task.employee_id,provider:capability,reason:`يلزم اتصال يدعم ${capability}`,permissions:[capability],costs_money:false});await releaseEmployee(task);return task;}
    await setTask(task,'PLANNING',{adapter_id:adapter.id,plan:[{stage:'collect_facts'},{stage:'execute'},{stage:'validate'}]});
    const workStatus=parsed.route==='RESEARCH'?'RESEARCHING':['QA','PROJECT_STATUS'].includes(parsed.route)?'REVIEWING':'WORKING'; await setTask(task,workStatus);
    await db.update('hq_v2_employees',`id=eq.${task.employee_id}`,{status:employeeStatusFor(parsed.route),current_task_id:task.id,last_active_at:new Date().toISOString()},false);
    const result=await adapter.execute({task,db});
    if(!result?.evidence?.length)throw new Error('VALIDATION:NO_EVIDENCE');
    if(task.status!=='REVIEWING')await setTask(task,'REVIEWING');
    for(const item of result.evidence)await db.insert('hq_v2_task_evidence',{task_id:task.id,kind:item.kind,label:item.label,uri:item.uri||null,data:item.data||{}},false);
    if(result.validated===false){await setTask(task,'BLOCKED',{result,error_class:'VALIDATION_FAILURE',error_message:result.summary,completed_at:new Date().toISOString()});await db.insert('hq_v2_secretary_briefs',{task_id:task.id,title:`لم يثبت الاكتمال: ${task.title}`,body:result.summary,severity:'WARNING'},false);await releaseEmployee(task);return task;}
    await setTask(task,'COMPLETED',{result,completed_at:new Date().toISOString(),error_class:null,error_message:null,retry_count:task.retry_count||0,next_retry_at:null});
    await db.insert('hq_v2_reports',{type:parsed.route,title:task.title,summary:result.summary,author_employee_id:task.employee_id,source_task_id:task.id,project_id:task.project_id,evidence:result.evidence},false);
    await db.insert('hq_v2_secretary_briefs',{task_id:task.id,title:`اكتملت: ${task.title}`,body:result.summary,severity:'SUCCESS'},false);
    await db.insert('hq_v2_activity',{task_id:task.id,employee_id:task.employee_id,project_id:task.project_id,kind:'TASK_COMPLETED',message:result.summary},false);
    await releaseEmployee(task); return task;
  } catch(error) {
    const info=classifyError(error); const retryCount=Number(task.retry_count||0)+1;
    if(info.kind==='CONNECTION_REQUIRED'){for(const item of (error.evidence||[]))await db.insert('hq_v2_task_evidence',{task_id:task.id,kind:item.kind,label:item.label,uri:item.uri||null,data:item.data||{}},false);await setTask(task,'WAITING_FOR_CONNECTION',{error_class:info.kind,error_message:info.message});const provider=error.requiredProvider||'unknown';const existing=await db.one('hq_v2_connection_requests',`task_id=eq.${task.id}&provider=eq.${encodeURIComponent(provider)}&status=in.(PENDING,APPROVED)`);if(!existing)await db.insert('hq_v2_connection_requests',{task_id:task.id,employee_id:task.employee_id,provider,reason:'يلزم ربط الأداة أو الصلاحية المطلوبة لإكمال التنفيذ الحقيقي.',permissions:['execute'],costs_money:false});await releaseEmployee(task);return task;}
    if(info.retryable&&retryCount<=Number(task.max_retries||3)){
      const delay=Math.min(300000,5000*2**retryCount);
      await setTask(task,'PAUSED_EXTERNAL',{error_class:info.kind,error_message:info.message,retry_count:retryCount,next_retry_at:new Date(Date.now()+delay).toISOString()});
      await event(task.id,'RETRY_SCHEDULED',`إعادة المحاولة تلقائيًا بعد ${Math.round(delay/1000)} ثانية`,{retryCount,delayMs:delay,errorClass:info.kind});
    }
    else if(!['WAITING_FOR_CONNECTION','WAITING_FOR_APPROVAL','COMPLETED'].includes(task.status)){await setTask(task,'FAILED',{error_class:info.kind,error_message:info.message,retry_count:retryCount,completed_at:new Date().toISOString(),next_retry_at:null});}
    await releaseEmployee(task); throw error;
  }
}

export async function processQueue(limit=2) {
  const tasks=await db.list('hq_v2_tasks',`archived_at=is.null&status=in.(QUEUED,PAUSED_EXTERNAL)&or=(next_retry_at.is.null,next_retry_at.lte.${encodeURIComponent(new Date().toISOString())})&order=created_at.asc&limit=${limit}`);
  for(const task of tasks){if(task.status==='PAUSED_EXTERNAL')await db.update('hq_v2_tasks',`id=eq.${task.id}`,{status:'QUEUED',updated_at:new Date().toISOString()},false);try{await executeTask(task.id)}catch(error){console.error(JSON.stringify({level:'error',taskId:task.id,employeeId:task.employee_id,projectId:task.project_id,route:task.route,stage:'execute',result:'failed',error:String(error.message||error)}));}}
  return tasks.length;
}
