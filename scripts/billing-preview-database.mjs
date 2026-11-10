import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const neon='C:/Users/Samuel Samek/AppData/Local/npm-cache/_npx/7f657307477966ff/node_modules/neon/dist/cli.js';
const guard=v=>{if(!v)throw Error('Preview database guard failed');};
// Fixed existing preview, never env/argv credentials, never migrations or DML.
export async function billingPreviewDatabasePreflight({execute=execFileSync,makeClient}={}){
  const get=(path,query=[])=>JSON.parse(execute(process.execPath,[neon,'--no-analytics','api',path,'-X','GET','-o','json',...query.flatMap(v=>['-Q',v])],
    {cwd:root,windowsHide:true,encoding:'utf8',stdio:'pipe',timeout:30000,maxBuffer:1048576}));
  let client,url;
  try{
    const project=get('/projects/dawn-morning-27332079').project;
    const endpoint=get('/projects/dawn-morning-27332079/endpoints/ep-hidden-bird-b673zocn').endpoint;
    guard(project?.id==='dawn-morning-27332079'&&project.settings?.quota?.compute_time_seconds===216000);
    guard(endpoint?.id==='ep-hidden-bird-b673zocn'&&endpoint.branch_id==='br-rough-dew-b6ydeygb'&&!endpoint.disabled
      &&endpoint.autoscaling_limit_min_cu===0.25&&endpoint.autoscaling_limit_max_cu===0.25);
    const connection=get('/projects/dawn-morning-27332079/connection_uri',['branch_id=br-rough-dew-b6ydeygb','endpoint_id=ep-hidden-bird-b673zocn','database_name=vapt','role_name=neondb_owner','pooled=false']);
    url=new URL(connection.uri);connection.uri='';
    guard(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='ep-hidden-bird-b673zocn.c-2.sa-east-1.aws.neon.tech'
      &&url.username==='neondb_owner'&&url.password&&url.pathname==='/vapt'&&['','5432'].includes(url.port)&&!url.hash);
    const create=makeClient??(options=>{const {Client}=createRequire(root+'/.worktrees/vapt-api-infra-foundation/package.json')('pg');return new Client(options);});
    client=create({host:url.hostname,port:5432,user:'neondb_owner',password:decodeURIComponent(url.password),database:'vapt',ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000});url=undefined;
    await client.connect();await client.query('BEGIN READ ONLY');await client.query("SET LOCAL statement_timeout='8s'");await client.query("SET LOCAL lock_timeout='2s'");
    const identity=(await client.query('select current_database() db,current_user role')).rows[0];guard(identity.db==='vapt'&&identity.role==='neondb_owner');
    const schema=(await client.query(`SELECT
      to_regclass('public.organizations') IS NOT NULL AND to_regclass('public.organization_subscriptions') IS NOT NULL
        AND to_regclass('public.catalog_publication_operations') IS NOT NULL AS relations,
      (select attnotnull from pg_attribute where attrelid='public.billing_email_outbox'::regclass and attname='organization_id' and not attisdropped) AS organization_required,
      (select not attnotnull from pg_attribute where attrelid='public.billing_email_outbox'::regclass and attname='restaurant_id' and not attisdropped) AS restaurant_optional,
      has_table_privilege(current_user,'public.billing_email_outbox','SELECT') AND has_table_privilege(current_user,'public.billing_email_outbox','UPDATE')
        AND has_table_privilege(current_user,'public.organizations','SELECT') AND has_table_privilege(current_user,'public.organization_subscriptions','SELECT')
        AND has_table_privilege(current_user,'better_auth."user"','SELECT') AS privileges`)).rows[0];
    guard(schema.relations&&schema.organization_required&&schema.restaurant_optional&&schema.privileges);
    const counts=(await client.query(`SELECT (select count(*)::int from public.billing_email_outbox) outbox,
      (select count(*)::int from public.billing_provider_events where processing_status='processing') claims,
      (select count(*)::int from public.catalog_publication_operations) catalog`)).rows[0];
    return{ok:true,readOnly:true,identityVerified:true,schemaVerified:true,grantsVerified:true,endpointLimited:true,
      outboxRows:counts.outbox,activeClaims:counts.claims,catalogRows:counts.catalog};
  }catch{throw Error('Read-only preview database preflight failed');}
  finally{url=undefined;if(client){await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}}
}
