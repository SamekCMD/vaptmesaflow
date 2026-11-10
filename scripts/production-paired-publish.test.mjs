import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const load = () => import('./production-paired-publish.mjs');

test('API upload preserves existing bindings, keeps secrets by type, and adds only an inert catalog', async () => {
  const { apiMetadata } = await load();
  const original = [{name:'EXISTING',type:'plain_text',text:'keep'},
    {name:'BETTER_AUTH_SECRET',type:'secret_text'},
    {name:'RESTAURANT_REALTIME',type:'durable_object_namespace',class_name:'RestaurantRealtime',namespace_id:'d3ad7a4008c64124b765f934986956da'}];
  const copy = structuredClone(original);
  const metadata = apiMetadata({compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],
    limits:{cpu_ms:1000},bindings:original}, 'stage13-realtime-production-sqlite-v1');
  assert.equal(metadata.main_module,'__vapt_production_maintenance__.mjs');
  assert.deepEqual(metadata.keep_bindings,['secret_text','secret_key']);
  assert.equal(Object.hasOwn(metadata,'observability'),false);
  assert.deepEqual(metadata.limits,{cpu_ms:1000});
  assert.deepEqual(metadata.bindings.slice(0,2), [copy[0],{name:'RESTAURANT_REALTIME',type:'durable_object_namespace',class_name:'RestaurantRealtime'}]);
  assert.deepEqual(metadata.bindings.slice(2),[
    {name:'PUBLIC_CATALOG_READER_ENABLED',type:'plain_text',text:'false'},
    {name:'PUBLIC_CATALOG_WRITER_ENABLED',type:'plain_text',text:'false'},
    {name:'PUBLIC_CATALOG_BUCKET',type:'r2_bucket',bucket_name:'vapt-catalog-production'},
    {name:'PUBLIC_CATALOG_COORDINATOR',type:'durable_object_namespace',class_name:'PublicCatalogCoordinator'}]);
  assert.deepEqual(metadata.migrations,{old_tag:'stage13-realtime-production-sqlite-v1',new_tag:'catalog-publication-production-sqlite-v1',steps:[{new_sqlite_classes:['PublicCatalogCoordinator']}]});
  assert.deepEqual(original,copy);
});

test('preserves disabled observability options but refuses enabling logs during publication',async()=>{
  const {apiMetadata}=await load();
  const settings={compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],limits:{cpu_ms:1000},bindings:[],observability:{enabled:false,head_sampling_rate:0}};
  assert.deepEqual(apiMetadata(settings,'stage13-realtime-production-sqlite-v1').observability,{enabled:false,head_sampling_rate:0});
  settings.observability.enabled=true;
  assert.throws(()=>apiMetadata(settings,'stage13-realtime-production-sqlite-v1'));
});

for (const [label, mutate, tag] of [
  ['wrong migration baseline', s=>s, 'other'],
  ['larger CPU limit', s=>{s.limits.cpu_ms=30000;return s;}, 'stage13-realtime-production-sqlite-v1'],
  ['already provisioned catalog', s=>{s.bindings.push({name:'PUBLIC_CATALOG_BUCKET',type:'r2_bucket'});return s;}, 'stage13-realtime-production-sqlite-v1'],
  ['secret value in metadata', s=>{s.bindings[0].text='private';return s;}, 'stage13-realtime-production-sqlite-v1'],
]) test('rejects '+label+' before constructing a deployable payload',async()=>{
  const {apiMetadata}=await load();
  assert.throws(()=>apiMetadata(mutate({compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],limits:{cpu_ms:1000},bindings:[{name:'KEY',type:'secret_text'}]}),tag));
});

test('multipart upload contains only selected module bytes and exact main metadata', async()=>{
  const {moduleForm}=await load();
  const form=moduleForm({main_module:'index.js'},[{name:'index.js',bytes:Buffer.from('export default {}')}]);
  assert.deepEqual([...form.keys()],['metadata','index.js']);
  assert.deepEqual(JSON.parse(form.get('metadata')),{main_module:'index.js'});
  assert.equal(form.get('index.js').type,'application/javascript+module');
  assert.equal(await form.get('index.js').text(),'export default {}');
});

test('frontend metadata carries the frozen cache rules rather than merely uploading _headers as a file',async()=>{
  const {frontendMetadata}=await load();
  assert.equal(typeof frontendMetadata,'function');
  const rules=Buffer.from('/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n');
  const result=frontendMetadata('completion-fixture-not-a-credential',rules);
  assert.deepEqual(result,{compatibility_date:'2026-09-24',compatibility_flags:[],assets:{jwt:'completion-fixture-not-a-credential',
    config:{not_found_handling:'single-page-application',_headers:rules.toString('utf8')}}});
  assert.throws(()=>frontendMetadata('',rules));
  assert.throws(()=>frontendMetadata('completion-fixture-not-a-credential',Buffer.from('/assets/*\n  Cache-Control: public\n')));
});

test('asset manifest binds bytes and MIME-sensitive extensions and rejects traversal',async()=>{
  const {assetManifest}=await load();
  const value=assetManifest([{path:'index.html',bytes:Buffer.from('hello')},{path:'assets/a.js',bytes:Buffer.from('hello')}]);
  assert.equal(value['/index.html'].size,5);
  assert.match(value['/index.html'].hash,/^[a-f0-9]{32}$/);
  assert.notEqual(value['/index.html'].hash,value['/assets/a.js'].hash);
  assert.notDeepEqual(assetManifest([{path:'index.html',bytes:Buffer.from('changed')}]),{'/index.html':value['/index.html']});
  for(const path of ['../private','/absolute','a\\b','a/../b']) assert.throws(()=>assetManifest([{path,bytes:Buffer.from('x')}]));
});

