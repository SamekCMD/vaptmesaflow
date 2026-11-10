import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleForm} from './production-paired-publish.mjs';
const api='/workers/scripts/vapt-api-production',web='/workers/scripts/vapt-web';
async function feature(){const m=await import('./catalog-writer-controls.mjs').catch(()=>({}));assert.equal(typeof m.createCatalogWriterTransport,'function','fixed catalog transport missing');return m;}
test('inspect can only read fixed production metadata and bounded module contents',async()=>{
  const {createCatalogWriterTransport:create}=await feature(),calls=[];
  const request=create({mode:'inspect',fetchControl:async(url,init)=>{calls.push({url,init});return Response.json({success:true,result:{checked:true}});}});
  assert.deepEqual(await request(api+'/settings'),{checked:true});assert.equal(calls[0].url,'https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932'+api+'/settings');
  assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.redirect,'error');assert(calls[0].init.signal instanceof AbortSignal);
  for(const [path,method,body]of [[api+'/content','PUT',moduleForm({main_module:'x.js'},[])],['/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{}],['/workers/scripts/vapt-api-parallel/settings','GET'],['/workers/durable_objects/namespaces?per_page=100&page=6','GET']])await assert.rejects(request(path,method,body));
  assert.equal(calls.length,1);
});
test('readback content is bounded and returned without trying to parse modules as JSON',async()=>{
  const {createCatalogWriterTransport:create}=await feature(),request=create({mode:'inspect',fetchControl:async()=>new Response('module-bytes',{headers:{'Content-Type':'multipart/form-data; boundary=fixture','cf-entrypoint':'realtime-entry.js'}})});
  const r=await request(api+'/content/v2');assert.equal(r.bytes.toString(),'module-bytes');assert.equal(r.entrypoint,'realtime-entry.js');assert.match(r.contentType,/multipart/);
});
test('only three fixed publication endpoints and assets writes are admitted in publish mode',async()=>{
  const {createCatalogWriterTransport:create}=await feature(),calls=[];
  const request=create({mode:'publish',fetchControl:async(url,init)=>{calls.push({url,init});return Response.json({success:true,result:{accepted:true}});}});
  await request(api+'/content','PUT',moduleForm({main_module:'__vapt_production_maintenance__.mjs'},[]));
  await request(web+'/assets-upload-session','POST',{manifest:{'/index.html':{hash:'11111111111111111111111111111111',size:3}}});
  const upload=new FormData();upload.set('11111111111111111111111111111111',new Blob(['YWJj']),'11111111111111111111111111111111');
  await request('/workers/assets/upload?base64=true','POST',upload,'session-fixture-not-a-credential');
  await request(web,'PUT',moduleForm({assets:{jwt:'completion-fixture-not-a-credential'}},[]));
  await request(api,'PUT',moduleForm({main_module:'realtime-entry.js',bindings:[{name:'PUBLIC_CATALOG_WRITER_ENABLED',type:'plain_text',text:'true'},{name:'PUBLIC_CATALOG_READER_ENABLED',type:'plain_text',text:'false'}]},[]));
  assert.deepEqual(calls.map(c=>[c.url.split('/accounts/')[1],c.init.method]),[
    ['3ce69408aa5112617a282957aba71932'+api+'/content','PUT'],['3ce69408aa5112617a282957aba71932'+web+'/assets-upload-session','POST'],
    ['3ce69408aa5112617a282957aba71932/workers/assets/upload?base64=true','POST'],['3ce69408aa5112617a282957aba71932'+web,'PUT'],['3ce69408aa5112617a282957aba71932'+api,'PUT']]);
  assert.equal(calls[1].init.headers['Content-Type'],'application/json');assert.equal(calls[2].init.assetJwt,'session-fixture-not-a-credential');
});
test('lost write responses are consumed before awaiting and cannot be retried',async()=>{
  const {createCatalogWriterTransport:create}=await feature();let calls=0;
  const request=create({mode:'publish',fetchControl:async()=>{calls++;throw Error('private-credential');}}),form=moduleForm({main_module:'__vapt_production_maintenance__.mjs'},[]);
  await assert.rejects(request(api+'/content','PUT',form),e=>e.message==='Catalog control request rejected');await assert.rejects(request(api+'/content','PUT',form));assert.equal(calls,1);
});
test('billing changes, resource changes and reader activation cannot pass the publication boundary',async()=>{
  const {createCatalogWriterTransport:create}=await feature();let calls=0;const request=create({mode:'publish',fetchControl:async()=>{calls++;return Response.json({success:true,result:{}});}});
  for(const [path,method,body]of [[api+'/subdomain','POST',{}],['/workers/scripts/vapt-billing-email-production','PUT',new FormData()],['/queues/69f033ad5eb6424c99b41d1baa7ff3ad','PATCH',{}],['/r2/buckets','POST',{}],
    [api,'PUT',moduleForm({main_module:'realtime-entry.js',bindings:[{name:'PUBLIC_CATALOG_READER_ENABLED',type:'plain_text',text:'true'}]},[])],
    [api+'/content','PUT',moduleForm({main_module:'old.js'},[])]])await assert.rejects(request(path,method,body));
  assert.equal(calls,0);
});
test('provider failures and oversized JSON cannot leak response contents',async()=>{
  const {createCatalogWriterTransport:create}=await feature();for(const response of [()=>Response.json({success:false,errors:[{message:'private-token'}]}),()=>new Response('private-token',{status:403}),()=>new Response('x'.repeat(1048577))]){
    const request=create({mode:'inspect',fetchControl:async()=>response()});await assert.rejects(request(api+'/settings'),e=>e.message==='Catalog control request rejected');
  }
});
function state(){return {workers:{'vapt-api-production':{deployment:{id:'11111111-1111-4111-8111-111111111111',versions:[{version_id:'22222222-2222-4222-8222-222222222222',percentage:100}]},settings:{bindings:[{name:'PUBLIC_CATALOG_WRITER_ENABLED',type:'plain_text',text:'false'},{name:'PUBLIC_CATALOG_READER_ENABLED',type:'plain_text',text:'false'}],limits:{cpu_ms:1000}},crons:[]},'vapt-web':{deployment:{id:'33333333-3333-4333-8333-333333333333',versions:[{version_id:'44444444-4444-4444-8444-444444444444',percentage:100}]},settings:{bindings:[]}},'vapt-billing-email-production':{deployment:{id:'55555555-5555-4555-8555-555555555555',versions:[{version_id:'66666666-6666-4666-8666-666666666666',percentage:100}]},crons:['*/30 * * * *']}},queue:{delivery_paused:false},catalogPrivate:true,namespaces:[{id:'1e226bebcddc47079def5ed60beb73df'}]};}
function changed(before,phase){const after=structuredClone(before),name=phase==='frontend'?'vapt-web':'vapt-api-production';after.workers[name].deployment={id:'77777777-7777-4777-8777-777777777777',versions:[{version_id:'88888888-8888-4888-8888-888888888888',percentage:100}]};if(phase==='writer')after.workers[name].settings.bindings.find(b=>b.name==='PUBLIC_CATALOG_WRITER_ENABLED').text='true';return after;}
for(const phase of ['maintenance','frontend','writer'])test(`readback accepts only the ${phase} deployment and its exact allowed delta`,async()=>{
  const {verifyCatalogControlTransition:verify}=await feature(),before=state(),after=changed(before,phase);assert.equal(verify(before,after,phase).verified,true);assert.equal(before.workers['vapt-api-production'].settings.bindings[0].text,'false');
  for(const mutate of [s=>{s.queue.delivery_paused=true;},s=>{s.workers['vapt-billing-email-production'].crons=[];},s=>{s.namespaces[0].id='foreign';},s=>{s.workers['vapt-api-production'].settings.limits.cpu_ms=30000;},s=>{s.catalogPrivate=false;},s=>{s.workers['vapt-api-production'].settings.bindings[1].text='true';}]){const bad=structuredClone(after);mutate(bad);assert.throws(()=>verify(before,bad,phase));}
  assert.throws(()=>verify(before,before,phase));const split=structuredClone(after);split.workers[phase==='frontend'?'vapt-web':'vapt-api-production'].deployment.versions[0].percentage=50;assert.throws(()=>verify(before,split,phase));
});
