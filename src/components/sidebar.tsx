"use client"

import { cn } from "@/lib/utils"
import { useAppState } from "@/lib/store"

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { inbox } = useAppState()
  const unreadCount = inbox.filter((i) => !i.read).length

  const navItems = [
    { id: "inbox", label: "Inbox", icon: "🔔", badge: unreadCount || undefined },
    { id: "board", label: "Board", icon: "📋" },
    { id: "projects", label: "Projects", icon: "🗂" },
    { id: "sops", label: "SOPs", icon: "📄" },
    { id: "agents", label: "Agents", icon: "🤖" },
  ]

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">Agent OS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
              activePage === item.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
            )}
          >
            <span className="text-sm w-5 text-center shrink-0">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="px-2 pb-4">
        <button
          onClick={() => onNavigate("settings")}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
            activePage === "settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
          )}
        >
          <span className="text-sm w-5 text-center">⚙️</span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
