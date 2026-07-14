"use client"

import { useState } from "react"
import { Sidebar } from "@/components/chat/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import { useChat } from "@/hooks/use-chat"
import type { Message } from "@/types/chat"

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const chatMutation = useChat()

  const handleSend = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const response = await chatMutation.mutateAsync([...messages, userMessage])
      const assistantMessage: Message = {
        id: response.id,
        role: "assistant",
        content: response.content,
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

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
