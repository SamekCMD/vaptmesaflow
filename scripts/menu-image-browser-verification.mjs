// Operator-only loopback/native-codec proof. No login, credentials, uploads,
// dependencies installed or cloud access. Reports are browser observations.
import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import ts from 'typescript';
const hash=value=>createHash('sha256').update(value).digest('hex');
const ensure=value=>{if(!value)throw Error('Browser verification guard');};
const sameKeys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...names].sort().join(',');
const ids=['jpeg','png_alpha_300x150','webp','unsupported','oversized','corrupt','empty'];
function validate(value,sourceSha256){
  ensure(sameKeys(value,['sourceSha256','cases'])&&value.sourceSha256===sourceSha256&&Array.isArray(value.cases)&&value.cases.length===7);
  value.cases.forEach((row,index)=>{
    ensure(row?.id===ids[index]&&typeof row.passed==='boolean');
    if(index>2||!row.passed){ensure(sameKeys(row,['id','passed']));return;}
    ensure(sameKeys(row,['id','passed','inputType','inputBytes','outputType','outputBytes','width','height','center','cornerAlpha','urlsReleased']));
    ensure(row.inputType===['image/jpeg','image/png','image/webp'][index]&&Number.isSafeInteger(row.inputBytes)&&row.inputBytes>0&&row.inputBytes<=5242880
      &&row.outputType==='image/webp'&&Number.isSafeInteger(row.outputBytes)&&row.outputBytes>0&&row.outputBytes<=1048576
      &&row.width===[1200,300,640][index]&&row.height===[800,150,480][index]&&row.cornerAlpha===(index===1?0:255)&&row.urlsReleased===true
      &&Array.isArray(row.center)&&row.center.length===4&&row.center.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&row.center[3]===255
      &&row.center.slice(0,3).every((v,i)=>Math.abs(v-[20,160,220][i])<=35)&&(index!==0||row.outputBytes<row.inputBytes));
  });
  return structuredClone(value);
}
export async function createMenuImageBrowserVerification(){
  const source=await readFile(new URL('../src/lib/menu-image-optimization.ts',import.meta.url)),sourceSha256=hash(source);
  const optimizer=ts.transpileModule(source.toString('utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const browserSource=await readFile(new URL('./menu-image-browser-cases.mjs',import.meta.url),'utf8'),nonce=randomBytes(32).toString('hex');
  let origin,host,closed=false,accepted=false,resolveResult,rejectResult;
  const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});result.catch(()=>{});
  const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="vapt-nonce" content="${nonce}"><title>Vapt — compressão local de imagens</title>
<h1>Verificação local de imagens</h1><p>Somente imagens sintéticas neste navegador. Sem login, chave, upload ou acesso à nuvem.</p><button id="start" disabled>Validar compressão</button><p id="status">Carregando código local…</p><pre id="results"></pre>
<script type="module" nonce="${nonce}">import{optimizeMenuImage}from'/optimizer.js';import{runMenuImageBrowserCases}from'/cases.js';
const button=document.getElementById('start'),label=document.getElementById('status');button.disabled=false;label.textContent='Pronto. Clique uma única vez.';
button.onclick=async()=>{button.disabled=true;label.textContent='Validando JPG, PNG transparente, WebP e limites…';try{const cases=await runMenuImageBrowserCases(optimizeMenuImage);document.getElementById('results').textContent=JSON.stringify(cases,null,2);const response=await fetch('/result',{method:'POST',headers:{'Content-Type':'application/json','X-Vapt-Nonce':'${nonce}'},body:JSON.stringify({sourceSha256:'${sourceSha256}',cases})});if(!response.ok)throw Error('local');label.textContent=cases.every(row=>row.passed)?'7/7 testes concluídos. Resultado entregue ao controlador local.':'Há uma falha; resultado entregue ao controlador local.';}catch{label.textContent='Não foi possível concluir ou entregar o resultado. Avise no chat.';}};
</script></html>`;
  const server=createServer(async(req,res)=>{
    const send=(code,body='',type='text/plain; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':`default-src 'none'; script-src 'self' 'nonce-${nonce}'; img-src blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`});res.end(body);};
    try{
      if(closed||req.headers.host!==host||req.headers.origin!==undefined&&req.headers.origin!==origin)return send(403);
      if(req.method==='GET'){
        if(req.url==='/')return send(200,html,'text/html; charset=utf-8');
        if(req.url==='/optimizer.js')return send(200,optimizer,'text/javascript; charset=utf-8');
        if(req.url==='/cases.js')return send(200,browserSource,'text/javascript; charset=utf-8');
        return send(404);
      }
      if(req.method!=='POST'||req.url!=='/result'||req.headers.origin!==origin||req.headers['x-vapt-nonce']!==nonce||req.headers['content-type']!=='application/json')return send(403);
      if(accepted)return send(409);
      let size=0,body='';for await(const chunk of req){size+=chunk.length;if(size>4096)return send(400);body+=chunk;}
      const value=validate(JSON.parse(body),sourceSha256);if(accepted)return send(409);accepted=true;
      send(204);resolveResult({ok:value.cases.every(row=>row.passed),...value,harnessSha256:hash(browserSource),remoteRequests:0,scope:'native_browser_codec_synthetic'});
    }catch{if(!res.headersSent)send(400);else res.end();}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=8;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;host=new URL(origin).host;
  async function close(){if(closed)return;closed=true;clearTimeout(timer);rejectResult(Error('Browser verification closed'));await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
  const timer=setTimeout(()=>{void close();},600000);timer.unref();
  return{url:origin,sourceSha256,waitForResult:()=>result,close};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  if(process.argv.length!==3||process.argv[2]!=='run'){process.stderr.write('Usage: node scripts/menu-image-browser-verification.mjs run\n');process.exitCode=1;}
  else{
    let server;const stop=()=>{void server?.close();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
    try{server=await createMenuImageBrowserVerification();process.stdout.write(JSON.stringify({stage:'waiting_browser',url:server.url,sourceSha256:server.sourceSha256})+'\n');const result=await server.waitForResult();process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1;await delay(3000);}
    catch{process.stdout.write(JSON.stringify({ok:false,stage:'browser_verification_stopped'})+'\n');process.exitCode=1;}
    finally{await server?.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
  }
}
