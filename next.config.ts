import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships its own worker and sharp ships native binaries; neither
  // must be traced into the bundle.
  serverExternalPackages: ["pdfjs-dist", "sharp"],
  // pdfjs reaches its worker through a dynamic import that file tracing cannot
  // see, so `pdf.worker.mjs` is left out of the serverless bundle and every
  // parse fails with "Setting up fake worker failed". Name it explicitly.
  outputFileTracingIncludes: {
    "/api/analyze": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
