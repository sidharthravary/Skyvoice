"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { NavBar } from "@/components/ui/NavBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F5F9FF]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <NavBar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
