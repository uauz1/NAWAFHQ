import { randomUUID } from 'node:crypto';
import { createTask, discussTask, executeTask } from './executor.mjs';

const terminal=new Set(['COMPLETED','FAILED','BLOCKED','CANCELLED','WAITING_FOR_CONNECTION','WAITING_FOR_APPROVAL']);
const cleanText=(value,max=8000)=>String(value||'').trim().slice(0,max);
const settingDefaults={company_name:'NAWAF HQ',background_worker_enabled:true,executive_briefs_enabled:true,show_completed_home:true,compact_mode:false};
const priorityRank={HIGH:3,MEDIUM:2,LOW:1};
const toolCatalog=[
  {provider:'GitHub',capability:'code_repository',priority:'HIGH',words:['github','قيت','مستودع','repo','commit','كود','برمجة','deploy','نشر'],why:'تنفيذ ومراجعة الكود وتتبع المستودعات والـCommits.'},
  {provider:'Firecrawl',capability:'web_research',priority:'HIGH',words:['بحث','ويب','منافس','سوق','مواقع','مصادر','research','crawl'],why:'بحث ويب وجمع مصادر وصفحات بشكل منظم.'},
  {provider:'TinyFish',capability:'browser_actions',priority:'MEDIUM',words:['متصفح','افتح موقع','سجل','نموذج','browser','لوحة تحكم'],why:'تنفيذ خطوات متصفح حقيقية عند الحاجة.'},
  {provider:'Gmail',capability:'email',priority:'MEDIUM',words:['ايميل','إيميل','بريد','gmail','رسالة'],why:'قراءة وإرسال ومتابعة البريد من خلال ربط مصرح.'},
  {provider:'Google Calendar',capability:'calendar',priority:'MEDIUM',words:['موعد','اجتماع','تقويم','calendar','schedule'],why:'تنظيم الاجتماعات والمواعيد والمتابعة الزمنية.'},
  {provider:'Todoist',capability:'tasks_reminders',priority:'LOW',words:['ذكرني','تذكير','todo','مهامي'],why:'تحويل الالتزامات الشخصية إلى مهام وتذكيرات.'},
  {provider:'Google Drive',capability:'files_docs',priority:'MEDIUM',words:['ملف','ملفات','مستند','شيت','sheet','doc','slides','drive'],why:'الوصول للمستندات والجداول والملفات المرتبطة بالمشاريع.'},
  {provider:'Figma',capability:'product_design',priority:'MEDIUM',words:['تصميم','واجهة','ui','ux','figma','تجربة المستخدم'],why:'تصميم ومراجعة واجهات المنتج.'},
  {provider:'Canva',capability:'creative_design',priority:'LOW',words:['بوستر','بنر','منشور','سوشال','canva','إعلان'],why:'تصاميم تسويقية ومحتوى بصري سريع.'},
  {provider:'Alpaca',capability:'market_data',priority:'HIGH',words:['سهم','أسهم','سوق','محفظة','تداول','سعر','ارامكو','أرامكو','stock','portfolio'],why:'بيانات سوق وتحليل تداول تجريبي بدون أموال حقيقية.'},
  {provider:'Bigdata.com',capability:'financial_research',priority:'MEDIUM',words:['قوائم مالية','أرباح','sec','earnings','تقييم شركة'],why:'بحث مالي أعمق وإفصاحات وأخبار ومحاضر أرباح.'},
  {provider:'Slack',capability:'team_communication',priority:'LOW',words:['فريق','قناة','slack','تواصل الفريق'],why:'تجميع تنبيهات وتحديثات الفريق في قناة عمل.'},
  {provider:'Mem',capability:'long_term_memory',priority:'MEDIUM',words:['تذكر','احفظ','ذاكرة','قرار','قرارات','سياق'],why:'ذاكرة عمل طويلة المدى للقرارات والملاحظات.'}
];
const normalize=v=>String(v||'').toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');

