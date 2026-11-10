import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const tag='catalog-publication-production-sqlite-v1';
async function feature(){const m=await import('./catalog-writer-publication.mjs').catch(()=>({}));assert.equal(typeof m.catalogWriterApiMetadata,'function','catalog writer publication primitives missing');return m;}
function settings(){return {compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],limits:{cpu_ms:1000},logpush:false,tail_consumers:[],observability:{enabled:false,head_sampling_rate:0},bindings:[
  ...Object.entries({ENVIRONMENT:'production',REALTIME_ENABLED:'true',STRIPE_ENVIRONMENT:'test',PUBLIC_CATALOG_READER_ENABLED:'false',PUBLIC_CATALOG_WRITER_ENABLED:'false',EXISTING_VALUE:'preserved'}).map(([name,text])=>({name,type:'plain_text',text})),
  ...['BETTER_AUTH_SECRET','PUBLIC_ORDER_TOKEN_SECRET','RESEND_API_KEY','TURNSTILE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].map(name=>({name,type:'secret_text'})),
  {name:'HYPERDRIVE',type:'hyperdrive',id:'2885c609a66641b3b716190c2d467902'},
  {name:'R2_BUCKET',type:'r2_bucket',bucket_name:'vapt-assets-production'},
  {name:'PUBLIC_CATALOG_BUCKET',type:'r2_bucket',bucket_name:'vapt-catalog-production'},
  {name:'RESTAURANT_REALTIME',type:'durable_object_namespace',class_name:'RestaurantRealtime',namespace_id:'d3ad7a4008c64124b765f934986956da'},
  {name:'PUBLIC_CATALOG_COORDINATOR',type:'durable_object_namespace',class_name:'PublicCatalogCoordinator',namespace_id:'1e226bebcddc47079def5ed60beb73df'},
  ...[['AUTH_RATE_LIMIT','13011',20],['BILLING_RATE_LIMIT','13012',60],['ORDERS_RATE_LIMIT','13013',30],['STORAGE_RATE_LIMIT','13014',30],['WEBHOOKS_RATE_LIMIT','13015',300],['PUBLIC_RATE_LIMIT','13016',120]].map(([name,namespace_id,limit])=>({name,type:'ratelimit',namespace_id,simple:{limit,period:60}})),
]};}

test('writer metadata changes only writer flag, keeps secrets by type and existing DO identities without another migration',async()=>{
  const {catalogWriterApiMetadata:metadata}=await feature(),before=settings(),original=structuredClone(before),result=metadata(before,tag);
  assert.equal(result.main_module,'realtime-entry.js');assert.deepEqual(result.keep_bindings,['secret_text','secret_key']);
  assert.equal(Object.hasOwn(result,'migrations'),false);assert.equal(Object.hasOwn(result,'assets'),false);
  assert.deepEqual(result.limits,{cpu_ms:1000});assert.equal(result.logpush,false);assert.deepEqual(result.tail_consumers,[]);
  const expected=original.bindings.filter(b=>b.type!=='secret_text').map(b=>{if(b.type==='durable_object_namespace')delete b.namespace_id;if(b.name==='PUBLIC_CATALOG_WRITER_ENABLED')b.text='true';return b;});
  assert.deepEqual(result.bindings,expected);assert.deepEqual(before,settings());
  assert.deepEqual(result.observability,{enabled:false,head_sampling_rate:0});result.observability.enabled=true;
  assert.equal(before.observability.enabled,false);result.bindings[0].text='changed';assert.equal(before.bindings[0].text,'production');
});
for(const [name,mutate]of [
  ['reader already enabled',s=>{s.bindings.find(b=>b.name==='PUBLIC_CATALOG_READER_ENABLED').text='true';}],
  ['writer already enabled',s=>{s.bindings.find(b=>b.name==='PUBLIC_CATALOG_WRITER_ENABLED').text='true';}],
  ['cross environment bucket',s=>{s.bindings.find(b=>b.name==='PUBLIC_CATALOG_BUCKET').bucket_name='vapt-catalog-preview';}],
  ['missing catalog namespace',s=>{s.bindings=s.bindings.filter(b=>b.name!=='PUBLIC_CATALOG_COORDINATOR');}],
  ['changed realtime identity',s=>{s.bindings.find(b=>b.name==='RESTAURANT_REALTIME').namespace_id='11111111111111111111111111111111';}],
  ['cross environment database',s=>{s.bindings.find(b=>b.name==='HYPERDRIVE').id='preview';}],
  ['external DO script',s=>{s.bindings.find(b=>b.name==='PUBLIC_CATALOG_COORDINATOR').script_name='other';}],
  ['weaker abuse limit',s=>{s.bindings.find(b=>b.name==='PUBLIC_RATE_LIMIT').simple.limit=10000;}],
  ['larger CPU',s=>{s.limits.cpu_ms=30000;}],
  ['logging enabled',s=>{s.observability.enabled=true;}],
  ['tail enabled',s=>{s.tail_consumers=[{service:'logger'}];}],
  ['secret value exposed',s=>{s.bindings.find(b=>b.type==='secret_text').text='private-value';}],
  ['secret missing',s=>{s.bindings=s.bindings.filter(b=>b.name!=='BETTER_AUTH_SECRET');}],
  ['duplicate binding',s=>{s.bindings.push(structuredClone(s.bindings[0]));}],
  ['Stripe live',s=>{s.bindings.find(b=>b.name==='STRIPE_ENVIRONMENT').text='live';}],
])test(`metadata rejects ${name} without constructing an upload`,async()=>{
  const {catalogWriterApiMetadata:metadata}=await feature(),s=settings();mutate(s);
  assert.throws(()=>metadata(s,tag),e=>e.message==='Catalog API settings rejected');
});
test('metadata refuses old migration tag and incompatible runtime',async()=>{
  const {catalogWriterApiMetadata:metadata}=await feature();assert.throws(()=>metadata(settings(),'stage13-realtime-production-sqlite-v1'));
  const s=settings();s.compatibility_flags=[];assert.throws(()=>metadata(s,tag));
});

