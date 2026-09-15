const WEBHOOK=String(process.env.SLACK_WEBHOOK_URL||'').trim();
const BOT_TOKEN=String(process.env.SLACK_BOT_TOKEN||'').trim();
const CHANNEL=String(process.env.SLACK_CHANNEL_ID||'').trim();

export function slackConfigured(){return Boolean(WEBHOOK||(BOT_TOKEN&&CHANNEL))}

export async function notifySlack(text,{blocks=null}={}){
  if(!slackConfigured())return {ok:false,skipped:true,error:'SLACK_NOT_CONFIGURED'};
  const message=String(text||'').trim();
  if(!message)return {ok:false,skipped:true,error:'EMPTY_MESSAGE'};
  try{
    if(WEBHOOK){
      const r=await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(blocks?{text:message,blocks}:{text:message}),signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw new Error('SLACK_WEBHOOK_'+r.status);
      return {ok:true,transport:'webhook'};
    }
    const r=await fetch('https://slack.com/api/chat.postMessage',{method:'POST',headers:{Authorization:'Bearer '+BOT_TOKEN,'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(blocks?{channel:CHANNEL,text:message,blocks}:{channel:CHANNEL,text:message}),signal:AbortSignal.timeout(12000)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.error||('SLACK_API_'+r.status));
    return {ok:true,transport:'bot',ts:data.ts,channel:data.channel};
  }catch(e){console.error('slack-notify',e?.message||e);return {ok:false,error:String(e?.message||e)}}
}
