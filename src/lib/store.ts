"use client"

import { createContext, useContext } from "react"
import type { Task, Project, InboxItem, AgentConfig, ScheduledJob } from "./types"
import type { SOP } from "./sops"

export interface AppState {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  projects: Project[]
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  inbox: InboxItem[]
  setInbox: React.Dispatch<React.SetStateAction<InboxItem[]>>
  agents: AgentConfig[]
  setAgents: React.Dispatch<React.SetStateAction<AgentConfig[]>>
  sops: SOP[]
  setSops: React.Dispatch<React.SetStateAction<SOP[]>>
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
  refreshTasks: () => Promise<void>
  refreshProjects: () => Promise<void>
  refreshAgents: () => Promise<void>
  refreshSops: () => Promise<void>
  refreshInbox: () => Promise<void>
  scheduledJobs: ScheduledJob[]
  setScheduledJobs: React.Dispatch<React.SetStateAction<ScheduledJob[]>>
  refreshSchedules: () => Promise<void>
  linearConnected: boolean
  setLinearConnected: React.Dispatch<React.SetStateAction<boolean>>
}

export const AppContext = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppState must be used within AppContext.Provider")
  return ctx
}
