const ALPACA_BASE='https://paper-api.alpaca.markets';
const KEY_ID=()=>String(process.env.ALPACA_PAPER_KEY_ID||'').trim();
const SECRET=()=>String(process.env.ALPACA_PAPER_SECRET_KEY||'').trim();

export function alpacaPaperConfigured(){return Boolean(KEY_ID()&&SECRET())}
function now(){return new Date().toISOString()}
function textOf(t){return String(`${t?.title||''} ${t?.details||''}`).toLowerCase()}
function headers(){return {'APCA-API-KEY-ID':KEY_ID(),'APCA-API-SECRET-KEY':SECRET(),'Content-Type':'application/json'}}
async function call(path,options={}){const r=await fetch(ALPACA_BASE+path,{...options,headers:{...headers(),...(options.headers||{})},signal:AbortSignal.timeout(30000)});const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}if(!r.ok){const e=new Error(`ALPACA_PAPER_HTTP_${r.status}: ${data?.message||raw||'request failed'}`);e.status=r.status;throw e}return data}
function explicitSide(text){if(/\b(sell|short)\b|بيع|بع\s/.test(text))return 'sell';if(/\b(buy|long)\b|شراء|اشتر|اشتري/.test(text))return 'buy';return ''}
function symbolFrom(text){const m=String(text||'').toUpperCase().match(/\b[A-Z]{1,5}\b/);return m?.[0]||''}
function amountFrom(text){const m=String(text||'').match(/(?:\$|usd\s*)?([0-9]+(?:\.[0-9]+)?)\s*(?:\$|usd|دولار)/i);return m?Number(m[1]):null}
function qtyFrom(text){const m=String(text||'').match(/([0-9]+(?:\.[0-9]+)?)\s*(?:سهم|أسهم|shares?|share)/i);return m?Number(m[1]):null}

