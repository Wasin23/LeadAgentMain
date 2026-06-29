"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type RangePreset = "7d" | "14d" | "30d" | "90d"

export const PRESET_LABELS: Record<RangePreset, string> = { "7d": "7D", "14d": "14D", "30d": "30D", "90d": "90D" }
export const PRESET_DAYS: Record<RangePreset, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }

interface DateRangePickerProps {
  preset: RangePreset
  onPresetChange: (preset: RangePreset) => void
  customRange: DateRange | undefined
  onCustomRangeChange: (range: DateRange | undefined) => void
  /** earliest selectable day — charts only have data back this far */
  minDate?: Date
}

export function DateRangePicker({ preset, onPresetChange, customRange, onCustomRangeChange, minDate }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(customRange)
  const isCustom = !!(customRange?.from && customRange?.to)

  const label = isCustom
    ? `${customRange!.from!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${customRange!.to!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : null

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {(["7d", "14d", "30d", "90d"] as RangePreset[]).map(r => (
        <button
          key={r}
          onClick={() => { onPresetChange(r); onCustomRangeChange(undefined) }}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            !isCustom && r === preset ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {PRESET_LABELS[r]}
        </button>
      ))}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) setDraftRange(customRange)
        }}
      >
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              isCustom ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarIcon className="h-3 w-3" />
            {isCustom ? label : "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-2">
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={setDraftRange}
            disabled={minDate ? { before: minDate } : undefined}
            numberOfMonths={2}
          />
          <div className="mt-1 flex items-center justify-end gap-1.5 border-t border-border pt-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={() => { onCustomRangeChange(draftRange); setOpen(false) }}
              disabled={!draftRange?.from || !draftRange?.to}
              className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
