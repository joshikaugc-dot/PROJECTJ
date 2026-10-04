"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, Input, Label } from "@contextos/ui";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ next: string }>(`/api/auth/${mode}`, "POST", Object.fromEntries(form));
      const next = params.get("next");
      router.push(next && next.startsWith("/") && result.next !== "/onboarding" ? next : result.next);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account? <Link className="text-primary hover:underline" href="/login">Sign in</Link></>
            ) : (
              <>New to ContextOS? <Link className="text-primary hover:underline" href="/signup">Create an account</Link></>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
