"use client"

import { useState, useEffect } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<string>("dark")

  useEffect(() => {
    const saved = localStorage.getItem("daisyui-theme")
    if (saved) setTheme(saved)
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute("data-theme")
      if (current) setTheme(current)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  const sonnerTheme = ["dark", "synthwave", "night", "coffee", "dracula", "business", "halloween", "forest", "black", "luxury", "dim", "abyss", "sunset"].includes(theme) ? "dark" : "light"

  return (
    <Sonner
      theme={sonnerTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--color-base-100)",
          "--normal-text": "var(--color-base-content)",
          "--normal-border": "var(--color-base-300)",
          "--success-bg": "var(--color-success)",
          "--success-text": "var(--color-success-content)",
          "--error-bg": "var(--color-error)",
          "--error-text": "var(--color-error-content)",
          "--warning-bg": "var(--color-warning)",
          "--warning-text": "var(--color-warning-content)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
