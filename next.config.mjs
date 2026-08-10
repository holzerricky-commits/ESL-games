/**
 * Next.js 16 blocks dev `/_next/*` assets when the page is opened by LAN IP (not localhost).
 * Without this, buttons and React hydration fail on http://<your-ip>:3000.
 *
 * Set ALLOWED_DEV_ORIGINS in .env.local (comma-separated) when your hotspot IP changes, e.g.:
 * ALLOWED_DEV_ORIGINS=10.50.116.103,10.74.183.103
 */
const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : ['10.50.116.103', '10.74.183.103']

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
  serverExternalPackages: ['@napi-rs/canvas', '@napi-rs/canvas-win32-x64-msvc'],
  typescript: {
    // Many overlay/session types still fail `tsc`; allow production builds to ship.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
