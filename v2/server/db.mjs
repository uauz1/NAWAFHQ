const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const serverKey = process.env.HQ_V2_DB_KEY || '';

export const dbConfigured = () => Boolean(base && key && (process.env.SUPABASE_SERVICE_ROLE_KEY || serverKey));

async function request(path, options = {}) {
  if (!dbConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...(serverKey?{'X-HQ-Server-Key':serverKey}:{}), ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) { const error = new Error(`SUPABASE_${response.status}:${data?.message || data?.code || text}`); error.status=response.status; throw error; }
  return data;
}

export const db = {
  list(table, query = '', select = '*') { return request(`${table}?select=${encodeURIComponent(select)}${query ? `&${query}` : ''}`); },
  async one(table, query, select = '*') { return (await this.list(table, `${query}&limit=1`, select))?.[0] || null; },
  insert(table, body, returnRows = true) { return request(table,{method:'POST',headers:{Prefer:returnRows?'return=representation':'return=minimal'},body:JSON.stringify(body)}); },
  update(table, query, body, returnRows = true) { return request(`${table}?${query}`,{method:'PATCH',headers:{Prefer:returnRows?'return=representation':'return=minimal'},body:JSON.stringify(body)}); },
  rpc(name, body) { return request(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)}); }
};

export async function snapshot() {
  const [employees,projects,tasks,approvals,connections,briefs,activity,tools,account,positions,orders] = await Promise.all([
    db.list('hq_v2_employees','order=name_en.asc'), db.list('hq_v2_projects','order=created_at.asc'),
    db.list('hq_v2_tasks','order=created_at.desc&limit=100'), db.list('hq_v2_approvals','status=eq.PENDING&order=created_at.desc'),
    db.list('hq_v2_connection_requests','status=in.(PENDING,APPROVED)&order=created_at.desc'), db.list('hq_v2_secretary_briefs','order=created_at.desc&limit=20'),
    db.list('hq_v2_activity','order=created_at.desc&limit=30'), db.list('hq_v2_tool_connections','order=id.asc'),
    db.one('hq_v2_paper_accounts','id=eq.default'), db.list('hq_v2_paper_positions','account_id=eq.default'),
    db.list('hq_v2_paper_orders','account_id=eq.default&order=created_at.desc&limit=30')
  ]);
  return {employees,projects,tasks,approvals,connections,briefs,activity,tools,finance:{account,positions,orders},serverTime:new Date().toISOString()};
}
