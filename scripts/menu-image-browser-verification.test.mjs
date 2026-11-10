import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
async function feature(name){const m=await import('./menu-image-browser-verification.mjs').catch(()=>({}));assert.equal(typeof m[name],'function',name+' missing');return m[name];}
async function setup(t){
  const create=await feature('createMenuImageBrowserVerification'),server=await create();t.after(()=>server.close());
  const response=await fetch(server.url),html=await response.text(),nonce=html.match(/name="vapt-nonce" content="([a-f0-9]{64})"/)[1];
  const request=(value,headers={})=>fetch(server.url+'/result',{method:'POST',headers:{Origin:server.url,'Content-Type':'application/json','X-Vapt-Nonce':nonce,...headers},body:typeof value==='string'?value:JSON.stringify(value)});
  return{server,request,response};
}
function report(hash){return{sourceSha256:hash,cases:[
  {id:'jpeg',passed:true,inputType:'image/jpeg',inputBytes:2400000,outputType:'image/webp',outputBytes:220000,width:1200,height:800,center:[20,160,220,255],cornerAlpha:255,urlsReleased:true},
  {id:'png_alpha_300x150',passed:true,inputType:'image/png',inputBytes:900,outputType:'image/webp',outputBytes:300,width:300,height:150,center:[20,160,220,255],cornerAlpha:0,urlsReleased:true},
  {id:'webp',passed:true,inputType:'image/webp',inputBytes:4000,outputType:'image/webp',outputBytes:2000,width:640,height:480,center:[20,160,220,255],cornerAlpha:255,urlsReleased:true},
  ...['unsupported','oversized','corrupt','empty'].map(id=>({id,passed:true})),
]};}
test('loopback serves the actual optimizer source and accepts a bounded once-only result without uploads',async t=>{
  const {server,request,response}=await setup(t);
  const hash=createHash('sha256').update(await readFile(new URL('../src/lib/menu-image-optimization.ts',import.meta.url))).digest('hex');
  assert.equal(server.sourceSha256,hash);assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
  const module=await fetch(server.url+'/optimizer.js');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
  assert.equal((await fetch(server.url+'/not-a-file')).status,404);
  assert.equal((await request(report(hash))).status,204);const result=await server.waitForResult();
  assert.equal(result.ok,true);assert.equal(result.cases.length,7);assert.equal(result.remoteRequests,0);
  assert.equal((await request(report(hash))).status,409);await server.close();await assert.rejects(fetch(server.url));
});
test('nonce, origin, host and body-size guards refuse cross-site or unbounded results',async t=>{
  const {server,request}=await setup(t);
  assert.equal((await request({}, {'X-Vapt-Nonce':''})).status,403);
  assert.equal((await request({}, {Origin:'https://untrusted.invalid'})).status,403);
  assert.equal((await request('x'.repeat(5000))).status,400);
  const status=await new Promise((resolve,reject)=>{const req=http.get(server.url,{headers:{Host:'untrusted.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,403);
});
test('wrong source, unknown cases, missing checks and out-of-budget images cannot certify the browser gate',async t=>{
  const {server,request}=await setup(t);
  const mutations=[r=>{r.sourceSha256='0'.repeat(64);},r=>{r.cases.pop();},r=>{r.cases[0].id='unknown';},r=>{r.cases[0].outputBytes=1048577;},r=>{r.cases[0].outputType='image/png';},r=>{r.cases[1].cornerAlpha=255;},r=>{r.cases[1].center=[0,0,0,0];},r=>{r.cases[0].urlsReleased=false;},r=>{r.extra='not-allowed';}];
  for(const mutate of mutations){const r=report(server.sourceSha256);mutate(r);assert.equal((await request(r)).status,400);}
  assert.equal((await request(report(server.sourceSha256))).status,204);assert.equal((await server.waitForResult()).ok,true);
});
test('failed browser cases remain failures rather than being inferred green from the source hash',async t=>{
  const {server,request}=await setup(t),r=report(server.sourceSha256);r.cases[4].passed=false;
  assert.equal((await request(r)).status,204);assert.equal((await server.waitForResult()).ok,false);
});
test('closing before a browser response settles the wait and leaves no listener',async t=>{
  const {server}=await setup(t),pending=assert.rejects(server.waitForResult());await server.close();await pending;await assert.rejects(fetch(server.url));
});
test('two already admitted HTTP bodies cannot submit two successful results concurrently',async t=>{
  const {server}=await setup(t),html=await(await fetch(server.url)).text(),nonce=html.match(/name="vapt-nonce" content="([a-f0-9]{64})"/)[1];
  const pending=()=>{
    let resolveStatus,rejectStatus,resolveEntered;const status=new Promise((resolve,reject)=>{resolveStatus=resolve;rejectStatus=reject;});
    const entered=new Promise(resolve=>{resolveEntered=resolve;});
    const req=http.request(server.url+'/result',{method:'POST',headers:{Origin:server.url,Expect:'100-continue','Content-Type':'application/json','X-Vapt-Nonce':nonce}},res=>{res.resume();resolveStatus(res.statusCode);});
    req.on('error',rejectStatus);req.on('continue',resolveEntered);req.flushHeaders();t.after(()=>req.destroy());
    return{entered,status,finish:()=>req.end(JSON.stringify(report(server.sourceSha256)))};
  };
  const a=pending(),b=pending();await Promise.all([a.entered,b.entered]);a.finish();b.finish();
  assert.deepEqual((await Promise.all([a.status,b.status])).sort(),[204,409]);
});
