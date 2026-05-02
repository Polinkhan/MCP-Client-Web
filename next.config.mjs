/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["monaco-editor", "@monaco-editor/react"],
  experimental: {
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@modelcontextprotocol/sdk",
    ],
  },
};

export default nextConfig;
