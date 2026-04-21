import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipora - Content Repurposing Engine",
  description:
    "Ubah satu video menjadi banyak konten promosi siap distribusi untuk Reels, TikTok, Shorts, dan WhatsApp.",
  icons: { icon: "/favicon.ico" },
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Jobs" },
  { href: "/generate", label: "AI Video" },
];

function CliporaMark() {
  return (
    <span className="clipora-mark" aria-hidden="true">
      <span className="clipora-mark-play" />
    </span>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <header className="top-shell">
          <Link href="/" className="brand-link" aria-label="Clipora home">
            <CliporaMark />
            <span className="brand-word">Clipora</span>
          </Link>

          <nav className="top-nav" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="top-status">
            <span className="status-dot" />
            <span>MVP Local</span>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
