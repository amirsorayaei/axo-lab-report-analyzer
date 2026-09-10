"use client";

import { useCallback, useRef, useState } from "react";
import { ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, MAX_FILES } from "@/lib/upload/formats";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  onSelect,
  maxUploadMb,
  maxTotalMb,
  disabled,
}: {
  onSelect: (files: File[]) => void;
  maxUploadMb: number;
  maxTotalMb: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      const files = Array.from(list ?? []);
      if (files.length > 0) onSelect(files);
    },
    [onSelect],
  );

  return (
    <div
      // The drop target is a plain region; the button inside is what receives
      // keyboard focus, so there is no custom key handling to get wrong.
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border border-dashed bg-card px-6 py-10 text-center transition-colors sm:py-14",
        isDragging ? "border-primary bg-accent/50" : "border-border",
        disabled && "opacity-60",
      )}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Upload className="size-5" aria-hidden />
        </span>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Add your lab report
          </h2>
          <p className="text-sm text-muted-foreground">
            Drag files here, or choose them below.
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="h-11 w-full px-6 sm:w-auto"
        >
          Choose files
        </Button>

        <dl className="space-y-0.5 text-xs text-muted-foreground">
          <div>
            <dt className="sr-only">Supported formats and limits</dt>
            <dd>
              PDF, JPG, PNG or WebP · Up to {MAX_FILES} files · {maxUploadMb} MB
              each, {maxTotalMb} MB total
            </dd>
          </div>
          <div>
            <dt className="sr-only">Report scope</dt>
            <dd>Upload one patient&rsquo;s report per analysis.</dd>
          </div>
        </dl>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          Processed on the server · nothing is stored
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          aria-label="Laboratory report files"
          disabled={disabled}
          onChange={(event) => {
            handleFiles(event.target.files);
            // Allows re-selecting the same file after a remove.
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
