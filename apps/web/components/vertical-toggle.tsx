"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Switch } from "@contextos/ui";
import { api } from "@/lib/client";

export function VerticalToggle({ id, enabled, active }: { id: string; enabled: boolean; active: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    try {
      await api(`/api/verticals/${id}`, "PATCH", body);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {enabled && !active && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => patch({ active: true })}>
          Make active
        </Button>
      )}
      <Switch checked={enabled} disabled={pending} onCheckedChange={(v) => patch({ enabled: v })} aria-label={`Enable ${id}`} />
    </div>
  );
}
