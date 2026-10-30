// Diagnostic for the existing API-Football integration. No credentials or personal account data are returned.
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  const key=String(process.env.FOOTBALL||"").trim();
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(!key)return res.status(200).json({provider:"api-football.com",configured:false,connection:"missing_key"});
  try{
    // /status is quota-free per API-Football's official documentation.
    const response=await fetch("https://v3.football.api-sports.io/status",{
      headers:{"x-apisports-key":key},signal:AbortSignal.timeout(6500)
    });
    const data=await response.json().catch(()=>null);
    const errors=data?.errors&&typeof data.errors==="object"
      ?Object.entries(data.errors).filter(([,v])=>Boolean(v)).map(([k])=>k):[];
    const ok=response.ok&&errors.length===0&&data?.response&&typeof data.response==="object"
      &&!Array.isArray(data.response);
    const requests=ok?data.response.requests||{}:{};
    const numeric=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
    return res.status(200).json({
      provider:"api-football.com",configured:true,connection:ok?"authenticated":response.status===401||response.status===403?"unauthorized":response.status===429?"rate_limited":"provider_error",
      upstreamStatus:response.status,
      providerErrorCategories:errors,
      quota:ok?{used:numeric(requests.current),dailyLimit:numeric(requests.limit)}:null
    });
  }catch(error){
    return res.status(200).json({provider:"api-football.com",configured:true,connection:"unreachable"});
  }
}
