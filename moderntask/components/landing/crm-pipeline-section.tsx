'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ── types ──────────────────────────────────────────────────────────────────
type Phase =
  | 'idle'
  | 'to-crm'
  | 'pickup'
  | 'to-research'
  | 'researching'
  | 'pickup-verified'
  | 'to-verified'
  | 'deposit'

// ── data ───────────────────────────────────────────────────────────────────
const CRM_RECORDS = [
  { name: 'Sarah Chen',  co: 'ScaleFlow',   role: 'Head of Growth'  },
  { name: 'Marcus Lee',  co: 'Finova',      role: 'VP of Sales'     },
  { name: 'Jade Morris', co: 'FleetGrid',   role: 'Head of Revenue' },
  { name: 'Tom Reyes',   co: 'LayerStack',  role: 'CEO'             },
  { name: 'Nina Patel',  co: 'StitchOps',   role: 'VP Finance'      },
  { name: 'Lena Kwon',   co: 'Driftwork',   role: 'Dir. of Sales'   },
]

const ARTICLE_PARAS = [
  'ScaleFlow announced a $12M Series A led by Sequoia Capital, with plans to triple headcount by Q3, specifically hiring outbound sales infrastructure and senior SDRs.',
  'Head of Growth Sarah Chen noted the team needs outbound tooling that "researches the account and writes a real email" rather than generic sequences.',
  'The company grew 340% ARR in Q4, expanding from 60 to 200+ revenue teams across 18 countries with a new enterprise motion focused on B2B SaaS.',
]

const SIGNALS = [
  { label: 'Series A closed',       value: '$12M · Sequoia'           },
  { label: 'Hiring 3 Senior SDRs',  value: 'posted 4 days ago'        },
  { label: 'Headcount',             value: '12 → 35 by Q3'            },
  { label: 'Verdict',               value: '✓ High fit. Re-engage'    },
]

const FIT_SCORES = [94, 88, 91, 86, 79, 83, 90, 85, 77, 92]

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── scan text ───────────────────────────────────────────────────────────────
function ScanLine({ text, active, done }: { text: string; active: boolean; done: boolean }) {
  const words = useMemo(() => text.split(' '), [text])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!active) { setIdx(done ? words.length + 1 : 0); return }
    setIdx(0)
    let i = 0
    const t = setInterval(() => { i++; setIdx(i); if (i >= words.length) clearInterval(t) }, 1000 / 55)
    return () => clearInterval(t)
  }, [active, done, words.length])

  return (
    <p className={`text-[13px] leading-[1.7] transition-opacity duration-300 ${!active && !done ? 'opacity-30' : 'opacity-100'}`}>
      {done ? (
        <span className="text-black/55">{text}</span>
      ) : (
        words.map((w, i) => (
          <span key={i}>
            <span className={
              i < idx   ? 'text-black/55' :
              i === idx ? 'bg-indigo-500/30 text-black/90 rounded-sm px-0.5' :
              'text-black/20'
            }>{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))
      )}
    </p>
  )
}

// ── agent bot ───────────────────────────────────────────────────────────────
function AgentBot({ carrying, verified }: { carrying: boolean; verified: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {carrying && (
        <div
          className="rounded border px-2 py-1 text-[9px] font-semibold mb-0.5 transition-all"
          style={{
            background: verified ? 'rgba(74,222,128,0.12)' : 'rgba(99,102,241,0.12)',
            borderColor: verified ? 'rgba(74,222,128,0.4)' : 'rgba(99,102,241,0.4)',
            color: verified ? 'rgba(74,222,128,0.9)' : 'rgba(165,180,252,0.9)',
            minWidth: 64,
            textAlign: 'center',
          }}
        >
          {verified ? '✓ Verified' : 'CRM record'}
        </div>
      )}
      <svg width="36" height="42" viewBox="0 0 36 42" fill="none">
        <rect x="8" y="2" width="20" height="16" rx="4" fill="#1e2a5e" stroke="rgba(99,102,241,0.7)" strokeWidth="1.2"/>
        <circle cx="13" cy="10" r="2.5" fill="rgba(129,140,248,0.9)"/>
        <circle cx="23" cy="10" r="2.5" fill="rgba(129,140,248,0.9)"/>
        <line x1="18" y1="2" x2="18" y2="-2" stroke="rgba(99,102,241,0.6)" strokeWidth="1.2"/>
        <circle cx="18" cy="-3" r="1.5" fill="rgba(99,102,241,0.8)"/>
        <rect x="15" y="18" width="6" height="3" fill="#1e2a5e"/>
        <rect x="6" y="21" width="24" height="14" rx="3" fill="#1a2356" stroke="rgba(99,102,241,0.5)" strokeWidth="1.2"/>
        <circle cx="18" cy="28" r="3" fill="rgba(99,102,241,0.4)" stroke="rgba(129,140,248,0.6)" strokeWidth="0.8"/>
        <rect x="0" y="22" width="6" height="3" rx="1.5" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
        <rect x="30" y="22" width="6" height="3" rx="1.5" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
        <rect x="9"  y="35" width="7" height="7" rx="2" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
        <rect x="20" y="35" width="7" height="7" rx="2" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
      </svg>
    </div>
  )
}

