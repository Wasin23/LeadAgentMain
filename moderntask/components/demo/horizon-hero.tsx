'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

type ThreeRefs = {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  stars: THREE.Points[];
  nebula: THREE.Mesh | null;
  mountains: THREE.Mesh[];
  animationId: number | null;
  targetCameraX: number;
  targetCameraY: number;
  targetCameraZ: number;
  locations: number[];
};

export function HorizonHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const smoothCameraPos = useRef({ x: 0, y: 30, z: 100 });
  const threeRefs = useRef<ThreeRefs>({
    scene: null, camera: null, renderer: null,
    stars: [], nebula: null, mountains: [],
    animationId: null,
    targetCameraX: 0, targetCameraY: 30, targetCameraZ: 100,
    locations: [],
  });

  useEffect(() => {
    const refs = threeRefs.current;
    if (!canvasRef.current) return;

    // Scene
    refs.scene = new THREE.Scene();
    refs.scene.fog = new THREE.FogExp2(0x000000, 0.00025);

    refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    refs.camera.position.set(0, 20, 100);

    refs.renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    refs.renderer.setSize(window.innerWidth, window.innerHeight);
    refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    refs.renderer.toneMappingExposure = 0.6;

    // Stars
    for (let i = 0; i < 3; i++) {
      const count = 4000;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      for (let j = 0; j < count; j++) {
        const r = 200 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        pos[j * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[j * 3 + 2] = r * Math.cos(phi);
        const c = new THREE.Color();
        const rnd = Math.random();
        if (rnd < 0.7) c.setHSL(0, 0, 0.8 + Math.random() * 0.2);
        else if (rnd < 0.85) c.setHSL(0.67, 0.6, 0.75); // blue-ish
        else c.setHSL(0.8, 0.5, 0.75); // purple-ish
        col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
        sizes[j] = Math.random() * 2 + 0.5;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
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
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const stars = new THREE.Points(geo, mat);
      refs.scene.add(stars);
      refs.stars.push(stars);
    }

    // Nebula plane
    const nebGeo = new THREE.PlaneGeometry(6000, 3000, 60, 60);
    const nebMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
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
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    refs.nebula = new THREE.Mesh(nebGeo, nebMat);
    refs.nebula.position.z = -800;
    refs.scene.add(refs.nebula);

    // Mountains
    const layers = [
      { z: -50, h: 55, color: 0x0d0d1e },
      { z: -100, h: 75, color: 0x0a0a2a },
      { z: -150, h: 95, color: 0x07083a },
      { z: -200, h: 115, color: 0x050540 },
    ];
    layers.forEach(({ z, h, color }, i) => {
      const pts: THREE.Vector2[] = [];
      for (let k = 0; k <= 60; k++) {
        const x = (k / 60 - 0.5) * 1200;
        const y = Math.sin(k * 0.12) * h + Math.sin(k * 0.06) * h * 0.5 - 90;
        pts.push(new THREE.Vector2(x, y));
      }
      pts.push(new THREE.Vector2(6000, -400), new THREE.Vector2(-6000, -400));
      const shape = new THREE.Shape(pts);
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = z;
      mesh.userData = { baseZ: z, index: i };
      refs.scene.add(mesh);
      refs.mountains.push(mesh);
    });
    refs.locations = refs.mountains.map(m => m.position.z);

    // Animate
    const animate = () => {
      refs.animationId = requestAnimationFrame(animate);
      const t = Date.now() * 0.001;
      refs.stars.forEach(s => { (s.material as THREE.ShaderMaterial).uniforms.time.value = t; });
      if (refs.nebula) (refs.nebula.material as THREE.ShaderMaterial).uniforms.time.value = t * 0.4;

      if (refs.camera) {
        const sf = 0.05;
        smoothCameraPos.current.x += (refs.targetCameraX - smoothCameraPos.current.x) * sf;
        smoothCameraPos.current.y += (refs.targetCameraY - smoothCameraPos.current.y) * sf;
        smoothCameraPos.current.z += (refs.targetCameraZ - smoothCameraPos.current.z) * sf;
        refs.camera.position.set(
          smoothCameraPos.current.x + Math.sin(t * 0.1) * 2,
          smoothCameraPos.current.y + Math.cos(t * 0.15) * 1,
          smoothCameraPos.current.z,
        );
        refs.camera.lookAt(0, 10, -400);
      }

      refs.mountains.forEach((m, i) => {
        m.position.x = Math.sin(t * 0.08) * (1 + i * 0.4);
        m.position.y = 50 + Math.cos(t * 0.12) * (0.8 + i * 0.3);
      });

      refs.renderer?.render(refs.scene!, refs.camera!);
    };
    animate();
    setIsReady(true);

    const handleResize = () => {
      if (!refs.camera || !refs.renderer) return;
      refs.camera.aspect = window.innerWidth / window.innerHeight;
      refs.camera.updateProjectionMatrix();
      refs.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (refs.animationId) cancelAnimationFrame(refs.animationId);
      window.removeEventListener('resize', handleResize);
      refs.stars.forEach(s => { s.geometry.dispose(); (s.material as THREE.Material).dispose(); });
      refs.mountains.forEach(m => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
      if (refs.nebula) { refs.nebula.geometry.dispose(); (refs.nebula.material as THREE.Material).dispose(); }
      refs.renderer?.dispose();
    };
  }, []);

  // Scroll → camera
  useEffect(() => {
    const handleScroll = () => {
      const refs = threeRefs.current;
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(scrollY / Math.max(maxScroll, 1), 1);

      const positions = [
        { x: 0, y: 30, z: 300 },
        { x: 0, y: 40, z: -50 },
        { x: 0, y: 50, z: -600 },
      ];
      const section = Math.min(Math.floor(progress * 2), 1);
      const sp = (progress * 2) % 1;
      const cur = positions[section];
      const nxt = positions[section + 1] || cur;
      refs.targetCameraX = cur.x + (nxt.x - cur.x) * sp;
      refs.targetCameraY = cur.y + (nxt.y - cur.y) * sp;
      refs.targetCameraZ = cur.z + (nxt.z - cur.z) * sp;

      refs.mountains.forEach((m, i) => {
        if (progress > 0.7) m.position.z = 600000;
        else m.position.z = refs.locations[i];
      });
      if (refs.nebula) refs.nebula.position.z = progress > 0.7 ? -800 : -800 - scrollY * 0.5;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP text
  useEffect(() => {
    if (!isReady || !titleRef.current || !subtitleRef.current) return;
    const tl = gsap.timeline();
    tl.from(titleRef.current.querySelectorAll('.char'), {
      y: 120, opacity: 0, duration: 1.2, stagger: 0.04, ease: 'power4.out',
    }).from(subtitleRef.current.querySelectorAll('.line'), {
      y: 40, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out',
    }, '-=0.6');
    return () => { tl.kill(); };
  }, [isReady]);

  const words = ['Meridian', 'runs', '24/7.'];

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center px-6">
        <h1 ref={titleRef} className="overflow-hidden mb-6">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {words.map((word, wi) => (
              <span key={wi} className="overflow-hidden inline-block">
                {word.split('').map((ch, ci) => (
                  <span key={ci} className="char inline-block text-6xl md:text-8xl font-black tracking-tight text-white">
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </h1>

        <div ref={subtitleRef} className="space-y-2 mb-10">
          <p className="line text-xl text-white/50 max-w-xl">
            AI agents that research leads and write personalized emails
          </p>
          <p className="line text-xl text-white/50 max-w-xl">
            — sent from your own inbox, automatically.
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/signin"
            className="group flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-white/90 transition-all hover:scale-105"
          >
            Start free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="px-8 py-4 border border-white/20 hover:border-white/50 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 backdrop-blur-sm bg-white/5">
            See demo
          </button>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs tracking-widest uppercase">
        <span>Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </div>
  );
}
