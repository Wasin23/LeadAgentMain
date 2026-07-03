"use client"

import { useMemo } from "react"

const TEMPLATES: string[] = [
  "Welcome back, {name}.",
  "Good to see you, {name}.",
  "{name}, let's see what your agents have been up to.",
  "Hey {name} - your outreach is waiting.",
  "{name}, ready to find some leads?",
  "Welcome home, {name}.",
  "Let's get to work, {name}.",
  "{name}, here's where things stand.",
  "Good to have you back, {name}.",
  "{name}, your pipeline awaits.",
  "Hey {name}, let's check the numbers.",
  "{name}, time to keep the momentum going.",
  "Welcome in, {name}.",
  "{name}, your agents have news for you.",
  "Hi {name} - here's your overview.",
  "{name}, let's see how outreach is going.",
  "Back at it, {name}?",
  "{name}, your dashboard is ready.",
  "Hey {name}, nice to see you.",
  "{name}, let's turn leads into replies.",
]

export function WelcomeMessage({ name }: { name?: string }) {
  const message = useMemo(() => {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]
    return template.replace("{name}", name?.trim() || "there")
  }, [name])

  return <h1 className="font-display text-xl md:text-2xl text-foreground">{message}</h1>
}
