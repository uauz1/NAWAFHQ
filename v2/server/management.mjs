import { createTask, discussTask, executeTask } from './executor.mjs';

const terminal=new Set(['COMPLETED','FAILED','BLOCKED','CANCELLED','WAITING_FOR_CONNECTION','WAITING_FOR_APPROVAL']);
const cleanText=(value,max=8000)=>String(value||'').trim().slice(0,max);

export async function handleManagementApi({req,res,url,db,json,body,broadcast}){
  if(url.pathname==='/api/v2/roles'&&req.method==='GET'){
    const roles=await db.list('hq_v2_roles','order=is_preset.desc,name.asc');
    json(res,200,{ok:true,roles});return true;
  }
  if(url.pathname==='/api/v2/roles'&&req.method==='POST'){
    const b=await body(req),name=cleanText(b.name,120);if(!name){json(res,400,{ok:false,error:'ROLE_NAME_REQUIRED'});return true;}
    const existing=await db.one('hq_v2_roles',`name=eq.${encodeURIComponent(name)}`);if(existing){json(res,409,{ok:false,error:'ROLE_ALREADY_EXISTS'});return true;}
    const [role]=await db.insert('hq_v2_roles',{name,department:cleanText(b.department,120)||'عام',description:cleanText(b.description,1000),capabilities:Array.isArray(b.capabilities)?b.capabilities.slice(0,20):[],is_preset:false});
    broadcast('state.changed',{roleId:role.id});json(res,201,{ok:true,role});return true;
  }

  const employeeMatch=url.pathname.match(/^\/api\/v2\/employees\/([^/]+)$/);
  if(employeeMatch&&req.method==='PATCH'){
    const id=decodeURIComponent(employeeMatch[1]),employee=await db.one('hq_v2_employees',`id=eq.${encodeURIComponent(id)}`);if(!employee){json(res,404,{ok:false,error:'EMPLOYEE_NOT_FOUND'});return true;}
    const b=await body(req),patch={updated_at:new Date().toISOString()};
    if(b.name_ar!==undefined){const v=cleanText(b.name_ar,80);if(!v){json(res,400,{ok:false,error:'NAME_REQUIRED'});return true;}patch.name_ar=v;}
    if(b.name_en!==undefined)patch.name_en=cleanText(b.name_en,80)||employee.name_en;
    if(b.role!==undefined){const v=cleanText(b.role,120);if(!v){json(res,400,{ok:false,error:'ROLE_REQUIRED'});return true;}patch.role=v;patch.role_source=b.role_source==='custom'?'custom':'preset';}
    if(b.department!==undefined)patch.department=cleanText(b.department,120)||'عام';
    if(b.custom_instructions!==undefined)patch.custom_instructions=cleanText(b.custom_instructions,4000);
    for(const key of ['expertise','permissions','preferred_tools'])if(Array.isArray(b[key]))patch[key]=b[key].slice(0,50).map(x=>cleanText(x,120)).filter(Boolean);
    const [updated]=await db.update('hq_v2_employees',`id=eq.${encodeURIComponent(id)}`,patch);
    broadcast('state.changed',{employeeId:id});json(res,200,{ok:true,employee:updated});return true;
  }

  const discussionMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)\/discussion$/);
  if(discussionMatch&&req.method==='GET'){
    const task=await db.one('hq_v2_tasks',`id=eq.${discussionMatch[1]}`);if(!task){json(res,404,{ok:false,error:'TASK_NOT_FOUND'});return true;}
    const messages=await db.list('hq_v2_task_messages',`task_id=eq.${task.id}&order=created_at.asc`);
    json(res,200,{ok:true,messages});return true;
  }
  if(discussionMatch&&req.method==='POST'){
    const b=await body(req),content=cleanText(b.content);if(!content){json(res,400,{ok:false,error:'MESSAGE_REQUIRED'});return true;}
    const result=await discussTask(discussionMatch[1],content);broadcast('task.discussion',{taskId:discussionMatch[1]});json(res,201,{ok:true,...result});return true;
  }

  const continueMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)\/continue$/);
  if(continueMatch&&req.method==='POST'){
    const original=await db.one('hq_v2_tasks',`id=eq.${continueMatch[1]}`);if(!original){json(res,404,{ok:false,error:'TASK_NOT_FOUND'});return true;}
    const employee=original.employee_id?await db.one('hq_v2_employees',`id=eq.${encodeURIComponent(original.employee_id)}`):null;
    const messages=await db.list('hq_v2_task_messages',`task_id=eq.${original.id}&order=created_at.asc&limit=40`);
    const b=await body(req),instruction=cleanText(b.instruction,4000)||'نفّذ النسخة المتفق عليها في النقاش.';
    const transcript=messages.map(m=>`${m.author_type==='owner'?'نواف':employee?.name_ar||'الموظف'}: ${m.content}`).join('\n');
    const command=`${employee?.name_ar?employee.name_ar+' ':''}${instruction}\n\nالمهمة الأصلية: ${original.command}\n\nملخص النقاش المرتبط بالمهمة:\n${transcript}`.slice(0,8000);
    const task=await createTask(command,req.headers['idempotency-key']);
    await db.insert('hq_v2_task_messages',{task_id:original.id,author_type:'system',content:`تم إنشاء مهمة متابعة: ${task.id}`,message_type:'decision'},false);
    broadcast('task.created',task);setImmediate(()=>executeTask(task.id).then(()=>broadcast('state.changed',{taskId:task.id})).catch(error=>broadcast('task.error',{taskId:task.id,error:String(error.message||error)})));
    json(res,202,{ok:true,task});return true;
  }

  const archiveMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)\/archive$/);
  if(archiveMatch&&req.method==='POST'){
    const task=await db.one('hq_v2_tasks',`id=eq.${archiveMatch[1]}`);if(!task){json(res,404,{ok:false,error:'TASK_NOT_FOUND'});return true;}
    if(!terminal.has(task.status)&&task.status!=='QUEUED'){json(res,409,{ok:false,error:'TASK_ACTIVE_CANNOT_ARCHIVE'});return true;}
    const patch={archived_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(task.status==='QUEUED')patch.status='CANCELLED';
    await db.update('hq_v2_tasks',`id=eq.${task.id}`,patch,false);
    await db.insert('hq_v2_activity',{task_id:task.id,employee_id:task.employee_id,project_id:task.project_id,kind:'TASK_ARCHIVED',message:`تم حذف الأمر من السجل الظاهر: ${task.title}`},false);
    broadcast('state.changed',{taskId:task.id,archived:true});json(res,200,{ok:true,archived:true});return true;
  }

  return false;
}
