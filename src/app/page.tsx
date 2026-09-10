import { Activity, ShieldCheck } from "lucide-react";

import { AnalyzerShell } from "@/components/analyzer/analyzer-shell";
import { getServerConfig } from "@/lib/config";

// Read the upload limit from the runtime environment rather than baking the
// build-time value into a static page.
export const dynamic = "force-dynamic";

export default function HomePage() {
  // Read on the server; only the derived size limit reaches the client.
  const maxUploadMb = Math.round(getServerConfig().maxUploadBytes / (1024 * 1024));

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Lab Report Analyzer</p>
              <p className="text-xs text-muted-foreground">Axo Longevity</p>
            </div>
          </div>

          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="size-3.5" aria-hidden />
            Processed on the server · nothing is stored
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 max-w-2xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Understand a laboratory report in one upload
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Every biomarker is extracted from the PDF, translated into standardized
            English names and units, and classified strictly against the ranges the
            report itself prints.
          </p>
        </div>

        <AnalyzerShell maxUploadMb={maxUploadMb} />
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          Informational tool only. Not a medical device and not medical advice.
        </div>
      </footer>
    </div>
  );
}
