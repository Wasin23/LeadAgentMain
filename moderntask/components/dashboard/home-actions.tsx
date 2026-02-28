"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Bot, Rocket } from "lucide-react"

export function HomeActions() {
  const router = useRouter()

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        onClick={() => router.push("/agents?create=true")}
        className="w-full sm:w-auto h-9 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
      >
        <Bot className="w-4 h-4 mr-2" />
        Create Agent
      </Button>
      <Button
        variant="outline"
        onClick={() => router.push("/operations")}
        className="w-full sm:w-auto h-9 text-sm transition-all duration-300 hover:shadow-md hover:scale-105 bg-transparent"
      >
        <Rocket className="w-4 h-4 mr-2" />
        Get Started
      </Button>
    </div>
  )
}
