import { Info } from "lucide-react";

export function MedicalDisclaimer() {
  return (
    <div className="flex gap-2.5 rounded-lg border bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p>
        <span className="font-medium text-foreground">
          Informational only — not medical advice.
        </span>{" "}
        Results are compared solely against the ranges printed on the uploaded
        report. No thresholds or interpretations are added. Discuss your results
        with a qualified healthcare professional.
      </p>
    </div>
  );
}
