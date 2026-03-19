import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Agent OS",
  description: "Task board + AI agent pipeline runner",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
