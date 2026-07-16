"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const pathname = usePathname();
  useEffect(() => {
    const isAdminRoute = pathname?.startsWith("/admin") ?? false;
    document.body.classList.toggle("editorial-app", !isAdminRoute);
    document.body.classList.toggle("admin-app", isAdminRoute);

    return () => {
      document.body.classList.remove("editorial-app", "admin-app");
    };
  }, [pathname]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
