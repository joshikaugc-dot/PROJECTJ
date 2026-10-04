import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
      <p className="mt-4 rounded-md border border-dashed border-border bg-background/60 px-3 py-2 text-center text-xs text-muted-foreground">
        Demo: <span className="font-mono">demo@northstar.test</span> / <span className="font-mono">northstar-demo</span>
      </p>
    </>
  );
}
