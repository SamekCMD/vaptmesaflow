DO $$
DECLARE
  missing_tables text[];
  invalid_id_tables text[];
  user_id_type text;
  owner_id_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'better_auth'
  ) THEN
    RAISE EXCEPTION 'Missing schema: better_auth';
  END IF;

  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO missing_tables
  FROM (
    VALUES ('user'), ('session'), ('account'), ('verification')
  ) AS required(table_name)
  WHERE to_regclass(format('better_auth.%I', required.table_name)) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing Better Auth tables: %', missing_tables;
  END IF;

  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO invalid_id_tables
  FROM (
    VALUES ('user'), ('session'), ('account'), ('verification')
  ) AS required(table_name)
  LEFT JOIN information_schema.columns AS columns
    ON columns.table_schema = 'better_auth'
   AND columns.table_name = required.table_name
   AND columns.column_name = 'id'
  WHERE columns.data_type IS DISTINCT FROM 'uuid';

  IF invalid_id_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Better Auth id columns must be uuid: %', invalid_id_tables;
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO user_id_type
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'better_auth.user'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO owner_id_type
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.restaurants'::regclass
    AND attribute.attname = 'owner_id'
    AND NOT attribute.attisdropped;

  IF user_id_type IS NULL OR owner_id_type IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve Better Auth user id or restaurants owner_id type';
  END IF;

  IF user_id_type IS DISTINCT FROM owner_id_type THEN
    RAISE EXCEPTION
      'Identity type mismatch: better_auth.user.id is %, public.restaurants.owner_id is %',
      user_id_type,
      owner_id_type;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_namespace AS namespace_record
    CROSS JOIN LATERAL aclexplode(
      COALESCE(
        namespace_record.nspacl,
        acldefault('n', namespace_record.nspowner)
      )
    ) AS privilege_record
    WHERE namespace_record.nspname = 'better_auth'
      AND privilege_record.grantee = 0
      AND privilege_record.privilege_type IN ('USAGE', 'CREATE')
  ) THEN
    RAISE EXCEPTION 'PUBLIC retains privileges on schema better_auth';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE table_schema = 'better_auth'
      AND grantee = 'PUBLIC'
  ) THEN
    RAISE EXCEPTION 'PUBLIC retains privileges on Better Auth tables';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.usage_privileges
    WHERE object_schema = 'better_auth'
      AND object_type = 'SEQUENCE'
      AND grantee = 'PUBLIC'
  ) THEN
    RAISE EXCEPTION 'PUBLIC retains privileges on Better Auth sequences';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_record
    JOIN pg_class AS source_table
      ON source_table.oid = constraint_record.conrelid
    JOIN pg_namespace AS source_schema
      ON source_schema.oid = source_table.relnamespace
    JOIN pg_class AS target_table
      ON target_table.oid = constraint_record.confrelid
    JOIN pg_namespace AS target_schema
      ON target_schema.oid = target_table.relnamespace
    WHERE constraint_record.contype = 'f'
      AND source_schema.nspname = 'public'
      AND source_table.relname = 'restaurants'
      AND target_schema.nspname = 'better_auth'
      AND target_table.relname = 'user'
      AND EXISTS (
        SELECT 1
        FROM unnest(constraint_record.conkey) AS source_key(attribute_number)
        JOIN pg_attribute AS source_attribute
          ON source_attribute.attrelid = source_table.oid
         AND source_attribute.attnum = source_key.attribute_number
        WHERE source_attribute.attname = 'owner_id'
      )
  ) THEN
    RAISE EXCEPTION
      'public.restaurants.owner_id must not reference better_auth.user';
  END IF;
END
$$;
