import { Badge } from "@/components/ui/badge";
import { STATUS_PRESENTATION } from "@/lib/status-presentation";
import { cn } from "@/lib/utils";
import type { BiomarkerStatus } from "@/lib/domain/schemas";

export function StatusBadge({
  status,
  className,
}: {
  status: BiomarkerStatus;
  className?: string;
}) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", presentation.badgeClass, className)}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", presentation.dotClass)}
      />
      {presentation.label}
    </Badge>
  );
}
