/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@abhinav2203/codeflow-core',
    '@abhinav2203/coderag',
    '@abhinav2203/codeflow-mcp',
    '@abhinav2203/codeflow-store',
    '@abhinav2203/codeflow-versioning',
    '@abhinav2203/codeflow-prd',
    '@abhinav2203/codeflow-analysis',
    '@abhinav2203/codeflow-agent',
    '@abhinav2203/codeflow-execution',
    '@abhinav2203/codeflow-canvas',
    '@abhinav2203/codeflow-dtwin',
    '@abhinav2203/codeflow-evolution',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;