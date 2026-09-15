#!/usr/bin/env bash
set -euo pipefail

# Run on the Coolify/Supabase host. The Postgres container stays private;
# psql is executed inside it, with SQL supplied through stdin.
if [[ -z "${SUPABASE_DB_CONTAINER:-}" ]]; then
  echo "Set SUPABASE_DB_CONTAINER to the exact running Supabase Postgres container name." >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migrations_dir="${script_dir}/../supabase/migrations"
container_name="${SUPABASE_DB_CONTAINER}"

if ! docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null | grep -qx true; then
  echo "The named Supabase Postgres container is not running: ${container_name}" >&2
  exit 2
fi

docker exec -i "${container_name}" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
create schema if not exists vapt_schema_migrations;
create table if not exists vapt_schema_migrations.applied (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
revoke all on schema vapt_schema_migrations from public;
revoke all on table vapt_schema_migrations.applied from public;
SQL

applied_count="$(docker exec -i "${container_name}" psql -X -A -t -v ON_ERROR_STOP=1 \
  -U postgres -d postgres \
  -c "select count(*) from vapt_schema_migrations.applied")"

if [[ "${applied_count}" == "0" ]]; then
  existing_vapt_tables="$(docker exec -i "${container_name}" psql -X -A -t -v ON_ERROR_STOP=1 \
    -U postgres -d postgres -c "
      select count(*)
      from (values
        (to_regclass('public.organizations')),
        (to_regclass('public.organization_members')),
        (to_regclass('public.organization_subscriptions')),
        (to_regclass('public.restaurants')),
        (to_regclass('public.account_preferences')),
        (to_regclass('public.restaurant_activation_progress')),
        (to_regclass('public.menu_items')),
        (to_regclass('public.menu_item_variations')),
        (to_regclass('public.table_sessions')),
        (to_regclass('public.orders')),
        (to_regclass('public.order_items')),
        (to_regclass('public.order_feedback')),
        (to_regclass('public.push_subscriptions')),
        (to_regclass('public.payment_provider_accounts')),
        (to_regclass('public.payment_transactions')),
        (to_regclass('public.payment_webhook_events')),
        (to_regclass('public.payment_oauth_states')),
        (to_regclass('public.payment_effect_outbox'))
      ) as expected(table_oid)
      where table_oid is not null
    ")"
  if [[ "${existing_vapt_tables}" != "0" ]]; then
    echo "Refusing baseline: expected an empty Vapt schema, but Vapt tables already exist." >&2
    exit 2
  fi
fi

shopt -s nullglob
migration_files=("${migrations_dir}"/*.sql)
if (( ${#migration_files[@]} == 0 )); then
  echo "No executable migrations found in ${migrations_dir}" >&2
  exit 2
fi

for migration_file in "${migration_files[@]}"; do
  migration_name="$(basename "${migration_file}")"
  if [[ ! "${migration_name}" =~ ^[0-9]+_[a-z0-9_]+\.sql$ ]]; then
    echo "Unexpected migration filename: ${migration_name}" >&2
    exit 2
  fi

  migration_checksum="$(sha256sum "${migration_file}" | cut -d ' ' -f1)"

  applied_checksum="$(docker exec -i "${container_name}" psql -X -A -t -v ON_ERROR_STOP=1 \
    -U postgres -d postgres -v migration_name="${migration_name}" \
    -c "select checksum from vapt_schema_migrations.applied where version = :'migration_name'")"
  if [[ -n "${applied_checksum}" && "${applied_checksum}" != "${migration_checksum}" ]]; then
    echo "Checksum mismatch for applied migration: ${migration_name}" >&2
    exit 2
  fi
  if [[ "${applied_checksum}" == "${migration_checksum}" ]]; then
    echo "Already applied: ${migration_name}"
    continue
  fi

  echo "Applying: ${migration_name}"
  {
    printf 'begin;\n'
    cat "${migration_file}"
    printf "\ninsert into vapt_schema_migrations.applied(version, checksum) values ('%s', '%s');\ncommit;\n" \
      "${migration_name}" "${migration_checksum}"
  } | docker exec -i "${container_name}" psql -X -q -v ON_ERROR_STOP=1 \
    -U postgres -d postgres
done

echo "Vapt migrations are up to date."
