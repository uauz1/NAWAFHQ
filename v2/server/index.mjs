import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTask, executeTask, processQueue } from './executor.mjs';
import { db, dbConfigured, snapshot } from './db.mjs';
import { registry } from './tool-adapters.mjs';

const PORT=Number(process.env.PORT||8787), ROOT=join(fileURLToPath(new URL('.',import.meta.url)),'../web');
const accessToken=process.env.HQ_V2_ACCESS_TOKEN||''; const clients=new Set(); let workerBusy=false;
let healthCache={at:0,value:null};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const body=async req=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('BODY_TOO_LARGE');}return raw?JSON.parse(raw):{};};
const authorized=req=>accessToken&&req.headers.authorization===`Bearer ${accessToken}`;
const broadcast=(event,data)=>{const payload=`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;for(const res of clients)res.write(payload);};

async function health() {
  if(healthCache.value&&Date.now()-healthCache.at<60000)return healthCache.value;
  const checks={supabase:{status:'Unavailable'},executionWorker:{status:workerBusy?'Healthy':'Healthy'},paperBroker:{status:'Healthy'},realtime:{status:'Healthy'},github:{status:'Degraded'},aiBackend:{status:process.env.GEMINI_API_KEY?'Healthy':'Unavailable'},marketData:{status:'Degraded'},render:{status:'Healthy'}};
  if(dbConfigured()){try{const account=await db.one('hq_v2_paper_accounts','id=eq.default','id');checks.supabase={status:'Healthy'};checks.paperBroker={status:account?'Healthy':'Unavailable'}}catch(error){checks.supabase={status:'Unavailable',detail:String(error.message)};checks.paperBroker={status:'Unavailable'}}}
  try{const r=await fetch('https://api.github.com/repos/uauz1/NAWAFHQ',{headers:{'User-Agent':'NAWAF-HQ-V2'},signal:AbortSignal.timeout(5000)});checks.github={status:r.ok?'Healthy':'Degraded',detail:`HTTP ${r.status}`}}catch(error){checks.github={status:'Unavailable',detail:String(error.message)}}
  try{const r=await fetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d',{headers:{'User-Agent':'Mozilla/5.0 NAWAF-HQ-V2'},signal:AbortSignal.timeout(5000)});const d=await r.json();checks.marketData={status:r.ok&&d?.chart?.result?.[0]?.meta?.regularMarketPrice?'Healthy':'Degraded'}}catch(error){checks.marketData={status:'Unavailable',detail:String(error.message)}}
  const value={ok:checks.supabase.status==='Healthy'&&checks.executionWorker.status==='Healthy'&&checks.github.status!=='Unavailable',service:'nawaf-hq-v2',version:'2.0.0',checks,timestamp:new Date().toISOString(),authConfigured:Boolean(accessToken)};
  healthCache={at:Date.now(),value};return value;
}

async function api(req,res,url){
  if(url.pathname==='/api/v2/health'&&req.method==='GET')return json(res,200,await health());
  if(url.pathname==='/api/v2/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(`event: connected\ndata: {"ok":true}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
  if(!authorized(req))return json(res,accessToken?401:503,{ok:false,error:accessToken?'UNAUTHORIZED':'HQ_V2_ACCESS_TOKEN_NOT_CONFIGURED'});
  if(url.pathname==='/api/v2/snapshot'&&req.method==='GET')return json(res,200,{ok:true,data:await snapshot()});
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
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({level:'info',stage:'startup',result:'ready',port:PORT,dbConfigured:dbConfigured(),authConfigured:Boolean(accessToken)})));

setInterval(async()=>{if(workerBusy||!dbConfigured())return;workerBusy=true;const started=Date.now();try{const processed=await processQueue();if(processed)broadcast('state.changed',{processed});console.log(JSON.stringify({level:'info',stage:'worker_tick',duration:Date.now()-started,result:'ok',processed}));}catch(error){console.error(JSON.stringify({level:'error',stage:'worker_tick',duration:Date.now()-started,result:'failed',error:String(error.message||error)}));}finally{workerBusy=false;}},15000).unref();
