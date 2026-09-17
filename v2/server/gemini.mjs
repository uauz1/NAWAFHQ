const DEFAULT_MODELS=['gemini-3.5-flash-lite','gemini-3.6-flash'];
const API='https://generativelanguage.googleapis.com/v1beta';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cleanModel=name=>String(name||'').replace(/^models\//,'').trim();

async function listAvailableModels(apiKey,fetchImpl=fetch){
  try{
    const r=await fetchImpl(`${API}/models?pageSize=100`,{headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(10000)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return [];
    return (d.models||[])
      .filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
      .map(m=>cleanModel(m.name))
      .filter(Boolean);
  }catch{return []}
}

export async function generateGeminiText({prompt,maxOutputTokens=1000,apiKey=process.env.GEMINI_API_KEY,preferredModel=process.env.GEMINI_MODEL,fetchImpl=fetch}){
  if(!apiKey)throw new Error('MISSING_CONNECTION:GEMINI_API_KEY');
  const available=await listAvailableModels(apiKey,fetchImpl);
  const requested=[preferredModel,...DEFAULT_MODELS].map(cleanModel).filter(Boolean);
  const ordered=[...new Set(available.length?[...requested.filter(m=>available.includes(m)),...available.filter(m=>/gemini/i.test(m)&&/flash-lite|flash/i.test(m))]:requested)];
  const candidates=ordered.length?ordered:DEFAULT_MODELS;
  let lastError='GEMINI_UNAVAILABLE';
  for(const model of candidates.slice(0,6)){
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetchImpl(`${API}/models/${encodeURIComponent(model)}:generateContent`,{
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
          body:JSON.stringify({contents:[{parts:[{text:String(prompt||'')}]}],generationConfig:{maxOutputTokens}}),
          signal:AbortSignal.timeout(30000)
        });
        const d=await r.json().catch(()=>({}));
        if(r.ok){
          const text=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim();
          if(!text)throw new Error('VALIDATION:EMPTY_GEMINI_RESPONSE');
          return {text,model};
        }
        lastError=`GEMINI_${r.status}:${d?.error?.message||'error'}`;
        if([400,404].includes(r.status))break;
        if(![429,500,502,503,504].includes(r.status))throw Object.assign(new Error(lastError),{status:r.status});
      }catch(error){
        lastError=String(error?.message||error||lastError);
        if(/VALIDATION:EMPTY_GEMINI_RESPONSE/.test(lastError))break;
      }
      if(attempt===0)await sleep(350);
    }
  }
  throw new Error(lastError);
}

export const GEMINI_DEFAULT_MODELS=[...DEFAULT_MODELS];
