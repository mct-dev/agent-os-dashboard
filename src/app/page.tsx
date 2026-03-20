"use client"

import { useState, useEffect, useCallback } from "react"
import { AppContext } from "@/lib/store"
import { MOCK_PROJECTS, MOCK_INBOX, MOCK_AGENTS } from "@/lib/mock-data"
import { SOPS as DEFAULT_SOPS } from "@/lib/sops"
import { fetchTasks } from "@/lib/api-client"
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
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS)
  const [inbox, setInbox] = useState<InboxItem[]>(MOCK_INBOX)
  const [agents, setAgents] = useState<AgentConfig[]>(MOCK_AGENTS)
  const [sops, setSops] = useState<SOP[]>([...DEFAULT_SOPS])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const refreshTasks = useCallback(async () => {
    const data = await fetchTasks()
    setTasks(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchTasks().then((data) => {
      if (!cancelled) setTasks(data)
    })
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
      }}
    >
      <div className="flex min-h-screen">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 ml-[220px]">
          {renderPage()}
        </main>
      </div>
    </AppContext.Provider>
  )
}
