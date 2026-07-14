"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Conversation } from "@/types/chat"

async function fetchConversations() {
  const res = await fetch("/api/conversations")
  if (!res.ok) throw new Error("Failed to fetch conversations")
  return res.json() as Promise<Conversation[]>
}

async function createConversation(title: string) {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to create conversation")
  return res.json() as Promise<Conversation>
}

export function useConversations() {
  const queryClient = useQueryClient()

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  })

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })

  return { conversations, isLoading, createConversation: createMutation.mutate }
}
