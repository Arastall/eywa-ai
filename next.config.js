/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/eywa',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
module.exports = nextConfig;
