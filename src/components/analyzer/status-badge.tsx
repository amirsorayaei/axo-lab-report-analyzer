import { Badge } from "@/components/ui/badge";
import { STATUS_PRESENTATION } from "@/lib/status-presentation";
import { cn } from "@/lib/utils";
import type { BiomarkerStatus } from "@/lib/domain/schemas";

/** Icon shape and label carry the status, so it never depends on colour. */
export function StatusBadge({
  status,
  className,
}: {
  status: BiomarkerStatus;
  className?: string;
}) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;

  return (
    <Badge
      variant="outline"
      className={cn("h-6 gap-1.5 px-2 font-medium", presentation.badgeClass, className)}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {presentation.label}
    </Badge>
  );
}
