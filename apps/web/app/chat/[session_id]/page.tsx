"use client"

import { useParams, useRouter } from "next/navigation"
import { ChatInterface } from "@/app/components/chat-interface"
import { PdfInfoPanel } from "@/app/components/pdf-info-panel"
import { useSessionStore } from "@/app/store/session-store"

export default function ChatPage() {
  const params = useParams<{ session_id: string }>()
  const router = useRouter()
  const clearSession = useSessionStore((s) => s.clearSession)

  const handleBack = () => {
    clearSession()
    router.push("/")
  }

  return (
    <div className="h-screen flex">
      <aside className="w-72 border-r border-border-subtle bg-surface shrink-0 overflow-y-auto hidden md:block">
        <div className="p-4 border-b border-border-subtle">
          <h2 className="text-sm font-medium tracking-tight">PDF Chatbot</h2>
        </div>
        <PdfInfoPanel />
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <ChatInterface sessionId={params.session_id} onBack={handleBack} />
      </main>
    </div>
  )
}
