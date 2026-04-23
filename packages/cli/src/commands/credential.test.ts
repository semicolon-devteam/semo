/**
 * credential.test.ts — agent_service_credentials PAT vault 테스트
 *
 * 실행: SEMO_CREDENTIAL_PEPPER=test-pepper-for-unit-test npx ts-node packages/cli/src/commands/credential.test.ts
 *
 * 실제 DB 연결 필요 (semo.agent_service_credentials 테이블 — migration 107 적용 후).
 * 테스트 데이터는 bot_id='__test_cred__', service='__test_service__' 로 격리하며 종료 시 정리.
 * SEMO_CREDENTIAL_PEPPER 미설정 시 TEST_PEPPER fallback 사용.
 */

import { createHmac, randomBytes } from 'crypto';
import { getPool, isDbConnected, closeConnection } from '../database';

const TEST_BOT = '__test_cred__';
const TEST_SERVICE = '__test_service__';
const TEST_PEPPER = process.env['SEMO_CREDENTIAL_PEPPER'] ?? 'test-pepper-for-unit-test-minimum16';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function hashToken(plaintext: string, pepper: string): string {
  return createHmac('sha256', pepper).update(plaintext, 'utf8').digest('hex');
}

function generateToken(botId: string): { plaintext: string; prefix: string; hash: string } {
  const prefix = `semo_pat_live_${botId}_`;
  const random = randomBytes(18).toString('base64url');
  const plaintext = `${prefix}${random}`;
  const hash = hashToken(plaintext, TEST_PEPPER);
  return { plaintext, prefix, hash };
}

async function cleanup(): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `DELETE FROM semo.agent_service_credentials WHERE bot_id = $1 AND service_domain = $2`,
      [TEST_BOT, TEST_SERVICE],
    );
  } catch {
    /* ignore */
  }
}

