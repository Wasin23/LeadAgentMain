import { Suspense } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { SchedulesContent } from "@/components/schedules/schedules-content"

export default function SchedulesPage() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 p-4 lg:p-6 lg:ml-64 overflow-y-auto">
        <Header
          title="Schedules"
          description="Control how many main emails and follow-ups go out per day, and save different schedules to switch between."
        />

        <div className="mt-6">
          <Suspense fallback={null}>
            <SchedulesContent />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
