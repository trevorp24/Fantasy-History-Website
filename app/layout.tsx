import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, BarChart3, BookOpen, CalendarDays, ChevronDown, ClipboardList, Home, Swords, Trophy, Users } from "lucide-react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { loadLeagueData } from "@/lib/data/loadLeague";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moggate League Archive",
  description: "Fantasy football history, records, rivalries, manager profiles, and draft archive for Moggate."
};

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/current-season", label: "Current Season", icon: BarChart3 },
  { href: "/schedule", label: "2026 Schedule", icon: CalendarDays },
  { href: "/trades", label: "2026 Roster Moves", icon: ArrowLeftRight },
  { divider: true },
  { href: "/history", label: "League History", icon: BookOpen },
  { href: "/managers", label: "Manager Stats", icon: Users },
  { href: "/records", label: "Awards", icon: Trophy },
  { href: "/rivalries", label: "Rivalries", icon: Swords },
  { href: "/drafts", label: "Drafts", icon: ClipboardList }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = loadLeagueData();
  const managerById = new Map(data.managers.map((manager) => [manager.id, manager.displayName]));
  const championBanners = data.seasons
    .filter((season) => season.status === "complete")
    .sort((a, b) => a.year - b.year)
    .flatMap((season) => {
      const winner = season.teams.find((team) => team.finalPlacement === 1);
      return winner ? [{ season: season.year, winner }] : [];
    });

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
                {nav.map((item, index) => {
                  if ("divider" in item) return <span className="nav-divider" aria-hidden="true" key={`divider-${index}`} />;
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
          <main>
            {championBanners.length > 0 && (
              <section className="champion-banners" aria-label="Previous winners">
                {championBanners.map(({ season, winner }, index) => (
                  <div
                    className={`champion-banner ${index === championBanners.length - 1 ? "latest" : ""}`}
                    style={{ animationDelay: `${index * -0.45}s` }}
                    key={season}
                  >
                    <span>Moggate</span>
                    <span className="banner-year">{season}</span>
                    <strong>{managerById.get(winner.managerId) ?? "Owner unavailable"}</strong>
                    <small>{winner.wins}-{winner.losses}{winner.ties ? `-${winner.ties}` : ""}</small>
                  </div>
                ))}
              </section>
            )}
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
