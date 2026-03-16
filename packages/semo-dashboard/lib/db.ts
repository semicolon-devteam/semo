/**
 * @file lib/db.ts
 * @description PostgreSQL 연결 풀 싱글톤.
 *   매 요청마다 새 커넥션을 열지 않고 Pool을 재사용한다.
 * @dependencies pg (node-postgres), DATABASE_URL 환경변수
 * @usage
 *   import { query, transaction } from '@/lib/db';
 *   const result = await query<MyRow>('SELECT * FROM table WHERE id = $1', [id]);
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let _pool: Pool | null = null;

/**
 * PostgreSQL 연결 풀 싱글톤을 반환한다.
 * 최초 호출 시 Pool을 생성하고, 이후에는 동일 인스턴스를 반환한다.
 *
 * @returns 초기화된 Pool 인스턴스
 * @throws {Error} DATABASE_URL 환경변수가 설정되지 않은 경우
 */
function getPool(): Pool {
  if (!_pool) {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

/**
 * 파라미터화된 SQL 쿼리를 실행한다.
 *
 * @param sql - 실행할 SQL 문 (파라미터는 $1, $2 ... 형식)
 * @param params - SQL 파라미터 값 배열
 * @returns pg QueryResult 객체 (rows 포함)
 * @throws {Error} DB 연결 실패 또는 쿼리 오류
 *
 * @example
 * const res = await query<BotRow>('SELECT * FROM semo.bot_status WHERE bot_id = $1', [botId]);
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

/**
 * 트랜잭션 내에서 콜백을 실행한다.
 * 콜백이 예외를 던지면 자동으로 ROLLBACK된다.
 *
 * @param callback - PoolClient를 받아 비동기 작업을 수행하는 함수
 * @returns 콜백의 반환값
 * @throws {Error} 콜백 실패 시 ROLLBACK 후 원래 에러를 다시 던짐
 *   - DB 연결 오류: Pool에서 커넥션을 얻지 못한 경우
 *   - 쿼리 오류: SQL 실행 실패
 *   - 비즈니스 로직 오류: 콜백 내부에서 던진 오류
 *
 * @example
 * await transaction(async (client) => {
 *   await client.query('UPDATE ...', [...]);
 *   await client.query('INSERT ...', [...]);
 * });
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
