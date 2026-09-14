const FALLBACK_MODELS=[process.env.GEMINI_MODEL,'gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite','gemini-2.5-flash'].filter((v,i,a)=>v&&a.indexOf(v)===i);
const sbUrl=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const sbKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||'';
function send(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function cloudConfigured(){return !!(sbUrl()&&sbKey())}
async function sb(path,options={}){const r=await fetch(sbUrl()+'/rest/v1/'+path,{...options,headers:{apikey:sbKey(),Authorization:'Bearer '+sbKey(),'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error('SUPABASE_'+r.status+':'+String(d?.message||d?.hint||d?.code||d||'').slice(0,140));return d}
async function getCloudState(){const r=await sb('hq_state?id=eq.main&select=data');return r?.[0]?.data||null}
async function saveCloudState(state){await sb('hq_state?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:'main',data:state,updated_at:new Date().toISOString()})})}
const knowledge=t=>/فكر|فكرة|افكار|أفكار|اقترح|استكشف|حلل|تحليل|اكتب|صياغ|خطة|بحث|راجع المحتوى|تقرير|دراسة|مقارنة/.test(String(t?.title||t?.details||''));
const external=t=>/اصلح|أصلح|عدل|عدّل|نفذ|نفّذ|انشر|اربط|ارفع|حذف|احذف|github|api|مستودع|repo|موقع|تطبيق|كود|برمج/.test(String(t?.title||t?.details||'').toLowerCase());
function activity(s,text,type='REAL'){s.activity=Array.isArray(s.activity)?s.activity:[];s.activity.unshift({id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),text,type,at:new Date().toISOString()});s.activity=s.activity.slice(0,120)}
function employee(s,id){return (s.employees||[]).find(e=>e.id===id)}
async function availableModels(){
 try{
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return FALLBACK_MODELS;
  const found=(d.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>String(m.name||'').replace(/^models\//,'')).filter(n=>/gemini/i.test(n)&&!/image|vision|live|tts|audio|embedding|computer|research/i.test(n));
  found.sort((a,b)=>{const score=n=>(/flash-lite/.test(n)?0:/flash/.test(n)?1:/pro/.test(n)?3:2)+(/preview|exp|latest/.test(n)?2:0);return score(a)-score(b)});
  return [...new Set([...found,...FALLBACK_MODELS])];
 }catch{return FALLBACK_MODELS}
}
async function gemini(task,state){
 const e=employee(state,task.employeeId),p=(state.projects||[]).find(x=>x.id===task.projectId);
 const system='أنت موظف AI داخل NAWAF HQ. نفذ المهمة بجودة عالية. لا تدّعي تنفيذ شيء خارجي لم تنفذه. إذا كانت مهمة معرفية أنجزها بالكامل. إذا احتاجت أداة خارجية أرجع NEEDS_TOOL. لا تنشئ تكلفة أو التزام مالي. أرجع JSON فقط بهذه الحقول: status واحد من COMPLETE أو NEEDS_TOOL أو NEEDS_APPROVAL، summary، deliverable، evidence مصفوفة، nextActions مصفوفة، requiredTools مصفوفة، confidence.';
 const payload={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify({task:{title:task.title,details:task.details||task.title},employee:e?{name:e.name,role:e.role}:null,project:p?{name:p.name,phase:p.phase}:null})}]}],generationConfig:{temperature:.35,maxOutputTokens:1800,responseMimeType:'application/json'}};
 let last='GEMINI_UNAVAILABLE',deadline=Date.now()+30000;
 const models=await availableModels();
 for(const model of models){
  for(let attempt=0;attempt<2&&Date.now()<deadline;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1000,Math.min(9000,deadline-Date.now())));
   try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify(payload),signal:controller.signal});
    const d=await r.json().catch(()=>({}));
    if(r.ok){const text=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!text)throw new Error('GEMINI_EMPTY_RESPONSE');try{return JSON.parse(text)}catch{throw new Error('GEMINI_INVALID_JSON')}}
    last='GEMINI_'+r.status+':'+String(d?.error?.status||d?.error?.message||'UNKNOWN').slice(0,140);
    if(![429,500,502,503,504].includes(r.status))break;
   }catch(err){last=err?.name==='AbortError'?'GEMINI_TIMEOUT':String(err?.message||err)}
   finally{clearTimeout(timer)}
   await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
 }
 throw new Error(last);
}
function recoverStale(state){const now=Date.now();for(const t of (state.tasks||[])){if(['WORKING','RESEARCHING','REVIEWING'].includes(t.status)&&now-Date.parse(t.lastRunAt||0)>90000){t.status='READY';t.progress=0;delete t.blockedReason;const e=employee(state,t.employeeId);if(e){e.status='READY';e.task=''}}}}
async function processOne(state,taskId=''){const tasks=state.tasks||[];const task=(taskId&&tasks.find(t=>t.id===taskId))||tasks.find(t=>t.status==='READY');if(!task)return false;task.status='READY';delete task.blockedReason;delete task.aiResult;const e=employee(state,task.employeeId);task.status=knowledge(task)?'RESEARCHING':'WORKING';task.progress=Math.max(10,Number(task.progress)||0);task.lastRunAt=new Date().toISOString();if(e){e.status=task.status;e.task=task.title}activity(state,(e?.name||'موظف AI')+' بدأ تنفيذ: '+task.title);let result;try{result=await gemini(task,state)}catch(err){task.status='READY';task.blockedReason=String(err?.message||err);if(e){e.status='READY';e.task=''}activity(state,'تعذر تشغيل المهمة: '+task.title+' — '+task.blockedReason);throw err}task.aiResult=result;task.lastRunAt=new Date().toISOString();task.evidence=Array.isArray(task.evidence)?task.evidence:[];for(const ev of (Array.isArray(result.evidence)?result.evidence:[]))if(ev)task.evidence.push({text:String(ev),at:new Date().toISOString(),type:'AI_EVIDENCE'});if(result.status==='COMPLETE'&&knowledge(task)&&!external(task)){task.status='COMPLETED';task.progress=100;if(e){e.status='READY';e.task=''}state.reports=Array.isArray(state.reports)?state.reports:[];state.reports.unshift({id:'r'+Date.now().toString(36),title:'تقرير: '+task.title,projectId:task.projectId||'',author:e?.name||'AI',stage:'محفوظ',content:[result.summary||'',result.deliverable||'',Array.isArray(result.nextActions)&&result.nextActions.length?'الخطوات التالية:\n- '+result.nextActions.join('\n- '):''].filter(Boolean).join('\n\n'),createdAt:new Date().toISOString()});activity(state,(e?.name||'موظف AI')+' أكمل المهمة: '+task.title)}else{task.status='WAITING_FOR_NAWAF';task.progress=Math.max(20,Number(task.progress)||0);task.blockedReason=result.summary||'تحتاج أداة أو موافقة';task.requiredTools=Array.isArray(result.requiredTools)?result.requiredTools:[];if(e)e.status='WAITING_FOR_NAWAF';activity(state,(e?.name||'موظف AI')+' ينتظر نواف في: '+task.title,result.status==='NEEDS_APPROVAL'?'APPROVAL':'REAL')}return true}
function sameOrigin(req){try{const origin=String(req.headers.origin||'');if(!origin)return true;const host=String(req.headers['x-forwarded-host']||req.headers.host||'');return new URL(origin).host===host}catch{return false}}
export default async function handler(req,res){if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});if(!process.env.GEMINI_API_KEY)return send(res,503,{ok:false,error:'GEMINI_KEY_MISSING'});if(req.method==='POST'&&!sameOrigin(req))return send(res,403,{ok:false,error:'FORBIDDEN_ORIGIN'});try{const body=req.method==='POST'?(typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{})):{};let state=null;let cloudWarning='';if(cloudConfigured()){try{state=await getCloudState()}catch(e){cloudWarning=String(e?.message||e)}}if(!state&&body.state&&typeof body.state==='object')state=body.state;if(!state)return send(res,503,{ok:false,error:'NO_STATE_AVAILABLE',detail:cloudWarning||'Cloud state unavailable and client state missing'});recoverStale(state);if(!state.companyStarted)return send(res,200,{ok:true,processed:0,state,reason:'COMPANY_NOT_STARTED',cloudWarning});let n=0;if(req.method==='POST'&&body.batch){const ids=(state.tasks||[]).filter(t=>t.status==='READY').slice(0,3).map(t=>t.id);const settled=await Promise.allSettled(ids.map(id=>processOne(state,id)));n=settled.filter(x=>x.status==='fulfilled'&&x.value).length}else{for(let i=0;i<(req.method==='POST'?1:3);i++){if(!(await processOne(state,i===0?String(body.taskId||''):'')))break;n++}}if(cloudConfigured()){try{await saveCloudState(state)}catch(e){cloudWarning=String(e?.message||e)}}return send(res,200,{ok:true,processed:n,state,cloudSaved:!cloudWarning,cloudWarning})}catch(e){const detail=String(e?.message||e||'UNKNOWN').slice(0,220);console.error('worker',detail);return send(res,500,{ok:false,error:detail})}}
