import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleForm,frontendMetadata} from './production-paired-publish.mjs';
import {catalogReaderApiMetadata} from './catalog-reader-publication.mjs';
const api='/workers/scripts/vapt-api-production',web='/workers/scripts/vapt-web';
const canonical={name:'realtime-entry.js',bytes:Buffer.from('export const fixture = true;')},wrapper={name:'__vapt_production_maintenance__.mjs',bytes:Buffer.from('export default {};')};
const hash='11111111111111111111111111111111',tag='catalog-publication-production-sqlite-v1';
async function feature(){const m=await import('./catalog-reader-controls.mjs').catch(()=>({}));assert.equal(typeof m.createCatalogReaderTransport,'function','reader transport missing');return m.createCatalogReaderTransport;}
function settings(direction){return {compatibility_date:'2026-09-28',compatibility_flags:['nodejs_compat'],limits:{cpu_ms:1000},logpush:false,tail_consumers:[],bindings:[
  ...Object.entries({ENVIRONMENT:'production',REALTIME_ENABLED:'true',STRIPE_ENVIRONMENT:'test',PUBLIC_CATALOG_READER_ENABLED:direction==='activate'?'false':'true',PUBLIC_CATALOG_WRITER_ENABLED:'true'}).map(([name,text])=>({name,type:'plain_text',text})),
  ...['BETTER_AUTH_SECRET','PUBLIC_ORDER_TOKEN_SECRET','RESEND_API_KEY','TURNSTILE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].map(name=>({name,type:'secret_text'})),
  {name:'HYPERDRIVE',type:'hyperdrive',id:'2885c609a66641b3b716190c2d467902'},
  {name:'R2_BUCKET',type:'r2_bucket',bucket_name:'vapt-assets-production'},
  {name:'PUBLIC_CATALOG_BUCKET',type:'r2_bucket',bucket_name:'vapt-catalog-production'},
  {name:'RESTAURANT_REALTIME',type:'durable_object_namespace',class_name:'RestaurantRealtime',namespace_id:'d3ad7a4008c64124b765f934986956da'},
  {name:'PUBLIC_CATALOG_COORDINATOR',type:'durable_object_namespace',class_name:'PublicCatalogCoordinator',namespace_id:'1e226bebcddc47079def5ed60beb73df'},
  ...[['AUTH_RATE_LIMIT','13011',20],['BILLING_RATE_LIMIT','13012',60],['ORDERS_RATE_LIMIT','13013',30],['STORAGE_RATE_LIMIT','13014',30],['WEBHOOKS_RATE_LIMIT','13015',300],['PUBLIC_RATE_LIMIT','13016',120]].map(([name,namespace_id,limit])=>({name,type:'ratelimit',namespace_id,simple:{limit,period:60}})),
]};}
function maintenance(){return moduleForm({main_module:wrapper.name},[canonical,wrapper]);}
function frontend(){return moduleForm(frontendMetadata('offline-completion-not-a-credential',Buffer.from('/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n')),[]);}
function upload(key=hash){const form=new FormData();form.set(key,new Blob(['YWJj'],{type:'text/html'}),key);return form;}
async function fixture(direction='activate',fetcher){const calls=[],controller=new AbortController(),create=await feature();return {calls,controller,request:create({mode:'publish',direction,apiSettings:settings(direction),migrationTag:tag,signal:controller.signal,fetchControl:fetcher??(async(url,init)=>{calls.push({url,init});return Response.json({success:true,result:{accepted:true}});})})};}
async function beforeFinal(f){await f.request(api+'/content','PUT',maintenance());await f.request(web+'/assets-upload-session','POST',{manifest:{'/index.html':{hash,size:3}}});await f.request(web,'PUT',frontend());}
for(const direction of ['activate','rollback'])test(`${direction} admits only serial fixed production writes with exact target metadata`,async()=>{
  const f=await fixture(direction);await f.request(api+'/content','PUT',maintenance());await f.request(web+'/assets-upload-session','POST',{manifest:{'/index.html':{hash,size:3}}});
  await f.request('/workers/assets/upload?base64=true','POST',upload(),'offline-session-not-a-credential');await f.request(web,'PUT',frontend());
  await f.request(api,'PUT',moduleForm(catalogReaderApiMetadata(settings(direction),tag,direction),[canonical]));
  assert.deepEqual(f.calls.map(c=>[new URL(c.url).pathname.split('/accounts/')[1],c.init.method]),[
    ['3ce69408aa5112617a282957aba71932'+api+'/content','PUT'],['3ce69408aa5112617a282957aba71932'+web+'/assets-upload-session','POST'],['3ce69408aa5112617a282957aba71932/workers/assets/upload','POST'],['3ce69408aa5112617a282957aba71932'+web,'PUT'],['3ce69408aa5112617a282957aba71932'+api,'PUT'],
  ]);assert(f.calls.every(c=>c.init.redirect==='error'&&c.init.signal instanceof AbortSignal));
  await assert.rejects(f.request(api,'PUT',moduleForm(catalogReaderApiMetadata(settings(direction),tag,direction),[canonical])));assert.equal(f.calls.length,5);
});
test('inspect reuses fixed GET surface and rejects every write before fetch',async()=>{
  const create=await feature(),calls=[],request=create({mode:'inspect',direction:'activate',signal:new AbortController().signal,fetchControl:async(url,init)=>{calls.push({url,init});return Response.json({success:true,result:{checked:true}});}});
  assert.deepEqual(await request(api+'/settings'),{checked:true});
  for(const [path,method,body]of [[api+'/content','PUT',maintenance()],['/workers/scripts/vapt-api-parallel/settings','GET'],['/r2/buckets','POST',{}],['/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{}]])await assert.rejects(request(path,method,body));assert.equal(calls.length,1);
  assert.throws(()=>create({mode:'publish',direction:'activate',signal:new AbortController().signal,fetchControl:async()=>{}}));
  assert.throws(()=>create({mode:'inspect',direction:'activate',fetchControl:async()=>{}}));
});
for(const [label,mutate]of [
  ['writer off',m=>{m.bindings.find(b=>b.name==='PUBLIC_CATALOG_WRITER_ENABLED').text='false';}],
  ['reader unchanged',m=>{m.bindings.find(b=>b.name==='PUBLIC_CATALOG_READER_ENABLED').text='false';}],
  ['different bucket',m=>{m.bindings.find(b=>b.name==='PUBLIC_CATALOG_BUCKET').bucket_name='vapt-catalog-preview';}],
  ['secret value',m=>{m.bindings.push({name:'BETTER_AUTH_SECRET',type:'secret_text',text:'sensitive'});}],
  ['migration',m=>{m.migrations={new_tag:'unsafe'};}],['higher CPU',m=>{m.limits.cpu_ms=30000;}],
])test(`final API rejects ${label} without another fetch`,async()=>{
  const f=await fixture(),m=catalogReaderApiMetadata(settings('activate'),tag,'activate');await beforeFinal(f);mutate(m);
  await assert.rejects(f.request(api,'PUT',moduleForm(m,[canonical])));assert.equal(f.calls.length,3);
});
test('unrelated endpoints and malformed/extra modules cannot reach provider',async()=>{
  const f=await fixture();for(const [path,method,form]of [[api,'DELETE',{}],[web,'PUT',frontend()],['/workers/scripts/vapt-billing-email-production','PUT',maintenance()],['/r2/buckets','POST',{}],
    [api+'/content','PUT',moduleForm({main_module:wrapper.name},[])],[api+'/content','PUT',moduleForm({main_module:wrapper.name},[canonical,wrapper,{name:'extra.js',bytes:Buffer.from('x')}])]])await assert.rejects(f.request(path,method,form));assert.equal(f.calls.length,0);
});
test('manifest privacy/size limits and unknown or duplicate asset uploads are refused',async()=>{
  const f=await fixture();await f.request(api+'/content','PUT',maintenance());
  for(const manifest of [{},{'/candidate-proof.json':{hash,size:3}},{'/_headers':{hash,size:3}},Object.fromEntries(Array.from({length:91},(_,i)=>['/x'+i,{hash,size:3}])),{'/index.html':{hash,size:4194305}}])await assert.rejects(f.request(web+'/assets-upload-session','POST',{manifest}));
  assert.equal(f.calls.length,1);await f.request(web+'/assets-upload-session','POST',{manifest:{'/index.html':{hash,size:3}}});
  await assert.rejects(f.request('/workers/assets/upload?base64=true','POST',upload('22222222222222222222222222222222'),'offline-session-not-a-credential'));
  await f.request('/workers/assets/upload?base64=true','POST',upload(),'offline-session-not-a-credential');await assert.rejects(f.request('/workers/assets/upload?base64=true','POST',upload(),'offline-session-not-a-credential'));assert.equal(f.calls.length,3);
});
for(const failure of ['lost response','provider error','oversized response'])test(`${failure} consumes write and forbids retry while GET remains available`,async()=>{
  let calls=0;const f=await fixture('activate',async(_url,init)=>{calls++;if(init.method==='GET')return Response.json({success:true,result:{}});if(failure==='lost response')throw Error('sensitive');return failure==='provider error'?Response.json({success:false,errors:[{message:'sensitive'}]}):new Response('x'.repeat(1048577));});
  await assert.rejects(f.request(api+'/content','PUT',maintenance()),e=>e.message==='Catalog reader control request rejected');await assert.rejects(f.request(api+'/content','PUT',maintenance()));assert.equal(calls,1);await f.request(api+'/settings');assert.equal(calls,2);
});
test('overlapping writes cannot advance to assets session before maintenance response',async()=>{
  let resolveFetch;const f=await fixture('activate',()=>new Promise(resolve=>{resolveFetch=resolve;})),pending=f.request(api+'/content','PUT',maintenance());
  await assert.rejects(f.request(web+'/assets-upload-session','POST',{manifest:{'/index.html':{hash,size:3}}}));resolveFetch(Response.json({success:true,result:{}}));await pending;
});
test('global abort before start or during unresolved fetch stops once and cannot publish later',async()=>{
  let calls=0;const f=await fixture('activate',async()=>{calls++;return new Promise(()=>{});});
  const pending=f.request(api+'/content','PUT',maintenance());f.controller.abort();await assert.rejects(pending);assert.equal(calls,1);await assert.rejects(f.request(web+'/assets-upload-session','POST',{manifest:{'/index.html':{hash,size:3}}}));assert.equal(calls,1);
  const fresh=await fixture();fresh.controller.abort();await assert.rejects(fresh.request(api+'/content','PUT',maintenance()));assert.equal(fresh.calls.length,0);
});
test('global abort cancels a stalled write response body and stops without retry',async()=>{
  let cancelled=false,bodyStarted;const began=new Promise(resolve=>{bodyStarted=resolve;});
  const f=await fixture('activate',async()=>new Response(new ReadableStream({pull(){bodyStarted();return new Promise(()=>{});},cancel(){cancelled=true;}})));
  const pending=f.request(api+'/content','PUT',maintenance());await began;f.controller.abort();await assert.rejects(pending);assert.equal(cancelled,true);
});
test('synchronous cancellation in adapter still consumes its rejected promise',async()=>{
  const create=await feature(),controller=new AbortController();let calls=0;
  const request=create({mode:'publish',direction:'activate',apiSettings:settings('activate'),migrationTag:tag,signal:controller.signal,fetchControl:async()=>{calls++;controller.abort();throw Error('sensitive');}});
  await assert.rejects(request(api+'/content','PUT',maintenance()));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
});
