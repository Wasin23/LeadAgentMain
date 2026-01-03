import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    scrollRestoration: false,
  },
  typescript: {
    // Ignore TypeScript errors during build (for function prop warnings)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://meridianagent.xyz'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
