// Production reader boundary. No auth, CLI or default fetch. Frozen bytes and
// actual readiness still belong to the enclosing reviewed controller.
import assert from 'node:assert/strict';
import {createCatalogWriterTransport} from './catalog-writer-controls.mjs';
import {catalogReaderApiMetadata} from './catalog-reader-publication.mjs';
import {frontendMetadata} from './production-paired-publish.mjs';
const base='https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932';
const api='/workers/scripts/vapt-api-production',web='/workers/scripts/vapt-web';
const sequence=[[api+'/content','PUT'],[web+'/assets-upload-session','POST'],[web,'PUT'],[api,'PUT']];
function abortable(promise,signal){
  return new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(Error('cancelled'));};
    // Even a signal aborted synchronously by the adapter must consume the
    // adapter's eventual rejection; returning early would leave it unhandled.
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}
async function bounded(response,signal){
  const reader=response.body?.getReader();assert(reader);let size=0;const parts=[];
  try{for(;;){const p=await abortable(reader.read(),signal);if(p.done)break;size+=p.value.length;assert(size<=1048576);parts.push(p.value);}}
  catch{void reader.cancel().catch(()=>{});throw Error('bounded');}
  finally{try{reader.releaseLock();}catch{}}
  return Buffer.concat(parts);
}
function metadata(form){assert(form instanceof FormData&&typeof form.get('metadata')==='string'&&form.get('metadata').length<=65536);return JSON.parse(form.get('metadata'));}
function modules(form,names){
  assert.deepEqual([...form.keys()].sort(),['metadata',...names].sort());let total=0;
  for(const name of names){const b=form.get(name);assert(b instanceof Blob&&b.type==='application/javascript+module'&&b.size>0&&b.size<=5242880);total+=b.size;}
  assert(total<=8388608);
}
export function createCatalogReaderTransport({mode,direction,apiSettings,migrationTag,signal,fetchControl}){
  let expected;
  try{assert(['inspect','publish'].includes(mode)&&['activate','rollback'].includes(direction)&&signal instanceof AbortSignal&&typeof fetchControl==='function');if(mode==='publish')expected=catalogReaderApiMetadata(apiSettings,migrationTag,direction);}
  catch{throw Error('Catalog reader transport settings rejected');}
  const read=createCatalogWriterTransport({mode:'inspect',fetchControl:(url,init)=>fetchControl(url,{...init,signal:AbortSignal.any([signal,init.signal])})});
  let stage=0,failed=false,inFlight=false,uploads=0;const allowed=new Set(),uploaded=new Set();
  return async(path,method='GET',body,assetJwt)=>{
    let attempted=false;
    try{
      assert(!signal.aborted);
      if(method==='GET')return await abortable(read(path,method,body,assetJwt),signal);
      assert(mode==='publish'&&!failed&&!inFlight);let payload=body,headers;
      if(path==='/workers/assets/upload?base64=true'){
        assert(method==='POST'&&stage===2&&uploads<90&&body instanceof FormData&&typeof assetJwt==='string'&&/^[A-Za-z0-9._-]{11,8192}$/.test(assetJwt));
        const keys=[...body.keys()];assert(keys.length>0&&keys.length<=90&&new Set(keys).size===keys.length);
        for(const key of keys)assert(allowed.has(key)&&!uploaded.has(key)&&body.get(key) instanceof Blob);
        for(const key of keys)uploaded.add(key);uploads++;
      }else{
        assert(assetJwt===undefined&&sequence[stage]?.[0]===path&&sequence[stage]?.[1]===method);
        if(stage===0){assert.deepEqual(metadata(body),{main_module:'__vapt_production_maintenance__.mjs'});modules(body,['realtime-entry.js','__vapt_production_maintenance__.mjs']);}
        if(stage===1){
          assert(body&&Object.keys(body).join(',')==='manifest'&&body.manifest&&typeof body.manifest==='object'&&!Array.isArray(body.manifest));
          const entries=Object.entries(body.manifest);assert(entries.length>0&&entries.length<=90);
          for(const [path,value]of entries){
            assert(path.startsWith('/')&&path.slice(1).split('/').every(p=>p&&!p.startsWith('.'))&&!path.includes('\\')&&!['/_headers','/candidate-proof.json'].includes(path));
            assert(value&&Object.keys(value).sort().join(',')==='hash,size'&&/^[a-f0-9]{32}$/.test(value.hash)&&Number.isSafeInteger(value.size)&&value.size>=0&&value.size<=4194304);
          }
          for(const [,value]of entries)allowed.add(value.hash);
          payload=JSON.stringify(body);headers={'Content-Type':'application/json'};
        }
        if(stage===2){const m=metadata(body);assert.deepEqual([...body.keys()],['metadata']);assert.deepEqual(m,frontendMetadata(m.assets?.jwt,Buffer.from(m.assets?.config?._headers??'')));}
        if(stage===3){assert.deepEqual(metadata(body),expected);modules(body,['realtime-entry.js']);}
        stage++;
      }
      attempted=true;inFlight=true;
      const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(60000)]);
      const response=await abortable(fetchControl(base+path,{method,...(headers?{headers}:{}),body:payload,...(assetJwt===undefined?{}:{assetJwt}),redirect:'error',signal:requestSignal}),requestSignal);
      assert(response.ok);const value=JSON.parse((await bounded(response,requestSignal)).toString('utf8'));assert(value.success===true&&value.result!==undefined);return value.result;
    }catch{if(attempted)failed=true;throw Error('Catalog reader control request rejected');}
    finally{if(attempted)inFlight=false;}
  };
}
