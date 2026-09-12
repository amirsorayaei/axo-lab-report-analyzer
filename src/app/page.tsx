import { Activity, ShieldCheck } from "lucide-react";

import { AnalyzerShell } from "@/components/analyzer/analyzer-shell";
import { getServerConfig } from "@/lib/config";
import { MAX_TOTAL_UPLOAD_BYTES } from "@/lib/upload/formats";

// Reads the upload limit at runtime rather than baking it into a static page.
export const dynamic = "force-dynamic";

export default function HomePage() {
  // Only the derived size limit reaches the client.
  const maxUploadMb = Math.round(getServerConfig().maxUploadBytes / (1024 * 1024));

  return (
    // `flex-1`, not a percentage height: the body only has a min-height, so
    // `min-h-full` collapses and lets the footer ride up under short content.
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4" aria-hidden />
              {/* The one place the lime accent appears in the chrome. */}
              <span
                aria-hidden
                className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-brand-accent ring-2 ring-card"
              />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Lab Report Analyzer</span>
              <span className="block text-xs text-muted-foreground">Axo Longevity</span>
            </span>
          </div>

          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="size-3.5" aria-hidden />
            Processed on the server · nothing is stored
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <AnalyzerShell
          maxUploadMb={maxUploadMb}
          maxTotalMb={Math.round(MAX_TOTAL_UPLOAD_BYTES / (1024 * 1024))}
        />
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          Informational tool only. Not a medical device and not medical advice.
        </div>
      </footer>
    </div>
  );
}
