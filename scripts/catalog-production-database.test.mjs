import test from 'node:test';
import assert from 'node:assert/strict';
async function feature(){const m=await import('./catalog-production-database.mjs').catch(()=>({}));assert.equal(typeof m.catalogProductionDatabasePreflight,'function','catalog database readiness missing');return m.catalogProductionDatabasePreflight;}
function fixture(){const state={quota:216000,max:0.25,host:'ep-holy-wildflower-b6vtv1dd.c-2.sa-east-1.aws.neon.tech',tls:true,acl:true,ready:true,crossed:0,roleLimited:true};const queries=[],connections=[],commands=[],ended=[];
  return {state,queries,connections,commands,ended,ports:{execute(exe,args){commands.push(args);assert(args.includes('GET'));const path=args[3],role=args.find(v=>v.startsWith('role_name='))?.slice(10);return JSON.stringify(path.endsWith('connection_uri')?{uri:`postgresql://${role}:private-fixture-password@${state.host}/vapt?sslmode=require`}:path.includes('/endpoints/')?{endpoint:{id:'ep-holy-wildflower-b6vtv1dd',branch_id:'br-odd-term-b6j2n9ms',host:state.host,disabled:false,autoscaling_limit_min_cu:0.25,autoscaling_limit_max_cu:state.max}}:{project:{id:'dawn-morning-27332079',settings:{quota:{compute_time_seconds:state.quota}}}});},makeClient(options){connections.push(options);return {connection:{stream:{encrypted:true,authorized:state.tls,getProtocol:()=> 'TLSv1.3'}},on(){},async connect(){},async end(){ended.push(options.user);},async query(sql){queries.push({role:options.user,sql});
    if(sql.includes('current_database()'))return {rows:[{database:'vapt',role:options.user,login:options.user,read_only:'on'}]};
    if(sql.includes('AS catalog_ready'))return {rows:[{catalog_ready:state.ready,catalog_acl_ok:state.acl}]};
    if(sql.includes('rolcanlogin'))return {rows:[{rolcanlogin:true,rolsuper:!state.roleLimited,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,memberships:0}]};
    if(sql.includes('AS restaurants'))return {rows:[{restaurants:7,journal_operations:12}]};
    if(sql.includes('missing_legacy_bindings'))return [{rows:[{missing_legacy_bindings:String(state.crossed),unscoped_outbox:'0',crossed_outbox_origins:'0',crossed_current_resources:'0'}]},{rows:[{reconciliation_security_definer:true,reconciliation_fixed_search_path:['search_path=pg_catalog, public'],no_public_reconciliation:true}]}];
    return {rows:[]};
  }};}}};}
test('checks owner and existing application login over verified readonly TLS without requiring an empty database',async()=>{
  const run=await feature(),f=fixture(),r=await run(f.ports);assert.equal(r.ok,true);assert.equal(r.applicationLoginVerified,true);assert.equal(r.workerCredentialVerified,false);assert.equal(r.readOnly,true);assert.deepEqual(r.counts,{restaurants:7,journalOperations:12});
  assert.deepEqual(f.connections.map(c=>c.user),['neondb_owner','vapt_api_production']);assert.deepEqual(f.ended,['neondb_owner','vapt_api_production']);
  for(const c of f.connections){assert.deepEqual(c.ssl,{rejectUnauthorized:true});assert.equal(c.options,'-c default_transaction_read_only=on');assert.equal(c.password,undefined);}
  assert.equal(f.queries.filter(q=>q.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY').length,2);assert.equal(f.queries.filter(q=>q.sql==='ROLLBACK').length,2);
  assert(!f.queries.some(q=>/^\s*(insert|update|delete|grant|alter|create)\b/i.test(q.sql)));assert.doesNotMatch(JSON.stringify(r),/private-fixture|postgresql|payload/);
});
for(const [name,mutate,expectedConnections]of [
  ['expanded compute',s=>{s.max=8;},0],['wrong quota',s=>{s.quota=0;},0],['untrusted TLS',s=>{s.tls=false;},1],['missing catalog schema',s=>{s.ready=false;},1],['incorrect catalog grants',s=>{s.acl=false;},1],['crossed organization billing',s=>{s.crossed=1;},1],['privileged application role',s=>{s.roleLimited=false;},2],
])test(`refuses ${name} and releases every opened connection`,async()=>{
  const run=await feature(),f=fixture();mutate(f.state);await assert.rejects(run(f.ports),e=>e.message==='Read-only production catalog readiness failed');assert.equal(f.connections.length,expectedConnections);assert.equal(f.ended.length,expectedConnections);
});
