/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/', destination: '/tangomap.html' }];
  },
};

export default nextConfig;
