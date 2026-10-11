"use client";

import { useLayoutEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";
import { Logo } from "./logo";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  // Close when the page is hidden by navigation (Activity keeps state otherwise).
  useLayoutEffect(() => () => setOpen(false), []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4">
        <SheetHeader className="mb-4 p-0">
          <SheetTitle asChild>
            <div>
              <Logo href="/dashboard" />
            </div>
          </SheetTitle>
        </SheetHeader>
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
