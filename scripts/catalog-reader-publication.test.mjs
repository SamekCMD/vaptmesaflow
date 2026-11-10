import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {catalogWriterApiMetadata} from './catalog-writer-publication.mjs';
import {publishCatalogFrontend} from './catalog-frontend-publication.mjs';
const tag='catalog-publication-production-sqlite-v1';
async function feature(){const m=await import('./catalog-reader-publication.mjs').catch(()=>({}));assert.equal(typeof m.catalogReaderApiMetadata,'function','reader gate missing');return m;}
function settings(direction='activate'){return {compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],limits:{cpu_ms:1000},logpush:false,tail_consumers:[],observability:{enabled:false,head_sampling_rate:0},bindings:[
  ...Object.entries({ENVIRONMENT:'production',REALTIME_ENABLED:'true',STRIPE_ENVIRONMENT:'test',PUBLIC_CATALOG_READER_ENABLED:direction==='activate'?'false':'true',PUBLIC_CATALOG_WRITER_ENABLED:'true',EXISTING_VALUE:'preserved'}).map(([name,text])=>({name,type:'plain_text',text})),
  ...['BETTER_AUTH_SECRET','PUBLIC_ORDER_TOKEN_SECRET','RESEND_API_KEY','TURNSTILE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].map(name=>({name,type:'secret_text'})),
  {name:'HYPERDRIVE',type:'hyperdrive',id:'2885c609a66641b3b716190c2d467902'},
  {name:'R2_BUCKET',type:'r2_bucket',bucket_name:'vapt-assets-production'},
  {name:'PUBLIC_CATALOG_BUCKET',type:'r2_bucket',bucket_name:'vapt-catalog-production'},
  {name:'RESTAURANT_REALTIME',type:'durable_object_namespace',class_name:'RestaurantRealtime',namespace_id:'d3ad7a4008c64124b765f934986956da'},
  {name:'PUBLIC_CATALOG_COORDINATOR',type:'durable_object_namespace',class_name:'PublicCatalogCoordinator',namespace_id:'1e226bebcddc47079def5ed60beb73df'},
  ...[['AUTH_RATE_LIMIT','13011',20],['BILLING_RATE_LIMIT','13012',60],['ORDERS_RATE_LIMIT','13013',30],['STORAGE_RATE_LIMIT','13014',30],['WEBHOOKS_RATE_LIMIT','13015',300],['PUBLIC_RATE_LIMIT','13016',120]].map(([name,namespace_id,limit])=>({name,type:'ratelimit',namespace_id,simple:{limit,period:60}})),
]};}
const flag=(s,name)=>s.bindings.find(b=>b.name===name);
for(const direction of ['activate','rollback'])test(`${direction} metadata preserves writer, resources and limits without mutating baseline`,async()=>{
  const {catalogReaderApiMetadata:make}=await feature(),before=settings(direction),original=structuredClone(before),m=make(before,tag,direction);
  assert.equal(m.main_module,'realtime-entry.js');assert.equal(flag(m,'PUBLIC_CATALOG_WRITER_ENABLED').text,'true');
  assert.equal(flag(m,'PUBLIC_CATALOG_READER_ENABLED').text,direction==='activate'?'true':'false');
  const expected=structuredClone(original.bindings).filter(b=>b.type!=='secret_text').map(b=>{if(b.type==='durable_object_namespace')delete b.namespace_id;if(b.name==='PUBLIC_CATALOG_READER_ENABLED')b.text=direction==='activate'?'true':'false';return b;});
  assert.deepEqual(m.bindings,expected);assert.deepEqual(m.keep_bindings,['secret_text','secret_key']);assert.deepEqual(m.limits,{cpu_ms:1000});
  assert(!Object.hasOwn(m,'migrations')&&!Object.hasOwn(m,'routes'));assert.deepEqual(before,original);
  m.observability.enabled=true;m.bindings[0].text='changed';assert.deepEqual(before,original);
  assert.throws(()=>catalogWriterApiMetadata(before,tag));
});
for(const [label,mutate]of [
  ['writer disabled',s=>{flag(s,'PUBLIC_CATALOG_WRITER_ENABLED').text='false';}],
  ['already at target',s=>{flag(s,'PUBLIC_CATALOG_READER_ENABLED').text=flag(s,'PUBLIC_CATALOG_READER_ENABLED').text==='true'?'false':'true';}],
  ['missing reader',s=>{s.bindings=s.bindings.filter(b=>b.name!=='PUBLIC_CATALOG_READER_ENABLED');}],
  ['duplicate writer',s=>{s.bindings.push({...flag(s,'PUBLIC_CATALOG_WRITER_ENABLED')});}],
  ['preview bucket',s=>{flag(s,'PUBLIC_CATALOG_BUCKET').bucket_name='vapt-catalog-preview';}],
  ['wrong namespace',s=>{flag(s,'PUBLIC_CATALOG_COORDINATOR').namespace_id='11111111111111111111111111111111';}],
  ['wrong database',s=>{flag(s,'HYPERDRIVE').id='preview';}],
  ['higher CPU',s=>{s.limits.cpu_ms=30000;}],
  ['weaker rate',s=>{flag(s,'PUBLIC_RATE_LIMIT').simple.limit=99999;}],
  ['secret value',s=>{flag(s,'BETTER_AUTH_SECRET').text='sensitive';}],
  ['logs',s=>{s.observability.enabled=true;}],
  ['Stripe Live',s=>{flag(s,'STRIPE_ENVIRONMENT').text='live';}],
])for(const direction of ['activate','rollback'])test(`${direction} refuses ${label}`,async()=>{
  const {catalogReaderApiMetadata:make}=await feature(),s=settings(direction);mutate(s);
  assert.throws(()=>make(s,tag,direction),e=>e.message==='Catalog reader settings rejected');
});
test('metadata requires explicit direction and existing catalog migration',async()=>{
  const {catalogReaderApiMetadata:make}=await feature();for(const direction of [undefined,'publish','resume','reader-only'])assert.throws(()=>make(settings(),tag,direction));
  assert.throws(()=>make(settings(),'old-tag','activate'));
});
const deployment=id=>({id,versions:[{version_id:id,percentage:100}]});
function snapshot(direction){return {migrationTag:tag,catalogPrivate:true,queue:{delivery_paused:false},domains:['api.vapt.app.br','vapt.app.br'],namespaces:['catalog','realtime'],workers:{
  'vapt-api-production':{deployment:deployment('11111111-1111-4111-8111-111111111111'),settings:settings(direction),ingress:{enabled:false},crons:[]},
  'vapt-web':{deployment:deployment('22222222-2222-4222-8222-222222222222'),settings:{bindings:[]},crons:[]},
  'vapt-billing-email-production':{deployment:deployment('33333333-3333-4333-8333-333333333333'),crons:['*/30 * * * *']},
}};}
function transition(before,phase,direction){const after=structuredClone(before),name=phase==='frontend'?'vapt-web':'vapt-api-production';after.workers[name].deployment=deployment('44444444-4444-4444-8444-444444444444');if(phase==='api')flag(after.workers[name].settings,'PUBLIC_CATALOG_READER_ENABLED').text=direction==='activate'?'true':'false';return after;}
for(const direction of ['activate','rollback'])for(const phase of ['maintenance','frontend','api'])test(`${direction}/${phase} readback allows only one deployment and expected reader change`,async()=>{
  const {verifyCatalogReaderControlTransition:verify}=await feature(),before=snapshot(direction),after=transition(before,phase,direction);
  assert.equal(verify(before,after,phase,direction).verified,true);
  for(const mutate of [
    s=>{s.queue.delivery_paused=true;},s=>{s.catalogPrivate=false;},s=>{s.namespaces.pop();},s=>{s.migrationTag='new-tag';},
    s=>{s.workers['vapt-billing-email-production'].crons=[];},s=>{flag(s.workers['vapt-api-production'].settings,'PUBLIC_CATALOG_WRITER_ENABLED').text='false';},
    s=>{s.workers['vapt-api-production'].settings.limits.cpu_ms=30000;},s=>{s.domains.push('other');},
  ]){const bad=structuredClone(after);mutate(bad);assert.throws(()=>verify(before,bad,phase,direction));}
  assert.throws(()=>verify(before,before,phase,direction));
  const split=structuredClone(after);split.workers[phase==='frontend'?'vapt-web':'vapt-api-production'].deployment.versions[0].percentage=50;assert.throws(()=>verify(before,split,phase,direction));
});
test('readback rejects unknown phases and directions or reader with inactive writer',async()=>{
  const {verifyCatalogReaderControlTransition:verify}=await feature(),s=snapshot('activate');
  assert.throws(()=>verify(s,s,'writer','activate'));assert.throws(()=>verify(s,s,'api','resume'));
  flag(s.workers['vapt-api-production'].settings,'PUBLIC_CATALOG_WRITER_ENABLED').text='false';assert.throws(()=>verify(s,transition(s,'api','activate'),'api','activate'));
});
function fixture(direction,failAt){const events=[],writes=[];let claimed=false;async function step(name){events.push(name);if(name===failAt)throw Error('sensitive-provider-detail');}
  return {events,writes,ports:{journal:{direction,claim:async()=>{await step('claim');if(claimed)return false;claimed=true;return true;},record:step},
    preflight:()=>step('preflight'),databasePreflight:()=>step('database'),recheckOpen:()=>step('open'),recheckPair:()=>step('pair'),
    publish:async phase=>{writes.push(phase);await step('publish:'+phase);},verify:phase=>step('verify:'+phase)}};
}
for(const direction of ['activate','rollback'])test(`${direction} confirms maintenance/frontend/API serially with writer retained`,async()=>{
  const {runCatalogReaderPublication:run}=await feature(),f=fixture(direction),r=await run([direction],f.ports);
  assert.equal(r.status,0);assert.equal(r.report.ok,true);assert.equal(r.report.appliedDirection,direction);assert.equal(r.report.uncertain,false);assert.equal(r.report.runtimeWriterCoverageProven,false);
  assert.deepEqual(r.report.confirmed,['maintenance','frontend','api']);assert.deepEqual(f.writes,['maintenance','frontend','api']);
  assert.deepEqual(f.events,['claim','preflight','database','open','maintenance_attempt','publish:maintenance','verify:maintenance','maintenance_confirmed','frontend_attempt','publish:frontend','verify:frontend','frontend_confirmed','pair','api_attempt','publish:api','verify:api','api_confirmed']);
  assert.equal((await run([direction],f.ports)).report.code,'already_started');assert.deepEqual(f.writes,['maintenance','frontend','api']);
});
for(const direction of ['activate','rollback'])for(const failAt of ['claim','preflight','database','open','maintenance_attempt','publish:maintenance','verify:maintenance','maintenance_confirmed','frontend_attempt','publish:frontend','verify:frontend','frontend_confirmed','pair','api_attempt','publish:api','verify:api','api_confirmed'])test(`${direction} stops at ${failAt}, without implicit retry or rollback`,async()=>{
  const {runCatalogReaderPublication:run}=await feature(),f=fixture(direction,failAt),r=await run([direction],f.ports);
  assert.equal(r.status,1);assert.equal(r.report.appliedDirection,null);assert.equal(r.report.ok,false);assert.equal(new Set(f.writes).size,f.writes.length);
  assert.deepEqual(r.report.attempted,f.writes);assert.doesNotMatch(JSON.stringify(r),/sensitive-provider-detail/);
  assert.equal(r.report.uncertain,/^(publish:|verify:)|^(maintenance|frontend|api)_confirmed$/.test(failAt));
  if(!['publish:api','verify:api','api_confirmed'].includes(failAt))assert(!f.writes.includes('api'));
});
test('inspect has no journal or publication side effects',async()=>{
  const {runCatalogReaderPublication:run}=await feature(),f=fixture('activate'),r=await run(['inspect','activate'],f.ports);
  assert.equal(r.status,0);assert.equal(r.report.readOnly,true);assert.equal(r.report.appliedDirection,null);assert.deepEqual(f.events,['preflight','database','open']);assert.deepEqual(f.writes,[]);
});
test('bad arguments, missing ports and mismatched journal cannot begin a write',async()=>{
  const {runCatalogReaderPublication:run}=await feature();for(const args of [[],['publish'],['activate','--force'],['resume'],['inspect'],['inspect','activate','extra']]){const f=fixture('activate');assert.equal((await run(args,f.ports)).status,1);assert.deepEqual(f.events,[]);}
  const f=fixture('rollback');assert.equal((await run(['activate'],f.ports)).report.code,'missing_ports');assert.deepEqual(f.events,[]);
  assert.equal((await run(['activate'],{})).report.code,'missing_ports');
});
for(const direction of ['activate','rollback'])test(`${direction} journal is exclusive, ordered and direction-bound`,async()=>{
  const {createCatalogReaderJournal:create}=await feature(),dir=await mkdtemp(join(tmpdir(),'vapt-reader-')),path=join(dir,'start.json'),a=create(path,direction);
  assert.equal(a.direction,direction);assert.equal(await a.claim(),true);assert.equal(await create(path,direction).claim(),false);
  assert.equal(await create(path,direction==='activate'?'rollback':'activate').claim(),false);
  const receipt=JSON.parse(await readFile(path,'utf8'));assert.equal(receipt.direction,direction);assert.equal(receipt.automaticRetry,false);
  await assert.rejects(a.record('api_attempt'));await assert.rejects(a.record('../private'));
  for(const name of ['maintenance','frontend','api']){await a.record(name+'_attempt');await assert.rejects(a.record(name+'_attempt'));await a.record(name+'_confirmed');}
  await assert.rejects(a.record());assert.equal(JSON.parse(await readFile(path+'.api_confirmed.json','utf8')).phase,'api_confirmed');
  assert.throws(()=>create(join(dir,'other.json'),'resume'));
});

