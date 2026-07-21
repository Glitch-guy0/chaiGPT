"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { MessageBubble } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import type { Message } from "@/types/chat"

interface ChatWindowProps {
  messages: Message[]
  onSend: (content: string) => void
  conversationId?: string
  isLoading?: boolean
  editingMessageId?: string | null
  onToggleEdit?: (messageId: string | null) => void
}

export function ChatWindow({
  messages,
  onSend,
  conversationId,
  isLoading,
  editingMessageId: editingMessageIdProp,
  onToggleEdit,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    editingMessageIdProp ?? null,
  )
  const [localMessages, setLocalMessages] = useState<Message[]>(messages)

  useEffect(() => {
    setLocalMessages(messages)
  }, [messages])

  useEffect(() => {
    if (editingMessageIdProp !== undefined) {
      setEditingMessageId(editingMessageIdProp)
    }
  }, [editingMessageIdProp])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages])

  const lastUserIdx = (() => {
    for (let i = localMessages.length - 1; i >= 0; i--) {
      if (localMessages[i].role === "user") return i
    }
    return -1
  })()

  const isLatestMessage =
    editingMessageId !== null &&
    lastUserIdx >= 0 &&
    localMessages[lastUserIdx]?.id === editingMessageId

  const handleRemoveAsset = useCallback(
    async (messageId: string, assetId: string) => {
      const prevAssetIds = localMessages.find((m) => m.id === messageId)?.assetIds

      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, assetIds: (m.assetIds ?? []).filter((a: string) => a !== assetId) }
            : m,
        ),
      )

      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/messages/${messageId}/assets/${assetId}`,
          { method: "DELETE" },
        )
        if (!res.ok) throw new Error("Failed to remove asset")
      } catch {
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, assetIds: prevAssetIds } : m,
          ),
        )
        toast.error("Failed to remove asset. Please try again.")
      }
    },
    [localMessages, conversationId],
  )

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {localMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-32">
              <p className="text-muted-foreground text-sm">
                Start a conversation
              </p>
            </div>
          ) : (
            <>
              {localMessages.map((message, idx) => {
                const isAssistantEditing =
                  message.role === "assistant" &&
                  idx === lastUserIdx + 1 &&
                  isLatestMessage

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isEditing={isAssistantEditing}
                    onRemoveAsset={
                      isAssistantEditing
                        ? (assetId) => handleRemoveAsset(message.id, assetId)
                        : undefined
                    }
                  />
                )
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>
      <ChatInput onSend={onSend} disabled={isLoading} />
    </div>
  )
}
