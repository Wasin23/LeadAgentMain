'use client'

import { useState, useRef, useEffect, useCallback, Children, ReactNode } from 'react'

export function FeaturesCarousel({ children, labels = [] }: { children: ReactNode; labels?: string[] }) {
  const steps = Children.toArray(children)
  const total = steps.length
  const [step, setStep] = useState(0)
  const throttleRef = useRef(0)
  const touchStartY = useRef(0)

  const advance = useCallback((dir: 1 | -1) => {
    const now = Date.now()
    if (now - throttleRef.current < 700) return
    throttleRef.current = now
    setStep(s => Math.max(0, Math.min(total - 1, s + dir)))
  }, [total])

  // wheel — always intercept since this is the whole page
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      advance(e.deltaY > 0 ? 1 : -1)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [advance])

  // touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(delta) > 40) advance(delta > 0 ? 1 : -1)
  }

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') advance(1)
      if (e.key === 'ArrowUp') advance(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  return (
    <div
      className="relative h-screen overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* slide strip */}
      <div
        className="will-change-transform"
        style={{
          transform: `translateY(-${step * 100}%)`,
          transition: 'transform 680ms cubic-bezier(0.76, 0, 0.24, 1)',
        }}
      >
        {steps.map((child, i) => (
          <div key={i} className="h-screen w-full overflow-hidden">
            {child}
          </div>
        ))}
      </div>

      {/* right-side nav dots */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            aria-label={labels[i] ?? ''}
            className="group flex items-center gap-2"
          >
            <span className={`block rounded-full transition-all duration-300 ${
              i === step
                ? 'w-1.5 h-6 bg-indigo-400'
                : 'w-1.5 h-1.5 bg-white/20 group-hover:bg-white/40'
            }`} />
          </button>
        ))}
      </div>

      {/* bottom-left step label */}
      <div className="absolute left-8 bottom-8 z-30 flex items-center gap-4 select-none">
        <span className="font-mono text-white/20 text-xs tabular-nums">
          {String(step + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        {labels[step] && (
          <span className="text-white/35 text-xs font-medium">{labels[step]}</span>
        )}
      </div>

      {/* prev / next arrows */}
      <div className="absolute bottom-8 right-8 z-30 flex gap-2">
        <button
          onClick={() => advance(-1)}
          disabled={step === 0}
          className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/30 transition-all disabled:opacity-20"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 9L2 5l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 5H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          onClick={() => advance(1)}
          disabled={step === total - 1}
          className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/30 hover:text-white/70 hover:border-white/30 transition-all disabled:opacity-20"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
