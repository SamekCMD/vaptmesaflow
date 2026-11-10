// Fixed production control-plane boundary. No auth/default fetch, CLI, SQL,
// resource administration or billing writes. The controller must verify frozen
// payloads before calling this transport; the transport alone is not readiness.
import assert from 'node:assert/strict';
const base='https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932';
const api='/workers/scripts/vapt-api-production',web='/workers/scripts/vapt-web';
const queue='/queues/69f033ad5eb6424c99b41d1baa7ff3ad',dead='/queues/ad6e9115d01f4c63a43a557f18c0a3a9';
const contents=new Set([api+'/content/v2','/workers/scripts/vapt-billing-email-production/content/v2']);
const reads=new Set(['/workers/domains','/workers/services/vapt-api-production',queue,dead,
  '/r2/buckets/vapt-catalog-production/domains/managed','/r2/buckets/vapt-catalog-production/domains/custom']);
for(const worker of ['vapt-api-production','vapt-billing-email-production','vapt-web'])for(const suffix of ['deployments','settings','subdomain','schedules'])reads.add('/workers/scripts/'+worker+'/'+suffix);
for(let page=1;page<=5;page++)reads.add('/workers/durable_objects/namespaces?per_page=100&page='+page);
const sequence=[[api+'/content','PUT'],[web+'/assets-upload-session','POST'],[web,'PUT'],[api,'PUT']];

async function bounded(response,max){
  const reader=response.body?.getReader();assert(reader);let size=0;const parts=[];
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;assert(size<=max);parts.push(p.value);}}catch{await reader.cancel().catch(()=>{});throw Error('bounded');}
  return Buffer.concat(parts);
}
function metadata(form){assert(form instanceof FormData&&typeof form.get('metadata')==='string'&&form.get('metadata').length<=65536);return JSON.parse(form.get('metadata'));}
export function createCatalogWriterTransport({mode,fetchControl}){
  assert(['inspect','publish'].includes(mode)&&typeof fetchControl==='function');
  let stage=0,failed=false,readCount=0,uploads=0;const uploaded=new Set();
  return async(path,method='GET',body,assetJwt)=>{
    let attemptedWrite=false;
    try{
      let payload=body,headers;
      if(method==='GET')assert(body===undefined&&assetJwt===undefined&&(reads.has(path)||contents.has(path))&&++readCount<=512);
      else{
        assert(mode==='publish'&&!failed);
        if(path==='/workers/assets/upload?base64=true'){
          assert(method==='POST'&&stage===2&&uploads<90&&body instanceof FormData&&typeof assetJwt==='string'&&/^[A-Za-z0-9._-]{11,8192}$/.test(assetJwt));
          const keys=[...body.keys()];assert(keys.length>0&&keys.length<=90&&new Set(keys).size===keys.length);
          for(const key of keys)assert(/^[a-f0-9]{32}$/.test(key)&&!uploaded.has(key)&&body.get(key) instanceof Blob);
          for(const key of keys)uploaded.add(key);uploads++;
        }else{
          assert(assetJwt===undefined&&sequence[stage]?.[0]===path&&sequence[stage]?.[1]===method);
          if(stage===0)assert.deepEqual(metadata(body),{main_module:'__vapt_production_maintenance__.mjs'});
          if(stage===1){assert(body&&Object.keys(body).join(',')==='manifest'&&Object.keys(body.manifest).length>0&&Object.keys(body.manifest).length<=90);assert(!Object.hasOwn(body.manifest,'/_headers')&&!Object.hasOwn(body.manifest,'/candidate-proof.json'));payload=JSON.stringify(body);headers={'Content-Type':'application/json'};}
          if(stage===2){const m=metadata(body);assert(m.assets&&typeof m.assets.jwt==='string'&&!m.main_module);}
          if(stage===3){const m=metadata(body);assert(m.main_module==='realtime-entry.js'&&Array.isArray(m.bindings)&&!Object.hasOwn(m,'migrations'));for(const [name,text]of [['PUBLIC_CATALOG_READER_ENABLED','false'],['PUBLIC_CATALOG_WRITER_ENABLED','true']])assert.deepEqual(m.bindings.filter(b=>b.name===name),[{name,type:'plain_text',text}]);}
          stage++;
        }
        attemptedWrite=true;
      }
      const r=await fetchControl(base+path,{method,...(headers?{headers}:{}),...(payload===undefined?{}:{body:payload}),...(assetJwt===undefined?{}:{assetJwt}),redirect:'error',signal:AbortSignal.timeout(method==='GET'?20000:60000)});
      assert(r.ok);const bytes=await bounded(r,contents.has(path)?8388608:1048576);
      if(contents.has(path))return {bytes,contentType:r.headers.get('content-type'),entrypoint:r.headers.get('cf-entrypoint')};
      const value=JSON.parse(bytes.toString('utf8'));assert(value.success===true&&value.result!==undefined);return value.result;
    }catch{if(attemptedWrite)failed=true;throw Error('Catalog control request rejected');}
  };
}

export function verifyCatalogControlTransition(before,after,phase){
  try{
    assert(['maintenance','frontend','writer'].includes(phase));
    const name=phase==='frontend'?'vapt-web':'vapt-api-production',deployment=after.workers[name].deployment,prior=before.workers[name].deployment;
    const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
    assert(uuid.test(deployment.id)&&deployment.id!==prior.id&&deployment.versions.length===1);
    assert(deployment.versions[0].percentage===100&&uuid.test(deployment.versions[0].version_id)&&deployment.versions[0].version_id!==prior.versions[0].version_id);
    const expected=structuredClone(before);expected.workers[name].deployment=structuredClone(deployment);
    if(phase==='writer'){
      const flag=expected.workers[name].settings.bindings.find(b=>b.name==='PUBLIC_CATALOG_WRITER_ENABLED');assert(flag?.type==='plain_text'&&flag.text==='false');flag.text='true';
    }
    assert.deepEqual(after,expected);return {verified:true,worker:name,deployment:structuredClone(deployment)};
  }catch{throw Error('Catalog control readback rejected');}
}
