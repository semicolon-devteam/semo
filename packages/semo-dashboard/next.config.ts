import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },
  // 2026-05-29 구조 개편: 고객 대시보드 /my → /dashboard 로 이전. 옛 북마크/링크 호환.
  async redirects() {
    return [
      { source: '/my', destination: '/dashboard', permanent: true },
      { source: '/my/:path*', destination: '/dashboard/:path*', permanent: true },
      // 2026-05-29 디자인 이식: 온톨로지는 지식(KB) 화면의 탭으로 병합.
      { source: '/ontology', destination: '/kb?tab=ontology', permanent: true },
    ];
  },
};

export default nextConfig;
