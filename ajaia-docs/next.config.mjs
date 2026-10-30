/** @type {import('next').NextConfig} */
const nextConfig = {
  // mammoth and libsql use Node APIs, so keep them out of the bundler.
  serverExternalPackages: ["mammoth", "@libsql/client", "bcryptjs"],
};

export default nextConfig;
