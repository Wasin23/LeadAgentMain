'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function StarField({ fixed = false }: { fixed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x03050d, 0.00025)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
    camera.position.set(0, 30, 100)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.6

    const starLayers: THREE.Points[] = []
    for (let i = 0; i < 3; i++) {
      const count = 4000
      const geo = new THREE.BufferGeometry()
      const pos   = new Float32Array(count * 3)
      const col   = new Float32Array(count * 3)
      const sizes = new Float32Array(count)
      for (let j = 0; j < count; j++) {
        const r     = 200 + Math.random() * 800
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(Math.random() * 2 - 1)
        pos[j * 3]     = r * Math.sin(phi) * Math.cos(theta)
        pos[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        pos[j * 3 + 2] = r * Math.cos(phi)
        const c   = new THREE.Color()
        const rnd = Math.random()
        if (rnd < 0.7)       c.setHSL(0,    0,   0.8 + Math.random() * 0.2)
        else if (rnd < 0.85) c.setHSL(0.67, 0.6, 0.75)
        else                 c.setHSL(0.8,  0.5, 0.75)
        col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b
        sizes[j] = Math.random() * 2 + 0.5
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3))
      geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1))
      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, depth: { value: i } },
        vertexShader: `
          attribute float size; attribute vec3 color; varying vec3 vColor;
          uniform float time; uniform float depth;
          void main() {
            vColor = color;
            vec3 p = position;
            float a = time * 0.04 * (1.0 - depth * 0.3);
            mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
            p.xy = rot * p.xy;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = size * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            gl_FragColor = vec4(vColor, 1.0 - smoothstep(0.0, 0.5, d));
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const points = new THREE.Points(geo, mat)
      scene.add(points)
      starLayers.push(points)
    }

    const nebGeo = new THREE.PlaneGeometry(6000, 3000, 60, 60)
    const nebMat = new THREE.ShaderMaterial({
      uniforms: {
        time:   { value: 0 },
        color1: { value: new THREE.Color(0x1a0066) },
        color2: { value: new THREE.Color(0x4400aa) },
      },
      vertexShader: `
        varying vec2 vUv; uniform float time;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(p.x * 0.008 + time) * cos(p.y * 0.008 + time) * 15.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 color1; uniform vec3 color2; uniform float time;
        varying vec2 vUv;
        void main() {
          float m = sin(vUv.x * 8.0 + time) * cos(vUv.y * 8.0 + time);
          vec3 col = mix(color1, color2, m * 0.5 + 0.5);
          float a = 0.25 * (1.0 - length(vUv - 0.5) * 2.0);
          gl_FragColor = vec4(col, max(a, 0.0));
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const nebula = new THREE.Mesh(nebGeo, nebMat)
    nebula.position.z = -800
    scene.add(nebula)

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = Date.now() * 0.001
      starLayers.forEach(s => { (s.material as THREE.ShaderMaterial).uniforms.time.value = t });
      (nebMat as THREE.ShaderMaterial).uniforms.time.value = t * 0.4
      // Match HorizonHero's camera drift exactly so they look continuous
      camera.position.x = Math.sin(t * 0.1) * 2
      camera.position.y = 30 + Math.cos(t * 0.15) * 1
      camera.position.z = 100
      camera.lookAt(0, 10, -400)
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      starLayers.forEach(s => { s.geometry.dispose(); (s.material as THREE.Material).dispose() })
      nebGeo.dispose(); nebMat.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={fixed
        ? 'fixed inset-0 w-screen h-screen pointer-events-none -z-10'
        : 'absolute inset-0 w-full h-full pointer-events-none'}
      style={{ background: '#03050d' }}
    />
  )
}
