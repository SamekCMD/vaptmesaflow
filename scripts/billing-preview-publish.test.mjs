import test from 'node:test';
import assert from 'node:assert/strict';
const base='https://api.cloudflare.com/client/v4/accounts/3ce69408aa5112617a282957aba71932';
const worker='/workers/scripts/vapt-billing-email-preview';
const oldId='98ec30a6-76b3-4e79-8d2d-aa5a23f739fc',oldVersion='e27200db-8db8-4a44-9876-a2f0df9b899d';
const queue='/queues/91b43d7250d04cb2b30bb0e08ed1b0dd',dlq='/queues/09a1fe7faa4d4bdd8277dd5851b85084';
const candidateHash='6998387d92c999c6b036603d2353e960ea8ee214c65dbe75db9b6e0d5b72d587';
async function feature(){const module=await import('./billing-preview-publish.mjs').catch(()=>null);assert.equal(typeof module?.publishBillingPreview,'function','scoped publisher missing');return module.publishBillingPreview;}
function fixture(){
  const settings={annotations:{},bindings:[{name:'BILLING_EMAIL_QUEUE',type:'queue',queue_name:'vapt-emails-preview'},
    {name:'DATABASE_URL',type:'secret_text'},{name:'ENVIRONMENT',type:'plain_text',text:'preview'},{name:'RESEND_API_KEY',type:'secret_text'}],
    compatibility_date:'2025-12-01',compatibility_flags:[],logpush:false,placement:{},tags:[],tail_consumers:[],usage_model:'standard'};
  const source=Buffer.from('synthetic compiled candidate module');
  const state={settings,ingress:{enabled:false,previews_enabled:false},schedule:{schedules:[{cron:'*/30 * * * *'}]},
    deployment:{id:oldId,versions:[{version_id:oldVersion,percentage:100}]},
    main:{queue_id:queue.split('/').at(-1),queue_name:'vapt-emails-preview',settings:{delivery_delay:0,message_retention_period:86400},consumers:[{
      script:'vapt-billing-email-preview',dead_letter_queue:'vapt-emails-preview-dlq',settings:{batch_size:10,max_retries:3,max_wait_time_ms:5000,retry_delay:60},consumer_id:'d9aff17d04bd4262a4f222d8b2c8a57f',type:'worker'}]},
    dead:{queue_id:dlq.split('/').at(-1),queue_name:'vapt-emails-preview-dlq',settings:{delivery_delay:0,message_retention_period:86400},consumers:[]},
    mainMetrics:{backlog_count:0,backlog_bytes:0,oldest_message_timestamp_ms:0},deadMetrics:{backlog_count:1,backlog_bytes:28,oldest_message_timestamp_ms:0},
    db:{ok:true,readOnly:true,identityVerified:true,schemaVerified:true,grantsVerified:true,endpointLimited:true,outboxRows:0,activeClaims:0,catalogRows:0},
    controlsDrift:false,source,uploaded:false};
  const calls=[];let auth=0,dbCalls=0,builds=0;
  const ports={credential:async()=>{auth++;return'synthetic-secret';},prepareBundle:async()=>{builds++;return{code:source,sha256:candidateHash};},
    databasePreflight:async()=>{dbCalls++;return structuredClone(state.db);},fetch:async(url,options)=>{
      assert.ok(url.startsWith(base+'/'));assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-secret');
      calls.push({url,options});const path=url.slice(base.length);
      if(options.method==='PUT'){
        assert.equal(path,worker+'/content');assert.deepEqual([...options.body.keys()],['metadata','index.js']);
        assert.deepEqual(JSON.parse(options.body.get('metadata')),{main_module:'index.js'});
        assert.deepEqual(Buffer.from(await options.body.get('index.js').arrayBuffer()),source);
        state.uploaded=true;state.deployment={id:'22222222-2222-4222-8222-222222222222',versions:[{version_id:'33333333-3333-4333-8333-333333333333',percentage:100}]};
        return Response.json({success:true,result:{id:'vapt-billing-email-preview'}});
      }
      assert.equal(options.method,'GET');
      const json=value=>Response.json({success:true,result:value});
      if(path===worker+'/settings')return json(state.settings);
      if(path===worker+'/subdomain')return json(state.ingress);
      if(path===worker+'/schedules')return json(state.schedule);
      if(path===worker+'/deployments')return json({deployments:[state.deployment]});
      if(path===queue)return json(state.main);if(path===dlq)return json(state.dead);
      if(path===queue+'/metrics')return json(state.mainMetrics);if(path===dlq+'/metrics')return json(state.deadMetrics);
      if(path==='/workers/domains')return json([{hostname:'api.vapt.app.br',service:'vapt-api-production',environment:'production'}]);
      if(path===worker+'/content/v2')return new Response(state.uploaded?state.source:Buffer.from('legacy module'),{headers:{'content-type':'application/javascript'}});
      if(path==='/workers/workers/vapt-api-parallel/previews/stage11-inert/deployments/latest')return json({id:'6110a9fe-0ee6-4faa-920e-23f73f7a504d',number:31});
      if(/^\/workers\/scripts\/(vapt-billing-email-production|vapt-api-production|vapt-web|vapt-api-parallel)\/deployments$/.test(path))return json({deployments:[{id:state.uploaded&&state.controlsDrift?'drift':'control-'+path,versions:[]}]});
      assert.fail('Unexpected external request '+path);
    }};
  return{state,ports,calls,counts:()=>({auth,dbCalls,builds}),writes:()=>calls.filter(v=>v.options.method!=='GET')};
}
test('publishes only preview content once, preserving config, secrets, cron, queue and retained DLQ',async()=>{
  const publish=await feature(),f=fixture();const result=await publish(['publish'],f.ports);
  assert.equal(result.status,0);assert.equal(result.report.published,true);assert.equal(result.report.controlsUnchanged,true);
  assert.equal(result.report.sourceVerified,true);assert.equal(result.report.retainedDeadLetters,1);assert.equal(f.writes().length,1);
  const writeIndex=f.calls.findIndex(v=>v.options.method==='PUT');assert.equal(f.calls[writeIndex-1].url,base+worker+'/deployments');
  assert.equal(f.counts().dbCalls,2);assert.doesNotMatch(JSON.stringify(result),/synthetic-secret|compiled candidate/);
  assert.equal((await publish(['publish'],f.ports)).status,1);assert.equal(f.writes().length,1);
});
test('rejects production/flags/overrides before auth, builds or database calls',async()=>{
  const publish=await feature();for(const args of [[],['publish','production'],['publish','--force'],['deploy'],['publish','--config','secret']]){
    const f=fixture();assert.equal((await publish(args,f.ports)).status,1);assert.deepEqual(f.counts(),{auth:0,dbCalls:0,builds:0});assert.equal(f.calls.length,0);
  }
});
for(const [label,change]of [
  ['different baseline',f=>{f.state.deployment.id='other';}],
  ['wrong secret set',f=>{f.state.settings.bindings.pop();}],
  ['public ingress',f=>{f.state.ingress.enabled=true;}],
  ['faster cron',f=>{f.state.schedule.schedules[0].cron='* * * * *';}],
  ['wrong queue consumer',f=>{f.state.main.consumers[0].script='production';}],
  ['pending queue messages',f=>{f.state.mainMetrics.backlog_count=1;}],
  ['unexpected dead letters',f=>{f.state.deadMetrics.backlog_count=2;}],
  ['unverified database',f=>{f.state.db.identityVerified=false;}],
  ['missing schema',f=>{f.state.db.schemaVerified=false;}],
  ['pending outbox',f=>{f.state.db.outboxRows=1;}],
  ['active claim',f=>{f.state.db.activeClaims=1;}],
  ['catalog work',f=>{f.state.db.catalogRows=1;}],
  ['unbounded endpoint',f=>{f.state.db.endpointLimited=false;}],
  ['different artifact',f=>{f.ports.prepareBundle=async()=>({code:f.state.source,sha256:'0'.repeat(64)});}],
])test(`refuses ${label} without writing or changing resources`,async()=>{
  const publish=await feature(),f=fixture();change(f);assert.equal((await publish(['publish'],f.ports)).status,1);assert.equal(f.writes().length,0);
});
test('lost PUT response stops with uncertain outcome and no retry or raw error',async()=>{
  const publish=await feature(),f=fixture(),fetch=f.ports.fetch;
  f.ports.fetch=async(url,options)=>{const response=await fetch(url,options);if(options.method==='PUT')throw Error('synthetic-secret');return response;};
  const result=await publish(['publish'],f.ports);assert.equal(result.status,1);assert.equal(result.report.code,'billing_preview_publication_uncertain');assert.equal(result.report.published,null);assert.equal(result.report.publicationAttempted,true);assert.equal(f.writes().length,1);assert.doesNotMatch(JSON.stringify(result),/synthetic-secret/);
});
for(const [label,change]of [
  ['settings changed',f=>{f.state.settings.logpush=true;}],['controls drift',f=>{f.state.controlsDrift=true;}],
  ['source mismatch',f=>{f.state.source=Buffer.from('wrong compiled module');}],['DLQ changed',f=>{f.state.deadMetrics.backlog_bytes=29;}],
])test(`post-publication ${label} never reports success or repairs resources`,async()=>{
  const publish=await feature(),f=fixture(),fetch=f.ports.fetch;
  f.ports.fetch=async(url,options)=>{const response=await fetch(url,options);if(options.method==='PUT')change(f);return response;};
  const result=await publish(['publish'],f.ports);assert.equal(result.status,1);assert.equal(result.report.code,'billing_preview_publication_uncertain');assert.equal(f.writes().length,1);
});
test('last pre-write read rejects concurrent deployment change',async()=>{
  const publish=await feature(),f=fixture(),fetch=f.ports.fetch;let reads=0;
  f.ports.fetch=async(url,options)=>{if(url===base+worker+'/deployments'&&++reads===2)f.state.deployment.id='raced';return fetch(url,options);};
  assert.equal((await publish(['publish'],f.ports)).status,1);assert.equal(f.writes().length,0);
});
test('provider rejection reports only status and numeric codes without echoing body or retrying',async()=>{
  const publish=await feature(),f=fixture(),fetch=f.ports.fetch;let writes=0;
  f.ports.fetch=async(url,options)=>{if(options.method==='PUT'){writes++;return Response.json({success:false,errors:[{code:10032,message:'synthetic-secret'}]},{status:400});}return fetch(url,options);};
  const result=await publish(['publish'],f.ports);assert.equal(result.status,1);assert.equal(result.report.httpStatus,400);assert.deepEqual(result.report.providerCodes,[10032]);assert.equal(writes,1);assert.doesNotMatch(JSON.stringify(result),/synthetic-secret/);
});
test('readback parses the real multipart module response instead of hashing its transport envelope',async()=>{
  const publish=await feature(),f=fixture(),fetch=f.ports.fetch;
  f.ports.fetch=async(url,options)=>{
    if(url===base+worker+'/content/v2'){
      const form=new FormData();form.set('index.js',new Blob([f.state.source],{type:'application/javascript+module'}),'index.js');return new Response(form);
    }return fetch(url,options);
  };
  assert.equal((await publish(['publish'],f.ports)).status,0);
});
