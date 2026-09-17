import { AdapterRegistry } from '../core/adapters.mjs';
import { executePaperOrder } from '../core/paper-broker.mjs';

const token = process.env.GITHUB_TOKEN || '';
const geminiKey = process.env.GEMINI_API_KEY || '';
const runtimeUrl = (process.env.OPENHANDS_RUNTIME_URL || 'https://nawaf-hq-crewai-runtime.onrender.com').replace(/\/$/, '');
const repos = {qaddha:{slug:'uauz1/game',live:'https://qaddha.vercel.app/'},mueen:{slug:'uauz1/mueen-islamic-app',live:'https://mueen-islamic-app.vercel.app/'}};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'NAWAF-HQ-V2',...(token?{Authorization:`Bearer ${token}`}:{})}});
  const data = await response.json();
  if (!response.ok) { const error=new Error(`GITHUB_${response.status}:${data?.message || 'error'}`); error.status=response.status; throw error; }
  return data;
}

async function runtimeRequest(path, body, timeout=300000) {
  if (!geminiKey) throw new Error('MISSING_CONNECTION:GEMINI_API_KEY');
  if (!token) throw new Error('MISSING_CONNECTION:GITHUB_TOKEN');
  const response = await fetch(`${runtimeUrl}${path}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Gemini-Key':geminiKey,'X-GitHub-Token':token},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(timeout)
  });
  const raw=await response.text(); let data={};
  try{data=raw?JSON.parse(raw):{}}catch{}
  if(!response.ok||data?.ok===false){const error=new Error(`RUNTIME_${response.status}:${data?.error||data?.detail||raw.slice(0,500)||'execution failed'}`);error.status=response.status;throw error;}
  return data;
}

const projectExecutionAdapter = {
  id:'project_executor',provider:'OpenHands + GitHub',capabilities:['project_execution'],
  connectionState:()=> geminiKey&&token?'CONNECTED':'DISCONNECTED',
  health:()=> geminiKey&&token?'HEALTHY':'UNAVAILABLE',
  async execute({task}) {
    const project=repos[task.project_id],repo=project?.slug;
    if(!repo)throw new Error('MISSING_CONNECTION:PROJECT_REPOSITORY');
    const repoUrl=`https://github.com/${repo}`;
    const execution=await runtimeRequest('/api/execute',{
      action:'modify_code',
      params:{instruction:task.command,objective:task.command,taskTitle:task.title,repoUrl}
    });
    const output=execution?.output||{};
    const checks=Array.isArray(output.checks)?output.checks:[];
    const evidence=[{
      kind:'CODE_EXECUTION',
      label:`OpenHands ${output.hasChanges?'produced changes':'produced no changes'}`,
      uri:repoUrl,
      data:{engine:execution.engine||'openhands-sdk',baseCommit:output.baseCommit||null,changedFiles:output.changedFiles||[],verificationPassed:Boolean(output.verificationPassed),checks,durationMs:execution.durationMs||null}
    }];
    if(!output.hasChanges){return {summary:'محرك التنفيذ فحص المستودع لكنه لم ينتج أي تغيير في الملفات. لم يتم ادعاء إصلاح غير موجود.',validated:false,evidence};}
    if(!output.verificationPassed){return {summary:`تم إنشاء تغييرات فعلية في ${output.changedFiles?.length||0} ملف، لكن التحقق لم ينجح بالكامل؛ لم يتم دفع أي Commit.`,validated:false,evidence};}
    if(!output.diff||!output.baseCommit)throw new Error('VALIDATION:MISSING_VERIFIED_DIFF');
    const applied=await runtimeRequest('/api/apply',{
      repository:output.repository||repoUrl,
      baseCommit:output.baseCommit,
      diff:output.diff,
      commitMessage:`NAWAF HQ: ${String(task.title||task.command).slice(0,120)}`
    },300000);
    if(applied?.status!=='APPLIED'||!applied?.commitSha)throw new Error(`VALIDATION:APPLY_NOT_CONFIRMED:${applied?.status||'unknown'}`);
    evidence.push({kind:'GITHUB_COMMIT',label:`Applied ${applied.commitSha.slice(0,7)}`,uri:`${repoUrl}/commit/${applied.commitSha}`,data:{sha:applied.commitSha,changedFiles:applied.changedFiles||output.changedFiles||[],checks:applied.checks||checks,source:'OpenHands verified apply'}});
    let deployStatus=null;
    try{const live=await fetch(project.live,{redirect:'follow',signal:AbortSignal.timeout(15000)});deployStatus=live.status;evidence.push({kind:'DEPLOYMENT_CHECK',label:`HTTP ${live.status} ${new URL(live.url).hostname}`,uri:live.url,data:{status:live.status,checkedAt:new Date().toISOString(),note:'Availability check immediately after commit; it does not claim the new commit has finished deploying.'}});}catch(error){evidence.push({kind:'DEPLOYMENT_CHECK',label:'Live URL check unavailable',uri:project.live,data:{error:String(error.message||error),checkedAt:new Date().toISOString()}});}
    return {summary:`تم تنفيذ التعديل فعليًا على ${repo}: عُدلت ${applied.changedFiles?.length||output.changedFiles?.length||0} ملفات، نجحت فحوصات التنفيذ، وتم دفع Commit ${applied.commitSha.slice(0,7)} إلى GitHub.${deployStatus?` فحص الرابط الحالي أعاد HTTP ${deployStatus}؛ لا نعتبر النشر الجديد مكتملًا بدون دليل نشر مستقل.`:''}`,validated:true,evidence};
  }
};

