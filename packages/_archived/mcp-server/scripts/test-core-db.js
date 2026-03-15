#!/usr/bin/env node
/**
 * core-central-db 연결 테스트 스크립트
 *
 * 사용법:
 *   # 환경변수 설정 후 실행
 *   DB_HOST=<host> DB_PASSWORD=<password> node scripts/test-core-db.js
 *
 *   # 또는 직접 인자로 전달
 *   node scripts/test-core-db.js --host <host> --password <password>
 */

const { Pool } = require('pg');

// 환경변수에서 설정 읽기 (기본값 포함)
const config = {
  primary: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PRIMARY_PORT || '5432'),
    database: process.env.DB_NAME || 'appdb',
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
  replica: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_REPLICA_PORT || '5433'),
    database: process.env.DB_NAME || 'appdb',
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  }
};

// ANSI 색상 코드
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(icon, message, color = colors.reset) {
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

async function testPrimaryConnection() {
  log('📝', 'Primary 서버 테스트 (읽기/쓰기)', colors.blue);
  const pool = new Pool(config.primary);

  try {
    // 연결 테스트
    const versionResult = await pool.query('SELECT version()');
    log('✅', 'Primary 연결 성공', colors.green);
    const version = versionResult.rows[0].version.split(' ').slice(0, 2).join(' ');
    log('  ', `PostgreSQL: ${version}`);

    // 현재 시간 확인
    const timeResult = await pool.query('SELECT NOW() as current_time');
    log('  ', `서버 시간: ${timeResult.rows[0].current_time}`);

    // 데이터베이스 목록
    const dbResult = await pool.query(`
      SELECT datname FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);
    log('  ', `데이터베이스: ${dbResult.rows.map(r => r.datname).join(', ')}`);

    // 스키마 목록
    const schemaResult = await pool.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'
      ORDER BY schema_name
    `);
    log('  ', `스키마: ${schemaResult.rows.map(r => r.schema_name).join(', ') || '(기본 public만)'}`);

    // 테이블 수
    const tableResult = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    log('  ', `Public 테이블 수: ${tableResult.rows[0].count}`);

    // 쓰기 테스트
    await pool.query('CREATE TEMP TABLE semo_test (id SERIAL, msg TEXT)');
    await pool.query("INSERT INTO semo_test (msg) VALUES ('SEMO 연결 테스트')");
    const writeResult = await pool.query('SELECT * FROM semo_test');
    log('✅', `쓰기 테스트 성공: "${writeResult.rows[0].msg}"`, colors.green);

    await pool.end();
    return true;
  } catch (error) {
    log('❌', `Primary 서버 연결 실패: ${error.message}`, colors.red);
    await pool.end().catch(() => {});
    return false;
  }
}

async function testReplicaConnection() {
  log('\n📖', 'Replica 서버 테스트 (읽기 전용)', colors.blue);
  const pool = new Pool(config.replica);

  try {
    // 연결 테스트
    const versionResult = await pool.query('SELECT version()');
    log('✅', 'Replica 연결 성공', colors.green);

    // 읽기 전용 확인
    const recoveryResult = await pool.query('SELECT pg_is_in_recovery()');
    const isReplica = recoveryResult.rows[0].pg_is_in_recovery;
    log('  ', `Replica 모드: ${isReplica ? '읽기 전용 (정상)' : '읽기/쓰기 (비정상!)'}`);

    // 쓰기 테스트 (실패해야 정상)
    try {
      await pool.query('CREATE TEMP TABLE write_test (id INT)');
      log('⚠️', 'Replica 쓰기가 허용됨 (비정상!)', colors.yellow);
    } catch (writeError) {
      if (writeError.message.includes('read-only')) {
        log('✅', 'Replica 쓰기 제한 확인: 읽기 전용 (정상)', colors.green);
      } else {
        log('⚠️', `Replica 쓰기 오류: ${writeError.message}`, colors.yellow);
      }
    }

    await pool.end();
    return true;
  } catch (error) {
    log('❌', `Replica 서버 연결 실패: ${error.message}`, colors.red);
    log('  ', '(Replica가 없는 단일 인스턴스 환경일 수 있음)');
    await pool.end().catch(() => {});
    return false;
  }
}

async function testReplication() {
  log('\n🔄', '복제 상태 확인', colors.blue);
  const pool = new Pool(config.primary);

  try {
    const replicationResult = await pool.query('SELECT * FROM pg_stat_replication');

    if (replicationResult.rows.length > 0) {
      log('✅', '복제 연결 확인됨', colors.green);
      for (const repl of replicationResult.rows) {
        log('  ', `Application: ${repl.application_name}`);
        log('  ', `Client IP: ${repl.client_addr}`);
        log('  ', `State: ${repl.state}`);
        log('  ', `Sync State: ${repl.sync_state}`);
      }
    } else {
      log('⚠️', '복제 연결이 감지되지 않음 (단일 인스턴스)', colors.yellow);
    }

    await pool.end();
    return true;
  } catch (error) {
    log('❌', `복제 상태 확인 실패: ${error.message}`, colors.red);
    await pool.end().catch(() => {});
    return false;
  }
}

async function testSemoSchema() {
  log('\n🧠', 'SEMO 장기 기억 스키마 확인', colors.blue);
  const pool = new Pool(config.primary);

  try {
    // semo 스키마 존재 확인
    const schemaResult = await pool.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name = 'semo'
    `);

    if (schemaResult.rows.length > 0) {
      log('✅', 'semo 스키마 존재', colors.green);

      // semo 스키마 테이블 목록
      const tablesResult = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'semo'
        ORDER BY table_name
      `);

      if (tablesResult.rows.length > 0) {
        log('  ', `테이블: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
      } else {
        log('  ', '테이블 없음 (Phase 1 미적용)');
      }
    } else {
      log('⚠️', 'semo 스키마 없음 (Phase 1 적용 필요)', colors.yellow);
    }

    // pgvector 확장 확인
    const vectorResult = await pool.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);

    if (vectorResult.rows.length > 0) {
      log('✅', 'pgvector 확장 설치됨', colors.green);
    } else {
      log('⚠️', 'pgvector 확장 없음 (Phase 2 적용 필요)', colors.yellow);
    }

    await pool.end();
    return true;
  } catch (error) {
    log('❌', `SEMO 스키마 확인 실패: ${error.message}`, colors.red);
    await pool.end().catch(() => {});
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('🔍', 'core-central-db 연결 테스트 시작', colors.cyan);
  console.log('='.repeat(60));

  console.log(`\n📋 연결 설정:`);
  console.log(`   Primary: ${config.primary.host}:${config.primary.port}/${config.primary.database}`);
  console.log(`   Replica: ${config.replica.host}:${config.replica.port}/${config.replica.database}`);
  console.log(`   User: ${config.primary.user}`);
  console.log(`   Password: ${config.primary.password ? '****' : '(not set)'}`);
  console.log(`   SSL: ${config.primary.ssl ? 'enabled' : 'disabled'}`);
  console.log('');

  if (!config.primary.password) {
    log('⚠️', '패스워드가 설정되지 않았습니다.', colors.yellow);
    log('  ', '사용법: DB_PASSWORD=<password> node scripts/test-core-db.js');
    log('  ', '또는 환경변수 DB_HOST, DB_USER, DB_PASSWORD를 설정하세요.');
    console.log('');
  }

  const results = {
    primary: await testPrimaryConnection(),
    replica: await testReplicaConnection(),
    replication: false,
    semoSchema: false,
  };

  if (results.primary) {
    results.replication = await testReplication();
    results.semoSchema = await testSemoSchema();
  }

  console.log('\n' + '='.repeat(60));
  log('📊', '테스트 결과 요약', colors.cyan);
  console.log('='.repeat(60));

  const statusIcon = (ok) => ok ? '✅' : '❌';
  console.log(`   Primary 연결:    ${statusIcon(results.primary)}`);
  console.log(`   Replica 연결:    ${statusIcon(results.replica)}`);
  console.log(`   복제 상태:       ${statusIcon(results.replication)}`);
  console.log(`   SEMO 스키마:     ${statusIcon(results.semoSchema)}`);

  console.log('\n' + '='.repeat(60));

  if (results.primary && results.replica) {
    log('🎉', 'core-central-db 연결 테스트 완료!', colors.green);
  } else if (results.primary) {
    log('⚠️', 'Primary만 연결됨 (Replica 확인 필요)', colors.yellow);
  } else {
    log('❌', '연결 실패 - 설정을 확인하세요', colors.red);
  }

  console.log('');
}

// 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
  process.exit(1);
});

// 실행
main().catch(console.error);
