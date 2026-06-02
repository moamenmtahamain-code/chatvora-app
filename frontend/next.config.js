/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  swSrc: 'public/sw-source.js',
  sw: '/sw.js',
});

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
        port: '5000',
        pathname: '/uploads/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw-source.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