async function readSettings(db){
  const rows=await db.list('hq_v2_settings','order=key.asc');const map={...settingDefaults};
  for(const row of rows)map[row.key]=row.value?.value??row.value;
  return map;
}
async function writeSetting(db,key,value){
  const existing=await db.one('hq_v2_settings',`key=eq.${encodeURIComponent(key)}`,'key');
  if(existing)await db.update('hq_v2_settings',`key=eq.${encodeURIComponent(key)}`,{value:{value},updated_at:new Date().toISOString()},false);
  else await db.insert('hq_v2_settings',{key,value:{value}},false);
}

async function buildToolAdvice(db,employeeId=null){
  const taskQuery=`archived_at=is.null${employeeId?`&employee_id=eq.${encodeURIComponent(employeeId)}`:''}&order=created_at.desc&limit=120`;
  const [tasks,connections,requests]=await Promise.all([
    db.list('hq_v2_tasks',taskQuery),
    db.list('hq_v2_tool_connections','order=last_checked_at.desc'),
    db.list('hq_v2_connection_requests','order=created_at.desc&limit=50')
  ]);
  const connectedText=normalize(connections.filter(x=>String(x.connection_state).toUpperCase()==='CONNECTED').map(x=>`${x.id} ${x.provider} ${(x.capabilities||[]).join(' ')}`).join(' '));
  const corpus=normalize(tasks.map(t=>t.command).join('\n'));
  const advice=[];
  for(const tool of toolCatalog){
    const hits=tool.words.filter(w=>corpus.includes(normalize(w))).length;
    const pending=requests.filter(r=>normalize(r.provider).includes(normalize(tool.provider))&&['PENDING','APPROVED'].includes(r.status)).length;
    if(!hits&&!pending)continue;
    const connected=connectedText.includes(normalize(tool.provider))||connectedText.includes(normalize(tool.capability));
    const related=tasks.filter(t=>tool.words.some(w=>normalize(t.command).includes(normalize(w)))).slice(0,6);
    advice.push({provider:tool.provider,capability:tool.capability,reason:tool.why,requested_for:related[0]?.command||'',priority:pending?'HIGH':tool.priority,status:connected?'CONNECTED':'SUGGESTED',hits,pending,source_task_ids:related.map(t=>t.id)});
  }
  if(!advice.length)advice.push({provider:'Firecrawl',capability:'web_research',reason:'يفيد سارة والباحثين عند طلب دراسات سوق أو منافسين.',requested_for:'لم تظهر حاجة قوية من الأوامر الحالية حتى الآن.',priority:'LOW',status:'SUGGESTED',hits:0,pending:0,source_task_ids:[]});
  advice.sort((a,b)=>(priorityRank[b.priority]||0)-(priorityRank[a.priority]||0)||b.hits-a.hits);
  return {advice,tasksAnalyzed:tasks.length,generatedAt:new Date().toISOString()};
}
async function persistToolAdvice(db,result){
  const old=await db.list('hq_v2_tool_recommendations','status=eq.SUGGESTED','id');
  for(const row of old)await db.delete('hq_v2_tool_recommendations',`id=eq.${row.id}`,false);
  for(const item of result.advice){
    if(item.status==='CONNECTED')continue;
    await db.insert('hq_v2_tool_recommendations',{provider:item.provider,capability:item.capability,reason:item.reason,requested_for:item.requested_for,priority:item.priority,status:'SUGGESTED',source_task_ids:item.source_task_ids},false);
  }
}

