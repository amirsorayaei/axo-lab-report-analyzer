"use client";

import { useRef } from "react";
import { FileText, Image as ImageIcon, Plus, Sparkles, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  MAX_TOTAL_UPLOAD_BYTES,
  formatFromExtension,
} from "@/lib/upload/formats";
import { formatFileSize } from "@/lib/status-presentation";

/**
 * The ordered selection. Order is meaningful — it is the page order sent to the
 * model — so every row shows its position, and files are appended rather than
 * replaced when more are added.
 */
export function SelectedFilesList({
  files,
  onAdd,
  onRemove,
  onRemoveAll,
  onAnalyze,
}: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onRemoveAll: () => void;
  onAnalyze: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const isFull = files.length >= MAX_FILES;
  const overTotal = totalBytes > MAX_TOTAL_UPLOAD_BYTES;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold">
            {files.length} {files.length === 1 ? "file" : "files"} selected
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(totalBytes)} of{" "}
            {formatFileSize(MAX_TOTAL_UPLOAD_BYTES)} total
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          These files are analysed together, in this order, as one report for one
          patient. Drag a new file onto the page or use “Add more” to append.
        </p>

        <ol className="divide-y rounded-lg border">
          {files.map((file, index) => {
            const definition = formatFromExtension(file.name);
            const isImage = definition?.kind === "image";

            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-3 p-3"
              >
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums"
                >
                  {index + 1}
                </span>

                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  {isImage ? (
                    <ImageIcon className="size-4" aria-hidden />
                  ) : (
                    <FileText className="size-4" aria-hidden />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Part {index + 1}</span>
                    <span aria-hidden>·</span>
                    <span>{formatFileSize(file.size)}</span>
                  </p>
                </div>

                <Badge variant="secondary" className="shrink-0">
                  {definition?.label ?? "Unknown"}
                </Badge>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ol>

        {overTotal ? (
          <p role="alert" className="text-xs font-medium text-status-out">
            The combined size is over the {formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}{" "}
            limit. Remove a file before analysing.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={isFull}
            >
              <Plus aria-hidden />
              Add more
            </Button>
            <Button type="button" variant="ghost" onClick={onRemoveAll}>
              <Trash2 aria-hidden />
              Remove all
            </Button>
          </div>

          <Button type="button" onClick={onAnalyze} disabled={overTotal}>
            <Sparkles aria-hidden />
            Analyze report
          </Button>
        </div>

        {isFull ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            The maximum of {MAX_FILES} files has been reached.
          </p>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          aria-label="Add more laboratory report files"
          onChange={(event) => {
            onAdd(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}
