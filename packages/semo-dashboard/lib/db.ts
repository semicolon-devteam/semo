/**
 * Database Client Utilities
 * 
 * PostgreSQL client wrapper for SEMO Dashboard
 */

import { Client, QueryResult } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

/**
 * Execute a database query
 * @param query SQL query string
 * @param params Query parameters
 * @returns Query result
 */
export async function query<T = any>(
  query: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query<T>(query, params);
    return result;
  } finally {
    await client.end();
  }
}

/**
 * Execute multiple queries in a transaction
 * @param callback Function that receives client and executes queries
 * @returns Result from callback
 */
export async function transaction<T>(
  callback: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