function ensureInternalPaper(state){
 state.trading=state.trading&&typeof state.trading==='object'?state.trading:{};
 if(!state.trading.paperAccount){state.trading.paperAccount={provider:'NAWAF_INTERNAL_PAPER',mode:'PAPER_ONLY',currency:'USD',startingCash:10000,cash:10000,equity:10000,positions:[],orders:[],createdAt:now(),updatedAt:now()}}
 return state.trading.paperAccount;
}
function markConnectionSatisfied(state,task){
 state.connectionRequests=Array.isArray(state.connectionRequests)?state.connectionRequests:[];
 const ts=now();
 for(const req of state.connectionRequests){if(req.taskId===task.id&&req.provider==='alpaca-paper'&&['PENDING','APPROVED'].includes(req.status)){req.status='CONNECTED_INTERNAL_PAPER';req.connectedAt=ts;req.updatedAt=ts;req.note='تم تجاوز الحاجة لمفاتيح Alpaca باستخدام Paper Broker داخلي داخل NAWAF HQ.'}}
 task.connectionRequestId=task.connectionRequestId||null;
}
async function publicPrice(symbol){
 const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
 const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`MARKET_PRICE_HTTP_${r.status}`);
 const d=await r.json();
 const result=d?.chart?.result?.[0];
 const meta=result?.meta||{};
 const price=Number(meta.regularMarketPrice||meta.previousClose||meta.chartPreviousClose);
 if(!Number.isFinite(price)||price<=0)throw new Error('MARKET_PRICE_UNAVAILABLE');
 return {price,currency:meta.currency||'USD',source:url,retrievedAt:now()};
}
function recalc(account,latest={}){
 let mv=0;for(const p of account.positions||[]){const px=Number(latest[p.symbol]||p.lastPrice||p.avgPrice||0);p.lastPrice=px;p.marketValue=Number((p.qty*px).toFixed(2));p.unrealizedPnl=Number(((px-p.avgPrice)*p.qty).toFixed(2));mv+=p.marketValue}
 account.equity=Number((account.cash+mv).toFixed(2));account.updatedAt=now();return account;
}
async function executeInternal(task,state){
 const account=ensureInternalPaper(state);markConnectionSatisfied(state,task);const text=textOf(task),side=explicitSide(text);
 if(!side){recalc(account);return {status:'COMPLETE',summary:'تم فتح وربط محفظة Paper داخلية داخل NAWAF HQ بنجاح.',deliverable:`المزود: NAWAF Internal Paper Broker\nالرصيد التجريبي: ${account.cash.toFixed(2)} USD\nالقيمة الإجمالية: ${account.equity.toFixed(2)} USD\nعدد المراكز المفتوحة: ${account.positions.length}`,evidence:[`Internal paper account created/verified`, `Paper cash: ${account.cash.toFixed(2)} USD`,`Open paper positions: ${account.positions.length}`,`Retrieved: ${now()}`],nextActions:['راكان يقدر الآن تحليل السوق وإنشاء أوامر Paper تجريبية بدون مفاتيح خارجية'],requiredTools:[],paperTrading:true,provider:'NAWAF_INTERNAL_PAPER',confidence:1}}
 const symbol=symbolFrom(`${task.title||''} ${task.details||''}`);if(!symbol)return {status:'NEEDS_APPROVAL',summary:'حدد رمز الأصل للصفقة الورقية، مثل AAPL أو NVDA.',deliverable:'لم يتم تنفيذ أي صفقة.',evidence:['Internal paper broker ready'],requiredTools:[],nextActions:['حدد رمز الأصل'],confidence:1};
 const quote=await publicPrice(symbol),notional=amountFrom(text),requestedQty=qtyFrom(text);if(!notional&&!requestedQty)return {status:'NEEDS_APPROVAL',summary:`حدد حجم الصفقة الورقية لـ ${symbol}، مثل 250 دولار أو 2 سهم.`,deliverable:'لم يتم تنفيذ أي صفقة.',evidence:[`Market price source: ${quote.source}`,`Observed price: ${quote.price} ${quote.currency}`],requiredTools:[],nextActions:['حدد حجم الصفقة'],confidence:1};
 const qty=requestedQty||Number((notional/quote.price).toFixed(6));const value=Number((qty*quote.price).toFixed(2));
 if(side==='buy'&&value>account.cash)return {status:'NEEDS_APPROVAL',summary:`الرصيد التجريبي غير كافٍ. المطلوب ${value} USD والمتاح ${account.cash.toFixed(2)} USD.`,deliverable:'لم يتم تنفيذ الصفقة.',evidence:[`Observed price: ${quote.price} ${quote.currency}`],requiredTools:[],nextActions:['قلل حجم الصفقة'],confidence:1};
 let pos=account.positions.find(p=>p.symbol===symbol);
 if(side==='buy'){
   if(!pos){pos={symbol,qty:0,avgPrice:0,lastPrice:quote.price,marketValue:0,unrealizedPnl:0};account.positions.push(pos)}
   const newQty=pos.qty+qty;pos.avgPrice=((pos.avgPrice*pos.qty)+(quote.price*qty))/newQty;pos.qty=Number(newQty.toFixed(6));account.cash=Number((account.cash-value).toFixed(2));
 }else{
   if(!pos||pos.qty<qty)return {status:'NEEDS_APPROVAL',summary:`لا يوجد رصيد كافٍ من ${symbol} للبيع في المحفظة الورقية.`,deliverable:'لم يتم تنفيذ الصفقة.',evidence:[`Observed price: ${quote.price} ${quote.currency}`],requiredTools:[],nextActions:['اختر كمية أقل أو اشترِ أولًا'],confidence:1};
   pos.qty=Number((pos.qty-qty).toFixed(6));account.cash=Number((account.cash+value).toFixed(2));if(pos.qty<=0)account.positions=account.positions.filter(p=>p!==pos)
 }
 const order={id:'paper-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),symbol,side,qty,price:quote.price,notional:value,status:'FILLED_SIMULATED',provider:'NAWAF_INTERNAL_PAPER',createdAt:now()};account.orders.unshift(order);account.orders=account.orders.slice(0,200);recalc(account,{[symbol]:quote.price});
 return {status:'COMPLETE',summary:`تم تنفيذ صفقة Paper داخل NAWAF HQ: ${side==='buy'?'شراء':'بيع'} ${symbol}.`,deliverable:`${symbol} • ${side} • ${qty} shares • ${quote.price} ${quote.currency} • ${value} USD\nالرصيد المتبقي: ${account.cash.toFixed(2)} USD\nالقيمة الإجمالية: ${account.equity.toFixed(2)} USD`,evidence:[`Paper order id: ${order.id}`,`Market price source: ${quote.source}`,`Observed price: ${quote.price} ${quote.currency}`,`Order status: FILLED_SIMULATED`,`Executed: ${order.createdAt}`],nextActions:['متابعة المركز والربح/الخسارة'],requiredTools:[],paperTrading:true,provider:'NAWAF_INTERNAL_PAPER',order,confidence:1}
}

export function resumeConnectedTasks(state){if(!state||typeof state!=='object')return false;let changed=false;const ts=now();state.connectionRequests=Array.isArray(state.connectionRequests)?state.connectionRequests:[];for(const req of state.connectionRequests){if(req.provider==='alpaca-paper'&&['PENDING','APPROVED'].includes(req.status)){if(alpacaPaperConfigured()){req.status='CONNECTED';req.connectedAt=ts;req.updatedAt=ts}else{req.status='CONNECTED_INTERNAL_PAPER';req.connectedAt=ts;req.updatedAt=ts;req.note='استخدام Paper Broker داخلي بدل مفاتيح Alpaca.'}const task=(state.tasks||[]).find(t=>t.id===req.taskId);if(task&&task.status==='WAITING_FOR_CONNECTION'){task.status='READY';task.progress=0;task.updatedAt=ts;delete task.blockedReason;delete task.blockerType;const e=(state.employees||[]).find(x=>x.id===task.employeeId);if(e){e.status='READY';e.task='';e.updatedAt=ts}}changed=true}}return changed}

export async function executeTradingTask(task,state){
 if(!alpacaPaperConfigured())return executeInternal(task,state);
 const text=textOf(task),account=await call('/v2/account'),evidence=[`Alpaca Paper account: ${account.id||'connected'}`,`Paper status: ${account.status||'unknown'}`,`Equity: ${account.equity||'unknown'}`,`Buying power: ${account.buying_power||'unknown'}`,`Retrieved: ${now()}`],side=explicitSide(text);
 if(!side){const positions=await call('/v2/positions');return {status:'COMPLETE',summary:'تم ربط وقراءة محفظة Alpaca Paper بنجاح.',deliverable:`الرصيد الورقي: ${account.equity||'غير متاح'} USD\nالقوة الشرائية: ${account.buying_power||'غير متاحة'} USD\nعدد المراكز المفتوحة: ${Array.isArray(positions)?positions.length:0}`,evidence:[...evidence,`Open paper positions: ${Array.isArray(positions)?positions.length:0}`],nextActions:[],requiredTools:[],paperTrading:true,provider:'ALPACA_PAPER',confidence:1}}
 const symbol=symbolFrom(`${task.title||''} ${task.details||''}`);if(!symbol)return {status:'NEEDS_APPROVAL',summary:'أحتاج رمز الأصل قبل إرسال أمر Paper. مثال: AAPL أو NVDA.',deliverable:'لم يتم إرسال أي أمر.',evidence,requiredTools:[],nextActions:['حدد رمز الأصل'],confidence:1};
 const notional=amountFrom(text),qty=qtyFrom(text);if(!notional&&!qty)return {status:'NEEDS_APPROVAL',summary:`حدد حجم الأمر الورقي لـ ${symbol} (مثلاً 250 دولار أو 2 سهم).`,deliverable:'لم يتم إرسال أي أمر.',evidence,requiredTools:[],nextActions:['حدد حجم الصفقة'],confidence:1};
 const orderBody={symbol,side,type:'market',time_in_force:'day'};if(notional)orderBody.notional=String(notional);else orderBody.qty=String(qty);
 const order=await call('/v2/orders',{method:'POST',body:JSON.stringify(orderBody)});return {status:'COMPLETE',summary:`تم إرسال أمر ${side==='buy'?'شراء':'بيع'} ورقي حقيقي إلى Alpaca Paper.`,deliverable:`${symbol} • ${side} • ${notional?notional+' USD':qty+' shares'} • حالة الأمر: ${order.status||'accepted'}`,evidence:[...evidence,`Paper order id: ${order.id}`,`Client order id: ${order.client_order_id||'n/a'}`,`Order status: ${order.status||'unknown'}`],nextActions:['متابعة حالة الأمر والمركز'],requiredTools:[],paperTrading:true,provider:'ALPACA_PAPER',order,confidence:1}
}
