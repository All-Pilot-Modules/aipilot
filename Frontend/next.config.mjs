import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,

  // ========== IMAGE OPTIMIZATION ==========
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hlzerlvbkeitwbmvrtfu.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'www.brockport.edu',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
    // Enable modern image formats (WebP, AVIF)
    formats: ['image/avif', 'image/webp'],
    // Optimize images more aggressively
    minimumCacheTTL: 31536000, // Cache images for 1 year (31536000 seconds)
    // Lazy load images by default
    unoptimized: false,
    // Image quality (lower = faster, smaller files)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ========== WEBPACK OPTIMIZATIONS ==========
  webpack: (config, { dev, isServer }) => {
    config.resolve.extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    return config;
  },

  // ========== EXPERIMENTAL FEATURES ==========
  experimental: {
    optimizeCss: true, // Optimize CSS with Critters
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@tabler/icons-react',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
    serverExternalPackages: ['exceljs', 'pg'],
  },

  // ========== COMPILER OPTIMIZATIONS ==========
  compiler: {
    // Remove console logs in production (except errors and warnings)
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // ========== HEADERS FOR CACHING ==========
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // ========== PRODUCTION SOURCE MAPS ==========
  productionBrowserSourceMaps: false, // Disable for faster builds and smaller bundles
};

export default withBundleAnalyzer(nextConfig);
