"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import {
  ArrowRight, CheckCircle, Mail, Search, Zap, BarChart3,
  ChevronDown, ChevronUp,
  Bot, Building2, Inbox, Clock, XCircle, CheckCircle2,
  Calendar, CheckSquare, Square,
} from "lucide-react"

const SAMPLE_EMAILS = [
  {
    to: "sarah.chen@growthlab.io",
    name: "Sarah Chen",
    company: "GrowthLab",
    title: "VP of Sales, GrowthLab",
    subject: "Re: scaling outbound past 50 reps",
    tag: "Initial Outreach",
    tagColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    rebump: false,
    time: "2m ago",
    body: `Hi Sarah,

Saw GrowthLab just crossed 200 employees on LinkedIn — congrats. Companies at that stage usually hit a wall where the process that worked at 20 reps becomes a bottleneck at 50.

Most teams I talk to are dealing with one of two things: reps spending 60%+ of their time on prospecting instead of selling, or sequences that aren't personal enough to cut through the noise.

Worth a 15-min call to see if either of those resonate?

Best,
Alex`,
    detail: "Researched company headcount growth on LinkedIn, identified Series B stage pattern, matched to common ICP pain point.",
  },
  {
    to: "marcus.j@elevatedmedia.co",
    name: "Marcus Johnson",
    company: "Elevated Media",
    title: "Founder, Elevated Media",
    subject: "Elevated Media + enterprise pipeline",
    tag: "Follow-up · Day 4",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    rebump: true,
    time: "5m ago",
    body: `Hey Marcus,

Circling back from last week. Noticed you posted about landing your first $50K retainer — congrats, that's a real milestone.

Agencies at that turning point usually want more enterprise accounts but don't have a repeatable way to get in front of them. Most end up just hoping referrals come in.

If adding 2-3 enterprise conversations per month is something you're thinking about, happy to show you exactly how.

— Alex`,
    detail: "Detected a public LinkedIn post about a recent client win and referenced it naturally in the follow-up message.",
  },
  {
    to: "priya.k@quantumsales.io",
    name: "Priya Kapoor",
    company: "Quantum Sales",
    title: "Head of Revenue, Quantum Sales",
    subject: "Automating your SDR research workflow",
    tag: "Initial Outreach",
    tagColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    rebump: false,
    time: "11m ago",
    body: `Hi Priya,

Noticed Quantum Sales recently expanded into the mid-market segment — that typically means your SDRs are spending more time on research per account, not less.

We help teams like yours cut that research time by about 80% while keeping the emails personal enough to actually get replies.

Open to a quick look?

Alex`,
    detail: "Cross-referenced company blog post about mid-market expansion with LinkedIn job postings for SDR roles.",
  },
]

