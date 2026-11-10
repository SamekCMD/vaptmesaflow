// No CLI, credentials, default network, SQL, resource/config mutation or retries.
import assert from 'node:assert/strict';
import {open} from 'node:fs/promises';

export function createApiAdmissionJournal(path) {
 let claimed=false;
 async function save(file,value){const handle=await open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}}
 return {
  async claim(){try{await save(path,{operation:'production-api-admission-v1',at:new Date().toISOString(),automaticRetry:false});claimed=true;return true;}catch(error){if(error.code==='EEXIST')return false;throw error;}},
  async record(phase){assert(claimed&&['api_attempt','api_confirmed','probes_confirmed','containment_attempt','containment_confirmed'].includes(phase));await save(path+'.'+phase+'.json',{phase,at:new Date().toISOString()});},
 };
}
export async function runApiAdmissionRelease(args,ports={}) {
 const report={ok:false,apiOpen:false,publicationConfirmed:false,maintenanceRestored:false,uncertain:false,billingResumed:false,catalogActivated:false};
 const fail=code=>({status:1,report:{...report,code}});
 if(!Array.isArray(args)||args.length!==1||args[0]!=='open')return fail('invalid_arguments');
 try{
  assert(['preflight','publish','verifyOpen','probe','recheckOpen','contain','verifyClosed'].every(k=>typeof ports[k]==='function'));
  assert(typeof ports.journal?.claim==='function'&&typeof ports.journal?.record==='function');
  await ports.preflight();if(!await ports.journal.claim())return fail('already_started');
  await ports.journal.record('api_attempt');report.uncertain=true;report.apiOpen=null;
  await ports.publish();await ports.verifyOpen();await ports.journal.record('api_confirmed');
  report.publicationConfirmed=true;report.uncertain=false;report.apiOpen=true;
 }catch{return fail(report.uncertain?'opening_uncertain':'preflight_failed');}
 try{await ports.probe();}
 catch{
  // Authorized containment is not a retry. Only a fresh, exact confirmed state
  // may be replaced, and only with the same tenant code under its 503 wrapper.
  report.uncertain=true;report.apiOpen=null;
  try{await ports.recheckOpen();await ports.journal.record('containment_attempt');await ports.contain();await ports.verifyClosed();await ports.journal.record('containment_confirmed');
   report.maintenanceRestored=true;report.apiOpen=false;report.uncertain=false;return fail('controls_failed_maintenance_restored');
  }catch{return fail('controls_failed_containment_uncertain');}
 }
 try{await ports.journal.record('probes_confirmed');report.ok=true;return {status:0,report};}
 catch{return fail('controls_passed_journal_failed');}
}

async function readBounded(response) {
 if(!response.body)return '';
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;assert(size<=32768);parts.push(part.value);}}
 catch{await reader.cancel().catch(()=>{});throw Error('Bounded public response rejected');}
 return Buffer.concat(parts).toString('utf8');
}
export async function probeApiAdmission(fetchPublic) {
 assert.equal(typeof fetchPublic,'function');
 const cases=[
  ['GET','/health',200,null],['HEAD','/health',200,null],
  ['GET','/auth/me',401,'unauthorized'],['GET','/account/bootstrap',401,'unauthorized'],
  ['GET','/restaurants/me',401,'unauthorized'],['GET','/billing/stripe/subscription',401,'unauthorized'],
  ['GET','/public/restaurants/release-readiness-synthetic/catalog-state',404,'not_found'],
  ['GET','/v1/catalog/restaurants/11111111-1111-4111-8111-111111111111/socket',404,'not_found'],
  ['GET','/v1/realtime/restaurants/11111111-1111-4111-8111-111111111111/socket',403,'forbidden'],
  ['GET','/__release_readiness_unknown__',404,'not_found'],
  ['OPTIONS','/account/bootstrap',204,null,'cors'],['GET','/auth/me',401,'unauthorized','cors']];
 const proof={cases:[],noCookie:true,noProviderActions:true};
 for(const [method,path,status,code,cors] of cases){
  const headers=cors?{Origin:'https://vapt.app.br',...(method==='OPTIONS'?{'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'X-Vapt-Catalog-Protocol,Idempotency-Key'}:{})}:{};
  let rule='transport',observedStatus;
  try{
   const response=await fetchPublic('https://api.vapt.app.br'+path,{method,headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});observedStatus=response.status;
   rule='status';assert.equal(observedStatus,status);
   rule='cookie';assert(!response.headers.has('set-cookie'));
   rule='body';const body=await readBounded(response);
   if(method==='HEAD'||method==='OPTIONS')assert.equal(body,'');else if(code)assert.equal(JSON.parse(body).error.code,code);else assert.deepEqual(JSON.parse(body),{status:'ok'});
   if(cors){rule='cors';assert.equal(response.headers.get('access-control-allow-origin'),'https://vapt.app.br');assert.equal(response.headers.get('access-control-allow-credentials'),'true');
    if(method==='OPTIONS'){const allowed=response.headers.get('access-control-allow-headers')??'';assert(allowed.includes('X-Vapt-Catalog-Protocol')&&allowed.includes('Idempotency-Key'));}}
   proof.cases.push({method,path,status:observedStatus,...(cors?{corsVerified:true}:{})});
  }catch{throw Object.assign(Error('Admission public control failed'),{safeProbe:{index:proof.cases.length,method,path,observedStatus,rule}});}
 }
 return proof;
}
