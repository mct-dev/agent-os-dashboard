"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
            // Already onboarded — set cookie and redirect
            document.cookie = "onboarding-complete=true; path=/; max-age=31536000"
            router.push("/")
            return
          }
          if (data.bridgeUrl) setBridgeUrl(data.bridgeUrl)
          if (data.bridgeApiKey) setBridgeApiKey(data.bridgeApiKey)
          if (data.bridgeName) setBridgeName(data.bridgeName)
        })
        .catch(() => {})
    }
  }, [session, router])

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
      router.push("/")
    } catch {
      router.push("/")
    } finally {
      setSaving(false)
    }
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="space-y-2">
            <span className="text-4xl">⚡</span>
            <h1 className="text-2xl font-bold tracking-tight">Agent OS</h1>
          </div>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Welcome to Agent OS</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Step 1 of 3
            </p>
            <h2 className="text-lg font-semibold">Authentication</h2>
          </div>
          <Separator />
          {sessionStatus === "loading" ? (
            <p className="text-sm text-muted-foreground">Checking session...</p>
          ) : session?.user?.email ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span className="text-sm">
                  Signed in as{" "}
                  <span className="font-medium">{session.user.email}</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;re authenticated. Agent OS uses Google OAuth to secure
                your dashboard.
              </p>
              <Button className="w-full" onClick={() => setStep(2)}>
                Continue →
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Step 2 of 3
            </p>
            <h2 className="text-lg font-semibold">Local Bridge</h2>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
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
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              Setup Instructions
            </summary>
            <div className="mt-3 space-y-2 text-muted-foreground text-xs font-mono bg-muted/50 rounded-md p-4">
              <p>1. Navigate to the bridge directory:</p>
              <p className="pl-4 text-foreground/80">cd bridge && ./install.sh</p>
              <p className="mt-2">2. Start the bridge:</p>
              <p className="pl-4 text-foreground/80">npm start</p>
              <p className="mt-2">3. Expose via Tailscale:</p>
              <p className="pl-4 text-foreground/80">
                tailscale serve --bg http://127.0.0.1:4242
              </p>
              <p className="mt-2">4. Your bridge URL will be:</p>
              <p className="pl-4 text-foreground/80">
                https://&lt;machine-name&gt;.&lt;tailnet&gt;.ts.net
              </p>
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
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
