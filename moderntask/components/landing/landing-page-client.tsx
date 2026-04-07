"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  Mail,
  Search,
  Square,
  Target,
  Users,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react"

const SAMPLE_EMAILS = [
  {
    to: "nina@stitchops.com",
    name: "Nina Patel",
    company: "StitchOps",
    title: "VP of Finance, StitchOps",
    subject: "Cutting month-end close work at StitchOps",
    tag: "AP automation SaaS",
    time: "9:12 AM",
    rebump: false,
    body: `Hi Nina,

Saw StitchOps is adding controllers and senior accountants while expanding to multiple warehouse locations. That usually means month-end is getting heavier at the exact moment leaders want faster reporting.

We built LedgerFlow to automate invoice capture, three-way matching, and approval routing for inventory-heavy finance teams. Instead of closing the books around email threads and spreadsheets, AP exceptions get flagged automatically and pushed to the right approver.

Teams similar to yours usually start because they want fewer manual touches per invoice and cleaner accrual data before close.

If reducing AP cleanup before month-end is on your list this quarter, happy to show you a 15-minute walkthrough.

Best,
Alex`,
    detail: "Specific product pitch: AP automation for multi-location operators, tied to hiring signals and close-process pain.",
  },
  {
    to: "marco@northshorehealth.io",
    name: "Marco Ruiz",
    company: "Northshore Health",
    title: "Director of IT, Northshore Health",
    subject: "Automating SOC 2 evidence instead of chasing screenshots",
    tag: "Security compliance platform",
    time: "11:08 AM",
    rebump: true,
    body: `Hi Marco,

Circling back because I noticed Northshore Health is hiring across infrastructure and security ops. When teams grow that way, SOC 2 and vendor reviews usually start eating engineering time.

Our product, Prooflayer, automates evidence collection across Okta, Google Workspace, GitHub, AWS, and endpoint tooling so your team is not manually pulling screenshots every audit cycle. It also keeps control owners on a schedule instead of turning compliance into a once-a-quarter fire drill.

Most healthcare IT teams we speak with do not need another policy folder. They need fewer manual evidence requests and faster answers for prospects asking security questions during procurement.

Would it be unreasonable to compare your current workflow to what an automated setup would look like?

Alex`,
    detail: "Concrete compliance product, clear integrations, and a realistic objection-aware close.",
  },
  {
    to: "jade@fleetgrid.ai",
    name: "Jade Morris",
    company: "FleetGrid",
    title: "Head of Revenue, FleetGrid",
    subject: "More qualified demos for FleetGrid's route optimization platform",
    tag: "Revenue ops software",
    time: "2:37 PM",
    rebump: false,
    body: `Hi Jade,

Looked through FleetGrid's site and saw the focus on route optimization for field service teams. The value is clear, but products like yours usually have a long sales cycle because ops leaders need a strong business case before switching dispatch workflows.

We help revenue teams selling complex software by turning product value into account-specific outbound. Meridian researches each company, spots triggers like expansion, technician hiring, or new service regions, and writes messaging around the exact bottleneck your product solves.

For a platform like FleetGrid, that means outbound that speaks to overtime, missed windows, dispatch efficiency, and route density instead of generic "increase productivity" copy.

If you want, I can show you how we would build a campaign specifically for field service operators.

Best,
Alex`,
    detail: "Uses the prospect's actual product and translates it into outbound angles tied to operational metrics.",
  },
]

