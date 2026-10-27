import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
async function feature(){const m=await import('./production-billing-resume.mjs').catch(()=>({}));assert.equal(typeof m.runProductionBillingResume,'function','billing resume operator missing');return m;}
function fixture(failAt){
  const events=[];let claimed=false,queue=false,cron=false;
  const step=async(name,change)=>{events.push(name);if(failAt===name)throw Error('private-provider-token');change?.();};
  const ports={journal:{claim:async()=>{events.push('claim');if(claimed)return false;claimed=true;return true;},record:name=>step(name)},
    preflight:()=>step('preflight'),databasePreflight:()=>step('database'),recheckPaused:()=>step('recheck_paused'),
    resumeQueue:()=>step('resume_queue',()=>{queue=true;}),verifyQueue:()=>step('verify_queue'),
    restoreCron:()=>step('restore_cron',()=>{cron=true;}),verifyRestored:()=>step('verify_restored')};
  return{events,ports,state:()=>({queue,cron})};
}
test('inspect checks prerequisites without journal, queue or cron writes',async()=>{
  const {runProductionBillingResume:run}=await feature(),f=fixture();const result=await run(['inspect'],f.ports);
  assert.equal(result.status,0);assert.equal(result.report.prepared,true);assert.equal(result.report.controlPlaneRestored,false);
  assert.deepEqual(f.events,['preflight','database','recheck_paused']);assert.deepEqual(f.state(),{queue:false,cron:false});
});
test('resume restores only queue then cron, each once and with readback; does not claim functional delivery',async()=>{
  const {runProductionBillingResume:run}=await feature(),f=fixture(),result=await run(['resume'],f.ports);
  assert.equal(result.status,0);assert.equal(result.report.controlPlaneRestored,true);assert.equal(result.report.deliveryProven,false);assert.equal(result.report.scheduledExecutionProven,false);
  assert.deepEqual(f.events,['claim','preflight','database','recheck_paused','queue_attempt','resume_queue','verify_queue','queue_confirmed','cron_attempt','restore_cron','verify_restored','cron_confirmed']);
  assert.deepEqual(f.state(),{queue:true,cron:true});assert.deepEqual(result.report.attempted,['queue','cron']);
  const replay=await run(['resume'],f.ports);assert.equal(replay.report.code,'already_started');assert.equal(f.events.filter(x=>x==='resume_queue').length,1);
});
for(const failAt of ['preflight','database','recheck_paused','queue_attempt'])test(`failure at ${failAt} never releases delivery`,async()=>{
  const {runProductionBillingResume:run}=await feature(),f=fixture(failAt),r=await run(['resume'],f.ports);
  assert.equal(r.status,1);assert.equal(r.report.uncertain,false);assert.deepEqual(f.state(),{queue:false,cron:false});assert.deepEqual(r.report.attempted,[]);
  assert.doesNotMatch(JSON.stringify(r),/private-provider-token/);
});
for(const failAt of ['resume_queue','verify_queue','queue_confirmed','cron_attempt'])test(`failure at ${failAt} stops before cron with no retry or blind rollback`,async()=>{
  const {runProductionBillingResume:run}=await feature(),f=fixture(failAt),r=await run(['resume'],f.ports);
  assert.equal(r.status,1);assert.equal(f.events.includes('restore_cron'),false);assert.equal(f.events.filter(x=>x==='resume_queue').length,1);
  assert.deepEqual(r.report.attempted,['queue']);assert.doesNotMatch(JSON.stringify(r),/private-provider-token/);
});
for(const failAt of ['restore_cron','verify_restored','cron_confirmed'])test(`uncertainty at ${failAt} is never a successful restoration or automatic retry`,async()=>{
  const {runProductionBillingResume:run}=await feature(),f=fixture(failAt),r=await run(['resume'],f.ports);
  assert.equal(r.status,1);assert.equal(r.report.uncertain,true);assert.equal(r.report.controlPlaneRestored,false);
  assert.equal(f.events.filter(x=>x==='restore_cron').length,1);assert.deepEqual(r.report.attempted,['queue','cron']);
});
test('arguments and missing ports are rejected without IO',async()=>{
  const {runProductionBillingResume:run}=await feature();for(const args of [[],['resume','--force'],['production'],['inspect','--token=private']]){
    const f=fixture(),r=await run(args,f.ports);assert.equal(r.status,1);assert.deepEqual(f.events,[]);assert.doesNotMatch(JSON.stringify(r),/private/);
  }
  assert.equal((await run(['resume'],{})).status,1);
});
test('journal durably claims once and admits only bounded named phases',async()=>{
  const {createBillingResumeJournal}=await feature();assert.equal(typeof createBillingResumeJournal,'function');
  const dir=await mkdtemp(join(tmpdir(),'vapt-billing-resume-')),path=join(dir,'gate.json');
  const a=createBillingResumeJournal(path),b=createBillingResumeJournal(path);assert.equal(await a.claim(),true);assert.equal(await b.claim(),false);
  await a.record('queue_attempt');assert.equal(JSON.parse(await readFile(path+'.queue_attempt.json','utf8')).phase,'queue_attempt');
  await assert.rejects(a.record('queue_attempt'));await assert.rejects(a.record('../other'));await assert.rejects(b.record('cron_attempt'));
});
test('transport allows only the fixed production queue release and 30min schedule, preserving exact HTTP boundary',async()=>{
  const {createBillingResumeTransport}=await feature();assert.equal(typeof createBillingResumeTransport,'function');const calls=[];
  const request=createBillingResumeTransport({mode:'resume',fetchControl:async(url,init)=>{calls.push({url,init});return Response.json({success:true,result:{accepted:true}});}});
  await request('/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{settings:{delivery_paused:false}});
  await request('/workers/scripts/vapt-billing-email-production/schedules','PUT',[{cron:'*/30 * * * *'}]);
  assert.deepEqual(calls.map(c=>[c.url,c.init.method,JSON.parse(c.init.body)]),[
    ['https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{settings:{delivery_paused:false}}],
    ['https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932/workers/scripts/vapt-billing-email-production/schedules','PUT',[{cron:'*/30 * * * *'}]]]);
  for(const c of calls){assert.equal(c.init.redirect,'error');assert(c.init.signal instanceof AbortSignal);assert.equal(c.init.headers['Content-Type'],'application/json');}
});
test('transport blocks preview, purge, extra queue changes and aggressive schedules before IO; inspect cannot mutate',async()=>{
  const {createBillingResumeTransport}=await feature();assert.equal(typeof createBillingResumeTransport,'function');let calls=0;
  for(const mode of ['inspect','resume']){
    const request=createBillingResumeTransport({mode,fetchControl:async()=>{calls++;return Response.json({success:true,result:{}});}});
    for(const [path,method,body]of [
      ['/queues/69f033ad5eb6424c99b41d1baa7ff3ad/purge','POST',{}],
      ['/queues/preview','PATCH',{settings:{delivery_paused:false}}],
      ['/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{settings:{delivery_paused:false,message_retention_period:60}}],
      ['/workers/scripts/vapt-billing-email-production/schedules','PUT',[{cron:'* * * * *'}]],
      ['/workers/scripts/vapt-billing-email-preview/schedules','PUT',[{cron:'*/30 * * * *'}]],
    ])await assert.rejects(request(path,method,body));
    if(mode==='inspect')await assert.rejects(request('/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{settings:{delivery_paused:false}}));
  }
  assert.equal(calls,0);
});
test('transport consumes each write attempt before awaiting lost response and refuses a second write',async()=>{
  const {createBillingResumeTransport}=await feature();assert.equal(typeof createBillingResumeTransport,'function');let calls=0;
  const request=createBillingResumeTransport({mode:'resume',fetchControl:async()=>{calls++;throw Error('private-token');}});
  const args=['/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{settings:{delivery_paused:false}}];
  await assert.rejects(request(...args));await assert.rejects(request(...args));assert.equal(calls,1);
});
test('transport permits bounded fixed metadata reads, rejects unknown paths and sanitizes provider failures',async()=>{
  const {createBillingResumeTransport}=await feature();let calls=0;
  const request=createBillingResumeTransport({mode:'inspect',fetchControl:async()=>{calls++;return Response.json({success:true,result:{queue_name:'vapt-emails-production'}});}});
  assert.deepEqual(await request('/queues/69f033ad5eb6424c99b41d1baa7ff3ad'),{queue_name:'vapt-emails-production'});
  await assert.rejects(request('/workers/scripts/other/settings'));assert.equal(calls,1);
  for(const reply of [()=>Response.json({success:false,errors:[{message:'private-provider-message'}]}),()=>new Response('private-provider-message',{status:403}),()=>new Response('x'.repeat(1048577))]){
    const bad=createBillingResumeTransport({mode:'inspect',fetchControl:async()=>reply()});
    await assert.rejects(bad('/queues/69f033ad5eb6424c99b41d1baa7ff3ad'),error=>error.message==='Billing control request rejected');
  }
});
