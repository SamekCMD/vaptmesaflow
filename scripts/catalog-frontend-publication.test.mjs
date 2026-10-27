import test from 'node:test';
import assert from 'node:assert/strict';
async function feature(){const m=await import('./catalog-frontend-publication.mjs').catch(()=>({}));assert.equal(typeof m.publishCatalogFrontend,'function','catalog frontend uploader missing');return m;}
function files(){return [{path:'_headers',bytes:Buffer.from('/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n')},{path:'index.html',bytes:Buffer.from('<html>candidate</html>')},{path:'assets/app.js',bytes:Buffer.from('export default 1')}];}
function fixture(buckets,failAt){
  const calls=[],published=[];let manifest;
  return{calls,published,ports:{
    createSession:async value=>{calls.push('session');manifest=value;if(failAt==='session')throw Error('private-jwt');return {jwt:'session-fixture-not-a-real-credential',buckets:buckets(value)};},
    uploadBucket:async(form,jwt)=>{calls.push({files:await Promise.all([...form].map(async([hash,file])=>({hash,type:file.type,value:Buffer.from(await file.text(),'base64').toString('utf8')}))),jwt});if(failAt==='upload')throw Error('private-jwt');return {jwt:'completion-fixture-not-a-real-credential'};},
    publish:async form=>{calls.push('publish');published.push(form);if(failAt==='publish')throw Error('private-jwt');},
  },manifest:()=>manifest};
}
test('assets upload excludes private headers, transmits requested bytes once, and publishes headers in metadata',async()=>{
  const {publishCatalogFrontend:publish}=await feature(),f=fixture(m=>[[m['/index.html'].hash],[m['/assets/app.js'].hash]]),r=await publish(files(),f.ports);
  assert.deepEqual(Object.keys(f.manifest()),['/index.html','/assets/app.js']);assert.equal(r.publicAssets,2);assert.equal(r.uploadedAssets,2);assert.equal(r.uploadedBatches,2);
  assert.deepEqual(f.calls.filter(c=>typeof c==='object').map(c=>c.files.map(x=>[x.type,x.value])),[[['text/html','<html>candidate</html>']],[['application/javascript','export default 1']]]);
  assert(f.calls.filter(c=>typeof c==='object').every(c=>c.jwt==='session-fixture-not-a-real-credential'));
  const form=f.published[0];assert.deepEqual([...form.keys()],['metadata']);const metadata=JSON.parse(form.get('metadata'));
  assert.equal(metadata.assets.jwt,'completion-fixture-not-a-real-credential');assert.equal(metadata.assets.config._headers,'/assets/*\n  Cache-Control: public, max-age=31556952, immutable\n');
  assert.equal(metadata.assets.config.not_found_handling,'single-page-application');assert.doesNotMatch(JSON.stringify(r),/fixture|jwt/);
});
test('cached assets require no upload and use the session completion token',async()=>{
  const {publishCatalogFrontend:publish}=await feature(),f=fixture(()=>[]),r=await publish(files(),f.ports);
  assert.deepEqual(f.calls,['session','publish']);assert.equal(r.uploadedAssets,0);
  assert.equal(JSON.parse(f.published[0].get('metadata')).assets.jwt,'session-fixture-not-a-real-credential');
});
for(const [label,mutate]of [
  ['proof file',f=>{f.push({path:'candidate-proof.json',bytes:Buffer.from('{}')});}],
  ['missing headers',f=>{f.shift();}],
  ['headers without immutable policy',f=>{f[0].bytes=Buffer.from('invalid');}],
  ['missing index',f=>{f.splice(1,1);}],
  ['traversal',f=>{f.push({path:'../private',bytes:Buffer.from('private')});}],
  ['duplicate path',f=>{f.push({...f[1]});}],
  ['oversize file',f=>{f[1].bytes=Buffer.alloc(4194305);}],
])test(`invalid ${label} is refused before an asset session`,async()=>{
  const {publishCatalogFrontend:publish}=await feature(),f=fixture(()=>[]),input=files();mutate(input);
  await assert.rejects(publish(input,f.ports),e=>e.message==='Catalog frontend publication stopped');assert.deepEqual(f.calls,[]);
});
for(const [label,buckets]of [
  ['unknown hash',()=>[['11111111111111111111111111111111']]],
  ['duplicate requested hash',m=>[[m['/index.html'].hash],[m['/index.html'].hash]]],
  ['empty bucket',()=>[[]]],
  ['invalid bucket shape',m=>[m['/index.html'].hash]],
  ['private config hash',()=>[['_headers']]],
])test(`invalid ${label} from session cannot upload or publish`,async()=>{
  const {publishCatalogFrontend:publish}=await feature(),f=fixture(buckets);
  await assert.rejects(publish(files(),f.ports));assert.deepEqual(f.calls,['session']);
});
for(const failAt of ['session','upload','publish'])test(`lost ${failAt} response never retries or returns provider credentials`,async()=>{
  const {publishCatalogFrontend:publish}=await feature(),f=fixture(m=>[[m['/index.html'].hash]],failAt);
  await assert.rejects(publish(files(),f.ports),e=>e.message==='Catalog frontend publication stopped');
  assert.equal(f.calls.filter(c=>c==='session').length,1);assert(f.calls.filter(c=>typeof c==='object').length<=1);assert(f.calls.filter(c=>c==='publish').length<=1);
  if(failAt!=='publish')assert.equal(f.published.length,0);
});
test('a missing final completion token cannot authorize frontend publication',async()=>{
  const {publishCatalogFrontend:publish}=await feature(),f=fixture(m=>[[m['/index.html'].hash],[m['/assets/app.js'].hash]]);let n=0;
  f.ports.uploadBucket=async()=>++n===1?{jwt:'premature-completion-not-usable'}:{};
  await assert.rejects(publish(files(),f.ports));assert.equal(n,2);assert.deepEqual(f.published,[]);
});
test('source buffers cannot change bytes after an upload session is requested',async()=>{
  const {publishCatalogFrontend:publish}=await feature(),input=files(),f=fixture(m=>[[m['/index.html'].hash]]),session=f.ports.createSession;
  f.ports.createSession=async m=>{const result=await session(m);input[1].bytes.fill(0);return result;};
  await publish(input,f.ports);assert.equal(f.calls.find(c=>typeof c==='object').files[0].value,'<html>candidate</html>');
});