const githubAdapter = {
  id:'github',provider:'GitHub',capabilities:['repository_status','qa'],
  connectionState:()=> 'CONNECTED', health:()=> 'HEALTHY',
  async execute({task}) {
    const project = repos[task.project_id], repo=project?.slug;
    if (!repo) throw new Error('MISSING_CONNECTION:PROJECT_REPOSITORY');
    const livePromise=fetch(project.live,{redirect:'follow',signal:AbortSignal.timeout(15000)});
    let commit=null,apiError=null;
    try{const commits=await github(`/repos/${repo}/commits?per_page=1`);commit={sha:commits[0]?.sha,title:commits[0]?.commit?.message,updated:commits[0]?.commit?.committer?.date,uri:commits[0]?.html_url,source:'GitHub API'}}catch(error){apiError=String(error.message||error);const feed=await fetch(`https://github.com/${repo}/commits/main.atom`,{signal:AbortSignal.timeout(10000)});const xml=await feed.text();if(!feed.ok){const liveResponse=await livePromise;const connectionError=new Error('MISSING_CONNECTION:GITHUB_PRIVATE_REPOSITORY');connectionError.requiredProvider='github_private_repo';connectionError.evidence=[{kind:'DEPLOYMENT_CHECK',label:`HTTP ${liveResponse.status} ${new URL(liveResponse.url).hostname}`,uri:liveResponse.url,data:{status:liveResponse.status,checkedAt:new Date().toISOString(),repositoryAccess:'missing'}}];throw connectionError;}commit={sha:xml.match(/\/commit\/([0-9a-f]{7,40})/)?.[1],title:xml.match(/<title>\s*([\s\S]*?)\s*<\/title>/g)?.[1]?.replace(/<\/?title>/g,'').trim(),updated:xml.match(/<updated>(.*?)<\/updated>/)?.[1],uri:xml.match(/<link[^>]+href="([^"]+\/commit\/[0-9a-f]+)"/)?.[1],source:'GitHub Atom feed'}}
    const liveResponse=await livePromise;
    const evidence = [
      {kind:'GITHUB_COMMIT',label:`${commit?.sha?.slice(0,7)||'commit'} ${commit?.title||''}`,uri:commit?.uri||`https://github.com/${repo}/commits/main`,data:{sha:commit?.sha,date:commit?.updated,source:commit?.source,apiFallbackReason:apiError}},
      {kind:'DEPLOYMENT_CHECK',label:`HTTP ${liveResponse.status} ${new URL(liveResponse.url).hostname}`,uri:liveResponse.url,data:{status:liveResponse.status,checkedAt:new Date().toISOString()}}
    ];
    const deploymentVerified=liveResponse.ok;
    return {summary:deploymentVerified?`تم التحقق من آخر Commit وفحص النسخة المنشورة: الرابط استجاب HTTP ${liveResponse.status}. هذا يثبت أن البناء المنشور متاح، ولا يدّعي وجود CI ناجح بدون دليل مستقل.`:`تم فحص المستودع لكن النسخة المنشورة أعادت HTTP ${liveResponse.status}.`,evidence,validated:deploymentVerified};
  }
};

const marketData = {
  async quote(symbol) {
    if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
      const r=await fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_SECRET_KEY}});
      const d=await r.json(); if(r.ok&&d?.trade?.p)return {symbol,price:Number(d.trade.p),timestamp:d.trade.t,source:'Alpaca Market Data',uri:`https://app.alpaca.markets/stocks/${symbol}`};
    }
    const code = symbol === '2222' ? '2222.SR' : symbol.toUpperCase();
    const uri=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}?interval=1d&range=5d`;
    const r=await fetch(uri,{headers:{'User-Agent':'Mozilla/5.0 NAWAF-HQ-V2'},signal:AbortSignal.timeout(25000)}); const d=await r.json();const meta=d?.chart?.result?.[0]?.meta;
    const price=Number(meta?.regularMarketPrice); if(!r.ok||!price)throw new Error('TEMPORARY_MARKET_DATA_UNAVAILABLE');
    return {symbol:code,price,currency:meta.currency,exchange:meta.exchangeName,timestamp:new Date(Number(meta.regularMarketTime)*1000).toISOString(),source:'Yahoo Finance Chart',uri};
  }
};

const marketAdapter = {id:'market_data',provider:'Market Data',capabilities:['finance_analysis'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',async execute({task}){
  const symbol=/[اأإآ]رامكو/.test(task.command)?'2222':task.command.toUpperCase().match(/\b[A-Z]{1,5}\b/)?.[0];
  if(!symbol)throw new Error('VALIDATION:TICKER_REQUIRED'); const quote=await marketData.quote(symbol);
  return {summary:`السعر المتحقق لـ ${symbol}: ${quote.price}. التحليل المالي الكامل يحتاج بيانات أساسيات إضافية؛ لم يتم اختلاق أي تقديرات.`,validated:true,evidence:[{kind:'MARKET_QUOTE',label:`${symbol} @ ${quote.price}`,uri:quote.uri,data:quote}]};
}};

const paperAdapter = {id:'paper_broker',provider:'Internal Paper Broker',capabilities:['paper_trade'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',execute:ctx=>executePaperOrder({...ctx,marketData})};

const companyAdapter = {id:'company_state',provider:'NAWAF HQ State',capabilities:['company_state'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',async execute({db}){
  const [tasks,employees,approvals,connections]=await Promise.all([db.list('hq_v2_tasks','order=created_at.desc&limit=100'),db.list('hq_v2_employees'),db.list('hq_v2_approvals','status=eq.PENDING'),db.list('hq_v2_connection_requests','status=eq.PENDING')]);
  const active=tasks.filter(t=>['ROUTING','PLANNING','WORKING','RESEARCHING','REVIEWING'].includes(t.status));
  const summary=`الشركة الآن: ${active.length} مهام نشطة، ${employees.filter(e=>e.status!=='READY').length} موظفين يعملون، ${approvals.length} موافقات و${connections.length} طلبات ربط تحتاج انتباه. الأرقام من Supabase وقت التنفيذ.`;
  return {summary,validated:true,evidence:[{kind:'COMPANY_STATE',label:'Supabase current state',data:{activeTasks:active.length,workingEmployees:employees.filter(e=>e.status!=='READY').length,pendingApprovals:approvals.length,pendingConnections:connections.length,checkedAt:new Date().toISOString()}}]};
}};

const businessAdapter = {id:'business',provider:'NAWAF HQ Growth Playbook',capabilities:['business'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',async execute({task,db}){
  const project=task.project_id?await db.one('hq_v2_projects',`id=eq.${encodeURIComponent(task.project_id)}`):null;
  const projectName=project?.name_ar||'المشروع';
  const options=task.project_id==='qaddha'?
    ['حزمة Premium للمضيف: فئات خاصة وإعداد جلسات متقدم','رعاية موسمية داخل فئات محددة بدون إفساد اللعب','حزم محتوى مدفوعة للمناسبات والشركات','نسخة B2B للفعاليات مع شعار العميل وتقارير الجلسة']:
    ['اختبار باقة اختيارية ذات قيمة واضحة','شراكات غير مزعجة ومرتبطة بسياق المنتج','حزمة مخصصة للجهات والفعاليات'];
  const summary=`خطة دخل عملية لـ ${projectName}:\n${options.map((x,i)=>`${i+1}. ${x}`).join('\n')}\nالخطوة المجانية الأولى: صفحة تسعير تجريبية + قياس ضغطات الاهتمام لمدة أسبوع قبل بناء الدفع. لا توجد أرقام إيراد مختلقة ولم يُنفذ أي التزام مالي.`;
  return {summary,validated:true,evidence:[{kind:'PROJECT_CONTEXT',label:`${projectName} growth context`,uri:project?.live_url||project?.repository_url||null,data:{projectId:project?.id||null,status:project?.status||null,generatedAt:new Date().toISOString(),basis:'stored project context + deterministic growth playbook'}}]};
}};

const researchAdapter = {id:'research',provider:'Gemini Research',capabilities:['general','research','business'],connectionState:()=> process.env.GEMINI_API_KEY?'CONNECTED':'DISCONNECTED',health:()=>process.env.GEMINI_API_KEY?'HEALTHY':'UNAVAILABLE',async execute({task}){
  const prompt=`أنت موظف مهني في NAWAF HQ. نفّذ المطلوب فكريًا وقدّم الناتج نفسه، لا تكتفِ بوصف حالة الشركة. أجب بالعربية السعودية باختصار ووضوح. الموظف: ${task.employee_id||'غير محدد'}. المسار: ${task.route}. المشروع: ${task.project_id||'الشركة'}. الأمر: ${task.command}. إذا كان الطلب إبداعيًا فاقترح أفكارًا ملموسة قابلة للتنفيذ. لا تخترع تنفيذًا خارجيًا أو أرقامًا أو مصادر. إذا كانت المهمة عن تحقيق الدخل، قدم خيارات عملية مرتبة مع مخاطر وتجربة مجانية أولى. أعد نصًا فقط.`;
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.35,maxOutputTokens:1200}}),signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(!r.ok){const error=new Error(`GEMINI_${r.status}:${d?.error?.message||'error'}`);error.status=r.status;throw error;}
  const summary=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!summary)throw new Error('VALIDATION:EMPTY_RESEARCH_RESULT');
  return {summary,validated:true,evidence:[{kind:'AI_PROVIDER_RESPONSE',label:`Gemini ${model} response`,data:{provider:'Google Gemini',model,completedAt:new Date().toISOString(),grounded:false,employeeId:task.employee_id||null}}]};
}};

export const registry = new AdapterRegistry().register(projectExecutionAdapter).register(githubAdapter).register(marketAdapter).register(paperAdapter).register(companyAdapter).register(businessAdapter).register(researchAdapter);
