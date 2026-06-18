"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../ThemeProvider";

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="icon-nav">
      <div className="nav-brand"><i className="ti ti-bolt"></i></div>
      
      <Link href="/" className={`nav-btn ${pathname === "/" ? "active" : ""}`} data-tip="Dashboard">
        <i className="ti ti-layout-dashboard"></i>
      </Link>
      <Link href="/jobs" className={`nav-btn ${pathname === "/jobs" ? "active" : ""}`} data-tip="Jobs">
        <i className="ti ti-briefcase"></i>
      </Link>
      <Link href="/workers" className={`nav-btn ${pathname === "/workers" ? "active" : ""}`} data-tip="Workers">
        <i className="ti ti-cpu"></i>
      </Link>
      <div className="nav-btn" data-tip="Analytics"><i className="ti ti-chart-bar"></i></div>
      
      <div className="nav-sep"></div>
      
      <div className="nav-btn" data-tip="Alerts" style={{ position: "relative" }}>
        <i className="ti ti-bell"></i>
        <span className="nav-dot"></span>
      </div>
      <div className="nav-btn" data-tip="Seed jobs"><i className="ti ti-bolt"></i></div>
      
      <div className="nav-bottom">
        <div className="nav-btn" data-tip="Toggle theme" onClick={toggleTheme}>
          <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`}></i>
        </div>
        <div className="nav-btn" data-tip="Settings"><i className="ti ti-settings"></i></div>
      </div>
    </nav>
  );
}
