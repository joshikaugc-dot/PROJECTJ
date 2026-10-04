"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@contextos/ui";
import { api } from "@/lib/client";

const OPTIONS = [
  { value: "auto", label: "Auto", hint: "Best model per task" },
  { value: "anthropic", label: "Claude", hint: "Anthropic" },
  { value: "openai", label: "GPT", hint: "OpenAI" },
  { value: "gemini", label: "Gemini", hint: "Google" },
];

export function ProviderSelect({ value, configured }: { value: string; configured: string[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {OPTIONS.map((o) => {
        const available = o.value === "auto" || configured.includes(o.value);
        return (
          <button
            key={o.value}
            disabled={!available}
            onClick={async () => {
              setCurrent(o.value);
              await api("/api/settings", "PATCH", { preferences: { preferredProvider: o.value } });
              router.refresh();
            }}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              current === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
            )}
          >
            <div className="font-medium">{o.label}</div>
            <div className="text-xs text-muted-foreground">{available ? o.hint : "No API key"}</div>
          </button>
        );
      })}
    </div>
  );
}
