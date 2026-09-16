import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTask, executeTask, processQueue } from './executor.mjs';
import { db, dbConfigured, snapshot } from './db.mjs';
import { registry } from './tool-adapters.mjs';

const PORT=Number(process.env.PORT||8787), ROOT=join(fileURLToPath(new URL('.',import.meta.url)),'../web');
const accessToken=process.env.HQ_V2_ACCESS_TOKEN||''; const clients=new Set(); let workerBusy=false; let lastWorkerTick=null;
const runtimeUrl=(process.env.OPENHANDS_RUNTIME_URL||'https://nawaf-hq-crewai-runtime.onrender.com').replace(/\/$/,'');
let healthCache={at:0,value:null};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const body=async req=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('BODY_TOO_LARGE');}return raw?JSON.parse(raw):{};};
const authorized=req=>accessToken&&req.headers.authorization===`Bearer ${accessToken}`;
const broadcast=(event,data)=>{const payload=`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;for(const res of clients)res.write(payload);};

const chatgptConnectorCatalog=[
  {id:'mem',name:'Mem',capabilities:['personal_memory','notes'],execution:'chatgpt_session'},
  {id:'todoist',name:'Todoist',capabilities:['tasks','reminders'],execution:'chatgpt_session'},
  {id:'google_calendar',name:'Google Calendar',capabilities:['calendar'],execution:'chatgpt_session'},
  {id:'gmail',name:'Gmail',capabilities:['email'],execution:'chatgpt_session'},
  {id:'spotify',name:'Spotify',capabilities:['music','podcasts'],execution:'chatgpt_session'},
  {id:'background_music',name:'Background Music',capabilities:['generated_music'],execution:'chatgpt_session'},
  {id:'anywhere_map',name:'AnyWhereMap',capabilities:['interactive_maps'],execution:'chatgpt_session'},
  {id:'tinyfish',name:'TinyFish',capabilities:['browser_actions'],execution:'chatgpt_session'},
  {id:'firecrawl',name:'Firecrawl',capabilities:['web_research','crawl'],execution:'chatgpt_session'}
];

const connectorIntentRules=[
  {provider:'Spotify',words:['سبوتيفاي','spotify','اغنيه','أغنية','بودكاست','playlist','بلاي ليست']},
  {provider:'Background Music',words:['موسيقى خلفيه','موسيقى خلفية','background music','موسيقى تركيز']},
  {provider:'AnyWhereMap',words:['خريطه','خريطة','map','طريق','مكان قريب','وين اروح','وين أروح']},
  {provider:'Todoist',words:['ذكرني','تذكير','مهمه شخصيه','مهمة شخصية','todoist']},
  {provider:'Google Calendar',words:['موعد','تقويم','calendar','اجتماعي','اجتماعي القادم']},
  {provider:'Gmail',words:['ايميل','إيميل','بريد','gmail']},
  {provider:'Mem',words:['احفظ هالمعلومه','احفظ هالمعلومة','تذكر هالشي','mem']}
];

const companyWords=['الشركه','الشركة','موظف','الموظفين','مهمه للشركه','مهمة للشركة','مشروع','معين','مُعين','قدها','قدّها','github','قيت هب','كود','اصلح','أصلح','انشر','deploy','qa','اختبر','راكان','ساره','سارة','فهد','ليان','نوره','نورة','عمر','ارامكو','أرامكو','محفظه','محفظة'];
const normalizeText=v=>String(v||'').toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim();
const isCompanyIntent=message=>{const t=normalizeText(message);return companyWords.some(w=>t.includes(normalizeText(w)));};
const connectorIntent=message=>{const t=normalizeText(message);return connectorIntentRules.find(rule=>rule.words.some(w=>t.includes(normalizeText(w))))||null;};

async function syncToolConnections() {
  if(!dbConfigured())return;
  for(const adapter of registry.list()){
    const row={provider:adapter.provider,capabilities:adapter.capabilities,permissions:[],connection_state:adapter.connectionState,health_state:adapter.health,last_checked_at:new Date().toISOString(),metadata:{source:'runtime_registry',autonomous:true}};
    const existing=await db.one('hq_v2_tool_connections',`id=eq.${encodeURIComponent(adapter.id)}`,'id');
    if(existing)await db.update('hq_v2_tool_connections',`id=eq.${encodeURIComponent(adapter.id)}`,row,false);
    else await db.insert('hq_v2_tool_connections',{id:adapter.id,...row},false);
  }
}

async function navReply(message,memories,messages){
  if(!process.env.GEMINI_API_KEY)throw new Error('MISSING_CONNECTION:GEMINI_API_KEY');
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
  const memoryText=memories.slice(0,12).map(x=>`- ${x.content}`).join('\n')||'لا توجد ذاكرة محفوظة بعد.';
  const history=messages.slice(-10).map(x=>`${x.role==='user'?'نواف':'ناڤ'}: ${x.content}`).join('\n');
  const prompt=`أنت ناڤ، المساعد الشخصي لنواف. تكلم بالعربية السعودية الطبيعية وباختصار مفيد.\n\nقواعد ثابتة:\n- لا تدعي أنك نفذت شيئًا خارجيًا إلا إذا أعطاك النظام دليل تنفيذ فعلي.\n- أنت داخل تطبيق NAWAF HQ V2 وتستطيع توجيه أوامر الشركة عبر محركها المشترك، لكن هذه الدالة للمحادثة الشخصية فقط.\n- موصلات ChatGPT الشخصية مثل Spotify وTodoist وGmail وMaps وMem لا يمكن استدعاؤها من تطبيق الويب مباشرة؛ لا تدعِ استخدامها من هنا.\n- لا تطلب من نواف إعادة معلومات موجودة في الذاكرة أدناه.\n- كن عمليًا وسريعًا.\n\nذاكرة ناڤ:\n${memoryText}\n\nآخر المحادثة:\n${history}\n\nنواف: ${message}\nناڤ:`;
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.35,maxOutputTokens:900}}),signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(!r.ok){const error=new Error(`GEMINI_${r.status}:${d?.error?.message||'error'}`);error.status=r.status;throw error;}
  const text=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!text)throw new Error('VALIDATION:EMPTY_NAV_RESPONSE');
  return {text,model};
}

async function navContext(){
  const [memories,messages,company]=await Promise.all([
    db.list('hq_v2_nav_memory','active=eq.true&order=importance.desc,updated_at.desc&limit=30'),
    db.list('hq_v2_nav_messages','order=created_at.desc&limit=40'),
    snapshot()
  ]);
  return {memories,messages:[...messages].reverse(),company:{activeTasks:company.tasks.filter(t=>['WORKING','RESEARCHING','REVIEWING','ROUTING','PLANNING'].includes(t.status)).length,attention:company.approvals.length+company.connections.length,projects:company.projects,employees:company.employees},serverAdapters:registry.list(),chatgptConnectors:chatgptConnectorCatalog,note:'موصلات ChatGPT الشخصية متاحة عند استخدام ناڤ من محادثة ChatGPT، وليست مفاتيح OAuth يملكها Backend الويب.'};
}

async function health() {
  if(healthCache.value&&Date.now()-healthCache.at<60000)return healthCache.value;
  const checks={supabase:{status:'Unavailable'},executionWorker:{status:'Healthy'},projectExecutor:{status:'Unavailable'},paperBroker:{status:'Healthy'},realtime:{status:'Healthy'},github:{status:'Degraded'},aiBackend:{status:process.env.GEMINI_API_KEY?'Healthy':'Unavailable'},marketData:{status:'Degraded'},navMemory:{status:'Unavailable'},render:{status:'Healthy'}};
  if(dbConfigured()){try{const account=await db.one('hq_v2_paper_accounts','id=eq.default','id');checks.supabase={status:'Healthy'};checks.paperBroker={status:account?'Healthy':'Unavailable'};await db.list('hq_v2_nav_memory','limit=1','id');checks.navMemory={status:'Healthy'}}catch(error){checks.supabase={status:'Unavailable',detail:String(error.message)};checks.paperBroker={status:'Unavailable'};checks.navMemory={status:'Unavailable',detail:String(error.message)}}}
  checks.executionWorker={status:'Healthy',detail:workerBusy?'ينفذ الآن':lastWorkerTick?`آخر دورة ${lastWorkerTick}`:'بانتظار أول دورة'};
  try{const r=await fetch(`${runtimeUrl}/health`,{signal:AbortSignal.timeout(20000)});const d=await r.json().catch(()=>({}));checks.projectExecutor={status:r.ok&&d?.ok?'Healthy':'Degraded',detail:r.ok?`OpenHands ${d?.openhands?.status||'reachable'}`:`HTTP ${r.status}`}}catch(error){checks.projectExecutor={status:'Unavailable',detail:String(error.message||error)}}
  try{const r=await fetch('https://api.github.com/repos/uauz1/NAWAFHQ',{headers:{'User-Agent':'NAWAF-HQ-V2'},signal:AbortSignal.timeout(5000)});checks.github={status:r.ok?'Healthy':'Degraded',detail:`HTTP ${r.status}`}}catch(error){checks.github={status:'Unavailable',detail:String(error.message)}}
  try{const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d',{headers:{'User-Agent':'Mozilla/5.0 NAWAF-HQ-V2'},signal:AbortSignal.timeout(5000)});const d=await r.json();checks.marketData={status:r.ok&&d?.chart?.result?.[0]?.meta?.regularMarketPrice?'Healthy':'Degraded'}}catch(error){checks.marketData={status:'Unavailable',detail:String(error.message)}}
  const value={ok:checks.supabase.status==='Healthy'&&checks.executionWorker.status==='Healthy'&&checks.projectExecutor.status!=='Unavailable'&&checks.github.status!=='Unavailable'&&checks.navMemory.status==='Healthy',service:'nawaf-hq-v2',version:'2.2.0',checks,timestamp:new Date().toISOString(),authConfigured:Boolean(accessToken)};
  healthCache={at:Date.now(),value};return value;
}

async function api(req,res,url){
  if(url.pathname==='/api/v2/health'&&req.method==='GET')return json(res,200,await health());
  if(url.pathname==='/api/v2/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(`event: connected\ndata: {"ok":true}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
  if(!authorized(req))return json(res,accessToken?401:503,{ok:false,error:accessToken?'UNAUTHORIZED':'HQ_V2_ACCESS_TOKEN_NOT_CONFIGURED'});
  if(url.pathname==='/api/v2/snapshot'&&req.method==='GET')return json(res,200,{ok:true,data:await snapshot()});
  if(url.pathname==='/api/v2/capabilities'&&req.method==='GET'){await syncToolConnections();return json(res,200,{ok:true,adapters:registry.list(),runtime:{url:runtimeUrl,mode:'server-side'},chatgptConnectors:chatgptConnectorCatalog,note:'Backend الشركة ينفذ عبر محولاته. موصلات ChatGPT الشخصية تبقى في جلسة ChatGPT ولا تُعرض كأن التطبيق يملك صلاحيتها مباشرة.'});}
  if(url.pathname==='/api/v2/nav/context'&&req.method==='GET')return json(res,200,{ok:true,data:await navContext()});
  if(url.pathname==='/api/v2/nav/memory'&&req.method==='POST'){
    const b=await body(req),content=String(b.content||'').trim();if(!content)return json(res,400,{ok:false,error:'CONTENT_REQUIRED'});
    const importance=Math.max(1,Math.min(5,Number(b.importance||3)));const rows=await db.insert('hq_v2_nav_memory',{kind:String(b.kind||'note').slice(0,50),content:content.slice(0,4000),importance,source:'nav_app',metadata:{createdBy:'owner'}});broadcast('nav.memory.changed',{id:rows?.[0]?.id});return json(res,201,{ok:true,memory:rows?.[0]});
  }
  const memoryArchive=url.pathname.match(/^\/api\/v2\/nav\/memory\/([0-9a-f-]+)\/archive$/);
  if(memoryArchive&&req.method==='POST'){const rows=await db.update('hq_v2_nav_memory',`id=eq.${memoryArchive[1]}&active=eq.true`,{active:false,updated_at:new Date().toISOString()});if(!rows.length)return json(res,404,{ok:false,error:'MEMORY_NOT_FOUND'});broadcast('nav.memory.changed',{id:memoryArchive[1]});return json(res,200,{ok:true});}
  if(url.pathname==='/api/v2/nav/chat'&&req.method==='POST'){
    const b=await body(req),message=String(b.message||'').trim();if(!message)return json(res,400,{ok:false,error:'MESSAGE_REQUIRED'});
    const userRows=await db.insert('hq_v2_nav_messages',{role:'user',content:message.slice(0,8000),mode:isCompanyIntent(message)?'company':'personal',metadata:{source:'nav_web'}});
    if(isCompanyIntent(message)){
      const task=await createTask(message,req.headers['idempotency-key']);await db.insert('hq_v2_nav_messages',{role:'assistant',content:`حوّلت طلبك لمحرك الشركة الحقيقي. المهمة: ${task.title}`,mode:'company',task_id:task.id,metadata:{kind:'company_task'}});broadcast('task.created',task);setImmediate(()=>executeTask(task.id).then(()=>broadcast('state.changed',{taskId:task.id})).catch(error=>broadcast('task.error',{taskId:task.id,error:String(error.message||error)})));return json(res,202,{ok:true,kind:'company_task',task,userMessageId:userRows?.[0]?.id});
    }
    const handoff=connectorIntent(message);
    if(handoff){const text=`${handoff.provider} مربوط عندك داخل ChatGPT، لكن تطبيق ناڤ على الويب ما يملك OAuth الخاص بموصل ChatGPT. ما راح أدّعي تنفيذ شيء من هنا. افتح ناڤ داخل محادثة ChatGPT ونفّذ نفس الطلب هناك.`;await db.insert('hq_v2_nav_messages',{role:'assistant',content:text,mode:'personal',metadata:{kind:'chatgpt_handoff',provider:handoff.provider,prompt:message}});return json(res,200,{ok:true,kind:'chatgpt_handoff',provider:handoff.provider,prompt:message,text});}
    const [memories,recentDesc]=await Promise.all([db.list('hq_v2_nav_memory','active=eq.true&order=importance.desc,updated_at.desc&limit=20'),db.list('hq_v2_nav_messages','order=created_at.desc&limit=12')]);
    const reply=await navReply(message,memories,[...recentDesc].reverse());await db.insert('hq_v2_nav_messages',{role:'assistant',content:reply.text,mode:'personal',metadata:{kind:'gemini_chat',model:reply.model}});broadcast('nav.message',{role:'assistant'});return json(res,200,{ok:true,kind:'chat',text:reply.text,model:reply.model});
  }
  if(url.pathname==='/api/v2/tasks'&&req.method==='POST'){const b=await body(req);if(!String(b.command||'').trim())return json(res,400,{ok:false,error:'COMMAND_REQUIRED'});const task=await createTask(b.command,req.headers['idempotency-key']);broadcast('task.created',task);setImmediate(()=>executeTask(task.id).then(()=>broadcast('state.changed',{taskId:task.id})).catch(error=>broadcast('task.error',{taskId:task.id,error:String(error.message||error)})));return json(res,202,{ok:true,task});}
  const taskMatch=url.pathname.match(/^\/api\/v2\/tasks\/([0-9a-f-]+)$/);
  if(taskMatch&&req.method==='GET'){const task=await db.one('hq_v2_tasks',`id=eq.${taskMatch[1]}`);if(!task)return json(res,404,{ok:false,error:'TASK_NOT_FOUND'});const [events,evidence]=await Promise.all([db.list('hq_v2_task_events',`task_id=eq.${task.id}&order=created_at.asc`),db.list('hq_v2_task_evidence',`task_id=eq.${task.id}&order=verified_at.asc`)]);return json(res,200,{ok:true,task,events,evidence});}
  const approvalMatch=url.pathname.match(/^\/api\/v2\/approvals\/([0-9a-f-]+)\/(approve|reject)$/);
  if(approvalMatch&&req.method==='POST'){const status=approvalMatch[2]==='approve'?'APPROVED':'DECLINED';const rows=await db.update('hq_v2_approvals',`id=eq.${approvalMatch[1]}&status=eq.PENDING`,{status,resolved_at:new Date().toISOString()});if(!rows.length)return json(res,409,{ok:false,error:'APPROVAL_NOT_PENDING'});await db.update('hq_v2_tasks',`id=eq.${rows[0].task_id}`,{status:status==='APPROVED'?'QUEUED':'CANCELLED',updated_at:new Date().toISOString()},false);broadcast('state.changed',{approvalId:rows[0].id});return json(res,200,{ok:true,approval:rows[0]});}
  const connectionMatch=url.pathname.match(/^\/api\/v2\/connections\/([0-9a-f-]+)\/(approve|reject)$/);
  if(connectionMatch&&req.method==='POST'){const request=await db.one('hq_v2_connection_requests',`id=eq.${connectionMatch[1]}&status=in.(PENDING,APPROVED)`);if(!request)return json(res,409,{ok:false,error:'CONNECTION_REQUEST_NOT_PENDING'});if(connectionMatch[2]==='reject'){await db.update('hq_v2_connection_requests',`id=eq.${request.id}`,{status:'DECLINED',resolved_at:new Date().toISOString()},false);await db.update('hq_v2_tasks',`id=eq.${request.task_id}`,{status:'CANCELLED',updated_at:new Date().toISOString()},false);broadcast('state.changed',{connectionId:request.id});return json(res,200,{ok:true,status:'DECLINED'});}const adapter=request.provider==='github_private_repo'&&process.env.GITHUB_TOKEN?registry.get('github'):registry.resolve(request.provider);if(!adapter){await db.update('hq_v2_connection_requests',`id=eq.${request.id}`,{status:'APPROVED'},false);return json(res,202,{ok:true,status:'APPROVED',message:'الاتصال يحتاج إكمال OAuth أو إضافة المفتاح ثم إعادة المحاولة.'});}await db.update('hq_v2_connection_requests',`id=eq.${request.id}`,{status:'CONNECTED',resolved_at:new Date().toISOString()},false);await db.update('hq_v2_tasks',`id=eq.${request.task_id}`,{status:'QUEUED',updated_at:new Date().toISOString()},false);broadcast('state.changed',{connectionId:request.id});return json(res,200,{ok:true,status:'CONNECTED'});}
  if(url.pathname==='/api/v2/company-summary'&&req.method==='GET'){const data=await snapshot();return json(res,200,{ok:true,summary:{activeTasks:data.tasks.filter(t=>['WORKING','RESEARCHING','REVIEWING','ROUTING','PLANNING'].includes(t.status)).length,needsAttention:data.approvals.length+data.connections.length,completed:data.tasks.filter(t=>t.status==='COMPLETED').length,employeesWorking:data.employees.filter(e=>!['READY','OFFLINE'].includes(e.status)).length,truth:'هذه الأرقام من حالة Supabase الحالية فقط.'}});}
  return json(res,404,{ok:false,error:'NOT_FOUND'});
}

