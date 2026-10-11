"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, ListTodo, Settings, Plus, Import } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/problems", label: "Problems", icon: Library },
  { href: "/revision-queue", label: "Revision queue", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];

const QUICK = [
  { href: "/problems/new", label: "New problem", icon: Plus },
  { href: "/problems/import", label: "Import from LeetCode", icon: Import },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/problems"
      ? pathname === "/problems" || (pathname.startsWith("/problems/") && !QUICK.some((q) => pathname === q.href))
      : pathname === href || pathname.startsWith(`${href}/`);

  const item = (href: string, label: string, Icon: typeof Plus) => (
    <Link
      key={href}
      href={href}
      onClick={onNavigate}
      aria-current={isActive(href) ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        isActive(href)
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );

  return (
    <nav aria-label="Main" className="grid gap-6">
      <div className="grid gap-0.5">{NAV.map((n) => item(n.href, n.label, n.icon))}</div>
      <div className="grid gap-0.5">
        <p className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Add</p>
        {QUICK.map((n) => item(n.href, n.label, n.icon))}
      </div>
    </nav>
  );
}

/** Static nav shown while the pathname-aware version streams in. */
export function NavLinksFallback() {
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
