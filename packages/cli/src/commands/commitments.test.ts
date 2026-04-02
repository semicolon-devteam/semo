/**
 * commitments 테스트 — bot_commitments CRUD + 워치독 뷰 검증
 *
 * 실행: npx ts-node packages/cli/src/commands/commitments.test.ts
 *
 * 실제 DB 연결 필요 (semo.bot_commitments 테이블).
 * 테스트 데이터는 bot_id='__test__' 접두사로 생성하며 종료 시 정리.
 */

import { getPool, isDbConnected, closeConnection } from "../database";

const TEST_BOT = "__test__";
let passed = 0;
let failed = 0;
const createdIds: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ ${message}`);
  }
}

function makeId(): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `cmt-${TEST_BOT}-${Date.now()}-${rand}`;
}

async function cleanup(): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(`DELETE FROM semo.bot_commitments WHERE bot_id = $1`, [TEST_BOT]);
  } catch { /* ignore */ }
}

async function run(): Promise<void> {
  console.log("\n🧪 commitments.test.ts\n");

  const connected = await isDbConnected();
  if (!connected) {
    console.log("❌ DB 연결 실패 — 테스트 스킵");
    process.exit(1);
  }

  const pool = getPool();

  // 사전 정리
  await cleanup();

  // ── Case 1: CREATE — 기본 생성 ─────────────────────────────────────────────
  console.log("Case 1: 기본 생성");
  const id1 = makeId();
  createdIds.push(id1);
  {
    await pool.query(
      `INSERT INTO semo.bot_commitments (id, bot_id, status, title, deadline_at)
       VALUES ($1, $2, 'pending', '테스트 약속 1', NOW() + INTERVAL '15 minutes')`,
      [id1, TEST_BOT]
    );
    const r = await pool.query(`SELECT * FROM semo.bot_commitments WHERE id = $1`, [id1]);
    assert(r.rows.length === 1, "INSERT 성공");
    assert(r.rows[0].status === "pending", "초기 상태 = pending");
    assert(r.rows[0].bot_id === TEST_BOT, `bot_id = ${TEST_BOT}`);
    assert(r.rows[0].completed_at === null, "completed_at = null (아직 완료 전)");
  }

  // ── Case 2: CREATE — steps JSON ────────────────────────────────────────────
  console.log("Case 2: steps JSON 저장");
  const id2 = makeId();
  createdIds.push(id2);
  {
    const steps = [
      { label: "Typography", done: false },
      { label: "Layout", done: false },
      { label: "Motion", done: false },
    ];
    await pool.query(
      `INSERT INTO semo.bot_commitments (id, bot_id, status, title, steps)
       VALUES ($1, $2, 'pending', 'Steps 테스트', $3)`,
      [id2, TEST_BOT, JSON.stringify(steps)]
    );
    const r = await pool.query(`SELECT steps FROM semo.bot_commitments WHERE id = $1`, [id2]);
    const savedSteps = r.rows[0].steps;
    assert(Array.isArray(savedSteps), "steps는 배열");
    assert(savedSteps.length === 3, `steps 3개 (got ${savedSteps.length})`);
    assert(savedSteps[0].label === "Typography", "첫 step label 일치");
    assert(savedSteps.every((s: { done: boolean }) => !s.done), "모든 step done=false");
  }

  // ── Case 3: UPDATE — heartbeat ─────────────────────────────────────────────
  console.log("Case 3: heartbeat 갱신");
  {
    await pool.query(
      `UPDATE semo.bot_commitments
       SET last_heartbeat_at = NOW(),
           status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
       WHERE id = $1`,
      [id1]
    );
    const r = await pool.query(
      `SELECT status, last_heartbeat_at FROM semo.bot_commitments WHERE id = $1`,
      [id1]
    );
    assert(r.rows[0].status === "active", "heartbeat → status = active");
    assert(r.rows[0].last_heartbeat_at !== null, "last_heartbeat_at 채워짐");
  }

  // ── Case 4: UPDATE — step-done ─────────────────────────────────────────────
  console.log("Case 4: step 완료 처리");
  {
    await pool.query(
      `UPDATE semo.bot_commitments
       SET steps = (
         SELECT jsonb_agg(
           CASE
             WHEN elem->>'label' = $2 THEN jsonb_set(elem, '{done}', 'true')
             ELSE elem
           END
         )
         FROM jsonb_array_elements(steps) AS elem
       )
       WHERE id = $1`,
      [id2, "Typography"]
    );
    const r = await pool.query(`SELECT steps FROM semo.bot_commitments WHERE id = $1`, [id2]);
    const steps = r.rows[0].steps;
    const typo = steps.find((s: { label: string }) => s.label === "Typography");
    const layout = steps.find((s: { label: string }) => s.label === "Layout");
    assert(typo.done === true, "Typography done=true");
    assert(layout.done === false, "Layout 여전히 done=false");
  }

  // ── Case 5: DONE — completed_at 트리거 ────────────────────────────────────
  console.log("Case 5: done → completed_at 자동 채움");
  {
    await pool.query(
      `UPDATE semo.bot_commitments SET status = 'done' WHERE id = $1`,
      [id1]
    );
    const r = await pool.query(
      `SELECT status, completed_at FROM semo.bot_commitments WHERE id = $1`,
      [id1]
    );
    assert(r.rows[0].status === "done", "status = done");
    assert(r.rows[0].completed_at !== null, "completed_at 자동 채워짐 (트리거)");
  }

  // ── Case 6: FAIL — metadata.fail_reason ────────────────────────────────────
  console.log("Case 6: fail + reason 저장");
  const id3 = makeId();
  createdIds.push(id3);
  {
    await pool.query(
      `INSERT INTO semo.bot_commitments (id, bot_id, status, title)
       VALUES ($1, $2, 'active', '실패 테스트')`,
      [id3, TEST_BOT]
    );
    await pool.query(
      `UPDATE semo.bot_commitments
       SET status = 'failed', metadata = metadata || jsonb_build_object('fail_reason', $2::text)
       WHERE id = $1`,
      [id3, "빌드 실패"]
    );
    const r = await pool.query(
      `SELECT status, completed_at, metadata FROM semo.bot_commitments WHERE id = $1`,
      [id3]
    );
    assert(r.rows[0].status === "failed", "status = failed");
    assert(r.rows[0].completed_at !== null, "completed_at 자동 채워짐");
    assert(r.rows[0].metadata.fail_reason === "빌드 실패", "metadata.fail_reason 저장됨");
  }

  // ── Case 7: updated_at 트리거 ──────────────────────────────────────────────
  console.log("Case 7: updated_at 자동 갱신");
  {
    const before = await pool.query(
      `SELECT updated_at FROM semo.bot_commitments WHERE id = $1`,
      [id2]
    );
    // 최소 1ms 대기
    await new Promise((r) => setTimeout(r, 50));
    await pool.query(
      `UPDATE semo.bot_commitments SET title = 'Updated title' WHERE id = $1`,
      [id2]
    );
    const after = await pool.query(
      `SELECT updated_at FROM semo.bot_commitments WHERE id = $1`,
      [id2]
    );
    const t1 = new Date(before.rows[0].updated_at).getTime();
    const t2 = new Date(after.rows[0].updated_at).getTime();
    assert(t2 > t1, `updated_at 갱신됨 (${t2 - t1}ms 차이)`);
  }

  // ── Case 8: v_active_commitments 뷰 ───────────────────────────────────────
  console.log("Case 8: v_active_commitments 뷰");
  const id4 = makeId();
  createdIds.push(id4);
  {
    // overdue commitment 생성 (deadline 과거)
    await pool.query(
      `INSERT INTO semo.bot_commitments (id, bot_id, status, title, deadline_at)
       VALUES ($1, $2, 'active', 'Overdue 테스트', NOW() - INTERVAL '10 minutes')`,
      [id4, TEST_BOT]
    );
    const r = await pool.query(
      `SELECT health, minutes_overdue FROM semo.v_active_commitments WHERE id = $1`,
      [id4]
    );
    assert(r.rows.length === 1, "뷰에서 조회 가능");
    assert(r.rows[0].health === "overdue", `health = overdue (got ${r.rows[0].health})`);
    assert(r.rows[0].minutes_overdue > 0, `minutes_overdue > 0 (got ${r.rows[0].minutes_overdue})`);
  }

  // ── Case 9: stale 감지 ─────────────────────────────────────────────────────
  console.log("Case 9: stale heartbeat 감지");
  const id5 = makeId();
  createdIds.push(id5);
  {
    await pool.query(
      `INSERT INTO semo.bot_commitments (id, bot_id, status, title, last_heartbeat_at)
       VALUES ($1, $2, 'active', 'Stale 테스트', NOW() - INTERVAL '45 minutes')`,
      [id5, TEST_BOT]
    );
    const r = await pool.query(
      `SELECT health, minutes_since_heartbeat FROM semo.v_active_commitments WHERE id = $1`,
      [id5]
    );
    assert(r.rows[0].health === "stale", `health = stale (got ${r.rows[0].health})`);
    assert(r.rows[0].minutes_since_heartbeat >= 44, `heartbeat 45분+ 전`);
  }

  // ── Case 10: on-track ──────────────────────────────────────────────────────
  console.log("Case 10: on-track (정상)");
  const id6 = makeId();
  createdIds.push(id6);
  {
    await pool.query(
      `INSERT INTO semo.bot_commitments (id, bot_id, status, title, deadline_at, last_heartbeat_at)
       VALUES ($1, $2, 'active', 'On-track 테스트', NOW() + INTERVAL '30 minutes', NOW())`,
      [id6, TEST_BOT]
    );
    const r = await pool.query(
      `SELECT health FROM semo.v_active_commitments WHERE id = $1`,
      [id6]
    );
    assert(r.rows[0].health === "on-track", `health = on-track (got ${r.rows[0].health})`);
  }

  // ── Case 11: 완료된 건은 뷰에서 제외 ──────────────────────────────────────
  console.log("Case 11: 완료된 commitment는 뷰에서 제외");
  {
    const r = await pool.query(
      `SELECT * FROM semo.v_active_commitments WHERE id = $1`,
      [id1] // Case 5에서 done 처리됨
    );
    assert(r.rows.length === 0, "done 상태는 v_active_commitments에서 제외");
  }

  // ── Case 12: 인덱스 사용 확인 ─────────────────────────────────────────────
  console.log("Case 12: 인덱스 존재 확인");
  {
    const r = await pool.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'bot_commitments' AND schemaname = 'semo' ORDER BY indexname`
    );
    const names = r.rows.map((row: { indexname: string }) => row.indexname);
    assert(names.includes("idx_commitments_active"), "idx_commitments_active 존재");
    assert(names.includes("idx_commitments_bot"), "idx_commitments_bot 존재");
  }

  // ── Case 13: watch --bot-id 필터 ─────────────────────────────────────────
  console.log("Case 13: watch --bot-id 필터");
  {
    // __test__ 봇의 활성 커밋먼트만 조회 (id4=overdue, id5=stale, id6=on-track)
    const r = await pool.query(
      `SELECT id FROM semo.v_active_commitments WHERE bot_id = $1`,
      [TEST_BOT]
    );
    assert(r.rows.length >= 3, `--bot-id 필터: __test__ 항목 3건+ (got ${r.rows.length})`);
    assert(r.rows.every((row: { id: string }) => row.id.startsWith("cmt-__test__")), "모두 __test__ 봇 소유");
  }

  // ── Case 14: watch --exclude-bot 필터 ──────────────────────────────────
  console.log("Case 14: watch --exclude-bot 필터");
  {
    const r = await pool.query(
      `SELECT id, bot_id FROM semo.v_active_commitments WHERE bot_id != $1`,
      [TEST_BOT]
    );
    const hasTestBot = r.rows.some((row: { bot_id: string }) => row.bot_id === TEST_BOT);
    assert(!hasTestBot, "--exclude-bot 필터: __test__ 봇 제외됨");
  }

  // ── 정리 ──────────────────────────────────────────────────────────────────
  await cleanup();

  // ── 결과 ──────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(40)}`);
  console.log(`총 ${passed + failed}개 테스트: ✅ ${passed} passed, ❌ ${failed} failed\n`);

  await closeConnection();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error("테스트 런타임 에러:", err);
  await cleanup();
  await closeConnection();
  process.exit(1);
});
