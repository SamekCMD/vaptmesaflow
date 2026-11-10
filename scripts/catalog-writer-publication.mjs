// Offline publication primitives only: no CLI, credentials, default transport,
// SQL, migrations, billing changes, retries or rollback. A fixed controller must
// independently prove the source bytes, live resource identities and readbacks.
import assert from 'node:assert/strict';
import {open} from 'node:fs/promises';

const phases=['maintenance','frontend','writer'];
const records=phases.flatMap(phase=>[phase+'_attempt',phase+'_confirmed']);
const secrets=['BETTER_AUTH_SECRET','PUBLIC_ORDER_TOKEN_SECRET','RESEND_API_KEY','TURNSTILE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].sort();

// This is NOT the initial namespace provisioning helper. All catalog resources
// must already exist in this exact environment and both flags must be inert.
export function catalogWriterApiMetadata(settings,tag){
  try{
    assert.equal(tag,'catalog-publication-production-sqlite-v1');
    assert.equal(settings.compatibility_date,'2026-09-28');
    assert.deepEqual(settings.compatibility_flags,['nodejs_compat']);
    assert.deepEqual(settings.limits,{cpu_ms:1000});
    assert(settings.logpush!==true&&settings.observability?.enabled!==true&&(settings.tail_consumers??[]).length===0);
    assert(Array.isArray(settings.bindings));
    const bindings=settings.bindings,byName=new Map(bindings.map(b=>[b.name,b]));
    assert.equal(byName.size,bindings.length);
    for(const b of bindings){
      assert(typeof b.name==='string'&&/^[A-Z][A-Z0-9_]*$/.test(b.name)&&typeof b.type==='string');
      if(b.type.startsWith('secret'))assert(b.type==='secret_text'&&Object.keys(b).sort().join(',')==='name,type');
    }
    assert.deepEqual(bindings.filter(b=>b.type==='secret_text').map(b=>b.name).sort(),secrets);
    const expect=(name,value)=>assert.deepEqual(byName.get(name),{name,...value});
    for(const [name,text]of Object.entries({ENVIRONMENT:'production',REALTIME_ENABLED:'true',STRIPE_ENVIRONMENT:'test',PUBLIC_CATALOG_READER_ENABLED:'false',PUBLIC_CATALOG_WRITER_ENABLED:'false'}))expect(name,{type:'plain_text',text});
    expect('HYPERDRIVE',{type:'hyperdrive',id:'2885c609a66641b3b716190c2d467902'});
    expect('R2_BUCKET',{type:'r2_bucket',bucket_name:'vapt-assets-production'});
    expect('PUBLIC_CATALOG_BUCKET',{type:'r2_bucket',bucket_name:'vapt-catalog-production'});
    expect('RESTAURANT_REALTIME',{type:'durable_object_namespace',class_name:'RestaurantRealtime',namespace_id:'d3ad7a4008c64124b765f934986956da'});
    expect('PUBLIC_CATALOG_COORDINATOR',{type:'durable_object_namespace',class_name:'PublicCatalogCoordinator',namespace_id:'1e226bebcddc47079def5ed60beb73df'});
    const rates=[['AUTH_RATE_LIMIT','13011',20],['BILLING_RATE_LIMIT','13012',60],['ORDERS_RATE_LIMIT','13013',30],['STORAGE_RATE_LIMIT','13014',30],['WEBHOOKS_RATE_LIMIT','13015',300],['PUBLIC_RATE_LIMIT','13016',120]];
    assert.equal(bindings.filter(b=>b.type==='ratelimit').length,rates.length);
    for(const [name,namespace_id,limit]of rates)expect(name,{type:'ratelimit',namespace_id,simple:{limit,period:60}});
    assert.deepEqual(bindings.filter(b=>b.name.startsWith('PUBLIC_CATALOG_')).map(b=>b.name).sort(),['PUBLIC_CATALOG_BUCKET','PUBLIC_CATALOG_COORDINATOR','PUBLIC_CATALOG_READER_ENABLED','PUBLIC_CATALOG_WRITER_ENABLED']);
    return {main_module:'realtime-entry.js',bindings:bindings.filter(b=>b.type!=='secret_text').map(b=>{
      const copy=structuredClone(b);
      // Namespace IDs are read-only metadata. Existing local class names resolve
      // the same namespaces; the controller must confirm their IDs afterwards.
      if(copy.type==='durable_object_namespace')delete copy.namespace_id;
      if(copy.name==='PUBLIC_CATALOG_WRITER_ENABLED')copy.text='true';
      return copy;
    }),keep_bindings:['secret_text','secret_key'],compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],
    limits:{cpu_ms:1000},logpush:false,tail_consumers:[],
    ...(settings.observability?{observability:structuredClone(settings.observability)}:{})};
  }catch{throw Error('Catalog API settings rejected');}
}

export function createCatalogWriterJournal(path){
  let claimed=false,next=0;
  async function save(file,value){const handle=await open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}}
  return {
    async claim(){try{await save(path,{operation:'production-catalog-writer-publication-v1',at:new Date().toISOString(),automaticRetry:false});claimed=true;return true;}catch(error){if(error.code==='EEXIST')return false;throw error;}},
    async record(phase){assert(claimed&&typeof phase==='string'&&next<records.length&&records[next]===phase);await save(path+'.'+phase+'.json',{phase,at:new Date().toISOString()});next++;},
  };
}

export async function runCatalogWriterPublication(args,ports={}){
  const report={ok:false,prepared:false,writerActivated:false,readerActivated:false,runtimeWriterCoverageProven:false,uncertain:false,attempted:[],confirmed:[]};
  const fail=code=>({status:1,report:{...report,code}});
  if(!Array.isArray(args)||args.length!==1||!['inspect','publish'].includes(args[0]))return fail('invalid_arguments');
  const publish=args[0]==='publish';let stage='input';
  try{
    assert(['preflight','databasePreflight','recheckOpen'].every(key=>typeof ports[key]==='function'));
    if(publish)assert(['publish','verify','recheckPair'].every(key=>typeof ports[key]==='function')&&typeof ports.journal?.claim==='function'&&typeof ports.journal?.record==='function');
    if(publish){stage='claim';if(!await ports.journal.claim())return fail('already_started');}
    stage='preflight';await ports.preflight();stage='database';await ports.databasePreflight();stage='recheck_open';await ports.recheckOpen();report.prepared=true;
    if(!publish)return {status:0,report:{...report,ok:true,readOnly:true}};
    for(stage of phases){
      if(stage==='writer')await ports.recheckPair();
      await ports.journal.record(stage+'_attempt');report.attempted.push(stage);report.uncertain=true;
      await ports.publish(stage);await ports.verify(stage);await ports.journal.record(stage+'_confirmed');
      report.confirmed.push(stage);report.uncertain=false;
    }
    return {status:0,report:{...report,ok:true,writerActivated:true}};
  }catch{return {status:1,report:{...report,stoppedAt:stage,code:stage==='input'?'missing_ports':report.uncertain?'publication_uncertain':'publication_stopped'}};}
}
