import test from 'node:test';
import assert from 'node:assert/strict';
async function feature(){const m=await import('./billing-preview-database.mjs').catch(()=>null);assert.equal(typeof m?.billingPreviewDatabasePreflight,'function','readonly database preflight missing');return m.billingPreviewDatabasePreflight;}
function fixture(){
  const state={host:'ep-hidden-bird-b673zocn.c-2.sa-east-1.aws.neon.tech',role:'neondb_owner',quota:216000,max:0.25,schema:true,privileges:true,closed:false};
  const commands=[],queries=[],connections=[];
  const ports={execute(exe,args,options){
    commands.push(args);assert.ok(args.includes('GET'));assert.equal(options.stdio,'pipe');
    const path=args[3];
    const value=path.endsWith('/connection_uri')?{uri:`postgresql://${state.role}:synthetic-password@${state.host}/vapt?sslmode=require`}
      :path.includes('/endpoints/')?{endpoint:{id:'ep-hidden-bird-b673zocn',branch_id:'br-rough-dew-b6ydeygb',disabled:false,autoscaling_limit_min_cu:0.25,autoscaling_limit_max_cu:state.max}}
      :{project:{id:'dawn-morning-27332079',settings:{quota:{compute_time_seconds:state.quota}}}};
    return JSON.stringify(value);
  },makeClient(options){connections.push(options);return{async connect(){},async query(sql){
    queries.push(sql);if(sql==='select current_database() db,current_user role')return{rows:[{db:'vapt',role:state.role}]};
    if(sql.includes('organization_required'))return{rows:[{relations:state.schema,organization_required:state.schema,restaurant_optional:state.schema,privileges:state.privileges}]};
    if(sql.includes('count(*)::int'))return{rows:[{outbox:0,claims:0,catalog:0}]};return{rows:[]};
  },async end(){state.closed=true;}};}};
  return{state,commands,queries,connections,ports};
}
test('fixed preview direct TLS preflight checks schema/ACL and counts in readonly transaction then closes',async()=>{
  const run=await feature(),f=fixture(),result=await run(f.ports);
  assert.deepEqual(result,{ok:true,readOnly:true,identityVerified:true,schemaVerified:true,grantsVerified:true,endpointLimited:true,outboxRows:0,activeClaims:0,catalogRows:0});
  assert.equal(f.connections[0].host,'ep-hidden-bird-b673zocn.c-2.sa-east-1.aws.neon.tech');assert.deepEqual(f.connections[0].ssl,{rejectUnauthorized:true});
  assert.equal(f.queries[0],'BEGIN READ ONLY');assert.equal(f.queries.at(-1),'ROLLBACK');assert.equal(f.state.closed,true);
  assert.equal(f.queries.some(sql=>/\b(INSERT|UPDATE|DELETE|GRANT|CREATE|ALTER)\b/i.test(sql.replace(/'[^']*'/g,''))),false);
  assert.equal(f.commands.at(-1).includes('branch_id=br-rough-dew-b6ydeygb'),true);
  assert.doesNotMatch(JSON.stringify(result),/synthetic-password|postgresql/);
});
for(const [label,change]of [['production host',f=>{f.state.host='ep-holy-wildflower-b6vtv1dd.c-2.sa-east-1.aws.neon.tech';}],
  ['wrong role',f=>{f.state.role='other';}],['wrong quota',f=>{f.state.quota=0;}],['expanded compute',f=>{f.state.max=8;}]]){
  test(`refuses ${label} before constructing a database client`,async()=>{const run=await feature(),f=fixture();change(f);await assert.rejects(run(f.ports));assert.equal(f.connections.length,0);});
}
for(const [label,change]of [['missing schema',f=>{f.state.schema=false;}],['missing ACL',f=>{f.state.privileges=false;}]]){
  test(`refuses ${label} with rollback and connection cleanup`,async()=>{const run=await feature(),f=fixture();change(f);await assert.rejects(run(f.ports));assert.equal(f.queries.at(-1),'ROLLBACK');assert.equal(f.state.closed,true);});
}
