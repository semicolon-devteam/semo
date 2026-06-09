// E4 컨시어지 이미지 요청 큐 백본 PoC (외부계정 불요) — 스키마 적용 + 접수→대기열→완료 흐름 라이브 검증.
// 흐름: 고객 이미지 요청 접수(pending) → 우리팀 대기열 조회 → in_progress → delivered(result_ref) → cleanup.
import pg from 'pg';
import { readFileSync } from 'node:fs';
const { Pool } = pg;
const TENANT = '00000000-0000-4000-8000-0000000a0b0c';
const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 8000,
});
const out = { steps: {} };
try {
  // 1) 스키마 적용(멱등)
  await p.query('BEGIN');
  await p.query(
    readFileSync(
      '/Users/reus/semo-repo/packages/cli/migrations/131_concierge_requests.sql',
      'utf8',
    ),
  );
  await p.query('COMMIT');
  out.steps['1_schema'] = 'applied (idempotent)';

  await p.query('DELETE FROM semo.concierge_requests WHERE tenant_id=$1', [TENANT]);

  // 2) 접수 (고객/에이전트가 이미지 생성 요청)
  const ins = await p.query(
    `INSERT INTO semo.concierge_requests(tenant_id,kind,payload,requested_by,status)
     VALUES($1,'image',$2::jsonb,'jumuni-agent','pending') RETURNING id`,
    [
      TENANT,
      JSON.stringify({
        product: '925 실버 미니멀 반지',
        style: '미니멀·따뜻',
        use: '기념일 포스터',
        ratio: '1080x1350',
      }),
    ],
  );
  const id = ins.rows[0].id;
  out.steps['2_intake'] = { id, status: 'pending' };

  // 3) 우리 팀 대기열 조회 (슬랙 알림 대상)
  const queue = (
    await p.query(
      "SELECT id, payload->>'product' product, payload->>'use' use FROM semo.v_concierge_queue WHERE tenant_id=$1",
      [TENANT],
    )
  ).rows;
  out.steps['3_team_queue'] = queue;
  // (슬랙 알림은 토큰/채널 필요 → 여기선 notified_at 만 기록; 실제 포스팅은 운영 배선)
  await p.query('UPDATE semo.concierge_requests SET notified_at=NOW() WHERE id=$1', [id]);

  // 4) 처리 → 완료(산출물 참조)
  await p.query(
    "UPDATE semo.concierge_requests SET status='in_progress', assignee='design-team' WHERE id=$1",
    [id],
  );
  await p.query(
    "UPDATE semo.concierge_requests SET status='delivered', delivered_at=NOW(), result_ref=$2::jsonb WHERE id=$1",
    [id, JSON.stringify({ kind: 'central-object', path: 'tenant/ /assets/poster-001.png' })],
  );
  const fin = (
    await p.query('SELECT status, result_ref FROM semo.concierge_requests WHERE id=$1', [id])
  ).rows[0];
  out.steps['4_delivered'] = fin;

  // 5) cleanup
  out.steps['5_cleanup'] = (
    await p.query('DELETE FROM semo.concierge_requests WHERE tenant_id=$1', [TENANT])
  ).rowCount;
  console.log(JSON.stringify(out, null, 2));
} finally {
  await p.end();
}
