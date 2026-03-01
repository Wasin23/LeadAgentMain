import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { CRMContent } from "@/components/crm/crm-content"

export default function CRMPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-4 lg:p-6 lg:ml-64">
        <Header
          title="CRM"
          description="Import contacts from your connected CRM and assign them to an agent."
        />

        <div className="mt-6">
          <CRMContent />
        </div>
      </main>
    </div>
  )
}
