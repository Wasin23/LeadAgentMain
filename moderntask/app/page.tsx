"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Rocket, BarChart3, Mail, Search, Zap, CheckCircle } from "lucide-react"

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace("/home")
  }, [user, loading, router])

  if (loading || user) return null

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* Nav */}
      <nav className="px-6 sm:px-10 py-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 48 48" fill="none" className="text-foreground">
            <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="text-xl font-bold">Meridian</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/signin")}>Sign In</Button>
          <Button onClick={() => router.push("/signin")}>Start Free Trial</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-block mb-5 px-4 py-1.5 bg-primary/10 rounded-full text-primary font-medium text-sm border border-primary/20">
          ✨ AI-Powered Lead Generation
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-5 leading-tight max-w-4xl">
          Find Your Perfect Leads<br />
          <span className="bg-gradient-to-r from-violet-500 via-pink-500 to-blue-500 bg-clip-text text-transparent">
            On Autopilot
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl">
          Meridian uses advanced AI to research, qualify, and reach out to your ideal customers automatically.
          Spend less time prospecting, more time closing deals.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-16">
          <Button size="lg" className="gap-2 text-base px-8" onClick={() => router.push("/signin")}>
            Start Now <ArrowRight className="w-5 h-5" />
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
            Learn More
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 sm:gap-16 max-w-lg w-full">
          {[
            { number: "10x", label: "Faster Prospecting" },
            { number: "85%", label: "Time Saved" },
            { number: "3x",  label: "More Qualified Leads" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-foreground">{s.number}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 sm:px-10 py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">Everything You Need to Scale</h2>
            <p className="text-lg text-muted-foreground">Powerful features to automate your entire outbound process</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Search,   title: "AI Lead Research",      desc: "Find companies that perfectly match your ICP using advanced web search and data enrichment." },
              { icon: Sparkles, title: "Smart Qualification",   desc: "AI analyzes each lead against your criteria and scores them for quality and fit." },
              { icon: Mail,     title: "Personalized Outreach", desc: "Generate highly personalized emails that get responses using GPT-4 intelligence." },
              { icon: BarChart3,title: "Real-Time Analytics",   desc: "Track opens, clicks, and replies with comprehensive email tracking and reporting." },
              { icon: Zap,      title: "Automated Follow-ups",  desc: "AI agents handle follow-up sequences automatically based on lead engagement." },
              { icon: Rocket,   title: "Scale Infinitely",      desc: "Run multiple campaigns simultaneously with different targeting and messaging." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-7 rounded-2xl border border-border bg-card hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 sm:px-10 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">How Meridian Works</h2>
            <p className="text-lg text-muted-foreground">Set it up once, let AI do the rest</p>
          </div>

          <div className="space-y-5">
            {[
              { step: "1", title: "Define Your Ideal Customer",    desc: "Tell us about your target market, industry, company size, and pain points you solve." },
              { step: "2", title: "AI Finds & Qualifies Leads",    desc: "Our AI agents search the web, enrich data, and qualify leads based on your criteria." },
              { step: "3", title: "Personalized Outreach",         desc: "GPT-4 crafts unique, personalized emails for each lead based on deep research." },
              { step: "4", title: "Track & Optimize",              desc: "Monitor performance in real-time and let AI optimize your campaigns automatically." },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-5 p-6 rounded-2xl border border-border bg-card hover:shadow-sm transition-shadow">
                <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-violet-500 to-pink-500">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{s.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-20 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center p-10 sm:p-16 rounded-3xl border border-border bg-card shadow-sm">
          <h2 className="text-3xl sm:text-5xl font-bold mb-5">Ready to Scale Your Outbound?</h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join companies using AI to generate qualified leads on autopilot.
          </p>
          <Button size="lg" className="gap-2 text-base px-10" onClick={() => router.push("/signin")}>
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-5 mt-8 text-sm text-muted-foreground">
            {["No credit card required", "Set up in minutes", "Cancel anytime"].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none" className="text-muted-foreground">
            <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          © {new Date().getFullYear()} Meridian. All rights reserved.
        </div>
        <div className="flex gap-5">
          <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
        </div>
      </footer>
    </div>
  )
}
