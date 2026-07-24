"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function StarButton({
  starred,
  onToggle,
  disabled,
  className,
  iconClassName,
  size = "w-3.5 h-3.5",
}: {
  starred: boolean
  onToggle: (e: React.MouseEvent) => void
  disabled?: boolean
  className?: string
  iconClassName?: string
  size?: string
}) {
  const [burst, setBurst] = useState(0)

  const handleClick = (e: React.MouseEvent) => {
    if (!starred) setBurst(b => b + 1)
    onToggle(e)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn("relative flex items-center justify-center rounded-md p-1 hover:bg-accent disabled:opacity-50", className)}
    >
      <Star
        key={burst}
        className={cn(
          size,
          "transition-colors",
          starred ? cn("text-amber-400 fill-amber-400", burst > 0 && "star-pop") : "text-muted-foreground",
          iconClassName,
        )}
      />
      {starred && burst > 0 && (
        <span key={`ring-${burst}`} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="absolute w-3.5 h-3.5 rounded-full border-2 border-amber-400 star-ring" />
          {[...Array(6)].map((_, k) => (
            <span
              key={k}
              className="absolute w-1 h-1 rounded-full bg-amber-400 star-spark"
              style={{ "--angle": `${k * 60}deg` } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </button>
  )
}
