const DEFAULT_BACKEND_URL = 'http://localhost:3008';

const backendUrl = (
  process.env.BEADS_WEB_BACKEND_URL
  || process.env.BACKEND_URL
  || process.env.NEXT_PUBLIC_BACKEND_URL
  || DEFAULT_BACKEND_URL
).replace(/\/$/, '');

const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

if (isProduction) {
  // The packaged app serves the exported frontend and Rust API from the same
  // origin, so no Next rewrite is needed in the production static bundle.
  nextConfig.output = 'export';
} else {
  // Next dev proxies same-origin browser API calls to the Rust backend. This
  // avoids CORS and separate forwarded-domain auth in remote dev environments.
  nextConfig.rewrites = async () => [
    {
      source: '/api/:path*',
      destination: `${backendUrl}/api/:path*`,
    },
  ];
}

module.exports = nextConfig;
