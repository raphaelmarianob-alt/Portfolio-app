"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  {
    href: "/base",
    label: "Base do Research",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    href: "/novo",
    label: "Novo Relatório",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/historico",
    label: "Histórico",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[250px] bg-[#0d0e14] border-r border-[#1e2030] flex flex-col z-10">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[#1e2030]">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mr-3">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
          </svg>
        </div>
        <span className="text-white font-bold text-lg">
          Portfolio Manager
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#71717a] px-3 mb-3 block">
          Menu
        </span>
        <div className="space-y-1">
          {links.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-emerald-500/10 text-emerald-400 border-l-[3px] border-emerald-500 pl-[9px]"
                    : "text-[#71717a] hover:text-white hover:bg-white/5"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Separator */}
      <div className="border-t border-[#1e2030] mx-4" />

      {/* Footer */}
      <div className="p-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-[#1a1b26] flex items-center justify-center">
            <span className="text-xs text-[#71717a] font-medium">PM</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#e4e4e7] font-medium truncate">Portfolio Manager</p>
            <p className="text-[10px] text-[#71717a]">Family Office</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
