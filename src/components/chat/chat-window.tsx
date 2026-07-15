"use client"

import { useRef, useEffect } from "react"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import type { Message } from "@/types/chat"

interface ChatWindowProps {
  messages: Message[]
  onSend: (content: string) => void
  isLoading?: boolean
}

export function ChatWindow({ messages, onSend, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-32">
              <p className="text-muted-foreground text-sm">
                Start a conversation
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>
      <ChatInput onSend={onSend} disabled={isLoading} />
    </div>
  )
}
