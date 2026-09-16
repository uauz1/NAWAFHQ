export function parsePaperOrder(command) {
  const symbol = String(command).toUpperCase().match(/\b[A-Z]{1,5}\b/)?.[0];
  const amount = Number(String(command).replace(/,/g,'').match(/(?:\$|بـ|بقيمة)\s*(\d+(?:\.\d+)?)/)?.[1] || String(command).match(/(\d+(?:\.\d+)?)\s*(?:دولار|USD)/i)?.[1]);
  const side = /بيع|sell/i.test(command) ? 'SELL' : 'BUY';
  if (!symbol || !amount || amount <= 0) throw new Error('VALIDATION:SYMBOL_AND_NOTIONAL_REQUIRED');
  return {symbol,notional:amount,side};
}

export async function executePaperOrder({db, task, marketData}) {
  const order = parsePaperOrder(task.command);
  const quote = await marketData.quote(order.symbol);
  if (!quote?.price || !quote?.source) throw new Error('VALIDATION:VERIFIED_MARKET_PRICE_REQUIRED');
  const account = await db.one('hq_v2_paper_accounts','id=eq.default');
  if (!account) throw new Error('PAPER_ACCOUNT_MISSING');
  const quantity = Number((order.notional / quote.price).toFixed(8));
  if (order.side === 'BUY' && Number(account.cash) < order.notional) throw new Error('VALIDATION:INSUFFICIENT_PAPER_CASH');
  await db.rpc('hq_v2_execute_paper_order',{p_task_id:task.id,p_symbol:order.symbol,p_side:order.side,p_notional:order.notional,p_quantity:quantity,p_price:quote.price,p_source:quote.source});
  return {summary:`تم تنفيذ صفقة تجريبية ${order.side} على ${order.symbol} بقيمة ${order.notional} USD. لا توجد أموال حقيقية مستخدمة.`,evidence:[{kind:'MARKET_QUOTE',label:`${order.symbol} @ ${quote.price}`,uri:quote.uri,data:quote},{kind:'PAPER_ORDER',label:'Paper order persisted',data:{...order,quantity,fillPrice:quote.price}}]};
}
