import { PRODUCT } from "@contextos/shared";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-muted/60 to-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="text-lg" />
          <p className="text-muted-foreground">{PRODUCT.tagline}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