async function serve(res,url){let path=url.pathname==='/'?'/index.html':url.pathname;path=normalize(path).replace(/^(\.\.(\/|\\|$))+/, '');const file=join(ROOT,path);if(!file.startsWith(ROOT))return json(res,403,{error:'FORBIDDEN'});try{if(!(await stat(file)).isFile())throw new Error();const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600'});res.end(await readFile(file));}catch{json(res,404,{error:'NOT_FOUND'});}}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url);return await serve(res,url);}catch(error){console.error(JSON.stringify({level:'error',stage:'http',result:'failed',error:String(error.message||error)}));json(res,500,{ok:false,error:'INTERNAL_ERROR'});}});
server.listen(PORT,'0.0.0.0',()=>{console.log(JSON.stringify({level:'info',stage:'startup',result:'ready',port:PORT,dbConfigured:dbConfigured(),authConfigured:Boolean(accessToken)}));setImmediate(async()=>{try{await syncToolConnections();const processed=await processQueue();lastWorkerTick=new Date().toISOString();if(processed)broadcast('state.changed',{processed});}catch(error){console.error(JSON.stringify({level:'error',stage:'startup_sync',result:'failed',error:String(error.message||error)}));}});});

setInterval(async()=>{if(workerBusy||!dbConfigured())return;workerBusy=true;const started=Date.now();try{const processed=await processQueue();lastWorkerTick=new Date().toISOString();if(processed)broadcast('state.changed',{processed});console.log(JSON.stringify({level:'info',stage:'worker_tick',duration:Date.now()-started,result:'ok',processed}));}catch(error){console.error(JSON.stringify({level:'error',stage:'worker_tick',duration:Date.now()-started,result:'failed',error:String(error.message||error)}));}finally{workerBusy=false;}},15000).unref();
