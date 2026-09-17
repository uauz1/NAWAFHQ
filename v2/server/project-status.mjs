const statusGroups={active:new Set(['QUEUED','ROUTING','PLANNING','WORKING','RESEARCHING','REVIEWING','PAUSED_EXTERNAL']),attention:new Set(['FAILED','BLOCKED','WAITING_FOR_CONNECTION','WAITING_FOR_APPROVAL']),done:new Set(['COMPLETED'])};

const projectLabel=project=>project?.name_ar||project?.name_en||project?.id||'المشروع';
const short=task=>String(task?.title||task?.command||'').replace(/\s+/g,' ').trim().slice(0,110);
const normalize=value=>String(value||'').toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
const statusWords=['موجز','ملخص','وش صار','ايش صار','وش وضع','وضع المشروع','حاله المشروع','وين وصل','وين وصلت','وش باقي','ما صار','تقرير عن'];
const isStatusInquiry=task=>task?.route==='PROJECT_STATUS'||statusWords.some(word=>normalize(task?.command||task?.title).includes(normalize(word)));
const isToolFailure=task=>{
  const error=String(task?.error_message||'');
  const cls=String(task?.error_class||'');
  return /^(GITHUB_|RUNTIME_|TEMPORARY_|GEMINI_|MISSING_CONNECTION:)/.test(error)||['CONNECTION_REQUIRED','TEMPORARY_EXTERNAL','RATE_LIMIT','AUTH','TOOL_UNAVAILABLE','PERMISSION'].includes(cls);
};