const FAQS = [
  {
    q: "What is Meridian exactly?",
    a: "Meridian is AI cold email software for B2B teams. It finds leads, researches accounts, writes personalized outreach, schedules follow-ups, tracks replies, and routes conversations back to your real inbox.",
  },
  {
    q: "Does Meridian use templates or write real personalized emails?",
    a: "Meridian writes each email from account research, company signals, hiring activity, website copy, and other lead context. The point is not to spin one template a thousand ways. The point is to produce emails that sound like a sharp rep did the homework.",
  },
  {
    q: "Who is this best for?",
    a: "Meridian works best for B2B SaaS, agencies, recruiting firms, consultants, and services businesses that need outbound volume without sounding automated.",
  },
  {
    q: "Can I approve emails before they send?",
    a: "Yes. You can run Meridian in review mode, approve everything manually, or let it send automatically once you trust the workflow.",
  },
  {
    q: "Does it work with Gmail and Outlook?",
    a: "Yes. Meridian connects to Gmail and Outlook through OAuth and sends from your real inbox, not a shared sending domain.",
  },
  {
    q: "What happens when a lead replies?",
    a: "Meridian detects the reply, stops follow-ups automatically, and keeps the message visible in both Sent and Replies so nothing disappears from the workflow.",
  },
]

const USE_CASES = [
  {
    title: "B2B SaaS",
    desc: "Prospect by trigger events, hiring patterns, funding, and product-fit signals instead of static lead lists.",
    icon: Target,
  },
  {
    title: "Agencies",
    desc: "Pitch retainers with account-specific context and send follow-ups without turning founders into full-time SDRs.",
    icon: Workflow,
  },
  {
    title: "Recruiting teams",
    desc: "Open conversations with hiring managers using role growth, hiring spikes, and department changes as the hook.",
    icon: Users,
  },
  {
    title: "Consulting and services",
    desc: "Reach ideal clients with sharper positioning, better personalization, and reply tracking tied to your pipeline.",
    icon: BarChart3,
  },
]

