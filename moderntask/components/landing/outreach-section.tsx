'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const LEADS = [
  { name: 'Sarah Chen',  co: 'ScaleFlow',   status: 'Replied',   color: '#4ade80' },
  { name: 'Marcus Lee',  co: 'Finova',      status: 'Opened',    color: '#818cf8' },
  { name: 'Jade Morris', co: 'FleetGrid',   status: 'Follow-up', color: '#6366f1' },
  { name: 'Tom Reyes',   co: 'LayerStack',  status: 'Sent',      color: '#6366f1' },
  { name: 'Nina Patel',  co: 'StitchOps',   status: 'Follow-up', color: '#6366f1' },
  { name: 'Lena Kwon',   co: 'Driftwork',   status: 'Opened',    color: '#818cf8' },
]

// origin x, contact x, SVG height
const OX = 72
const CX = 480
const SVG_H = 340
const SVG_W = 580

function yForIdx(i: number, total: number) {
  const pad = 36
  return pad + (i / (total - 1)) * (SVG_H - pad * 2)
}

function arcPath(y2: number) {
  const y1 = SVG_H / 2
  const mx = (OX + CX) / 2
  return `M ${OX} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${CX} ${y2}`
}

function followupPath(y2: number) {
  const y1 = SVG_H / 2
  const mx1 = OX + (CX - OX) * 0.35
  const mx2 = OX + (CX - OX) * 0.65
  const droop = 18
  return `M ${OX} ${y1} C ${mx1} ${y1 + droop}, ${mx2} ${y2 + droop}, ${CX} ${y2}`
}

function ArcLine({
  path, color, duration, delay, width = 1.5,
}: { path: string; color: string; duration: number; delay: number; width?: number }) {
  const ref = useRef<SVGPathElement>(null)
  const [len, setLen] = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength())
  }, [path])

  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  if (!len) return <path ref={ref} d={path} fill="none" stroke="transparent" strokeWidth={width} />

  return (
    <path
      ref={ref}
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={len}
      strokeDashoffset={active ? 0 : len}
      style={{
        transition: active ? `stroke-dashoffset ${duration}ms cubic-bezier(0.4,0,0.2,1)` : 'none',
        opacity: active ? 1 : 0,
      }}
    />
  )
}

function Dot({ cx, cy, color, delay }: { cx: number; cy: number; color: string; delay: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <circle
      cx={cx} cy={cy} r={4}
      fill={color}
      style={{ opacity: show ? 1 : 0, transition: show ? 'opacity 0.3s' : 'none' }}
    />
  )
}

function EmailViz() {
  const total = LEADS.length
  // stagger: each lead's primary arc starts 280ms apart
  // follow-up arcs start 900ms after the primary

  return (
    <div className="relative rounded-2xl border border-white/[0.1] bg-[#06081a] overflow-hidden shadow-2xl shadow-black/60"
      style={{ width: SVG_W, maxWidth: '100%' }}>
      {/* top bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/20 font-mono">outreach · live</span>
      </div>

      <div className="relative" style={{ height: SVG_H }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="absolute inset-0 w-full h-full"
        >
          {/* origin node */}
          <circle cx={OX} cy={SVG_H / 2} r={14} fill="#0e1a4a" stroke="rgba(99,102,241,0.6)" strokeWidth={1.5} />
          <text x={OX} y={SVG_H / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="rgba(165,180,252,0.9)">✉</text>

          {LEADS.map((lead, i) => {
            const y = yForIdx(i, total)
            const primaryDelay = 300 + i * 260
            const arcDur = 600
            const dotDelay = primaryDelay + arcDur
            const hasFollowup = lead.status === 'Follow-up'
            const followupDelay = primaryDelay + 1100 + i * 80

            return (
              <g key={i}>
                {/* primary arc */}
                <ArcLine
                  path={arcPath(y)}
                  color={lead.status === 'Replied' ? 'rgba(74,222,128,0.5)' : 'rgba(99,102,241,0.45)'}
                  duration={arcDur}
                  delay={primaryDelay}
                />
                {/* follow-up arc */}
                {hasFollowup && (
                  <ArcLine
                    path={followupPath(y)}
                    color="rgba(99,102,241,0.25)"
                    duration={500}
                    delay={followupDelay}
                    width={1}
                  />
                )}
                {/* contact dot */}
                <Dot cx={CX} cy={y} color={lead.color} delay={dotDelay} />
              </g>
            )
          })}
        </svg>

        {/* contact cards on the right */}
        <div className="absolute right-0 top-0 h-full flex flex-col justify-around pr-4 pl-2" style={{ width: SVG_W - CX + 8 }}>
          {LEADS.map((lead, i) => {
            const primaryDelay = 300 + i * 260
            const showDelay = primaryDelay + 600
            return (
              <ContactRow key={i} lead={lead} delay={showDelay} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ContactRow({ lead, delay }: { lead: typeof LEADS[0]; delay: number }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const statusColors: Record<string, string> = {
    'Replied':   'bg-green-500/20 text-green-400',
    'Opened':    'bg-indigo-500/20 text-indigo-400',
    'Follow-up': 'bg-white/[0.06] text-white/35',
    'Sent':      'bg-white/[0.06] text-white/35',
  }

  return (
    <div
      className="flex items-center gap-2 transition-all duration-300"
      style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'translateX(6px)' }}
    >
      <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-[9px] font-bold shrink-0">
        {lead.name[0]}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-white/80 truncate">{lead.name}</div>
        <div className="text-[9px] text-white/30 truncate">{lead.co}</div>
      </div>
      <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusColors[lead.status]}`}>
        {lead.status}
      </span>
    </div>
  )
}

export function OutreachSection() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* left: copy */}
        <div className="flex-1 max-w-[460px]">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">Outreach</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Sends. Tracks.<br />Follows up.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Every email fires from your real inbox. Opens get tracked, follow-ups go out automatically, and the moment someone replies — all sequences stop instantly.
          </p>
          <div className="space-y-3 mb-10">
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
          <Link href="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            Start free
          </Link>
        </div>

        {/* right: visualization */}
        <div className="flex-1 flex justify-center lg:justify-end">
          <EmailViz />
        </div>

      </div>
    </section>
  )
}
