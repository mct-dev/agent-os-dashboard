"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type ConnectionStatus = "idle" | "testing" | "connected" | "failed"

export default function SetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  const [step, setStep] = useState(0)
  const [bridgeUrl, setBridgeUrl] = useState("")
  const [bridgeApiKey, setBridgeApiKey] = useState("")
  const [bridgeName, setBridgeName] = useState("")
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle")
  const [connectionError, setConnectionError] = useState("")
  const [saving, setSaving] = useState(false)

  // Load existing settings and check if already onboarded
  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/user-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.onboardingComplete) {
            document.cookie = "onboarding-complete=true; path=/; max-age=31536000"
            const callbackUrl = searchParams.get("callbackUrl")
            const destination = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
              ? callbackUrl
              : "/"
            router.push(destination)
            return
          }
          if (data.bridgeUrl) setBridgeUrl(data.bridgeUrl)
          if (data.bridgeApiKey) setBridgeApiKey(data.bridgeApiKey)
          if (data.bridgeName) setBridgeName(data.bridgeName)
        })
        .catch(() => {})
    }
  }, [session, router, searchParams])

  const testConnection = async () => {
    setConnectionStatus("testing")
    setConnectionError("")
    try {
      const res = await fetch("/api/bridge-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bridgeUrl, bridgeApiKey }),
      })
      const data = await res.json()
      if (data.ok) {
        setConnectionStatus("connected")
      } else {
        setConnectionStatus("failed")
        setConnectionError(data.error || "Connection failed")
      }
    } catch {
      setConnectionStatus("failed")
      setConnectionError("Failed to test connection")
    }
  }

  const saveAndContinue = async () => {
    setSaving(true)
    try {
      await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridgeUrl: bridgeUrl || null,
          bridgeApiKey: bridgeApiKey || null,
          bridgeName: bridgeName || null,
          onboardingComplete: false,
        }),
      })
      setStep(3)
    } catch {
      // Continue anyway
      setStep(3)
    } finally {
      setSaving(false)
    }
  }

  const completeOnboarding = async () => {
    setSaving(true)
    try {
      await fetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      })
      document.cookie = "onboarding-complete=true; path=/; max-age=31536000"
      // Redirect to callbackUrl if it's a valid relative path, otherwise home
      const callbackUrl = searchParams.get("callbackUrl")
      const destination = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
        ? callbackUrl
        : "/"
      router.push(destination)
    } catch {
      router.push("/")
    } finally {
      setSaving(false)
    }
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="space-y-2">
            <span className="text-4xl">⚡</span>
            <h1 className="text-2xl font-bold tracking-tight">Agent OS</h1>
          </div>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Welcome to Agent OS</h2>
            <p className="text-sm text-base-content/60 leading-relaxed">
              Your personal AI agent dashboard. Run Claude Code and Codex against
              any task, watch output live, and manage everything from one place.
            </p>
          </div>
          <Button className="w-full" size="lg" onClick={() => setStep(1)}>
            Get Started →
          </Button>
        </Card>
      </div>
    )
  }

  // Step 1: Auth
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs text-base-content/60 uppercase tracking-wider">
              Step 1 of 3
            </p>
            <h2 className="text-lg font-semibold">Authentication</h2>
          </div>
          <Separator />
          {sessionStatus === "loading" ? (
            <p className="text-sm text-base-content/60">Checking session...</p>
          ) : session?.user?.email ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span className="text-sm">
                  Signed in as{" "}
                  <span className="font-medium">{session.user.email}</span>
                </span>
              </div>
              <p className="text-sm text-base-content/60">
                You&apos;re authenticated. Agent OS uses Google OAuth to secure
                your dashboard.
              </p>
              <Button className="w-full" onClick={() => setStep(2)}>
                Continue →
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-base-content/60">
                Sign in with Google to get started.
              </p>
              <Button className="w-full" onClick={() => signIn("google")}>
                Sign in with Google
              </Button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // Step 2: Bridge setup
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
        <Card className="w-full max-w-lg p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs text-base-content/60 uppercase tracking-wider">
              Step 2 of 3
            </p>
            <h2 className="text-lg font-semibold">Local Bridge</h2>
          </div>
          <Separator />
          <p className="text-sm text-base-content/60">
            The bridge runs on your Mac and executes Claude Code and Codex
            sessions on your behalf.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bridgeUrl">Bridge URL</Label>
              <Input
                id="bridgeUrl"
                placeholder="https://your-machine.ts.net"
                value={bridgeUrl}
                onChange={(e) => {
                  setBridgeUrl(e.target.value)
                  setConnectionStatus("idle")
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bridgeApiKey">API Key</Label>
              <Input
                id="bridgeApiKey"
                type="password"
                placeholder="Your bridge API key"
                value={bridgeApiKey}
                onChange={(e) => {
                  setBridgeApiKey(e.target.value)
                  setConnectionStatus("idle")
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bridgeName">Name</Label>
              <Input
                id="bridgeName"
                placeholder="Work MacBook"
                value={bridgeName}
                onChange={(e) => setBridgeName(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={!bridgeUrl || connectionStatus === "testing"}
              >
                {connectionStatus === "testing" ? (
                  <span className="animate-pulse">Testing...</span>
                ) : (
                  "Test Connection"
                )}
              </Button>
              {connectionStatus === "connected" && (
                <Badge variant="default" className="bg-green-600">
                  ✅ Connected
                </Badge>
              )}
              {connectionStatus === "failed" && (
                <Badge variant="destructive">❌ {connectionError}</Badge>
              )}
            </div>
          </div>

          <Separator />

          <details className="text-sm">
            <summary className="cursor-pointer text-base-content/60 hover:text-base-content transition-colors">
              Setup Instructions
            </summary>
            <div className="mt-3 space-y-3 text-base-content/60 text-xs font-mono bg-base-200/50 rounded-md p-4">
              <p className="text-base-content/60 not-italic font-sans text-xs">Run these commands on the Mac you want agents to run on:</p>
              <div>
                <p className="text-base-content/50">1. Clone the repo</p>
                <p className="pl-4 text-base-content/80 mt-1">git clone https://github.com/mct-dev/agent-os-dashboard.git ~/agent-os</p>
              </div>
              <div>
                <p className="text-base-content/50">2. Install the bridge (this generates your API key)</p>
                <p className="pl-4 text-base-content/80 mt-1">cd ~/agent-os/bridge && bash install.sh</p>
                <p className="pl-4 text-base-content/60 mt-1"># install.sh will print your API key — copy it and paste it above</p>
                <p className="pl-4 text-base-content/60 mt-1"># Or run: cat ~/agent-os/bridge/.env | grep BRIDGE_API_KEY</p>
              </div>
              <div>
                <p className="text-base-content/50">3. Install Claude Code (optional but recommended)</p>
                <p className="pl-4 text-base-content/80 mt-1">npm install -g @anthropic-ai/claude-code</p>
              </div>
              <div>
                <p className="text-base-content/50">4. Enable scheduled jobs (optional)</p>
                <p className="pl-4 text-base-content/60 mt-1"># Add to ~/agent-os/bridge/.env:</p>
                <p className="pl-4 text-base-content/80 mt-1">DASHBOARD_URL=https://your-vercel-app.vercel.app</p>
                <p className="pl-4 text-base-content/80">CRON_SECRET=your-secret-here</p>
                <p className="pl-4 text-base-content/60 mt-1"># The bridge polls the dashboard to run scheduled jobs</p>
              </div>
              <div>
                <p className="text-base-content/50">5. Start the bridge</p>
                <p className="pl-4 text-base-content/80 mt-1">cd ~/agent-os/bridge && npm start</p>
              </div>
              <div>
                <p className="text-base-content/50">6. Expose via Tailscale Funnel (required — allows the web app to reach your bridge)</p>
                <p className="pl-4 text-base-content/80 mt-1">tailscale funnel 4242</p>
                <p className="pl-4 text-base-content/60 mt-1"># This makes your bridge reachable from the internet, not just your local network</p>
                <p className="pl-4 text-base-content/60 mt-1"># Note: requires Tailscale installed via Homebrew (not App Store) on macOS</p>
              </div>
              <div>
                <p className="text-base-content/50">7. Get your bridge URL</p>
                <p className="pl-4 text-base-content/80 mt-1">tailscale status --self --json | python3 -c &quot;import json,sys; d=json.load(sys.stdin); print(&apos;https://&apos;+d[&apos;Self&apos;][&apos;DNSName&apos;].rstrip(&apos;.&apos;))&quot;</p>
                <p className="pl-4 text-base-content/60 mt-1"># Paste this URL into the Bridge URL field above</p>
              </div>
            </div>
          </details>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>
              Skip for now
            </Button>
            <Button onClick={saveAndContinue} disabled={saving}>
              {saving ? "Saving..." : "Save & Continue →"}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Step 3: Done
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs text-base-content/60 uppercase tracking-wider">
            Step 3 of 3
          </p>
          <h2 className="text-lg font-semibold">All Set</h2>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500">✅</span>
            <span className="text-sm">Authentication</span>
          </div>
          <div className="flex items-center gap-2">
            {bridgeUrl && connectionStatus === "connected" ? (
              <span className="text-green-500">✅</span>
            ) : (
              <span className="text-amber-500">⚠️</span>
            )}
            <span className="text-sm">
              {bridgeUrl && connectionStatus === "connected"
                ? "Bridge Connected"
                : "Bridge not configured"}
            </span>
          </div>
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={completeOnboarding}
          disabled={saving}
        >
          {saving ? "Setting up..." : "Open Dashboard →"}
        </Button>
      </Card>
    </div>
  )
}
