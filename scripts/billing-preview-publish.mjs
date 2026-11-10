// One approved content-only replacement. No resource/secret/config mutation API.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {billingPreviewDatabasePreflight} from './billing-preview-database.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const api=resolve(root,'.worktrees/vapt-api-infra-foundation'),billing=resolve(root,'infra/cloudflare/billing-email-worker');
const base='https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932';
const worker='/workers/scripts/vapt-billing-email-preview';
const queue='/queues/91b43d7250d04cb2b30bb0e08ed1b0dd',dlq='/queues/09a1fe7faa4d4bdd8277dd5851b85084';
const oldId='98ec30a6-76b3-4e79-8d2d-aa5a23f739fc',oldVersion='e27200db-8db8-4a44-9876-a2f0df9b899d';
const candidateHash='6998387d92c999c6b036603d2353e960ea8ee214c65dbe75db9b6e0d5b72d587';
const ensure=(value,code='billing_preview_preflight_failed')=>{if(!value)throw Object.assign(Error('Billing preview guard failed'),{safeCode:code});};
const options={windowsHide:true,encoding:'utf8',stdio:'pipe',timeout:60000,maxBuffer:2097152,
  env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_SEND_METRICS:'false',NO_UPDATE_NOTIFIER:'1'}};
const execute=(args,cwd)=>execFileSync(process.execPath,args,{...options,cwd});
function credential(){
  const auth=JSON.parse(execute([api+'/node_modules/wrangler/bin/wrangler.js','auth','token','--json','--config','wrangler.worker-catalog-preview.jsonc'],api));
  ensure(['oauth','api_token'].includes(auth.type)&&typeof auth.token==='string'&&auth.token);const token=auth.token;auth.token='';return token;
}
function prepareBundle(){
  const tree=execFileSync('git',['rev-parse','HEAD:infra/cloudflare/billing-email-worker'],{...options,cwd:root}).trim();
  ensure(tree==='4651c7276b6f373ef9b8df93e4c7774b4298c36a');
  ensure(execFileSync('git',['status','--porcelain','--untracked-files=all','--','infra/cloudflare/billing-email-worker'],{...options,cwd:root}).trim()==='');
  const out=mkdtempSync(resolve(root,'.superpowers/sdd/infra-migration-public-catalog-event-driven-plan/billing-package-'));
  execute([billing+'/node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','wrangler.preview.jsonc','--outdir',out],billing);
  const code=readFileSync(resolve(out,'index.js')),sha256=createHash('sha256').update(code).digest('hex');
  ensure(sha256===candidateHash,'billing_preview_artifact_changed');return{code,sha256};
}
function stable(settings){const {annotations,...rest}=settings;return{...rest,bindings:[...rest.bindings].sort((a,b)=>a.name.localeCompare(b.name))};}
function checkSettings(s){
  ensure(s.compatibility_date==='2025-12-01'&&isDeepStrictEqual(s.compatibility_flags,[])&&s.logpush===false
    &&isDeepStrictEqual(s.tail_consumers,[])&&s.usage_model==='standard'&&isDeepStrictEqual(s.placement,{})
    &&s.limits===undefined&&s.observability?.enabled!==true);
  ensure(isDeepStrictEqual(s.bindings.map(v=>v.name).sort(),['BILLING_EMAIL_QUEUE','DATABASE_URL','ENVIRONMENT','RESEND_API_KEY']));
  const bindings=Object.fromEntries(s.bindings.map(v=>[v.name,v]));
  ensure(bindings.DATABASE_URL.type==='secret_text'&&bindings.RESEND_API_KEY.type==='secret_text'
    &&bindings.ENVIRONMENT.type==='plain_text'&&bindings.ENVIRONMENT.text==='preview'
    &&bindings.BILLING_EMAIL_QUEUE.type==='queue'&&bindings.BILLING_EMAIL_QUEUE.queue_name==='vapt-emails-preview');
}
function checkDatabase(proof){
  ensure(['ok','readOnly','identityVerified','schemaVerified','grantsVerified','endpointLimited'].every(k=>proof?.[k]===true)
    &&['outboxRows','activeClaims','catalogRows'].every(k=>proof[k]===0),'billing_preview_database_gate_failed');
}
function checkQueue(q,dead=false){
  ensure(q.queue_id===(dead?dlq:queue).split('/').at(-1)&&q.queue_name===(dead?'vapt-emails-preview-dlq':'vapt-emails-preview'));
  ensure(isDeepStrictEqual(q.settings,{delivery_delay:0,message_retention_period:86400}));
  if(dead)ensure(isDeepStrictEqual(q.consumers,[]));
  else{ensure(q.consumers.length===1);const c=q.consumers[0];ensure(c.consumer_id==='d9aff17d04bd4262a4f222d8b2c8a57f'&&c.type==='worker'
    &&c.script==='vapt-billing-email-preview'&&c.dead_letter_queue==='vapt-emails-preview-dlq'
    &&isDeepStrictEqual(c.settings,{batch_size:10,max_retries:3,max_wait_time_ms:5000,retry_delay:60}));}
}
export async function publishBillingPreview(args,ports={}){
  const fail=(code,uncertain=false,extra={})=>({status:1,report:{ok:false,published:uncertain?null:false,publicationAttempted:uncertain,code,...extra}});
  if(!Array.isArray(args)||args.length!==1||args[0]!=='publish')return fail('billing_preview_arguments_invalid');
  const transport=ports.fetch??fetch;let token,attempted=false;
  async function response(path,method='GET',body){
    const r=await transport(base+path,{method,headers:{Authorization:`Bearer ${token}`},...(body?{body}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!r.ok){
      let providerCodes=[];
      try{const body=JSON.parse(await text(r));providerCodes=(body.errors??[]).map(v=>v.code).filter(Number.isSafeInteger).slice(0,8);}catch{}
      throw Object.assign(Error('Provider request rejected'),{httpStatus:r.status,providerCodes});
    }return r;
  }
  async function text(r,max=1048576){
    const reader=r.body.getReader(),chunks=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;ensure(size<=max);chunks.push(part.value);}}
    catch{await reader.cancel().catch(()=>{});throw Error('Bounded provider read failed');}
    return Buffer.concat(chunks).toString('utf8');
  }
  async function read(path){const json=JSON.parse(await text(await response(path)));ensure(json.success===true&&json.result!==undefined);return json.result;}
  async function history(){const value=await read(worker+'/deployments');ensure(Array.isArray(value.deployments)&&value.deployments.length>0);return value.deployments[0];}
  function pinned(value){ensure(value.id===oldId&&isDeepStrictEqual(value.versions,[{version_id:oldVersion,percentage:100}]),'billing_preview_baseline_changed');}
  async function controls(){
    const snapshots=[];
    for(const name of ['vapt-billing-email-production','vapt-api-production','vapt-web','vapt-api-parallel']){
      const value=await read('/workers/scripts/'+name+'/deployments');ensure(Array.isArray(value.deployments)&&value.deployments.length>0);
      snapshots.push(value.deployments.map(v=>({id:v.id,versions:v.versions})));
    }
    const preview=await read('/workers/workers/vapt-api-parallel/previews/stage11-inert/deployments/latest');
    ensure(preview.id==='6110a9fe-0ee6-4faa-920e-23f73f7a504d'&&preview.number===31);
    snapshots.push({id:preview.id,number:preview.number});return snapshots;
  }
  async function resources(){
    const settings=await read(worker+'/settings');checkSettings(settings);
    const ingress=await read(worker+'/subdomain');ensure(ingress.enabled===false&&ingress.previews_enabled===false);
    const schedule=await read(worker+'/schedules');ensure(Array.isArray(schedule.schedules)&&schedule.schedules.length===1&&schedule.schedules[0].cron==='*/30 * * * *');
    const main=await read(queue),dead=await read(dlq);checkQueue(main);checkQueue(dead,true);
    const domains=await read('/workers/domains');ensure(Array.isArray(domains)&&!domains.some(v=>v.service==='vapt-billing-email-preview'));
    return{settings:stable(settings),ingress,schedule,main,dead,domains};
  }
  async function metrics(){
    const main=await read(queue+'/metrics'),dead=await read(dlq+'/metrics');
    ensure(main.backlog_count===0&&main.backlog_bytes===0,'billing_preview_queue_not_empty');
    // Historical synthetic malformed message: retain, never replay or purge.
    ensure(dead.backlog_count===1&&dead.backlog_bytes===28,'billing_preview_dead_letters_changed');return{main,dead};
  }
  try{
    const bundle=await(ports.prepareBundle??prepareBundle)();
    ensure(bundle?.sha256===candidateHash&&Buffer.isBuffer(bundle.code)&&bundle.code.length>0&&bundle.code.length<=1048576,'billing_preview_artifact_changed');
    token=await(ports.credential??credential)();ensure(typeof token==='string'&&token);
    const before=await history();pinned(before);
    const snapshot=await resources(),control=await controls();await metrics();
    checkDatabase(await(ports.databasePreflight??billingPreviewDatabasePreflight)());
    ensure(isDeepStrictEqual(await resources(),snapshot));await metrics();pinned(await history());
    const form=new FormData();form.set('metadata',JSON.stringify({main_module:'index.js'}));
    form.set('index.js',new Blob([bundle.code],{type:'application/javascript+module'}),'index.js');
    attempted=true;await readUpload(form);
    const after=await history();ensure(after.id!==oldId&&after.versions.length===1&&after.versions[0].percentage===100&&after.versions[0].version_id!==oldVersion);
    ensure(isDeepStrictEqual(await resources(),snapshot)&&isDeepStrictEqual(await controls(),control));await metrics();
    const r=await response(worker+'/content/v2'),type=r.headers.get('content-type')??'';
    const body=await text(r,2097152);let code;
    if(type.startsWith('multipart/')){
      const form=await new Response(body,{headers:{'content-type':type}}).formData();
      const files=[...form.values()].filter(v=>v instanceof Blob);ensure(files.length===1);
      code=Buffer.from(await files[0].arrayBuffer());
    }else{ensure(/javascript/.test(type));code=Buffer.from(body);}
    ensure(code.equals(bundle.code),'billing_preview_source_mismatch');
    checkDatabase(await(ports.databasePreflight??billingPreviewDatabasePreflight)());
    return{status:0,report:{ok:true,published:true,worker:'vapt-billing-email-preview',deploymentId:after.id,versionId:after.versions[0].version_id,
      previousVersionId:oldVersion,sourceVerified:true,artifactSha256:bundle.sha256,controlsUnchanged:true,configurationUnchanged:true,
      queueBacklog:0,retainedDeadLetters:1,dispatchCron:'*/30 * * * *',databaseReadOnly:true}};
  }catch(error){return fail(attempted?'billing_preview_publication_uncertain':error?.safeCode??'billing_preview_preflight_failed',attempted,
    Number.isSafeInteger(error?.httpStatus)?{httpStatus:error.httpStatus,providerCodes:error.providerCodes??[]}:{});}
  finally{token=undefined;}
  async function readUpload(form){const json=JSON.parse(await text(await response(worker+'/content','PUT',form)));ensure(json.success===true&&json.result?.id==='vapt-billing-email-preview');}
}
