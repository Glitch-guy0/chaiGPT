"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

interface EditMessageParams {
  conversationId: string
  content: string
}

interface EditMessageResult {
  userMessage: { id: string; content: string }
  assistantMessage: { id: string; content: string }
}

async function editMessage({ conversationId, content }: EditMessageParams): Promise<EditMessageResult> {
  const res = await fetch(`/api/conversations/${conversationId}/edit`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to edit message" }))
    throw new Error(error.error || "Failed to edit message")
  }

  return res.json()
}

export function useEditMessage() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: editMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })

  return mutation
}
