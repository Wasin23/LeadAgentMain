'use client'

import { useEffect } from 'react'

// These modals are hand-rolled fixed overlays, not a Radix Dialog, so background scroll
// isn't blocked automatically — without this, the page underneath keeps scrolling (and
// stays clickable) while a modal is open. Restores the previous value on close/unmount so
// nested modals don't clobber each other.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    // Hiding the scrollbar (below) frees up its width, which shifts all fixed/body content
    // rightward by that amount — pad it back so the page doesn't visibly shift when a modal
    // opens/closes.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      const currentPaddingRight = parseFloat(previousPaddingRight || '0') || 0
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`
    }
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [active])
}
