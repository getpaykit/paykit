import Link from "next/link";

import { LogoLockup } from "@/components/icons/logo";

export function MiniNavBar() {
  return (
    <div className="border-foreground/[0.06] bg-background fixed top-0 right-0 left-0 z-50 flex items-center border-b px-5 py-3.5 sm:px-6 lg:px-7">
      <Link href="/">
        <LogoLockup className="h-5" />
      </Link>
    </div>
  );
}