function repoSlug(url){
  try{const u=new URL(url);const parts=u.pathname.replace(/^\//,'').replace(/\.git$/,'').split('/');return parts.length>=2?`${parts[0]}/${parts[1]}`:null;}catch{return null;}
}

async function githubJson(path){
  const token=process.env.GITHUB_TOKEN||'';
  const response=await fetch(`https://api.github.com${path}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'NAWAF-HQ-V2',...(token?{Authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`GITHUB_${response.status}:${data?.message||'error'}`);
  return data;
}

export async function executeProjectStatus({task,db}){
  if(!task.project_id)throw new Error('VALIDATION:PROJECT_REQUIRED');
  const project=await db.one('hq_v2_projects',`id=eq.${encodeURIComponent(task.project_id)}`);
  if(!project)throw new Error('VALIDATION:PROJECT_NOT_FOUND');

  const tasks=await db.list('hq_v2_tasks',`project_id=eq.${encodeURIComponent(task.project_id)}&order=created_at.desc&limit=40`);
  const statusInquiries=tasks.filter(isStatusInquiry);
  const relevant=tasks.filter(x=>x.id!==task.id&&!isStatusInquiry(x));
  const completed=relevant.filter(x=>statusGroups.done.has(x.status));
  const allAttention=relevant.filter(x=>statusGroups.attention.has(x.status));
  const toolFailures=allAttention.filter(isToolFailure);
  const projectAttention=allAttention.filter(x=>!isToolFailure(x));
  const active=relevant.filter(x=>statusGroups.active.has(x.status));

  const evidence=[];
  let commitSummary='لا يوجد دليل GitHub متاح الآن.';
  const slug=repoSlug(project.repository_url);
  if(slug){
    try{
      const commits=await githubJson(`/repos/${slug}/commits?per_page=5`);
      const compact=(commits||[]).slice(0,5).map(c=>({sha:c.sha,title:c.commit?.message?.split('\n')[0]||'',date:c.commit?.committer?.date||c.commit?.author?.date||null,uri:c.html_url}));
      const latest=compact[0];
      if(latest)commitSummary=`آخر تغيير موثق في GitHub: ${latest.title||latest.sha.slice(0,7)} (${latest.sha.slice(0,7)}) بتاريخ ${latest.date||'غير معروف'}.`;
      evidence.push({kind:'GITHUB_COMMITS',label:`آخر ${compact.length} تغييرات موثقة`,uri:project.repository_url,data:{repository:slug,commits:compact,checkedAt:new Date().toISOString()}});
    }catch(error){
      evidence.push({kind:'GITHUB_COMMITS',label:'تعذر قراءة سجل GitHub الآن',uri:project.repository_url,data:{error:String(error.message||error),checkedAt:new Date().toISOString()}});
    }
  }

  let liveSummary='لا يوجد رابط منشور مسجل للمشروع.';
  if(project.live_url){
    try{
      const response=await fetch(project.live_url,{redirect:'follow',signal:AbortSignal.timeout(15000)});
      liveSummary=response.ok?`النسخة المنشورة متاحة الآن (HTTP ${response.status}).`:`النسخة المنشورة أعادت HTTP ${response.status} وتحتاج انتباه.`;
      evidence.push({kind:'DEPLOYMENT_CHECK',label:`HTTP ${response.status} ${new URL(response.url).hostname}`,uri:response.url,data:{status:response.status,checkedAt:new Date().toISOString()}});
    }catch(error){
      liveSummary='تعذر الوصول للرابط المنشور أثناء الفحص الحالي.';
      evidence.push({kind:'DEPLOYMENT_CHECK',label:'تعذر فحص النسخة المنشورة',uri:project.live_url,data:{error:String(error.message||error),checkedAt:new Date().toISOString()}});
    }
  }

  const lastDone=completed.slice(0,3).map(short).filter(Boolean);
  const needsAttention=projectAttention.slice(0,3).map(x=>`${short(x)} [${x.status}]`).filter(Boolean);
  const inProgress=active.slice(0,3).map(x=>`${short(x)} [${x.status}]`).filter(Boolean);
  const toolIssues=toolFailures.slice(0,3).map(x=>`${short(x)} — ${String(x.error_message||x.error_class||'تعثر أداة').slice(0,140)}`).filter(Boolean);

  evidence.push({kind:'PROJECT_TASK_STATE',label:`حالة ${projectLabel(project)} من سجل HQ`,uri:project.repository_url||project.live_url||null,data:{projectId:project.id,status:project.status,counts:{completed:completed.length,active:active.length,projectAttention:projectAttention.length,toolFailures:toolFailures.length,totalObserved:relevant.length},recentCompleted:completed.slice(0,5).map(x=>({id:x.id,title:short(x),status:x.status,completed_at:x.completed_at,route:x.route})),projectAttention:projectAttention.slice(0,5).map(x=>({id:x.id,title:short(x),status:x.status,error:x.error_message||null,route:x.route})),toolFailures:toolFailures.slice(0,5).map(x=>({id:x.id,title:short(x),status:x.status,error:x.error_message||null,errorClass:x.error_class||null,route:x.route})),active:active.slice(0,5).map(x=>({id:x.id,title:short(x),status:x.status,route:x.route})),excludedStatusInquiries:statusInquiries.length,checkedAt:new Date().toISOString()}});

  const summary=[
    `موجز ${projectLabel(project)}:`,
    commitSummary,
    liveSummary,
    `أعمال المشروع في HQ: ${completed.length} مكتملة، ${active.length} نشطة/بالطابور، ${projectAttention.length} تحتاج انتباه فعلي بالمشروع.`,
    lastDone.length?`آخر ما اكتمل:\n- ${lastDone.join('\n- ')}`:'ما عندي أعمال مشروع مكتملة حديثة موثقة في سجل HQ أعرضها.',
    inProgress.length?`قيد العمل الآن:\n- ${inProgress.join('\n- ')}`:'ما فيه أعمال مشروع نشطة الآن.',
    needsAttention.length?`وش باقي/يحتاج انتباه بالمشروع:\n- ${needsAttention.join('\n- ')}`:'ما فيه مشاكل مشروع فاشلة أو متوقفة مسجلة حاليًا ضمن آخر السجل المفحوص.',
    toolIssues.length?`فحوصات/أدوات تعثرت سابقًا (ليست مشكلة مثبتة في المشروع):\n- ${toolIssues.join('\n- ')}`:'ما فيه أعطال أدوات مؤثرة ضمن آخر السجل المفحوص.',
    `استبعدت ${statusInquiries.length} استفسار حالة/موجز من عداد إنجازات المشروع. هذا الموجز مبني فقط على GitHub والرابط المنشور وسجل أعمال HQ؛ ما أعتبر أي شيء مكتمل بدون دليل.`
  ].join('\n\n');

  return {summary,validated:evidence.some(x=>x.kind==='GITHUB_COMMITS'||x.kind==='DEPLOYMENT_CHECK'),evidence};
}
