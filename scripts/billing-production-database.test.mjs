import test from 'node:test';
import assert from 'node:assert/strict';
async function feature(){const m=await import('./billing-production-database.mjs').catch(()=>({}));assert.equal(typeof m.billingProductionDatabasePreflight,'function','production billing readonly preflight missing');return m.billingProductionDatabasePreflight;}
function fixture(){
  const state={host:'ep-holy-wildflower-b6vtv1dd.c-2.sa-east-1.aws.neon.tech',role:'neondb_owner',quota:216000,max:0.25,schema:true,outstanding:0,events:0,sent:4,crossed:0,closed:false};
  const commands=[],queries=[],connections=[];
  const ports={execute(exe,args,options){
    commands.push(args);assert(args.includes('GET'));assert.equal(options.stdio,'pipe');const path=args[3];
    return JSON.stringify(path.endsWith('/connection_uri')?{uri:`postgresql://${state.role}:synthetic-password@${state.host}/vapt?sslmode=require`}:path.includes('/endpoints/')?{endpoint:{id:'ep-holy-wildflower-b6vtv1dd',branch_id:'br-odd-term-b6j2n9ms',host:state.host,disabled:false,autoscaling_limit_min_cu:0.25,autoscaling_limit_max_cu:state.max}}:{project:{id:'dawn-morning-27332079',settings:{quota:{compute_time_seconds:state.quota}}}});
  },makeClient(options){connections.push(options);return{connection:{stream:{encrypted:true,authorized:true,getProtocol:()=> 'TLSv1.3'}},async connect(){},async query(sql){
    queries.push(sql);
    if(sql.includes('current_setting'))return{rows:[{database:'vapt',role:state.role,login:state.role,read_only:'on'}]};
    if(sql.includes('organization_required'))return{rows:[{relations:state.schema,organization_required:state.schema,restaurant_optional:state.schema}]};
    if(sql.includes('outstanding_emails'))return{rows:[{outstanding_emails:state.outstanding,unresolved_events:state.events,sent_emails:state.sent}]};
    if(sql.includes('missing_legacy_bindings'))return[{rows:[{missing_legacy_bindings:String(state.crossed),unscoped_outbox:'0',crossed_outbox_origins:'0',crossed_current_resources:'0'}]},{rows:[{reconciliation_security_definer:true,reconciliation_fixed_search_path:['search_path=pg_catalog, public'],no_public_reconciliation:true}]}];
    return{rows:[]};
  },async end(){state.closed=true;}};}};
  return{state,commands,queries,connections,ports};
}
test('production gate uses fixed endpoint and readonly verified TLS; allows old sent rows, never claims Worker credential proof',async()=>{
  const run=await feature(),f=fixture(),r=await run(f.ports);
  assert.equal(r.ok,true);assert.equal(r.outstandingEmails,0);assert.equal(r.unresolvedEvents,0);assert.equal(r.sentEmails,4);assert.equal(r.workerCredentialVerified,false);
  assert.equal(f.connections[0].host,'ep-holy-wildflower-b6vtv1dd.c-2.sa-east-1.aws.neon.tech');assert.deepEqual(f.connections[0].ssl,{rejectUnauthorized:true});
  assert.equal(f.connections[0].options,'-c default_transaction_read_only=on');assert.equal(f.queries[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(f.queries.at(-1),'ROLLBACK');assert(f.state.closed);assert(f.commands.at(-1).includes('branch_id=br-odd-term-b6j2n9ms'));
  assert.doesNotMatch(JSON.stringify(r),/synthetic-password|postgresql|recipient_email/);
});
for(const [label,change]of [['preview endpoint',f=>{f.state.host='ep-hidden-bird-b673zocn.c-2.sa-east-1.aws.neon.tech';}],['foreign role',f=>{f.state.role='foreign';}],['missing quota',f=>{f.state.quota=0;}],['expanded compute',f=>{f.state.max=8;}]])test(`refuses ${label} before database construction`,async()=>{
  const run=await feature(),f=fixture();change(f);await assert.rejects(run(f.ports));assert.equal(f.connections.length,0);
});
for(const [label,change]of [['missing tenant schema',f=>{f.state.schema=false;}],['unsent email',f=>{f.state.outstanding=1;}],['unresolved event',f=>{f.state.events=1;}],['crossed organization resource',f=>{f.state.crossed=1;}]])test(`refuses ${label} without DML and closes readonly transaction`,async()=>{
  const run=await feature(),f=fixture();change(f);await assert.rejects(run(f.ports));assert.equal(f.queries.at(-1),'ROLLBACK');assert(f.state.closed);
  assert.equal(f.queries.some(sql=>/^\s*(INSERT|DELETE|UPDATE|CREATE|ALTER|GRANT)\b/i.test(sql)),false);
});
