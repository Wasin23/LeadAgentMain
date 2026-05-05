'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

// ── CRM animation ──────────────────────────────────────────────────────────
const CONTACTS = [
  { name: 'Sarah Chen',  company: 'ScaleFlow',  role: 'Head of Growth',  stage: 'Contacted',  fit: 94 },
  { name: 'Marcus Lee',  company: 'Finova',     role: 'VP of Sales',     stage: 'Interested', fit: 88 },
  { name: 'Jade Morris', company: 'FleetGrid',  role: 'Head of Revenue', stage: 'New',        fit: 91 },
  { name: 'Tom Reyes',   company: 'LayerStack', role: 'CEO',             stage: 'New',        fit: 86 },
  { name: 'Nina Patel',  company: 'StitchOps',  role: 'VP Finance',      stage: 'New',        fit: 79 },
]

const CRM_UPDATES = [
  { field: 'Last researched', value: 'Just now' },
  { field: 'Email status',    value: 'Opened 3× · no reply yet' },
  { field: 'Deal stage',      value: 'New → Contacted' },
  { field: 'Intent signals',  value: 'Hiring 3 SDRs · Series A' },
  { field: 'Next action',     value: 'Follow-up: SDR expansion angle' },
]

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

type CrmPhase = 'scanning' | 'researching' | 'updating' | 'done'

