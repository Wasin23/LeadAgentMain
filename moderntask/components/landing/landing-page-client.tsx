"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuth } from "@/contexts/AuthContext"
import { ScrollStory } from "@/components/landing/scroll-story"
import { Button } from "@/components/ui/button"

const HorizonHero = dynamic(
  () => import("@/components/demo/horizon-hero").then((m) => ({ default: m.HorizonHero })),
  { ssr: false, loading: () => <div className="h-screen w-full bg-[#03050d]" /> }
)
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (user) {
      router.replace("/home")
    }
  }, [router, user])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="text-foreground">
      {/* Nav — fixed, transparent over dark hero, solid once scrolled */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b px-6 py-4 backdrop-blur transition-all duration-300 sm:px-10 ${
        scrolled ? "border-border bg-background/95" : "border-white/10 bg-black/30"
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className={scrolled ? "text-foreground" : "text-white"}>
              <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className={`text-lg font-bold tracking-tight ${scrolled ? "text-foreground" : "text-white"}`}>Meridian</span>
          </Link>

          <div className={`hidden items-center gap-6 text-sm sm:flex ${scrolled ? "text-muted-foreground" : "text-white/70"}`}>
            <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className={`transition-colors ${scrolled ? "hover:text-foreground" : "hover:text-white"}`}>How it works</button>
            <button onClick={() => document.getElementById("emails")?.scrollIntoView({ behavior: "smooth" })} className={`transition-colors ${scrolled ? "hover:text-foreground" : "hover:text-white"}`}>Examples</button>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className={`transition-colors ${scrolled ? "hover:text-foreground" : "hover:text-white"}`}>Pricing</button>
            <button onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })} className={`transition-colors ${scrolled ? "hover:text-foreground" : "hover:text-white"}`}>FAQ</button>
          </div>

          <div className="flex items-center gap-2">
            {scrolled ? (
              <>
                <Button variant="ghost" size="sm" asChild><Link href="/signin">Sign In</Link></Button>
                <Button size="sm" asChild><Link href="/signin">Start Free</Link></Button>
              </>
            ) : (
              <>
                <Link href="/signin" className="px-4 py-1.5 text-sm text-white/80 hover:text-white transition-colors">Sign In</Link>
                <Link href="/signin" className="px-4 py-1.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors">Start Free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Full-screen dark hero */}
      <HorizonHero />

      <ScrollStory />

      {/* Pricing + FAQ + Footer */}
      <div className="overflow-hidden bg-background">

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
                credits: "1 agent, up to 3x speed",
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
      </div>{/* end bg-background wrapper */}
    </div>
  )
}
