/**
 * operator-allowlist-check — auto-merge 워크플로의 결정론적 재검사(2차 방어).
 * stdin 으로 변경 파일 목록(줄바꿈 구분)을 받아 operator-code-task 의 allow/deny 로 검사.
 * 위반 시 exit 1 → 워크플로가 auto-merge 를 막는다. (dispatch 시점 라벨에만 의존하지 않음)
 *
 * 사용: gh pr diff <num> --name-only | npx tsx packages/slack-router/scripts/operator-allowlist-check.ts
 */
import {
  checkPathsAgainstAllowlist,
  DEFAULT_ALLOWLIST,
  DEFAULT_DENYLIST,
} from '../src/operator-code-task.js';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const files = raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const result = checkPathsAgainstAllowlist(files, DEFAULT_ALLOWLIST, DEFAULT_DENYLIST);
  if (!result.ok) {
    console.error(`allowlist violation (auto-merge 차단): ${result.offending.join(', ')}`);
    process.exit(1);
  }
  console.log(`allowlist ok (${files.length} files)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
