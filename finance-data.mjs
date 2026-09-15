const GOOGLE_FINANCE='https://www.google.com/finance/quote/';
const KNOWN={
  '2222':'2222:TADAWUL','2222.sr':'2222:TADAWUL','aramco':'2222:TADAWUL',
  'saudi aramco':'2222:TADAWUL','أرامكو':'2222:TADAWUL','ارامكو':'2222:TADAWUL'
};

function clean(v){return String(v||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim()}
function resolveSymbol(text){
  const q=String(text||'').toLowerCase();
  for(const [name,symbol] of Object.entries(KNOWN))if(q.includes(name))return symbol;
  const explicit=q.match(/\b([a-z]{1,6}):(nasdaq|nyse|tadawul)\b/i);if(explicit)return explicit[0].toUpperCase();
  const saudi=q.match(/\b(\d{4})(?:\.sr)?\b/);if(saudi)return `${saudi[1]}:TADAWUL`;
  const us=q.match(/(?:symbol|ticker|سهم|رمز)\s*[:：]?\s*([a-z]{1,6})\b/i);if(us)return `${us[1].toUpperCase()}:NASDAQ`;
  return '';
}
function parseMetrics(html){
  const metrics={};
  const re=/<div class="SwQK7">([\s\S]*?)<\/div><div class="dO6ijd">([\s\S]*?)<\/div>/g;
  for(const m of html.matchAll(re)){const k=clean(m[1]),v=clean(m[2]);if(k&&v&&!metrics[k])metrics[k]=v}
  return metrics;
}
function parseFinancialRows(html){
  const labels=['Revenue','Net income','Diluted EPS','Net profit margin','Operating income','Net change in cash','Cash from operations','Cash from investing','Cash from financing','Cash and short-term investments','Total assets','Total liabilities','Total equity','Shares outstanding','Price to book'];
  const rows={};
  for(const label of labels){
    let at=html.indexOf(`>${label}</div>`),values=[];
    while(at>=0&&!values.length){const chunk=html.slice(at,at+3200);values=[...chunk.matchAll(/<div class="CNzF7d">([\s\S]*?)<\/div>/g)].map(x=>clean(x[1])).filter(Boolean).slice(0,4);at=html.indexOf(`>${label}</div>`,at+label.length)}
    if(values.length)rows[label]=values;
  }
  return rows;
}
export async function fetchFinanceSnapshot(task){
  const symbol=resolveSymbol(`${task?.title||''}\n${task?.details||''}`);
  if(!symbol)return {ok:false,error:'FINANCE_SYMBOL_REQUIRED',requiredTools:['رمز التداول مع السوق، مثال 2222:TADAWUL']};
  const url=`${GOOGLE_FINANCE}${encodeURIComponent(symbol)}?hl=en`;
  let response,lastError;
  for(let attempt=0;attempt<2;attempt++){try{response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; NawafHQ/1.0)'},signal:AbortSignal.timeout(30000)});if(response.ok)break}catch(e){lastError=e}if(attempt===0)await new Promise(r=>setTimeout(r,500))}
  if(!response)throw new Error(`FINANCE_SOURCE_TIMEOUT:${String(lastError?.message||'unavailable')}`);
  if(!response.ok)return {ok:false,error:`FINANCE_SOURCE_HTTP_${response.status}`,requiredTools:['مصدر بيانات مالية متاح']};
  const html=await response.text(),metrics=parseMetrics(html),financials=parseFinancialRows(html);
  const quoteMatch=html.match(new RegExp(`"${symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^\n]{0,180}?([0-9]+(?:\\.[0-9]+)?),([0-9.E+-]+),`));
  const price=quoteMatch?.[1]||metrics.Open||'';
  if(!price&&!Object.keys(metrics).length&&!Object.keys(financials).length)return {ok:false,error:'FINANCE_SOURCE_UNPARSEABLE',requiredTools:['مصدر بيانات مالية متوافق']};
  return {ok:true,provider:'Google Finance',symbol,url,retrievedAt:new Date().toISOString(),price,currency:symbol.endsWith(':TADAWUL')?'SAR':'',metrics,financials};
}

export const FINANCE_POLICY={
  modes:['ANALYZE_ONLY','PROPOSE_TRADE','TRADE_WITH_APPROVAL','AUTONOMOUS_WITHIN_LIMITS'],
  activeMode:'ANALYZE_ONLY',
  walletSchema:['provider','account','assetClass','portfolio','cashBalance','positions','orderProposals','approvedBudget','maxTradeSize','riskLimit','approvalPolicy','auditLog']
};