const FEATURE_PILLARS = [
  {
    icon: Search,
    title: "Lead research before writing",
    desc: "Meridian pulls company, role, and market context first so the email has a reason to exist.",
  },
  {
    icon: Mail,
    title: "Personalized cold email generation",
    desc: "Every draft is written from the research. No mail merge voice. No fake personalization tokens.",
  },
  {
    icon: Zap,
    title: "Automated follow-ups",
    desc: "Set the cadence once. Meridian handles rebump timing and stops the sequence when a reply lands.",
  },
  {
    icon: Inbox,
    title: "Replies back in your inbox",
    desc: "Messages send from your real mailbox and conversations come back to the same place your team already works.",
  },
  {
    icon: Calendar,
    title: "CRM and calendar workflow",
    desc: "Track outreach, push contacts through the pipeline, and sync booked meetings without extra glue tools.",
  },
  {
    icon: BarChart3,
    title: "Open, click, and reply tracking",
    desc: "See which campaigns, angles, and accounts are driving actual conversations.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="font-medium text-foreground">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  )
}

export function LandingPageClient() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeEmail, setActiveEmail] = useState(0)

  useEffect(() => {
    if (user) {
      router.replace("/home")
    }
  }, [router, user])

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 px-6 py-4 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="text-foreground">
              <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-lg font-bold tracking-tight">Meridian</span>
          </Link>

          <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-foreground">How it works</button>
            <button onClick={() => document.getElementById("emails")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-foreground">Examples</button>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-foreground">Pricing</button>
            <button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })} className="transition-colors hover:text-foreground">FAQ</button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signin">Start Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative px-6 py-18 sm:px-10 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(7,89,133,0.16),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(16,185,129,0.14),transparent_28%),linear-gradient(180deg,rgba(250,250,249,1),rgba(248,250,252,1))]" />
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              AI cold email software for B2B outbound teams
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              AI cold email software that researches leads, writes personalized outreach, and books replies in your inbox.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Meridian is built for agencies, SaaS teams, recruiters, and service businesses that need real outbound. It finds accounts, researches the company, writes account-specific cold emails, schedules follow-ups, and tracks replies without turning your team into spreadsheet operators.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="h-12 gap-2 px-8 text-base" asChild>
                <Link href="/signin">
                  Start Free with 250 Credits <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={() => document.getElementById("emails")?.scrollIntoView({ behavior: "smooth" })}>
                See Email Examples
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[
                "250 free credits",
                "No credit card required",
                "Gmail and Outlook supported",
                "Sends from your real inbox",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/5">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <Inbox className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold">Queued Emails</span>
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{SAMPLE_EMAILS.length}</span>
              <span className="ml-1 hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary sm:flex">
                <Clock className="h-2.5 w-2.5" />
                Mon-Fri send windows
              </span>
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                review or auto-send
              </div>
            </div>

            <div className="divide-y divide-border">
              {SAMPLE_EMAILS.map((email, index) => (
                <div
                  key={email.subject}
                  onClick={() => setActiveEmail(activeEmail === index ? -1 : index)}
                  className={`flex cursor-pointer gap-3 border-l-2 px-4 py-3 transition-colors ${
                    activeEmail === index ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/30"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {activeEmail === index ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{email.name}</span>
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {email.company}
                          </span>
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {email.tag}
                          </span>
                        </div>
                        <p className="truncate text-xs font-medium text-foreground">{email.subject}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {email.time}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Bot className="h-2.5 w-2.5" />
                            Meridian draft
                          </span>
                          {email.rebump && (
                            <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-500">
                              Follow-up
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={(event) => event.stopPropagation()}
                          className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Send
                        </button>
                        <button
                          onClick={(event) => event.stopPropagation()}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 p-0 text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {activeEmail === index && (
                      <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                        <div className="whitespace-pre-wrap">{email.body}</div>
                        <div className="mt-3 flex items-start gap-1.5 border-t border-border pt-3">
                          <Zap className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                          <span className="text-[11px] italic text-muted-foreground/70">{email.detail}</span>
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

      <section className="border-y border-border bg-muted/20 px-6 py-5 sm:px-10">
        <div className="mx-auto grid max-w-6xl gap-6 text-center sm:grid-cols-2 lg:grid-cols-5">
          {[
            { value: "250", label: "free credits to start" },
            { value: "< 10 min", label: "typical setup time" },
            { value: "Gmail + Outlook", label: "native inbox support" },
            { value: "Review or auto", label: "sending workflow" },
            { value: "Replies tracked", label: "without losing sent history" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10" id="how">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How Meridian handles outbound from start to reply.</h2>
            <p className="mt-3 text-muted-foreground">A simple workflow built for teams that need personalization, volume, and visibility at the same time.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Define your ICP",
                desc: "Choose industries, company sizes, titles, geographies, and product-fit filters so the agent knows who belongs in the funnel.",
                icon: Target,
              },
              {
                step: "02",
                title: "Research and write",
                desc: "Meridian pulls lead context, company signals, and website details, then writes a cold email around the actual problem your offer solves.",
                icon: Search,
              },
              {
                step: "03",
                title: "Send, track, and stop on reply",
                desc: "Messages go out on schedule, follow-ups run automatically, and the sequence stops the moment a prospect responds.",
                icon: Workflow,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="rounded-2xl border border-border bg-card p-7 transition-all hover:border-primary/30 hover:shadow-sm">
                <div className="mb-4 text-5xl font-black leading-none text-primary/10">{step}</div>
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/20 px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for teams selling real products to specific buyers.</h2>
            <p className="mt-3 text-muted-foreground">
              Meridian works best when your offer is real, your buyer is specific, and your team wants outbound that sounds informed instead of machine-generated.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {USE_CASES.map(({ title, desc, icon: Icon }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mb-2 text-base font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10" id="emails">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              Realistic outbound examples
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Emails your team would actually send.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              These examples are grounded in a specific product, a specific buyer, and a specific operational problem. That is the standard Meridian is built around.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {SAMPLE_EMAILS.map((email) => (
              <div key={email.subject} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
                  <div>
                    <div className="text-xs font-semibold text-foreground">{email.name}</div>
                    <div className="text-[10px] text-muted-foreground">{email.title}</div>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {email.tag}
                  </span>
                </div>
                <div className="p-5">
                  <div className="mb-3 border-b border-border/50 pb-3 text-xs font-semibold text-foreground">{email.subject}</div>
                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">{email.body}</pre>
                </div>
                <div className="border-t border-border bg-muted/10 px-5 py-3 text-[10px] text-muted-foreground/75">
                  <strong className="text-primary/70">Why it works:</strong> {email.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/20 px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What Meridian automates.</h2>
            <p className="mt-3 text-muted-foreground">Everything needed to run AI-assisted outbound without duct-taping together five different tools.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_PILLARS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/20 hover:shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mb-2 text-base font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10" id="pricing">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple credit-based pricing.</h2>
            <p className="mt-3 text-muted-foreground">Start free, validate the workflow, then scale up without seat-count games.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                name: "Free Trial",
                price: "Free",
                sub: "250 credits included",
                credits: "1 agent, up to 5x concurrency",
                highlight: false,
                cta: "Start Free",
                features: [
                  "250 free credits",
                  "Gmail or Outlook",
                  "AI lead research",
                  "Personalized email writing",
                  "Open and reply tracking",
                  "1 agent included",
                ],
              },
              {
                name: "Basic",
                price: "$100",
                sub: "1,200 credits",
                credits: "Up to 3 agents, 5x concurrency",
                highlight: false,
                cta: "Get Started",
                features: [
                  "Everything in Free",
                  "1,200 credits included",
                  "Up to 3 agents",
                  "Up to 5x concurrency",
                  "Automated follow-ups",
                  "CRM pipeline",
                ],
              },
              {
                name: "Starter",
                price: "$500",
                sub: "13,000 credits",
                credits: "Up to 5 agents, 10x concurrency",
                highlight: false,
                cta: "Get Started",
                features: [
                  "Everything in Basic",
                  "13,000 credits included",
                  "Up to 5 agents",
                  "Up to 10x concurrency",
                  "Timezone-aware sending",
                  "Company intelligence",
                ],
              },
              {
                name: "Professional",
                price: "$1,000",
                sub: "30,000 credits",
                credits: "Up to 10 agents, 20x concurrency",
                highlight: true,
                cta: "Get Started",
                features: [
                  "Everything in Starter",
                  "30,000 credits included",
                  "Up to 10 agents",
                  "Up to 20x concurrency",
                  "Calendar integration",
                  "Advanced analytics",
                ],
              },
              {
                name: "Enterprise",
                price: "$2,500",
                sub: "70,000 credits",
                credits: "Up to 30 agents, 30x concurrency",
                highlight: false,
                cta: "Talk to Sales",
                features: [
                  "Everything in Professional",
                  "70,000 credits included",
                  "Up to 30 agents",
                  "Up to 30x concurrency",
                  "Dedicated onboarding",
                  "Priority support",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                  plan.highlight ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold whitespace-nowrap text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <div className="mb-1 text-sm font-semibold text-muted-foreground">{plan.name}</div>
                  <div className="text-3xl font-black text-foreground">{plan.price}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{plan.sub}</div>
                  <div className="mt-2 text-xs font-medium text-primary">{plan.credits}</div>
                </div>
                <ul className="mb-7 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.highlight ? "default" : "outline"} asChild>
                  <Link href="/signin">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10" id="faq">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions buyers usually ask before trying Meridian.</h2>
        </div>
        {FAQS.map((faq) => (
          <FaqItem key={faq.q} {...faq} />
        ))}
      </section>

      <section className="border-t border-border bg-muted/20 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start with 250 free credits.</h2>
          <p className="mt-4 text-muted-foreground">
            Connect your inbox, define your audience, and launch a real outbound workflow without buying another bloated sales stack.
          </p>
          <Button size="lg" className="mt-8 h-12 gap-2 px-10 text-base" asChild>
            <Link href="/signin">
              Create your free account <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
            {[
              "No credit card",
              "Gmail and Outlook",
              "Manual review or auto-send",
              "Replies tracked automatically",
            ].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-4 border-t border-border px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:px-10">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none" className="text-muted-foreground">
            <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5" />
            <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>© {new Date().getFullYear()} Meridian. All rights reserved.</span>
        </div>
        <div className="flex gap-5">
          <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
        </div>
      </footer>
    </div>
  )
}