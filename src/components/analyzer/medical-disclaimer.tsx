import { Info } from "lucide-react";

export function MedicalDisclaimer() {
  return (
    <div className="flex gap-3 rounded-xl border border-primary/10 bg-secondary/70 p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">For information only.</span>{" "}
        Classifications use only the ranges printed in your report and do not
        replace advice from a qualified healthcare professional.
      </p>
    </div>
  );
}
