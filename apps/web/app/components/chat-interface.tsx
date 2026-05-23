"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { TypingIndicator } from "@/app/components/typing-indicator"
import { BACKEND_URL } from "../lib/config"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export function ChatInterface({
  sessionId,
  onBack,
}: {
  sessionId: string
  onBack?: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setStreaming(true)

    const assistantId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage.content,
          stream: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat error: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type") ?? ""

      if (contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                const parsed = JSON.parse(data)
                const token =
                  parsed.token ||
                  parsed.content ||
                  parsed.delta ||
                  parsed.text ||
                  ""
                if (token) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: msg.content + token }
                        : msg,
                    ),
                  )
                }
              } catch {
                if (data && data !== "[DONE]") {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: msg.content + data }
                        : msg,
                    ),
                  )
                }
              }
            }
          }
        }
      } else {
        const data = (await response.json()) as {
          answer?: string
          message?: string
          content?: string
        }
        const text = data.answer ?? data.message ?? data.content ?? ""
        if (text) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: text } : msg,
            ),
          )
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content:
                  msg.content ||
                  "Error: Failed to get response. Please try again.",
              }
            : msg,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {onBack && (
        <div className="border-b border-border-subtle px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted hover:text-green-accent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted text-sm">
              Ask a question about your PDF to get started
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-green-accent/10 text-green-accent border border-green-accent/20"
                  : "bg-surface text-green-accent border border-border-subtle"
              }`}
            >
              <p className="whitespace-pre-wrap wrap-break-word">{msg.content}</p>
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border-subtle rounded-lg">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border-subtle p-4 bg-dark"
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm text-green-accent placeholder:text-muted resize-none outline-none focus:border-green-accent/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="bg-green-accent text-dark p-3 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-green-accent-dark transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14M12 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
