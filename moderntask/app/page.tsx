"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import { ArrowRight, Bot, Mail, BarChart3, Zap, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace("/home")
  }, [user, loading, router])

  if (loading || user) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-foreground">
            <ellipse cx="24" cy="24" rx="6"  ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8"  stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="text-lg font-semibold text-foreground">Meridian</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/signin">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/signin">
            <Button size="sm">Get started <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 border border-primary/20">
          <Zap className="w-3 h-3" />
          AI-powered outreach automation
        </div>

        <h1 className="text-5xl font-bold text-foreground max-w-2xl leading-tight mb-5">
          Your AI sales team,<br />on autopilot
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mb-10">
          Meridian deploys intelligent AI agents that research leads, write personalized emails, and follow up automatically so you can focus on closing.
        </p>

        <div className="flex items-center gap-3">
          <Link href="/signin">
            <Button size="lg" className="gap-2">
              Start for free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/signin">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-20 max-w-3xl w-full">
          {[
            { icon: Bot, title: "AI Agents", desc: "Autonomous agents that prospect, research, and outreach on your behalf 24/7." },
            { icon: Mail, title: "Smart Email", desc: "Hyper-personalized emails written by AI, sent at the right time automatically." },
            { icon: BarChart3, title: "Analytics", desc: "Track open rates, replies, and conversions across all your campaigns." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-left p-5 rounded-xl border border-border bg-card">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="flex flex-wrap items-center justify-center gap-5 mt-14 text-sm text-muted-foreground">
          {["No credit card required", "Set up in minutes", "Cancel anytime"].map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-primary" />
              {t}
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Meridian. All rights reserved.
      </footer>
    </div>
  )
}
