"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../ThemeProvider";
import { Tooltip } from "../ui/Tooltip";

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="icon-nav">
      <div className="nav-brand"><i className="ti ti-bolt"></i></div>

      <Tooltip text="Dashboard" placement="right">
        <Link href="/" className={`nav-btn ${pathname === "/" ? "active" : ""}`}>
          <i className="ti ti-layout-dashboard"></i>
        </Link>
      </Tooltip>

      <Tooltip text="Jobs" placement="right">
        <Link href="/jobs" className={`nav-btn ${pathname === "/jobs" ? "active" : ""}`}>
          <i className="ti ti-briefcase"></i>
        </Link>
      </Tooltip>

      <Tooltip text="Workers" placement="right">
        <Link href="/workers" className={`nav-btn ${pathname === "/workers" ? "active" : ""}`}>
          <i className="ti ti-cpu"></i>
        </Link>
      </Tooltip>

      <div className="nav-bottom">
        <Tooltip text="Toggle theme" placement="right">
          <div className="nav-btn" onClick={toggleTheme}>
            <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`}></i>
          </div>
        </Tooltip>
        <Tooltip text="Settings" placement="right">
          <div className="nav-btn">
            <i className="ti ti-settings"></i>
          </div>
        </Tooltip>
      </div>
    </nav>
  );
}
