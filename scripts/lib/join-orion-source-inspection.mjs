const CANDIDATE_NAME = /candidate|applicant|application|activity|job|document|resume|consent/i;
const SAFE_CATEGORY = /(^|_)(status|activity_type|event_type|type)$/i;

export const INSPECTION_VERSION = 1;

const rows = result => Array.isArray(result) ? result : result?.rows ?? [];

/**
 * Read PostgreSQL catalogue metadata without selecting a candidate data column.
 * The query interface is deliberately tiny so the inspector can be tested locally.
 */
export async function inspectJoinOrionSource(query) {
  const identity = rows(await query(`select current_database() as database_name,
    (select system_identifier::text from pg_control_system()) as system_identifier`))[0];
  const relations = rows(await query(`select n.nspname as schema_name, c.relname as relation_name,
      case c.relkind when 'r' then 'table' when 'p' then 'partitioned table'
        when 'v' then 'view' when 'm' then 'materialized view' end as relation_type,
      coalesce(s.n_live_tup, 0)::bigint as estimated_row_count
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    left join pg_stat_user_tables s on s.relid=c.oid
    where c.relkind in ('r','p','v','m') and n.nspname not in ('pg_catalog','information_schema')
    order by n.nspname,c.relname`)).filter(r => CANDIDATE_NAME.test(r.relation_name));
  const allowed = new Set(relations.map(r => `${r.schema_name}.${r.relation_name}`));
  const columns = rows(await query(`select table_schema as schema_name, table_name as relation_name,
      column_name, data_type, udt_name, is_nullable='YES' as nullable
    from information_schema.columns
    where table_schema not in ('pg_catalog','information_schema')
    order by table_schema,table_name,ordinal_position`)).filter(r => allowed.has(`${r.schema_name}.${r.relation_name}`));
  const constraints = rows(await query(`select ns.nspname as schema_name, rel.relname as relation_name,
      con.conname as constraint_name, case con.contype when 'p' then 'primary_key'
        when 'u' then 'unique' when 'f' then 'foreign_key' end as constraint_type,
      array(select att.attname from unnest(con.conkey) with ordinality k(attnum,ord)
        join pg_attribute att on att.attrelid=con.conrelid and att.attnum=k.attnum order by k.ord) as columns,
      fns.nspname as referenced_schema, frel.relname as referenced_relation
    from pg_constraint con join pg_class rel on rel.oid=con.conrelid
    join pg_namespace ns on ns.oid=rel.relnamespace
    left join pg_class frel on frel.oid=con.confrelid left join pg_namespace fns on fns.oid=frel.relnamespace
    where con.contype in ('p','u','f') order by ns.nspname,rel.relname,con.conname`))
    .filter(r => allowed.has(`${r.schema_name}.${r.relation_name}`));
  const relevantTypes = new Set(columns.map(column => column.udt_name));
  const enumValues = rows(await query(`select n.nspname as enum_schema, t.typname as enum_name,
      array_agg(e.enumlabel order by e.enumsortorder) as values
    from pg_type t join pg_namespace n on n.oid=t.typnamespace
    join pg_enum e on e.enumtypid=t.oid group by n.nspname,t.typname order by n.nspname,t.typname`))
    .filter(type => relevantTypes.has(type.enum_name));

  return {
    inspection_version: INSPECTION_VERSION,
    source_identity: identity ? { database_name: identity.database_name, system_identifier: identity.system_identifier } : null,
    relations, columns, constraints, enum_values: enumValues,
    safe_distinct_candidates: columns.filter(c => SAFE_CATEGORY.test(c.column_name)).map(c => ({
      schema_name: c.schema_name, relation_name: c.relation_name, column_name: c.column_name,
    })),
    field_presence: {
      document_storage: columns.filter(c => /document|resume|file|storage|bucket|path/i.test(c.column_name)).map(fieldRef),
      consent_evidence: columns.filter(c => /consent|opt(_|)in|opt(_|)out|evidence/i.test(c.column_name)).map(fieldRef),
    },
  };
}

function fieldRef(column) {
  return { schema_name: column.schema_name, relation_name: column.relation_name, column_name: column.column_name };
}

export function assertSeparateSourceAndTarget(source, target) {
  if (!source?.system_identifier || !target?.system_identifier) {
    throw new Error('Cannot verify source/target database identity (pg_control_system system_identifier is required)');
  }
  if (source.system_identifier === target.system_identifier && source.database_name === target.database_name) {
    throw new Error('JOIN_ORION_DATABASE_URL resolves to the CRM target database; explicit source/target separation is required until repository evidence proves they are the same source');
  }
  return 'separate';
}

export function createPostgresQuery(sql) {
  return (text, parameters = []) => sql.unsafe(text, parameters);
}
