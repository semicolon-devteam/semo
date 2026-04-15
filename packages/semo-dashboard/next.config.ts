import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
