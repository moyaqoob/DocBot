"use client"

import { useSessionStore } from "@/app/store/session-store"

export function PdfInfoPanel() {
  const session = useSessionStore((s) => s.session)

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted text-xs">Loading session info...</p>
      </div>
    )
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs text-muted uppercase tracking-wider mb-1">
          Document
        </p>
        <p className="text-sm truncate">{session.filename}</p>
      </div>

      <div>
        <p className="text-xs text-muted uppercase tracking-wider mb-1">
          Uploaded
        </p>
        <p className="text-sm">{formatDate(session.uploadTime)}</p>
      </div>

      {session.pageCount !== undefined && (
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-1">
            Pages
          </p>
          <p className="text-sm">{session.pageCount}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-muted uppercase tracking-wider mb-1">
          Session
        </p>
        <p className="text-xs text-muted truncate font-mono">
          {session.sessionId}
        </p>
      </div>

      <div className="pt-6 border-t border-border-subtle">
        <p className="text-xs text-muted">
          Ask questions about the content of your PDF. The AI will respond based
          on the document&apos;s contents.
        </p>
      </div>
    </div>
  )
}
