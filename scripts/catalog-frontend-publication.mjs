// No default HTTP/auth/CLI. Caller journals the enclosing frontend attempt and
// verifies the deployed bytes and controls. Provider failures are not retried.
import assert from 'node:assert/strict';
import {extname} from 'node:path';
import {assetManifest,frontendMetadata,moduleForm} from './production-paired-publish.mjs';
const mime={html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',ico:'image/x-icon',json:'application/json',txt:'text/plain'};
const token=value=>typeof value==='string'&&value.length>10&&value.length<=8192&&!/[\r\n]/.test(value);
// Capability discrimination only, not authentication; Cloudflare validates the
// original token. This bounded operator implements bulk uploads, not raw /hash.
const singleAssetSession=value=>{try{return JSON.parse(Buffer.from(value.split('.')[1]??'','base64url').toString('utf8')).wrangler_single_asset_uploads===true;}catch{return false;}};

export async function publishCatalogFrontend(input,ports={}){
  try{
    assert(['createSession','uploadBucket','publish'].every(key=>typeof ports[key]==='function'));
    assert(Array.isArray(input)&&input.length>1&&input.length<=1000);
    let total=0;
    const files=input.map(file=>{
      assert(typeof file.path==='string'&&Buffer.isBuffer(file.bytes)&&file.bytes.length<=4194304);
      assert(!file.path.split('/').some(p=>p.startsWith('.'))&&file.path!=='candidate-proof.json');
      total+=file.bytes.length;assert(total<=33554432);
      return {path:file.path,bytes:Buffer.from(file.bytes)};
    });
    // Validate every path/duplicate, including private config, before any I/O.
    assetManifest(files);
    const rules=files.find(file=>file.path==='_headers')?.bytes;
    frontendMetadata('local-validation-placeholder',rules);
    const publicFiles=files.filter(file=>file.path!=='_headers');
    assert(publicFiles.some(file=>file.path==='index.html'));
    const manifest=assetManifest(publicFiles),byHash=new Map();
    for(const file of publicFiles){
      const hash=manifest['/'+file.path].hash,prior=byHash.get(hash);
      if(prior)assert(prior.bytes.equals(file.bytes)&&extname(prior.path)===extname(file.path));
      else byHash.set(hash,file);
    }
    const session=await ports.createSession(manifest);
    assert(token(session?.jwt)&&Array.isArray(session.buckets)&&session.buckets.length<=byHash.size);
    assert(session.buckets.length===0||!singleAssetSession(session.jwt));
    const requested=new Set();
    for(const bucket of session.buckets){
      assert(Array.isArray(bucket)&&bucket.length>0&&bucket.length<=byHash.size);
      for(const hash of bucket){assert(typeof hash==='string'&&byHash.has(hash)&&!requested.has(hash));requested.add(hash);}
    }
    // Validate the whole provider request set before uploading the first byte.
    let completion=session.buckets.length===0?session.jwt:undefined;
    for(let i=0;i<session.buckets.length;i++){
      const form=new FormData();
      for(const hash of session.buckets[i]){
        const file=byHash.get(hash),type=mime[extname(file.path).slice(1)]??'application/octet-stream';
        form.set(hash,new Blob([file.bytes.toString('base64')],{type}),hash);
      }
      const result=await ports.uploadBucket(form,session.jwt);
      // An earlier upload's token cannot certify the last upload completed.
      if(i===session.buckets.length-1)completion=result?.jwt;
    }
    assert(token(completion));
    await ports.publish(moduleForm(frontendMetadata(completion,rules),[]));
    return {publicAssets:publicFiles.length,uploadedAssets:requested.size,uploadedBatches:session.buckets.length,headersInConfig:true};
  }catch{throw Error('Catalog frontend publication stopped');}
}
