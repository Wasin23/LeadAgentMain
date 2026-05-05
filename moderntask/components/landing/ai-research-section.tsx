'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Phase = 'searching' | 'results' | 'email' | 'report' | 'crm' | 'done'

const SEARCH_QUERY = 'ScaleFlow Series A funding 2024'

const SEARCH_RESULTS = [
  {
    url:     'techcrunch.com › 2024 › scaleflow-series-a',
    title:   'ScaleFlow raises $12M Series A to triple US outbound sales capacity',
    snippet: 'The startup plans to expand from 12 to 35 employees by Q3, with early hiring focused on senior SDRs and enterprise AEs…',
    hi: true,
  },
  {
    url:     'linkedin.com › company › scaleflow › posts',
    title:   'ScaleFlow is hiring — 3 Senior SDRs for US enterprise expansion',
    snippet: "We're scaling fast and looking for experienced outbound reps to anchor our new US enterprise motion…",
    hi: false,
  },
  {
    url:     'forbes.com › startups › 2024',
    title:   'Top RevOps startups to watch: ScaleFlow, Outplay, and Apollo',
    snippet: 'ScaleFlow among companies reshaping how B2B teams approach outbound automation and pipeline building…',
    hi: false,
  },
]

const EMAIL_BODY = `Hi Sarah,

Saw ScaleFlow just closed $12M Series A and you're scaling the team from 12 to 35 by Q3. That usually means outbound volume becomes the bottleneck right as the board starts expecting pipeline numbers.

The SDR expansion is the tell — you need those reps producing fast, not spending the first 60 days building a prospecting workflow from scratch.

Your agent sources leads, researches each account, and writes the email from real context — funding news, hiring signals, the exact role. Your SDRs hit the ground with a full sequence already running.

Worth 15 minutes to see how it fits the Q3 push?

Alex`

const REPORT_SECTIONS = [
  {
    label: 'Company signals',
    accent: false,
    items: [
      '$12M Series A · Sequoia Capital',
      'Headcount: 12 → 35 by Q3',
      'Hiring 3 Senior SDRs (enterprise)',
      '340% ARR growth in Q4',
    ],
  },
  {
    label: 'Contact intel',
    accent: false,
    items: [
      'Role: Head of Growth',
      'Influence: Budget holder, decision-maker',
      'Pain point: Outbound at scale, fast ramp',
    ],
  },
  {
    label: 'Verdict',
    accent: true,
    items: [
      'Fit score: 94 / 100',
      '✓ High fit — proceed with outreach',
    ],
  },
]

const CRM_FIELDS = [
  { label: 'Contact',  value: 'Sarah Chen' },
  { label: 'Company',  value: 'ScaleFlow' },
  { label: 'Stage',    value: 'Outreach Queued' },
  { label: 'Tags',     value: 'Series A · Hiring · Fast Growth' },
]

const CRM_ACTIONS = [
  'Contact record updated',
  'Email sequence queued',
  'Follow-up scheduled in 5 days',
]

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

const URL_LABELS: Record<Phase, string> = {
  searching: 'google.com/search',
  results:   'google.com/search?q=ScaleFlow+Series+A+funding+2024',
  email:     'mail.google.com · Compose',
  report:    'meridian://research-report/scaleflow',
  crm:       'app.hubspot.com · Contacts',
  done:      'app.hubspot.com · Contacts',
}

const STATUS_LABELS: Record<Phase, string> = {
  searching: 'Searching…',
  results:   'Extracting signals…',
  email:     'Drafting email…',
  report:    'Building report…',
  crm:       'Pushing to CRM…',
  done:      'All done',
}

