// Shared between the schedule builder, the Outreach "Schedule for Send" modal, the
// Schedules page, and both dashboard calendars — one global schedule per account (not
// per agent). Main emails are the only thing configured here (capped by the plan's daily
// send cap); follow-ups are never configured as a ratio — they're predicted, driven off
// how many mains go out shifted forward by the global follow-up interval, and capped by
// the per-mailbox (50/day) limit, not by anything in this schedule.

export interface SendingSchedule {
  activeDays:     number[]  // 0=Sun … 6=Sat
  sendTime:       string    // "HH:MM" e.g. "09:00"
  mainPerDay:     number
  timezone:       string
}

export interface SavedSchedule extends SendingSchedule {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

// Global, not per-agent — configured once in the Outreach/Schedules page and applied
// across every agent's follow-ups.
export interface FollowUpSettings {
  enabled:      boolean
  intervalDays: number
  maxRebumps:   number
  smartRebump:  boolean
}

export const DEFAULT_FOLLOWUP_SETTINGS: FollowUpSettings = {
  enabled: true,
  intervalDays: 7,
  maxRebumps: 1,
  smartRebump: false,
}

export interface SchedulePreviewDay {
  date: string        // "YYYY-MM-DD"
  active: boolean
  mainCount: number
  mainCap: number
  followUpCount: number  // predicted, not configured
  followUpCap: number    // per-mailbox cap (50/day), not the plan's main cap
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
  'America/Mexico_City', 'America/Buenos_Aires',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Hong_Kong',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
]

export const BROWSER_TZ: string =
  typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'America/New_York'

export const DEFAULT_SCHEDULE: SendingSchedule = {
  activeDays: [1, 2, 3, 4, 5],
  sendTime: '09:00',
  mainPerDay: 50,
  timezone: BROWSER_TZ,
}
