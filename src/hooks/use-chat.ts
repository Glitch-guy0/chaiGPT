"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ChatResponse, Message } from "@/types/chat"

interface SendMessageParams {
  messages: Message[]
  conversationId?: string
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
