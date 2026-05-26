import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { Sidebar } from "./components/Sidebar";

export const metadata: Metadata = {
  title: "Pulsar – Job Engine Dashboard",
  description: "Real-time monitoring and control for the Pulsar distributed job engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('pulsar-theme')||'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){}})();` }} />
      </head>
      <body>
        <ThemeProvider>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{ flex: 1, overflow: "auto", background: "var(--bg-page)" }}>{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
