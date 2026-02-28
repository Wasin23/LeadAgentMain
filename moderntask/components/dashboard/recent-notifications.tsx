"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { AlertCircle, Bot, Mail, CreditCard, Info } from "lucide-react"

export interface NotificationItem {
  issueId: string
  type: "billing" | "agent" | "email" | "system" | string
  severity: "critical" | "high" | "medium" | "low" | string
  title: string
  message: string
  timestamp: string
  read: boolean
}

interface RecentNotificationsProps {
  notifications?: NotificationItem[]
}

function typeIcon(type: string) {
  switch (type) {
    case "billing":  return <CreditCard className="w-3.5 h-3.5" />
    case "agent":    return <Bot className="w-3.5 h-3.5" />
    case "email":    return <Mail className="w-3.5 h-3.5" />
    case "system":   return <AlertCircle className="w-3.5 h-3.5" />
    default:         return <Info className="w-3.5 h-3.5" />
  }
}

function severityColors(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
    case "high":     return "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
    case "medium":   return "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
    default:         return "bg-muted text-muted-foreground"
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return "just now"
}

export function RecentNotifications({ notifications = [] }: RecentNotificationsProps) {
  const router = useRouter()

  return (
    <Card
      className="p-5 transition-all duration-500 hover:shadow-xl animate-slide-in-up"
      style={{ animationDelay: "800ms" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Recent Notifications</h2>
        </div>
        <button
          onClick={() => router.push("/help")}
          className="text-xs text-primary hover:underline transition-colors"
        >
          View all →
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <AlertCircle className="w-7 h-7 text-muted-foreground/30" />
          <p className="text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.slice(0, 6).map((n) => (
            <div
              key={n.issueId}
              className={`flex items-start gap-3 p-2.5 rounded-lg transition-all duration-200 cursor-pointer hover:bg-secondary group ${
                !n.read ? "border-l-2 border-primary pl-[9px]" : ""
              }`}
              onClick={() => router.push("/help")}
            >
              {/* Type icon */}
              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${severityColors(n.severity)}`}>
                {typeIcon(n.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                <p className="text-xs text-muted-foreground truncate">{n.message}</p>
              </div>

              {/* Time */}
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                {timeAgo(n.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
