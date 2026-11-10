// Existing production only, GET metadata + two short READ ONLY TLS sessions.
// No DDL/DML, role switching, credentials on disk, payload reads or empty-DB gate.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const cli='C:/Users/Samuel Samek/AppData/Local/npm-cache/_npx/7f657307477966ff/node_modules/neon/dist/cli.js';
const project='dawn-morning-27332079',branch='br-odd-term-b6j2n9ms',endpoint='ep-holy-wildflower-b6vtv1dd',host=endpoint+'.c-2.sa-east-1.aws.neon.tech';
export async function catalogProductionDatabasePreflight({execute=execFileSync,makeClient}={}){
  let client,connection;
  const get=(path,query=[])=>JSON.parse(execute(process.execPath,[cli,'--no-analytics','api',path,'-X','GET','-o','json',...query.flatMap(v=>['-Q',v])],{cwd:root,windowsHide:true,encoding:'utf8',stdio:'pipe',timeout:30000,maxBuffer:524288}));
  async function close(){if(client){await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}client=undefined;if(connection)connection.password=undefined;connection=undefined;}
  async function connect(role){
    const value=get('/projects/'+project+'/connection_uri',['branch_id='+branch,'endpoint_id='+endpoint,'database_name=vapt','role_name='+role,'pooled=false']);
    const url=new URL(value.uri);value.uri='';
    assert(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname===host&&url.username===role&&url.password&&url.pathname==='/vapt'&&['','5432'].includes(url.port)&&!url.hash);
    connection={host,port:5432,user:role,password:decodeURIComponent(url.password),database:'vapt',ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,statement_timeout:8000,query_timeout:10000,options:'-c default_transaction_read_only=on'};url.password='';
    const create=makeClient??(settings=>{const {Client}=createRequire(root+'/.worktrees/vapt-api-infra-foundation/package.json')('pg');return new Client(settings);});
    client=create(connection);client.on('error',()=>{});await client.connect();const tls=client.connection.stream;
    assert(tls.encrypted===true&&tls.authorized===true&&['TLSv1.2','TLSv1.3'].includes(tls.getProtocol()));
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='8s'");await client.query("SET LOCAL lock_timeout='2s'");
    assert.deepEqual((await client.query("select current_database() as database,current_user as role,session_user as login,current_setting('transaction_read_only') as read_only")).rows[0],{database:'vapt',role,login:role,read_only:'on'});
    return tls.getProtocol();
  }
  try{
    const p=get('/projects/'+project).project,e=get('/projects/'+project+'/endpoints/'+endpoint).endpoint;
    assert(p?.id===project&&p.settings?.quota?.compute_time_seconds===216000);
    assert(e?.id===endpoint&&e.branch_id===branch&&e.host===host&&!e.disabled&&e.autoscaling_limit_min_cu===0.25&&e.autoscaling_limit_max_cu===0.25);
    const ownerTls=await connect('neondb_owner');
    await client.query(await readFile(root+'/infra/neon/verify-tenant-foundation.sql','utf8'));
    const billing=await client.query(await readFile(root+'/infra/neon/verify-organization-billing.sql','utf8'));
    assert(billing.length===2&&Object.values(billing[0].rows[0]).every(v=>v==='0'));
    assert(billing[1].rows.length===1&&billing[1].rows[0].reconciliation_security_definer&&billing[1].rows[0].no_public_reconciliation&&billing[1].rows[0].reconciliation_fixed_search_path?.some(v=>/^search_path=pg_catalog,\s*public$/.test(v)));
    const catalog=(await client.query(`SELECT
      to_regclass('public.catalog_publication_operations') IS NOT NULL AND to_regclass('public.catalog_publication_revisions') IS NOT NULL AND to_regclass('public.catalog_publication_version_seq') IS NOT NULL AS catalog_ready,
      has_table_privilege('vapt_api_production','public.catalog_publication_operations','SELECT') AND has_table_privilege('vapt_api_production','public.catalog_publication_operations','INSERT') AND has_table_privilege('vapt_api_production','public.catalog_publication_operations','DELETE')
      AND NOT has_table_privilege('vapt_api_production','public.catalog_publication_operations','UPDATE') AND NOT has_table_privilege('vapt_api_production','public.catalog_publication_operations','TRUNCATE')
      AND has_table_privilege('vapt_api_production','public.catalog_publication_revisions','SELECT') AND has_table_privilege('vapt_api_production','public.catalog_publication_revisions','INSERT') AND has_table_privilege('vapt_api_production','public.catalog_publication_revisions','UPDATE')
      AND NOT has_table_privilege('vapt_api_production','public.catalog_publication_revisions','DELETE') AND NOT has_table_privilege('vapt_api_production','public.catalog_publication_revisions','TRUNCATE')
      AND has_sequence_privilege('vapt_api_production','public.catalog_publication_version_seq','USAGE') AND has_sequence_privilege('vapt_api_production','public.catalog_publication_version_seq','SELECT') AND NOT has_sequence_privilege('vapt_api_production','public.catalog_publication_version_seq','UPDATE')
      AND has_schema_privilege('vapt_api_production','public','USAGE') AND NOT has_schema_privilege('vapt_api_production','public','CREATE') AS catalog_acl_ok`)).rows[0];
    assert(catalog?.catalog_ready===true&&catalog.catalog_acl_ok===true);
    const counts=(await client.query('SELECT (select count(*)::int from public.restaurants) AS restaurants,(select count(*)::int from public.catalog_publication_operations) AS journal_operations')).rows[0];
    assert(Number.isSafeInteger(counts?.restaurants)&&counts.restaurants>=0&&Number.isSafeInteger(counts.journal_operations)&&counts.journal_operations>=0);await close();
    const applicationTls=await connect('vapt_api_production');
    const role=(await client.query("select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,(select count(*)::int from pg_auth_members where member=pg_roles.oid) as memberships from pg_roles where rolname=current_user")).rows[0];
    assert.deepEqual(role,{rolcanlogin:true,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,memberships:0});
    for(const table of ['organizations','organization_members','organization_subscriptions','catalog_publication_operations','catalog_publication_revisions','onboarding_intents'])await client.query('SELECT 1 FROM public.'+table+' LIMIT 0');
    return {ok:true,readOnly:true,computeLimited:true,tenantIntegrityVerified:true,catalogGrantsVerified:true,applicationLoginVerified:true,workerCredentialVerified:false,ownerTls,applicationTls,counts:{restaurants:counts.restaurants,journalOperations:counts.journal_operations}};
  }catch{throw Error('Read-only production catalog readiness failed');}
  finally{await close();}
}
