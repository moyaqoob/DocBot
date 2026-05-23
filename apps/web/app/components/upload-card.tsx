"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import { BACKEND_URL } from "../lib/config"
import { useSessionStore } from "@/app/store/session-store"

export function UploadCard() {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { data: session } = useSession()
  const setSession = useSessionStore((s) => s.setSession)

  const validateFile = useCallback((f: File) => {
    const isPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      setError("Only PDF files are allowed")
      return false
    }
    setError(null)
    return true
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f && validateFile(f)) setFile(f)
    },
    [validateFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f && validateFile(f)) setFile(f)
    },
    [validateFile],
  )

  const handleUpload = async () => {
    if (!file) return

    if (!session) {
      await signIn("google", { callbackUrl: "/" })
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()
      const sessionId = data.session_id

      setSession({
        sessionId,
        filename: file.name,
        uploadTime: new Date().toISOString(),
        pageCount: data.page_count ?? undefined,
      })

      router.push(`/chat/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors duration-200 ${
          dragOver
            ? "border-green-accent bg-green-accent/10"
            : "border-border-subtle bg-surface hover:border-green-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleInputChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <svg
            className={`w-10 h-10 ${dragOver ? "text-green-accent" : "text-muted"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-muted">
            Drag & drop your PDF here, or click to browse
          </p>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {file && (
        <div className="w-full border border-border-subtle rounded-lg p-4 bg-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <svg
                className="w-6 h-6 text-green-accent shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div className="min-w-0">
                <p className="text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted">{formatSize(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-muted hover:text-green-accent transition-colors shrink-0 ml-3"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full py-3 px-6 rounded-lg bg-green-accent text-dark font-medium transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-green-accent-dark active:scale-[0.98]"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Uploading...
          </span>
        ) : (
          "Upload"
        )}
      </button>
    </div>
  )
}
