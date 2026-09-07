import type { NextConfig } from "next";

// Proxy /api/* to the Frappe bench in development so the session cookie and
// CSRF token stay same-origin (see blueprint §5.4). The bench's
// `serve_default_site` is on, so any Host header routes to estierp.local.
const FRAPPE_BACKEND_URL =
  process.env.NEXT_PUBLIC_FRAPPE_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${FRAPPE_BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
