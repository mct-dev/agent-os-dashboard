"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useAppState } from "@/lib/store"

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { inbox } = useAppState()
  const unreadCount = inbox.filter((i) => !i.read).length
  const [onboardingComplete, setOnboardingComplete] = useState(true)

  useEffect(() => {
    fetch("/api/user-settings")
      .then((res) => res.json())
      .then((data) => {
        setOnboardingComplete(data.onboardingComplete ?? false)
      })
      .catch(() => {})
  }, [])

  const navItems = [
    { id: "inbox", label: "Inbox", icon: "🔔", badge: unreadCount || undefined },
    { id: "board", label: "Board", icon: "📋" },
    { id: "projects", label: "Projects", icon: "🗂" },
    { id: "sops", label: "SOPs", icon: "📄" },
    { id: "agents", label: "Agents", icon: "🤖" },
  ]

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-base-200 border-r border-base-300 flex flex-col z-50">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <span className="font-semibold text-sm tracking-tight text-base-content">Agent OS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2">
        <ul className="menu menu-sm p-0">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex items-center gap-2.5 text-[13px]",
                  activePage === item.id
                    ? "active"
                    : "text-base-content/50 hover:text-base-content/80"
                )}
              >
                <span className="text-sm w-5 text-center shrink-0">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="badge badge-primary badge-sm text-[10px]">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings at bottom */}
      <div className="px-2 pb-4">
        <ul className="menu menu-sm p-0">
          <li>
            <button
              onClick={() => onNavigate("settings")}
              className={cn(
                "flex items-center gap-2.5 text-[13px]",
                activePage === "settings"
                  ? "active"
                  : "text-base-content/50 hover:text-base-content/80"
              )}
            >
              <span className="text-sm w-5 text-center">⚙️</span>
              <span className="flex-1 text-left">Settings</span>
              {!onboardingComplete && (
                <span className="text-amber-400 text-xs" title="Setup incomplete">⚠️</span>
              )}
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}
