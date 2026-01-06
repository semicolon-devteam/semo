/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['pixi.js', '@pixi/react'],
};

module.exports = nextConfig;
