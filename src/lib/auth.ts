import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// On Vercel preview deployments, route OAuth callbacks through the production
// URL so only one redirect URI needs to be registered with Google.
// The production deployment acts as a proxy: it receives the Google callback,
// then redirects back to the preview URL with the auth code.
// Both environments must share the same NEXTAUTH_SECRET for state decryption.
const isVercelPreview = process.env.VERCEL_ENV === "preview"
const productionOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined
const redirectProxyUrl =
  isVercelPreview && productionOrigin
    ? `${productionOrigin}/api/auth`
    : undefined

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      const email = user?.email ?? profile?.email
      return email === "mike@laurel.ai" || email === "axis139@gmail.com"
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (token?.email) {
        session.user.email = token.email as string
      }
      return session
    },
  },
  redirectProxyUrl,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
})