const FAQS = [
  {
    q: "Does this actually write unique emails for every lead?",
    a: "Yes. Before writing, Meridian's agent researches the lead's company website, recent news, LinkedIn activity, and funding history. Every email reflects something specific about that person — no merge fields, no templates.",
  },
  {
    q: "What email accounts does it work with?",
    a: "Gmail and Outlook/Microsoft 365, connected via OAuth. Emails send directly from your own inbox — not from a shared sending domain.",
  },
  {
    q: "Will my emails land in spam?",
    a: "Meridian respects sending limits, randomizes send timing, and sends from your real inbox — the same factors that affect any human sender. The approach is as close to human sending as software can get.",
  },
  {
    q: "How long does setup take?",
    a: "Under 10 minutes. Connect your email, describe your ideal customer and what you offer, and the agent starts working.",
  },
  {
    q: "What happens when someone replies?",
    a: "Meridian detects the reply, marks the lead as responded, and stops all follow-ups automatically. From there, it's your conversation.",
  },
  {
    q: "Can I review emails before they send?",
    a: "Yes. Run the agent in review mode where every email needs your approval, or let it run autonomously. Most users start in review mode for a week, build confidence, then switch to auto.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className="font-medium text-foreground">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  )
}

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeEmail, setActiveEmail] = useState(0)

  useEffect(() => {
    if (!loading && user) router.replace("/home")
  }, [user, loading, router])

  if (loading || user) return null

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* Nav */}
      <nav className="sticky top-0 z-50 px-6 sm:px-10 py-4 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="text-foreground">
            <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className="text-lg font-bold tracking-tight">Meridian</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
          <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground transition-colors">How it works</button>
          <button onClick={() => document.getElementById("emails")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground transition-colors">Examples</button>
          <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-foreground transition-colors">Pricing</button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/signin")}>Sign In</Button>
          <Button size="sm" onClick={() => router.push("/signin")}>Get Started Free</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 sm:px-10 py-16 sm:py-24 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 bg-primary/10 rounded-full text-primary font-medium text-xs border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              AI outbound — built for people who hate cold outreach
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 leading-[1.1] tracking-tight">
              One AI agent.<br />
              Does the work of a<br />
              <span className="bg-gradient-to-r from-violet-500 via-pink-500 to-blue-500 bg-clip-text text-transparent">
                5-person SDR team.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg">
              Meridian researches your leads, writes personalized cold emails, handles follow-ups, and surfaces replies — all from your own inbox. No templates. No spray-and-pray.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10">
              <Button size="lg" className="gap-2 text-base px-8 h-12" onClick={() => router.push("/signin")}>
                Start Free — 500 credits included <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No credit card required", "Gmail & Outlook supported", "Sends from your real inbox"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Email queue replica */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
            {/* Queue header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold">Queued Emails</span>
              <span className="px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">{SAMPLE_EMAILS.length}</span>
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 ml-0.5">
                <Clock className="w-2.5 h-2.5" />
                auto-sending Mon–Fri · 9:00 AM
              </span>
              <button className="ml-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground font-medium shrink-0">
                <Calendar className="w-3 h-3" />
                Schedule for Send
              </button>
            </div>

            {/* Email rows */}
            <div className="divide-y divide-border">
              {SAMPLE_EMAILS.map((e, i) => (
                <div
                  key={i}
                  onClick={() => setActiveEmail(activeEmail === i ? -1 : i)}
                  className={`flex gap-3 py-3 px-4 border-l-2 cursor-pointer transition-colors ${
                    activeEmail === i ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/30"
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {activeEmail === i
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-foreground text-xs">{e.name}</span>
                          <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                            <Building2 className="w-2.5 h-2.5" />{e.company}
                          </span>
                        </div>
                        <p className="font-medium text-foreground text-xs truncate">{e.subject}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px]">
                          <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{e.time}</span>
                          <span className="text-muted-foreground flex items-center gap-1"><Bot className="w-2.5 h-2.5" />Alex</span>
                          {e.rebump && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400">Follow-up</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={ev => ev.stopPropagation()}
                          className="h-7 text-[11px] gap-1 bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 rounded-md flex items-center font-medium transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Send
                        </button>
                        <button
                          onClick={ev => ev.stopPropagation()}
                          className="h-7 w-7 p-0 border border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md flex items-center justify-center transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {activeEmail === i && (
                      <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border text-muted-foreground whitespace-pre-wrap leading-relaxed text-[10px] max-h-52 overflow-y-auto">
                        {e.body}
                        <div className="mt-3 pt-3 border-t border-border flex items-start gap-1.5">
                          <Zap className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
                          <span className="italic text-muted-foreground/60">{e.detail}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <div className="border-y border-border bg-muted/20 px-6 sm:px-10 py-5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-center">
          {[
            { n: "500+", l: "Free credits to start" },
            { n: "< 10 min", l: "Setup time" },
            { n: "Gmail + Outlook", l: "Both supported" },
            { n: "100%", l: "Your inbox, your brand" },
          ].map(s => (
            <div key={s.l}>
              <div className="text-xl sm:text-2xl font-bold text-foreground">{s.n}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.l}</div>
            </div>
          ))}
          <div>
            <div className="text-xl sm:text-2xl font-bold text-foreground">17% <span className="text-sm font-semibold text-muted-foreground">vs 1–3%</span></div>
            <div className="text-xs text-muted-foreground mt-0.5">reply rate, personalized vs generic</div>
            <div className="text-[10px] text-muted-foreground/50 mt-0.5">Saleshandy, 100M+ emails analyzed</div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="px-6 sm:px-10 py-20 max-w-5xl mx-auto w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">Set it up once. Let it run.</h2>
          <p className="text-muted-foreground">Three steps between you and a full outbound pipeline.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Describe your ICP",
              desc: "Tell Meridian who you're targeting: industry, company size, job titles, geography. The more specific, the better the leads.",
              icon: Search,
            },
            {
              step: "02",
              title: "AI researches & writes",
              desc: "The agent finds matching companies, digs into each one, and writes a genuinely personal email for every lead — not a template with a name swapped in.",
              icon: Mail,
            },
            {
              step: "03",
              title: "Replies hit your inbox",
              desc: "Interested leads reply directly to you. Meridian auto-handles follow-ups, detects positive replies, and stops sequences the moment someone responds.",
              icon: Zap,
            },
          ].map(({ step, title, desc, icon: Icon }) => (
            <div key={step} className="relative p-7 rounded-2xl border border-border bg-card group hover:border-primary/30 hover:shadow-sm transition-all">
              <div className="text-5xl font-black text-primary/10 group-hover:text-primary/20 transition-colors mb-4 leading-none">{step}</div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Real email examples */}
      <section id="emails" className="px-6 sm:px-10 py-20 bg-muted/20 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-primary/10 rounded-full text-primary font-medium text-xs border border-primary/20">
              Real emails from Meridian
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">This is what it actually writes.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Representative examples of Meridian-generated emails — specific, researched, and human enough that most people can't tell the difference.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {SAMPLE_EMAILS.map((e, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                      {e.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground leading-tight">{e.name}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{e.title}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${e.tagColor}`}>{e.tag}</span>
                </div>
                <div className="p-5">
                  <div className="text-xs font-semibold text-foreground mb-3 pb-3 border-b border-border/50">{e.subject}</div>
                  <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">{e.body}</pre>
                </div>
                <div className="px-5 py-3 border-t border-border bg-muted/10">
                  <div className="text-[10px] text-muted-foreground/70 italic flex items-start gap-1.5">
                    <Zap className="w-3 h-3 mt-0.5 shrink-0 text-primary/50" />
                    <span><strong className="text-primary/70 not-italic">Research used:</strong> {e.detail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 sm:px-10 py-20 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">Everything in one place.</h2>
          <p className="text-muted-foreground">No Zapier glue. No five-tool stack. Just Meridian.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Search,   title: "Deep lead research",          desc: "Pulls company news, LinkedIn signals, funding history, website copy — everything needed to write something real." },
            { icon: Mail,     title: "Personalized by default",     desc: "No templates. Every email is written from scratch based on what the AI found about that specific lead." },
            { icon: Zap,      title: "Automated follow-ups",        desc: "Sequences that adapt. Opens without replies change angle. Cancel any follow-up with one click." },
            { icon: BarChart3,title: "Open, click & reply tracking",desc: "See exactly what's working at the email level, campaign level, or across your whole outbound operation." },
            { icon: Mail,     title: "Gmail + Outlook, natively",   desc: "Connect in 60 seconds via OAuth. Emails go out from your real address — not a shared subdomain." },
            { icon: BarChart3,title: "CRM & calendar built in",     desc: "Track every contact through your pipeline. Calendar sync means booked meetings show up automatically." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-sm transition-all group">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-base font-bold mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 sm:px-10 py-20 bg-muted/20 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">Simple, credit-based pricing.</h2>
            <p className="text-muted-foreground">Pay for what you use. No monthly seat fees, no contracts.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                name: "Free Trial",
                price: "Free",
                sub: "No card required",
                credits: "500 credits included",
                highlight: false,
                cta: "Start Free",
                features: [
                  "500 credits (~10 sequences)",
                  "Gmail or Outlook",
                  "AI lead research",
                  "Personalized email writing",
                  "Open & reply tracking",
                ],
              },
              {
                name: "Starter",
                price: "$500",
                sub: "10,000 credits",
                credits: "~1,000 full sequences",
                highlight: false,
                cta: "Get Started",
                features: [
                  "Everything in Free",
                  "Top-up anytime",
                  "Automated follow-ups",
                  "CRM pipeline",
                  "Email scheduling by timezone",
                  "Priority support",
                ],
              },
              {
                name: "Growth",
                price: "$1,000",
                sub: "20,000 credits",
                credits: "~2,000 full sequences",
                highlight: true,
                cta: "Get Started",
                features: [
                  "Everything in Starter",
                  "Multiple agents",
                  "Calendar integration",
                  "Advanced analytics",
                  "Company intelligence",
                  "Larger top-up packages",
                ],
              },
              {
                name: "Scale",
                price: "$2,500",
                sub: "70,000 credits",
                credits: "~7,000 full sequences",
                highlight: false,
                cta: "Get Started",
                features: [
                  "Everything in Growth",
                  "Unlimited agents",
                  "Dedicated onboarding",
                  "Custom integrations",
                  "SLA support",
                  "Volume discounts",
                ],
              },
            ].map(p => (
              <div key={p.name} className={`rounded-2xl border p-7 flex flex-col transition-all relative ${
                p.highlight ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card"
              }`}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <div className="text-sm font-semibold text-muted-foreground mb-1">{p.name}</div>
                  <div className="text-3xl font-black text-foreground">{p.price}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.sub}</div>
                  <div className="mt-2 text-xs font-medium text-primary">{p.credits}</div>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={p.highlight ? "default" : "outline"} onClick={() => router.push("/signin")}>
                  {p.cta}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            Need custom volume?{" "}
            <button className="text-primary underline-offset-2 hover:underline" onClick={() => router.push("/signin")}>
              Contact us
            </button>{" "}
            for Enterprise pricing.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-10 py-20 max-w-3xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Common questions.</h2>
        </div>
        {FAQS.map((f, i) => <FaqItem key={i} {...f} />)}
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 py-16 bg-muted/20 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">Start with 500 free credits.</h2>
          <p className="text-muted-foreground mb-8">
            No card required. Connect your inbox, set your ICP, and watch the first batch of outreach go out — usually within the hour.
          </p>
          <Button size="lg" className="gap-2 text-base px-10 h-12" onClick={() => router.push("/signin")}>
            Create your free account <ArrowRight className="w-4 h-4" />
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs text-muted-foreground">
            {["No credit card", "Gmail & Outlook", "Cancel anytime", "Sends from your inbox"].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-primary" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" className="text-muted-foreground">
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
          <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  )
}
