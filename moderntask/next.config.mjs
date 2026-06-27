/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/landing.html' },
      ],
    }
  },
  async redirects() {
    return [
      // Dashboard reorg: old top-level pages collapsed into Home/Prospecting/Leads/Outreach.
      // Dynamic sub-routes (/agents/[id], /agents/[id]/settings) are untouched — only the exact
      // index paths below redirect. /chat-lab is intentionally NOT redirected (kept alive as a
      // deep-link target for full chat-session detail).
      { source: '/dashboard',   destination: '/home', permanent: false },
      { source: '/operations',  destination: '/prospecting?section=monitor', permanent: false },
      { source: '/agents',      destination: '/prospecting?section=setup&tab=agents', permanent: false },
      { source: '/email-queue', destination: '/outreach?section=awaiting', permanent: false },
      { source: '/crm',         destination: '/leads?tab=crm', permanent: false },
      { source: '/analytics',   destination: '/home', permanent: false },
    ]
  },
}

export default nextConfig
