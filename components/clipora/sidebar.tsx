"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "./logo-mark";

type NavItem = { label: string; href: string; soon?: boolean };

const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Clip Studio", href: "/studio" },
  { label: "Pekerjaan Saya", href: "/dashboard" },
  { label: "Video AI", href: "/generate" },
  { label: "Analitik", href: "#", soon: true },
  { label: "Pengaturan", href: "#", soon: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  if (href === "/studio") return pathname === "/" || pathname === "/studio";
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <aside
      style={{
        width: 210,
        flexShrink: 0,
        background: "var(--sidebar)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "18px 16px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 8,
        }}
      >
        <LogoMark size={30} />
        <span
          style={{ color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}
        >
          Clipora
        </span>
      </div>

      {/* Workspace card */}
      <div
        style={{
          margin: "0 10px 10px",
          padding: "10px 12px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Workspace
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          Hendrik Studio
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Creator Pro
        </p>
      </div>

      {/* Nav */}
      <nav style={{ padding: "0 8px", flex: 1 }}>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`sidebar-link${active ? " active" : ""}`}
            >
              <span>{item.label}</span>
              {item.soon && (
                <span
                  style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}
                >
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: admin toggle + user */}
      <div
        style={{
          padding: "10px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          marginTop: "auto",
        }}
      >
        {/* Admin toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px",
            borderRadius: 8,
            marginBottom: 10,
            background: isAdmin ? "rgba(196,154,60,0.12)" : "rgba(255,255,255,0.04)",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isAdmin ? "var(--gold)" : "rgba(255,255,255,0.4)",
            }}
          >
            {isAdmin ? "Admin Mode" : "User Mode"}
          </span>
          <button
            onClick={() => setIsAdmin((v) => !v)}
            aria-label="Toggle admin mode"
            style={{
              width: 34,
              height: 18,
              borderRadius: 999,
              border: "none",
              background: isAdmin ? "var(--gold)" : "rgba(255,255,255,0.15)",
              cursor: "pointer",
              position: "relative",
              transition: "background 200ms",
              flexShrink: 0,
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: isAdmin ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 200ms",
              }}
            />
          </button>
        </div>

        {/* User */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--gold), var(--accent))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            H
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Hendrik Wangkay
            </p>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
              Creator Pro
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
