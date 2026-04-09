"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 ml-[250px] p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </>
  );
}
