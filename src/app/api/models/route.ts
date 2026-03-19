import { NextResponse } from "next/server"

const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
]

const OPENAI_MODELS_FILTER = ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini", "gpt-5"]

async function fetchAnthropicModels() {
  if (!process.env.ANTHROPIC_API_KEY) return ANTHROPIC_MODELS
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    })
    const data = await res.json()
    return (data.data || []).map((m: Record<string, string>) => ({
      id: m.id,
      name: m.display_name || m.id,
      provider: "anthropic",
    }))
  } catch {
    return ANTHROPIC_MODELS
  }
}

async function fetchOpenAIModels() {
  if (!process.env.OPENAI_API_KEY) return []
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    })
    const data = await res.json()
    const chatModels = (data.data || [])
      .filter((m: Record<string, string>) =>
        OPENAI_MODELS_FILTER.some((f) => m.id.includes(f))
      )
      .map((m: Record<string, string>) => ({
        id: m.id,
        name: m.id,
        provider: "openai",
      }))
    return chatModels
  } catch {
    return []
  }
}

export async function GET() {
  const [anthropic, openai] = await Promise.all([
    fetchAnthropicModels(),
    fetchOpenAIModels(),
  ])

  const models = [...anthropic, ...openai]

  const fallback = [
    { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", provider: "anthropic" },
    { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
    { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
    { id: "openai/gpt-4o", name: "GPT-4o", provider: "openai" },
    { id: "openai/o4-mini", name: "o4-mini", provider: "openai" },
    { id: "openai-codex/gpt-5.3-codex", name: "Codex (GPT-5.3)", provider: "openai" },
    { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "google" },
    { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "google" },
  ]

  return NextResponse.json(models.length > 0 ? models : fallback)
}
