/** @type {import('next').NextConfig} */

// When building for GitHub Pages, set NEXT_PUBLIC_BASE_PATH=/option-sketch
// so all asset paths and routes are prefixed correctly.
// Leave unset (empty string) for local development.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,

  // Static export — produces a self-contained `out/` folder with no server needed.
  output: "export",

  // Prefix all routes and assets with the repo sub-path on GitHub Pages.
  basePath,
  assetPrefix: basePath,

  // GitHub Pages serves directory index files only when the URL has a trailing slash.
  trailingSlash: true,
};

export default nextConfig;
