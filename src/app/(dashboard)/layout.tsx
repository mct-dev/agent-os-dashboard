"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { AppContext } from "@/lib/store"
import {
  fetchTasks,
  fetchProjects,
  fetchAgents,
  fetchSops,
  fetchInbox,
  fetchSchedules,
} from "@/lib/api-client"
import { Sidebar } from "@/components/sidebar"
import type { Task, Project, InboxItem, AgentConfig, ScheduledJob } from "@/lib/types"
import type { SOP } from "@/lib/sops"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [sops, setSops] = useState<SOP[]>([])
  const searchParams = useSearchParams()
  const [selectedTaskId, setSelectedTaskIdRaw] = useState<string | null>(searchParams.get("task"))
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([])
  const [linearConnected, setLinearConnected] = useState(false)
  const isInitialMount = useRef(true)

  // Sync selectedTaskId to URL
  const setSelectedTaskId = useCallback((id: string | null) => {
    setSelectedTaskIdRaw(id)
    const url = new URL(window.location.href)
    if (id) {
      url.searchParams.set("task", id)
    } else {
      url.searchParams.delete("task")
    }
    window.history.replaceState({}, "", url.toString())
  }, [])

  // On mount, if URL has ?task=, keep it (already set via useState initializer)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
    }
  }, [])

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

  const refreshSchedules = useCallback(async () => {
    setScheduledJobs(await fetchSchedules())
  }, [])

  useEffect(() => {
    fetch("/api/linear/status")
      .then((r) => r.json())
      .then((d) => setLinearConnected(d.connected === true))
      .catch(() => setLinearConnected(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchTasks(), fetchProjects(), fetchAgents(), fetchSops(), fetchInbox(), fetchSchedules()])
      .then(([t, p, a, s, i, sj]) => {
        if (cancelled) return
        setTasks(t)
        setProjects(p)
        setAgents(a)
        setSops(s)
        setInbox(i)
        setScheduledJobs(sj)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
        scheduledJobs, setScheduledJobs, refreshSchedules,
        linearConnected, setLinearConnected,
      }}
    >
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-[220px] min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </AppContext.Provider>
  )
}
