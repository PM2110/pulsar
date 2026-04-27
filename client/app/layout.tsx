import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulsar – Job Engine Dashboard",
  description: "Real-time monitoring and control for the Pulsar distributed job engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* Sidebar */}
          <aside
            style={{
              width: 220,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              display: "flex",
              flexDirection: "column",
              padding: "0",
              position: "sticky",
              top: 0,
              height: "100vh",
            }}
          >
            {/* Logo */}
            <div
              style={{
                padding: "20px 20px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid var(--border-active)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  ⚡
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  Pulsar
                </span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Job Engine Dashboard
              </p>
            </div>

            {/* Nav */}
            <nav style={{ padding: "12px 10px", flex: 1 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  padding: "4px 8px 8px",
                }}
              >
                Overview
              </p>
              <NavLink href="/" label="Dashboard" icon="▦" />
              <NavLink href="/jobs" label="Jobs" icon="◈" />
              <NavLink href="/workers" label="Workers" icon="◎" />
            </nav>

            {/* Footer */}
            <div
              style={{
                padding: "14px 18px",
                borderTop: "1px solid var(--border)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <div
                  className="pulse-dot pulse-green"
                  style={{ width: 6, height: 6 }}
                />
                <span>Backend connected</span>
              </div>
              <span style={{ opacity: 0.6 }}>localhost:3000</span>
            </div>
          </aside>

          {/* Main */}
          <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="sidebar-link" style={{ marginBottom: 2 }}>
      <span style={{ fontSize: 14, opacity: 0.7 }}>{icon}</span>
      {label}
    </Link>
  );
}
