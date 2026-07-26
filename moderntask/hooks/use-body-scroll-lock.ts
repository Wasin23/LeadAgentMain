'use client'

import { useEffect } from 'react'

// These modals are hand-rolled fixed overlays, not a Radix Dialog, so background scroll
// isn't blocked automatically — without this, the page underneath keeps scrolling (and
// stays clickable) while a modal is open. Restores the previous value on close/unmount so
// nested modals don't clobber each other.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [active])
}
