// Fixed production READ ONLY readiness. No migrations, DML, payloads or secret files.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const neon='C:/Users/Samuel Samek/AppData/Local/npm-cache/_npx/7f657307477966ff/node_modules/neon/dist/cli.js';
export async function billingProductionDatabasePreflight({execute=execFileSync,makeClient}={}){
  const get=(path,query=[])=>JSON.parse(execute(process.execPath,[neon,'--no-analytics','api',path,'-X','GET','-o','json',...query.flatMap(v=>['-Q',v])],{cwd:root,windowsHide:true,encoding:'utf8',stdio:'pipe',timeout:30000,maxBuffer:524288}));
  let client,url,connection;
  try{
    const project=get('/projects/dawn-morning-27332079').project;
    const endpoint=get('/projects/dawn-morning-27332079/endpoints/ep-holy-wildflower-b6vtv1dd').endpoint;
    assert(project?.id==='dawn-morning-27332079'&&project.settings?.quota?.compute_time_seconds===216000);
    assert(endpoint?.id==='ep-holy-wildflower-b6vtv1dd'&&endpoint.branch_id==='br-odd-term-b6j2n9ms'&&endpoint.host==='ep-holy-wildflower-b6vtv1dd.c-2.sa-east-1.aws.neon.tech'&&!endpoint.disabled&&endpoint.autoscaling_limit_min_cu===0.25&&endpoint.autoscaling_limit_max_cu===0.25);
    const value=get('/projects/dawn-morning-27332079/connection_uri',['branch_id=br-odd-term-b6j2n9ms','endpoint_id=ep-holy-wildflower-b6vtv1dd','database_name=vapt','role_name=neondb_owner','pooled=false']);
    url=new URL(value.uri);value.uri='';
    assert(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname===endpoint.host&&url.username==='neondb_owner'&&url.password&&url.pathname==='/vapt'&&['','5432'].includes(url.port)&&!url.hash);
    const create=makeClient??(settings=>{const {Client}=createRequire(root+'/.worktrees/vapt-api-infra-foundation/package.json')('pg');return new Client(settings);});
    connection={host:url.hostname,port:5432,user:'neondb_owner',password:decodeURIComponent(url.password),database:'vapt',ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:8000,query_timeout:10000,options:'-c default_transaction_read_only=on'};url=undefined;
    client=create(connection);await client.connect();
    const tls=client.connection.stream;assert(tls.encrypted===true&&tls.authorized===true&&['TLSv1.2','TLSv1.3'].includes(tls.getProtocol()));
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='8s'");await client.query("SET LOCAL lock_timeout='2s'");
    assert.deepEqual((await client.query("select current_database() as database,current_user as role,session_user as login,current_setting('transaction_read_only') as read_only")).rows[0],{database:'vapt',role:'neondb_owner',login:'neondb_owner',read_only:'on'});
    const schema=(await client.query(`SELECT to_regclass('public.organizations') IS NOT NULL AND to_regclass('public.organization_subscriptions') IS NOT NULL AS relations,
      (select attnotnull from pg_attribute where attrelid='public.billing_email_outbox'::regclass and attname='organization_id' and not attisdropped) AS organization_required,
      (select not attnotnull from pg_attribute where attrelid='public.billing_email_outbox'::regclass and attname='restaurant_id' and not attisdropped) AS restaurant_optional`)).rows[0];
    assert(schema?.relations===true&&schema.organization_required===true&&schema.restaurant_optional===true);
    await client.query(await readFile(root+'/infra/neon/verify-billing-email-delivery.sql','utf8'));
    const integrity=await client.query(await readFile(root+'/infra/neon/verify-organization-billing.sql','utf8'));
    assert(integrity.length===2&&Object.values(integrity[0].rows[0]).every(v=>v==='0'));
    const routine=integrity[1].rows;assert(routine.length===1&&routine[0].reconciliation_security_definer&&routine[0].no_public_reconciliation&&routine[0].reconciliation_fixed_search_path?.some(v=>/^search_path=pg_catalog,\s*public$/.test(v)));
    const counts=(await client.query(`SELECT
      (select count(*)::int from public.billing_email_outbox where delivery_status<>'sent') AS outstanding_emails,
      (select count(*)::int from public.billing_email_outbox where delivery_status='sent') AS sent_emails,
      (select count(*)::int from public.billing_provider_events where processing_status in ('received','processing','pending_retry')) AS unresolved_events`)).rows[0];
    assert(counts?.outstanding_emails===0&&counts.unresolved_events===0&&Number.isInteger(counts.sent_emails)&&counts.sent_emails>=0);
    return{ok:true,readOnly:true,identityVerified:true,schemaVerified:true,integrityVerified:true,tlsProtocol:tls.getProtocol(),endpointLimited:true,outstandingEmails:0,unresolvedEvents:0,sentEmails:counts.sent_emails,workerCredentialVerified:false};
  }catch{throw Error('Read-only production billing readiness failed');}
  finally{url=undefined;if(client){await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}if(connection)connection.password=undefined;connection=undefined;}
}
