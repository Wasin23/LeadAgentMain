'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ── types ──────────────────────────────────────────────────────────────────
type PulseKind = 'assign' | 'complete' | 'coordinate' | 'ping'

interface Pulse {
  ax: number; ay: number
  bx: number; by: number
  t: number
  kind: PulseKind
}

interface MemberNode {
  id: number
  name: string
  initials: string
  role: string
  x: number; y: number
  hue: [number, number, number]
}

interface AgentNode {
  id: number
  name: string
  type: string
  x: number; y: number
  task: string
  taskT: number   // 0‥1 progress
}

// ── static data ────────────────────────────────────────────────────────────
const MEMBERS: Omit<MemberNode, 'x' | 'y'>[] = [
  { id: 0, name: 'Sarah Chen',  initials: 'SC', role: 'Account Exec',    hue: [99,  102, 241] },
  { id: 1, name: 'Marcus Lee',  initials: 'ML', role: 'SDR Manager',     hue: [74,  222, 128] },
  { id: 2, name: 'Priya Nair',  initials: 'PN', role: 'Growth Lead',     hue: [251, 146,  60] },
  { id: 3, name: 'Jordan Hill', initials: 'JH', role: 'Sales Engineer',  hue: [192, 132, 252] },
]

const AGENTS: Omit<AgentNode, 'x' | 'y' | 'task' | 'taskT'>[] = [
  { id: 10, name: 'Hunter',     type: 'Prospecting'  },
  { id: 11, name: 'Analyst',    type: 'Qualification' },
  { id: 12, name: 'Networker',  type: 'Outreach'     },
]

const AGENT_TASKS = [
  ['Searching Apollo…', 'Filtering ICP…', 'Loading 47 leads…'],
  ['Scoring leads…',    'Pre-qual pass…', 'Flagging 12 fits…'],
  ['Crafting email…',   'Personalizing…', 'Queuing send…'],
]

