"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What does this show?"
            className="inline-flex items-center justify-center rounded-full text-success hover:text-success/80 transition-colors"
          >
            <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
