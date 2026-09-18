export class AdapterRegistry {
  #adapters = new Map();
  register(adapter) {
    for (const key of ['id','provider','capabilities','execute','health']) if (adapter[key] == null) throw new Error(`INVALID_ADAPTER:${key}`);
    this.#adapters.set(adapter.id, adapter); return this;
  }
  get(id) { return this.#adapters.get(id) || null; }
  resolve(capability) { return [...this.#adapters.values()].find(a => a.capabilities.includes(capability) && a.connectionState() === 'CONNECTED') || null; }
  resolveFor(capability, preferred = []) {
    const prefs=(Array.isArray(preferred)?preferred:[]).map(x=>String(x||'').toLowerCase()).filter(Boolean);
    const connected=[...this.#adapters.values()].filter(a=>a.capabilities.includes(capability)&&a.connectionState()==='CONNECTED');
    if(!prefs.length)return connected[0]||null;
    const preferredAdapter=connected.find(a=>prefs.some(p=>a.id.toLowerCase().includes(p)||a.provider.toLowerCase().includes(p)));
    return preferredAdapter||connected[0]||null;
  }
  list() { return [...this.#adapters.values()].map(a => ({id:a.id,provider:a.provider,capabilities:a.capabilities,connectionState:a.connectionState(),health:a.health()})); }
}

export function classifyError(error) {
  const message = String(error?.message || error || 'UNKNOWN');
  const status = Number(error?.status || message.match(/\b(429|502|503|504)\b/)?.[1]);
  if ([429,502,503,504].includes(status) || /timeout|ECONNRESET|fetch failed/i.test(message)) return {kind:'TEMPORARY_EXTERNAL',retryable:true,message};
  if (/permission|401|403/i.test(message)) return {kind:'PERMISSION',retryable:false,message};
  if (/not configured|missing[_ ]connection|missing[_ ]tool/i.test(message)) return {kind:'CONNECTION_REQUIRED',retryable:false,message};
  if (/validation/i.test(message)) return {kind:'VALIDATION_FAILURE',retryable:false,message};
  return {kind:'EXECUTION_BUG',retryable:false,message};
}
