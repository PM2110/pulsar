"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊", desc: "System overview" },
  { href: "/jobs", label: "Jobs", icon: "⚙️", desc: "Job management" },
  { href: "/workers", label: "Workers", icon: "🖥️", desc: "Fleet control" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="sidebar-brand-logo">⚡</div>
          <div>
            <div className="sidebar-brand-name">Pulsar</div>
            <div className="sidebar-brand-sub">Job Engine v2.0</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Navigation</div>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${active ? "active" : ""}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <div>
                <div>{item.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 400, marginTop: 1 }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* System info */}
      <div className="sidebar-section" style={{ marginTop: "auto" }}>
        <div className="sidebar-section-title">System</div>
        <div style={{ padding: "0 10px" }}>
          <div className="sidebar-health-row">
            <div className="sidebar-health-dot" />
            <span>API Server Connected</span>
          </div>
          <div className="sidebar-health-row" style={{ opacity: 0.6 }}>
            <span style={{ marginLeft: 15 }}>localhost:3000</span>
          </div>
          <div className="sidebar-health-row" style={{ marginTop: 8, opacity: 0.6 }}>
            <span>🔌 WebSocket Active</span>
          </div>
        </div>
      </div>

      {/* Theme toggle */}
      <div style={{ padding: "0 14px 18px" }}>
        <button className="sidebar-theme-btn" onClick={toggleTheme}>
          <span style={{ fontSize: 15 }}>{theme === "dark" ? "☀️" : "🌙"}</span>
          <span>Switch to {theme === "dark" ? "Light" : "Dark"} Mode</span>
        </button>
      </div>
    </aside>
  );
}
