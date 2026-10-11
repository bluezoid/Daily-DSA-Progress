import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-[13px] text-primary-foreground" aria-hidden>
        {"{}"}
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