async function run(): Promise<void> {
  console.log('\n🧪 credential.test.ts\n');

  const connected = await isDbConnected();
  if (!connected) {
    console.log('❌ DB 연결 실패 — 테스트 스킵');
    process.exit(1);
  }

  const pool = getPool();
  await cleanup();

  // ── Case 1: issue → hash 로 조회 성공 ────────────────────────────────────
  console.log('Case 1: issue → hash 로 조회 성공');
  let cred1Id: string;
  {
    const { prefix, hash } = generateToken(TEST_BOT);
    const res = await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [TEST_BOT, TEST_SERVICE, hash, prefix, ['board:write', 'board:read'], 'test'],
    );
    cred1Id = res.rows[0].id;
    const found = await pool.query(
      `SELECT id, bot_id, service_domain, scopes FROM semo.agent_service_credentials WHERE token_hash = $1`,
      [hash],
    );
    assert(found.rows.length === 1, 'hash로 1건 조회');
    assert(found.rows[0].bot_id === TEST_BOT, `bot_id 일치 (${TEST_BOT})`);
    assert(found.rows[0].service_domain === TEST_SERVICE, `service_domain 일치`);
    assert(Array.isArray(found.rows[0].scopes), 'scopes는 배열');
    assert(found.rows[0].scopes.includes('board:write'), 'scopes에 board:write 포함');
  }

  // ── Case 2: revoke 후 상태 확인 ──────────────────────────────────────────
  console.log('Case 2: revoke 후 revoked_at 채워짐');
  {
    await pool.query(
      `UPDATE semo.agent_service_credentials SET revoked_at = NOW(), revoked_reason = '테스트 revoke' WHERE id = $1`,
      [cred1Id],
    );
    const r = await pool.query(
      `SELECT revoked_at, revoked_reason FROM semo.agent_service_credentials WHERE id = $1`,
      [cred1Id],
    );
    assert(r.rows[0].revoked_at !== null, 'revoked_at 채워짐');
    assert(r.rows[0].revoked_reason === '테스트 revoke', 'revoked_reason 저장됨');

    // v_agent_credentials_audit 뷰에서 status = 'revoked'
    const v = await pool.query(`SELECT status FROM semo.v_agent_credentials_audit WHERE id = $1`, [
      cred1Id,
    ]);
    assert(v.rows[0].status === 'revoked', `audit 뷰 status = revoked`);
  }

  // ── Case 3: expired 토큰 감지 ────────────────────────────────────────────
  console.log('Case 3: expires_at 과거 → audit 뷰 status = expired');
  {
    const { prefix, hash } = generateToken(TEST_BOT);
    // chk_expires_after_issued 제약 (expires_at > issued_at) 때문에 issued_at 도 함께 과거로 세팅
    const res = await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes, issued_at, expires_at, issued_by)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $6)
       RETURNING id`,
      [TEST_BOT, TEST_SERVICE, hash, prefix, ['kpi:read'], 'test'],
    );
    const expiredId = res.rows[0].id;
    const v = await pool.query(`SELECT status FROM semo.v_agent_credentials_audit WHERE id = $1`, [
      expiredId,
    ]);
    assert(v.rows[0].status === 'expired', `audit 뷰 status = expired`);
  }

  // ── Case 4: scope 배열 저장/조회 ────────────────────────────────────────
  console.log('Case 4: scope 배열 저장 및 조회');
  {
    const scopes = ['board:write', 'kpi:read', 'user:*'];
    const { prefix, hash } = generateToken(TEST_BOT);
    const res = await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING scopes`,
      [TEST_BOT, TEST_SERVICE, hash, prefix, scopes, 'test'],
    );
    const saved = res.rows[0].scopes;
    assert(saved.length === 3, `scopes 3개 저장 (got ${saved.length})`);
    assert(saved.includes('board:write'), 'board:write 포함');
    assert(saved.includes('user:*'), 'user:* 와일드카드 포함');
  }

  // ── Case 5: rotate — 기존 revoke + 새 토큰 + metadata.rotated_from ───────
  console.log('Case 5: rotate — 기존 revoke + 새 토큰 + metadata.rotated_from');
  {
    const { prefix: p1, hash: h1 } = generateToken(TEST_BOT);
    const ins = await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, bot_id, service_domain, scopes, expires_at, issued_by, metadata`,
      [TEST_BOT, TEST_SERVICE, h1, p1, ['board:write'], 'test'],
    );
    const oldRow = ins.rows[0];
    const oldId = oldRow.id;

    // rotate: old revoke
    await pool.query(
      `UPDATE semo.agent_service_credentials SET revoked_at = NOW(), revoked_reason = 'rotated' WHERE id = $1`,
      [oldId],
    );

    // rotate: new insert
    const { prefix: p2, hash: h2 } = generateToken(TEST_BOT);
    const newIns = await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes,
          expires_at, issued_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, metadata`,
      [
        oldRow.bot_id,
        oldRow.service_domain,
        h2,
        p2,
        oldRow.scopes,
        oldRow.expires_at,
        oldRow.issued_by,
        JSON.stringify({ rotated_from: oldId }),
      ],
    );
    const newRow = newIns.rows[0];

    assert(newRow.id !== oldId, '새 ID 생성됨');
    assert(newRow.metadata.rotated_from === oldId, `metadata.rotated_from = ${oldId}`);

    // 기존 건 revoked 확인
    const oldCheck = await pool.query(
      `SELECT revoked_at FROM semo.agent_service_credentials WHERE id = $1`,
      [oldId],
    );
    assert(oldCheck.rows[0].revoked_at !== null, '기존 토큰 revoked_at 채워짐');
  }

  // ── Case 6: 중복 hash UNIQUE 제약 거부 ──────────────────────────────────
  console.log('Case 6: 중복 token_hash UNIQUE 제약 거부');
  {
    const { prefix, hash } = generateToken(TEST_BOT);
    await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [TEST_BOT, TEST_SERVICE, hash, prefix, ['board:read'], 'test'],
    );
    let threw = false;
    try {
      await pool.query(
        `INSERT INTO semo.agent_service_credentials
           (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_BOT, TEST_SERVICE, hash, prefix, ['board:write'], 'test'],
      );
    } catch {
      threw = true;
    }
    assert(threw, 'UNIQUE 중복 INSERT 시 에러 발생');
  }

  // ── Case 7: last_used_at 업데이트 (동시성 race 없음 — 단순 UPDATE) ───────
  console.log('Case 7: last_used_at 업데이트');
  {
    const { prefix, hash } = generateToken(TEST_BOT);
    const ins = await pool.query(
      `INSERT INTO semo.agent_service_credentials
         (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [TEST_BOT, TEST_SERVICE, hash, prefix, ['board:read'], 'test'],
    );
    const id = ins.rows[0].id;
    const before = await pool.query(
      `SELECT last_used_at FROM semo.agent_service_credentials WHERE id = $1`,
      [id],
    );
    assert(before.rows[0].last_used_at === null, 'last_used_at 초기값 NULL');

    await pool.query(
      `UPDATE semo.agent_service_credentials SET last_used_at = NOW() WHERE id = $1`,
      [id],
    );
    const after = await pool.query(
      `SELECT last_used_at FROM semo.agent_service_credentials WHERE id = $1`,
      [id],
    );
    assert(after.rows[0].last_used_at !== null, 'last_used_at 갱신됨');
  }

  // ── Case 8: chk_token_hash_format CHECK 위반 거부 ────────────────────────
  console.log('Case 8: chk_token_hash_format CHECK 위반 거부 (64자 hex 아님)');
  {
    const badHash = 'not-a-valid-hash';
    const { prefix } = generateToken(TEST_BOT);
    let threw = false;
    try {
      await pool.query(
        `INSERT INTO semo.agent_service_credentials
           (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [TEST_BOT, TEST_SERVICE, badHash, prefix, ['board:read'], 'test'],
      );
    } catch {
      threw = true;
    }
    assert(threw, 'chk_token_hash_format 위반 시 에러 발생');
  }

  // ── Case 9: chk_revoke_consistency CHECK 위반 거부 ───────────────────────
  console.log('Case 9: chk_revoke_consistency CHECK 위반 거부 (revoked_at 없이 reason만)');
  {
    const { prefix, hash } = generateToken(TEST_BOT);
    let threw = false;
    try {
      await pool.query(
        `INSERT INTO semo.agent_service_credentials
           (bot_id, service_domain, token_hash, token_prefix, scopes, issued_by, revoked_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [TEST_BOT, TEST_SERVICE, hash, prefix, ['board:read'], 'test', 'reason without revoked_at'],
      );
    } catch {
      threw = true;
    }
    assert(threw, 'chk_revoke_consistency 위반 시 에러 발생');
  }

  // ── 정리 ──────────────────────────────────────────────────────────────────
  await cleanup();

  // ── 결과 ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`총 ${passed + failed}개 테스트: ✅ ${passed} passed, ❌ ${failed} failed\n`);

  await closeConnection();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error('테스트 런타임 에러:', err);
  await cleanup();
  await closeConnection();
  process.exit(1);
});
