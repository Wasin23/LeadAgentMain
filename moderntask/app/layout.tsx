import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/AuthContext"
import { getSiteUrl } from "@/lib/site-url"
import { Toaster } from "@/components/ui/toaster"
import { NotificationListener } from "@/components/notification-listener"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Meridian | AI Cold Email and Outbound Lead Generation",
    template: "%s | Meridian",
  },
  description: "Meridian is an AI outbound platform that finds leads, researches accounts, writes personalized cold emails, automates follow-ups, and routes replies back to your real inbox.",
  keywords: [
    "AI cold email",
    "AI outbound sales",
    "lead generation software",
    "cold email automation",
    "personalized outreach",
    "sales prospecting",
  ],
  openGraph: {
    title: "Meridian | AI Cold Email and Outbound Lead Generation",
    description: "Find leads, research accounts, write personalized cold emails, and automate follow-ups from your own inbox.",
    type: "website",
    siteName: "Meridian",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Meridian | AI Cold Email and Outbound Lead Generation",
    description: "AI-powered lead research, personalized outreach, and automated follow-ups from your own inbox.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/MeridianM.png",
        type: "image/png",
      },
    ],
    apple: "/MeridianM.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="tasko-theme">
          <AuthProvider>
            {children}
            <NotificationListener />
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
