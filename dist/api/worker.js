const FALLBACK_MODELS=[process.env.GEMINI_MODEL,'gemini-2.5-flash-lite','gemini-2.5-flash'].filter((v,i,a)=>v&&a.indexOf(v)===i);
const sbUrl=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const sbKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||'';
function send(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))}
function cloudConfigured(){return !!(sbUrl()&&sbKey())}
async function sb(path,options={}){const r=await fetch(sbUrl()+'/rest/v1/'+path,{...options,headers:{apikey:sbKey(),Authorization:'Bearer '+sbKey(),'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error('SUPABASE_'+r.status+':'+String(d?.message||d?.hint||d?.code||d||'').slice(0,140));return d}
async function getCloudState(){const r=await sb('hq_state?id=eq.main&select=data');return r?.[0]?.data||null}
async function saveCloudState(state){await sb('hq_state?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:'main',data:state,updated_at:new Date().toISOString()})})}
const knowledge=t=>/فكر|فكرة|افكار|أفكار|اقترح|استكشف|حلل|تحليل|اكتب|صياغ|خطة|بحث|راجع المحتوى|تقرير|دراسة|مقارنة|اجتماع|مراجعة|اختبر|قيّم|قيم/.test(String(t?.title||t?.details||''));
const external=t=>/اصلح|أصلح|عدل|عدّل|نفذ|نفّذ|انشر|اربط|ارفع|حذف|احذف|github|api|مستودع|repo|موقع|تطبيق|كود|برمج|deploy|vercel|supabase/.test(String(t?.title||t?.details||'').toLowerCase());
function activity(s,text,type='REAL'){s.activity=Array.isArray(s.activity)?s.activity:[];s.activity.unshift({id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),text,type,at:new Date().toISOString()});s.activity=s.activity.slice(0,120)}
function employee(s,id){return (s.employees||[]).find(e=>e.id===id)}
function project(s,id){return (s.projects||[]).find(p=>p.id===id)}
function textResult(t){const r=t?.aiResult||{};return String(r.summary||r.deliverable||'').trim()}
function projectContext(state,task){
 const p=project(state,task.projectId);
 const relatedTasks=(state.tasks||[]).filter(t=>t.id!==task.id&&(!task.projectId||t.projectId===task.projectId)).slice(0,8).map(t=>({title:t.title,status:t.status,progress:Number(t.progress)||0,result:textResult(t).slice(0,700)}));
 const relatedReports=(state.reports||[]).filter(r=>!task.projectId||r.projectId===task.projectId).slice(0,5).map(r=>({title:r.title,stage:r.stage||'',content:String(r.content||'').slice(0,1200)}));
 return {project:p?{name:p.name,phase:p.phase,status:p.status,progress:Number(p.progress)||0}:null,relatedTasks,relatedReports};
}
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
 const e=employee(state,task.employeeId),ctx=projectContext(state,task);
 const system=`أنت موظف AI حقيقي داخل NAWAF HQ، شركة يديرها نواف. تصرف كمتخصص في دورك المحدد، وليس كمساعد عام. نفذ المهمة بأعلى جودة ممكنة باستخدام البيانات المتاحة فقط. اربط إجابتك بحالة المشروع والمهام والتقارير السابقة عند وجودها. لا تدّعي أنك فتحت موقعًا أو عدلت GitHub أو نشرت أو استخدمت أداة خارجية ما لم تُنفذ فعلاً بواسطة النظام. إذا كانت المهمة معرفية أو تحليلية أو كتابية فأنجزها كاملة الآن وقدّم مخرجًا قابلًا للاستخدام. إذا كانت تحتاج أداة خارجية غير متاحة فارجع NEEDS_TOOL وحدد الأداة والخطوة المطلوبة بدقة. إذا كانت تحتاج قرار نواف أو قد تنشئ تكلفة/التزامًا أو تغيّر شيئًا حساسًا فارجع NEEDS_APPROVAL. ممنوع إنشاء أي تكلفة أو التزام مالي. لا تعطِ كلامًا عامًا؛ أعطِ نتيجة عملية. أرجع JSON فقط بهذه الحقول: status واحد من COMPLETE أو NEEDS_TOOL أو NEEDS_APPROVAL، summary، deliverable، evidence مصفوفة، nextActions مصفوفة، requiredTools مصفوفة، confidence رقم من 0 إلى 1.`;
 const payload={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify({task:{title:task.title,details:task.details||task.title,kind:task.kind||''},employee:e?{name:e.name,role:e.role,department:e.department}:null,context:ctx})}]}],generationConfig:{temperature:.3,maxOutputTokens:2200,responseMimeType:'application/json'}};
 let last='GEMINI_UNAVAILABLE',deadline=Date.now()+30000;
 const models=await availableModels();
 for(const model of models){
  for(let attempt=0;attempt<2&&Date.now()<deadline;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1000,Math.min(9000,deadline-Date.now())));
   try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify(payload),signal:controller.signal});
    const d=await r.json().catch(()=>({}));
    if(r.ok){const text=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!text)throw new Error('GEMINI_EMPTY_RESPONSE');let out;try{out=JSON.parse(text)}catch{throw new Error('GEMINI_INVALID_JSON')}if(!['COMPLETE','NEEDS_TOOL','NEEDS_APPROVAL'].includes(out?.status))out.status='NEEDS_APPROVAL';out.requiredTools=Array.isArray(out.requiredTools)?out.requiredTools:[];out.evidence=Array.isArray(out.evidence)?out.evidence:[];out.nextActions=Array.isArray(out.nextActions)?out.nextActions:[];return out}
    last='GEMINI_'+r.status+':'+String(d?.error?.status||d?.error?.message||'UNKNOWN').slice(0,140);
    if(![429,500,502,503,504].includes(r.status))break;
   }catch(err){last=err?.name==='AbortError'?'GEMINI_TIMEOUT':String(err?.message||err)}finally{clearTimeout(timer)}
   await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
 }
 throw new Error(last);
}
function recoverStale(state){const now=Date.now();for(const t of (state.tasks||[])){if(['WORKING','RESEARCHING','REVIEWING'].includes(t.status)&&now-Date.parse(t.lastRunAt||0)>90000){t.status='READY';t.progress=0;delete t.blockedReason;const e=employee(state,t.employeeId);if(e){e.status='READY';e.task=''}}}}
function reportFromResult(state,task,e,result){state.reports=Array.isArray(state.reports)?state.reports:[];state.reports.unshift({id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),title:(task.kind==='MEETING'?'محضر: ':task.kind==='REVIEW'?'مراجعة: ':'تقرير: ')+task.title,projectId:task.projectId||'',author:e?.name||'AI',stage:task.kind==='MEETING'?'اجتماع تنفيذي':task.kind==='REVIEW'?'مراجعة جودة':'محفوظ',content:[result.summary||'',result.deliverable||'',result.nextActions?.length?'الخطوات التالية:\n- '+result.nextActions.join('\n- '):''].filter(Boolean).join('\n\n'),sourceTaskId:task.id,createdAt:new Date().toISOString()});state.reports=state.reports.slice(0,120)}
async function processOne(state,taskId=''){
 const tasks=state.tasks||[],task=(taskId&&tasks.find(t=>t.id===taskId))||tasks.find(t=>t.status==='READY');if(!task)return false;
 delete task.blockedReason;delete task.aiResult;const e=employee(state,task.employeeId);task.status=knowledge(task)?(task.kind==='REVIEW'?'REVIEWING':'RESEARCHING'):'WORKING';task.progress=Math.max(10,Number(task.progress)||0);task.lastRunAt=new Date().toISOString();if(e){e.status=task.status;e.task=task.title}activity(state,(e?.name||'موظف AI')+' بدأ تنفيذ: '+task.title);
 let result;try{result=await gemini(task,state)}catch(err){task.status='READY';task.progress=0;task.blockedReason=String(err?.message||err);if(e){e.status='READY';e.task=''}activity(state,'تعذر تشغيل المهمة: '+task.title+' — '+task.blockedReason);throw err}
 task.aiResult=result;task.lastRunAt=new Date().toISOString();task.evidence=Array.isArray(task.evidence)?task.evidence:[];for(const ev of result.evidence)if(ev)task.evidence.push({text:String(ev),at:new Date().toISOString(),type:'AI_EVIDENCE'});task.evidence=task.evidence.slice(-50);
 const canComplete=result.status==='COMPLETE'&&knowledge(task)&&!external(task);
 if(canComplete){task.status='COMPLETED';task.progress=100;if(e){e.status='READY';e.task=''}reportFromResult(state,task,e,result);activity(state,(e?.name||'موظف AI')+' أكمل المهمة: '+task.title)}else{task.status='WAITING_FOR_NAWAF';task.progress=Math.max(20,Number(task.progress)||0);task.blockedReason=result.summary||'تحتاج أداة أو موافقة';task.requiredTools=result.requiredTools;if(e)e.status='WAITING_FOR_NAWAF';activity(state,(e?.name||'موظف AI')+' ينتظر نواف في: '+task.title,result.status==='NEEDS_APPROVAL'?'APPROVAL':'REAL')}
 return true;
}
function sameOrigin(req){try{const origin=String(req.headers.origin||'');if(!origin)return true;const host=String(req.headers['x-forwarded-host']||req.headers.host||'');return new URL(origin).host===host}catch{return false}}
export default async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 if(req.method==='GET')return send(res,200,{ok:true,service:'worker',configured:Boolean(process.env.GEMINI_API_KEY),cloudConfigured:cloudConfigured()});
 if(!process.env.GEMINI_API_KEY)return send(res,503,{ok:false,error:'GEMINI_KEY_MISSING'});
 if(!sameOrigin(req))return send(res,403,{ok:false,error:'FORBIDDEN_ORIGIN'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});let state=null,cloudWarning='';
  if(cloudConfigured()){try{state=await getCloudState()}catch(e){cloudWarning=String(e?.message||e)}}
  if(!state&&body.state&&typeof body.state==='object')state=body.state;
  if(!state)return send(res,503,{ok:false,error:'NO_STATE_AVAILABLE',detail:cloudWarning||'Cloud state unavailable and client state missing'});
  recoverStale(state);if(!state.companyStarted)return send(res,200,{ok:true,processed:0,state,reason:'COMPANY_NOT_STARTED',cloudWarning});
  let n=0;
  if(body.batch){const requested=Array.isArray(body.taskIds)?body.taskIds.map(String):[];const ids=(requested.length?requested:(state.tasks||[]).filter(t=>t.status==='READY').map(t=>t.id)).slice(0,3);for(const id of ids){try{if(await processOne(state,id))n++}catch(e){cloudWarning=cloudWarning||String(e?.message||e)}}}
  else if(await processOne(state,String(body.taskId||'')))n=1;
  if(cloudConfigured()){try{await saveCloudState(state)}catch(e){cloudWarning=String(e?.message||e)}}
  return send(res,200,{ok:true,processed:n,state,cloudSaved:cloudConfigured()&&!cloudWarning,cloudWarning});
 }catch(e){const detail=String(e?.message||e||'UNKNOWN').slice(0,220);console.error('worker',detail);return send(res,500,{ok:false,error:detail})}
}
