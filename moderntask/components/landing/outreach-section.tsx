'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const NAMES = [
  ['Sarah Chen', 'ScaleFlow'], ['Marcus Lee', 'Finova'], ['Jade Morris', 'FleetGrid'],
  ['Tom Reyes', 'LayerStack'], ['Nina Patel', 'StitchOps'], ['Lena Kwon', 'Driftwork'],
  ['Alex Park', 'Vantara'], ['Chris Mao', 'Buildbase'], ['Dana Wu', 'Corepath'],
  ['Sam Ellis', 'Ironveil'], ['Priya Nair', 'Stacklane'], ['Jordan Hill', 'Novafront'],
  ['Riley Stone', 'Crestmark'], ['Casey Liu', 'Pulsedata'], ['Morgan West', 'Gridpoint'],
  ['Taylor Yoon', 'Driftco'], ['Quinn Blake', 'Arcflow'], ['Drew Shin', 'Basecamp'],
]

const STATUSES = ['Sent', 'Opened', 'Replied', 'Follow-up', 'Opened', 'Sent', 'Replied']

type Pulse = { ax: number; ay: number; bx: number; by: number; t: number; color: string }
type Node = {
  x: number; y: number; z: number
  name: string; co: string; status: string
  color: [number, number, number]
  seed: number
}

function spawnNode(zOverride?: number): Node {
  const idx = Math.floor(Math.random() * NAMES.length)
  const si = Math.floor(Math.random() * STATUSES.length)
  const status = STATUSES[si]
  const color: [number, number, number] =
    status === 'Replied'   ? [74, 222, 128] :
    status === 'Opened'    ? [129, 140, 248] :
    status === 'Follow-up' ? [251, 191, 36] :
                             [99, 102, 241]
  return {
    x: (Math.random() - 0.5) * 900,
    y: (Math.random() - 0.5) * 600,
    z: zOverride ?? 900 + Math.random() * 300,
    name: NAMES[idx][0],
    co: NAMES[idx][1],
    status,
    color,
    seed: Math.random(),
  }
}

function NetworkViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setSize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    setSize()

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight
    const FOCAL = 420
    const SPEED = 2.2

    let nodes: Node[] = []
    let pulses: Pulse[] = []
    let frameN = 0

    // seed initial spread
    for (let i = 0; i < 22; i++) nodes.push(spawnNode(80 + Math.random() * 820))

    const proj = (n: Node): [number, number, number] => {
      const s = FOCAL / n.z
      return [W() / 2 + n.x * s, H() / 2 + n.y * s, s]
    }

    const trySpawnPulse = () => {
      if (pulses.length > 6) return
      const visible = nodes.filter(n => n.z > 60 && n.z < 500)
      if (visible.length < 2) return
      const a = visible[Math.floor(Math.random() * visible.length)]
      const b = visible[Math.floor(Math.random() * visible.length)]
      if (a === b) return
      const [ax, ay] = proj(a)
      const [bx, by] = proj(b)
      const [r, g, bl] = a.color
      pulses.push({ ax, ay, bx, by, t: 0, color: `rgba(${r},${g},${bl},0.9)` })
    }

    let raf: number
    const draw = () => {
      const w = W(), h = H()
      ctx.clearRect(0, 0, w, h)
      frameN++

      // advance nodes
      nodes.forEach(n => { n.z -= SPEED })
      nodes = nodes.filter(n => n.z > 20)
      while (nodes.length < 22) nodes.push(spawnNode())

      // spawn pulses
      if (frameN % 38 === 0) trySpawnPulse()

      // advance pulses
      pulses.forEach(p => { p.t += 0.022 })
      pulses = pulses.filter(p => p.t < 1)

      const sorted = [...nodes].sort((a, b) => b.z - a.z)

      // --- draw lines between close nodes ---
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i], b = sorted[j]
          const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
          const dist3 = Math.sqrt(dx*dx + dy*dy + dz*dz)
          if (dist3 > 380) continue
          const [ax, ay, as_] = proj(a)
          const [bx, by, bs] = proj(b)
          const fade = Math.min(as_, bs)
          const alpha = (1 - dist3 / 380) * Math.min(fade * 0.7, 0.35) * Math.min(1, (900 - a.z) / 180)
          if (alpha < 0.01) continue
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.strokeStyle = `rgba(99,102,241,${alpha})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }

      // --- draw pulses ---
      pulses.forEach(p => {
        const ease = p.t < 0.5 ? 2*p.t*p.t : 1-2*(1-p.t)*(1-p.t)
        const x = p.ax + (p.bx - p.ax) * ease
        const y = p.ay + (p.by - p.ay) * ease
        const fade = p.t < 0.15 ? p.t/0.15 : p.t > 0.85 ? (1-p.t)/0.15 : 1
        // trail
        ctx.beginPath()
        ctx.moveTo(p.ax + (p.bx - p.ax) * Math.max(0, ease - 0.12), p.ay + (p.by - p.ay) * Math.max(0, ease - 0.12))
        ctx.lineTo(x, y)
        ctx.strokeStyle = p.color.replace('0.9', String(fade * 0.5))
        ctx.lineWidth = 1.2
        ctx.stroke()
        // dot
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = p.color.replace('0.9', String(fade))
        ctx.fill()
      })

      // --- draw nodes ---
      sorted.forEach(n => {
        const [sx, sy, scale] = proj(n)
        if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) return
        const fadeIn = Math.min(1, (900 - n.z) / 200)
        const alpha = Math.min(1, fadeIn)
        if (alpha < 0.02) return

        const r_ = Math.max(2.5, scale * 7)
        const [r, g, bl] = n.color

        // outer glow
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r_ * 3)
        grd.addColorStop(0, `rgba(${r},${g},${bl},${alpha * 0.25})`)
        grd.addColorStop(1, `rgba(${r},${g},${bl},0)`)
        ctx.beginPath()
        ctx.arc(sx, sy, r_ * 3, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // dot
        ctx.beginPath()
        ctx.arc(sx, sy, r_, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${bl},${alpha})`
        ctx.fill()

        // label
        if (scale > 0.28 && alpha > 0.25) {
          const fs = Math.min(12, Math.max(8, scale * 11))
          ctx.font = `600 ${fs}px Inter, sans-serif`
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`
          ctx.fillText(n.name, sx + r_ + 5, sy)
          ctx.font = `${fs - 1}px Inter, sans-serif`
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.35})`
          ctx.fillText(n.co, sx + r_ + 5, sy + fs + 1)
          // status badge when close
          if (scale > 0.55 && alpha > 0.5) {
            const bw = ctx.measureText(n.status).width + 10
            ctx.fillStyle = `rgba(${r},${g},${bl},${alpha * 0.2})`
            ctx.beginPath()
            ctx.roundRect(sx + r_ + 4, sy + fs * 2 + 2, bw, fs + 4, 3)
            ctx.fill()
            ctx.font = `600 ${fs - 1}px Inter, sans-serif`
            ctx.fillStyle = `rgba(${r},${g},${bl},${alpha * 0.9})`
            ctx.fillText(n.status, sx + r_ + 9, sy + fs * 2 + fs + 2)
          }
        }
      })

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="relative rounded-2xl border border-white/[0.1] bg-[#04060f] overflow-hidden shadow-2xl shadow-black/60 w-full" style={{ height: 420 }}>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] absolute top-0 left-0 right-0 z-10">
        <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
        <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
        <div className="w-2 h-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/20 font-mono">outreach · live</span>
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

export function OutreachSection() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        <div className="flex-1 max-w-[460px] shrink-0">
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

        <div className="flex-1 w-full min-w-0">
          <NetworkViz />
        </div>

      </div>
    </section>
  )
}
