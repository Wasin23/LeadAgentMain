import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { ChatLabContent } from "@/components/chat-lab/chat-lab-content"

export default function ChatLabPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 lg:ml-64 flex flex-col h-screen overflow-hidden">
        <div className="p-4 lg:p-6 pb-0">
          <Header
            title="Chat Lab"
            description="Test your chat AI, manage your knowledge base, and tune responses before leads see them."
          />
        </div>
        <div className="flex-1 overflow-hidden p-4 lg:p-6 pt-4">
          <ChatLabContent />
        </div>
      </main>
    </div>
  )
}
