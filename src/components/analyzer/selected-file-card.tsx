"use client";

import { FileText, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFileSize } from "@/lib/status-presentation";

export function SelectedFileCard({
  file,
  onRemove,
  onAnalyze,
}: {
  file: File;
  onRemove: () => void;
  onAnalyze: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={onRemove}>
            <X aria-hidden />
            Remove
          </Button>
          <Button type="button" onClick={onAnalyze}>
            <Sparkles aria-hidden />
            Analyze report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
