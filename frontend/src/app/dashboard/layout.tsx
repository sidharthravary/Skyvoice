"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { NavBar } from "@/components/ui/NavBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(79,125,243,0.08), transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(124,58,237,0.05), transparent 60%), #F6F8FE",
      }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <NavBar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
