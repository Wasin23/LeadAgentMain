import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { EmailQueueContent } from "@/components/email-queue/email-queue-content"

export default function EmailQueuePage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:ml-64">
        <Header
          title="Email Queue"
          description="Review, approve, and track your outreach emails."
        />
        <div className="mt-5">
          <EmailQueueContent />
        </div>
      </main>
    </div>
  )
}
