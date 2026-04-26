/** @type {import('next').NextConfig} */
const allowedDevOriginsFromEnv = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow testing from other devices while running `next dev`.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "26.212.90.137",
    "10.202.21.173",
    ...allowedDevOriginsFromEnv,
  ],
}

export default nextConfig
