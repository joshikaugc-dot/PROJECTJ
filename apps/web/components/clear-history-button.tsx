"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@contextos/ui";
import { api } from "@/lib/client";

export function ClearHistoryButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Delete all of your AI history in this organization? This cannot be undone.")) return;
        setPending(true);
        await api("/api/history", "DELETE");
        router.refresh();
        setPending(false);
      }}
    >
      <Trash2 /> Clear history
    </Button>
  );
}
