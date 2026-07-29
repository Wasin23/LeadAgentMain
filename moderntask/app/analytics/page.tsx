import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { AnalyticsContent } from "@/components/analytics/analytics-content"

export default function AnalyticsPage() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 p-4 lg:p-6 lg:ml-64 overflow-y-auto">
        <Header
          title="Analytics"
          description="Track your performance and productivity metrics."
        />

        <div className="mt-6">
          <AnalyticsContent />
        </div>
      </main>
    </div>
  )
}
