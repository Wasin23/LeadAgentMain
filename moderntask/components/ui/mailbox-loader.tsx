"use client"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import { useTheme } from "@/components/theme-provider"

/**
 * Refined loading UI:
 * a letter drifts down and slides into a minimalist mailbox.
 * A soft flash + ripple confirms delivery, the flag lifts,
 * then the whole scene fades and blurs away.
 *
 * onComplete fires ~350ms before the visual fade-out starts (not when the
 * scene finally disappears) so the destination page has a head start
 * mounting/fetching underneath the still-opaque overlay — otherwise the
 * exit fade reveals a half-loaded page and it reads as a lag/stutter.
 */
export function MailboxLoader({
  onComplete,
  duration = 2800,
}: {
  onComplete?: () => void
  duration?: number
}) {
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(false)
  const reduce = useReducedMotion()
  const { resolvedTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const navigateLeadMs = Math.min(350, duration)
    const navigateT = setTimeout(() => onComplete?.(), duration - navigateLeadMs)
    const hideT = setTimeout(() => setVisible(false), duration)
    return () => {
      clearTimeout(navigateT)
      clearTimeout(hideT)
    }
  }, [duration, onComplete])

  // Default to dark (matches the original design) until the theme is known
  // client-side, to avoid a flash of the wrong palette on first paint.
  const isDark = !mounted || resolvedTheme === "dark"

  const bg = isDark ? "#0a0c0a" : "#f4efe6"
  const vignette = isDark ? "rgba(201,180,95,0.08)" : "rgba(201,180,95,0.18)"
  const gridLine = isDark ? "rgba(255,255,255,0.5)" : "rgba(10,12,10,0.45)"
  const groundShadow = isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.22)"
  const labelColor = isDark ? "#a9a89f" : "#6b6a5f"
  const subtitleColor = isDark ? "#6a6b64" : "#8a8878"
  const barTrack = isDark ? "rgba(255,255,255,0.06)" : "rgba(10,12,10,0.08)"

  // Smooth, "expressive" cubic bezier used across the scene
  const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]
  const easeInOutQuint: [number, number, number, number] = [0.83, 0, 0.17, 1]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mailbox-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(12px)" }}
          transition={{ duration: 0.6, ease: easeInOutQuint }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: bg }}
        >
          {/* Ambient vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 60% 50% at 50% 45%, ${vignette}, transparent 70%)`,
            }}
          />
          {/* Subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse 50% 40% at 50% 50%, black, transparent 75%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.7, ease: easeOutExpo }}
            className="relative flex flex-col items-center"
          >
            {/* Stage */}
            <div className="relative h-64 w-72">
              {/* Ground shadow (grows as envelope descends) */}
              <motion.div
                className="absolute left-1/2 top-[236px] h-2 w-40 -translate-x-1/2 rounded-[50%] blur-md"
                style={{ backgroundColor: groundShadow }}
                initial={{ opacity: 0.3, scaleX: 0.9 }}
                animate={{ opacity: [0.3, 0.55, 0.4], scaleX: [0.9, 1.1, 1] }}
                transition={{ duration: 1.6, delay: 0.9, ease: easeOutExpo }}
              />

              {/* Envelope — slides down and disappears into the slot */}
              <motion.div
                className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
                initial={{ y: -40, opacity: 0, scale: 1 }}
                animate={
                  reduce
                    ? { y: 120, opacity: 1 }
                    : {
                        y: [-40, 108, 150, 168],
                        opacity: [0, 1, 1, 0],
                        scale: [1, 1, 0.5, 0.2],
                      }
                }
                transition={{
                  duration: 1.7,
                  times: [0, 0.55, 0.9, 1],
                  ease: easeOutExpo,
                }}
              >
                <motion.div
                  animate={
                    reduce
                      ? {}
                      : { rotate: [-3, 2, 0], y: [0, -2, 0] }
                  }
                  transition={{
                    duration: 1.7,
                    times: [0, 0.7, 1],
                    ease: "easeInOut",
                  }}
                >
                  <svg
                    width="96"
                    height="66"
                    viewBox="0 0 96 66"
                    className="drop-shadow-[0_12px_18px_rgba(0,0,0,0.55)]"
                  >
                    <defs>
                      <linearGradient id="env-face" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#faf7ef" />
                        <stop offset="100%" stopColor="#ebe5d3" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="1"
                      y="1"
                      width="94"
                      height="64"
                      rx="5"
                      fill="url(#env-face)"
                      stroke="#d9d4c5"
                      strokeWidth="1"
                    />
                    <path
                      d="M2 4 L48 40 L94 4"
                      fill="none"
                      stroke="#c9b45f"
                      strokeWidth="1.25"
                      strokeLinejoin="round"
                    />
                    <circle cx="48" cy="42" r="4.5" fill="#c9b45f" opacity="0.95" />
                    <circle cx="48" cy="42" r="1.5" fill="#0a0c0a" opacity="0.4" />
                  </svg>
                </motion.div>
              </motion.div>

              {/* Slot flash — aligned with actual mailbox slot */}
              <motion.div
                className="absolute left-1/2 top-[176px] z-40 h-[2px] w-[82px] -translate-x-1/2 rounded-full bg-[#c9b45f]"
                style={{ boxShadow: "0 0 18px 3px rgba(201,180,95,0.7)" }}
                initial={{ opacity: 0, scaleX: 0.5 }}
                animate={{ opacity: [0, 1, 0], scaleX: [0.5, 1.1, 0.95] }}
                transition={{ duration: 0.7, delay: 1.4, ease: easeOutExpo }}
              />

              {/* Ripple */}
              <motion.div
                className="absolute left-1/2 top-[176px] z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c9b45f]/70"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.5, 0], scale: [0.5, 2.4, 2.8] }}
                transition={{ duration: 1.3, delay: 1.45, ease: easeOutExpo }}
              />

              {/* Mailbox */}
              <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-end">
                {/* Flag */}
                <motion.svg
                  width="18"
                  height="52"
                  viewBox="0 0 18 52"
                  className="-mr-[3px]"
                  style={{ transformOrigin: "4px 50px" }}
                  initial={{ rotate: 92 }}
                  animate={reduce ? { rotate: 0 } : { rotate: [92, 92, 0] }}
                  transition={{
                    duration: 0.85,
                    delay: 1.55,
                    times: [0, 0.15, 1],
                    ease: [0.34, 1.4, 0.5, 1],
                  }}
                >
                  <rect x="3" y="6" width="2" height="46" fill="#8a8b85" />
                  <path d="M5 6 L17 6 L14 14 L17 22 L5 22 Z" fill="#d9524a" />
                </motion.svg>

                {/* Mailbox body */}
                <svg width="150" height="96" viewBox="0 0 150 96">
                  <defs>
                    <linearGradient id="mb-body" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#20241f" />
                      <stop offset="100%" stopColor="#121412" />
                    </linearGradient>
                  </defs>
                  {/* post */}
                  <rect x="70" y="74" width="10" height="22" fill="#1a1d1a" />
                  {/* body */}
                  <path
                    d="M8 40 Q8 12 48 12 L124 12 Q142 12 142 40 L142 78 Q142 82 138 82 L12 82 Q8 82 8 78 Z"
                    fill="url(#mb-body)"
                    stroke="#2c312b"
                    strokeWidth="1"
                  />
                  {/* highlight */}
                  <path
                    d="M14 22 Q22 16 40 15"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                    fill="none"
                  />
                  {/* slot */}
                  <rect x="34" y="30" width="82" height="4" rx="2" fill="#050605" />
                  {/* door seam */}
                  <path
                    d="M20 46 Q20 24 50 24 L100 24 Q130 24 130 46 L130 76"
                    fill="none"
                    stroke="#2c312b"
                    strokeWidth="1"
                  />
                  {/* knob */}
                  <circle cx="120" cy="60" r="1.8" fill="#c9b45f" />
                </svg>
              </div>
            </div>

            {/* Label */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <div
                className="flex items-center gap-2.5 text-[11px] font-medium tracking-[0.32em]"
                style={{ color: labelColor }}
              >
                <span className="text-[#c9b45f]">◈</span>
                <span>MERIDIAN</span>
              </div>
              <div className="text-[11px] tracking-wide" style={{ color: subtitleColor }}>
                Preparing your workspace
              </div>
              <div
                className="relative mt-1 h-[2px] w-44 overflow-hidden rounded-full"
                style={{ backgroundColor: barTrack }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#c9b45f]/60 via-[#c9b45f] to-[#c9b45f]/60"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: duration / 1000,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
