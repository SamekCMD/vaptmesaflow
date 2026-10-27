// Operator-only orchestration. No default transport, credentials, SQL or retry.
import assert from 'node:assert/strict';
import {open} from 'node:fs/promises';
const account='https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932';
const queue='/queues/69f033ad5eb6424c99b41d1baa7ff3ad',dead='/queues/ad6e9115d01f4c63a43a557f18c0a3a9';
const schedule='/workers/scripts/vapt-billing-email-production/schedules';
export function createBillingResumeTransport({mode,fetchControl}){
  assert(['inspect','resume'].includes(mode)&&typeof fetchControl==='function');
  const attempts=new Set(),reads=new Set([queue,dead,queue+'/metrics',dead+'/metrics','/workers/domains']);
  for(const worker of ['vapt-api-production','vapt-billing-email-production','vapt-web'])for(const suffix of ['deployments','settings','subdomain','schedules'])reads.add('/workers/scripts/'+worker+'/'+suffix);
  return async(path,method='GET',body)=>{
    try{
      if(method==='GET')assert(reads.has(path)&&body===undefined);
      else{
        assert(mode==='resume'&&!attempts.has(path));
        if(method==='PATCH'&&path===queue)assert.deepEqual(body,{settings:{delivery_paused:false}});
        else{assert(method==='PUT'&&path===schedule);assert.deepEqual(body,[{cron:'*/30 * * * *'}]);}
        attempts.add(path);
      }
      const response=await fetchControl(account+path,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});
      assert(response.ok);const reader=response.body?.getReader();assert(reader);let size=0;const parts=[];
      try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;assert(size<=1048576);parts.push(part.value);}}catch{await reader.cancel().catch(()=>{});throw Error('bounded');}
      const value=JSON.parse(Buffer.concat(parts).toString('utf8'));assert(value.success===true&&value.result!==undefined);return value.result;
    }catch{throw Error('Billing control request rejected');}
  };
}
export function createBillingResumeJournal(path){
  let claimed=false;
  async function save(file,value){const handle=await open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}}
  return{
    async claim(){try{await save(path,{operation:'production-billing-resume-v1',at:new Date().toISOString(),automaticRetry:false});claimed=true;return true;}catch(error){if(error.code==='EEXIST')return false;throw error;}},
    async record(phase){assert(claimed&&['queue_attempt','queue_confirmed','cron_attempt','cron_confirmed'].includes(phase));await save(path+'.'+phase+'.json',{phase,at:new Date().toISOString()});},
  };
}
export async function runProductionBillingResume(args,ports={}){
  const report={ok:false,prepared:false,controlPlaneRestored:false,queueResumed:false,cronRestored:false,deliveryProven:false,scheduledExecutionProven:false,uncertain:false,attempted:[]};
  const fail=code=>({status:1,report:{...report,code}});
  if(!Array.isArray(args)||args.length!==1||!['inspect','resume'].includes(args[0]))return fail('invalid_arguments');
  const resume=args[0]==='resume';let stage='input';
  try{
    assert(['preflight','databasePreflight','recheckPaused'].every(key=>typeof ports[key]==='function'));
    if(resume)assert(['resumeQueue','verifyQueue','restoreCron','verifyRestored'].every(key=>typeof ports[key]==='function')&&typeof ports.journal?.claim==='function'&&typeof ports.journal?.record==='function');
    if(resume){stage='claim';if(!await ports.journal.claim())return fail('already_started');}
    stage='preflight';await ports.preflight();stage='database';await ports.databasePreflight();stage='recheck_paused';await ports.recheckPaused();report.prepared=true;
    if(!resume)return{status:0,report:{...report,ok:true,readOnly:true}};
    stage='queue';await ports.journal.record('queue_attempt');report.attempted.push('queue');report.uncertain=true;report.queueResumed=null;
    await ports.resumeQueue();await ports.verifyQueue();report.queueResumed=true;await ports.journal.record('queue_confirmed');report.uncertain=false;
    stage='cron';await ports.journal.record('cron_attempt');report.attempted.push('cron');report.uncertain=true;report.cronRestored=null;
    await ports.restoreCron();await ports.verifyRestored();report.cronRestored=true;await ports.journal.record('cron_confirmed');report.uncertain=false;
    return{status:0,report:{...report,ok:true,controlPlaneRestored:true}};
  }catch{return fail(report.uncertain?'restoration_uncertain':stage==='input'?'missing_ports':'restoration_stopped');}
}
