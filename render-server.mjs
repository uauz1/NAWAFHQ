import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const dist=path.join(__dirname,'dist');
const PORT=Number(process.env.PORT||3000);
const AI_BACKEND=(process.env.NAWAF_AI_BACKEND_URL||'https://nawaf-hq-live-v2.onrender.com').replace(/\/$/,'');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
async function body(req){let raw='';for await(const chunk of req)raw+=chunk;if(!raw)return {};try{return JSON.parse(raw)}catch{return {}}}
function knowledge(t){return /فكر|فكرة|افكار|أفكار|اقترح|استكشف|حلل|تحليل|اكتب|صياغ|خطة|بحث|راجع المحتوى|تقرير|دراسة|مقارنة|اجتماع|مراجعة|اختبر|قيّم|قيم/.test(String(t?.title||t?.details||''))}
function external(t){return /اصلح|أصلح|عدل|عدّل|نفذ|نفّذ|انشر|اربط|ارفع|حذف|احذف|github|api|مستودع|repo|موقع|تطبيق|كود|برمج|deploy|vercel|supabase/.test(String(t?.title||t?.details||'').toLowerCase())}
function emp(s,id){return (s.employees||[]).find(e=>e.id===id)}
function proj(s,id){return (s.projects||[]).find(p=>p.id===id)}
function activity(s,text,type='REAL'){s.activity=Array.isArray(s.activity)?s.activity:[];s.activity.unshift({id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),text,type,at:new Date().toISOString()});s.activity=s.activity.slice(0,120)}
async function ai(task,state){
 const e=emp(state,task.employeeId),p=proj(state,task.projectId);
 const context={employee:e?{name:e.name,role:e.role,department:e.department}:null,project:p?{name:p.name,phase:p.phase,status:p.status,progress:p.progress}:null,task:{title:task.title,details:task.details||task.title,kind:task.kind||''},recentTasks:(state.tasks||[]).filter(x=>x.id!==task.id&&(!task.projectId||x.projectId===task.projectId)).slice(0,6).map(x=>({title:x.title,status:x.status,progress:x.progress})),recentReports:(state.reports||[]).filter(r=>!task.projectId||r.projectId===task.projectId).slice(0,4).map(r=>({title:r.title,content:String(r.content||'').slice(0,900)}))};
 const instruction=`نفذ هذه المهمة كموظف AI داخل NAWAF HQ. أرجع JSON فقط بهذه الحقول: status واحد من COMPLETE أو NEEDS_TOOL أو NEEDS_APPROVAL، summary، deliverable، evidence مصفوفة، nextActions مصفوفة، requiredTools مصفوفة، confidence. لا تدّع تنفيذ أداة خارجية لم تستخدمها. أي تغيير خارجي أو نشر أو تعديل مستودع يحتاج NEEDS_TOOL أو NEEDS_APPROVAL. المهمة: ${task.title}\nالتفاصيل: ${task.details||task.title}`;
 const r=await fetch(AI_BACKEND+'/api/agent/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userMessage:instruction,context}),signal:AbortSignal.timeout(45000)});
 const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||'AI_BACKEND_UNAVAILABLE');
 let out;try{out=JSON.parse(String(d.text||'').replace(/^```json\s*/i,'').replace(/```$/,'').trim())}catch{out={status:'COMPLETE',summary:'تم تنفيذ المهمة معرفيًا.',deliverable:String(d.text||''),evidence:[],nextActions:[],requiredTools:[],confidence:.75}}
 if(!['COMPLETE','NEEDS_TOOL','NEEDS_APPROVAL'].includes(out.status))out.status='NEEDS_APPROVAL';out.evidence=Array.isArray(out.evidence)?out.evidence:[];out.nextActions=Array.isArray(out.nextActions)?out.nextActions:[];out.requiredTools=Array.isArray(out.requiredTools)?out.requiredTools:[];return out;
}
async function processOne(state,id){
 const task=(state.tasks||[]).find(t=>t.id===id)|| (state.tasks||[]).find(t=>t.status==='READY');if(!task)return false;const e=emp(state,task.employeeId);delete task.blockedReason;task.status=knowledge(task)?(task.kind==='REVIEW'?'REVIEWING':'RESEARCHING'):'WORKING';task.progress=Math.max(10,Number(task.progress)||0);task.lastRunAt=new Date().toISOString();if(e){e.status=task.status;e.task=task.title}activity(state,(e?.name||'موظف AI')+' بدأ تنفيذ: '+task.title);
 const result=await ai(task,state);task.aiResult=result;task.lastRunAt=new Date().toISOString();task.evidence=Array.isArray(task.evidence)?task.evidence:[];for(const ev of result.evidence)if(ev)task.evidence.push({text:String(ev),at:new Date().toISOString(),type:'AI_EVIDENCE'});
 if(result.status==='COMPLETE'&&knowledge(task)&&!external(task)){task.status='COMPLETED';task.progress=100;if(e){e.status='READY';e.task=''}state.reports=Array.isArray(state.reports)?state.reports:[];state.reports.unshift({id:'r'+Date.now().toString(36),title:'تقرير: '+task.title,projectId:task.projectId||'',author:e?.name||'AI',stage:'محفوظ',content:[result.summary||'',result.deliverable||''].filter(Boolean).join('\n\n'),createdAt:new Date().toISOString()});activity(state,(e?.name||'موظف AI')+' أكمل المهمة: '+task.title)}else{task.status='WAITING_FOR_NAWAF';task.progress=Math.max(20,Number(task.progress)||0);task.blockedReason=result.summary||'تحتاج أداة أو موافقة';task.requiredTools=result.requiredTools;if(e)e.status='WAITING_FOR_NAWAF';activity(state,(e?.name||'موظف AI')+' ينتظر نواف في: '+task.title,result.status==='NEEDS_APPROVAL'?'APPROVAL':'REAL')}return true;
}
async function api(req,res,url){
 if(url.pathname==='/api/gemini'&&req.method==='GET'){try{const r=await fetch(AI_BACKEND+'/api/engine/status',{signal:AbortSignal.timeout(30000)});const d=await r.json();return json(res,200,{ok:true,provider:'gemini-bridge',configured:d?.gemini?.status==='CONNECTED',model:'backend-managed',secretExposed:false})}catch{return json(res,200,{ok:true,provider:'gemini-bridge',configured:false})}}
 if(url.pathname==='/api/worker'&&req.method==='POST'){try{const b=await body(req),state=b.state&&typeof b.state==='object'?b.state:{};if(!state.companyStarted)return json(res,200,{ok:true,processed:0,state,reason:'COMPANY_NOT_STARTED'});let n=0;const ids=b.batch?(Array.isArray(b.taskIds)?b.taskIds:[]).slice(0,3):[String(b.taskId||'')];for(const id of ids){try{if(await processOne(state,id))n++}catch(err){const t=(state.tasks||[]).find(x=>x.id===id);if(t){t.status='READY';t.progress=0;t.blockedReason=String(err.message||err);const e=emp(state,t.employeeId);if(e){e.status='READY';e.task=''}}}}return json(res,200,{ok:true,processed:n,state,cloudSaved:false,cloudWarning:'Render bridge uses local state fallback'})}catch(err){return json(res,500,{ok:false,error:String(err.message||err)})}}
 if(url.pathname==='/api/state')return json(res,503,{ok:false,error:'CLOUD_NOT_CONFIGURED_ON_RENDER_BRIDGE'});
 if(url.pathname==='/api/health')return json(res,200,{ok:true,service:'nawaf-hq-render',aiBackend:AI_BACKEND});
 return false;
}
async function serve(req,res,url){let rel=decodeURIComponent(url.pathname);if(rel==='/'||!path.extname(rel))rel=rel==='/'?'/index.html':rel;let target=path.normalize(path.join(dist,rel));if(!target.startsWith(dist))return json(res,403,{error:'FORBIDDEN'});try{let s=await stat(target);if(s.isDirectory())target=path.join(target,'index.html');const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':path.extname(target)==='.html'?'no-cache':'public, max-age=3600'});res.end(data)}catch{try{const data=await readFile(path.join(dist,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(data)}catch{json(res,404,{error:'NOT_FOUND'})}}
}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){const handled=await api(req,res,url);if(handled!==false)return}return serve(req,res,url)});
server.listen(PORT,'0.0.0.0',()=>console.log(`NAWAF HQ Render bridge listening on ${PORT}`));
