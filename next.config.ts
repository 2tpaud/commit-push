import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@tiptap/core',
    '@tiptap/pm',
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/markdown',
  ],
};

export default nextConfig;
