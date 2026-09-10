"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  onSelect,
  maxUploadMb,
  disabled,
}: {
  onSelect: (file: File) => void;
  maxUploadMb: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onSelect(file);
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
        "rounded-xl border border-dashed bg-card px-6 py-12 text-center transition-colors sm:py-16",
        isDragging ? "border-ring bg-accent/40" : "border-border",
        disabled && "opacity-60",
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <FileText className="size-6" aria-hidden />
        </span>

        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-foreground">
            Upload a laboratory report
          </h2>
          <p className="text-sm text-muted-foreground">
            Drag a PDF here, or choose a file. Text-based PDF only, up to{" "}
            {maxUploadMb} MB.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload aria-hidden />
          Choose PDF
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Laboratory report PDF"
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
