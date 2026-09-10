import { STATUS_PRESENTATION } from "@/lib/status-presentation";
import { cn } from "@/lib/utils";
import type { AnalysisSummary, BiomarkerStatus } from "@/lib/domain/schemas";

type Card = {
  key: string;
  label: string;
  value: number;
  status?: BiomarkerStatus;
  description: string;
};

export function SummaryCards({ summary }: { summary: AnalysisSummary }) {
  const cards: Card[] = [
    {
      key: "total",
      label: "Biomarkers found",
      value: summary.total,
      description: "Results extracted from the report.",
    },
    {
      key: "optimal",
      label: STATUS_PRESENTATION.optimal.label,
      value: summary.optimal,
      status: "optimal",
      description: STATUS_PRESENTATION.optimal.description,
    },
    {
      key: "normal",
      label: STATUS_PRESENTATION.normal.label,
      value: summary.normal,
      status: "normal",
      description: STATUS_PRESENTATION.normal.description,
    },
    {
      key: "out_of_range",
      label: STATUS_PRESENTATION.out_of_range.label,
      value: summary.outOfRange,
      status: "out_of_range",
      description: STATUS_PRESENTATION.out_of_range.description,
    },
    {
      key: "needs_review",
      label: STATUS_PRESENTATION.needs_review.label,
      value: summary.needsReview,
      status: "needs_review",
      description: STATUS_PRESENTATION.needs_review.description,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.key} className="rounded-xl border bg-card p-4">
          <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {card.status ? (
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  STATUS_PRESENTATION[card.status].dotClass,
                )}
              />
            ) : null}
            {card.label}
          </dt>
          <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
            {card.value}
          </dd>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {card.description}
          </p>
        </div>
      ))}
    </dl>
  );
}
