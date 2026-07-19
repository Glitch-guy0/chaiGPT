"use client"

import { useState, useCallback } from "react"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { useChat } from "@/hooks/use-chat"
import type { Message, Conversation } from "@/types/chat"

export default function Home() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const chatMutation = useChat()

  const handleSend = useCallback(
    async (content: string) => {
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: conversation?.id || crypto.randomUUID(),
        userId: conversation?.userId || crypto.randomUUID(),
        role: "user",
        content,
        status: "complete",
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])

    try {
      const response = await chatMutation.mutateAsync({
        messages: [...messages, userMessage],
        conversationId: conversation?.id,
      })

        const assistantMessage: Message = {
          id: response.id,
          conversationId: response.conversationId,
          userId: conversation?.userId || crypto.randomUUID(),
          role: "assistant",
          content: response.content,
          status: "complete",
          createdAt: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
        setConversation((prev) =>
          prev && prev.id === response.conversationId
            ? prev
            : {
                id: response.conversationId,
                userId: conversation?.userId || crypto.randomUUID(),
                title: content.slice(0, 50),
                createdAt: new Date(),
                updatedAt: new Date(),
              }
        )
      } catch {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          conversationId: conversation?.id || crypto.randomUUID(),
          userId: conversation?.userId || crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          status: "complete",
          createdAt: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [messages, conversation, chatMutation]
  )

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <ChatWindow
        messages={messages}
        onSend={handleSend}
        isLoading={chatMutation.isPending}
      />
    </div>
  )
}
