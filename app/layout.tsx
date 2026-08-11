import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, BookOpen, ChevronDown, ClipboardList, Home, Swords, Trophy, Users } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moggate League Archive",
  description: "Fantasy football history, records, rivalries, manager profiles, and draft archive for Moggate."
};

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: BookOpen },
  { href: "/managers", label: "Managers", icon: Users },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/rivalries", label: "Rivalries", icon: Swords },
  { href: "/drafts", label: "Drafts", icon: ClipboardList },
  { href: "/trades", label: "Roster Moves", icon: ArrowLeftRight }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link className="brand" href="/">
              <span className="brand-mark">M</span>
              <span>
                <strong>Moggate</strong>
                <small>League Archive</small>
              </span>
            </Link>
            <details className="nav-menu" open>
              <summary>
                <span>Pages</span>
                <ChevronDown aria-hidden size={17} />
              </summary>
              <nav aria-label="Primary">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Icon aria-hidden size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </details>
            <ThemeToggle />
          </aside>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
