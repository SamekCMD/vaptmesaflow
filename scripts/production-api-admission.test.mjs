import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const load=()=>import('./production-api-admission.mjs');
function fixture(failure){
 const events=[];
 const action=name=>async()=>{events.push(name);if(failure===name)throw Error('private detail');};
 return {events,ports:{preflight:action('preflight'),publish:action('publish'),verifyOpen:action('verifyOpen'),probe:action('probe'),
  recheckOpen:action('recheckOpen'),contain:action('contain'),verifyClosed:action('verifyClosed'),
  journal:{claim:async()=>{events.push('claim');return true;},record:actionRecord}}};
 async function actionRecord(phase){events.push(phase);if(failure===phase)throw Error('private detail');}
}
test('confirmed opening runs bounded probes without changing billing or invoking containment',async()=>{
 const {runApiAdmissionRelease}=await load();assert.equal(typeof runApiAdmissionRelease,'function');
 const f=fixture(),r=await runApiAdmissionRelease(['open'],f.ports);
 assert.equal(r.status,0);assert.equal(r.report.apiOpen,true);assert.equal(r.report.billingResumed,false);
 assert.deepEqual(f.events,['preflight','claim','api_attempt','publish','verifyOpen','api_confirmed','probe','probes_confirmed']);
});
for(const failure of ['publish','verifyOpen','api_confirmed'])test('uncertainty at '+failure+' stops without retry or containment',async()=>{
 const {runApiAdmissionRelease}=await load();assert.equal(typeof runApiAdmissionRelease,'function');
 const f=fixture(failure),r=await runApiAdmissionRelease(['open'],f.ports);
 assert.equal(r.status,1);assert.equal(r.report.uncertain,true);assert.equal(f.events.includes('contain'),false);
 assert.equal(f.events.filter(e=>e==='publish').length,1);assert(!JSON.stringify(r).includes('private detail'));
});
test('failed HTTP controls return to compatible maintenance only after rechecking confirmed publication',async()=>{
 const {runApiAdmissionRelease}=await load();assert.equal(typeof runApiAdmissionRelease,'function');
 const f=fixture('probe'),r=await runApiAdmissionRelease(['open'],f.ports);
 assert.equal(r.status,1);assert.equal(r.report.maintenanceRestored,true);assert.equal(r.report.apiOpen,false);assert.equal(r.report.uncertain,false);
 assert.deepEqual(f.events.slice(-5),['recheckOpen','containment_attempt','contain','verifyClosed','containment_confirmed']);
});
test('concurrent drift before containment prevents a second write',async()=>{
 const {runApiAdmissionRelease}=await load();assert.equal(typeof runApiAdmissionRelease,'function');
 const f=fixture('probe');f.ports.recheckOpen=async()=>{f.events.push('recheckOpen');throw Error('drift');};
 const r=await runApiAdmissionRelease(['open'],f.ports);assert.equal(r.status,1);assert.equal(r.report.uncertain,true);assert.equal(f.events.includes('contain'),false);
});
for(const failure of ['contain','verifyClosed'])test('uncertain '+failure+' never retries maintenance or claims it restored',async()=>{
 const {runApiAdmissionRelease}=await load();assert.equal(typeof runApiAdmissionRelease,'function');
 const f=fixture(failure);f.ports.probe=async()=>{f.events.push('probe');throw Error('failed controls');};
 const r=await runApiAdmissionRelease(['open'],f.ports);assert.equal(r.status,1);assert.equal(r.report.uncertain,true);assert.equal(r.report.maintenanceRestored,false);
 assert.equal(f.events.filter(e=>e==='contain').length,1);
});
test('consumed journal, invalid arguments and failed preflight never publish',async()=>{
 const {runApiAdmissionRelease}=await load();assert.equal(typeof runApiAdmissionRelease,'function');
 const f=fixture();f.ports.journal.claim=async()=>false;
 assert.equal((await runApiAdmissionRelease(['open'],f.ports)).status,1);assert.deepEqual(f.events,['preflight']);
 for(const args of [[],['open','again'],['resume']])assert.equal((await runApiAdmissionRelease(args,f.ports)).status,1);
 const bad=fixture('preflight');assert.equal((await runApiAdmissionRelease(['open'],bad.ports)).report.uncertain,false);assert.deepEqual(bad.events,['preflight']);
});
test('durable API journal is exclusive, records phases once and does not reuse paired journals',async()=>{
 const {createApiAdmissionJournal}=await load();assert.equal(typeof createApiAdmissionJournal,'function');
 const folder=await mkdtemp(join(tmpdir(),'vapt-admission-')),path=join(folder,'start.json'),journal=createApiAdmissionJournal(path);
 assert.equal(await journal.claim(),true);assert.equal(await createApiAdmissionJournal(path).claim(),false);
 await journal.record('api_attempt');await assert.rejects(journal.record('api_attempt'));await assert.rejects(journal.record('unknown'));
 assert.equal(JSON.parse(await readFile(path,'utf8')).operation,'production-api-admission-v1');
});
function publicTransport(mutate){
 const requests=[];
 return {requests,fetch:async(url,options)=>{
  const path=new URL(url).pathname;requests.push({path,options});
  assert.equal(new URL(url).origin,'https://api.vapt.app.br');assert(['GET','HEAD','OPTIONS'].includes(options.method));
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(new Headers(options.headers).has('cookie'),false);
  let status=200,body={status:'ok'},headers={};
  if(options.method==='OPTIONS'){status=204;body=null;headers={'access-control-allow-origin':'https://vapt.app.br','access-control-allow-credentials':'true','access-control-allow-headers':'Idempotency-Key, X-Vapt-Catalog-Protocol'};}
  else if(['/auth/me','/account/bootstrap','/restaurants/me','/billing/stripe/subscription'].includes(path)){status=401;body={error:{code:'unauthorized'}};}
  else if(path.startsWith('/v1/realtime/')){status=403;body={error:{code:'forbidden'}};}
  else if(path!=='/health'){status=404;body={error:{code:'not_found'}};}
  if(new Headers(options.headers).get('origin')&&options.method!=='OPTIONS')headers={'access-control-allow-origin':'https://vapt.app.br','access-control-allow-credentials':'true'};
  const value={status,body,headers,path,options};mutate?.(value);
  return new Response(options.method==='HEAD'||value.body===null?null:JSON.stringify(value.body),{status:value.status,headers:value.headers});
 }};
}
test('public probe validates all twelve fixed controls without POST, Cookie, redirects or provider actions',async()=>{
 const {probeApiAdmission}=await load();assert.equal(typeof probeApiAdmission,'function');
 const t=publicTransport(),proof=await probeApiAdmission(t.fetch);
 assert.equal(proof.cases.length,12);assert.equal(t.requests.length,12);
 assert.deepEqual(t.requests.slice(0,6).map(r=>[r.options.method,r.path]),[['GET','/health'],['HEAD','/health'],['GET','/auth/me'],['GET','/account/bootstrap'],['GET','/restaurants/me'],['GET','/billing/stripe/subscription']]);
});
for(const [name,mutate] of [
 ['unauthenticated access accidentally allowed',v=>{if(v.path==='/account/bootstrap')v.status=200;}],
 ['secret cookie emitted',v=>{v.headers['set-cookie']='must-not-escape';}],
 ['wrong error envelope',v=>{if(v.status===401)v.body={error:{code:'other'}};}],
 ['wrong CORS origin',v=>{if(v.options.method==='OPTIONS')v.headers['access-control-allow-origin']='*';}],
 ['missing catalog preflight permission',v=>{if(v.options.method==='OPTIONS')v.headers['access-control-allow-headers']='Content-Type';}],
])test('public probe rejects '+name,async()=>{
 const {probeApiAdmission}=await load();assert.equal(typeof probeApiAdmission,'function');
 const t=publicTransport(mutate);await assert.rejects(probeApiAdmission(t.fetch));assert(t.requests.length<=12);
});