// ── left: CRM unverified ────────────────────────────────────────────────────
function CrmUnverified({ active, currentIdx }: { active: boolean; currentIdx: number }) {
  const remaining = CRM_RECORDS.slice(currentIdx % CRM_RECORDS.length)

  return (
    <div className="flex flex-col gap-2 w-[148px]">
      <div className={`text-[12px] font-bold uppercase tracking-widest transition-colors ${active ? 'text-indigo-400' : 'text-black/25'}`}>
        Your CRM
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-[#080c20] overflow-hidden">
        <div className="px-3 py-1.5 border-b border-white/[0.05] text-[11px] text-black/20 font-mono flex justify-between">
          <span>unaudited</span>
          <span>{remaining.length}</span>
        </div>
        {remaining.slice(0, 4).map((r, i) => (
          <div
            key={i}
            className={`px-3 py-2 border-b border-white/[0.04] last:border-0 transition-all ${i === 0 && active ? 'bg-indigo-500/10' : ''}`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="text-[13px] font-semibold text-black/60 truncate">{r.name}</div>
              {i === 0 && active
                ? <span className="text-[11px] text-indigo-400 shrink-0">↑ auditing</span>
                : <span className="text-[11px] text-black/15 shrink-0">?</span>
              }
            </div>
            <div className="text-[12px] text-black/25">{r.co}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── center: audit station ───────────────────────────────────────────────────
function AuditStation({ phase, paraIdx }: { phase: Phase; paraIdx: number }) {
  const active = phase === 'researching'
  const signalsShown = active ? Math.min(SIGNALS.length, paraIdx + 1) : 0

  return (
    <div className={`flex flex-col gap-2 w-[252px] transition-all duration-500 ${active ? 'opacity-100' : 'opacity-70'}`}>
      <div className={`text-[12px] font-bold uppercase tracking-widest transition-colors ${active ? 'text-indigo-400' : 'text-black/25'}`}>
        Audit station
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-[#080c20] p-3 space-y-2">
        <div className={`text-[12px] font-mono truncate transition-colors ${active ? 'text-indigo-400/70' : 'text-black/15'}`}>
          {active ? '⟳ verifying · scaleflow.com' : '── waiting for record ──'}
        </div>
        {ARTICLE_PARAS.map((para, i) => (
          <ScanLine
            key={i}
            text={para}
            active={active && paraIdx === i}
            done={active && paraIdx > i}
          />
        ))}
      </div>
      {signalsShown > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-[#080c20] p-3 space-y-1.5">
          <div className="text-[11px] font-bold text-indigo-400/60 uppercase tracking-widest mb-1">Audit findings</div>
          {SIGNALS.slice(0, signalsShown).map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="text-black/40">{s.label}</span>
              <span className={`font-medium ${i === SIGNALS.length - 1 ? 'text-green-400' : 'text-indigo-300/80'}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── right: verified CRM ─────────────────────────────────────────────────────
function CrmVerified({ verifiedCount, currentIdx }: { verifiedCount: number; currentIdx: number }) {
  const rows = CRM_RECORDS.slice(0, currentIdx % CRM_RECORDS.length).reverse().slice(0, 5)

  return (
    <div className="flex flex-col gap-2 w-[148px]">
      <div className="text-[12px] font-bold uppercase tracking-widest text-black/25">
        Audited
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-[#080c20] overflow-hidden">
        <div className="px-3 py-1.5 border-b border-white/[0.05] text-[11px] text-black/20 font-mono flex justify-between">
          <span>verified</span>
          <span className="text-green-400/60">{verifiedCount}</span>
        </div>
        {rows.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-black/20 italic text-center">none yet</div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="px-3 py-2 border-b border-white/[0.04] last:border-0">
            <div className="flex items-center justify-between gap-1">
              <div className="text-[13px] font-semibold text-black/70 truncate">{r.name}</div>
              <span className="text-[11px] font-bold text-green-400 shrink-0">
                {FIT_SCORES[(i + verifiedCount) % FIT_SCORES.length]}%
              </span>
            </div>
            <div className="text-[12px] text-black/25">{r.co}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── agent positions ──────────────────────────────────────────────────────────
const PHASE_X: Record<Phase, number> = {
  'idle':             6,
  'to-crm':           6,
  'pickup':           6,
  'to-research':      44,
  'researching':      44,
  'pickup-verified':  44,
  'to-verified':      88,
  'deposit':          88,
}

function CrmViz() {
  const [phase, setPhase]             = useState<Phase>('idle')
  const [agentX, setAgentX]           = useState(6)
  const [carrying, setCarrying]       = useState(false)
  const [carryVerified, setCarryVerified] = useState(false)
  const [recordIdx, setRecordIdx]     = useState(0)
  const [verifiedCount, setVerifiedCount] = useState(0)
  const [paraIdx, setParaIdx]         = useState(-1)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const go = async () => {
      while (alive.current) {
        await sleep(800)
        if (!alive.current) return

        // agent walks to CRM pile
        setPhase('to-crm'); setAgentX(PHASE_X['to-crm'])
        await sleep(500)

        // picks up record
        setPhase('pickup'); setCarrying(true); setCarryVerified(false)
        await sleep(400)

        // walks to audit station
        setPhase('to-research'); setAgentX(PHASE_X['to-research'])
        await sleep(850)

        // drops off, audit begins
        setPhase('researching'); setCarrying(false); setParaIdx(0)
        await sleep(1600)
        if (!alive.current) return
        setParaIdx(1)
        await sleep(1800)
        if (!alive.current) return
        setParaIdx(2)
        await sleep(1400)
        if (!alive.current) return
        setParaIdx(3) // verdict signal
        await sleep(800)
        if (!alive.current) return

        // picks up verified record
        setPhase('pickup-verified'); setCarrying(true); setCarryVerified(true)
        await sleep(400)

        // carries to verified column
        setPhase('to-verified'); setAgentX(PHASE_X['to-verified'])
        await sleep(850)

        // deposits
        setPhase('deposit')
        setCarrying(false); setCarryVerified(false)
        setVerifiedCount(c => c + 1)
        setRecordIdx(i => i + 1)
        setParaIdx(-1)
        await sleep(500)

        setPhase('idle')
      }
    }
    go()
    return () => { alive.current = false }
  }, [])

  return (
    <div style={{ minHeight: 480 }}>
      {/* track */}
      <div className="relative px-4 py-5" style={{ height: 100 }}>
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 border-t border-dashed border-white/[0.08]" />
        {[{ x: '6%' }, { x: '44%' }, { x: '88%' }].map(({ x }, i) => (
          <div key={i} className="absolute top-1/2 -translate-y-1/2" style={{ left: x }}>
            <div className="w-2 h-2 rounded-full bg-white/15" />
          </div>
        ))}
        <div
          className="absolute top-1/2 -translate-y-[60%] -translate-x-1/2 transition-all"
          style={{
            left: `${agentX}%`,
            transitionDuration: ['to-crm','to-research','to-verified'].includes(phase) ? '850ms' : '300ms',
            transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <AgentBot carrying={carrying} verified={carryVerified} />
        </div>
      </div>

      {/* stations */}
      <div className="px-4 pb-5 flex items-start justify-between gap-3">
        <CrmUnverified active={phase === 'to-crm' || phase === 'pickup'} currentIdx={recordIdx} />
        <AuditStation phase={phase} paraIdx={paraIdx} />
        <CrmVerified verifiedCount={verifiedCount} currentIdx={recordIdx} />
      </div>
    </div>
  )
}

// ── section ──────────────────────────────────────────────────────────────────
export function CrmPipelineSection() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        <div className="flex-1 max-w-[420px] shrink-0">
          <p className="enter-0 text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">CRM Auditor</p>
          <h2 className="enter-1 text-5xl xl:text-6xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
            Audits your CRM.<br />Verifies every lead.
          </h2>
          <p className="enter-2 text-black/50 text-lg leading-relaxed mb-8">
            Meridian works through your existing CRM records one by one, re-researching each contact with live signals, verifying fit, and flagging anyone worth re-engaging before you waste a send.
          </p>
          <div className="enter-3 space-y-3 mb-10">
            {[
              'Re-researches every contact with live web signals',
              'Flags stale records, bad fits, and missed opps',
              'Scores each lead before it hits your sequence',
              'Writes back verified data to HubSpot or Salesforce',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-black/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Link href="/signin" className="enter-4 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            Start free
          </Link>
        </div>

        <div className="enter-5 flex-1 w-full min-w-0">
          <CrmViz />
        </div>

      </div>
    </section>
  )
}
