"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAppState } from "@/lib/store"
import { LLM_MODELS } from "@/lib/types"
import type { AgentConfig } from "@/lib/types"
import { SOPS } from "@/lib/sops"

interface ModelOption {
  id: string
  name: string
  provider: string
}

const RUNTIMES = [
  {
    name: "Claude Code",
    icon: "🟣",
    status: "offline" as const,
    version: "—",
    path: "~/.claude/local",
    skills: 0,
  },
  {
    name: "Codex (OpenAI)",
    icon: "🟢",
    status: "offline" as const,
    version: "—",
    path: "~/.codex/local",
    skills: 0,
  },
]

export function AgentsPage() {
  const { agents, setAgents, sops } = useAppState()
  const [editing, setEditing] = useState<AgentConfig | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)

  useEffect(() => {
    setModelsLoading(true)
    fetch("/api/models")
      .then((res) => res.json())
      .then((data: ModelOption[]) => setModels(data))
      .catch(() => {
        // Fallback to static list
        setModels(
          LLM_MODELS.map((m) => ({
            id: m,
            name: m,
            provider: m.split("/")[0],
          }))
        )
      })
      .finally(() => setModelsLoading(false))
  }, [])

  const modelsByProvider = models.reduce<Record<string, ModelOption[]>>(
    (acc, m) => {
      const provider = m.provider || "other"
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(m)
      return acc
    },
    {}
  )

  const openNew = () => {
    setEditing({
      id: `agent-${Date.now()}`,
      name: "",
      model: "anthropic/claude-sonnet-4-6",
      description: "",
      systemPrompt: "",
      defaultSopId: null,
    })
    setIsNew(true)
  }

  const openEdit = (agent: AgentConfig) => {
    setEditing({ ...agent })
    setIsNew(false)
  }

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return
    if (isNew) {
      setAgents((prev) => [...prev, editing])
    } else {
      setAgents((prev) => prev.map((a) => (a.id === editing.id ? editing : a)))
    }
    setEditing(null)
  }

  const handleDelete = () => {
    if (deleteId) {
      setAgents((prev) => prev.filter((a) => a.id !== deleteId))
      setDeleteId(null)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-foreground">Agents</h1>
        <Button size="sm" onClick={openNew}>
          + New Agent
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Configured Agents */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Configured Agents
          </h2>
          <div className="space-y-2">
            {agents.map((agent) => {
              const sop = sops.find((s) => s.id === agent.defaultSopId)
              return (
                <div
                  key={agent.id}
                  className="bg-card border border-border rounded-lg p-4 hover:border-border/80 transition-colors cursor-pointer"
                  onClick={() => openEdit(agent)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🤖</span>
                      <h3 className="text-sm font-medium text-foreground">{agent.name}</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                        {agent.model}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-destructive/60 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(agent.id) }}
                    >
                      Delete
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{agent.description}</p>
                  {sop && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground/60">SOP:</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        {sop.name}
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })}
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No agents configured yet</p>
            )}
          </div>
        </section>

        {/* Available Runtimes */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Available Runtimes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RUNTIMES.map((runtime) => (
              <div
                key={runtime.name}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{runtime.icon}</span>
                  <h3 className="text-sm font-medium text-foreground">{runtime.name}</h3>
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 ml-auto">
                    Offline
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-foreground/60 font-mono">{runtime.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Path</span>
                    <span className="text-foreground/60 font-mono">{runtime.path}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skills</span>
                    <span className="text-foreground/60">—</span>
                  </div>
                </div>
                <div className="bg-muted border border-border rounded-md p-2.5">
                  <p className="text-[11px] text-amber-300/70">
                    ⚠ Runtime bridge: Not configured
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A local bridge is required to connect Vercel to your machine&apos;s runtime. Connect via local bridge to sync skills.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "New Agent" : "Edit Agent"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Description</label>
                <Input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Model</label>
                <Select
                  value={editing.model}
                  onValueChange={(v) => setEditing({ ...editing, model: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={modelsLoading ? "Loading models…" : "Select model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {modelsLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading models…
                      </SelectItem>
                    ) : models.length > 0 ? (
                      Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                        <SelectGroup key={provider}>
                          <SelectLabel className="capitalize">{provider}</SelectLabel>
                          {providerModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    ) : (
                      LLM_MODELS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Default SOP</label>
                <Select
                  value={editing.defaultSopId ?? "none"}
                  onValueChange={(v) => setEditing({ ...editing, defaultSopId: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">System Prompt</label>
                <Textarea
                  value={editing.systemPrompt}
                  onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
                  className="resize-none min-h-[100px]"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSave}>
              {isNew ? "Create Agent" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the agent configuration. Tasks won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