test('durable journal refuses a second claim and duplicate phases',async()=>{
  const {createPairJournal}=await load();
  const folder=await mkdtemp(join(tmpdir(),'vapt-pair-journal-'));
  const path=join(folder,'start.json'),journal=createPairJournal(path);
  assert.equal(await journal.claim(),true);
  assert.equal(await createPairJournal(path).claim(),false);
  await journal.record('api_attempt');
  await assert.rejects(journal.record('api_attempt'));
  assert.equal(JSON.parse(await readFile(path+'.api_attempt.json','utf8')).phase,'api_attempt');
});

test('frontend repair journal identifies its own operation without replacing the paired marker',async()=>{
  const {createPairJournal}=await load();
  const folder=await mkdtemp(join(tmpdir(),'vapt-front-journal-')),path=join(folder,'front.json');
  assert.equal(await createPairJournal(path,'production-frontend-cache-fix-v1').claim(),true);
  assert.equal(JSON.parse(await readFile(path,'utf8')).operation,'production-frontend-cache-fix-v1');
});

function fixture(failAt) {
  const events=[];
  return {events,ports:{journal:{claim:async()=>{events.push('claim');return true;},record:async phase=>events.push(phase)},
    preflight:async()=>{events.push('preflight');if(failAt==='preflight')throw Error('private');},
    publish:async stage=>{events.push('publish:'+stage);if(failAt===stage)throw Error('private');},
    verify:async stage=>{events.push('verify:'+stage);if(failAt==='verify:'+stage)throw Error('private');}}};
}
test('publishes API then billing then frontend only after each independent stage verification',async()=>{
  const {runPairedPublication}=await load(),{ports,events}=fixture();
  const result=await runPairedPublication(['publish'],ports);
  assert.equal(result.status,0);assert.equal(result.report.ok,true);
  assert.deepEqual(events,['preflight','claim','api_attempt','publish:api','verify:api','api_confirmed',
    'billing_attempt','publish:billing','verify:billing','billing_confirmed',
    'frontend_attempt','publish:frontend','verify:frontend','frontend_confirmed']);
  assert.equal(result.report.trafficReleased,false);assert.equal(result.report.billingResumed,false);
});
for(const stage of ['api','billing','frontend']) test('an uncertain '+stage+' write stops without retry, rollback, or later publication',async()=>{
  const {runPairedPublication}=await load(),{ports,events}=fixture(stage);
  const result=await runPairedPublication(['publish'],ports);
  assert.equal(result.status,1);assert.equal(result.report.uncertain,true);
  assert.equal(events.filter(e=>e==='publish:'+stage).length,1);
  assert.equal(events.at(-1),'publish:'+stage);
  assert(!JSON.stringify(result).includes('private'));
});
test('failed readback stops before billing even when API write returned success',async()=>{
  const {runPairedPublication}=await load(),{ports,events}=fixture('verify:api');
  const result=await runPairedPublication(['publish'],ports);
  assert.equal(result.status,1);assert.equal(events.includes('publish:billing'),false);
});
test('failed preflight and consumed journal cause no publication',async()=>{
  const {runPairedPublication}=await load();
  const first=fixture('preflight');assert.equal((await runPairedPublication(['publish'],first.ports)).report.uncertain,false);
  assert.deepEqual(first.events,['preflight']);
  const second=fixture();second.ports.journal.claim=async()=>false;
  assert.equal((await runPairedPublication(['publish'],second.ports)).status,1);
  assert.deepEqual(second.events,['preflight']);
});
test('unexpected arguments fail without invoking any ports',async()=>{
  const {runPairedPublication}=await load(),{ports,events}=fixture();
  for(const args of [[],['publish','again'],['resume'],['inspect']])assert.equal((await runPairedPublication(args,ports)).status,1);
  assert.deepEqual(events,[]);
});

test('frontend-only correction never invokes API or billing publication and requires a new exclusive journal',async()=>{
  const {runFrontendCorrection}=await load();assert.equal(typeof runFrontendCorrection,'function');
  const events=[];
  const result=await runFrontendCorrection(['publish'],{preflight:async()=>events.push('preflight'),
    journal:{claim:async()=>{events.push('claim');return true;},record:async phase=>events.push(phase)},
    publish:async()=>events.push('frontend-only-put'),verify:async()=>events.push('readback')});
  assert.equal(result.status,0);
  assert.deepEqual(events,['preflight','claim','frontend_attempt','frontend-only-put','readback','frontend_confirmed']);
  assert.equal(result.report.apiChanged,false);assert.equal(result.report.billingChanged,false);
});
test('frontend-only correction stops after uncertain PUT without a second attempt or a success marker',async()=>{
  const {runFrontendCorrection}=await load();assert.equal(typeof runFrontendCorrection,'function');
  const events=[];
  const result=await runFrontendCorrection(['publish'],{preflight:async()=>{},journal:{claim:async()=>true,record:async phase=>events.push(phase)},
    publish:async()=>{events.push('put');throw Error('private');},verify:async()=>events.push('verify')});
  assert.equal(result.status,1);assert.equal(result.report.uncertain,true);
  assert.deepEqual(events,['frontend_attempt','put']);assert(!JSON.stringify(result).includes('private'));
});
test('frontend-only correction refuses consumed journal and unintended command without writing',async()=>{
  const {runFrontendCorrection}=await load();assert.equal(typeof runFrontendCorrection,'function');
  let writes=0;const ports={preflight:async()=>{},journal:{claim:async()=>false,record:async()=>writes++},publish:async()=>writes++,verify:async()=>{}};
  assert.equal((await runFrontendCorrection(['publish'],ports)).status,1);
  assert.equal((await runFrontendCorrection(['publish','again'],ports)).status,1);
  assert.equal(writes,0);
});
