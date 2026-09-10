import { Info } from "lucide-react";

export function MedicalDisclaimer() {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">
          This tool is informational and is not medical advice.
        </span>{" "}
        Results are classified only against the ranges printed on the uploaded
        report. No thresholds, targets or interpretations are added by this
        application. Always discuss your results with a qualified healthcare
        professional.
      </p>
    </div>
  );
}
