"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { LinearIcon } from "@/components/linear-icon"
import { useAppState } from "@/lib/store"

const DAISY_THEMES = [
  "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
  "synthwave", "retro", "cyberpunk", "valentine", "halloween",
  "garden", "forest", "aqua", "lofi", "pastel", "fantasy",
  "wireframe", "black", "luxury", "dracula", "cmyk", "autumn",
  "business", "acid", "lemonade", "night", "coffee", "winter",
  "dim", "nord", "sunset", "caramellatte", "abyss", "silk",
]

const PAGE_OPTIONS = [
  { value: "/board", label: "Board" },
  { value: "/inbox", label: "Inbox" },
  { value: "/projects", label: "Projects" },
  { value: "/sops", label: "SOPs" },
  { value: "/agents", label: "Agents" },
  { value: "/schedule", label: "Schedule" },
  { value: "/settings", label: "Settings" },
]

interface UserSettings {
  bridgeUrl?: string | null
  bridgeApiKey?: string | null
  bridgeName?: string | null
  onboardingComplete?: boolean
  defaultPage?: string | null
  userId?: string
}

type BridgeStatus = "checking" | "connected" | "disconnected" | "not-configured"

export function SettingsPage() {
  const { setLinearConnected } = useAppState()
  const [settings, setSettings] = useState<UserSettings>({})
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>("checking")
  const [showApiKey, setShowApiKey] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editUrl, setEditUrl] = useState("")
  const [editKey, setEditKey] = useState("")
  const [editName, setEditName] = useState("")
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [currentTheme, setCurrentTheme] = useState("dark")
  const [linearStatus, setLinearStatus] = useState<"checking" | "connected" | "disconnected" | "not-configured">("checking")
  const [linearWorkspace, setLinearWorkspace] = useState("")
  const [linearEmail, setLinearEmail] = useState("")
  const [linearKey, setLinearKey] = useState("")
  const [editingLinear, setEditingLinear] = useState(false)
  const [showLinearKey, setShowLinearKey] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('daisyui-theme')
    if (saved) {
      setCurrentTheme(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const checkBridgeStatus = useCallback(async (url?: string | null, key?: string | null) => {
    if (!url) {
      setBridgeStatus("not-configured")
      return
    }
    setBridgeStatus("checking")
    try {
      const res = await fetch("/api/bridge-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl: url, bridgeApiKey: key }),
      })
      const data = await res.json()
      setBridgeStatus(data.ok ? "connected" : "disconnected")
    } catch {
      setBridgeStatus("disconnected")
    }
  }, [])

  async function checkLinearStatus() {
    setLinearStatus("checking")
    try {
      const res = await fetch("/api/linear/status")
      const data = await res.json()
      if (data.connected) {
        setLinearStatus("connected")
        setLinearWorkspace(data.workspace || "")
        setLinearEmail(data.email || "")
      } else {
        setLinearStatus("disconnected")
      }
    } catch {
      setLinearStatus("disconnected")
    }
  }

  useEffect(() => {
    fetch("/api/user-settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data)
        checkBridgeStatus(data.bridgeUrl, data.bridgeApiKey)
        checkLinearStatus()
      })
      .catch(() => {})
  }, [checkBridgeStatus])

  const openEditDialog = () => {
    setEditUrl(settings.bridgeUrl || "")
    setEditKey(settings.bridgeApiKey || "")
    setEditName(settings.bridgeName || "")
    setTestResult(null)
    setEditing(true)
  }

  const testConnection = async () => {
    setTestResult(null)
    try {
      const res = await fetch("/api/bridge-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl: editUrl, bridgeApiKey: editKey }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, error: "Failed to test connection" })
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridgeUrl: editUrl || null,
          bridgeApiKey: editKey || null,
          bridgeName: editName || null,
        }),
      })
      const data = await res.json()
      setSettings(data)
      setEditing(false)
      checkBridgeStatus(data.bridgeUrl, data.bridgeApiKey)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const resetOnboarding = async () => {
    await fetch("/api/user-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingComplete: false }),
    })
    document.cookie = "onboarding-complete=; path=/; max-age=0"
    window.location.href = "/setup"
  }

  const copyApiKey = () => {
    if (settings.bridgeApiKey) {
      navigator.clipboard.writeText(settings.bridgeApiKey)
    }
  }

  async function saveLinearKey() {
    if (!linearKey.trim()) return
    try {
      const res = await fetch("/api/linear/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: linearKey }),
      })
      const data = await res.json()
      if (data.connected) {
        setLinearStatus("connected")
        setLinearWorkspace(data.workspace || "")
        setLinearEmail(data.email || "")
        setEditingLinear(false)
        setLinearConnected(true)
        toast.success("Linear connected")
      } else {
        toast.error("Invalid Linear API key")
      }
    } catch {
      toast.error("Failed to connect Linear")
    }
  }

  const maskedKey = settings.bridgeApiKey
    ? "\u2022".repeat(Math.min(settings.bridgeApiKey.length, 20))
    : "\u2014"

  const statusBadge = {
    checking: <Badge variant="secondary">Checking...</Badge>,
    connected: <Badge className="badge badge-success badge-outline">Connected</Badge>,
    disconnected: <Badge variant="destructive">Disconnected</Badge>,
    "not-configured": <Badge variant="secondary">Not configured</Badge>,
  }

  return (
    <div className="flex flex-col h-screen min-w-0">
      <header className="shrink-0 border-b border-base-300 px-6 py-3">
        <h1 className="text-sm font-semibold text-base-content">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-8">
        {/* Account */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Account
          </h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-base-content/60">Email</Label>
                <p className="text-sm">{settings.userId || "\u2014"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/api/auth/signout"}>
                Sign out
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* Bridge */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Bridge
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-base-content/60 w-16">Status</Label>
              {statusBadge[bridgeStatus]}
            </div>
            <div>
              <Label className="text-xs text-base-content/60">URL</Label>
              <p className="text-sm font-mono">{settings.bridgeUrl || "\u2014"}</p>
            </div>
            <div>
              <Label className="text-xs text-base-content/60">Name</Label>
              <p className="text-sm">{settings.bridgeName || "\u2014"}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs text-base-content/60">API Key</Label>
                <p className="text-sm font-mono">
                  {showApiKey ? settings.bridgeApiKey || "\u2014" : maskedKey}
                </p>
              </div>
              {settings.bridgeApiKey && (
                <div className="flex gap-1 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? "hide" : "show"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={copyApiKey}
                  >
                    copy
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                Edit Bridge Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkBridgeStatus(settings.bridgeUrl, settings.bridgeApiKey)}
                disabled={bridgeStatus === "checking"}
              >
                Test Connection
              </Button>
            </div>
          </div>

          <Separator className="my-2" />

          <div className="bg-base-200/30 border border-dashed border-base-300 rounded-lg p-4 text-center">
            <Button variant="ghost" size="sm" disabled>
              + Add Bridge
            </Button>
            <p className="text-[10px] text-base-content/60 mt-1">
              Multi-bridge support coming soon
            </p>
          </div>
        </section>

        <Separator />

        {/* Linear Integration */}
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body gap-4">
            <div className="flex items-center gap-2">
              <LinearIcon size={20} />
              <h2 className="card-title text-sm">Linear</h2>
              {linearStatus === "connected" && (
                <span className="badge badge-success badge-xs ml-1">Connected</span>
              )}
              {linearStatus === "disconnected" && (
                <span className="badge badge-error badge-xs ml-1">Not Connected</span>
              )}
              {linearStatus === "checking" && (
                <span className="badge badge-ghost badge-xs ml-1">Checking...</span>
              )}
            </div>

            {linearStatus === "connected" && !editingLinear ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-base-content/60">
                    Workspace: <span className="text-base-content/80 font-medium">{linearWorkspace}</span>
                    {linearEmail && <> · {linearEmail}</>}
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingLinear(true)}>
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type={showLinearKey ? "text" : "password"}
                      className="input input-bordered input-sm flex-1 font-mono"
                      placeholder="lin_api_..."
                      value={linearKey}
                      onChange={(e) => setLinearKey(e.target.value)}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowLinearKey(!showLinearKey)}
                    >
                      {showLinearKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-xs text-base-content/50 mt-1">
                    Create at Linear → Settings → API → Personal API keys
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={saveLinearKey}>
                    Connect
                  </button>
                  {editingLinear && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingLinear(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Theme Selector */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            Appearance
          </h2>
          <div className="flex items-center gap-4">
            <label className="text-sm shrink-0">Theme</label>
            <select
              className="select select-bordered select-sm w-full max-w-xs"
              value={currentTheme}
              onChange={(e) => {
                const theme = e.target.value;
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('daisyui-theme', theme);
                setCurrentTheme(theme);
              }}
            >
              {DAISY_THEMES.map((theme) => (
                <option key={theme} value={theme}>{theme}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm shrink-0">Default page</label>
            <select
              className="select select-bordered select-sm w-full max-w-xs"
              value={settings.defaultPage || "/board"}
              onChange={async (e) => {
                const defaultPage = e.target.value
                const prev = settings.defaultPage
                setSettings((s) => ({ ...s, defaultPage }))
                try {
                  await fetch("/api/user-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ defaultPage }),
                  })
                } catch {
                  setSettings((s) => ({ ...s, defaultPage: prev }))
                }
              }}
            >
              {PAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </section>

        <Separator />

        {/* Danger Zone */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            Danger Zone
          </h2>
          <Button variant="destructive" size="sm" onClick={resetOnboarding}>
            Reset Onboarding
          </Button>
          <p className="text-[10px] text-base-content/60">
            This will reset your onboarding status and redirect you to the setup wizard.
          </p>
        </section>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={(open) => { if (!open) setEditing(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Bridge Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-url">Bridge URL</Label>
              <Input
                id="edit-url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://your-machine.ts.net"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-key">API Key</Label>
              <Input
                id="edit-key"
                type="password"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder="Your bridge API key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Work MacBook"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={testConnection} disabled={!editUrl}>
                Test Connection
              </Button>
              {testResult && (
                <Badge variant={testResult.ok ? "default" : "destructive"}>
                  {testResult.ok ? "Connected" : `${testResult.error}`}
                </Badge>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
