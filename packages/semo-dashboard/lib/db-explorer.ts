import { query, transaction } from './db';
import type { DBTable, DBColumn, DBConstraint, DBIndex, DBTableDetail, DBDataResult, DBQueryResult } from '@/types';

const ALLOWED_SCHEMAS_TABLES = `
  (t.table_schema = 'semo'
   OR (t.table_schema = 'public' AND t.table_name IN (
     'skill_definitions', 'command_definitions', 'agent_definitions')))
`;

export async function listTables(): Promise<DBTable[]> {
  const sql = `
    SELECT t.table_schema, t.table_name,
           COALESCE(pg_stat.n_live_tup, 0)::int AS row_count_estimate
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables pg_stat
      ON pg_stat.schemaname = t.table_schema AND pg_stat.relname = t.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND ${ALLOWED_SCHEMAS_TABLES}
    ORDER BY t.table_schema, t.table_name
  `;
  const result = await query<DBTable>(sql);
  return result.rows;
}

async function validateTable(schema: string, table: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM information_schema.tables t
     WHERE t.table_schema = $1 AND t.table_name = $2
       AND t.table_type = 'BASE TABLE'
       AND ${ALLOWED_SCHEMAS_TABLES}`,
    [schema, table]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

async function validateColumn(schema: string, table: string, column: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, table, column]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getTableDetail(schema: string, table: string): Promise<DBTableDetail | null> {
  if (!(await validateTable(schema, table))) return null;

  // Columns
  const colResult = await query<DBColumn & { is_primary_key: boolean }>(
    `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
            EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_schema = $1 AND tc.table_name = $2
                AND kcu.column_name = c.column_name
            ) AS is_primary_key
     FROM information_schema.columns c
     WHERE c.table_schema = $1 AND c.table_name = $2
     ORDER BY c.ordinal_position`,
    [schema, table]
  );

  // Constraints
  const conResult = await query<{
    constraint_name: string;
    constraint_type: string;
    column_name: string;
    foreign_table_schema: string | null;
    foreign_table_name: string | null;
    foreign_column_name: string | null;
  }>(
    `SELECT tc.constraint_name, tc.constraint_type,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     LEFT JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
       AND tc.constraint_type = 'FOREIGN KEY'
     WHERE tc.table_schema = $1 AND tc.table_name = $2
     ORDER BY tc.constraint_name, kcu.ordinal_position`,
    [schema, table]
  );

  // Group constraints
  const constraintMap = new Map<string, DBConstraint>();
  for (const row of conResult.rows) {
    if (!constraintMap.has(row.constraint_name)) {
      constraintMap.set(row.constraint_name, {
        constraint_name: row.constraint_name,
        constraint_type: row.constraint_type,
        columns: [],
        foreign_table_schema: row.foreign_table_schema ?? undefined,
        foreign_table_name: row.foreign_table_name ?? undefined,
        foreign_columns: [],
      });
    }
    const c = constraintMap.get(row.constraint_name)!;
    if (!c.columns.includes(row.column_name)) {
      c.columns.push(row.column_name);
    }
    if (row.foreign_column_name && !c.foreign_columns?.includes(row.foreign_column_name)) {
      c.foreign_columns?.push(row.foreign_column_name);
    }
  }

  // Indexes
  const idxResult = await query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = $1 AND tablename = $2
     ORDER BY indexname`,
    [schema, table]
  );

  return {
    schema,
    table,
    columns: colResult.rows,
    constraints: Array.from(constraintMap.values()),
    indexes: idxResult.rows.map((r) => ({
      indexname: r.indexname,
      indexdef: r.indexdef,
      is_unique: r.indexdef.includes('UNIQUE'),
    })),
  };
}

export async function getTableData(
  schema: string,
  table: string,
  opts: {
    page?: number;
    pageSize?: number;
    sortColumn?: string;
    sortDir?: 'asc' | 'desc';
  } = {}
): Promise<DBDataResult | null> {
  if (!(await validateTable(schema, table))) return null;

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  let orderClause = '';
  if (opts.sortColumn) {
    if (!(await validateColumn(schema, table, opts.sortColumn))) {
      return null;
    }
    const dir = opts.sortDir === 'desc' ? 'DESC' : 'ASC';
    orderClause = `ORDER BY "${opts.sortColumn}" ${dir}`;
  }

  const qualifiedTable = `"${schema}"."${table}"`;
  const countResult = await query<{ count: string }>(`SELECT count(*)::text AS count FROM ${qualifiedTable}`);
  const totalRows = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query(
    `SELECT * FROM ${qualifiedTable} ${orderClause} LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );

  const columns = dataResult.fields.map((f) => f.name);

  return {
    rows: dataResult.rows,
    columns,
    totalRows,
    page,
    pageSize,
  };
}

export async function updateCell(
  schema: string,
  table: string,
  pkValues: Record<string, unknown>,
  column: string,
  value: unknown
): Promise<{ rowCount: number }> {
  if (!(await validateTable(schema, table))) {
    throw new Error('Table not found or not allowed');
  }
  if (!(await validateColumn(schema, table, column))) {
    throw new Error(`Column "${column}" not found`);
  }

  // Get PK columns from table detail
  const detail = await getTableDetail(schema, table);
  if (!detail) throw new Error('Failed to get table detail');

  const pkColumns = detail.columns.filter((c) => c.is_primary_key).map((c) => c.column_name);
  if (pkColumns.length === 0) {
    throw new Error('Table has no primary key — updates are not allowed');
  }

  // Validate all PK columns are provided
  for (const pk of pkColumns) {
    if (!(pk in pkValues)) {
      throw new Error(`Missing primary key value for "${pk}"`);
    }
  }

  const qualifiedTable = `"${schema}"."${table}"`;
  const setCols = `"${column}" = $1`;
  const whereClauses = pkColumns.map((pk, i) => `"${pk}" = $${i + 2}`);
  const params = [value, ...pkColumns.map((pk) => pkValues[pk])];

  const sql = `UPDATE ${qualifiedTable} SET ${setCols} WHERE ${whereClauses.join(' AND ')}`;
  const result = await query(sql, params);

  return { rowCount: result.rowCount ?? 0 };
}

const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE|COPY)\b/i;

export async function executeReadOnlyQuery(sql: string): Promise<DBQueryResult> {
  // Strip comments
  const stripped = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();

  // Must start with SELECT or WITH
  if (!/^(SELECT|WITH)\b/i.test(stripped)) {
    throw new Error('Only SELECT or WITH queries are allowed');
  }

  // Check for forbidden keywords
  if (FORBIDDEN_KEYWORDS.test(stripped)) {
    throw new Error('Query contains forbidden keywords (INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXECUTE, COPY)');
  }

  // Reject multi-statement
  const withoutStrings = stripped.replace(/'[^']*'/g, '');
  if (withoutStrings.includes(';') && withoutStrings.indexOf(';') < withoutStrings.length - 1) {
    throw new Error('Multi-statement queries are not allowed');
  }

  const start = Date.now();

  const result = await transaction(async (client) => {
    await client.query('SET LOCAL statement_timeout = \'10s\'');
    // Force read-only transaction
    await client.query('SET TRANSACTION READ ONLY');
    return client.query(stripped.replace(/;$/, ''));
  });

  const durationMs = Date.now() - start;
  const columns = result.fields.map((f) => f.name);

  return {
    columns,
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
    durationMs,
  };
}
