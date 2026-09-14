export default async function handler(req,res){
  if(req.method!=='POST'){res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});return}
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const state=body.state;
  const task=(state?.tasks||[]).find(t=>t.id===body.taskId);
  if(!state||!task){res.status(400).json({ok:false,error:'INVALID_TASK_STATE'});return}
  if(!process.env.GEMINI_API_KEY){res.status(503).json({ok:false,error:'GEMINI_KEY_MISSING'});return}
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:'user',parts:[{text:'نفذ المهمة التالية وأعد JSON فقط بالحقول status, summary, deliverable, evidence, nextActions, requiredTools, confidence. المهمة: '+task.title}]}],generationConfig:{responseMimeType:'application/json',temperature:0.35,maxOutputTokens:1800}})});
    const d=await r.json();
    if(!r.ok){res.status(502).json({ok:false,error:'GEMINI_'+r.status});return}
    const text=d?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
    const result=JSON.parse(text||'{}');
    task.aiResult=result;task.status='COMPLETED';task.progress=100;task.lastRunAt=new Date().toISOString();
    state.reports=Array.isArray(state.reports)?state.reports:[];
    state.reports.unshift({id:'r'+Date.now().toString(36),title:'تقرير: '+task.title,author:'AI',stage:'محفوظ',content:[result.summary||'',result.deliverable||''].filter(Boolean).join('\n\n'),createdAt:new Date().toISOString()});
    res.status(200).json({ok:true,processed:1,state});
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e||'WORKER_FAILED').slice(0,180)})}
}
