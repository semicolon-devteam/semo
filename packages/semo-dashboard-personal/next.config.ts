import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // standalone 은 `node .next/standalone/server.js` 전용. 현재 CLI 는 `next start` 를 사용하므로 제거.
  // 번들형 배포(PR-B.2) 시점에 다시 도입.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
