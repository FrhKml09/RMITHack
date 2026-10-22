"use client";

import { PcbProvider } from "@/lib/pcb/session";

// The adapter config is fetched at runtime from /api/config. When it is missing (before the realm
// is set up) the app runs in clearly-labelled rehearsal mode instead of failing to build.
export function Providers({ children }: { children: React.ReactNode }) {
  return <PcbProvider>{children}</PcbProvider>;
}