for(const direction of ['activate','rollback'])test(`${direction} composes actual metadata, file journal, uploader and snapshot verification without provider access`,async()=>{
  const {catalogReaderApiMetadata:make,createCatalogReaderJournal:create,runCatalogReaderPublication:run,verifyCatalogReaderControlTransition:verify}=await feature();
  const dir=await mkdtemp(join(tmpdir(),'vapt-reader-composed-')),path=join(dir,'start.json');
  let state=snapshot(direction),prior,metadata,uploads=0,frontendPublished=false;
  const original=structuredClone(state),files=[
    {path:'_headers',bytes:Buffer.from('/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n')},
    {path:'index.html',bytes:Buffer.from('<html>reader candidate fixture</html>')},
  ];
  const ports={journal:create(path,direction),preflight:async value=>{assert.equal(value,direction);metadata=make(state.workers['vapt-api-production'].settings,state.migrationTag,value);},
    databasePreflight:async value=>assert.equal(value,direction),recheckOpen:async()=>assert.deepEqual(state,original),
    recheckPair:async()=>{assert(frontendPublished);assert.equal(flag(state.workers['vapt-api-production'].settings,'PUBLIC_CATALOG_WRITER_ENABLED').text,'true');},
    publish:async(phase,value)=>{
      assert.equal(value,direction);prior=structuredClone(state);
      if(phase==='frontend')await publishCatalogFrontend(files,{
        createSession:async manifest=>{assert.deepEqual(Object.keys(manifest),['/index.html']);return {jwt:'offline-fixture-not-a-credential',buckets:[[manifest['/index.html'].hash]]};},
        uploadBucket:async form=>{assert.equal([...form].length,1);uploads++;return {jwt:'offline-completion-not-a-credential'};},
        publish:async form=>{assert.equal(JSON.parse(form.get('metadata')).assets.jwt,'offline-completion-not-a-credential');frontendPublished=true;},
      });
      const worker=phase==='frontend'?'vapt-web':'vapt-api-production',n=phase==='maintenance'?'4':phase==='frontend'?'5':'6';
      state.workers[worker].deployment=deployment(n.repeat(8)+'-'+n.repeat(4)+'-4'+n.repeat(3)+'-8'+n.repeat(3)+'-'+n.repeat(12));
      if(phase==='api')flag(state.workers[worker].settings,'PUBLIC_CATALOG_READER_ENABLED').text=flag(metadata,'PUBLIC_CATALOG_READER_ENABLED').text;
    },verify:async(phase,value)=>assert.equal(verify(prior,state,phase,value).verified,true),
  };
  const result=await run([direction],ports);assert.equal(result.status,0);assert.equal(uploads,1);
  assert.equal(flag(state.workers['vapt-api-production'].settings,'PUBLIC_CATALOG_WRITER_ENABLED').text,'true');
  assert.equal(flag(state.workers['vapt-api-production'].settings,'PUBLIC_CATALOG_READER_ENABLED').text,direction==='activate'?'true':'false');
  assert.deepEqual(state.workers['vapt-billing-email-production'],original.workers['vapt-billing-email-production']);
  assert.equal(JSON.parse(await readFile(path+'.api_confirmed.json','utf8')).direction,direction);
  ports.journal=create(path,direction);assert.equal((await run([direction],ports)).report.code,'already_started');assert.equal(uploads,1);
});
