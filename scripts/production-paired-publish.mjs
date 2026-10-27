// Narrow publication primitives. No CLI, auth, default transport, SQL, resume,
// retries, rollbacks, DNS or resource administration. Caller supplies reviewed ports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { extname } from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex');

export function apiMetadata(settings,tag) {
  assert.equal(tag,'stage13-realtime-production-sqlite-v1');
  assert.equal(settings.compatibility_date,'2026-09-28');
  assert.deepEqual(settings.compatibility_flags,['nodejs_compat']);
  assert.deepEqual(settings.limits,{cpu_ms:1000});
  assert(settings.observability?.enabled!==true&&settings.logpush!==true&&(settings.tail_consumers??[]).length===0);
  assert(Array.isArray(settings.bindings));
  assert.equal(new Set(settings.bindings.map(b=>b.name)).size,settings.bindings.length);
  assert(!settings.bindings.some(b=>b.name.startsWith('PUBLIC_CATALOG_')));
  const bindings=settings.bindings.filter(b=>{
    if(b.type==='secret_text'||b.type==='secret_key') {
      assert.deepEqual(Object.keys(b).sort(),['name','type']);return false;
    }
    return true;
  }).map(b=>{
    const copy=structuredClone(b);
    if(copy.type==='durable_object_namespace')delete copy.namespace_id;
    return copy;
  });
  bindings.push(
    {name:'PUBLIC_CATALOG_READER_ENABLED',type:'plain_text',text:'false'},
    {name:'PUBLIC_CATALOG_WRITER_ENABLED',type:'plain_text',text:'false'},
    {name:'PUBLIC_CATALOG_BUCKET',type:'r2_bucket',bucket_name:'vapt-catalog-production'},
    {name:'PUBLIC_CATALOG_COORDINATOR',type:'durable_object_namespace',class_name:'PublicCatalogCoordinator'});
  return {main_module:'__vapt_production_maintenance__.mjs',bindings,
    keep_bindings:['secret_text','secret_key'],compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],
    limits:{cpu_ms:1000},logpush:false,tail_consumers:[],
    ...(settings.observability?{observability:structuredClone(settings.observability)}:{}),
    migrations:{old_tag:tag,new_tag:'catalog-publication-production-sqlite-v1',steps:[{new_sqlite_classes:['PublicCatalogCoordinator']}]}};
}

export function moduleForm(metadata,modules) {
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  assert(Array.isArray(modules)&&new Set(modules.map(m=>m.name)).size===modules.length);
  for(const module of modules) {
    assert(/^[A-Za-z0-9_.-]+$/.test(module.name)&&module.name!=='metadata'&&Buffer.isBuffer(module.bytes));
    form.set(module.name,new Blob([module.bytes],{type:'application/javascript+module'}),module.name);
  }
  return form;
}

export function frontendMetadata(completion,rules) {
  assert(typeof completion==='string'&&completion.length>10&&Buffer.isBuffer(rules));
  assert.equal(rules.toString('utf8').replace(/\r\n/g,'\n'),'/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n');
  return {compatibility_date:'2026-09-24',compatibility_flags:[],assets:{jwt:completion,
    config:{not_found_handling:'single-page-application',_headers:rules.toString('utf8')}}};
}

export function assetManifest(files) {
  assert(Array.isArray(files)&&files.length>0&&files.length<=1000);
  const result={};
  for(const file of files) {
    assert(typeof file.path==='string'&&!file.path.startsWith('/')&&!file.path.includes('\\')&&
      file.path.split('/').every(p=>p&&p!=='.'&&p!=='..')&&Buffer.isBuffer(file.bytes));
    assert(!Object.hasOwn(result,'/'+file.path));
    result['/'+file.path]={hash:hash(file.bytes.toString('base64')+extname(file.path).slice(1)).slice(0,32),size:file.bytes.length};
  }
  return result;
}

export function createPairJournal(path) {
  let claimed=false;
  async function save(file,value) {
    const handle=await open(file,'wx',0o600);
    try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}
  }
  return {
    async claim() {
      try{await save(path,{version:1,operation:'production-paired-publication-v1',at:new Date().toISOString(),automaticRetry:false});claimed=true;return true;}
      catch(error){if(error.code==='EEXIST')return false;throw error;}
    },
    async record(phase) {
      assert(claimed&&/^(api|billing|frontend)_(attempt|confirmed)$/.test(phase));
      await save(path+'.'+phase+'.json',{phase,at:new Date().toISOString()});
    },
  };
}

export async function runPairedPublication(args,ports={}) {
  const report={ok:false,attempted:[],confirmed:[],uncertain:false,trafficReleased:false,billingResumed:false};
  if(!Array.isArray(args)||args.length!==1||args[0]!=='publish')return {status:1,report:{...report,code:'invalid_arguments'}};
  let stage='preflight';
  try {
    assert(['preflight','publish','verify'].every(k=>typeof ports[k]==='function'));
    assert(typeof ports.journal?.claim==='function'&&typeof ports.journal?.record==='function');
    await ports.preflight();
    if(!await ports.journal.claim())return {status:1,report:{...report,code:'already_started'}};
    for(stage of ['api','billing','frontend']) {
      await ports.journal.record(stage+'_attempt');
      report.attempted.push(stage);report.uncertain=true;
      await ports.publish(stage);
      await ports.verify(stage);
      await ports.journal.record(stage+'_confirmed');
      report.confirmed.push(stage);
    }
    report.ok=true;report.uncertain=false;return {status:0,report};
  }catch{return {status:1,report:{...report,stoppedAt:stage,code:report.attempted.length?'partial_or_uncertain':'preflight_failed'}};}
}
