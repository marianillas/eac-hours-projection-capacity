"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Summary" },
  { href: "/admin", label: "Admin" },
  { href: "/lip", label: "LIP" },
  { href: "/clients", label: "Clients" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 text-sm">
      {LINKS.map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? "font-medium underline" : "text-neutral-600 hover:underline"}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
