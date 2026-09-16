import { parseCommand } from '../core/router.mjs';
import { assertTransition } from '../core/state-machine.mjs';
import { classifyError } from '../core/adapters.mjs';
import { db } from './db.mjs';
import { registry } from './tool-adapters.mjs';

const capabilityFor = route => ({GENERAL:'general',PROJECT_EXECUTION:'project_execution',RESEARCH:'research',QA:'qa',DESIGN:'research',BUSINESS:'business',FINANCE_ANALYSIS:'finance_analysis',TRADING_PAPER:'paper_trade'}[route]);
const employeeStatusFor = route => route==='RESEARCH'?'RESEARCHING':route==='QA'?'REVIEWING':'WORKING';

async function event(taskId,stage,message,metadata={}) { await db.insert('hq_v2_task_events',{task_id:taskId,stage,message,metadata},false); }
async function setTask(task,to,extra={}) { assertTransition(task.status,to); const rows=await db.update('hq_v2_tasks',`id=eq.${task.id}`,{status:to,updated_at:new Date().toISOString(),...extra}); Object.assign(task,rows[0]); await event(task.id,to,extra.message||to); }
async function releaseEmployee(task,status='READY') { if(task.employee_id)await db.update('hq_v2_employees',`id=eq.${task.employee_id}`,{status,current_task_id:null,last_active_at:new Date().toISOString(),updated_at:new Date().toISOString()},false); }

export async function createTask(command,idempotencyKey) {
  const route=parseCommand(command), title=String(command).trim().slice(0,140);
  const existing=idempotencyKey?await db.one('hq_v2_tasks',`idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`):null;
  if(existing)return existing;
  const [task]=await db.insert('hq_v2_tasks',{command,title,route:route.route,status:'QUEUED',employee_id:route.employeeId,project_id:route.projectId,idempotency_key:idempotencyKey||null});
  await event(task.id,'RECEIVED','تم استلام الأمر',{route}); return task;
}

export async function executeTask(taskId) {
  const task=await db.one('hq_v2_tasks',`id=eq.${taskId}`); if(!task)throw new Error('TASK_NOT_FOUND');
  try {
    await setTask(task,'ROUTING',{started_at:new Date().toISOString()});
    const parsed=parseCommand(task.command); const capability=capabilityFor(parsed.route);
    if(parsed.requiresApproval){const approved=await db.one('hq_v2_approvals',`task_id=eq.${task.id}&status=eq.APPROVED`);if(approved){await setTask(task,'BLOCKED',{error_class:'UNSUPPORTED_HIGH_IMPACT_ACTION',error_message:'تمت الموافقة، لكن لا يوجد محول آمن متصل لهذا الإجراء. لم يُنفذ أي تغيير.'});await db.insert('hq_v2_secretary_briefs',{task_id:task.id,title:`لم يُنفذ: ${task.title}`,body:'الموافقة مسجلة، لكن لا يوجد محول آمن متصل. لم يحدث أي تغيير خارجي.',severity:'WARNING'},false);await releaseEmployee(task);return;}await setTask(task,'WAITING_FOR_APPROVAL');await db.insert('hq_v2_approvals',{task_id:task.id,employee_id:task.employee_id,action:task.command,reason:'إجراء عالي التأثير',impact:'قد يغيّر بيانات أو ينفذ إجراءً حقيقيًا',tool_id:null});await releaseEmployee(task);return;}
    const adapter=registry.resolve(capability);
    if(!adapter){await setTask(task,'WAITING_FOR_CONNECTION',{adapter_id:null});const existing=await db.one('hq_v2_connection_requests',`task_id=eq.${task.id}&provider=eq.${encodeURIComponent(capability)}&status=in.(PENDING,APPROVED)`);if(!existing)await db.insert('hq_v2_connection_requests',{task_id:task.id,employee_id:task.employee_id,provider:capability,reason:`يلزم اتصال يدعم ${capability}`,permissions:[capability],costs_money:false});await releaseEmployee(task);return;}
    await setTask(task,'PLANNING',{adapter_id:adapter.id,plan:[{stage:'collect_facts'},{stage:'execute'},{stage:'validate'}]});
    const workStatus=parsed.route==='RESEARCH'?'RESEARCHING':parsed.route==='QA'?'REVIEWING':'WORKING'; await setTask(task,workStatus);
    await db.update('hq_v2_employees',`id=eq.${task.employee_id}`,{status:employeeStatusFor(parsed.route),current_task_id:task.id,last_active_at:new Date().toISOString()},false);
    const result=await adapter.execute({task,db});
    if(!result?.evidence?.length)throw new Error('VALIDATION:NO_EVIDENCE');
    if(task.status!=='REVIEWING')await setTask(task,'REVIEWING');
    for(const item of result.evidence)await db.insert('hq_v2_task_evidence',{task_id:task.id,kind:item.kind,label:item.label,uri:item.uri||null,data:item.data||{}},false);
    if(result.validated===false){await setTask(task,'BLOCKED',{result,error_class:'VALIDATION_FAILURE',error_message:result.summary,completed_at:new Date().toISOString()});await db.insert('hq_v2_secretary_briefs',{task_id:task.id,title:`لم يثبت الاكتمال: ${task.title}`,body:result.summary,severity:'WARNING'},false);await releaseEmployee(task);return;}
    await setTask(task,'COMPLETED',{result,completed_at:new Date().toISOString(),error_class:null,error_message:null});
    await db.insert('hq_v2_reports',{type:parsed.route,title:task.title,summary:result.summary,author_employee_id:task.employee_id,source_task_id:task.id,project_id:task.project_id,evidence:result.evidence},false);
    await db.insert('hq_v2_secretary_briefs',{task_id:task.id,title:`اكتملت: ${task.title}`,body:result.summary,severity:'SUCCESS'},false);
    await db.insert('hq_v2_activity',{task_id:task.id,employee_id:task.employee_id,project_id:task.project_id,kind:'TASK_COMPLETED',message:result.summary},false);
    await releaseEmployee(task);
  } catch(error) {
    const info=classifyError(error); const retryCount=Number(task.retry_count||0)+1;
    if(info.retryable&&retryCount<=Number(task.max_retries||3)){if(task.status==='REVIEWING'||task.status==='WORKING'||task.status==='RESEARCHING')await setTask(task,'PAUSED_EXTERNAL',{error_class:info.kind,error_message:info.message,retry_count:retryCount,next_retry_at:new Date(Date.now()+Math.min(300000,5000*2**retryCount)).toISOString()});}
    else if(!['WAITING_FOR_CONNECTION','WAITING_FOR_APPROVAL','COMPLETED'].includes(task.status)){await setTask(task,'FAILED',{error_class:info.kind,error_message:info.message,retry_count:retryCount,completed_at:new Date().toISOString()});}
    await releaseEmployee(task); throw error;
  }
}

export async function processQueue(limit=2) {
  const tasks=await db.list('hq_v2_tasks',`status=in.(QUEUED,PAUSED_EXTERNAL)&or=(next_retry_at.is.null,next_retry_at.lte.${encodeURIComponent(new Date().toISOString())})&order=created_at.asc&limit=${limit}`);
  for(const task of tasks){if(task.status==='PAUSED_EXTERNAL')await db.update('hq_v2_tasks',`id=eq.${task.id}`,{status:'QUEUED',updated_at:new Date().toISOString()},false);try{await executeTask(task.id)}catch(error){console.error(JSON.stringify({level:'error',taskId:task.id,employeeId:task.employee_id,projectId:task.project_id,route:task.route,stage:'execute',result:'failed',error:String(error.message||error)}));}}
  return tasks.length;
}
