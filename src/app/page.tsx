import { Activity, ShieldCheck } from "lucide-react";

import { AnalyzerShell } from "@/components/analyzer/analyzer-shell";
import { getServerConfig } from "@/lib/config";
import { MAX_TOTAL_UPLOAD_BYTES } from "@/lib/upload/formats";

// Read the upload limit from the runtime environment rather than baking the
// build-time value into a static page.
export const dynamic = "force-dynamic";

export default function HomePage() {
  // Read on the server; only the derived size limit reaches the client.
  const maxUploadMb = Math.round(getServerConfig().maxUploadBytes / (1024 * 1024));

  return (
    // `flex-1` rather than a percentage height: the body is a flex column with
    // only a min-height, so `min-h-full` collapses here and lets the footer ride
    // up under short content. Growing to fill the body pins it to the bottom.
    <div className="flex flex-1 flex-col">
      <header className="border-b border-primary/10 bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-accent">
              <Activity className="size-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Lab Report Analyzer</p>
              <p className="text-xs text-muted-foreground">Axo Longevity</p>
            </div>
          </div>

          <p className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            <span className="sm:hidden">Private processing</span>
            <span className="hidden sm:inline">Processed privately · files aren’t stored</span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-7 max-w-2xl space-y-2 sm:mb-8">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Lab intelligence
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your lab report, made clear
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Upload a PDF or images. We’ll organize every biomarker, standardize its
            name and unit, and compare it with the ranges printed by your lab.
          </p>
        </div>

        <AnalyzerShell
          maxUploadMb={maxUploadMb}
          maxTotalMb={Math.round(MAX_TOTAL_UPLOAD_BYTES / (1024 * 1024))}
        />
      </main>

      <footer className="border-t border-primary/10 bg-card/70">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          Axo Longevity · Lab Report Analyzer
        </div>
      </footer>
    </div>
  );
}
