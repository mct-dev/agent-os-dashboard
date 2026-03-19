"use client"

import { useState } from "react"
import { AppContext } from "@/lib/store"
import { MOCK_TASKS, MOCK_PROJECTS, MOCK_INBOX, MOCK_AGENTS } from "@/lib/mock-data"
import { SOPS as DEFAULT_SOPS } from "@/lib/sops"
import { Sidebar } from "@/components/sidebar"
import { KanbanBoard } from "@/components/kanban-board"
import { InboxPage } from "@/components/inbox-page"
import { SOPsPage } from "@/components/sops-page"
import { AgentsPage } from "@/components/agents-page"
import { ProjectsPage } from "@/components/projects-page"
import type { Task, Project, InboxItem, AgentConfig } from "@/lib/types"
import type { SOP } from "@/lib/sops"

export default function Dashboard() {
  const [activePage, setActivePage] = useState("board")
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS)
  const [inbox, setInbox] = useState<InboxItem[]>(MOCK_INBOX)
  const [agents, setAgents] = useState<AgentConfig[]>(MOCK_AGENTS)
  const [sops, setSops] = useState<SOP[]>([...DEFAULT_SOPS])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

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
        return (
          <div className="flex flex-col h-screen">
            <header className="shrink-0 border-b border-white/[0.06] px-6 py-3">
              <h1 className="text-sm font-semibold text-white">Settings</h1>
            </header>
            <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
              Settings coming soon
            </div>
          </div>
        )
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
