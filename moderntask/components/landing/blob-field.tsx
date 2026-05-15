'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const N = 6

// RGB triplets (0-1) — one palette per carousel section
// Colors are saturated but a touch light so they mesh-blend nicely over white
const PALETTES: [number, number, number][][] = [
  // 0 Hero — violet / sky-blue / rose / teal / indigo / amber
  [[0.68, 0.36, 0.96], [0.24, 0.58, 0.98], [0.96, 0.36, 0.68], [0.10, 0.76, 0.76], [0.48, 0.36, 0.96], [0.96, 0.68, 0.28]],
  // 1 Agents — blue / cyan / sky / azure / periwinkle / aqua
  [[0.20, 0.52, 0.96], [0.04, 0.80, 0.88], [0.28, 0.68, 0.98], [0.08, 0.72, 0.92], [0.44, 0.52, 0.96], [0.04, 0.84, 0.80]],
  // 2 AI Research — teal / green / cyan / mint / emerald / sky
  [[0.08, 0.76, 0.68], [0.12, 0.80, 0.44], [0.04, 0.80, 0.88], [0.24, 0.96, 0.72], [0.04, 0.68, 0.48], [0.24, 0.76, 0.96]],
  // 3 Outreach — coral / pink / amber / orange / rose / yellow
  [[0.96, 0.44, 0.32], [0.96, 0.32, 0.64], [0.96, 0.68, 0.16], [0.96, 0.52, 0.20], [0.92, 0.24, 0.52], [0.92, 0.84, 0.12]],
  // 4 CRM — green / lime / teal / sage / emerald / mint
  [[0.12, 0.76, 0.44], [0.52, 0.92, 0.20], [0.08, 0.76, 0.68], [0.40, 0.80, 0.48], [0.04, 0.68, 0.40], [0.28, 0.92, 0.64]],
  // 5 Teams — violet / pink / purple / lilac / magenta / lavender
  [[0.60, 0.24, 0.96], [0.96, 0.28, 0.68], [0.48, 0.16, 0.88], [0.76, 0.52, 0.96], [0.92, 0.24, 0.76], [0.68, 0.44, 0.96]],
  // 6 Pricing — indigo / blue / violet / blue-purple / sky / deep-violet
  [[0.36, 0.32, 0.96], [0.20, 0.52, 0.96], [0.60, 0.24, 0.96], [0.44, 0.52, 0.96], [0.20, 0.68, 0.98], [0.52, 0.28, 0.96]],
  // 7 FAQ — calm blue / teal / sky
  [[0.20, 0.52, 0.96], [0.08, 0.76, 0.76], [0.32, 0.64, 0.96], [0.12, 0.80, 0.88], [0.40, 0.60, 0.96], [0.08, 0.72, 0.80]],
  // 8 Footer — muted blue-greys
  [[0.48, 0.60, 0.84], [0.40, 0.68, 0.88], [0.56, 0.64, 0.84], [0.44, 0.72, 0.88], [0.52, 0.64, 0.84], [0.36, 0.60, 0.84]],
]

// Base orbit centres, orbital radii, speeds, and phase offsets per blob
const BASE: [number, number][] = [
  [0.18, 0.78], [0.82, 0.22], [0.50, 0.55],
  [0.72, 0.82], [0.28, 0.32], [0.58, 0.12],
]
const ORBIT = [0.22, 0.18, 0.15, 0.20, 0.16, 0.19]
const SPEED = [0.10, 0.07, 0.09, 0.08, 0.11, 0.06]
const PHASE = [0.00, 1.30, 2.50, 0.75, 1.90, 3.20]

const vert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const frag = /* glsl */`
precision mediump float;
#define N ${N}
varying vec2 vUv;
uniform vec2  u_blobs[N];
uniform vec3  u_colors[N];
uniform vec2  u_res;

void main() {
  vec2 uv = vUv;
  float asp = u_res.x / u_res.y;
  uv.x *= asp;

  vec3  wCol = vec3(0.0);
  float wSum = 0.0;

  for (int i = 0; i < N; i++) {
    vec2 p = u_blobs[i];
    p.x *= asp;
    float d  = distance(uv, p);
    float w  = exp(-d * d * 2.8);
    wCol += u_colors[i] * w;
    wSum += w;
  }

  // weighted average colour, blended toward white where influence is low
  vec3 blended = wSum > 0.0 ? wCol / wSum : vec3(1.0);
  float influence = clamp(wSum * 1.6, 0.0, 1.0);
  vec3 col = mix(vec3(1.0), blended, influence * 0.72);

  gl_FragColor = vec4(col, 1.0);
}`

export function BlobField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    renderer.setPixelRatio(1) // intentionally low — blobs are huge, aliasing irrelevant
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const blobVec  = BASE.map(([x, y]) => new THREE.Vector2(x, y))
    const colorVec = PALETTES[0].map(([r, g, b]) => new THREE.Color(r, g, b))

    const uniforms = {
      u_blobs:  { value: blobVec },
      u_colors: { value: colorVec },
      u_res:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    }

    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms }),
    ))

    // Current and target colour channels for smooth lerping
    const cur  = PALETTES[0].map(c => [...c] as [number, number, number])
    const tgt  = PALETTES[0].map(c => [...c] as [number, number, number])

    const onStep = (e: Event) => {
      const step = (e as CustomEvent).detail.step as number
      const pal  = PALETTES[Math.min(step, PALETTES.length - 1)]
      for (let i = 0; i < N; i++) tgt[i] = [...pal[i]]
    }
    window.addEventListener('carousel-step', onStep)

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.u_res.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    let raf: number
    let t = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      t += 0.004

      for (let i = 0; i < N; i++) {
        // drift positions on slow Lissajous paths
        const bx = BASE[i][0] + Math.sin(t * SPEED[i] + PHASE[i]) * ORBIT[i]
        const by = BASE[i][1] + Math.cos(t * SPEED[i] * 0.65 + PHASE[i] * 1.4) * ORBIT[i] * 0.75
        uniforms.u_blobs.value[i].set(bx, by)

        // lerp colours
        for (let c = 0; c < 3; c++) {
          cur[i][c] += (tgt[i][c] - cur[i][c]) * 0.018
        }
        uniforms.u_colors.value[i].setRGB(cur[i][0], cur[i][1], cur[i][2])
      }

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('carousel-step', onStep)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
