"use client";

import { useRef } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";

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
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-sm font-semibold">
              {files.length} {files.length === 1 ? "file" : "files"} selected
            </h2>
            <p className="numeric text-xs text-muted-foreground">
              {formatFileSize(totalBytes)} / {formatFileSize(MAX_TOTAL_UPLOAD_BYTES)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Analysed together, in this order, as one patient&rsquo;s report.
          </p>
        </div>

        <ol className="divide-y rounded-lg border">
          {files.map((file, index) => {
            const definition = formatFromExtension(file.name);
            const isImage = definition?.kind === "image";

            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-3 p-2.5 sm:p-3"
              >
                <span
                  aria-hidden
                  className="numeric w-5 shrink-0 text-right text-xs text-muted-foreground"
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

                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-medium text-foreground"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <span className="numeric block text-xs text-muted-foreground">
                    Page {index + 1} · {formatFileSize(file.size)}
                  </span>
                </span>

                <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                  {definition?.label ?? "Unknown"}
                </Badge>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${file.name} from the selection`}
                  className="size-10 shrink-0"
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

        {isFull ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Maximum of {MAX_FILES} files reached.
          </p>
        ) : null}

        {/* Primary action first and dominant; the two secondary actions sit apart. */}
        <div className="space-y-3 border-t pt-4">
          <Button
            type="button"
            size="lg"
            onClick={onAnalyze}
            disabled={overTotal}
            className="h-11 w-full px-6 sm:w-auto sm:min-w-48"
          >
            Analyze report
          </Button>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={isFull}
              className="h-10"
            >
              <Plus aria-hidden />
              Add more
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onRemoveAll}
              className="h-10 text-muted-foreground"
            >
              <Trash2 aria-hidden />
              Remove all
            </Button>
          </div>
        </div>

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
