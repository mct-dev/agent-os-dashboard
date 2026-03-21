"use client"

import { useState, useEffect, useCallback } from "react"
import { AppContext } from "@/lib/store"
import {
  fetchTasks,
  fetchProjects,
  fetchAgents,
  fetchSops,
  fetchInbox,
} from "@/lib/api-client"
import { Sidebar } from "@/components/sidebar"
import { KanbanBoard } from "@/components/kanban-board"
import { InboxPage } from "@/components/inbox-page"
import { SOPsPage } from "@/components/sops-page"
import { AgentsPage } from "@/components/agents-page"
import { ProjectsPage } from "@/components/projects-page"
import { SettingsPage } from "@/components/settings-page"
import type { Task, Project, InboxItem, AgentConfig } from "@/lib/types"
import type { SOP } from "@/lib/sops"

export default function Dashboard() {
  const [activePage, setActivePage] = useState("board")
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [sops, setSops] = useState<SOP[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const refreshTasks = useCallback(async () => {
    setTasks(await fetchTasks())
  }, [])

  const refreshProjects = useCallback(async () => {
    setProjects(await fetchProjects())
  }, [])

  const refreshAgents = useCallback(async () => {
    setAgents(await fetchAgents())
  }, [])

  const refreshSops = useCallback(async () => {
    setSops(await fetchSops())
  }, [])

  const refreshInbox = useCallback(async () => {
    setInbox(await fetchInbox())
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchTasks(), fetchProjects(), fetchAgents(), fetchSops(), fetchInbox()])
      .then(([t, p, a, s, i]) => {
        if (cancelled) return
        setTasks(t)
        setProjects(p)
        setAgents(a)
        setSops(s)
        setInbox(i)
      })
      .catch(() => {}) // Handle gracefully - empty state is shown
    return () => { cancelled = true }
  }, [])

  const renderPage = () => {
    switch (activePage) {
      case "inbox":
        return <InboxPage />
      case "board":
        return <KanbanBoard />
      case "projects":
        return <ProjectsPage />
      case "sops":
        return <SOPsPage />
      case "agents":
        return <AgentsPage />
      case "settings":
        return <SettingsPage />
      default:
        return <KanbanBoard />
    }
  }

  return (
    <AppContext.Provider
      value={{
        tasks, setTasks,
        projects, setProjects,
        inbox, setInbox,
        agents, setAgents,
        sops, setSops,
        selectedTaskId, setSelectedTaskId,
        refreshTasks,
        refreshProjects,
        refreshAgents,
        refreshSops,
        refreshInbox,
      }}
    >
      <div className="flex min-h-screen">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 ml-[220px] min-w-0 overflow-hidden">
          {renderPage()}
        </main>
      </div>
    </AppContext.Provider>
  )
}
