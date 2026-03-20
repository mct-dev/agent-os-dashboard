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
    <html lang="en" data-theme="dark">
      <script dangerouslySetInnerHTML={{
        __html: `
          try {
            const theme = localStorage.getItem('daisyui-theme');
            if (theme) document.documentElement.setAttribute('data-theme', theme);
          } catch(e) {}
        `
      }} />
      <body className="antialiased min-h-screen bg-base-100 text-base-content font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
