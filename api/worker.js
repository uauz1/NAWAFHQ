const MODEL=process.env.GEMINI_MODEL||'gemini-2.5-flash';
const sbUrl=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,''); const sbKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||'';
function send(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
async function sb(path,options={}){const r=await fetch(sbUrl()+'/rest/v1/'+path,{...options,headers:{apikey:sbKey(),Authorization:'Bearer '+sbKey(),'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error('SUPABASE_'+r.status);return d}
async function getState(){const r=await sb('hq_state?id=eq.main&select=data');return r?.[0]?.data||{}}
async function saveState(state){await sb('hq_state?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:'main',data:state,updated_at:new Date().toISOString()})})}
const knowledge=t=>/فكر|فكرة|افكار|أفكار|اقترح|استكشف|حلل|تحليل|اكتب|صياغ|خطة|بحث|راجع المحتوى|تقرير|دراسة|مقارنة/.test(String(t?.title||t?.details||''));
const external=t=>/اصلح|أصلح|عدل|عدّل|نفذ|نفّذ|انشر|اربط|ارفع|حذف|احذف|github|api|مستودع|repo|موقع|تطبيق|كود|برمج/.test(String(t?.title||t?.details||'').toLowerCase());
function activity(s,text,type='REAL'){s.activity=Array.isArray(s.activity)?s.activity:[];s.activity.unshift({id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),text,type,at:new Date().toISOString()});s.activity=s.activity.slice(0,120)}
function employee(s,id){return (s.employees||[]).find(e=>e.id===id)}
async function gemini(task,state){
 const e=employee(state,task.employeeId),p=(state.projects||[]).find(x=>x.id===task.projectId);
 const system='أنت موظف AI داخل NAWAF HQ. نفذ المهمة بجودة عالية. لا تدّعي تنفيذ شيء خارجي لم تنفذه. إذا كانت مهمة معرفية أنجزها بالكامل. إذا احتاجت أداة خارجية أرجع NEEDS_TOOL. لا تنشئ تكلفة أو التزام مالي. أرجع JSON فقط: status COMPLETE أو NEEDS_TOOL أو NEEDS_APPROVAL، summary، deliverable، evidence مصفوفة، nextActions مصفوفة، requiredTools مصفوفة، confidence.';
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(MODEL)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify({task:{title:task.title,details:task.details||task.title},employee:e?{name:e.name,role:e.role}:null,project:p?{name:p.name,phase:p.phase}:null})}]}],generationConfig:{temperature:.35,maxOutputTokens:1800,responseMimeType:'application/json'}})});
 const d=await r.json();if(!r.ok)throw new Error('GEMINI_'+r.status);const text=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();return JSON.parse(text||'{}')
}
async function processOne(state,preferredTaskId=''){
 const tasks=state.tasks||[];
 const task=(preferredTaskId&&tasks.find(t=>t.id===preferredTaskId&&t.status==='READY'))||tasks.find(t=>t.status==='READY');if(!task)return false;
 const e=employee(state,task.employeeId);task.status=knowledge(task)?'RESEARCHING':'WORKING';task.progress=Math.max(10,Number(task.progress)||0);task.lastRunAt=new Date().toISOString();if(e){e.status=task.status;e.task=task.title}activity(state,(e?.name||'موظف AI')+' بدأ تنفيذ: '+task.title);await saveState(state);
 let result;try{result=await gemini(task,state)}catch(err){task.status='READY';task.blockedReason='تعذر تشغيل AI مؤقتًا';if(e){e.status='READY';e.task=''}activity(state,'تعذر تشغيل المهمة مؤقتًا: '+task.title);await saveState(state);throw err}
 task.aiResult=result;task.lastRunAt=new Date().toISOString();task.evidence=Array.isArray(task.evidence)?task.evidence:[];
 for(const ev of (Array.isArray(result.evidence)?result.evidence:[]))if(ev)task.evidence.push({text:String(ev),at:new Date().toISOString(),type:'AI_EVIDENCE'});
 if(result.status==='COMPLETE'&&knowledge(task)&&!external(task)){task.status='COMPLETED';task.progress=100;if(e){e.status='READY';e.task=''}state.reports=Array.isArray(state.reports)?state.reports:[];state.reports.unshift({id:'r'+Date.now().toString(36),title:'تقرير: '+task.title,projectId:task.projectId||'',author:e?.name||'AI',stage:'محفوظ',content:[result.summary||'',result.deliverable||'',Array.isArray(result.nextActions)&&result.nextActions.length?'الخطوات التالية:\n- '+result.nextActions.join('\n- '):''].filter(Boolean).join('\n\n'),createdAt:new Date().toISOString()});activity(state,(e?.name||'موظف AI')+' أكمل المهمة: '+task.title)}
 else {task.status='WAITING_FOR_NAWAF';task.progress=Math.max(20,Number(task.progress)||0);task.blockedReason=result.summary||'تحتاج أداة أو موافقة';task.requiredTools=Array.isArray(result.requiredTools)?result.requiredTools:[];if(e)e.status='WAITING_FOR_NAWAF';activity(state,(e?.name||'موظف AI')+' ينتظر نواف في: '+task.title,result.status==='NEEDS_APPROVAL'?'APPROVAL':'REAL')}
 await saveState(state);return true
}
function sameOrigin(req){try{const origin=String(req.headers.origin||'');if(!origin)return true;const host=String(req.headers['x-forwarded-host']||req.headers.host||'');return new URL(origin).host===host}catch{return false}}
export default async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 if(!sbUrl()||!sbKey()||!process.env.GEMINI_API_KEY)return send(res,503,{ok:false,error:'WORKER_NOT_CONFIGURED'});
 if(req.method==='GET'&&process.env.CRON_SECRET&&req.headers.authorization!==('Bearer '+process.env.CRON_SECRET))return send(res,401,{ok:false,error:'UNAUTHORIZED'});
 if(req.method==='POST'&&!sameOrigin(req))return send(res,403,{ok:false,error:'FORBIDDEN_ORIGIN'});
 try{
  const body=req.method==='POST'?(typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{})):{};
  const preferredTaskId=String(body.taskId||'');
  let state=await getState();if(!state.companyStarted)return send(res,200,{ok:true,processed:0,reason:'COMPANY_NOT_STARTED'});
  let n=0;for(let i=0;i<3;i++){if(!(await processOne(state,i===0?preferredTaskId:'')))break;n++;state=await getState()}
  return send(res,200,{ok:true,processed:n})
 }catch(e){console.error('worker',e?.message||e);return send(res,500,{ok:false,error:'WORKER_ERROR'})}
}