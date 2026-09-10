import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships its own worker and must not be traced into the bundle.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
