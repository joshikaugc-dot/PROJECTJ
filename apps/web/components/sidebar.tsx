"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Blocks,
  Brain,
  Cpu,
  History,
  Home,
  LogOut,
  Plug,
  Settings,
  Workflow,
} from "lucide-react";
import { cn } from "@contextos/ui";
import { api } from "@/lib/client";
import { Logo } from "./logo";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/brain", label: "Company Brain", icon: Brain },
  { href: "/verticals", label: "Verticals", icon: Blocks },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/history", label: "History", icon: History },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/models", label: "AI Models", icon: Cpu },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ orgName, userName, role }: { orgName: string; userName: string; role: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", "POST");
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-4 pt-4 pb-3">
        <Logo />
        <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Organization</div>
          <div className="truncate font-medium">{orgName}</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-foreground/75 transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-muted font-medium text-foreground",
              )}
            >
              <Icon className="size-4 opacity-80" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {userName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{userName}</div>
          <div className="truncate text-xs text-muted-foreground">{role ?? "No role set"}</div>
        </div>
        <button onClick={logout} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