function fixture(failAt){
  const events=[],attempts=[];let claimed=false;
  async function step(name){events.push(name);if(name===failAt)throw Error('private-provider-detail');}
  return {events,attempts,ports:{
    journal:{claim:async()=>{events.push('claim');if(claimed)return false;claimed=true;return true;},record:step},
    preflight:()=>step('preflight'),databasePreflight:()=>step('database'),recheckOpen:()=>step('recheck_open'),recheckPair:()=>step('recheck_pair'),
    publish:async phase=>{attempts.push(phase);await step('publish:'+phase);},verify:phase=>step('verify:'+phase),
  }};
}
test('inspect checks preparation without journal or any remote write',async()=>{
  const {runCatalogWriterPublication:run}=await feature(),f=fixture(),r=await run(['inspect'],f.ports);
  assert.equal(r.status,0);assert.equal(r.report.prepared,true);assert.equal(r.report.writerActivated,false);assert.equal(r.report.readOnly,true);
  assert.deepEqual(f.events,['preflight','database','recheck_open']);assert.deepEqual(f.attempts,[]);
});
test('publication closes admission, confirms receipt-aware frontend, then enables writer only; no billing stage',async()=>{
  const {runCatalogWriterPublication:run}=await feature(),f=fixture(),r=await run(['publish'],f.ports);
  assert.equal(r.status,0);assert.equal(r.report.writerActivated,true);assert.equal(r.report.readerActivated,false);assert.equal(r.report.runtimeWriterCoverageProven,false);
  assert.equal(r.report.uncertain,false);assert.deepEqual(r.report.confirmed,['maintenance','frontend','writer']);
  assert.deepEqual(f.events,['claim','preflight','database','recheck_open',
    'maintenance_attempt','publish:maintenance','verify:maintenance','maintenance_confirmed',
    'frontend_attempt','publish:frontend','verify:frontend','frontend_confirmed','recheck_pair',
    'writer_attempt','publish:writer','verify:writer','writer_confirmed']);
  const replay=await run(['publish'],f.ports);assert.equal(replay.report.code,'already_started');assert.deepEqual(f.attempts,['maintenance','frontend','writer']);
});
for(const failAt of ['preflight','database','recheck_open','maintenance_attempt','publish:maintenance','verify:maintenance','maintenance_confirmed','frontend_attempt','publish:frontend','verify:frontend','frontend_confirmed','recheck_pair','writer_attempt','publish:writer','verify:writer','writer_confirmed'])test(`failure at ${failAt} stops without retry, rollback or a false readiness claim`,async()=>{
  const {runCatalogWriterPublication:run}=await feature(),f=fixture(failAt),r=await run(['publish'],f.ports);
  assert.equal(r.status,1);assert.equal(r.report.writerActivated,false);assert.equal(r.report.runtimeWriterCoverageProven,false);
  assert.equal(new Set(f.attempts).size,f.attempts.length);assert.doesNotMatch(JSON.stringify(r),/private-provider-detail/);
  if(!['publish:writer','verify:writer','writer_confirmed'].includes(failAt))assert(!f.attempts.includes('writer'));
  assert.deepEqual(r.report.attempted,f.attempts);
  assert.equal(r.report.uncertain,['publish:maintenance','verify:maintenance','maintenance_confirmed','publish:frontend','verify:frontend','frontend_confirmed','publish:writer','verify:writer','writer_confirmed'].includes(failAt));
});
test('invalid commands and missing ports cannot claim a marker or write',async()=>{
  const {runCatalogWriterPublication:run}=await feature();for(const args of [[],['publish','--force'],['reader-writer'],['resume'],['inspect','--token=private']]){
    const f=fixture(),r=await run(args,f.ports);assert.equal(r.status,1);assert.deepEqual(f.events,[]);assert.doesNotMatch(JSON.stringify(r),/token/);
  }
  assert.equal((await run(['publish'],{})).report.code,'missing_ports');
});
test('catalog journal claims exclusively and only records each ordered phase once',async()=>{
  const {createCatalogWriterJournal:create}=await feature(),dir=await mkdtemp(join(tmpdir(),'vapt-catalog-writer-')),path=join(dir,'start.json'),a=create(path),b=create(path);
  assert.equal(await a.claim(),true);assert.equal(await b.claim(),false);
  assert.equal(JSON.parse(await readFile(path,'utf8')).operation,'production-catalog-writer-publication-v1');
  await assert.rejects(a.record('frontend_attempt'));await assert.rejects(b.record('maintenance_attempt'));await assert.rejects(a.record('../private'));
  await a.record('maintenance_attempt');await assert.rejects(a.record('maintenance_attempt'));await a.record('maintenance_confirmed');
  assert.equal(JSON.parse(await readFile(path+'.maintenance_confirmed.json','utf8')).phase,'maintenance_confirmed');
  assert.equal(await create(path).claim(),false);
});
test('a completed journal refuses a missing phase instead of creating an undefined extra record',async()=>{
  const {createCatalogWriterJournal:create}=await feature(),dir=await mkdtemp(join(tmpdir(),'vapt-catalog-journal-end-')),journal=create(join(dir,'start.json'));
  assert.equal(await journal.claim(),true);
  for(const phase of ['maintenance_attempt','maintenance_confirmed','frontend_attempt','frontend_confirmed','writer_attempt','writer_confirmed'])await journal.record(phase);
  await assert.rejects(journal.record());
});
