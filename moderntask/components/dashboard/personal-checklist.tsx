"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, X, CheckCircle, Circle, ListChecks, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

const STORAGE_KEY = "meridian-personal-checklist"

function loadItems(): ChecklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveItems(items: ChecklistItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
}

export function PersonalChecklist() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [text, setText] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setItems(loadItems()) }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const update = (next: ChecklistItem[]) => { setItems(next); saveItems(next) }

  const addItem = () => {
    if (!text.trim()) return
    update([...items, { id: crypto.randomUUID(), text: text.trim(), done: false }])
    setText("")
  }

  const toggleItem = (id: string) => update(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  const removeItem = (id: string) => update(items.filter((i) => i.id !== id))

  const remaining = items.filter((i) => !i.done).length

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="h-8 text-xs px-3 transition-all duration-300 hover:shadow-md hover:scale-105 bg-transparent gap-1.5"
      >
        <ListChecks className="w-3.5 h-3.5" />
        Checklist
        {remaining > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
            {remaining}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-card shadow-lg shadow-black/10 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Your checklist</span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {items.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground text-center">Nothing here yet — add a task below.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="group flex items-center gap-2.5 px-4 py-2 hover:bg-muted/50">
                  <button onClick={() => toggleItem(item.id)} className="shrink-0">
                    {item.done
                      ? <CheckCircle className="w-4 h-4 text-primary" />
                      : <Circle className="w-4 h-4 text-muted-foreground/40" />}
                  </button>
                  <span className={`flex-1 text-sm truncate ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-1.5 border-t border-border p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem() }}
              placeholder="Add a task…"
              className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={addItem} className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
