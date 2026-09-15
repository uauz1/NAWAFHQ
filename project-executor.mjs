const PROJECTS={
  mueen:{name:'مُعِين',repoUrl:'https://github.com/uauz1/mueen-islamic-app',liveUrl:'https://mueen-islamic-app.vercel.app/'},
  qaddha:{name:'قدّها',repoUrl:'https://github.com/uauz1/game',liveUrl:'https://qaddha.vercel.app/'}
};
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))}
async function readBody(req){let raw='';for await(const c of req)raw+=c;if(!raw)return {};try{return JSON.parse(raw)}catch{return {}}}
function cleanText(v,max=12000){return String(v||'').trim().slice(0,max)}
function proposalFrom(data){return data?.output?.output||data?.output||data?.proposal||null}
export async function handleProjectApi(req,res,url,aiBackend){
  if(url.pathname==='/api/projects'&&req.method==='GET')return send(res,200,{ok:true,projects:PROJECTS});
  if(url.pathname==='/api/project-execute'&&req.method==='POST'){
    try{
      const b=await readBody(req),project=PROJECTS[String(b.projectId||'')];
      if(!project)return send(res,400,{ok:false,error:'UNKNOWN_PROJECT'});
      const instruction=cleanText(b.instruction);if(!instruction)return send(res,400,{ok:false,error:'EMPTY_INSTRUCTION'});
      const employee=b.employee&&typeof b.employee==='object'?b.employee:{};
      const fullInstruction=`Project: ${project.name}\nRepository: ${project.repoUrl}\nAssigned employee: ${cleanText(employee.name,120)} — ${cleanText(employee.role,240)}\n\nNAWAF DIRECTIVE:\n${instruction}\n\nExecution rules: inspect the real repository, make the requested code/content changes, preserve working features, run available verification checks, and return only verified changes. Do not invent success.`;
      const r=await fetch(aiBackend+'/api/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'modify_code',params:{repoUrl:project.repoUrl,instruction:fullInstruction,taskTitle:cleanText(b.title,240)}}),signal:AbortSignal.timeout(240000)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||data?.ok===false)return send(res,r.status>=400?r.status:502,{ok:false,error:data?.error||data?.output?.error||'PROJECT_EXECUTION_FAILED',detail:data});
      const proposal=proposalFrom(data);
      if(!proposal||!proposal.repository)return send(res,502,{ok:false,error:'NO_VERIFIED_PROPOSAL',detail:data});
      let apply=null;
      const canApply=Boolean(b.autoApply)&&proposal.hasChanges===true&&proposal.verificationPassed===true&&proposal.diff&&!proposal.diffTruncated;
      if(canApply){
        const ar=await fetch(aiBackend+'/api/apply-change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proposal:{repository:proposal.repository,baseCommit:proposal.baseCommit,diff:proposal.diff,commitMessage:`NAWAF HQ: ${cleanText(b.title||instruction,100)}`},decisionId:String(b.taskId||'')}),signal:AbortSignal.timeout(240000)});
        apply=await ar.json().catch(()=>({}));
        if(!ar.ok)apply={...apply,ok:false,httpStatus:ar.status};
      }
      return send(res,200,{ok:true,project:{id:b.projectId,...project},execution:{status:data.status||'SUCCESS',engine:data.engine||'openhands',proposal:{repository:proposal.repository,baseCommit:proposal.baseCommit,changedFiles:proposal.changedFiles||[],hasChanges:Boolean(proposal.hasChanges),verificationPassed:Boolean(proposal.verificationPassed),checks:proposal.checks||[],summary:proposal.summary||'',diffTruncated:Boolean(proposal.diffTruncated)}},apply,applied:Boolean(apply?.ok===true),liveUrl:project.liveUrl});
    }catch(e){return send(res,500,{ok:false,error:String(e?.message||e)})}
  }
  return false;
}
