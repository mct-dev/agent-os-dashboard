import { Suspense } from "react"
import { AuthSessionProvider } from "@/components/session-provider"

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <Suspense>{children}</Suspense>
    </AuthSessionProvider>
  )
}
