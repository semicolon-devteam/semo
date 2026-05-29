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
    ];
  },
};

export default nextConfig;
