const BASE=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
async function request(path,options={}){if(!BASE||!KEY)throw new Error('CLOUD_NOT_CONFIGURED');const r=await fetch(BASE+'/rest/v1/'+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error('BACKEND_'+r.status);return d}
async function readBody(req){let raw='';for await(const c of req)raw+=c;if(!raw)return {};try{return JSON.parse(raw)}catch{return {}}}
async function current(){const rows=await request('hq_state?id=eq.main&select=data,updated_at');return {state:rows?.[0]?.data||null,updatedAt:rows?.[0]?.updated_at||null}}
export async function handleStateApi(req,res){
 try{
  if(req.method==='GET'){
   const c=await current();return send(res,200,{ok:true,...c});
  }
  if(req.method==='POST'){
   const b=await readBody(req);if(!b.state||typeof b.state!=='object')return send(res,400,{ok:false,error:'INVALID_STATE'});
   const c=await current();
   if(b.baseUpdatedAt&&c.updatedAt&&String(b.baseUpdatedAt)!==String(c.updatedAt))return send(res,409,{ok:false,error:'STATE_CONFLICT',state:c.state,updatedAt:c.updatedAt});
   const payload={id:'main',data:b.state,updated_at:new Date().toISOString()};
   await request('hq_state?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
   return send(res,200,{ok:true,updatedAt:payload.updated_at});
  }
  return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 }catch(e){console.error('state-cloud',e?.message||e);return send(res,503,{ok:false,error:String(e?.message||'STATE_BACKEND_ERROR')})}
}
export function cloudConfigured(){return !!(BASE&&KEY)}