export async function processBackgroundRoutines(db,broadcast,{force=false}={}){
  const settings=await readSettings(db);if(!settings.background_worker_enabled&&!force)return {ran:0,skipped:'disabled'};
  const routines=await db.list('hq_v2_background_routines','enabled=eq.true&order=created_at.asc'),created=[];
  for(const routine of routines){
    if(!force&&routine.next_run_at&&Date.parse(routine.next_run_at)>Date.now())continue;
    const cadence=Math.max(15,Number(routine.cadence_minutes)||60),nowIso=new Date().toISOString();
    if(routine.id==='executive-review'){
      const [tasks,approvals,connections]=await Promise.all([
        db.list('hq_v2_tasks','archived_at=is.null&order=created_at.desc&limit=100'),
        db.list('hq_v2_approvals','status=eq.PENDING'),
        db.list('hq_v2_connection_requests','status=in.(PENDING,APPROVED)')
      ]);
      const active=tasks.filter(t=>['QUEUED','ROUTING','PLANNING','WORKING','RESEARCHING','REVIEWING','PAUSED_EXTERNAL'].includes(t.status));
      const failed=tasks.filter(t=>['FAILED','BLOCKED','WAITING_FOR_CONNECTION'].includes(t.status)).slice(0,5);
      const text=`مراجعة المدير العام: ${active.length} مهام نشطة، ${approvals.length} موافقات، ${connections.length} طلبات ربط، ${failed.length} عناصر تحتاج انتباه.${failed.length?` تحتاج مراجعة: ${failed.map(x=>x.title).join('، ')}`:' لا يوجد شيء عاجل مثبت الآن.'}`;
      await db.insert('hq_v2_secretary_briefs',{task_id:null,title:'موجز المدير العام',body:text,severity:(approvals.length||connections.length||failed.length)?'WARNING':'SUCCESS'},false);
      created.push({routineId:routine.id,type:'brief',summary:text});
    }else{
      const bucket=Math.floor(Date.now()/(cadence*60000));
      const task=await createTask(routine.command_template,`routine:${routine.id}:${bucket}`);
      created.push({routineId:routine.id,type:'task',taskId:task.id,title:task.title});
      broadcast?.('task.created',task);
      setImmediate(()=>executeTask(task.id).then(()=>broadcast?.('state.changed',{taskId:task.id,background:true})).catch(error=>broadcast?.('task.error',{taskId:task.id,error:String(error.message||error)})));
    }
    await db.update('hq_v2_background_routines',`id=eq.${encodeURIComponent(routine.id)}`,{last_run_at:nowIso,next_run_at:new Date(Date.now()+cadence*60000).toISOString(),last_result:{createdAt:nowIso,items:created.filter(x=>x.routineId===routine.id)},updated_at:nowIso},false);
  }
  if(created.length)broadcast?.('state.changed',{background:true,ran:created.length});
  return {ran:created.length,created};
}

