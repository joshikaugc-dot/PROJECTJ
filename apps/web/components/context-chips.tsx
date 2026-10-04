"use client";

import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import type { ContextBlock } from "@contextos/shared";
import { Badge, cn } from "@contextos/ui";

/** "Using: Marketing · Northstar · Brand Voice · Gmail Context" + an inspector. */
export function ContextChips({ labels, blocks }: { labels: string[]; blocks?: ContextBlock[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Using
        </span>
        {labels.map((label) => (
          <Badge key={label} variant="secondary">{label}</Badge>
        ))}
        {blocks && blocks.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
          >
            Inspect <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && blocks && (
        <div className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
          {blocks.map((b) => (
            <div key={`${b.key}-${b.label}`} className="mb-3 last:mb-0">
              <div className="font-medium">{b.label} <span className="font-normal text-muted-foreground">— {b.reason}</span></div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-muted-foreground">{b.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
