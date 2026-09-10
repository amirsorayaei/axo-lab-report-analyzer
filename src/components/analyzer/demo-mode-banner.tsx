import { FlaskConical } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Shown whenever the mock provider produced the results. It must be impossible
 * to mistake fixture output for an analysis of the uploaded document.
 */
export function DemoModeBanner({ providerLabel }: { providerLabel: string }) {
  return (
    <Alert className="border-status-review/30 bg-status-review-surface text-status-review">
      <FlaskConical aria-hidden />
      <AlertTitle>Demo mode — these results are not from your file</AlertTitle>
      <AlertDescription className="text-status-review/90">
        <p>
          The server is running with <code className="font-mono">AI_PROVIDER=mock</code>,
          so the uploaded PDF was validated and its text was extracted, but the
          biomarkers below come from the bundled sample report.
        </p>
        <p className="text-xs opacity-80">Provider: {providerLabel}</p>
      </AlertDescription>
    </Alert>
  );
}
