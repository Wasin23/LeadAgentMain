"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Send, Clock, Bot } from "lucide-react"

export interface ScheduledBatch {
  scheduledSendTime: string   // ISO string
  count: number               // number of emails in this batch
  agentName?: string
  agentId?: string
}

interface RemindersProps {
  batches?: ScheduledBatch[]
}

function formatTime(iso: string): { time: string; date: string; soon: boolean; month: string; day: string } {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const isToday = d.toDateString() === now.toDateString()
  const isTomorrow =
    d.toDateString() === new Date(now.getTime() + 86400000).toDateString()

  const date = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString([], { month: "short", day: "numeric" })
  const soon = diffMins >= 0 && diffMins <= 60

  const month = isToday ? "Today" : isTomorrow ? "Tmrw" : d.toLocaleDateString([], { month: "short" }).toUpperCase()
  const day = String(d.getDate())

  return { time, date, soon, month, day }
}

export function Reminders({ batches = [] }: RemindersProps) {
  const router = useRouter()

  // Filter to only upcoming, sort by soonest first
  const upcoming = batches
    .filter((b) => new Date(b.scheduledSendTime) > new Date())
    .sort((a, b) => new Date(a.scheduledSendTime).getTime() - new Date(b.scheduledSendTime).getTime())

  return (
    <Card
      className="p-5 transition-all duration-500 hover:shadow-xl animate-slide-in-up"
      style={{ animationDelay: "500ms" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Scheduled Sends</h2>
        </div>
        <button
          onClick={() => router.push("/email-queue")}
          className="text-xs text-primary hover:underline transition-colors"
        >
          View queue →
        </button>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-7 gap-2 text-muted-foreground">
          <Clock className="w-7 h-7 text-muted-foreground/30" />
          <p className="text-sm text-center">No sends scheduled</p>
          <p className="text-xs text-muted-foreground/60 text-center">
            Emails will appear here once the scheduler assigns send times
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.slice(0, 5).map((batch, i) => {
            const { time, date, soon, month, day } = formatTime(batch.scheduledSendTime)
            return (
              <div
                key={`${batch.scheduledSendTime}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary transition-all duration-200 cursor-pointer group"
                onClick={() => router.push("/email-queue")}
              >
                {/* Calendar chip */}
                <div className={`flex-shrink-0 w-12 rounded-xl overflow-hidden border shadow-sm ${
                  soon ? "border-rose-400/60" : "border-border"
                }`}>
                  <div className="text-center text-[9px] font-bold uppercase tracking-wider py-0.5 bg-rose-700/80 text-white">
                    {month}
                  </div>
                  <div className="flex flex-col items-center py-1.5 gap-0.5 bg-card">
                    <span className={`text-sm font-bold leading-none ${soon ? "text-primary" : "text-foreground"}`}>{day}</span>
                    <span className="text-[9px] text-muted-foreground leading-none">{time}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Upcoming scheduled send at {time}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {batch.count} email{batch.count !== 1 ? "s" : ""} scheduled{batch.agentName && ` · from ${batch.agentName}`}
                  </p>
                </div>

                {/* Soon badge */}
                {soon && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap flex-shrink-0 animate-pulse">
                    Soon
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