export function AiResearchSection() {
  const [phase, setPhase]           = useState<Phase>('searching')
  const [queryIdx, setQueryIdx]     = useState(0)
  const [resultsShown, setResultsShown] = useState(0)
  const [typed, setTyped]           = useState(0)
  const [reportSec, setReportSec]   = useState(0)
  const [reportItems, setReportItems] = useState(0)
  const [crmField, setCrmField]     = useState(0)
  const [crmBar, setCrmBar]         = useState(0)
  const [crmActions, setCrmActions] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let typeTimer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      setPhase('searching'); setQueryIdx(0); setResultsShown(0)
      setTyped(0); setReportSec(0); setReportItems(0)
      setCrmField(0); setCrmBar(0); setCrmActions(0)

      // ── type search query ──
      await sleep(400); if (!alive.current) return
      for (let i = 0; i <= SEARCH_QUERY.length; i++) {
        if (!alive.current) return
        setQueryIdx(i)
        await sleep(52)
      }
      await sleep(350); if (!alive.current) return

      // ── results appear ──
      setPhase('results')
      for (let i = 1; i <= SEARCH_RESULTS.length; i++) {
        if (!alive.current) return
        setResultsShown(i)
        await sleep(420)
      }
      await sleep(800); if (!alive.current) return

      // ── email compose ──
      setPhase('email'); setTyped(0)
      typeTimer = setInterval(() => {
        setTyped(n => {
          if (n >= EMAIL_BODY.length) { clearInterval(typeTimer!); typeTimer = null; return n }
          return n + 1
        })
      }, 12)
      await sleep(EMAIL_BODY.length * 12 + 400)
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
      if (!alive.current) return

      // ── research report ──
      setPhase('report'); setReportSec(0); setReportItems(0)
      for (let s = 0; s < REPORT_SECTIONS.length; s++) {
        if (!alive.current) return
        setReportSec(s + 1)
        for (let item = 1; item <= REPORT_SECTIONS[s].items.length; item++) {
          if (!alive.current) return
          setReportItems(s * 10 + item)
          await sleep(270)
        }
        await sleep(180)
      }
      await sleep(700); if (!alive.current) return

      // ── crm push ──
      setPhase('crm'); setCrmField(0); setCrmBar(0); setCrmActions(0)
      for (let f = 1; f <= CRM_FIELDS.length; f++) {
        if (!alive.current) return
        setCrmField(f)
        await sleep(360)
      }
      await sleep(280); if (!alive.current) return
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive.current) setCrmBar(100) }))
      await sleep(1100); if (!alive.current) return
      for (let a = 1; a <= CRM_ACTIONS.length; a++) {
        if (!alive.current) return
        setCrmActions(a)
        await sleep(350)
      }
      await sleep(600); if (!alive.current) return

      setPhase('done')
      await sleep(2500); if (!alive.current) return
      run()
    }

    run()
    return () => { alive.current = false; if (typeTimer) clearInterval(typeTimer) }
  }, [])

  type TabId = 'search' | 'email' | 'report' | 'crm'
  const activeTab: TabId =
    phase === 'searching' || phase === 'results' ? 'search'
    : phase === 'email' ? 'email'
    : phase === 'report' ? 'report'
    : 'crm'

  const TABS: { id: TabId; label: string }[] = [
    { id: 'search', label: '🔍 Google' },
    { id: 'email',  label: '✉ New Message' },
    { id: 'report', label: '📋 Research Report' },
    { id: 'crm',    label: '🏢 HubSpot CRM' },
  ]

  return (
    <section className="relative z-10 py-28 px-6">
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slideUp 0.28s ease-out forwards; }
      `}</style>

      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* ── Left copy ── */}
        <div className="flex-1 max-w-[420px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">AI Research</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Reads the room<br />before writing.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Your agent pulls company profiles, recent news, hiring signals, and role context — then writes from that research. Not a template.
          </p>
          <div className="space-y-3 mb-10">
            {[
              'Company profile and role intelligence',
              'Funding rounds and hiring signals',
              'Recent news and LinkedIn activity',
              'Tech stack and buyer intent data',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Link href="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Browser window ── */}
        <div className="flex-1 w-full min-w-0">
          <div className="rounded-2xl border border-white/[0.10] bg-[#07091c]/90 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/[0.04]">

            {/* Title bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 px-3 py-[3px] rounded bg-white/[0.05] border border-white/[0.06] text-white/20 text-[10px] font-mono text-center truncate">
                {URL_LABELS[phase]}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${phase === 'done' ? 'bg-green-400' : 'bg-indigo-400 animate-pulse'}`} />
                <span className={`text-[10px] font-medium whitespace-nowrap ${phase === 'done' ? 'text-green-400' : 'text-indigo-400/80'}`}>
                  {STATUS_LABELS[phase]}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex text-[11px] border-b border-white/[0.06] bg-black/10 overflow-x-auto">
              {TABS.map(tab => (
                <div
                  key={tab.id}
                  className={`px-3.5 py-2.5 border-r border-white/[0.04] whitespace-nowrap shrink-0 transition-colors ${
                    activeTab === tab.id
                      ? 'text-white/80 bg-white/[0.05] border-b-2 border-b-indigo-500'
                      : 'text-white/18'
                  }`}
                >
                  {tab.label}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="min-h-[460px] p-6 overflow-y-auto">

              {/* ── SEARCHING ── */}
              {phase === 'searching' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-[13px]">
                    <span className="text-white/30 text-base">🔍</span>
                    <span className="text-white/70 font-mono">
                      {SEARCH_QUERY.slice(0, queryIdx)}
                      <span className="inline-block w-px h-[13px] bg-indigo-400 animate-pulse align-text-bottom ml-px" />
                    </span>
                  </div>
                </div>
              )}

              {/* ── RESULTS ── */}
              {phase === 'results' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-[13px]">
                    <span className="text-white/30 text-base">🔍</span>
                    <span className="text-white/55 font-mono">{SEARCH_QUERY}</span>
                  </div>
                  <div className="text-[10px] text-white/25">About 8,420 results (0.31 seconds)</div>
                  <div className="space-y-3">
                    {SEARCH_RESULTS.slice(0, resultsShown).map((r, i) => (
                      <div
                        key={i}
                        className={`slide-up p-3.5 rounded-xl ${
                          r.hi ? 'bg-indigo-500/10 border border-indigo-500/25' : 'border border-transparent'
                        }`}
                      >
                        <div className="text-[10px] text-green-400/70 mb-0.5">{r.url}</div>
                        <div className={`text-[13px] font-semibold mb-1 leading-snug ${r.hi ? 'text-indigo-300' : 'text-white/55'}`}>
                          {r.title}
                        </div>
                        <div className="text-[11px] text-white/30 leading-relaxed">{r.snippet}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── EMAIL ── */}
              {phase === 'email' && (
                <div>
                  <div className="border-b border-white/[0.06] pb-3 mb-5 space-y-2">
                    {[
                      { l: 'From',    v: 'alex@yourcompany.com', c: 'text-white/45' },
                      { l: 'To',      v: 'sarah@scaleflow.io',   c: 'text-indigo-400' },
                      { l: 'Subject', v: "ScaleFlow's Q3 SDR expansion", c: 'text-white/70' },
                    ].map(f => (
                      <div key={f.l} className="flex items-center gap-3 text-[11px]">
                        <span className="text-white/20 w-12 text-right shrink-0">{f.l}</span>
                        <span className={`font-medium ${f.c}`}>{f.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap font-mono">
                    {EMAIL_BODY.slice(0, typed)}
                    {typed < EMAIL_BODY.length && (
                      <span className="inline-block w-px h-[13px] bg-indigo-400 animate-pulse align-text-bottom ml-px" />
                    )}
                  </div>
                </div>
              )}

              {/* ── RESEARCH REPORT ── */}
              {phase === 'report' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-xs shrink-0">SC</div>
                    <div>
                      <div className="text-white/80 font-bold text-sm">ScaleFlow · Sarah Chen</div>
                      <div className="text-white/30 text-[11px]">Head of Growth · San Francisco</div>
                    </div>
                    <span className="ml-auto text-[10px] font-bold text-indigo-400/50 uppercase tracking-widest">Research Report</span>
                  </div>

                  {REPORT_SECTIONS.slice(0, reportSec).map((sec, si) => {
                    const shown = Math.max(0, reportItems - si * 10)
                    return (
                      <div key={si} className="slide-up space-y-2">
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${sec.accent ? 'text-green-400/70' : 'text-white/25'}`}>
                          {sec.label}
                        </div>
                        {sec.items.slice(0, shown).map((item, ii) => (
                          <div key={ii} className={`slide-up flex items-center gap-2 text-[12px] ${sec.accent ? 'text-green-400' : 'text-white/55'}`}>
                            <span className={`text-[9px] shrink-0 ${sec.accent ? 'text-green-400' : 'text-indigo-400'}`}>→</span>
                            {item}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── CRM PUSH ── */}
              {(phase === 'crm' || phase === 'done') && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span>🏢</span>
                    <span>HubSpot CRM · Pushing contact record</span>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                    {CRM_FIELDS.map((f, i) => (
                      <div
                        key={f.label}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05] last:border-0 transition-all duration-300 ${
                          crmField > i ? 'opacity-100' : 'opacity-20'
                        }`}
                      >
                        <span className="text-white/25 text-[11px] w-16 shrink-0">{f.label}</span>
                        <span className={`text-[12px] font-medium ${crmField > i ? 'text-white/70' : 'text-white/15'}`}>
                          {crmField > i ? f.value : '—'}
                        </span>
                        {crmField > i && <span className="ml-auto text-[9px] text-green-400/60">✓</span>}
                      </div>
                    ))}
                  </div>

                  {crmField >= CRM_FIELDS.length && (
                    <div className="slide-up space-y-1.5">
                      <div className="flex justify-between text-[10px] text-white/25">
                        <span>Syncing record</span>
                        <span className="text-indigo-400">{crmBar === 100 ? '100%' : '…'}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${crmBar}%`, transition: 'width 1.0s ease-out' }}
                        />
                      </div>
                    </div>
                  )}

                  {crmActions > 0 && (
                    <div className="space-y-2">
                      {CRM_ACTIONS.slice(0, crmActions).map((action, i) => (
                        <div key={i} className="slide-up flex items-center gap-2 text-[12px] text-green-400">
                          <span className="text-[10px]">✓</span>
                          {action}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
