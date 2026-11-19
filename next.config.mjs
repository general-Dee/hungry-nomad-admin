/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  images: {
    // Serve every next/image straight from its source (Supabase storage etc.).
    // Vercel's image optimizer returns 402 on this hobby team once its quota is
    // used, which blanks product photos on any cache miss. Keep this true.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'didjqzebvouurvpdjofb.supabase.co',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
