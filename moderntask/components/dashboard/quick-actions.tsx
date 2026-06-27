"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Play, Mail, Users2, UserCheck, Settings } from "lucide-react"

interface QuickAction {
  label: string
  description: string
  icon: React.ReactNode
  href: string
  accent: string   // tailwind bg + text classes
}

const ACTIONS: QuickAction[] = [
  {
    label: "Start All Agents",
    description: "Run every agent now",
    icon: <Play className="w-5 h-5" />,
    href: "/prospecting",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  {
    label: "Awaiting Review",
    description: "Review queued emails",
    icon: <Mail className="w-5 h-5" />,
    href: "/outreach?section=awaiting",
    accent: "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20",
  },
  {
    label: "Outreach",
    description: "Sent emails & replies",
    icon: <UserCheck className="w-5 h-5" />,
    href: "/outreach?section=sent",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 border-violet-500/20",
  },
  {
    label: "Leads",
    description: "Browse qualified leads",
    icon: <Users2 className="w-5 h-5" />,
    href: "/leads",
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
  },
  {
    label: "Settings",
    description: "Configure agents",
    icon: <Settings className="w-5 h-5" />,
    href: "/settings",
    accent: "bg-muted text-muted-foreground hover:bg-secondary border-border",
  },
]

export function QuickActions() {
  const router = useRouter()

  return (
    <Card
      className="p-5 transition-all duration-500 hover:shadow-xl animate-slide-in-up"
      style={{ animationDelay: "900ms" }}
    >
      <h2 className="text-base font-semibold text-foreground mb-4">Quick Actions</h2>
      <div className="space-y-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 text-left group ${action.accent}`}
          >
            <div className="flex-shrink-0">{action.icon}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{action.label}</p>
              <p className="text-[11px] opacity-70 leading-tight">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
