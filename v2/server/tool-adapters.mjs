import { AdapterRegistry } from '../core/adapters.mjs';
import { executePaperOrder } from '../core/paper-broker.mjs';

const token = process.env.GITHUB_TOKEN || '';
const repos = {qaddha:'uauz1/game',mueen:'uauz1/mueen-islamic-app'};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'NAWAF-HQ-V2',...(token?{Authorization:`Bearer ${token}`}:{})}});
  const data = await response.json();
  if (!response.ok) { const error=new Error(`GITHUB_${response.status}:${data?.message || 'error'}`); error.status=response.status; throw error; }
  return data;
}

const githubAdapter = {
  id:'github',provider:'GitHub',capabilities:['repository_status','project_execution','qa'],
  connectionState:()=> 'CONNECTED', health:()=> 'HEALTHY',
  async execute({task}) {
    const repo = repos[task.project_id];
    if (!repo) throw new Error('MISSING_CONNECTION:PROJECT_REPOSITORY');
    const [meta,commit,runs] = await Promise.all([github(`/repos/${repo}`),github(`/repos/${repo}/commits?per_page=1`),github(`/repos/${repo}/actions/runs?per_page=5`)]);
    const latestRun = runs.workflow_runs?.[0] || null;
    const evidence = [
      {kind:'GITHUB_COMMIT',label:`${commit[0]?.sha?.slice(0,7)} ${commit[0]?.commit?.message || ''}`,uri:commit[0]?.html_url,data:{sha:commit[0]?.sha,date:commit[0]?.commit?.committer?.date}},
      {kind:'REPOSITORY',label:repo,uri:meta.html_url,data:{defaultBranch:meta.default_branch,pushedAt:meta.pushed_at}}
    ];
    if (latestRun) evidence.push({kind:'CI_RUN',label:`${latestRun.name}: ${latestRun.conclusion || latestRun.status}`,uri:latestRun.html_url,data:{status:latestRun.status,conclusion:latestRun.conclusion,headSha:latestRun.head_sha}});
    const buildVerified = latestRun?.conclusion === 'success';
    return {summary:buildVerified?`آخر تشغيل CI للمشروع نجح (${latestRun.name}).`:`تم فحص المستودع، لكن لا يوجد تشغيل CI ناجح حديث يثبت نجاح البناء.`,evidence,validated:buildVerified};
  }
};

const marketData = {
  async quote(symbol) {
    if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
      const r=await fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`,{headers:{'APCA-API-KEY-ID':process.env.ALPACA_API_KEY,'APCA-API-SECRET-KEY':process.env.ALPACA_SECRET_KEY}});
      const d=await r.json(); if(r.ok&&d?.trade?.p)return {symbol,price:Number(d.trade.p),timestamp:d.trade.t,source:'Alpaca Market Data',uri:`https://app.alpaca.markets/stocks/${symbol}`};
    }
    const code = symbol.toLowerCase() === '2222' ? '2222.sa' : `${symbol.toLowerCase()}.us`;
    const uri=`https://stooq.com/q/l/?s=${encodeURIComponent(code)}&f=sd2t2ohlcv&h&e=csv`;
    const r=await fetch(uri); const text=await r.text(); const lines=text.trim().split('\n'); const values=lines[1]?.split(',');
    const price=Number(values?.[6]); if(!r.ok||!price)throw new Error('TEMPORARY_MARKET_DATA_UNAVAILABLE');
    return {symbol,price,timestamp:`${values[1]}T${values[2]}Z`,source:'Stooq',uri};
  }
};

const marketAdapter = {id:'market_data',provider:'Market Data',capabilities:['finance_analysis'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',async execute({task}){
  const symbol=/ارامكو/.test(task.command)?'2222':task.command.toUpperCase().match(/\b[A-Z]{1,5}\b/)?.[0];
  if(!symbol)throw new Error('VALIDATION:TICKER_REQUIRED'); const quote=await marketData.quote(symbol);
  return {summary:`السعر المتحقق لـ ${symbol}: ${quote.price}. التحليل المالي الكامل يحتاج بيانات أساسيات إضافية؛ لم يتم اختلاق أي تقديرات.`,validated:true,evidence:[{kind:'MARKET_QUOTE',label:`${symbol} @ ${quote.price}`,uri:quote.uri,data:quote}]};
}};

const paperAdapter = {id:'paper_broker',provider:'Internal Paper Broker',capabilities:['paper_trade'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',execute:ctx=>executePaperOrder({...ctx,marketData})};

const companyAdapter = {id:'company_state',provider:'NAWAF HQ State',capabilities:['general'],connectionState:()=> 'CONNECTED',health:()=> 'HEALTHY',async execute({db}){
  const [tasks,employees,approvals,connections]=await Promise.all([db.list('hq_v2_tasks','order=created_at.desc&limit=100'),db.list('hq_v2_employees'),db.list('hq_v2_approvals','status=eq.PENDING'),db.list('hq_v2_connection_requests','status=eq.PENDING')]);
  const active=tasks.filter(t=>['ROUTING','PLANNING','WORKING','RESEARCHING','REVIEWING'].includes(t.status));
  const summary=`الشركة الآن: ${active.length} مهام نشطة، ${employees.filter(e=>e.status!=='READY').length} موظفين يعملون، ${approvals.length} موافقات و${connections.length} طلبات ربط تحتاج انتباه. الأرقام من Supabase وقت التنفيذ.`;
  return {summary,validated:true,evidence:[{kind:'COMPANY_STATE',label:'Supabase current state',data:{activeTasks:active.length,workingEmployees:employees.filter(e=>e.status!=='READY').length,pendingApprovals:approvals.length,pendingConnections:connections.length,checkedAt:new Date().toISOString()}}]};
}};

const researchAdapter = {id:'research',provider:'Gemini Research',capabilities:['research','business'],connectionState:()=> process.env.GEMINI_API_KEY?'CONNECTED':'DISCONNECTED',health:()=>process.env.GEMINI_API_KEY?'HEALTHY':'UNAVAILABLE',async execute({task}){
  const prompt=`أنت موظف مهني في NAWAF HQ. أجب بالعربية السعودية باختصار ووضوح. المسار: ${task.route}. المشروع: ${task.project_id||'الشركة'}. الأمر: ${task.command}. لا تخترع تنفيذًا أو أرقامًا أو مصادر. إذا كانت المهمة عن تحقيق الدخل، قدم خيارات عملية مرتبة مع مخاطر وتجربة مجانية أولى. أعد نصًا فقط.`;
  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash-lite';
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.25,maxOutputTokens:1000}}),signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(!r.ok){const error=new Error(`GEMINI_${r.status}:${d?.error?.message||'error'}`);error.status=r.status;throw error;}
  const summary=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();if(!summary)throw new Error('VALIDATION:EMPTY_RESEARCH_RESULT');
  return {summary,validated:true,evidence:[{kind:'AI_PROVIDER_RESPONSE',label:`Gemini ${model} response`,data:{provider:'Google Gemini',model,completedAt:new Date().toISOString(),grounded:false}}]};
}};

export const registry = new AdapterRegistry().register(githubAdapter).register(marketAdapter).register(paperAdapter).register(companyAdapter).register(researchAdapter);
