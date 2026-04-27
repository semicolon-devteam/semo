#!/usr/bin/env node
/**
 * semo-cli bundler — workspace 의존성을 단일 파일로 인라인.
 *
 * 배경: optionalDependencies 로 선언된 @team-semicolon/semo-* 5개 패키지는 npm 미공개
 * 상태이므로 OSS 사용자 환경에서 dynamic import 가 실패한다 (factory parse / templates
 * list / exec / chat 등 차단). esbuild 번들로 인라인하면 추가 publish 없이 즉시 동작.
 *
 * 사용법:
 *   npm run bundle      # tsc + esbuild + templates 복사 → dist/bundle.js
 *
 * publish 시 main/bin 을 dist/bundle.js 로 전환하면 OSS 1차 배포 가능.
 *
 * External:
 *   - better-sqlite3 / pg / pg-native : 네이티브 바인딩, 번들 불가
 *
 * 출력: dist/bundle.js (CJS, node18 타깃, +x)
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src', 'index.ts');
const outfile = path.join(root, 'dist', 'bundle.js');

// Node 20 unhandled rejection 이 deprecation warning 만 내고 exit 0 으로 빠지는 케이스 차단
// (workflow 가 dist/bundle.js 없는 상태로 publish 하던 v4.18.20 회귀 방지).
process.on('unhandledRejection', (err) => {
  console.error('[bundle] unhandled rejection:', err);
  process.exit(1);
});

try {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['better-sqlite3', 'pg', 'pg-native'],
    // banner shebang 미사용 — src/index.ts 첫 줄에 이미 #!/usr/bin/env node 가 있어
    // banner 추가 시 shebang 2개로 SyntaxError. (Codex 리뷰 2026-04-27)
    minify: true,
    legalComments: 'none',
    logLevel: 'info',
  });
} catch (err) {
  console.error('[bundle] esbuild failed:', err);
  process.exit(1);
}

fs.chmodSync(outfile, 0o755);
console.log(`✓ bundled → ${outfile}`);
