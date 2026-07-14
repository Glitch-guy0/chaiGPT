"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ChatResponse } from "@/types/chat"

async function sendMessage(messages: Message[]) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) throw new Error("Failed to send message")
  return res.json() as Promise<ChatResponse>
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
