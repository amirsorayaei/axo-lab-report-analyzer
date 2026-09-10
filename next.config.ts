import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships its own worker and sharp ships native binaries; neither
  // must be traced into the bundle.
  serverExternalPackages: ["pdfjs-dist", "sharp"],
};

export default nextConfig;
