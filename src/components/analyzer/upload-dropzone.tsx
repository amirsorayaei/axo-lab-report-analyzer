"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  SUPPORTED_FORMAT_LABEL,
} from "@/lib/upload/formats";
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
            Drag your files here, or choose them. {SUPPORTED_FORMAT_LABEL}, up to{" "}
            {MAX_FILES} files, {maxUploadMb} MB each and {maxTotalMb} MB in total.
          </p>
          <p className="text-sm text-muted-foreground">
            You can select several files at once — they are analysed together as
            the ordered pages of{" "}
            <span className="font-medium text-foreground">one report</span> for one
            patient.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload aria-hidden />
          Choose files
        </Button>

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
