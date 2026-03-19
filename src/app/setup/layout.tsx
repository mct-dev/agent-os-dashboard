import { AuthSessionProvider } from "@/components/session-provider"

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <AuthSessionProvider>{children}</AuthSessionProvider>
}
