const BASE=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const KEY=process.env.SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'';
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
async function request(path,options={}){if(!BASE||!KEY)throw new Error('CLOUD_NOT_CONFIGURED');const r=await fetch(BASE+'/rest/v1/'+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error('BACKEND_'+r.status);return d}
async function readBody(req){let raw='';for await(const c of req)raw+=c;if(!raw)return {};try{return JSON.parse(raw)}catch{return {}}}
export async function loadCloudState(){const rows=await request('hq_state?id=eq.main&select=data,updated_at');return {state:rows?.[0]?.data||null,updatedAt:rows?.[0]?.updated_at||null}}
export async function saveCloudState(state,expectedUpdatedAt=''){if(!state||typeof state!=='object')throw new Error('INVALID_STATE');const c=await loadCloudState();if(expectedUpdatedAt&&c.updatedAt&&String(expectedUpdatedAt)!==String(c.updatedAt)){const err=new Error('STATE_CONFLICT');err.current=c;throw err}const payload={id:'main',data:state,updated_at:new Date().toISOString()};await request('hq_state?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});return {updatedAt:payload.updated_at}}
export async function handleStateApi(req,res){
 try{
  if(req.method==='GET'){
   const c=await loadCloudState();return send(res,200,{ok:true,...c});
  }
  if(req.method==='POST'){
   const b=await readBody(req);if(!b.state||typeof b.state!=='object')return send(res,400,{ok:false,error:'INVALID_STATE'});
   try{const saved=await saveCloudState(b.state,b.baseUpdatedAt||'');return send(res,200,{ok:true,...saved})}catch(e){if(e?.message==='STATE_CONFLICT')return send(res,409,{ok:false,error:'STATE_CONFLICT',state:e.current?.state,updatedAt:e.current?.updatedAt});throw e}
  }
  return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 }catch(e){console.error('state-cloud',e?.message||e);return send(res,503,{ok:false,error:String(e?.message||'STATE_BACKEND_ERROR')})}
}
export function cloudConfigured(){return !!(BASE&&KEY)}