// ── canvas component ───────────────────────────────────────────────────────
function TeamViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = window.devicePixelRatio || 1
    const setSize = () => {
      dpr = window.devicePixelRatio || 1
      canvas.width  = canvas.offsetWidth  * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    setSize()
    window.addEventListener('resize', setSize)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // ── layout helpers (recomputed each frame so canvas resize works) ──
    const memberPos = (i: number): [number, number] => {
      const padY = H() * 0.18
      const gap  = (H() - padY * 2) / (MEMBERS.length - 1)
      return [W() * 0.18, padY + i * gap]
    }

    const agentPos = (i: number): [number, number] => {
      const cx = W() * 0.62
      const cy = H() * 0.5
      const offsets = [
        [0,  -H() * 0.22],
        [0,   0],
        [0,   H() * 0.22],
      ]
      return [cx + offsets[i][0], cy + offsets[i][1]]
    }

    // ── state ──────────────────────────────────────────────────────────
    let pulses: Pulse[] = []
    let frameN = 0

    // task progress state
    const agentTask  = AGENTS.map((_, i) => ({ taskIdx: 0, t: Math.random() }))
    const taskLabels = AGENT_TASKS.map(tasks => tasks[0])

    // ── pulse spawning ─────────────────────────────────────────────────
    const spawnPulse = () => {
      if (pulses.length >= 9) return
      const roll = Math.random()

      if (roll < 0.40) {
        // member assigns to agent
        const mi = Math.floor(Math.random() * MEMBERS.length)
        const ai = Math.floor(Math.random() * AGENTS.length)
        const [ax, ay] = memberPos(mi)
        const [bx, by] = agentPos(ai)
        pulses.push({ ax, ay, bx, by, t: 0, kind: 'assign' })
      } else if (roll < 0.72) {
        // agent completes back to member
        const mi = Math.floor(Math.random() * MEMBERS.length)
        const ai = Math.floor(Math.random() * AGENTS.length)
        const [ax, ay] = agentPos(ai)
        const [bx, by] = memberPos(mi)
        pulses.push({ ax, ay, bx, by, t: 0, kind: 'complete' })
      } else if (roll < 0.88) {
        // agent coordinates with agent
        const ai = Math.floor(Math.random() * AGENTS.length)
        let bi = Math.floor(Math.random() * AGENTS.length)
        if (bi === ai) bi = (bi + 1) % AGENTS.length
        const [ax, ay] = agentPos(ai)
        const [bx, by] = agentPos(bi)
        pulses.push({ ax, ay, bx, by, t: 0, kind: 'coordinate' })
      } else {
        // members pinging each other
        const mi = Math.floor(Math.random() * MEMBERS.length)
        let mj = Math.floor(Math.random() * MEMBERS.length)
        if (mj === mi) mj = (mj + 1) % MEMBERS.length
        const [ax, ay] = memberPos(mi)
        const [bx, by] = memberPos(mj)
        pulses.push({ ax, ay, bx, by, t: 0, kind: 'ping' })
      }
    }

    const pulseRGB = (kind: PulseKind): [number, number, number] => {
      if (kind === 'assign')     return [99,  102, 241]
      if (kind === 'complete')   return [74,  222, 128]
      if (kind === 'coordinate') return [192, 132, 252]
      return [148, 163, 248]  // ping
    }

    // ── draw helpers ───────────────────────────────────────────────────
    const drawMember = (i: number) => {
      const [x, y] = memberPos(i)
      const m = MEMBERS[i]
      const [r, g, b] = m.hue

      // outer glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 30)
      grd.addColorStop(0, `rgba(${r},${g},${b},0.18)`)
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`)
      ctx.beginPath()
      ctx.arc(x, y, 30, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      // ring
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // fill
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(8,12,30,0.96)'
      ctx.fill()

      // initials
      ctx.font = '700 11px Inter, sans-serif'
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(m.initials, x, y)
      ctx.textBaseline = 'alphabetic'

      // online dot
      ctx.beginPath()
      ctx.arc(x + 12, y - 12, 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(74,222,128,1)'
      ctx.fill()

      // name label right of node
      ctx.textAlign = 'left'
      ctx.font = '600 11px Inter, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.78)'
      ctx.fillText(m.name, x + 23, y - 3)
      ctx.font = '10px Inter, sans-serif'
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
      ctx.fillText(m.role, x + 23, y + 11)
    }

    const drawAgent = (i: number) => {
      const [x, y] = agentPos(i)
      const a = AGENTS[i]

      // glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 36)
      grd.addColorStop(0, 'rgba(99,102,241,0.2)')
      grd.addColorStop(1, 'rgba(99,102,241,0)')
      ctx.beginPath()
      ctx.arc(x, y, 36, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      // outer ring (spinning dash effect)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(frameN * 0.012)
      ctx.beginPath()
      ctx.arc(0, 0, 20, 0, Math.PI * 1.6)
      ctx.strokeStyle = 'rgba(99,102,241,0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // inner fill
      ctx.beginPath()
      ctx.arc(x, y, 16, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(8,12,30,0.96)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 16, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(99,102,241,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()

      // agent icon — simple "brain" square with grid lines
      ctx.strokeStyle = 'rgba(165,180,252,0.85)'
      ctx.lineWidth = 1.1
      const s = 8
      ctx.strokeRect(x - s/2, y - s/2, s, s)
      ctx.beginPath()
      ctx.moveTo(x - s/2, y)
      ctx.lineTo(x + s/2, y)
      ctx.moveTo(x, y - s/2)
      ctx.lineTo(x, y + s/2)
      ctx.stroke()

      // name
      ctx.textAlign = 'left'
      ctx.font = '600 11px Inter, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillText(a.name, x + 25, y - 4)
      ctx.font = '9.5px Inter, sans-serif'
      ctx.fillStyle = 'rgba(99,102,241,0.55)'
      ctx.fillText(a.type, x + 25, y + 9)

      // task progress bar
      const barW = 90, barH = 3
      const bx = x + 25, by = y + 17
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.beginPath()
      ctx.roundRect(bx, by, barW, barH, 2)
      ctx.fill()

      const prog = agentTask[i].t
      ctx.fillStyle = 'rgba(99,102,241,0.7)'
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * prog, barH, 2)
      ctx.fill()

      // current task label
      ctx.font = '9px Inter, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText(taskLabels[i], bx, by + 14)
    }

    const drawPulse = (p: Pulse) => {
      const e = p.t < 0.5 ? 2*p.t*p.t : 1 - 2*(1-p.t)*(1-p.t)
      const x = p.ax + (p.bx - p.ax) * e
      const y = p.ay + (p.by - p.ay) * e
      const [r, g, b] = pulseRGB(p.kind)

      const lineAlpha = p.t > 0.75 ? (1 - (p.t - 0.75) / 0.25) * 0.45 : 0.45
      ctx.beginPath()
      ctx.moveTo(p.ax, p.ay)
      ctx.lineTo(x, y)
      ctx.strokeStyle = `rgba(${r},${g},${b},${lineAlpha})`
      ctx.lineWidth = 1.2
      ctx.stroke()

      const ballAlpha = p.t < 0.08 ? p.t / 0.08 : p.t > 0.82 ? (1 - (p.t - 0.82) / 0.18) : 1
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r},${g},${b},${ballAlpha})`
      ctx.fill()
    }

    // soft connecting lines between members and agents
    const drawConnectors = () => {
      MEMBERS.forEach((_, mi) => {
        AGENTS.forEach((__, ai) => {
          const [ax, ay] = memberPos(mi)
          const [bx, by] = agentPos(ai)
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.strokeStyle = 'rgba(99,102,241,0.05)'
          ctx.lineWidth = 1
          ctx.stroke()
        })
      })
      // agent-agent connectors
      AGENTS.forEach((_, i) => {
        AGENTS.forEach((__, j) => {
          if (j <= i) return
          const [ax, ay] = agentPos(i)
          const [bx, by] = agentPos(j)
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.strokeStyle = 'rgba(192,132,252,0.07)'
          ctx.lineWidth = 1
          ctx.stroke()
        })
      })
    }

    // ── draw loop ──────────────────────────────────────────────────────
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W(), H())
      frameN++

      // advance agent task progress
      AGENTS.forEach((_, i) => {
        agentTask[i].t += 0.0025
        if (agentTask[i].t >= 1) {
          agentTask[i].t = 0
          agentTask[i].taskIdx = (agentTask[i].taskIdx + 1) % AGENT_TASKS[i].length
          taskLabels[i] = AGENT_TASKS[i][agentTask[i].taskIdx]
        }
      })

      if (frameN % 55 === 0) spawnPulse()
      pulses.forEach(p => { p.t += 0.013 })
      pulses = pulses.filter(p => p.t < 1)

      drawConnectors()
      pulses.forEach(drawPulse)
      MEMBERS.forEach((_, i) => drawMember(i))
      AGENTS.forEach((_, i) => drawAgent(i))

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', setSize)
    }
  }, [])

  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-[#04060f] overflow-hidden shadow-2xl shadow-black/60 w-full" style={{ height: 560 }}>
      {/* title bar */}
      <div className="flex items-center px-3 border-b border-white/[0.06] bg-[#141414] relative z-10" style={{ height: 36 }}>
        <span className="text-[10px] text-white/20 font-mono">meridian · workspace</span>
        <span className="ml-3 flex items-center gap-1.5 text-[9px] text-green-400/60 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
          4 members · 3 agents online
        </span>
        <div className="ml-auto flex items-center">
          <button className="w-9 h-9 flex items-center justify-center text-white/25 hover:bg-white/[0.07] text-[13px] leading-none">─</button>
          <button className="w-9 h-9 flex items-center justify-center text-white/25 hover:bg-white/[0.07] text-[11px] leading-none">□</button>
          <button className="w-9 h-9 flex items-center justify-center text-white/25 hover:bg-red-600/70 hover:text-white text-[15px] leading-none rounded-tr-2xl">✕</button>
        </div>
      </div>

      {/* legend */}
      <div className="absolute bottom-3 right-4 z-10 flex items-center gap-3">
        {([
          ['assign',     [99, 102, 241], 'Assign'],
          ['complete',   [74, 222, 128], 'Complete'],
          ['coordinate', [192,132,252],  'Coordinate'],
        ] as const).map(([, rgb, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-5 h-px" style={{ background: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.7)` }} />
            <span className="text-[9px] text-white/25">{label}</span>
          </div>
        ))}
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ top: 36 }} />
    </div>
  )
}

// ── section ────────────────────────────────────────────────────────────────
export function TeamSection() {
  return (
    <section className="relative z-10 pt-36 pb-16 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* left copy */}
        <div className="flex-1 max-w-[460px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">Teams</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            One team.<br />Infinite scale.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Every rep gets their own agents. Every agent shares data with the team. Your whole org moves in concert, no duplicated effort, no dropped balls.
          </p>
          <div className="space-y-3 mb-10">
            {[
              'Assign agents to reps, territories, or campaigns',
              'Shared pipeline visibility across the whole team',
              'Agents coordinate, no duplicate leads sent',
              'Manager view: all activity in one dashboard',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105"
          >
            Start free
          </Link>
        </div>

        {/* right viz */}
        <div className="flex-1 w-full min-w-0">
          <TeamViz />
        </div>

      </div>
    </section>
  )
}
