'use client'

import { useEffect, useRef } from 'react'

// Soft color glows that drift slowly across the grid
const GLOWS = [
  { x: 0.18, y: 0.28, r: 0.52, color: '139,92,246' },   // violet
  { x: 0.72, y: 0.18, r: 0.48, color: '99,102,241' },   // indigo
  { x: 0.85, y: 0.65, r: 0.44, color: '59,130,246' },   // blue
  { x: 0.35, y: 0.80, r: 0.40, color: '168,85,247' },   // purple
  { x: 0.60, y: 0.45, r: 0.36, color: '99,102,241' },   // indigo
]

const DRIFT = [
  { sx: 0.025, sy: 0.018, px: 0.0,  py: 0.0  },
  { sx: 0.018, sy: 0.022, px: 1.4,  py: 0.8  },
  { sx: 0.020, sy: 0.015, px: 2.6,  py: 1.9  },
  { sx: 0.015, sy: 0.025, px: 0.9,  py: 3.1  },
  { sx: 0.022, sy: 0.019, px: 3.5,  py: 2.2  },
]

export function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let t = 0

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      raf = requestAnimationFrame(draw)
      t += 0.0018

      const W = canvas.width
      const H = canvas.height

      // White base
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)

      // Soft color glows
      GLOWS.forEach((g, i) => {
        const d = DRIFT[i]
        const cx = (g.x + Math.sin(t * d.sx + d.px) * 0.08) * W
        const cy = (g.y + Math.cos(t * d.sy + d.py) * 0.06) * H
        const rad = g.r * Math.max(W, H)

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
        grad.addColorStop(0,   `rgba(${g.color},0.13)`)
        grad.addColorStop(0.5, `rgba(${g.color},0.06)`)
        grad.addColorStop(1,   `rgba(${g.color},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      })

      // Dot grid - draw on top of glows
      const spacing = 28
      const dotR    = 1.1
      const cols = Math.ceil(W / spacing) + 1
      const rows = Math.ceil(H / spacing) + 1

      ctx.fillStyle = 'rgba(0,0,0,0.13)'
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing
          const y = r * spacing
          ctx.beginPath()
          ctx.arc(x, y, dotR, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
