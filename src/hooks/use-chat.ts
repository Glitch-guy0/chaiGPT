"use client"

import { useState, useRef, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ChatResponse, Message, Citation } from "@/types/chat"

interface SendMessageParams {
  messages: Message[]
  conversationId?: string
}

interface DonePayload {
  id: string
  status: "complete"
  citations?: Citation[]
  ragDegraded?: boolean
  conversationId?: string
}

interface StoppedPayload {
  id: string
  status: "stopped"
  conversationId?: string
}

export interface AssistantStreamState {
  content: string
  isStreaming: boolean
  status: "processing" | "complete" | "stopped"
  citations?: Citation[]
  error?: string
  assistantMessageId?: string
  conversationId?: string
}

const INITIAL_STREAM_STATE: AssistantStreamState = {
  content: "",
  isStreaming: false,
  status: "processing",
}

async function sendMessage({ messages, conversationId }: SendMessageParams) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, conversationId }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to send message" }))
    throw new Error(error.error || "Failed to send message")
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error("No response stream")
  }

  const decoder = new TextDecoder()
  let fullContent = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split("\n")

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        if (data === "[DONE]") continue

        try {
          const parsed = JSON.parse(data) as ChatResponse
          fullContent += parsed.content
        } catch {
          // skip unparseable chunks
        }
      }
    }
  }

  return { content: fullContent } as ChatResponse
}

export function useChat() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })

  return mutation
}

export function useStreamingChat() {
  const [state, setState] = useState<AssistantStreamState>(INITIAL_STREAM_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const startStream = useCallback(
    async (messages: Message[], conversationId?: string) => {
      abortRef.current?.abort()

      const controller = new AbortController()
      abortRef.current = controller

      setState({
        content: "",
        isStreaming: true,
        status: "processing",
      })

      let currentContent = ""

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, conversationId }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: "Failed to send message" }))
          throw new Error(errorBody.error || "Failed to send message")
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response stream")

        streamRef.current = reader
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
                  const payload = JSON.parse(data) as DonePayload
                  setState({
                    content: currentContent,
                    isStreaming: false,
                    status: "complete",
                    citations: payload.citations,
                    assistantMessageId: payload.id,
                    conversationId: payload.conversationId,
                  })
                  currentEvent = ""
                  continue
                }

                if (currentEvent === "stopped") {
                  const payload = JSON.parse(data) as StoppedPayload
                  setState((prev) => ({
                    ...prev,
                    content: currentContent || "User terminated the response",
                    isStreaming: false,
                    status: "stopped",
                    assistantMessageId: payload.id,
                    conversationId: payload.conversationId,
                  }))
                  currentEvent = ""
                  continue
                }

                const parsed = JSON.parse(data) as Record<string, unknown>
                if (typeof parsed.token === "string") {
                  currentContent += parsed.token
                  setState((prev) => ({
                    ...prev,
                    content: currentContent,
                  }))
                } else if (typeof parsed.content === "string") {
                  currentContent += parsed.content
                  setState((prev) => ({
                    ...prev,
                    content: currentContent,
                  }))
                }
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

  const stopStream = useCallback(() => {
    abortRef.current?.abort()
    streamRef.current?.cancel()
  }, [])

  const resetStream = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL_STREAM_STATE)
  }, [])

  return {
    streamState: state,
    startStream,
    stopStream,
    resetStream,
  }
}
