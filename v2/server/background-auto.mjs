import { db, dbConfigured } from './db.mjs';
import { createTask, executeTask } from './executor.mjs';

let running=false;
const activeStates=['QUEUED','ROUTING','PLANNING','WORKING','RESEARCHING','REVIEWING','PAUSED_EXTERNAL'];

async function readSetting(key,fallback=true){
  const row=await db.one('hq_v2_settings',`key=eq.${encodeURIComponent(key)}`,'value');
  return row?.value?.value ?? row?.value ?? fallback;
}

async function runBackground(){
  if(running||!dbConfigured())return;
  running=true;
  try{
    const enabled=await readSetting('background_worker_enabled',true);
    if(!enabled)return;
    const routines=await db.list('hq_v2_background_routines','enabled=eq.true&order=created_at.asc');
    const now=Date.now();
    for(const routine of routines){
      if(routine.next_run_at&&Date.parse(routine.next_run_at)>now)continue;
      const cadence=Math.max(15,Number(routine.cadence_minutes)||60);
      try{
        if(routine.id==='executive-review'){
          const [tasks,approvals,connections]=await Promise.all([
            db.list('hq_v2_tasks','archived_at=is.null&order=created_at.desc&limit=100'),
            db.list('hq_v2_approvals','status=eq.PENDING'),
            db.list('hq_v2_connection_requests','status=in.(PENDING,APPROVED)')
          ]);
          const active=tasks.filter(t=>activeStates.includes(t.status));
          const attention=tasks.filter(t=>['FAILED','BLOCKED','WAITING_FOR_CONNECTION'].includes(t.status)).slice(0,5);
          const text=`مراجعة المدير العام: ${active.length} مهام نشطة، ${approvals.length} موافقات، ${connections.length} طلبات ربط، ${attention.length} عناصر تحتاج انتباه.${attention.length?` تحتاج مراجعة: ${attention.map(x=>x.title).join('، ')}`:' لا يوجد شيء عاجل مثبت الآن.'}`;
          await db.insert('hq_v2_secretary_briefs',{task_id:null,title:'موجز المدير العام',body:text,severity:(approvals.length||connections.length||attention.length)?'WARNING':'SUCCESS'},false);
          await db.update('hq_v2_background_routines',`id=eq.${encodeURIComponent(routine.id)}`,{last_run_at:new Date().toISOString(),next_run_at:new Date(Date.now()+cadence*60000).toISOString(),last_result:{type:'brief',summary:text},updated_at:new Date().toISOString()},false);
          continue;
        }
        const bucket=Math.floor(Date.now()/(cadence*60000));
        const task=await createTask(routine.command_template,`background:${routine.id}:${bucket}`);
        await executeTask(task.id);
        await db.update('hq_v2_background_routines',`id=eq.${encodeURIComponent(routine.id)}`,{last_run_at:new Date().toISOString(),next_run_at:new Date(Date.now()+cadence*60000).toISOString(),last_result:{type:'task',taskId:task.id,status:'created'},updated_at:new Date().toISOString()},false);
      }catch(error){
        await db.update('hq_v2_background_routines',`id=eq.${encodeURIComponent(routine.id)}`,{last_run_at:new Date().toISOString(),next_run_at:new Date(Date.now()+Math.max(15,Number(routine.cadence_minutes)||60)*60000).toISOString(),last_result:{type:'error',error:String(error.message||error)},updated_at:new Date().toISOString()},false).catch(()=>{});
        console.error(JSON.stringify({level:'error',stage:'background_routine',routineId:routine.id,error:String(error.message||error)}));
      }
    }
  }catch(error){console.error(JSON.stringify({level:'error',stage:'background_auto',error:String(error.message||error)}));}
  finally{running=false;}
}

setTimeout(runBackground,5000).unref();
setInterval(runBackground,60000).unref();
