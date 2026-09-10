import { FlaskConical } from "lucide-react";

/**
 * Shown whenever the mock provider produced the results. It must be impossible
 * to mistake fixture output for an analysis of the uploaded document, but it
 * should not outweigh the results themselves — so it is a single compact line
 * rather than a full alert block.
 */
export function DemoModeNotice({ providerLabel }: { providerLabel: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-status-review/30 bg-status-review-surface px-3 py-2.5 text-sm text-status-review">
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="block">
          <span className="font-medium">Demo mode.</span> These biomarkers come
          from the bundled sample report, not from your files.
        </span>
        <span className="mt-0.5 block text-xs text-status-review/80">
          {providerLabel}
        </span>
      </span>
    </div>
  );
}
