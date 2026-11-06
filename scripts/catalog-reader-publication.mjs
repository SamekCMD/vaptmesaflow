// Offline gate primitives, not an activation CLI. No credentials, default fetch,
// SQL, resource provisioning, retries or automatic rollback. A reviewed controller
// must independently verify live readiness and exact API/frontend bytes.
import assert from 'node:assert/strict';
import {open} from 'node:fs/promises';
import {catalogWriterApiMetadata} from './catalog-writer-publication.mjs';

const directions=['activate','rollback'];
const phases=['maintenance','frontend','api'];
const records=phases.flatMap(phase=>[phase+'_attempt',phase+'_confirmed']);
const reader='PUBLIC_CATALOG_READER_ENABLED',writer='PUBLIC_CATALOG_WRITER_ENABLED';
const api='vapt-api-production',web='vapt-web';

export function catalogReaderApiMetadata(settings,tag,direction){
  try{
    assert(directions.includes(direction));
    assert(Array.isArray(settings.bindings));
    const expect=(name,text)=>assert.deepEqual(settings.bindings.filter(b=>b.name===name),[{name,type:'plain_text',text}]);
    expect(writer,'true');expect(reader,direction==='activate'?'false':'true');
    // Reuse the established resource/secret/CPU/rate validator unchanged. Only
    // this private validation view is inert; the caller's live state is untouched.
    const inert=structuredClone(settings);
    for(const name of [reader,writer])inert.bindings.find(b=>b.name===name).text='false';
    const metadata=catalogWriterApiMetadata(inert,tag);
    metadata.bindings.find(b=>b.name===reader).text=direction==='activate'?'true':'false';
    return metadata;
  }catch{throw Error('Catalog reader settings rejected');}
}

export function verifyCatalogReaderControlTransition(before,after,phase,direction){
  try{
    assert(phases.includes(phase)&&directions.includes(direction));
    assert.equal(before.catalogPrivate,true);
    catalogReaderApiMetadata(before.workers[api].settings,before.migrationTag,direction);
    const name=phase==='frontend'?web:api;
    const prior=before.workers[name].deployment,deployment=after.workers[name].deployment;
    const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
    for(const value of [prior,deployment]){
      assert(uuid.test(value.id)&&value.versions.length===1&&value.versions[0].percentage===100&&uuid.test(value.versions[0].version_id));
    }
    assert(deployment.id!==prior.id&&deployment.versions[0].version_id!==prior.versions[0].version_id);
    const expected=structuredClone(before);expected.workers[name].deployment=structuredClone(deployment);
    if(phase==='api')expected.workers[api].settings.bindings.find(b=>b.name===reader).text=direction==='activate'?'true':'false';
    assert.deepEqual(after,expected);
    return {verified:true,worker:name,deployment:structuredClone(deployment)};
  }catch{throw Error('Catalog reader control readback rejected');}
}

export function createCatalogReaderJournal(path,direction){
  assert(directions.includes(direction));let claimed=false,next=0;
  async function save(file,value){const handle=await open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}}
  return Object.freeze({
    direction,
    async claim(){try{await save(path,{operation:'production-catalog-reader-publication-v1',direction,at:new Date().toISOString(),automaticRetry:false});claimed=true;return true;}catch(error){if(error.code==='EEXIST')return false;throw error;}},
    async record(phase){assert(claimed&&typeof phase==='string'&&next<records.length&&records[next]===phase);await save(path+'.'+phase+'.json',{direction,phase,at:new Date().toISOString()});next++;},
  });
}

export async function runCatalogReaderPublication(args,ports={}){
  const report={ok:false,prepared:false,appliedDirection:null,runtimeWriterCoverageProven:false,uncertain:false,attempted:[],confirmed:[]};
  const fail=code=>({status:1,report:{...report,code}});
  if(!Array.isArray(args))return fail('invalid_arguments');
  const inspect=args.length===2&&args[0]==='inspect',direction=inspect?args[1]:args[0];
  if(!directions.includes(direction)||(!inspect&&args.length!==1))return fail('invalid_arguments');
  let stage='input';
  try{
    assert(['preflight','databasePreflight','recheckOpen'].every(key=>typeof ports[key]==='function'));
    if(!inspect){
      assert(['publish','verify','recheckPair'].every(key=>typeof ports[key]==='function')&&ports.journal?.direction===direction&&typeof ports.journal?.claim==='function'&&typeof ports.journal?.record==='function');
      stage='claim';if(!await ports.journal.claim())return fail('already_started');
    }
    stage='preflight';await ports.preflight(direction);
    stage='database';await ports.databasePreflight(direction);
    stage='open';await ports.recheckOpen(direction);report.prepared=true;
    if(inspect)return {status:0,report:{...report,ok:true,readOnly:true}};
    for(stage of phases){
      if(stage==='api')await ports.recheckPair(direction);
      await ports.journal.record(stage+'_attempt');report.attempted.push(stage);report.uncertain=true;
      await ports.publish(stage,direction);await ports.verify(stage,direction);await ports.journal.record(stage+'_confirmed');
      report.confirmed.push(stage);report.uncertain=false;
    }
    return {status:0,report:{...report,ok:true,appliedDirection:direction}};
  }catch{return {status:1,report:{...report,stoppedAt:stage,code:stage==='input'?'missing_ports':report.uncertain?'publication_uncertain':'publication_stopped'}};}
}
