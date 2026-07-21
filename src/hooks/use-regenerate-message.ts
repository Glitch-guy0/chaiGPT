"use client"

import { useState, useRef, useCallback } from "react"

export interface RegenerateStreamState {
  content: string
  isStreaming: boolean
  status: "processing" | "complete" | "stopped"
  error?: string
}

const INITIAL_STATE: RegenerateStreamState = {
  content: "",
  isStreaming: false,
  status: "processing",
}

export function useRegenerateMessage() {
  const [state, setState] = useState<RegenerateStreamState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const regenerate = useCallback(
    async (messageId: string, onUpdate?: (content: string) => void) => {
      abortRef.current?.abort()

      const controller = new AbortController()
      abortRef.current = controller

      let currentContent = ""

      setState({
        content: "",
        isStreaming: true,
        status: "processing",
      })

      try {
        const res = await fetch(`/api/chat/regenerate/${messageId}`, {
          method: "POST",
          signal: controller.signal,
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: "Failed to regenerate" }))
          throw new Error(errorBody.error || "Failed to regenerate")
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response stream")

        const decoder = new TextDecoder()
        let buffer = ""
        let currentEvent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7)
              continue
            }

            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") continue

              try {
                if (currentEvent === "done") {
                  const payload = JSON.parse(data) as { id: string; status: string; conversationId?: string }
                  setState({
                    content: currentContent,
                    isStreaming: false,
                    status: "complete",
                  })
                  currentEvent = ""
                  continue
                }

                if (currentEvent === "stopped") {
                  const payload = JSON.parse(data) as { id: string; status: string; conversationId?: string }
                  setState({
                    content: currentContent || "User terminated the response",
                    isStreaming: false,
                    status: "stopped",
                  })
                  currentEvent = ""
                  continue
                }

                const parsed = JSON.parse(data) as Record<string, unknown>
                if (typeof parsed.token === "string") {
                  currentContent += parsed.token
                } else if (typeof parsed.content === "string") {
                  currentContent += parsed.content
                }

                setState((prev) => ({
                  ...prev,
                  content: currentContent,
                }))

                onUpdate?.(currentContent)
              } catch {
                // skip unparseable chunks
              }
              currentEvent = ""
            } else if (line === "") {
              currentEvent = ""
            }
          }
        }

        setState((prev) => {
          if (prev.isStreaming) {
            return {
              ...prev,
              content: currentContent || prev.content,
              isStreaming: false,
              status: "complete",
            }
          }
          return prev
        })
      } catch (err) {
        if (controller.signal.aborted) {
          setState((prev) => ({
            ...prev,
            content: currentContent || "User terminated the response",
            isStreaming: false,
            status: "stopped",
          }))
          return
        }

        setState({
          content: currentContent,
          isStreaming: false,
          status: "stopped",
          error: err instanceof Error ? err.message : "Stream failed",
        })
      }
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL_STATE)
  }, [])

  return {
    state,
    regenerate,
    abort,
    reset,
  }
}