export async function handleManagementApi({req,res,url,db,json,body,broadcast}){
  if(url.pathname==='/api/v2/settings'&&req.method==='GET'){json(res,200,{ok:true,settings:await readSettings(db)});return true;}
  if(url.pathname==='/api/v2/settings'&&req.method==='PATCH'){
    const b=await body(req),changed={};
    for(const key of Object.keys(settingDefaults)){
      if(!(key in b))continue;
      let value=b[key];value=typeof settingDefaults[key]==='boolean'?Boolean(value):(cleanText(value,120)||settingDefaults[key]);
      await writeSetting(db,key,value);changed[key]=value;
    }
    broadcast('state.changed',{settings:true});json(res,200,{ok:true,settings:{...(await readSettings(db)),...changed}});return true;
  }

  if(url.pathname==='/api/v2/executive/tool-advice'&&req.method==='GET'){json(res,200,{ok:true,...await buildToolAdvice(db,url.searchParams.get('employee_id')||null)});return true;}
  if(url.pathname==='/api/v2/executive/tool-advice/refresh'&&req.method==='POST'){
    const b=await body(req),result=await buildToolAdvice(db,b.employee_id||null);await persistToolAdvice(db,result);broadcast('state.changed',{toolAdvice:true});json(res,200,{ok:true,...result});return true;
  }

  if(url.pathname==='/api/v2/background'&&req.method==='GET'){
    const [routines,briefs,settings]=await Promise.all([db.list('hq_v2_background_routines','order=created_at.asc'),db.list('hq_v2_secretary_briefs','order=created_at.desc&limit=8'),readSettings(db)]);
    json(res,200,{ok:true,routines,briefs,settings});return true;
  }
  if(url.pathname==='/api/v2/background/run'&&req.method==='POST'){json(res,202,{ok:true,...await processBackgroundRoutines(db,broadcast,{force:true})});return true;}
  const routineMatch=url.pathname.match(/^\/api\/v2\/background\/([^/]+)$/);
  if(routineMatch&&req.method==='PATCH'){
    const id=decodeURIComponent(routineMatch[1]),routine=await db.one('hq_v2_background_routines',`id=eq.${encodeURIComponent(id)}`);if(!routine){json(res,404,{ok:false,error:'ROUTINE_NOT_FOUND'});return true;}
    const b=await body(req),patch={updated_at:new Date().toISOString()};
    if(b.enabled!==undefined)patch.enabled=Boolean(b.enabled);
    if(b.cadence_minutes!==undefined)patch.cadence_minutes=Math.max(15,Math.min(10080,Number(b.cadence_minutes)||routine.cadence_minutes));
    if(b.command_template!==undefined)patch.command_template=cleanText(b.command_template,4000)||routine.command_template;
    const [updated]=await db.update('hq_v2_background_routines',`id=eq.${encodeURIComponent(id)}`,patch);broadcast('state.changed',{routineId:id});json(res,200,{ok:true,routine:updated});return true;
  }

  if(url.pathname==='/api/v2/finance/reset-paper'&&req.method==='POST'){
    const b=await body(req),cash=Number(b.cash);if(!b.confirm||!Number.isFinite(cash)||cash<1000||cash>1_000_000_000){json(res,400,{ok:false,error:'VALID_PAPER_CASH_AND_CONFIRM_REQUIRED'});return true;}
    await db.delete('hq_v2_paper_positions','account_id=eq.default',false);await db.update('hq_v2_paper_accounts','id=eq.default',{initial_cash:cash,cash,updated_at:new Date().toISOString()},false);await db.insert('hq_v2_activity',{kind:'PAPER_ACCOUNT_RESET',message:`تم ضبط رأس المال التجريبي إلى ${cash} USD. لا توجد أموال حقيقية.`},false);broadcast('state.changed',{finance:true});json(res,200,{ok:true,cash,paperOnly:true});return true;
  }
  if(url.pathname==='/api/v2/finance/order'&&req.method==='POST'){
    const b=await body(req),symbol=cleanText(b.symbol,12).toUpperCase(),amount=Number(b.amount),side=String(b.side||'BUY').toUpperCase();
    if(!/^[A-Z0-9.]{1,12}$/.test(symbol)||!Number.isFinite(amount)||amount<=0||!['BUY','SELL'].includes(side)){json(res,400,{ok:false,error:'INVALID_PAPER_ORDER'});return true;}
    const task=await createTask(`راكان ${side==='SELL'?'بيع':'شراء'} ${symbol} بقيمة ${amount} دولار تجريبي Paper فقط`,req.headers['idempotency-key']);broadcast('task.created',task);setImmediate(()=>executeTask(task.id).then(()=>broadcast('state.changed',{taskId:task.id,finance:true})).catch(error=>broadcast('task.error',{taskId:task.id,error:String(error.message||error)})));json(res,202,{ok:true,task,paperOnly:true});return true;
  }

  if(url.pathname==='/api/v2/roles'&&req.method==='GET'){json(res,200,{ok:true,roles:await db.list('hq_v2_roles','order=is_preset.desc,name.asc')});return true;}
  if(url.pathname==='/api/v2/roles'&&req.method==='POST'){
    const b=await body(req),name=cleanText(b.name,120);if(!name){json(res,400,{ok:false,error:'ROLE_NAME_REQUIRED'});return true;}
    if(await db.one('hq_v2_roles',`name=eq.${encodeURIComponent(name)}`)){json(res,409,{ok:false,error:'ROLE_ALREADY_EXISTS'});return true;}
    const [role]=await db.insert('hq_v2_roles',{name,department:cleanText(b.department,120)||'عام',description:cleanText(b.description,1000),capabilities:Array.isArray(b.capabilities)?b.capabilities.slice(0,20):[],is_preset:false});broadcast('state.changed',{roleId:role.id});json(res,201,{ok:true,role});return true;
  }

  if(url.pathname==='/api/v2/employees'&&req.method==='POST'){
    const b=await body(req),name_ar=cleanText(b.name_ar,80),role=cleanText(b.role,120);if(!name_ar||!role){json(res,400,{ok:false,error:'NAME_AND_ROLE_REQUIRED'});return true;}
    if(await db.one('hq_v2_employees',`name_ar=eq.${encodeURIComponent(name_ar)}&archived_at=is.null`)){json(res,409,{ok:false,error:'EMPLOYEE_NAME_EXISTS'});return true;}
    const id=`emp-${randomUUID()}`,[employee]=await db.insert('hq_v2_employees',{id,name_ar,name_en:cleanText(b.name_en,80)||id,role,department:cleanText(b.department,120)||'عام',status:'READY',expertise:Array.isArray(b.expertise)?b.expertise:[],permissions:Array.isArray(b.permissions)?b.permissions:[],preferred_tools:Array.isArray(b.preferred_tools)?b.preferred_tools:[],routing_rules:{},custom_instructions:cleanText(b.custom_instructions,4000),role_source:b.role_source==='custom'?'custom':'preset'});broadcast('state.changed',{employeeId:id,created:true});json(res,201,{ok:true,employee});return true;
  }
  const employeeMatch=url.pathname.match(/^\/api\/v2\/employees\/([^/]+)$/);
  if(employeeMatch&&req.method==='PATCH'){
    const id=decodeURIComponent(employeeMatch[1]),employee=await db.one('hq_v2_employees',`id=eq.${encodeURIComponent(id)}&archived_at=is.null`);if(!employee){json(res,404,{ok:false,error:'EMPLOYEE_NOT_FOUND'});return true;}
    const b=await body(req),patch={updated_at:new Date().toISOString()};
    if(b.name_ar!==undefined){const v=cleanText(b.name_ar,80);if(!v){json(res,400,{ok:false,error:'NAME_REQUIRED'});return true;}patch.name_ar=v;}
    if(b.name_en!==undefined)patch.name_en=cleanText(b.name_en,80)||employee.name_en;
    if(b.role!==undefined){const v=cleanText(b.role,120);if(!v){json(res,400,{ok:false,error:'ROLE_REQUIRED'});return true;}patch.role=v;patch.role_source=b.role_source==='custom'?'custom':'preset';}
    if(b.department!==undefined)patch.department=cleanText(b.department,120)||'عام';
    if(b.custom_instructions!==undefined)patch.custom_instructions=cleanText(b.custom_instructions,4000);
    for(const key of ['expertise','permissions','preferred_tools'])if(Array.isArray(b[key]))patch[key]=b[key].slice(0,50).map(x=>cleanText(x,120)).filter(Boolean);
    const [updated]=await db.update('hq_v2_employees',`id=eq.${encodeURIComponent(id)}`,patch);broadcast('state.changed',{employeeId:id});json(res,200,{ok:true,employee:updated});return true;
  }
  const employeeArchive=url.pathname.match(/^\/api\/v2\/employees\/([^/]+)\/archive$/);
  if(employeeArchive&&req.method==='POST'){
    const id=decodeURIComponent(employeeArchive[1]),employee=await db.one('hq_v2_employees',`id=eq.${encodeURIComponent(id)}&archived_at=is.null`);if(!employee){json(res,404,{ok:false,error:'EMPLOYEE_NOT_FOUND'});return true;}
    if(employee.current_task_id){json(res,409,{ok:false,error:'EMPLOYEE_HAS_ACTIVE_TASK'});return true;}
    await db.update('hq_v2_employees',`id=eq.${encodeURIComponent(id)}`,{archived_at:new Date().toISOString(),status:'OFFLINE',updated_at:new Date().toISOString()},false);broadcast('state.changed',{employeeId:id,archived:true});json(res,200,{ok:true,archived:true});return true;
  }

  const projectControl=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/control$/);
  if(projectControl&&req.method==='GET'){
    const id=decodeURIComponent(projectControl[1]),project=await db.one('hq_v2_projects',`id=eq.${encodeURIComponent(id)}`);if(!project){json(res,404,{ok:false,error:'PROJECT_NOT_FOUND'});return true;}
    const [tasks,reports]=await Promise.all([db.list('hq_v2_tasks',`project_id=eq.${encodeURIComponent(id)}&archived_at=is.null&order=created_at.desc&limit=25`),db.list('hq_v2_reports',`project_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=20`)]);json(res,200,{ok:true,project,tasks,reports});return true;
  }

  const discussionMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)\/discussion$/);
  if(discussionMatch&&req.method==='GET'){const task=await db.one('hq_v2_tasks',`id=eq.${discussionMatch[1]}`);if(!task){json(res,404,{ok:false,error:'TASK_NOT_FOUND'});return true;}json(res,200,{ok:true,messages:await db.list('hq_v2_task_messages',`task_id=eq.${task.id}&order=created_at.asc`)});return true;}
  if(discussionMatch&&req.method==='POST'){const b=await body(req),content=cleanText(b.content);if(!content){json(res,400,{ok:false,error:'MESSAGE_REQUIRED'});return true;}const result=await discussTask(discussionMatch[1],content);broadcast('task.discussion',{taskId:discussionMatch[1]});json(res,201,{ok:true,...result});return true;}

  const continueMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)\/continue$/);
  if(continueMatch&&req.method==='POST'){
    const original=await db.one('hq_v2_tasks',`id=eq.${continueMatch[1]}`);if(!original){json(res,404,{ok:false,error:'TASK_NOT_FOUND'});return true;}
    const employee=original.employee_id?await db.one('hq_v2_employees',`id=eq.${encodeURIComponent(original.employee_id)}`):null;
    const messages=await db.list('hq_v2_task_messages',`task_id=eq.${original.id}&order=created_at.asc&limit=40`),b=await body(req);
    const instruction=cleanText(b.instruction,4000)||'نفّذ النسخة المتفق عليها في النقاش.',transcript=messages.map(m=>`${m.author_type==='owner'?'نواف':employee?.name_ar||'الموظف'}: ${m.content}`).join('\n'),command=`${employee?.name_ar?employee.name_ar+' ':''}${instruction}\n\nالمهمة الأصلية: ${original.command}\n\nملخص النقاش المرتبط بالمهمة:\n${transcript}`.slice(0,8000),task=await createTask(command,req.headers['idempotency-key']);
    await db.insert('hq_v2_task_messages',{task_id:original.id,author_type:'system',content:`تم إنشاء مهمة متابعة: ${task.id}`,message_type:'decision'},false);broadcast('task.created',task);setImmediate(()=>executeTask(task.id).then(()=>broadcast('state.changed',{taskId:task.id})).catch(error=>broadcast('task.error',{taskId:task.id,error:String(error.message||error)})));json(res,202,{ok:true,task});return true;
  }

  const archiveMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)\/archive$/);
  if(archiveMatch&&req.method==='POST'){
    const task=await db.one('hq_v2_tasks',`id=eq.${archiveMatch[1]}`);if(!task){json(res,404,{ok:false,error:'TASK_NOT_FOUND'});return true;}
    if(!terminal.has(task.status)&&task.status!=='QUEUED'){json(res,409,{ok:false,error:'TASK_ACTIVE_CANNOT_ARCHIVE'});return true;}
    const patch={archived_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(task.status==='QUEUED')patch.status='CANCELLED';await db.update('hq_v2_tasks',`id=eq.${task.id}`,patch,false);await db.insert('hq_v2_activity',{task_id:task.id,employee_id:task.employee_id,project_id:task.project_id,kind:'TASK_ARCHIVED',message:`تم حذف الأمر من السجل الظاهر: ${task.title}`},false);broadcast('state.changed',{taskId:task.id,archived:true});json(res,200,{ok:true,archived:true});return true;
  }

  return false;
}
