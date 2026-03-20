import { getServerSession } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }: { profile?: { email?: string } }) {
      return profile?.email === "mike@laurel.ai" || profile?.email === "axis139@gmail.com"
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
}

export async function getSession() {
  return getServerSession(authOptions)
}
