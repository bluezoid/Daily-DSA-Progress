import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { NavLinks, NavLinksFallback } from "@/components/layout/nav-links";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";

async function Account() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <UserMenu name={user.name} email={user.email} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="mb-6 px-2">
          <Logo href="/dashboard" />
        </div>
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <div className="lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <div className="ml-auto">
            <Suspense fallback={<Skeleton className="h-8 w-28" />}>
              <Account />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
