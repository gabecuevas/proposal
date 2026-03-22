/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/db", "@repo/shared", "@repo/ui"],
};

export default nextConfig;