function CrmPanel() {
  const [phase, setPhase]     = useState<CrmPhase>('scanning')
  const [scanIdx, setScanIdx] = useState(-1)
  const [active]              = useState(0)
  const [fields, setFields]   = useState(0)
  const alive                 = useRef(true)

  useEffect(() => {
    alive.current = true
    const run = async () => {
      setPhase('scanning'); setScanIdx(-1); setFields(0)
      for (let i = 0; i < CONTACTS.length; i++) {
        if (!alive.current) return
        setScanIdx(i)
        await sleep(300)
      }
      if (!alive.current) return
      await sleep(250)
      setPhase('researching')
      await sleep(900)
      if (!alive.current) return
      setPhase('updating')
      for (let i = 0; i < CRM_UPDATES.length; i++) {
        if (!alive.current) return
        setFields(i + 1)
        await sleep(460)
      }
      if (!alive.current) return
      setPhase('done')
      await sleep(2200)
      if (!alive.current) return
      run()
    }
    run()
    return () => { alive.current = false }
  }, [])

  const stageColor: Record<string, string> = {
    'New':        'bg-white/10 text-white/40',
    'Contacted':  'bg-indigo-500/20 text-indigo-400',
    'Interested': 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#06081a]/95 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/[0.05]">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 px-3 py-[3px] rounded bg-white/[0.05] border border-white/[0.06] text-white/20 text-[10px] font-mono text-center truncate">
          meridian://crm/contacts
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${phase === 'done' ? 'bg-green-400' : 'bg-indigo-400 animate-pulse'}`} />
          <span className={`text-[10px] font-medium ${phase === 'done' ? 'text-green-400' : 'text-indigo-400/80'}`}>
            {phase === 'scanning' ? 'Scanning…' : phase === 'researching' ? 'Researching…' : phase === 'updating' ? 'Updating CRM…' : 'Updated'}
          </span>
        </div>
      </div>

      <div className="flex" style={{ height: 400 }}>
        {/* Contact list */}
        <div className="w-[190px] shrink-0 border-r border-white/[0.06] overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold text-white/25 uppercase tracking-widest border-b border-white/[0.04]">
            Contacts · {CONTACTS.length}
          </div>
          {CONTACTS.map((c, i) => (
            <div
              key={i}
              className={`px-3 py-2.5 border-b border-white/[0.03] transition-all ${
                i === active && phase !== 'scanning'
                  ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                  : scanIdx === i ? 'bg-white/[0.04]' : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-[9px] font-bold shrink-0">
                  {c.name[0]}
                </div>
                <div className="min-w-0">
                  <div className={`text-[11px] font-semibold truncate ${i === active && phase !== 'scanning' ? 'text-white/85' : 'text-white/45'}`}>
                    {c.name}
                  </div>
                  <div className="text-[9px] text-white/22 truncate">{c.company}</div>
                </div>
              </div>
              {scanIdx === i && phase === 'scanning' && (
                <div className="mt-1 h-px bg-indigo-500/50 rounded" style={{ animation: 'scanLine 0.3s ease-out' }} />
              )}
            </div>
          ))}
        </div>

        {/* Contact detail */}
        <div className="flex-1 p-5 overflow-y-auto">
          {phase === 'scanning' ? (
            <div className="h-full flex items-center justify-center text-[12px] text-white/15 italic">
              Select a contact
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">
                  {CONTACTS[active].name[0]}
                </div>
                <div>
                  <div className="text-white/85 font-bold text-sm">{CONTACTS[active].name}</div>
                  <div className="text-white/35 text-[11px]">{CONTACTS[active].role} · {CONTACTS[active].company}</div>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className={`px-1.5 py-px rounded text-[9px] font-semibold ${stageColor[CONTACTS[active].stage]}`}>
                      {CONTACTS[active].stage}
                    </span>
                    <span className="px-1.5 py-px rounded text-[9px] font-semibold bg-white/[0.06] text-white/40">
                      Fit {CONTACTS[active].fit}%
                    </span>
                  </div>
                </div>
              </div>

              {phase === 'researching' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  AI researching account signals…
                </div>
              )}

              {(phase === 'updating' || phase === 'done') && (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">AI Updates</div>
                  {CRM_UPDATES.slice(0, fields).map((u, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="text-green-400 text-[10px] mt-px shrink-0">✓</span>
                      <span className="text-white/30 w-28 shrink-0">{u.field}</span>
                      <span className="text-white/65 font-medium">{u.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {phase === 'done' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  CRM record updated · next action queued
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main section ───────────────────────────────────────────────────────────
export function GlobeCrmSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [prog, setProg] = useState(0)

  useEffect(() => {
    let sectionTop = 0
    const cacheTop = () => {
      const s = sectionRef.current
      if (s) sectionTop = s.getBoundingClientRect().top + window.scrollY
    }
    cacheTop()

    const onScroll = () => {
      const s = sectionRef.current
      if (!s) return
      const scrolled  = window.scrollY - sectionTop
      const maxScroll = s.offsetHeight - window.innerHeight
      setProg(Math.min(Math.max(scrolled / Math.max(maxScroll, 1), 0), 1))
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', cacheTop)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', cacheTop)
    }
  }, [])

  const showCrm = prog > 0.38

  // Subtle globe parallax: shifts up slightly as you scroll
  const globeY = prog * -60

  return (
    <div ref={sectionRef} className="relative z-10" style={{ height: '380vh' }}>
      <style>{`
        @keyframes scanLine { from{width:0}to{width:100%} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)} }
        .crm-in { animation: fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      <div className="sticky top-0 h-screen overflow-hidden">

        {/* Globe image — massive, centered */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none"
          style={{
            width: '115vw',
            top: '50%',
            transform: `translateX(-50%) translateY(calc(-46% + ${globeY}px))`,
            opacity: 0.88,
            transition: 'transform 0.05s linear',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/globe.png" alt="" className="w-full h-auto" draggable={false} />
        </div>

        {/* Top gradient — blends globe into starfield above */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#03050d] via-[#03050d]/60 to-transparent pointer-events-none" />

        {/* Bottom gradient — fades into pricing below */}
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#03050d] via-[#03050d]/70 to-transparent pointer-events-none" />

        {/* ── Outbound panel ── */}
        <div
          className="absolute top-0 left-0 z-10 px-14 pt-28 max-w-[500px] transition-all duration-500"
          style={{ opacity: showCrm ? 0 : 1, transform: showCrm ? 'translateY(-20px)' : 'translateY(0)', pointerEvents: showCrm ? 'none' : 'auto' }}
        >
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-5">
            Sends. Tracks.<br />Follows up.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-7 max-w-[400px]">
            Every email fires from your real inbox. Opens are tracked, follow-ups schedule automatically, and when a reply lands — all sequences stop instantly.
          </p>
          <div className="space-y-3">
            {[
              'Sends from Gmail or Outlook — your real domain',
              'Open and click tracking per email',
              'Smart follow-ups — pause on reply, resume on silence',
              'Every reply routes back to your inbox',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* ── CRM panel ── */}
        {showCrm && (
          <div className="absolute inset-0 z-10 flex items-center px-10 gap-12 pointer-events-none">
            {/* Left copy */}
            <div className="max-w-[380px] crm-in pointer-events-auto" style={{ animationDelay: '0ms' }}>
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.05] tracking-tight mb-4">
                Keeps your CRM<br />up to date.
              </h2>
              <p className="text-white/50 text-base leading-relaxed mb-6">
                Every time Meridian researches a lead or gets a reply, your CRM updates automatically — deal stage, last contact, next action, and signals pulled from the web.
              </p>
              <div className="space-y-2.5 mb-8">
                {[
                  'Auto-updates deal stage on reply',
                  'Enriches contacts with live web signals',
                  'Queues next actions automatically',
                  'Syncs with HubSpot, Salesforce, and more',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-white/50 text-[14px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105 pointer-events-auto"
              >
                Start free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* CRM browser window */}
            <div className="flex-1 max-w-[520px] crm-in pointer-events-auto" style={{ animationDelay: '70ms' }}>
              <CrmPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
