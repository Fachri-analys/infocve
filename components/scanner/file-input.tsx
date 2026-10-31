import type { ChangeEvent } from "react";
import { ArrowDownToLine, FileJson2 } from "lucide-react";

export function FileInput({ id, label, description, file, onChange }: {
  id: string;
  label: string;
  description: string;
  file: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <label htmlFor={id} className="group flex cursor-pointer items-center gap-4 rounded-lg border border-dashed border-border bg-background p-4 transition-[border-color,background-color] hover:border-accent hover:bg-surface-hover focus-within:ring-2 focus-within:ring-ring">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-accent"><FileJson2 className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{file?.name ?? `Pilih ${label}`}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : description}</span>
        </span>
        <ArrowDownToLine className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
      </label>
      <input id={id} className="sr-only" type="file" accept="application/json,.json" onChange={onChange} aria-describedby={`${id}-hint`} />
      <span id={`${id}-hint`} className="sr-only">{description}; maksimum 1 megabyte.</span>
    </div>
  );
}
