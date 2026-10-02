import { load, refresh, lockRecord } from '@/lib/live';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){try{return Response.json(await load(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'기록 저장소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:503});}}
export async function POST(request:Request){try{
 const body=await request.json() as {action?:string,date:string,raw?:unknown,error_code?:string};
 if(body.action==='lock'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date))return Response.json({error:'날짜가 올바르지 않습니다.'},{status:400});
  return Response.json(await lockRecord(body.date),{headers:{'Cache-Control':'no-store'}});
 }
 if(body.action!=='refresh')return Response.json({error:'지원하지 않는 행동입니다.'},{status:400});
 return Response.json(await refresh(),{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'저장하지 못했습니다. 기존 기록은 보존됩니다. 다시 시도해 주세요.'},{status:503});}}
