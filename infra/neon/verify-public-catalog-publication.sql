-- Read-only, aggregate/schema metadata only. This is not a load generator.
select current_database() as database_name,
  to_regclass('public.catalog_publication_operations') is not null as journal_exists,
  to_regclass('public.catalog_publication_revisions') is not null as revisions_exist,
  to_regclass('public.catalog_publication_version_seq') is not null as version_sequence_exists;

select role_name, to_regrole(role_name) is not null as role_exists,
  has_table_privilege(to_regrole(role_name), 'public.catalog_publication_operations', 'SELECT') as can_read_journal,
  has_table_privilege(to_regrole(role_name), 'public.catalog_publication_operations', 'INSERT') as can_insert_journal,
  has_table_privilege(to_regrole(role_name), 'public.catalog_publication_operations', 'DELETE') as can_expire_journal,
  has_sequence_privilege(to_regrole(role_name), 'public.catalog_publication_version_seq', 'USAGE') as can_allocate_revision
from (values ('vapt_api_preview'), ('vapt_api_production')) as roles(role_name);

select count(*) as operation_count,
  count(*) filter (where expires_at <= clock_timestamp()) as logically_expired_count
from public.catalog_publication_operations;
