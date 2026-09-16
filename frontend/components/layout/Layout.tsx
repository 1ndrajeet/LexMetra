// components/layout/Layout.tsx
"use client";

import { useState } from "react";
import { LogoutButton } from "@/components/misc/LogoutButton";
import {
  LayoutDashboard,
  History,
  ClipboardCheck,
  UserRound,
  ScanLine,
  Menu,
  type LucideIcon,
  FileWarningIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
};

const navItems: NavItem[] = [
  { label: "Home", icon: LayoutDashboard, path: "/home" },
  { label: "History", icon: History, path: "/history" },
  { label: "Complaints", icon: FileWarningIcon, path: "/complaints" },
  { label: "Profile", icon: UserRound, path: "/profile" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ 
    item, 
    isMobile = false,
    onClick 
  }: { 
    item: NavItem; 
    isMobile?: boolean;
    onClick?: () => void;
  }) => {
    const isActive = typeof window !== "undefined" && window.location.pathname === item.path;
    
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start gap-3 px-3 py-2.5 h-auto text-sm font-semibold",
          isActive && "bg-neutral-50 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-700"
        )}
        onClick={() => {
          window.location.href = item.path;
          if (isMobile && onClick) onClick();
        }}
      >
        <item.icon className={cn(
          "h-[18px] w-[18px]",
          isActive ? "text-neutral-600" : "text-slate-400"
        )} />
        {item.label}
      </Button>
    );
  };

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex flex-col gap-1 px-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-[-.02em] text-slate-900">LEXMETRA</p>
            <p className="text-[10px] font-medium tracking-[.04em] text-slate-500">
              Legal Metrology Platform
            </p>
          </div>
        </div>
        <Separator className="mt-2" />
        <div className="pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">
            THE INSPECTORS · SIH 2026
          </div>
          <p className="mt-1 text-[9px] font-medium text-slate-400">PS 26034</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink 
            key={item.path} 
            item={item} 
            isMobile={!!onItemClick}
            onClick={onItemClick}
          />
        ))}
      </nav>

      <div className="mt-auto rounded-2xl bg-slate-50/80 px-4 py-3.5 border border-slate-100">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-700">Demo workspace</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
          Mock OCR · compliance checks active
        </p>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </div>
    </div>
  );

  const getPageTitle = () => {
    if (typeof window === "undefined") return "Dashboard";
    const path = window.location.pathname;
    if (path === "/home" || path === "/") return "Dashboard";
    return path.replace("/", "").charAt(0).toUpperCase() + path.slice(2);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200/80 bg-white px-5 py-6 md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-5">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white">
          <div className="flex h-[64px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">
                  LEXMETRA
                </p>
                <h1 className="mt-0.5 text-lg font-semibold tracking-[-.02em] text-slate-900">
                  {getPageTitle()}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <LogoutButton />
              </div>
              <Avatar className="h-9 w-9 ring-1 ring-slate-200/80">
                <AvatarFallback className="bg-slate-100 text-slate-600">
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content - REMOVED ScrollArea wrapper, let page handle scroll */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}