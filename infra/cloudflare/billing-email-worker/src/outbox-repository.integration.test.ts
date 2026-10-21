// Executed against the disposable loopback cluster by A's test:tenant-pg harness.
// The ordinary worker unit suite skips these cases; it never opens a provider URL.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {dispatchDue} from './dispatcher.js';
import type {EmailSnapshot,OutboxMessage} from './contracts.js';
import {buildOutboxRepository} from './outbox-repository.js';
import {consumeBillingMessage} from './consumer.js';
import {snapshotFor} from './templates.js';
type LocalPool={query(sql:string,params?:unknown[]):Promise<{rows:Record<string,unknown>[]}>};
type Fixture={pool:LocalPool;owner:string;admin:string;orgA:string;orgB:string;restA:string;restB:string};
const local=Boolean(process.env.TENANT_TEST_DATABASE_URL);
const localOnly={skip:local?false:'Run API test:tenant-pg for isolated local PostgreSQL coverage'};
async function support(){
  const root=process.env.TENANT_SCHEMA_ROOT,api=process.env.TENANT_TEST_API_ROOT;
  if(!root||!api||resolve(api)!==resolve(root,'.worktrees/vapt-api-infra-foundation'))throw new Error('Local tenant test harness required');
  return import(pathToFileURL(resolve(api,'src/modules/tenancy/pg-test-support.ts')).href);
}
const repositoryFor=(pool:LocalPool)=>buildOutboxRepository(async(statement,params)=>(await pool.query(statement,params)).rows);
async function insertOutbox(pool:LocalPool,organizationId:string,now:Date,restaurantId:string|null=null){
  const id=randomUUID();
  await pool.query(`insert into public.billing_email_outbox
    (id,organization_id,restaurant_id,provider_event_id,email_kind,billing_resource_id,payload,next_attempt_at)
    values($1,$2,$3,$4,'subscription_activated',$5,'{"planType":"pro"}',$6)`,
    [id,organizationId,restaurantId,'evt_local_'+id,'in_local_'+id,now.toISOString()]);
  return id;
}
test('legacy delivery retry preserves the frozen recipient across organization migration',localOnly,async()=>{
  const helper=await support();
  await helper.withBaselineDatabase(async(pool:LocalPool)=>{
    const owner=await helper.seedUser(pool),restaurantId=randomUUID(),outboxId=randomUUID(),now=new Date();
    const original=snapshotFor('subscription_activated','Nome Original','pro','original@example.invalid');
    await pool.query(`insert into public.restaurants(id,owner_id,name,slug) values($1,$2,'Nome Original',$3)`,
      [restaurantId,owner,'frozen-'+restaurantId]);
    await pool.query(`insert into public.billing_email_outbox(id,restaurant_id,provider_event_id,email_kind,billing_resource_id,
      payload,delivery_status,attempt_count,next_attempt_at,first_send_attempt_at,recipient_email,template_alias,template_variables)
      values($1,$2,'evt_frozen','subscription_activated','in_frozen','{"planType":"pro"}','pending_retry',2,$3,$4,$5,$6,$7)`,
      [outboxId,restaurantId,now.toISOString(),new Date(now.getTime()-60_000).toISOString(),original.to,original.templateAlias,JSON.stringify(original.variables)]);
    await helper.applyTenantMigration(pool,'010');await helper.applyTenantMigration(pool,'011');
    const organizationId=(await pool.query('select organization_id from public.restaurants where id=$1',[restaurantId])).rows[0]!.organization_id;
    await pool.query("update public.organizations set name='Grupo Renomeado' where id=$1",[organizationId]);
    await pool.query('update better_auth."user" set email=$1,"emailVerified"=false where id=$2',['changed@example.invalid',owner]);
    const repository=repositoryFor(pool);
    assert.deepEqual(await repository.reserveDispatch(now,20),[{outboxId,correlationId:outboxId}]);
    const claims=await Promise.all([repository.claimDelivery(outboxId,now),repository.claimDelivery(outboxId,now)]);
    assert.equal(claims.filter(Boolean).length,1);
    const lease=claims.find(Boolean)!;
    assert.equal(lease.organizationId,organizationId);assert.equal(lease.attemptCount,3);
    assert.equal(lease.snapshot?.to,'original@example.invalid');assert.deepEqual(lease.snapshot,original);
    assert.deepEqual(await repository.saveSnapshot(lease,snapshotFor('subscription_activated','Novo Nome','business','admin@example.invalid'),now),original);
    assert.equal(await repository.markSent({...lease,attemptCount:2},'stale',now),false);
    assert.equal(await repository.markSent(lease,'synthetic-resend-id',now),true);
    const row=(await pool.query('select recipient_email,template_variables,attempt_count,delivery_status from public.billing_email_outbox where id=$1',[outboxId])).rows[0]!;
    assert.deepEqual(row,{recipient_email:original.to,template_variables:original.variables,attempt_count:3,delivery_status:'sent'});
  });
});
test('organization-only delivery uses the verified billing contact, never an admin or a restaurant owner join',localOnly,async()=>{
  const helper=await support();
  await helper.withTenantFixture(async(f:Fixture)=>{
    const now=new Date(),repository=repositoryFor(f.pool);
    await f.pool.query("update public.organizations set name='Grupo Vapt Teste' where id=$1",[f.orgA]);
    const outboxId=await insertOutbox(f.pool,f.orgA,now);
    await repository.reserveDispatch(now,20);
    const sent:Array<{snapshot:EmailSnapshot;id:string}>=[];
    const gateway={async sendBillingEmail(snapshot:EmailSnapshot,id:string){sent.push({snapshot,id});return {kind:'sent' as const,resendId:'synthetic'};}};
    assert.equal(await consumeBillingMessage({version:1,outboxId,correlationId:outboxId},repository,gateway,now),'ack');
    assert.deepEqual(sent,[{id:outboxId,snapshot:snapshotFor('subscription_activated','Grupo Vapt Teste','pro',f.owner+'@example.invalid')}]);
    await f.pool.query('update better_auth."user" set "emailVerified"=false where id=$1',[f.owner]);
    const unverified=await insertOutbox(f.pool,f.orgA,now,f.restB);
    await repository.reserveDispatch(now,20);
    assert.equal(await consumeBillingMessage({version:1,outboxId:unverified,correlationId:unverified},repository,gateway,now),'ack');
    assert.equal(sent.length,1);
    assert.deepEqual((await f.pool.query('select delivery_status,last_error from public.billing_email_outbox where id=$1',[unverified])).rows[0],
      {delivery_status:'dead_letter',last_error:'invalid_delivery_context'});
  });
});
test('local Postgres republishes an unconsumed ID only after its bounded reservation expires',localOnly,async()=>{
  const helper=await support();
  await helper.withTenantFixture(async(f:Fixture)=>{
    const now=new Date(),repository=repositoryFor(f.pool),messages:OutboxMessage[]=[];
    const outboxId=await insertOutbox(f.pool,f.orgA,now);
    const queue={async send(message:OutboxMessage){messages.push(message);}};
    await Promise.all([dispatchDue(repository,queue,now),dispatchDue(repository,queue,now)]);
    assert.deepEqual(messages,[{version:1,outboxId,correlationId:outboxId}]);
    await dispatchDue(repository,queue,new Date(now.getTime()+4*60_000));assert.equal(messages.length,1);
    await dispatchDue(repository,queue,new Date(now.getTime()+6*60_000));assert.equal(messages.length,2);
    const claims=await Promise.all([repository.claimDelivery(outboxId,new Date(now.getTime()+6*60_000)),
      repository.claimDelivery(outboxId,new Date(now.getTime()+6*60_000))]);
    assert.equal(claims.filter(Boolean).length,1);
    const first=claims.find(Boolean)!;
    const frozen=snapshotFor('subscription_activated','Grupo Original','pro',f.owner+'@example.invalid');
    await repository.saveSnapshot(first,frozen,now);
    await repository.scheduleRetry(first,'synthetic_retry',new Date(now.getTime()+7*60_000));
    assert.equal(await repository.claimDelivery(outboxId,new Date(now.getTime()+6*60_000+1000)),null);
    const retryTime=new Date(now.getTime()+7*60_000+1000);
    await repository.reserveDispatch(retryTime,20);
    const second=await repository.claimDelivery(outboxId,retryTime);assert.ok(second);
    assert.equal(second.attemptCount,2);assert.deepEqual(second.snapshot,frozen);
    assert.equal(await repository.markSent(first,'stale',retryTime),false);
    assert.equal(await repository.markSent(second,'synthetic',retryTime),true);
  });
});
