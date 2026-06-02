#!/usr/bin/env node
// DEPRECATED 경로 안내 — SoT 가 repo 파일 → DB(semo.agent_personas)로 승격됨 (2026-06-02).
//
// 행동 정의 SoT 는 이제 DB 다. 프로토타입 hermes SOUL.md 반영은:
//     semo persona sync            (전역 CLI, 배포 후)
//   또는 npx tsx packages/cli/src/index.ts persona sync   (로컬 소스)
//
// repo personas/*.SOUL.md 는 seed/bootstrap 용도로만 남는다:
//     semo persona set <slug> --file packages/slack-router/personas/<slug>.SOUL.md --by <who>
//
// 설계: docs/superpowers/specs/2026-06-02-agent-behavior-sot-and-propagation-design.md
console.error(
  [
    '[sync-personas] DEPRECATED — SoT 가 DB(semo.agent_personas)로 이동했습니다.',
    '  프로토타입 반영:  semo persona sync   (또는 npx tsx packages/cli/src/index.ts persona sync)',
    '  seed:            semo persona set <slug> --file packages/slack-router/personas/<slug>.SOUL.md --by <who>',
  ].join('\n'),
);
process.exit(1);
