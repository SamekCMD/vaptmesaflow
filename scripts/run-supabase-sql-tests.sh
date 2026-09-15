#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_CONTAINER:-}" ]]; then
  echo "Set SUPABASE_DB_CONTAINER to the exact running Supabase Postgres container name." >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tests_dir="${script_dir}/../supabase/tests"
container_name="${SUPABASE_DB_CONTAINER}"

if ! docker inspect --format '{{.State.Running}}' "${container_name}" 2>/dev/null | grep -qx true; then
  echo "The named Supabase Postgres container is not running: ${container_name}" >&2
  exit 2
fi

shopt -s nullglob
test_files=("${tests_dir}"/*_test.sql)
if (( ${#test_files[@]} == 0 )); then
  echo "No SQL regression tests found in ${tests_dir}." >&2
  exit 2
fi

for test_file in "${test_files[@]}"; do
  test_name="$(basename "${test_file}")"
  echo "Running: ${test_name}"
  if ! test_output="$(docker exec -i "${container_name}" \
    psql -X -A -t -v ON_ERROR_STOP=1 -U postgres -d postgres < "${test_file}" 2>&1)"; then
    printf '%s\n' "${test_output}" >&2
    exit 1
  fi
  # pgTAP finish() reports an incorrect test count as a diagnostic rather
  # than a SQL error. Reject both failed assertions and finish diagnostics.
  if grep -Eq '(^|[[:space:]|])not ok([[:space:]]|$)|# Looks like' <<<"${test_output}"; then
    printf '%s\n' "${test_output}" >&2
    exit 1
  fi
  if ! grep -Eq '(^|[[:space:]|])1\.\.[0-9]+([[:space:]]|$)' <<<"${test_output}"; then
    printf 'No pgTAP plan was emitted by %s.\n' "${test_name}" >&2
    printf '%s\n' "${test_output}" >&2
    exit 1
  fi
  echo "Passed: ${test_name}"
done

echo "All Supabase SQL regression tests passed."
