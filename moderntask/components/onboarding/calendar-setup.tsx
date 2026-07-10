'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import api from '@/lib/api'

interface Props {
  onComplete: () => void
}

export default function CalendarSetup({ onComplete }: Props) {
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendlyLink, setCalendlyLink] = useState('')
  const [savingCalendly, setSavingCalendly] = useState(false)
  const [calendlySaved, setCalendlySaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/calendar/status').then(r => {
      if (r.data?.connected) setCalendarConnected(true)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const connectGoogleCalendar = async () => {
    try {
      const r = await api.get('/api/calendar/google-oauth-url')
      const w = window.open(r.data.authUrl, 'Google Calendar OAuth', 'width=600,height=700')
      const poll = setInterval(async () => {
        if (w?.closed) {
          clearInterval(poll)
          await new Promise(res => setTimeout(res, 1000))
          api.get('/api/calendar/status').then(sr => {
            if (sr.data?.connected) setCalendarConnected(true)
          }).catch(() => {})
        }
      }, 500)
    } catch {}
  }

  const saveCalendlyLink = async () => {
    if (!calendlyLink.trim()) return
    setSavingCalendly(true)
    try {
      await api.post('/api/calendar/calendly-link', { link: calendlyLink.trim() })
      setCalendlySaved(true)
    } catch {}
    setSavingCalendly(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#0F1E35]/80 backdrop-blur-md border-b border-[#4FD1FF]/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 48 48">
              <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
              <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
            </svg>
            <span className="text-white font-bold text-lg">Calendar Setup</span>
          </div>
          <button onClick={onComplete} className="px-4 py-2 text-sm text-[#A3B4CC] border border-[#4FD1FF]/20 rounded-lg hover:bg-[#2A4472] transition-all">
            Skip
          </button>
        </div>
        <div className="h-0.5 bg-[#4FD1FF]" />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4FD1FF]/10 border border-[#4FD1FF]/30 text-[#4FD1FF] rounded-full text-xs font-semibold mb-5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            Final Step
          </div>
          <div className="w-20 h-20 bg-gradient-to-br from-[#4FD1FF] to-[#6BE3FF] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#4FD1FF]/30">
            <svg className="w-11 h-11 text-[#0F1E35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Set Up Your Calendar</h1>
          <p className="text-xl text-[#A3B4CC]">Help your agent schedule meetings automatically</p>
        </div>

        <div className="space-y-5">
          {/* Google Calendar */}
          <div className={`bg-[#1B2F52]/80 border-2 rounded-2xl p-6 transition-all ${calendarConnected ? 'border-green-500' : 'border-[#4FD1FF]/30'}`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-[#1E8E3E] flex items-center justify-center shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  Google Calendar
                  {calendarConnected && <span className="text-xs font-semibold text-green-400 bg-green-500/20 border border-green-500/30 px-2 py-0.5 rounded-full">CONNECTED</span>}
                </h3>
                <p className="text-sm text-[#A3B4CC] mb-4">
                  Connect Google Calendar so Meridian can check your availability and add meetings booked through your outreach.
                </p>
                {!calendarConnected ? (
                  <button
                    onClick={connectGoogleCalendar}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-semibold text-sm hover:shadow-lg hover:scale-105 transition-all"
                  >
                    Connect Google Calendar
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Calendar connected - availability sync active
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Calendly */}
          <div className={`bg-[#1B2F52]/80 border-2 rounded-2xl p-6 transition-all ${calendlySaved ? 'border-blue-500' : 'border-[#4FD1FF]/30'}`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm text-white font-bold text-xl">C</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  Calendly Link
                  {calendlySaved && <span className="text-xs font-semibold text-blue-400 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full">SAVED</span>}
                </h3>
                <p className="text-sm text-[#A3B4CC] mb-4">
                  Add your Calendly link so the AI agent can include it in outreach emails for easy scheduling.
                </p>
                <input
                  type="url"
                  value={calendlyLink}
                  onChange={e => setCalendlyLink(e.target.value)}
                  placeholder="https://calendly.com/your-name"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#4FD1FF]/30 focus:border-[#4FD1FF] focus:ring-2 focus:ring-[#4FD1FF]/20 bg-[#12213B] text-white placeholder-[#8FA6C1] text-sm outline-none mb-3"
                />
                <button
                  onClick={saveCalendlyLink}
                  disabled={savingCalendly || !calendlyLink.trim() || calendlySaved}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingCalendly ? 'Saving...' : calendlySaved ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span> : 'Save Calendly Link'}
                </button>
              </div>
            </div>
          </div>

          {/* Info box */}
          {(calendarConnected || calendlySaved) && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
              <h3 className="font-semibold text-green-400 mb-2">Calendar Integration Active</h3>
              <ul className="space-y-1.5 text-sm text-green-300">
                {calendarConnected && <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 shrink-0" /> Google Calendar connected - meeting bookings will sync</li>}
                {calendlySaved && <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 shrink-0" /> Calendly link saved - agent will include it in outreach</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={onComplete}
            className="px-12 py-4 bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-[#4FD1FF]/30 hover:scale-105 transition-all inline-flex items-center gap-2"
          >
            {calendarConnected || calendlySaved ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                Finish Setup
              </>
            ) : 'Skip for Now →'}
          </button>
          <p className="mt-3 text-sm text-[#A3B4CC]">You can configure calendar settings anytime from the Settings page.</p>
        </div>
      </div>
    </div>
  )
}
