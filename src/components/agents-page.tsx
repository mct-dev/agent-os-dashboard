"use client"

import { useState } from "react"
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
  SelectItem,
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
      <header className="shrink-0 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">Agents</h1>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
          onClick={openNew}
        >
          + New Agent
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Configured Agents */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Configured Agents
          </h2>
          <div className="space-y-2">
            {agents.map((agent) => {
              const sop = sops.find((s) => s.id === agent.defaultSopId)
              return (
                <div
                  key={agent.id}
                  className="bg-[#141414] border border-white/[0.06] rounded-lg p-4 hover:border-white/[0.1] transition-colors cursor-pointer"
                  onClick={() => openEdit(agent)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🤖</span>
                      <h3 className="text-sm font-medium text-white">{agent.name}</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-white/5 text-white/40 border-white/10 font-mono">
                        {agent.model}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-red-400/60 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(agent.id) }}
                    >
                      Delete
                    </Button>
                  </div>
                  <p className="text-xs text-white/40 mb-2">{agent.description}</p>
                  {sop && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-white/30">SOP:</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-purple-500/10 text-purple-300 border-purple-500/20">
                        {sop.name}
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })}
            {agents.length === 0 && (
              <p className="text-xs text-white/20 text-center py-8">No agents configured yet</p>
            )}
          </div>
        </section>

        {/* Available Runtimes */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Available Runtimes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RUNTIMES.map((runtime) => (
              <div
                key={runtime.name}
                className="bg-[#141414] border border-white/[0.06] rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{runtime.icon}</span>
                  <h3 className="text-sm font-medium text-white">{runtime.name}</h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-red-500/10 text-red-300 border-red-500/20 ml-auto"
                  >
                    Offline
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs text-white/40 mb-3">
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-white/60 font-mono">{runtime.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Path</span>
                    <span className="text-white/60 font-mono">{runtime.path}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Skills</span>
                    <span className="text-white/60">—</span>
                  </div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-md p-2.5">
                  <p className="text-[11px] text-amber-300/70">
                    ⚠ Runtime bridge: Not configured
                  </p>
                  <p className="text-[10px] text-white/30 mt-1">
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
        <DialogContent className="bg-[#0f0f0f] border-white/[0.06] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isNew ? "New Agent" : "Edit Agent"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs text-white/40 block mb-1">Name</label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.06]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Description</label>
                <Input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.06]"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Model</label>
                <Select
                  value={editing.model}
                  onValueChange={(v) => setEditing({ ...editing, model: v })}
                >
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Default SOP</label>
                <Select
                  value={editing.defaultSopId ?? "none"}
                  onValueChange={(v) => setEditing({ ...editing, defaultSopId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
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
                <label className="text-xs text-white/40 block mb-1">System Prompt</label>
                <Textarea
                  value={editing.systemPrompt}
                  onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
                  className="bg-white/[0.03] border-white/[0.06] resize-none min-h-[100px]"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isNew ? "Create Agent" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent className="bg-[#0f0f0f] border-white/[0.06]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete agent?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will remove the agent configuration. Tasks won&apos;t be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white/70 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
